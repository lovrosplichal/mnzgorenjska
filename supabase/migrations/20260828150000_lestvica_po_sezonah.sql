-- Lestvica igralcev po sezonah.
--
-- Dosedanja `player_standings` je seštevala vse sezone skupaj, zato je stran
-- Igralci ob začetku nove sezone kazala lansko statistiko, kot da je letošnja.
-- Ta pogled ima sezono kot stolpec, da lahko stran med njima preklaplja in
-- jasno napiše, katero sezono gleda.

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
  rank() over (partition by ss.season order by ss.points desc) as rank
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

-- Katere sezone sploh imajo odigrane tekme in katera je tekoča.
create or replace view sezone as
select
  r.season,
  count(distinct r.id)::int as krogov,
  count(distinct m.id) filter (where m.imported_at is not null)::int as odigranih,
  max(r.played_on) as zadnji_dan,
  bool_or(r.played_on >= current_date) as tekoca
from rounds r
left join matches m on m.round_id = r.id
group by r.season;
