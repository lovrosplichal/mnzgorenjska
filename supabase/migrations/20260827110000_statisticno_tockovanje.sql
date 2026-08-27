-- Prehod s skupnostnega ocenjevanja (1–10) na točkovanje iz uradnih zapisnikov.
--
-- Točke se odslej računajo iz statistike zapisnikov MNZ Gorenjska.
-- Skupnost z glasovanjem določi le tisto, česar v zapisniku ni:
--   1. kdo je podal asistenco za posamezni gol,
--   2. na katerem mestu igralec igra (razen vratarja, ki je označen z (V)).

-- --------------------------------------------------------------------------
-- Tekme
-- --------------------------------------------------------------------------
create table if not exists matches (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds on delete cascade,
  home_team_id bigint not null references teams on delete restrict,
  away_team_id bigint not null references teams on delete restrict,
  home_goals int not null default 0,
  away_goals int not null default 0,
  played_on date,
  -- izvor podatkov
  zapisnik_id text unique,
  source_url text,
  imported_at timestamptz,
  -- opozorila razčlenjevalnika (nepopolna postava, manjkajoč vratar ...)
  import_warnings text[] not null default '{}',
  check (home_team_id <> away_team_id)
);

create index if not exists matches_round_idx on matches (round_id);

-- --------------------------------------------------------------------------
-- Nastopi igralcev
-- --------------------------------------------------------------------------
create table if not exists appearances (
  id bigint generated always as identity primary key,
  match_id bigint not null references matches on delete cascade,
  player_id bigint not null references players on delete cascade,
  team_id bigint not null references teams on delete restrict,
  shirt_number int,
  started boolean not null default false,
  minute_on int not null default 0,
  minute_off int not null default 90,
  minutes_played int not null default 0,
  goals int not null default 0,
  own_goals int not null default 0,
  penalties_scored int not null default 0,
  penalties_missed int not null default 0,
  -- obranjenih enajstmetrovk zapisnik ne beleži; vnese jih administrator
  penalties_saved int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  goals_conceded int not null default 0,
  clean_sheet boolean not null default false,
  unique (match_id, player_id)
);

create index if not exists appearances_player_idx on appearances (player_id);

-- --------------------------------------------------------------------------
-- Goli (vsak gol je svoja vrstica, da lahko skupnost glasuje o asistenci)
-- --------------------------------------------------------------------------
create table if not exists goals (
  id bigint generated always as identity primary key,
  match_id bigint not null references matches on delete cascade,
  scorer_id bigint references players on delete set null,
  team_id bigint not null references teams on delete restrict,
  minute int,
  is_own_goal boolean not null default false,
  is_penalty boolean not null default false,
  score_home int,
  score_away int,
  -- potrjeni podajalec (ko doseže prag glasov)
  assist_player_id bigint references players on delete set null,
  assist_confirmed_at timestamptz
);

create index if not exists goals_match_idx on goals (match_id);

-- --------------------------------------------------------------------------
-- Glasovanje o asistencah
-- --------------------------------------------------------------------------
create table if not exists assist_votes (
  id bigint generated always as identity primary key,
  goal_id bigint not null references goals on delete cascade,
  voter_id uuid not null references profiles on delete cascade,
  -- NULL pomeni "nihče / brez asistence"
  player_id bigint references players on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, voter_id)
);

create index if not exists assist_votes_goal_idx on assist_votes (goal_id);

-- --------------------------------------------------------------------------
-- Glasovanje o pozicijah
-- --------------------------------------------------------------------------
create table if not exists position_votes (
  id bigint generated always as identity primary key,
  player_id bigint not null references players on delete cascade,
  voter_id uuid not null references profiles on delete cascade,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  created_at timestamptz not null default now(),
  unique (player_id, voter_id)
);

create index if not exists position_votes_player_idx on position_votes (player_id);

-- Kako je bila pozicija določena
alter table players add column if not exists position_source text
  not null default 'neznano'
  check (position_source in ('neznano', 'zapisnik', 'glasovanje', 'admin'));

-- Igralec je vezan na zapisnik prek imena in številke dresa
alter table players add column if not exists shirt_number int;
alter table players add column if not exists full_name text;

