-- Lestvica: pokaži datum registracije lastnika.
--
-- Uporabniki, ki se priključijo pozneje, imajo manjši skupni izkupiček
-- kot začetniki. Datum registracije pojasni, zakaj — in nas spodbudi,
-- da uporabimo "od N. kroga naprej" lestvico za pošteno primerjavo.

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
  count(*) filter (where frp.points > 0) as rounds_played
from fantasy_teams ft
join profiles pr on pr.id = ft.owner_id
left join fantasy_round_points frp on frp.fantasy_team_id = ft.id
group by ft.id, ft.name, pr.display_name, pr.created_at, ft.created_at;
