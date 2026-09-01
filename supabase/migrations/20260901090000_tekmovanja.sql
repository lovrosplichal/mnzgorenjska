-- Dve ligi pod isto streho: člani in mladinci.
--
-- Doslej je bila v bazi natanko ena liga in ničesar ni bilo treba ločevati.
-- Z mladinci (GNL - mladinci, mnzgkranj.si liga=1603) pa se vse podvoji:
-- svoji krogi, svoji igralci, svoje fantasy ekipe in svoja lestvica. Klubi
-- ostanejo skupni — Šenčur je isti klub, ne glede na to, katera selekcija
-- igra — zato `teams` ostane nedotaknjen.
--
-- Tekmovanje nosijo tri tabele, vse ostalo se izpelje iz njih:
--   * `rounds.competition_id`        → krog (in z njim tekme, goli, nastopi)
--   * `players.competition_id`       → igralec (mladinec, ki gre med člane,
--                                       je nova vrstica v članski ligi)
--   * `fantasy_teams.competition_id` → fantasy ekipa (vsak ima lahko po eno
--                                       v vsaki ligi)
--
-- `competitions.prvi_fantasy_krog` pove, od katerega kroga naprej liga sploh
-- šteje za fantasy. Pri mladincih se sredi poletja še vrstijo prestopi in
-- prehodi med člane, zato prvi krog namenoma preskočimo: uporabniki ekipe
-- sestavijo šele, ko je jasno, kdo sploh igra.

-- --------------------------------------------------------------------------
-- 1. Tekmovanja
-- --------------------------------------------------------------------------
create table if not exists competitions (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  short_name text not null,
  -- šifra lige na mnzgkranj.si za tekočo sezono (uvozne skripte)
  mnzg_liga text,
  -- prvi krog, ki šteje za fantasy; nižji krogi so samo rezultati
  prvi_fantasy_krog int not null default 1,
  sort_order int not null default 0,
  active boolean not null default true
);

comment on table competitions is
  'Ligi, ki ju aplikacija pokriva: člani in mladinci.';
comment on column competitions.prvi_fantasy_krog is
  'Prvi krog, ki šteje za fantasy. Krogi pred njim so samo rezultati.';

insert into competitions (slug, name, short_name, mnzg_liga, prvi_fantasy_krog, sort_order)
values
  ('clani', '1. GNL — člani', 'Člani', '1601', 1, 1),
  ('mladinci', 'GNL — mladinci', 'Mladinci', '1603', 2, 2)
on conflict (slug) do nothing;

alter table competitions enable row level security;
drop policy if exists "javno branje" on competitions;
create policy "javno branje" on competitions for select using (true);
drop policy if exists "admin ureja tekmovanja" on competitions;
create policy "admin ureja tekmovanja" on competitions for all
  using (is_admin()) with check (is_admin());

-- Privzeto tekmovanje za obstoječe vrstice in za uvoz brez izrecne navedbe.
create or replace function tekmovanje_id(p_slug text)
returns bigint
language sql
stable
as $$
  select id from competitions where slug = p_slug;
$$;

-- --------------------------------------------------------------------------
-- 2. Tekmovanje na krogih, igralcih in fantasy ekipah
-- --------------------------------------------------------------------------
alter table rounds add column if not exists competition_id bigint
  references competitions on delete cascade;
alter table players add column if not exists competition_id bigint
  references competitions on delete cascade;
alter table fantasy_teams add column if not exists competition_id bigint
  references competitions on delete cascade;

update rounds set competition_id = tekmovanje_id('clani') where competition_id is null;
update players set competition_id = tekmovanje_id('clani') where competition_id is null;
update fantasy_teams set competition_id = tekmovanje_id('clani') where competition_id is null;

alter table rounds alter column competition_id set not null;
alter table players alter column competition_id set not null;
alter table fantasy_teams alter column competition_id set not null;

alter table rounds alter column competition_id set default tekmovanje_id('clani');
alter table players alter column competition_id set default tekmovanje_id('clani');
alter table fantasy_teams alter column competition_id set default tekmovanje_id('clani');

