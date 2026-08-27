-- Gorenjska Fantasy Liga — osnovna shema
-- Zaženi v Supabase SQL Editor.

-- Profili uporabnikov (razširitev auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Realni klubi 1. GNL
create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null unique,
  short_name text
);

-- Realni igralci
create table if not exists players (
  id bigint generated always as identity primary key,
  team_id bigint not null references teams on delete cascade,
  first_name text not null,
  last_name text not null,
  position text check (position in ('GK', 'DEF', 'MID', 'FWD')),
  active boolean not null default true
);

-- Krogi sezone
create table if not exists rounds (
  id bigint generated always as identity primary key,
  season text not null,
  number int not null,
  played_on date,
  -- glasovanje je odprto le v tem oknu
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  unique (season, number)
);

-- Fantasy ekipe uporabnikov
create table if not exists fantasy_teams (
  id bigint generated always as identity primary key,
  owner_id uuid not null references profiles on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id)
);

-- Izbrani igralci v fantasy ekipi
create table if not exists fantasy_roster (
  fantasy_team_id bigint not null references fantasy_teams on delete cascade,
  player_id bigint not null references players on delete cascade,
  is_starter boolean not null default true,
  primary key (fantasy_team_id, player_id)
);

-- Posamezni glasovi: uporabnik x igralec x krog
create table if not exists ratings (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds on delete cascade,
  player_id bigint not null references players on delete cascade,
  voter_id uuid not null references profiles on delete cascade,
  rating numeric(3, 1) not null check (rating >= 1 and rating <= 10),
  created_at timestamptz not null default now(),
  unique (round_id, player_id, voter_id)
);

create index if not exists ratings_round_player_idx on ratings (round_id, player_id);

-- Agregirane točke igralca na krog (povprečje ocen)
create table if not exists player_scores (
  round_id bigint not null references rounds on delete cascade,
  player_id bigint not null references players on delete cascade,
  avg_rating numeric(4, 2) not null,
  votes_count int not null,
  points numeric(6, 2) not null,
  computed_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Lestvica fantasy ekip
create or replace view fantasy_team_standings as
select
  ft.id as fantasy_team_id,
  ft.name as team_name,
  coalesce(sum(ps.points), 0) as total_points
from fantasy_teams ft
left join fantasy_roster fr on fr.fantasy_team_id = ft.id and fr.is_starter
left join player_scores ps on ps.player_id = fr.player_id
group by ft.id, ft.name;

-- Preračun točk za en krog: povprečje ocen, minimalno 3 glasovi
create or replace function recompute_round_scores(p_round_id bigint)
returns void
language sql
as $$
  insert into player_scores (round_id, player_id, avg_rating, votes_count, points, computed_at)
  select
    r.round_id,
    r.player_id,
    round(avg(r.rating), 2),
    count(*),
    round(avg(r.rating), 2),
    now()
  from ratings r
  where r.round_id = p_round_id
  group by r.round_id, r.player_id
  having count(*) >= 3
  on conflict (round_id, player_id) do update
    set avg_rating = excluded.avg_rating,
        votes_count = excluded.votes_count,
        points = excluded.points,
        computed_at = excluded.computed_at;
$$;
