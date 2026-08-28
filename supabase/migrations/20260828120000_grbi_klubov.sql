-- Grbi klubov.
--
-- Uradnih logotipov na mnzgkranj.si ni (stran ima le imena in kontakte), zato
-- aplikacija privzeto nariše grb iz začetnic kluba. Ko je pravi logotip na
-- voljo, ga administrator vpiše v `logo_url` — datoteka v `public/grbi/` ali
-- zunanji naslov — in aplikacija ga uporabi namesto začetnic.

alter table teams add column if not exists logo_url text;

comment on column teams.logo_url is
  'Naslov grba kluba; če je prazen, aplikacija nariše grb iz začetnic.';

-- Grb naj bo viden povsod, kjer je viden klub.
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
  -- nov stolpec mora biti na koncu, sicer `create or replace view` ne gre
  t.logo_url as team_logo
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

-- `player_standings` gradi na `player_overview`, zato dobi stolpec z njim vred.
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
  rank() over (order by coalesce(t.points, 0) desc) as rank,
  po.team_logo
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
