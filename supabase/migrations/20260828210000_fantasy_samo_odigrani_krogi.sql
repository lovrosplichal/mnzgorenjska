-- Fantasy liga obstaja samo za kroge, v katerih je bila odigrana.
--
-- `fantasy_round_points` je racunal za vsako ekipo krat vsak krog, torej tudi
-- za lansko sezono, ko fantasy lige se ni bilo. Ker za tiste kroge ni posnetkov
-- postav, so vse ekipe dobile 0 tock — lestvica pa je vseeno razglasila
-- "zmagovalca 26. kroga" s praznimi nic tockami.
--
-- Krog steje sele, ko je bil zaklenjen, torej ko zanj obstaja vsaj en posnetek
-- postave. To je tudi vsebinsko pravilno: pred zaklepom nihce ni imel postave.

create or replace view fantasy_round_points as
select
  ft.id as fantasy_team_id,
  r.id as round_id,
  r.season,
  r.number as round_number,
  coalesce(sum(ps.points * up.mnozitelj), 0) - coalesce(max(tr.penalty), 0)
    as points,
  coalesce(max(tr.transfers), 0) as transfers,
  coalesce(max(tr.penalty), 0) as penalty
from fantasy_teams ft
cross join rounds r
left join lateral ucinkovita_postava(ft.id, r.id) up on true
left join player_scores ps
  on ps.round_id = r.id and ps.player_id = up.player_id
left join fantasy_transfers tr
  on tr.fantasy_team_id = ft.id and tr.round_id = r.id
where exists (
  select 1 from fantasy_lineups fl where fl.round_id = r.id
)
group by ft.id, r.id, r.season, r.number;

-- Zmagovalec kroga: poleg zaklenjenega kroga zahtevamo se izracunane tocke.
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
  rank() over (partition by frp.round_id order by frp.points desc) as rank
from fantasy_round_points frp
join fantasy_teams ft on ft.id = frp.fantasy_team_id
join profiles pr on pr.id = ft.owner_id
where exists (
  select 1 from player_scores ps where ps.round_id = frp.round_id
);
