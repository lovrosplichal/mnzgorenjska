-- Glasovanje o poziciji ne sme razbiti tuje ekipe.
--
-- Kvota kadra (2 vratarja, 5 branilcev, 5 vezistov, 3 napadalci) se je sodila
-- po TRENUTNI poziciji igralca. Ta pa se med sezono premika, ker jo določa
-- glasovanje skupnosti. Ko je nekdo, kupljen kot branilec, pristal med
-- napadalci, je kader nenadoma 2-4-5-4 — neveljaven. `zakleni_krog`
-- neveljavnemu kadru ne naredi posnetka, torej ekipa v tistem krogu dobi nič
-- točk. Lastnik ni naredil ničesar in o tem ni bil obveščen.
--
-- Ob uvedbi tega popravka je bilo neveljavnih 31 od 61 članskih kadrov, od
-- tega 30 prav zaradi kvote. Najpogostejše oblike so bile 2-4-5-4, 2-5-4-4 in
-- 2-6-4-3 — vse za enega igralca stran od pravila.
--
-- Rešitev je ista, kot jo projekt že uporablja za cene. Pri borzi piše:
-- "ekipa plača ceno ob nakupu. Brez tega bi podražitev igralca ekipi za nazaj
-- razbila proračun in bi postala neveljavna, ne da bi lastnik karkoli naredil"
-- — zato obstaja `fantasy_roster.buy_value`. Pozicija dobi svojo dvojnico:
-- `fantasy_roster.buy_position`.
--
-- Odslej velja:
--   * kvoto kadra sodimo po poziciji OB NAKUPU — poznejši glas kadra ne razbije,
--   * točke še naprej šteje PRAVA pozicija — gol je vreden toliko, kolikor je
--     vreden gol igralca na tem mestu; to je stvar nogometa, ne kadrovanja,
--   * ob vsaki spremembi kadra se pozicija ob nakupu uskladi s trenutno.

-- --------------------------------------------------------------------------
-- 1. Pozicija ob nakupu
-- --------------------------------------------------------------------------
alter table fantasy_roster add column if not exists buy_position text;

alter table fantasy_roster drop constraint if exists fantasy_roster_buy_position_check;
alter table fantasy_roster add constraint fantasy_roster_buy_position_check
  check (buy_position is null or buy_position in ('GK', 'DEF', 'MID', 'FWD'));

comment on column fantasy_roster.buy_position is
  'Pozicija igralca ob uvrstitvi v kader. Kvota kadra se meri po njej, ne po '
  'trenutni — sicer bi glasovanje skupnosti razbilo tuj kader. Točke šteje '
  'trenutna, prava pozicija.';

-- Izhodišče: kar igralec je zdaj.
update fantasy_roster fr
   set buy_position = p.position
  from players p
 where p.id = fr.player_id and fr.buy_position is null;

-- --------------------------------------------------------------------------
-- 2. Povrnitev kadrov, ki jih je glasovanje razbilo
-- --------------------------------------------------------------------------
-- Kader je bil ob shranjevanju veljaven — odjemalec drugačnega ne spusti
-- skozi. Če danes ne ustreza kvoti, se je nekomu pozicija premaknila. Prave
-- prvotne pozicije ne vemo (zgodovine ne hranimo), zato jo poiščemo nazaj:
-- presežek premaknemo tja, kjer primanjkuje, in sicer pri igralcu, ki mu je
-- pozicijo določilo GLASOVANJE (le ta se je lahko premaknil) in ki ima za
-- ciljno mesto najmočnejši statistični prior.
--
-- Vratarja iz zapisnika in ročno nastavljene pozicije pustimo pri miru — ti
-- so zanesljivi in se niso mogli premakniti.
do $$
declare
  v_ekipa record;
  v_kvota constant jsonb := '{"GK":2,"DEF":5,"MID":5,"FWD":3}';
  v_presezek text;
  v_manko text;
  v_igralec bigint;
  v_koraki int;
  v_popravljenih int := 0;
