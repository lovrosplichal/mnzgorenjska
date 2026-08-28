-- Kapetan, avtomatske menjave, pripomoček Klop+ in lestvica igralcev.
--
-- Točkovanje kroga za fantasy ekipo doslej ni poznalo ne kapetana ne klopi:
-- seštelo je točke vseh, ki so označeni kot prva postava, tudi če sploh niso
-- igrali. Odslej velja:
--   * kapetan prinese trikratnik svojih točk (če ne igra, prevzame namestnik),
--   * igralca prve postave brez odigrane minute samodejno zamenja rezervni
--     igralec iste pozicije (postava ostane taka, kot jo je izbral lastnik),
--   * pripomoček "Klop+" enkrat na sezono v izbranem krogu prišteje še klop.

-- --- kader: kapetan, namestnik, vrstni red klopi -------------------------
alter table fantasy_roster add column if not exists is_captain boolean not null default false;
alter table fantasy_roster add column if not exists is_vice boolean not null default false;
alter table fantasy_roster add column if not exists bench_order int;

-- Trak nosi lahko le igralec prve postave in le eden na ekipo.
alter table fantasy_roster drop constraint if exists fantasy_roster_captain_starter_check;
alter table fantasy_roster add constraint fantasy_roster_captain_starter_check
  check ((not is_captain and not is_vice) or is_starter);

create unique index if not exists fantasy_roster_en_kapetan
  on fantasy_roster (fantasy_team_id) where is_captain;
create unique index if not exists fantasy_roster_en_namestnik
  on fantasy_roster (fantasy_team_id) where is_vice;

-- --- pripomočki ----------------------------------------------------------
create table if not exists fantasy_chips (
  fantasy_team_id bigint not null references fantasy_teams on delete cascade,
  chip text not null check (chip in ('klop_plus')),
  round_id bigint not null references rounds on delete cascade,
  played_at timestamptz not null default now(),
  primary key (fantasy_team_id, chip)
);

alter table fantasy_chips enable row level security;

drop policy if exists "javno branje" on fantasy_chips;
create policy "javno branje" on fantasy_chips for select using (true);

drop policy if exists "lastnik igra pripomocek" on fantasy_chips;
create policy "lastnik igra pripomocek" on fantasy_chips for all
  using (exists (
    select 1 from fantasy_teams ft
    where ft.id = fantasy_chips.fantasy_team_id and ft.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from fantasy_teams ft
    where ft.id = fantasy_chips.fantasy_team_id and ft.owner_id = auth.uid()
  ));

-- --- minute po krogih ----------------------------------------------------
create or replace view minute_kroga as
select m.round_id, a.player_id, sum(a.minutes_played)::int as minutes
from appearances a
join matches m on m.id = a.match_id
group by m.round_id, a.player_id;

-- --- učinkovita postava --------------------------------------------------
-- Vrne igralce, ki v danem krogu dejansko prinesejo točke, in njihov množitelj.
-- Zamenjave so namenoma le znotraj iste pozicije: postava ostane taka, kot jo
-- je izbral lastnik, pravilo pa je dovolj preprosto, da ga vsak razume.
create or replace function ucinkovita_postava(p_team bigint, p_round bigint)
returns table (player_id bigint, mnozitelj int)
language plpgsql
stable
as $$
declare
  v_klop_plus boolean;
  v_kapetan bigint;
  v_postava bigint[] := '{}';
  v_porabljeni bigint[] := '{}';
  v_zamenjava bigint;
  igralec record;
begin
  select exists (
    select 1 from fantasy_chips c
    where c.fantasy_team_id = p_team and c.chip = 'klop_plus' and c.round_id = p_round
  ) into v_klop_plus;

  for igralec in
    select fr.player_id, p.position, coalesce(mk.minutes, 0) as minutes
    from fantasy_roster fr
    join players p on p.id = fr.player_id
    left join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = fr.player_id
    where fr.fantasy_team_id = p_team and fr.is_starter
    order by fr.player_id
  loop
    if igralec.minutes > 0 then
      v_postava := v_postava || igralec.player_id;
      continue;
    end if;

    select fr.player_id into v_zamenjava
    from fantasy_roster fr
    join players p on p.id = fr.player_id
    join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = fr.player_id and mk.minutes > 0
    where fr.fantasy_team_id = p_team
      and not fr.is_starter
      and p.position = igralec.position
      and not (fr.player_id = any (v_porabljeni))
    order by coalesce(fr.bench_order, 99), fr.player_id
    limit 1;

    if v_zamenjava is not null then
      v_postava := v_postava || v_zamenjava;
      v_porabljeni := v_porabljeni || v_zamenjava;
    else
      -- Brez ustrezne zamenjave ostane igralec v postavi z nič točkami.
      v_postava := v_postava || igralec.player_id;
    end if;
    v_zamenjava := null;
  end loop;

  -- Klop+ prišteje še preostanek klopi.
  if v_klop_plus then
    v_postava := v_postava || coalesce(
      (select array_agg(fr.player_id)
       from fantasy_roster fr
       where fr.fantasy_team_id = p_team
         and not fr.is_starter
         and not (fr.player_id = any (v_porabljeni))),
      '{}'::bigint[]
    );
  end if;

  -- Trak nosi kapetan, če je igral; sicer njegov namestnik.
  select fr.player_id into v_kapetan
  from fantasy_roster fr
  join minute_kroga mk
    on mk.round_id = p_round and mk.player_id = fr.player_id and mk.minutes > 0
  where fr.fantasy_team_id = p_team and fr.is_captain;

  if v_kapetan is null then
    select fr.player_id into v_kapetan
    from fantasy_roster fr
    join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = fr.player_id and mk.minutes > 0
    where fr.fantasy_team_id = p_team and fr.is_vice;
  end if;

  return query
  select v.id, case when v.id = v_kapetan then 3 else 1 end
  from unnest(v_postava) as v(id);
end;
$$;

-- --- točke ekipe po krogih ----------------------------------------------
create or replace view fantasy_round_points as
select
  ft.id as fantasy_team_id,
  r.id as round_id,
  r.season,
  r.number as round_number,
  coalesce(sum(ps.points * up.mnozitelj), 0) as points
from fantasy_teams ft
cross join rounds r
left join lateral ucinkovita_postava(ft.id, r.id) up on true
left join player_scores ps
  on ps.round_id = r.id and ps.player_id = up.player_id
group by ft.id, r.id, r.season, r.number;

-- Skupna lestvica odslej sešteva kroge, ne surovih zapisov v kadru.
drop view if exists fantasy_team_standings;
create view fantasy_team_standings as
select
  ft.id as fantasy_team_id,
  ft.name as team_name,
  pr.display_name as owner_name,
  coalesce(sum(frp.points), 0) as total_points,
  coalesce(max(frp.points), 0) as best_round,
  count(*) filter (where frp.points > 0) as rounds_played
from fantasy_teams ft
join profiles pr on pr.id = ft.owner_id
left join fantasy_round_points frp on frp.fantasy_team_id = ft.id
group by ft.id, ft.name, pr.display_name;

-- --- lestvica igralcev ---------------------------------------------------
-- Kdo je najboljši igralec lige: skupne točke, forma zadnjih treh krogov,
-- točke na tekmo in koliko fantasy ekip ga ima. Osnova za tabelo igralcev.
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
  rank() over (order by coalesce(t.points, 0) desc) as rank
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
