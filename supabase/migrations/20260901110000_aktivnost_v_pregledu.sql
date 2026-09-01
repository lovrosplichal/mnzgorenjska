-- `player_overview` naj pove tudi, ali igralec še igra.
--
-- Trg v Moji ekipi je doslej ponujal vse igralce lige, tudi tiste iz klubov,
-- ki v tekoči sezoni ne nastopajo. Pri članih je šlo za posameznike, pri
-- mladincih pa vsako leto odide cela generacija — lani je bila v ligi Škofja
-- Loka - Medvode, letos je ni. Kdor bi takega igralca kupil, bi imel kader z
-- neaktivnim igralcem; `roster_je_veljaven` tak kader zavrne, zato bi ekipa od
-- stroge validacije naprej tiho dobivala nič točk.
--
-- Zastavica `active` je bila doslej samo v `players`, vmesnik pa bere pregled.
-- Nov stolpec gre na konec, sicer `create or replace view` ne gre.
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
  p.active
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
