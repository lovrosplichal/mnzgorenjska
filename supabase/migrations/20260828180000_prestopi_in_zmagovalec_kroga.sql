-- Prestopi med krogi in zmagovalec kroga.
--
-- Doslej je bilo mogoče med krogoma zamenjati vseh 15 igralcev brez posledic,
-- kar izniči smisel izbire. Odslej je nekaj prestopov na krog brezplačnih,
-- vsak nadaljnji pa stane točke. Koliko jih je brezplačnih, pove nastavitev
-- `prosti_prestopi`, kazen pa `kazen_prestopa` — obe se dasta spremeniti brez
-- posega v kodo.
--
-- Prestop ugotovimo ob zaklepu kroga: kdor je v novem posnetku, v prejšnjem pa
-- ga ni bilo, je prišel. Prvi kader v sezoni je zastonj — takrat prejšnjega
-- posnetka ni.

insert into settings (key, value)
values ('prosti_prestopi', '3'), ('kazen_prestopa', '4')
on conflict (key) do nothing;

create table if not exists fantasy_transfers (
  fantasy_team_id bigint not null references fantasy_teams on delete cascade,
  round_id bigint not null references rounds on delete cascade,
  transfers int not null default 0,
  free_transfers int not null default 0,
  penalty int not null default 0,
  created_at timestamptz not null default now(),
  primary key (fantasy_team_id, round_id)
);

alter table fantasy_transfers enable row level security;
drop policy if exists "javno branje" on fantasy_transfers;
create policy "javno branje" on fantasy_transfers for select using (true);
drop policy if exists "admin ureja prestope" on fantasy_transfers;
create policy "admin ureja prestope" on fantasy_transfers for all
  using (is_admin()) with check (is_admin());

-- --- zaklep kroga zabeleži tudi prestope ---------------------------------
create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih int;
  v_prosti int := nastavitev_int('prosti_prestopi', 3);
  v_kazen int := nastavitev_int('kazen_prestopa', 4);
begin
  insert into fantasy_lineups (
    round_id, fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order
  )
  select p_round_id, fr.fantasy_team_id, fr.player_id,
         fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  where not exists (
    select 1 from fantasy_lineups fl
    where fl.round_id = p_round_id and fl.fantasy_team_id = fr.fantasy_team_id
  );

  get diagnostics v_posnetih = row_count;

  -- Koliko igralcev je prišlo na novo glede na zadnji prejšnji posnetek.
  insert into fantasy_transfers (fantasy_team_id, round_id, transfers, free_transfers, penalty)
  select
    novi.fantasy_team_id,
    p_round_id,
    novi.prisli,
    v_prosti,
    greatest(0, novi.prisli - v_prosti) * v_kazen
  from (
    select
      fl.fantasy_team_id,
      count(*) filter (
        where not exists (
          select 1 from fantasy_lineups prej
          where prej.fantasy_team_id = fl.fantasy_team_id
            and prej.player_id = fl.player_id
            and prej.round_id = (
              select fl2.round_id
              from fantasy_lineups fl2
              join rounds r2 on r2.id = fl2.round_id
              where fl2.fantasy_team_id = fl.fantasy_team_id
                and fl2.round_id <> p_round_id
              order by r2.season desc, r2.number desc
              limit 1
            )
        )
      ) as prisli
    from fantasy_lineups fl
    where fl.round_id = p_round_id
      -- prvi kader v sezoni je zastonj: prejšnjega posnetka ni
      and exists (
        select 1 from fantasy_lineups fl3
        where fl3.fantasy_team_id = fl.fantasy_team_id
          and fl3.round_id <> p_round_id
      )
    group by fl.fantasy_team_id
  ) novi
  on conflict (fantasy_team_id, round_id) do nothing;

  return v_posnetih;
end;
$$;

-- --- kazen se odšteje od točk kroga --------------------------------------
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
group by ft.id, r.id, r.season, r.number;

-- --- zmagovalec kroga ----------------------------------------------------
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