begin
  for v_ekipa in
    select ft.id
    from fantasy_teams ft
    where (select count(*) from fantasy_roster fr where fr.fantasy_team_id = ft.id) = 15
  loop
    v_koraki := 0;
    loop
      v_koraki := v_koraki + 1;
      exit when v_koraki > 15;

      select poz into v_presezek from (
        select fr.buy_position poz, count(*) n
        from fantasy_roster fr where fr.fantasy_team_id = v_ekipa.id
        group by fr.buy_position
      ) s where n > (v_kvota ->> s.poz)::int limit 1;
      exit when v_presezek is null;

      select k.poz into v_manko
      from jsonb_each_text(v_kvota) k(poz, n)
      where k.n::int > (
        select count(*) from fantasy_roster fr
        where fr.fantasy_team_id = v_ekipa.id and fr.buy_position = k.poz
      )
      limit 1;
      exit when v_manko is null;

      -- Kandidat: najprej tisti, ki mu je pozicijo dalo glasovanje, in med
      -- njimi tisti, ki mu prior najbolj pritrjuje, da spada na manjkajoče mesto.
      select fr.player_id into v_igralec
      from fantasy_roster fr
      join players p on p.id = fr.player_id
      left join position_priors pp
        on pp.player_id = p.id and pp.position = v_manko
      where fr.fantasy_team_id = v_ekipa.id
        and fr.buy_position = v_presezek
      order by
        case p.position_source when 'glasovanje' then 0 when 'ugibanje' then 1 else 2 end,
        coalesce(pp.score, 0) desc
      limit 1;
      exit when v_igralec is null;

      update fantasy_roster
         set buy_position = v_manko
       where fantasy_team_id = v_ekipa.id and player_id = v_igralec;
      v_popravljenih := v_popravljenih + 1;
    end loop;
  end loop;
  raise notice 'poravnanih mest v kadrih: %', v_popravljenih;
end;
$$;