-- --------------------------------------------------------------------------
-- Prag glasov
-- --------------------------------------------------------------------------
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

insert into settings (key, value) values
  ('prag_glasov_asistenca', '5'::jsonb),
  ('prag_glasov_pozicija', '5'::jsonb)
on conflict (key) do nothing;

create or replace function nastavitev_int(p_key text, p_privzeto int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::int from settings where key = p_key), p_privzeto);
$$;

-- --------------------------------------------------------------------------
-- Potrjevanje asistenc: ob dovolj glasovih za istega igralca se asistenca
-- pripiše. Sproži se po vsakem glasu.
-- --------------------------------------------------------------------------
create or replace function potrdi_asistenco(p_goal_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prag int := nastavitev_int('prag_glasov_asistenca', 5);
  v_player_id bigint;
  v_glasov int;
begin
  select player_id, count(*)
    into v_player_id, v_glasov
  from assist_votes
  where goal_id = p_goal_id and player_id is not null
  group by player_id
  order by count(*) desc
  limit 1;

  if v_glasov >= v_prag then
    update goals
      set assist_player_id = v_player_id,
          assist_confirmed_at = now()
    where id = p_goal_id
      and assist_player_id is distinct from v_player_id;
  end if;
end;
$$;

create or replace function trg_assist_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform potrdi_asistenco(coalesce(new.goal_id, old.goal_id));
  return null;
end;
$$;

drop trigger if exists assist_votes_potrdi on assist_votes;
create trigger assist_votes_potrdi
  after insert or update or delete on assist_votes
  for each row execute function trg_assist_vote();

-- --------------------------------------------------------------------------
-- Potrjevanje pozicij
-- --------------------------------------------------------------------------
create or replace function potrdi_pozicijo(p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prag int := nastavitev_int('prag_glasov_pozicija', 5);
  v_position text;
  v_glasov int;
begin
  -- pozicije iz zapisnika ali od administratorja imajo prednost
  if exists (
    select 1 from players
    where id = p_player_id and position_source in ('zapisnik', 'admin')
  ) then
    return;
  end if;

  select position, count(*)
    into v_position, v_glasov
  from position_votes
  where player_id = p_player_id
  group by position
  order by count(*) desc
  limit 1;

  if v_glasov >= v_prag then
    update players
      set position = v_position,
          position_source = 'glasovanje'
    where id = p_player_id;
  end if;
end;
$$;

create or replace function trg_position_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform potrdi_pozicijo(coalesce(new.player_id, old.player_id));
  return null;
end;
$$;

drop trigger if exists position_votes_potrdi on position_votes;
create trigger position_votes_potrdi
  after insert or update or delete on position_votes
  for each row execute function trg_position_vote();

-- --------------------------------------------------------------------------
-- Izračun točk iz statistike
-- --------------------------------------------------------------------------
create or replace function tocke_za_nastop(
  p_position text,
  p_minutes int,
  p_goals int,
  p_assists int,
  p_clean_sheet boolean,
  p_conceded int,
  p_pen_saved int,
  p_pen_missed int,
  p_own_goals int,
  p_yellow int,
  p_red int
)
returns numeric
language sql
immutable
as $$
  select case when coalesce(p_minutes, 0) <= 0 then 0 else
    -- igralni čas
    (case when p_minutes >= 60 then 2 else 1 end)
    -- goli po poziciji
    + coalesce(p_goals, 0) * (case p_position
        when 'GK' then 10 when 'DEF' then 6 when 'MID' then 5 when 'FWD' then 4
        else 0 end)
    -- asistence
    + coalesce(p_assists, 0) * 3
    -- brez prejetega gola (vsaj 60 minut)
    + (case when p_clean_sheet and p_minutes >= 60 then
        (case p_position when 'GK' then 4 when 'DEF' then 4 when 'MID' then 1
         else 0 end) else 0 end)
    -- prejeti goli: -1 za vsaka 2
    + (case when p_position in ('GK', 'DEF')
        then -floor(coalesce(p_conceded, 0) / 2.0) else 0 end)
    -- posebne akcije
    + coalesce(p_pen_saved, 0) * 5
    + coalesce(p_pen_missed, 0) * -2
    + coalesce(p_own_goals, 0) * -2
    + coalesce(p_yellow, 0) * -1
    + coalesce(p_red, 0) * -3
  end;
$$;

-- Točke igralca po tekmah (asistence štejemo iz potrjenih golov)
create or replace view appearance_points as
select
  a.id as appearance_id,
  a.match_id,
  a.player_id,
  m.round_id,
  p.position,
  a.minutes_played,
  a.goals,
  coalesce(asi.st, 0) as assists,
  a.clean_sheet,
  a.goals_conceded,
  tocke_za_nastop(
    p.position, a.minutes_played, a.goals, coalesce(asi.st, 0)::int,
    a.clean_sheet, a.goals_conceded, a.penalties_saved, a.penalties_missed,
    a.own_goals, a.yellow_cards, a.red_cards
  ) as points
from appearances a
join matches m on m.id = a.match_id
join players p on p.id = a.player_id
left join lateral (
  select count(*)::int as st
  from goals g
  where g.match_id = a.match_id and g.assist_player_id = a.player_id
) asi on true;

-- Preračun točk kroga iz statistike (nadomesti staro različico,
-- ki je povprečila ocene 1–10)
create or replace function recompute_round_scores(p_round_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into player_scores (round_id, player_id, avg_rating, votes_count, points, computed_at)
  select
    ap.round_id,
    ap.player_id,
    0,
    0,
    sum(ap.points),
    now()
  from appearance_points ap
  where ap.round_id = p_round_id
  group by ap.round_id, ap.player_id
  on conflict (round_id, player_id) do update
    set points = excluded.points,
        avg_rating = excluded.avg_rating,
        votes_count = excluded.votes_count,
        computed_at = excluded.computed_at;
$$;

-- --------------------------------------------------------------------------
-- Pravice dostopa
-- --------------------------------------------------------------------------
alter table matches enable row level security;
alter table appearances enable row level security;
alter table goals enable row level security;
alter table assist_votes enable row level security;
alter table position_votes enable row level security;
alter table settings enable row level security;

create policy "javno branje" on matches for select using (true);
create policy "javno branje" on appearances for select using (true);
create policy "javno branje" on goals for select using (true);
create policy "javno branje" on settings for select using (true);

create policy "admin ureja tekme" on matches for all using (is_admin()) with check (is_admin());
create policy "admin ureja nastope" on appearances for all using (is_admin()) with check (is_admin());
create policy "admin ureja gole" on goals for all using (is_admin()) with check (is_admin());
create policy "admin ureja nastavitve" on settings for all using (is_admin()) with check (is_admin());

-- Glasovi o asistencah so javno vidni (skupnost vidi, koliko glasov ima kdo),
-- oddaja pa jih lahko vsak prijavljen uporabnik — le v svojem imenu.
create policy "javno branje" on assist_votes for select using (true);
create policy "oddaj glas o asistenci" on assist_votes for insert
  with check (auth.uid() = voter_id);
create policy "spremeni svoj glas o asistenci" on assist_votes for update
  using (auth.uid() = voter_id) with check (auth.uid() = voter_id);
create policy "umakni svoj glas o asistenci" on assist_votes for delete
  using (auth.uid() = voter_id);

create policy "javno branje" on position_votes for select using (true);
create policy "oddaj glas o poziciji" on position_votes for insert
  with check (auth.uid() = voter_id);
create policy "spremeni svoj glas o poziciji" on position_votes for update
  using (auth.uid() = voter_id) with check (auth.uid() = voter_id);
create policy "umakni svoj glas o poziciji" on position_votes for delete
  using (auth.uid() = voter_id);

-- --------------------------------------------------------------------------
-- Pregled glasov (agregirano, za prikaz v vmesniku)
-- --------------------------------------------------------------------------
create or replace view assist_vote_counts as
select goal_id, player_id, count(*)::int as votes
from assist_votes
group by goal_id, player_id;

create or replace view position_vote_counts as
select player_id, position, count(*)::int as votes
from position_votes
group by player_id, position;
