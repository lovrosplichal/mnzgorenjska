-- Lestvica kroga in cenovna borza.
--
-- Dve stvari, ki ju liga potrebuje, ko se sezona enkrat zavrti:
--
-- 1. Kdo je bil najboljši v zadnjem krogu — pogled `krog_najboljsi`.
-- 2. Cene, ki se premikajo. Kdor niza točke, podraži; kdor ne igra, poceni.
--    Premik je majhen in počasen (največ 0.3 na krog, skupaj največ 3.0 od
--    izhodiščne cene), da se ekipe ne razsujejo čez noč.
--
-- Pomembno: ekipa plača ceno ob nakupu. Brez tega bi podražitev igralca ekipi
-- za nazaj razbila proračun in bi postala neveljavna, ne da bi lastnik karkoli
-- naredil — zato `fantasy_roster.buy_value`.

alter table players add column if not exists value_start numeric(4, 1);
update players set value_start = value where value_start is null;

alter table fantasy_roster add column if not exists buy_value numeric(4, 1);

comment on column players.value_start is
  'Cena na začetku sezone; borza se lahko od nje oddalji največ za MEJA_DRIFTA.';
comment on column fantasy_roster.buy_value is
  'Cena ob uvrstitvi v kader. Proračun se meri po njej, ne po trenutni ceni.';

-- --- zgodovina cen -------------------------------------------------------
create table if not exists price_changes (
  id bigint generated always as identity primary key,
  player_id bigint not null references players on delete cascade,
  round_id bigint not null references rounds on delete cascade,
  old_value numeric(4, 1) not null,
  new_value numeric(4, 1) not null,
  form numeric(6, 2) not null,
  changed_at timestamptz not null default now(),
  unique (player_id, round_id)
);

create index if not exists price_changes_krog on price_changes (round_id);

alter table price_changes enable row level security;
drop policy if exists "javno branje" on price_changes;
create policy "javno branje" on price_changes for select using (true);
drop policy if exists "admin ureja cene" on price_changes;
create policy "admin ureja cene" on price_changes for all
  using (is_admin()) with check (is_admin());

-- --- lestvica kroga ------------------------------------------------------
create or replace view krog_najboljsi as
select
  ps.round_id,
  r.season,
  r.number as round_number,
  p.id as player_id,
  p.full_name,
  p.position,
  t.id as team_id,
  t.name as team_name,
  t.short_name as team_short,
  t.logo_url as team_logo,
  p.value,
  ps.points,
  coalesce(mk.minutes, 0) as minutes,
  coalesce(pc.new_value - pc.old_value, 0) as price_delta,
  rank() over (partition by ps.round_id order by ps.points desc) as rank
from player_scores ps
join rounds r on r.id = ps.round_id
join players p on p.id = ps.player_id
join teams t on t.id = p.team_id
left join minute_kroga mk on mk.round_id = ps.round_id and mk.player_id = p.id
left join price_changes pc on pc.round_id = ps.round_id and pc.player_id = p.id;

-- Zadnji krog z izračunanimi točkami — aplikacija ga kaže na naslovnici.
create or replace view zadnji_odigrani_krog as
select r.id, r.season, r.number, r.played_on
from rounds r
where exists (select 1 from player_scores ps where ps.round_id = r.id)
order by r.season desc, r.number desc
limit 1;

