-- Rok kroga in posnetek postave.
--
-- Doslej so se vsi krogi točkovali s *trenutnim* kadrom: kdor je po odigranem
-- krogu prestavil igralce, si je popravil tudi pretekle točke. Odslej ima vsak
-- krog rok (`deadline_at`); ob njem se postava vsake ekipe posname v
-- `fantasy_lineups` in za tisti krog šteje samo še posnetek.
--
-- Urejanje kadra zato ni omejeno — kot v Premier League Fantasy spremembe po
-- roku preprosto veljajo šele za naslednji krog.

alter table rounds add column if not exists deadline_at timestamptz;

comment on column rounds.deadline_at is
  'Rok za spremembe postave. Ob njem se posname postava; po njem spremembe veljajo za naslednji krog.';

-- Za že odigrane kroge rok postavimo na jutro dneva tekme, da podatki niso prazni.
update rounds
   set deadline_at = (played_on::timestamp + time '10:00') at time zone 'Europe/Ljubljana'
 where deadline_at is null and played_on is not null;

-- --- posnetek postave ----------------------------------------------------
create table if not exists fantasy_lineups (
  round_id bigint not null references rounds on delete cascade,
  fantasy_team_id bigint not null references fantasy_teams on delete cascade,
  player_id bigint not null references players on delete cascade,
  is_starter boolean not null,
  is_captain boolean not null default false,
  is_vice boolean not null default false,
  bench_order int,
  captured_at timestamptz not null default now(),
  primary key (round_id, fantasy_team_id, player_id)
);

create index if not exists fantasy_lineups_ekipa_krog
  on fantasy_lineups (fantasy_team_id, round_id);

alter table fantasy_lineups enable row level security;

-- Posnetek je javno berljiv (da je lestvica preverljiva), pisati vanj pa sme
-- le funkcija za zaklep oziroma administrator.
drop policy if exists "javno branje" on fantasy_lineups;
create policy "javno branje" on fantasy_lineups for select using (true);

drop policy if exists "admin ureja posnetke" on fantasy_lineups;
create policy "admin ureja posnetke" on fantasy_lineups for all
  using (is_admin()) with check (is_admin());

-- --- zaklep kroga --------------------------------------------------------
-- Posname postavo vseh ekip za dani krog. Že posnetih ekip ne prepiše, zato je
-- klic varno ponoviti.
create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih int;
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
  return v_posnetih;
end;
$$;

-- Zaklene vse kroge, ki jim je rok potekel. Namenjeno rednemu klicu (cron).
create or replace function zakleni_zapadle_kroge()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_krog record;
  v_skupaj int := 0;
begin
  for v_krog in
    select id from rounds
    where deadline_at is not null and deadline_at <= now()
    order by number
  loop
    v_skupaj := v_skupaj + zakleni_krog(v_krog.id);
  end loop;
  return v_skupaj;
end;
$$;

-- --- postava, ki velja za krog ------------------------------------------
-- Posnetek, če obstaja; sicer trenutni kader (krog se še ni zaklenil).
create or replace function postava_kroga(p_team bigint, p_round bigint)
returns table (
  player_id bigint,
  is_starter boolean,
  is_captain boolean,
  is_vice boolean,
  bench_order int
)
language sql
stable
as $$
  select fl.player_id, fl.is_starter, fl.is_captain, fl.is_vice, fl.bench_order
  from fantasy_lineups fl
  where fl.fantasy_team_id = p_team and fl.round_id = p_round
  union all
  select fr.player_id, fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  where fr.fantasy_team_id = p_team
    and not exists (
      select 1 from fantasy_lineups fl
      where fl.fantasy_team_id = p_team and fl.round_id = p_round
    );
$$;

-- --- učinkovita postava odslej bere posnetek -----------------------------
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
    select pk.player_id, p.position, coalesce(mk.minutes, 0) as minutes
    from postava_kroga(p_team, p_round) pk
    join players p on p.id = pk.player_id
    left join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = pk.player_id
    where pk.is_starter
    order by pk.player_id
  loop
    if igralec.minutes > 0 then
      v_postava := v_postava || igralec.player_id;
      continue;
    end if;

    select pk.player_id into v_zamenjava
    from postava_kroga(p_team, p_round) pk
    join players p on p.id = pk.player_id
    join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = pk.player_id and mk.minutes > 0
    where not pk.is_starter
      and p.position = igralec.position
      and not (pk.player_id = any (v_porabljeni))
    order by coalesce(pk.bench_order, 99), pk.player_id
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
      (select array_agg(pk.player_id)
       from postava_kroga(p_team, p_round) pk
       where not pk.is_starter
         and not (pk.player_id = any (v_porabljeni))),
      '{}'::bigint[]
    );
  end if;

  -- Trak nosi kapetan, če je igral; sicer njegov namestnik.
  select pk.player_id into v_kapetan
  from postava_kroga(p_team, p_round) pk
  join minute_kroga mk
    on mk.round_id = p_round and mk.player_id = pk.player_id and mk.minutes > 0
  where pk.is_captain;

  if v_kapetan is null then
    select pk.player_id into v_kapetan
    from postava_kroga(p_team, p_round) pk
    join minute_kroga mk
      on mk.round_id = p_round and mk.player_id = pk.player_id and mk.minutes > 0
    where pk.is_vice;
  end if;

  return query
  select v.id, case when v.id = v_kapetan then 3 else 1 end
  from unnest(v_postava) as v(id);
end;
$$;

-- --- naslednji rok -------------------------------------------------------
-- Prvi krog, ki se še ni zaklenil — aplikacija ga kaže kot "spremembe veljajo
-- do …". Javno berljivo, ker je enako za vse.
create or replace view naslednji_krog as
select id, season, number, played_on, deadline_at
from rounds
where deadline_at is null or deadline_at > now()
order by number
limit 1;
