-- Priorji za pozicije + uteženo glasovanje.
--
-- Trije mehanizmi za hitrejšo potrditev pozicije, ki delujejo skupaj:
--
--   #4 Statistični prior + prilagodljivi prag.
--      Iz številke dresa in statistike (goli/90, kartoni/90) izračunamo za
--      vsakega igralca porazdelitev [0..1] po štirih pozicijah. Ko je prior
--      močan (>= 0.7 za eno pozicijo), zniža potrebni prag glasov za to
--      pozicijo (5 -> 2). Šibek prior ostaja pri osnovnem pragu.
--
--   #5 Utež glasovalca (zaupanje).
--      Glasovalec, čigar pretekli glasovi so se ujemali s potrjenimi
--      pozicijami, dobi večjo utež (do 2×). Novinec ali netočen glasovalec
--      ostane pri 1× (najnižje pri 0.5). Ničesar ni treba ročno urejati —
--      utež se preračuna sproti.
--
--   #3 Poznavalec kluba (insider).
--      Uporabnik lahko označi klub, ki ga dobro pozna. Njegov glas za igralce
--      tega kluba šteje več (default 3×). Ker gre za amaterski projekt,
--      preverjanja ni; zaščita je le zgornja meja + zaupanje se sčasoma
--      poravna, če se glasovi kažejo za napačne.

-- --------------------------------------------------------------------------
-- Insider: klub, ki ga uporabnik dobro pozna
-- --------------------------------------------------------------------------
alter table profiles add column if not exists insider_team_id bigint
  references teams on delete set null;

create index if not exists profiles_insider_team_idx on profiles (insider_team_id);

-- --------------------------------------------------------------------------
-- Priorji pozicij (računa jih scripts/ugani-pozicije.mjs)
-- --------------------------------------------------------------------------
create table if not exists position_priors (
  player_id bigint not null references players on delete cascade,
  position text not null check (position in ('GK','DEF','MID','FWD')),
  score numeric(4, 3) not null default 0 check (score >= 0 and score <= 1),
  updated_at timestamptz not null default now(),
  primary key (player_id, position)
);

create index if not exists position_priors_player_idx on position_priors (player_id);

alter table position_priors enable row level security;
create policy "javno branje" on position_priors for select using (true);
create policy "admin ureja priorje" on position_priors for all
  using (is_admin()) with check (is_admin());

-- Pomožen pogled: vodilna pozicija po priorju + njena "moč".
create or replace view position_prior_leader as
  select distinct on (player_id)
    player_id,
    position as leader_position,
    score    as leader_score
  from position_priors
  order by player_id, score desc;

