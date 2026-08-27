-- Gorenjska Fantasy Liga — pravila dostopa (Row Level Security)
-- Zaženi po schema.sql.

alter table profiles enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table fantasy_teams enable row level security;
alter table fantasy_roster enable row level security;
alter table ratings enable row level security;
alter table player_scores enable row level security;

-- Javno berljivo: klubi, igralci, krogi, točke, profili
create policy "javno branje" on teams for select using (true);
create policy "javno branje" on players for select using (true);
create policy "javno branje" on rounds for select using (true);
create policy "javno branje" on player_scores for select using (true);
create policy "javno branje" on profiles for select using (true);

-- Profil ureja le lastnik
create policy "uredi svoj profil" on profiles for insert with check (auth.uid() = id);
create policy "posodobi svoj profil" on profiles for update using (auth.uid() = id);

-- Fantasy ekipe: vidne vsem, ureja jih le lastnik
create policy "javno branje" on fantasy_teams for select using (true);
create policy "lastnik ureja ekipo" on fantasy_teams for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "javno branje" on fantasy_roster for select using (true);
create policy "lastnik ureja nabor" on fantasy_roster for all
  using (exists (
    select 1 from fantasy_teams ft
    where ft.id = fantasy_roster.fantasy_team_id and ft.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from fantasy_teams ft
    where ft.id = fantasy_roster.fantasy_team_id and ft.owner_id = auth.uid()
  ));

-- Ocene: vsak vidi svoje, oddaja pa le v odprtem oknu za glasovanje
create policy "vidim svoje ocene" on ratings for select using (auth.uid() = voter_id);
create policy "oddaj oceno" on ratings for insert with check (
  auth.uid() = voter_id
  and exists (
    select 1 from rounds r
    where r.id = ratings.round_id
      and now() >= coalesce(r.voting_opens_at, now())
      and now() <= coalesce(r.voting_closes_at, now())
  )
);
