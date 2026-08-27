-- Vrednost igralcev in proračun fantasy ekip.
--
-- Vrednost izhaja iz statistike prejšnje sezone (minute, goli, fantasy točke),
-- po potrebi pa jo administrator popravi glede na izkušnje iz višjih lig (NZS).

alter table players add column if not exists value numeric(4, 1) not null default 4.5;
alter table players add column if not exists value_locked boolean not null default false;

-- Podatki z NZS (izpolni administrator, ker iskalnik NZS ni dostopen robotom)
alter table players add column if not exists nzs_url text;
alter table players add column if not exists nzs_birth_year int;
alter table players add column if not exists nzs_top_league text;
alter table players add column if not exists nzs_top_league_minutes int;
alter table players add column if not exists nzs_confirmed_at timestamptz;

-- Proračun fantasy ekipe
alter table fantasy_teams add column if not exists budget numeric(6, 1)
  not null default 100.0;

-- --------------------------------------------------------------------------
-- Statistika igralca po sezonah
-- --------------------------------------------------------------------------
create or replace view player_season_stats as
select
  a.player_id,
  r.season,
  count(distinct a.match_id)::int as matches,
  sum(a.minutes_played)::int as minutes,
  sum(a.goals)::int as goals,
  sum(a.own_goals)::int as own_goals,
  sum(a.yellow_cards)::int as yellow_cards,
  sum(a.red_cards)::int as red_cards,
  sum(case when a.clean_sheet and a.minutes_played >= 60 then 1 else 0 end)::int
    as clean_sheets,
  coalesce(sum(ap.points), 0) as points
from appearances a
join matches m on m.id = a.match_id
join rounds r on r.id = m.round_id
left join appearance_points ap on ap.appearance_id = a.id
group by a.player_id, r.season;

-- --------------------------------------------------------------------------
-- Skupni pregled igralca (za vmesnik)
-- --------------------------------------------------------------------------
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
  coalesce(pv.votes, 0) as position_votes
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

-- --------------------------------------------------------------------------
-- Proračun: vsota vrednosti izbranih igralcev ne sme preseči proračuna
-- --------------------------------------------------------------------------
create or replace view fantasy_team_budget as
select
  ft.id as fantasy_team_id,
  ft.name,
  ft.budget,
  coalesce(sum(p.value), 0) as spent,
  ft.budget - coalesce(sum(p.value), 0) as remaining
from fantasy_teams ft
left join fantasy_roster fr on fr.fantasy_team_id = ft.id
left join players p on p.id = fr.player_id
group by ft.id, ft.name, ft.budget;

-- Lestvici dodamo ime lastnika. Stolpca ni mogoče vriniti z "create or replace",
-- zato pogled odvržemo in ustvarimo na novo.
drop view if exists fantasy_team_standings;
create view fantasy_team_standings as
select
  ft.id as fantasy_team_id,
  ft.name as team_name,
  pr.display_name as owner_name,
  coalesce(sum(ps.points), 0) as total_points
from fantasy_teams ft
join profiles pr on pr.id = ft.owner_id
left join fantasy_roster fr on fr.fantasy_team_id = ft.id and fr.is_starter
left join player_scores ps on ps.player_id = fr.player_id
group by ft.id, ft.name, pr.display_name;
