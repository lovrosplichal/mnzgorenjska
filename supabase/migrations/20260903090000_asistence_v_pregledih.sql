-- Asistence kot seštevek, ne le kot posamezen potrjen dogodek.
--
-- `appearance_points` že ve, koliko asistenc je igralec dosegel na posamezni
-- tekmi — od tam jih šteje tudi točkovanje. Nihče pa jih ni seštel po sezoni
-- ali čez celo kariero, zato jih ni bilo mogoče prikazati kot lestvico
-- podajalcev, kot to zna `goals`. Dodano na isto mesto in po istem vzorcu kot
-- `clean_sheets`.
--
-- Nov stolpec gre v vsakem pogledu na konec, sicer `create or replace view`
-- ne dovoli.

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
  coalesce(sum(ap.points), 0) as points,
  coalesce(sum(ap.assists), 0)::int as assists
from appearances a
join matches m on m.id = a.match_id
join rounds r on r.id = m.round_id
left join appearance_points ap on ap.appearance_id = a.id
group by a.player_id, r.season;

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
  p.competition_id,
  p.active,
  coalesce(s.assists, 0) as assists
from players p
join teams t on t.id = p.team_id
left join lateral (
  select sum(matches)::int as matches, sum(minutes)::int as minutes,
         sum(goals)::int as goals, sum(clean_sheets)::int as clean_sheets,
         sum(points) as points, sum(assists)::int as assists
  from player_season_stats ss where ss.player_id = p.id
) s on true
left join lateral (
  select count(*)::int as votes from position_votes where player_id = p.id
) pv on true;

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
  po.competition_id,
  po.assists
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
  po.competition_id,
  ss.assists
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