-- --------------------------------------------------------------------------
-- 3. Veljavnost kadra se meri po poziciji ob nakupu
-- --------------------------------------------------------------------------
create or replace function roster_je_veljaven(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with roster as (
    -- coalesce: vrstice izpred tega popravka nimajo zapisane pozicije
    select fr.*, coalesce(fr.buy_position, p.position) as poz,
           p.team_id as klub_id, p.active
    from fantasy_roster fr
    join players p on p.id = fr.player_id
    where fr.fantasy_team_id = p_team_id
  ),
  po_poziciji as (
    select
      count(*) filter (where poz = 'GK')  as gk,
      count(*) filter (where poz = 'DEF') as def,
      count(*) filter (where poz = 'MID') as mid,
      count(*) filter (where poz = 'FWD') as fwd,
      count(*) filter (where poz is null) as brez_poz,
      count(*) filter (where not active)  as neaktivnih,
      count(*)                             as skupaj,
      count(*) filter (where is_starter)   as starterjev,
      count(*) filter (where is_captain)   as kapetanov,
      count(*) filter (where is_vice)      as namestnikov
    from roster
  ),
  po_klubu as (
    select max(cnt) as max_iz_kluba from (
      select klub_id, count(*) as cnt from roster group by klub_id
    ) s
  )
  select
    p.skupaj = 15
    and p.starterjev = 11
    and p.kapetanov = 1
    and p.namestnikov = 1
    and p.gk = 2 and p.def = 5 and p.mid = 5 and p.fwd = 3
    and p.brez_poz = 0
    and p.neaktivnih = 0
    and coalesce(k.max_iz_kluba, 0) <= 3
  from po_poziciji p, po_klubu k;
$$;

-- --------------------------------------------------------------------------
-- 4. Shranjevanje ekipe zapiše pozicijo ob nakupu
-- --------------------------------------------------------------------------
create or replace function shrani_ekipo(
  p_team_id bigint,
  p_roster  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash          numeric;
  v_delta         numeric;
  v_dobicek       numeric;
  v_strosek       numeric;
  v_stari_buy     jsonb;
  v_stara_poz     jsonb;
  v_tekmovanje    bigint;
  v_tujih         int;
begin
  select cash, competition_id into v_cash, v_tekmovanje
    from fantasy_teams
   where id = p_team_id and owner_id = auth.uid();

  if v_tekmovanje is null then
    raise exception 'Ni dovoljenja za urejanje te ekipe.'
      using errcode = '42501';
  end if;

  select count(*) into v_tujih
  from jsonb_array_elements(p_roster) e
  join players p on p.id = (e->>'player_id')::bigint
  where p.competition_id <> v_tekmovanje;

  if v_tujih > 0 then
    raise exception 'V ekipi so igralci iz druge lige.'
      using errcode = 'P0001';
  end if;

  select coalesce(jsonb_object_agg(player_id::text, buy_value), '{}'::jsonb)
    into v_stari_buy
    from fantasy_roster where fantasy_team_id = p_team_id;

  -- Igralec, ki v kadru ostane, obdrži mesto, na katerem je bil kupljen;
  -- novi ga dobijo po trenutni poziciji.
  select coalesce(jsonb_object_agg(player_id::text, buy_position), '{}'::jsonb)
    into v_stara_poz
    from fantasy_roster
   where fantasy_team_id = p_team_id and buy_position is not null;

  select coalesce(sum(p.value), 0)::numeric into v_dobicek
  from fantasy_roster fr
  join players p on p.id = fr.player_id
  where fr.fantasy_team_id = p_team_id
    and not exists (
      select 1
      from jsonb_array_elements(p_roster) e
      where (e->>'player_id')::bigint = fr.player_id
    );

  select coalesce(sum(p.value), 0)::numeric into v_strosek
  from jsonb_array_elements(p_roster) e
  join players p on p.id = (e->>'player_id')::bigint
  where not exists (
    select 1 from fantasy_roster fr
    where fr.fantasy_team_id = p_team_id
      and fr.player_id = (e->>'player_id')::bigint
  );

  v_delta := v_dobicek - v_strosek;

  if v_cash + v_delta < 0 then
    raise exception 'Premalo sredstev — potrebuješ še % M.', abs(v_cash + v_delta)::text
      using errcode = 'P0001';
  end if;

  delete from fantasy_roster where fantasy_team_id = p_team_id;

  insert into fantasy_roster (
    fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order,
    buy_value, buy_position
  )
  select
    p_team_id,
    (e->>'player_id')::bigint,
    coalesce((e->>'is_starter')::boolean, false),
    coalesce((e->>'is_captain')::boolean, false),
    coalesce((e->>'is_vice')::boolean, false),
    nullif(e->>'bench_order', '')::int,
    coalesce(
      (v_stari_buy ->> (e->>'player_id'))::numeric,
      (select value from players where id = (e->>'player_id')::bigint)
    ),
    coalesce(
      v_stara_poz ->> (e->>'player_id'),
      (select position from players where id = (e->>'player_id')::bigint)
    )
  from jsonb_array_elements(p_roster) e;

  update fantasy_teams
    set cash = v_cash + v_delta
    where id = p_team_id;

  return jsonb_build_object(
    'cash',      v_cash + v_delta,
    'dobicek',   v_dobicek,
    'strosek',   v_strosek,
    'delta',     v_delta
  );
end;
$$;

grant execute on function shrani_ekipo(bigint, jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- 5. Sprememba pozicije ne popravlja starih krogov
-- --------------------------------------------------------------------------
-- Točke morajo pozicijo dohiteti, dokler je krog svež — brez tega bi napadalcu
-- gol štel nič, ker ob uvozu zapisnika pozicije še ni poznal nihče. Ne smejo pa
-- premikati lestvice tedne za nazaj. Okno je isto kot pri borzi: kar je starejše
-- od dveh tednov, je zgodovina.
create or replace function preracunaj_igralca(
  p_player_id bigint,
  p_okno interval default interval '14 days'
)
returns int
language sql
security definer
set search_path = public
as $$
  with novo as (
    insert into player_scores (round_id, player_id, points, computed_at)
    select ap.round_id, ap.player_id, sum(ap.points), now()
    from appearance_points ap
    join rounds r on r.id = ap.round_id
    where ap.player_id = p_player_id
      and (r.played_on is null or r.played_on >= current_date - p_okno)
    group by ap.round_id, ap.player_id
    on conflict (round_id, player_id) do update
      set points = excluded.points,
          computed_at = excluded.computed_at
    returning 1
  )
  select count(*)::int from novo;
$$;

drop function if exists preracunaj_igralca(bigint);