create index if not exists rounds_tekmovanje_idx on rounds (competition_id);
create index if not exists players_tekmovanje_idx on players (competition_id);
create index if not exists fantasy_teams_tekmovanje_idx on fantasy_teams (competition_id);

-- Številka kroga je enolična znotraj tekmovanja, ne čez vsa.
alter table rounds drop constraint if exists rounds_season_number_key;
create unique index if not exists rounds_tekmovanje_sezona_krog
  on rounds (competition_id, season, number);

-- Vsak uporabnik ima lahko po eno ekipo v vsaki ligi.
alter table fantasy_teams drop constraint if exists fantasy_teams_owner_id_key;
create unique index if not exists fantasy_teams_lastnik_tekmovanje
  on fantasy_teams (owner_id, competition_id);

-- --------------------------------------------------------------------------
-- 3. Pogledi: povsod dodamo `competition_id`, da vmesnik lahko filtrira
-- --------------------------------------------------------------------------

-- Igralci ------------------------------------------------------------------
create or replace view player_overview as
select
  p.id,
  p.full_name,
  p.first_name,
  p.last_name,
  p.position,
  p.position_source,
  p.shirt_number,
  p.value,
  p.team_id,
  t.name as team_name,
  t.short_name as team_short,
  coalesce(s.matches, 0) as matches,
  coalesce(s.minutes, 0) as minutes,
  coalesce(s.goals, 0) as goals,
  coalesce(s.clean_sheets, 0) as clean_sheets,
  coalesce(s.points, 0) as points,
  coalesce(pv.votes, 0) as position_votes,
  t.logo_url as team_logo,
  p.competition_id
from players p
join teams t on t.id = p.team_id
left join lateral (
  select sum(matches)::int as matches, sum(minutes)::int as minutes,
         sum(goals)::int as goals, sum(clean_sheets)::int as clean_sheets,
         sum(points) as points
  from player_season_stats ss where ss.player_id = p.id
) s on true
left join lateral (
  select count(*)::int as votes from position_votes where player_id = p.id
) pv on true;

-- Lestvica igralcev: uvrstitev velja znotraj svoje lige.
create or replace view player_standings as
select
  po.id,
  po.full_name,
  po.position,
  po.position_source,
  po.team_id,
  po.team_name,
  po.team_short,
  po.value,
  po.matches,
  po.minutes,
  po.goals,
  po.clean_sheets,
  coalesce(t.points, 0) as points,
  coalesce(f.points, 0) as form,
  coalesce(z.points, 0) as last_round,
  case when po.matches > 0
       then round(coalesce(t.points, 0) / po.matches, 2)
       else 0 end as points_per_match,
  case when po.value > 0
       then round(coalesce(t.points, 0) / po.value, 2)
       else 0 end as points_per_value,
  coalesce(l.owners, 0) as owners,
  rank() over (
    partition by po.competition_id order by coalesce(t.points, 0) desc
  ) as rank,
  po.team_logo,
  po.competition_id
from player_overview po
left join lateral (
  select sum(ps.points) as points from player_scores ps where ps.player_id = po.id
) t on true
left join lateral (
  select sum(zadnji.points) as points
  from (
    select ps.points
    from player_scores ps
    join rounds r on r.id = ps.round_id
    where ps.player_id = po.id
    order by r.number desc
    limit 3
  ) zadnji
) f on true
left join lateral (
  select ps.points
  from player_scores ps
  join rounds r on r.id = ps.round_id
  where ps.player_id = po.id
  order by r.number desc
  limit 1
) z on true
left join lateral (
  select count(*)::int as owners
  from fantasy_roster fr where fr.player_id = po.id
) l on true;