-- --------------------------------------------------------------------------
-- Nastavitve za nove mehanizme
-- --------------------------------------------------------------------------
insert into settings (key, value) values
  ('min_prag_glasov_pozicija', '2'::jsonb),
  ('utez_insider',              '3'::jsonb),
  ('min_glasov_za_zaupanje',    '5'::jsonb),
  ('max_utez_zaupanja',         '2'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- Zaupanje glasovalca: delež ujemanj z že potrjenimi pozicijami.
-- Kot "potrjene" štejemo zapisnik + admin + glasovanje.
-- Če je uporabnik že glasoval za igralca, ki je zdaj potrjen (in ga ni
-- glasovanje potrdilo drugače), se mu tisti glas šteje kot točen ali napačen.
-- --------------------------------------------------------------------------
create or replace view voter_position_accuracy as
  select
    pv.voter_id,
    count(*) filter (
      where p.position_source in ('zapisnik','admin','glasovanje')
        and p.position is not null
    )::int as resolved,
    count(*) filter (
      where p.position_source in ('zapisnik','admin','glasovanje')
        and p.position is not null
        and pv.position = p.position
    )::int as correct
  from position_votes pv
  join players p on p.id = pv.player_id
  group by pv.voter_id;

-- Utež posameznega glasovalca (brez insider bonusa).
-- Novinec (manj kot min_glasov_za_zaupanje potrjenih) dobi utež 1.
-- Sicer se med [0.5, max] interpolira po natančnosti.
create or replace function voter_weight(p_voter_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select
      resolved,
      correct,
      nastavitev_int('min_glasov_za_zaupanje', 5) as pot_min,
      nastavitev_int('max_utez_zaupanja',      2) as pot_max
    from voter_position_accuracy where voter_id = p_voter_id
  )
  select case
    when (select resolved from a) is null then 1.0
    -- greatest(1, ...) prepreči deljenje z nič, če je nastavitev slučajno 0
    when (select resolved from a) < greatest(1, (select pot_min from a)) then 1.0
    else greatest(
      0.5,
      least(
        (select pot_max from a)::numeric,
        0.5 + ((select pot_max from a)::numeric - 0.5)
             * ((select correct from a)::numeric / (select resolved from a)::numeric)
      )
    )
  end;
$$;

-- --------------------------------------------------------------------------
-- Prilagodljivi prag glede na priorje.
--   prior >= 0.70  ->  prag - 3   (npr. 5 -> 2)
--   prior >= 0.50  ->  prag - 2
--   prior >= 0.30  ->  prag - 1
--   sicer          ->  osnovni prag
-- Nikoli ne pade pod min_prag_glasov_pozicija.
-- --------------------------------------------------------------------------
create or replace function adaptivni_prag(
  p_player_id bigint,
  p_position text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with prior as (
    select coalesce((
      select score from position_priors
      where player_id = p_player_id and position = p_position
    ), 0) as s
  ),
  meje as (
    select
      nastavitev_int('prag_glasov_pozicija',     5)::numeric as osnovni,
      nastavitev_int('min_prag_glasov_pozicija', 2)::numeric as spodnja
  )
  select greatest(
    (select spodnja from meje),
    (select osnovni from meje) - case
      when (select s from prior) >= 0.70 then 3
      when (select s from prior) >= 0.50 then 2
      when (select s from prior) >= 0.30 then 1
      else 0
    end
  );
$$;

-- --------------------------------------------------------------------------
-- Potrjevanje pozicij (nova, utežena različica).
--
-- Za vsak glas izračuna utež:
--   max(voter_weight, utez_insider če glasuje za "svoj" klub)
-- Sešteje uteži po pozicijah, izbere vodilno, primerja z adaptivnim pragom.
--
-- Zapisnik in admin ostajata zaklenjena.
-- --------------------------------------------------------------------------
create or replace function potrdi_pozicijo(p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id       bigint;
  v_utez_insider  numeric := nastavitev_int('utez_insider', 3);
  v_position      text;
  v_utez          numeric;
  v_prag          numeric;
begin
  -- Zapisnik in admin sta neomajna.
  if exists (
    select 1 from players
    where id = p_player_id and position_source in ('zapisnik','admin')
  ) then
    return;
  end if;

  select team_id into v_team_id from players where id = p_player_id;

  select
    pv.position,
    sum(greatest(
      voter_weight(pv.voter_id),
      case when pf.insider_team_id = v_team_id then v_utez_insider else 1.0 end
    ))
    into v_position, v_utez
  from position_votes pv
  join profiles pf on pf.id = pv.voter_id
  where pv.player_id = p_player_id
  group by pv.position
  order by 2 desc
  limit 1;

  if v_position is null then
    return;
  end if;

  v_prag := adaptivni_prag(p_player_id, v_position);

  if v_utez >= v_prag then
    update players
      set position = v_position,
          position_source = 'glasovanje'
    where id = p_player_id
      and (position is distinct from v_position
           or position_source is distinct from 'glasovanje');
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- Pogled za UI: skupne uteži po poziciji + trenutni adaptivni prag.
-- Uporablja isto logiko kot potrdi_pozicijo, tako da uporabnik vidi točno,
-- kdaj se pozicija potrdi.
-- --------------------------------------------------------------------------
create or replace view position_vote_weights as
  select
    pv.player_id,
    pv.position,
    count(*)::int as votes,
    round(sum(greatest(
      voter_weight(pv.voter_id),
      case when pf.insider_team_id = p.team_id
        then nastavitev_int('utez_insider', 3)::numeric
        else 1.0
      end
    )), 2) as weight
  from position_votes pv
  join players  p  on p.id  = pv.player_id
  join profiles pf on pf.id = pv.voter_id
  group by pv.player_id, pv.position, p.team_id;