-- --- borza ---------------------------------------------------------------
-- Cena se premakne glede na formo: vsoto točk v zadnjih treh krogih do
-- vključno danega. Meje so namenoma ozke — borza naj nagradi niz dobrih
-- predstav, ne enega samega gola.
-- Izhodni stolpci se namenoma ne imenujejo enako kot stolpci tabele
-- price_changes: v `on conflict` bi bili dvoumni.
drop function if exists preracunaj_cene(bigint);
create function preracunaj_cene(p_round_id bigint)
returns table (igralec bigint, stara_cena numeric, nova_cena numeric, forma numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  MEJA_DRIFTA constant numeric := 3.0;  -- največ toliko od izhodiščne cene
  NAJNIZJA constant numeric := 4.0;
  NAJVISJA constant numeric := 15.0;
  v_stevilka int;
  v_sezona text;
begin
  select r.number, r.season into v_stevilka, v_sezona
  from rounds r where r.id = p_round_id;
  if v_stevilka is null then
    raise exception 'krog % ne obstaja', p_round_id;
  end if;

  return query
  with forma as (
    select
      ps.player_id,
      sum(ps.points) as tocke
    from player_scores ps
    join rounds r on r.id = ps.round_id
    where r.season = v_sezona
      and r.number between greatest(1, v_stevilka - 2) and v_stevilka
    group by ps.player_id
  ),
  premik as (
    select
      p.id,
      p.value as stara,
      coalesce(f.tocke, 0) as tocke,
      case
        when coalesce(f.tocke, 0) >= 18 then 0.3
        when coalesce(f.tocke, 0) >= 12 then 0.2
        when coalesce(f.tocke, 0) >= 7 then 0.1
        when coalesce(f.tocke, 0) <= 0 then -0.2
        when coalesce(f.tocke, 0) <= 2 then -0.1
        else 0
      end as delta
    from players p
    left join forma f on f.player_id = p.id
    where not p.value_locked
      -- Krog premakne ceno natanko enkrat. Brez tega bi vsak ponovni zagon
      -- (dnevni cron, ponovni uvoz zapisnika) ceno premaknil še enkrat.
      and not exists (
        select 1 from price_changes pc
        where pc.player_id = p.id and pc.round_id = p_round_id
      )
  ),
  omejeno as (
    select
      pr.id,
      pr.stara,
      pr.tocke,
      -- premik ne sme odnesti cene predaleč od izhodišča ne iz dovoljenega pasu
      least(
        greatest(pr.stara + pr.delta, NAJNIZJA, p.value_start - MEJA_DRIFTA),
        NAJVISJA,
        p.value_start + MEJA_DRIFTA
      ) as nova
    from premik pr
    join players p on p.id = pr.id
    where pr.delta <> 0
  ),
  zapis as (
    insert into price_changes (player_id, round_id, old_value, new_value, form)
    select o.id, p_round_id, o.stara, o.nova, o.tocke
    from omejeno o
    where o.nova <> o.stara
    on conflict (player_id, round_id) do update
      set new_value = excluded.new_value,
          form = excluded.form,
          changed_at = now()
    returning price_changes.player_id, price_changes.old_value,
              price_changes.new_value, price_changes.form
  )
  select z.player_id, z.old_value, z.new_value, z.form from zapis z;
end;
$$;

-- Cene v `players` uskladimo z zadnjim zapisom borze.
create or replace function uveljavi_cene(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spremenjenih int;
begin
  perform preracunaj_cene(p_round_id);

  update players p
     set value = pc.new_value
    from price_changes pc
   where pc.player_id = p.id
     and pc.round_id = p_round_id
     and p.value <> pc.new_value;

  get diagnostics v_spremenjenih = row_count;
  return v_spremenjenih;
end;
$$;

-- Uveljavi cene za vse kroge, ki imajo izracunane tocke, borza pa jih se ni
-- videla. Namenjeno rednemu klicu iz crona po uvozu zapisnikov.
create or replace function uveljavi_zapadle_cene()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_krog record;
  v_skupaj int := 0;
begin
  for v_krog in
    select r.id
    from rounds r
    where exists (select 1 from player_scores ps where ps.round_id = r.id)
      and not exists (select 1 from price_changes pc where pc.round_id = r.id)
    order by r.season, r.number
  loop
    v_skupaj := v_skupaj + uveljavi_cene(v_krog.id);
  end loop;
  return v_skupaj;
end;
$$;

-- Borza se osvezi enkrat na dan, po tem ko so zapisniki uvozeni in tocke
-- izracunane. Ce pg_cron ni na voljo, migracija ne pade.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'uveljavi-cene',
    '30 3 * * *',
    $urnik$select public.uveljavi_zapadle_cene()$urnik$
  );
  raise notice 'pg_cron: borza se osvezi vsak dan ob 3:30';
exception
  when others then
    raise notice 'pg_cron ni na voljo (%) — cene je treba uveljaviti rocno', sqlerrm;
end;
$$;