create or replace view player_season_standings as
select
  po.id,
  po.full_name,
  po.position,
  po.position_source,
  po.team_id,
  po.team_name,
  po.team_short,
  po.team_logo,
  po.value,
  ss.season,
  ss.matches,
  ss.minutes,
  ss.goals,
  ss.clean_sheets,
  ss.points,
  case when ss.matches > 0 then round(ss.points / ss.matches, 2) else 0 end
    as points_per_match,
  case when po.value > 0 then round(ss.points / po.value, 2) else 0 end
    as points_per_value,
  coalesce(z.points, 0) as last_round,
  coalesce(f.points, 0) as form,
  coalesce(l.owners, 0) as owners,
  rank() over (
    partition by po.competition_id, ss.season order by ss.points desc
  ) as rank,
  po.competition_id
from player_overview po
join player_season_stats ss on ss.player_id = po.id
left join lateral (
  select ps.points
  from player_scores ps
  join rounds r on r.id = ps.round_id
  where ps.player_id = po.id and r.season = ss.season
  order by r.number desc
  limit 1
) z on true
left join lateral (
  select sum(zadnji.points) as points
  from (
    select ps.points
    from player_scores ps
    join rounds r on r.id = ps.round_id
    where ps.player_id = po.id and r.season = ss.season
    order by r.number desc
    limit 3
  ) zadnji
) f on true
left join lateral (
  select count(*)::int as owners
  from fantasy_roster fr where fr.player_id = po.id
) l on true;

-- Klubi so skupni, njihove selekcije pa ne: mladinsko ligo igra deset klubov,
-- člansko trinajst. Ta pogled pove, kateri klubi nastopajo v kateri ligi, da
-- spustni seznami ne ponujajo praznih klubov.
create or replace view competition_teams as
select distinct
  p.competition_id,
  t.id as team_id,
  t.name,
  t.short_name,
  t.logo_url
from players p
join teams t on t.id = p.team_id
where p.active;

-- Krogi in tekme -----------------------------------------------------------
-- Naslednji krog ima odslej vsaka liga svojega.
create or replace view naslednji_krog as
select distinct on (r.competition_id)
  r.id, r.season, r.number, r.played_on, r.deadline_at, r.competition_id
from rounds r
where coalesce(
        r.deadline_at,
        (r.played_on::timestamp + time '10:00') at time zone 'Europe/Ljubljana'
      ) > now()
order by r.competition_id, r.season, r.number;

create or replace view zadnji_odigrani_krog as
select distinct on (r.competition_id)
  r.id, r.season, r.number, r.played_on, r.competition_id
from rounds r
where exists (select 1 from player_scores ps where ps.round_id = r.id)
order by r.competition_id, r.season desc, r.number desc;

create or replace view sezone as
select
  r.season,
  count(distinct r.id)::int as krogov,
  count(distinct m.id) filter (where m.imported_at is not null)::int as odigranih,
  max(r.played_on) as zadnji_dan,
  bool_or(r.played_on >= current_date) as tekoca,
  r.competition_id
from rounds r
left join matches m on m.round_id = r.id
group by r.season, r.competition_id;

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
  rank() over (partition by ps.round_id order by ps.points desc) as rank,
  r.competition_id
from player_scores ps
join rounds r on r.id = ps.round_id
join players p on p.id = ps.player_id
join teams t on t.id = p.team_id
left join minute_kroga mk on mk.round_id = ps.round_id and mk.player_id = p.id
left join price_changes pc on pc.round_id = ps.round_id and pc.player_id = p.id;

create or replace view prihodnje_tekme as
select
  m.id as match_id,
  m.round_id,
  r.season,
  r.number as round_number,
  m.played_on,
  m.home_team_id as team_id,
  m.away_team_id as opponent_id,
  a.name as opponent_name,
  a.short_name as opponent_short,
  a.logo_url as opponent_logo,
  true as doma,
  r.competition_id
from matches m
join rounds r on r.id = m.round_id
join teams a on a.id = m.away_team_id
where m.imported_at is null and m.played_on >= current_date
union all
select
  m.id,
  m.round_id,
  r.season,
  r.number,
  m.played_on,
  m.away_team_id,
  m.home_team_id,
  h.name,
  h.short_name,
  h.logo_url,
  false,
  r.competition_id
from matches m
join rounds r on r.id = m.round_id
join teams h on h.id = m.home_team_id
where m.imported_at is null and m.played_on >= current_date;

create or replace view match_assist_status as
select
  m.id as match_id,
  m.round_id,
  r.season,
  r.number as round_number,
  m.played_on,
  h.name as home_name,
  h.short_name as home_short,
  h.logo_url as home_logo,
  a.name as away_name,
  a.short_name as away_short,
  a.logo_url as away_logo,
  m.home_goals,
  m.away_goals,
  count(g.id) filter (where not g.is_own_goal) as golov,
  count(g.id) filter (
    where not g.is_own_goal
      and not g.is_penalty
      and g.assist_player_id is null
      and g.assist_none_confirmed_at is null
  ) as brez_asistence,
  m.home_team_id,
  m.away_team_id,
  r.competition_id
from matches m
join rounds r on r.id = m.round_id
join teams h on h.id = m.home_team_id
join teams a on a.id = m.away_team_id
left join goals g on g.match_id = m.id
where m.imported_at is not null
group by m.id, m.round_id, r.season, r.number, m.played_on,
         h.name, h.short_name, h.logo_url,
         a.name, a.short_name, a.logo_url,
         m.home_goals, m.away_goals, m.home_team_id, m.away_team_id,
         r.competition_id;

-- Fantasy ------------------------------------------------------------------
-- Ekipa zbira točke samo v krogih svoje lige — brez tega bi vsaka ekipa
-- dobila vrstico z ničlo za vsak krog druge lige.
create or replace view fantasy_round_points as
select
  ft.id as fantasy_team_id,
  r.id as round_id,
  r.season,
  r.number as round_number,
  coalesce(sum(ps.points * up.mnozitelj), 0) - coalesce(max(tr.penalty), 0)
    as points,
  coalesce(max(tr.transfers), 0) as transfers,
  coalesce(max(tr.penalty), 0) as penalty,
  ft.competition_id
from fantasy_teams ft
join rounds r on r.competition_id = ft.competition_id
left join lateral ucinkovita_postava(ft.id, r.id) up on true
left join player_scores ps
  on ps.round_id = r.id and ps.player_id = up.player_id
left join fantasy_transfers tr
  on tr.fantasy_team_id = ft.id and tr.round_id = r.id
where exists (
  select 1 from fantasy_lineups fl where fl.round_id = r.id
)
group by ft.id, r.id, r.season, r.number, ft.competition_id;

create or replace view fantasy_round_standings as
select
  frp.round_id,
  frp.season,
  frp.round_number,
  frp.fantasy_team_id,
  ft.name as team_name,
  pr.display_name as owner_name,
  frp.points,
  frp.transfers,
  frp.penalty,
  rank() over (partition by frp.round_id order by frp.points desc) as rank,
  frp.competition_id
from fantasy_round_points frp
join fantasy_teams ft on ft.id = frp.fantasy_team_id
join profiles pr on pr.id = ft.owner_id
where exists (
  select 1 from player_scores ps where ps.round_id = frp.round_id
);

drop view if exists fantasy_team_standings;
create view fantasy_team_standings as
select
  ft.id as fantasy_team_id,
  ft.name as team_name,
  pr.display_name as owner_name,
  pr.created_at as owner_registered_at,
  ft.created_at as team_created_at,
  coalesce(sum(frp.points), 0) as total_points,
  coalesce(max(frp.points), 0) as best_round,
  count(*) filter (where frp.points > 0) as rounds_played,
  ft.competition_id
from fantasy_teams ft
join profiles pr on pr.id = ft.owner_id
left join fantasy_round_points frp on frp.fantasy_team_id = ft.id
group by ft.id, ft.name, pr.display_name, pr.created_at, ft.created_at,
         ft.competition_id;

create or replace view fantasy_team_budget as
select
  ft.id as fantasy_team_id,
  ft.name,
  ft.budget,
  coalesce(sum(p.value), 0) as spent,
  ft.budget - coalesce(sum(p.value), 0) as remaining,
  ft.competition_id
from fantasy_teams ft
left join fantasy_roster fr on fr.fantasy_team_id = ft.id
left join players p on p.id = fr.player_id
group by ft.id, ft.name, ft.budget, ft.competition_id;

create or replace view fantasy_team_wealth as
select
  ft.id as fantasy_team_id,
  ft.name,
  ft.budget as starting_budget,
  ft.cash,
  coalesce(sum(p.value), 0)::numeric as roster_value,
  ft.cash + coalesce(sum(p.value), 0)::numeric as total_wealth,
  ft.competition_id
from fantasy_teams ft
left join fantasy_roster fr on fr.fantasy_team_id = ft.id
left join players p on p.id = fr.player_id
group by ft.id, ft.name, ft.budget, ft.cash, ft.competition_id;

-- --------------------------------------------------------------------------
-- 4. Funkcije, ki brez tekmovanja delajo napačno
-- --------------------------------------------------------------------------

-- Zaklep kroga: posname le ekipe iste lige in šele od `prvi_fantasy_krog`.
create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih   int;
  v_strogo_od  int := nastavitev_int('strogi_zaklep_od_kroga', 2);
  v_stevilka   int;
  v_deadline   timestamptz;
  v_tekmovanje bigint;
  v_prvi       int;
  v_uporabi_v  boolean;
begin
  select r.number, r.deadline_at, r.competition_id, c.prvi_fantasy_krog
    into v_stevilka, v_deadline, v_tekmovanje, v_prvi
    from rounds r
    join competitions c on c.id = r.competition_id
   where r.id = p_round_id;

  if v_stevilka is null then
    return 0;
  end if;

  -- Krogi pred začetkom fantasy dela lige so samo rezultati.
  if v_stevilka < coalesce(v_prvi, 1) then
    return 0;
  end if;

  -- Stroga validacija kadra šele od drugega fantasy kroga naprej — prvi krog
  -- lige je vedno tudi krog, v katerem se pozicije šele izglasujejo.
  v_uporabi_v := v_stevilka >= greatest(v_strogo_od, coalesce(v_prvi, 1) + 1);

  insert into fantasy_lineups (
    round_id, fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order
  )
  select p_round_id, fr.fantasy_team_id, fr.player_id,
         fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  join fantasy_teams ft on ft.id = fr.fantasy_team_id
  where ft.competition_id = v_tekmovanje
  and not exists (
    select 1 from fantasy_lineups fl
    where fl.round_id = p_round_id and fl.fantasy_team_id = fr.fantasy_team_id
  )
  and (v_deadline is null or ft.created_at <= v_deadline)
  and (not v_uporabi_v or roster_je_veljaven(fr.fantasy_team_id));

  get diagnostics v_posnetih = row_count;
  return v_posnetih;
end;
$$;

-- Borza: cene premika samo znotraj lige, ki ji krog pripada. Brez tega bi
-- obračun mladinskega kroga pocenil vse člane (nič točk = padec cene), formo
-- pa bi zajel iz krogov obeh lig z isto številko.
drop function if exists preracunaj_cene(bigint);
create function preracunaj_cene(p_round_id bigint)
returns table (igralec bigint, stara_cena numeric, nova_cena numeric, forma numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  MEJA_DRIFTA constant numeric := 3.0;
  NAJNIZJA constant numeric := 4.0;
  NAJVISJA constant numeric := 15.0;
  v_stevilka int;
  v_sezona text;
  v_tekmovanje bigint;
begin
  select r.number, r.season, r.competition_id
    into v_stevilka, v_sezona, v_tekmovanje
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
      and r.competition_id = v_tekmovanje
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
      and p.competition_id = v_tekmovanje
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

-- Shranjevanje ekipe: igralci morajo biti iz iste lige kot ekipa.
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

  -- Mladinca ni mogoče postaviti v člansko ekipo in obratno.
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
    fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order, buy_value
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
grant execute on function tekmovanje_id(text) to anon, authenticated, service_role;
