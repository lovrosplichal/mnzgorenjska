-- Samodejno ustvarjanje profila ob registraciji + administratorska zastavica

alter table profiles add column if not exists is_admin boolean not null default false;

-- Ob registraciji uporabnika ustvari profil
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Preračun točk mora brati vse ocene, zato security definer
create or replace function recompute_round_scores(p_round_id bigint)
returns void
language sql
security definer
set search_path = public
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

-- Uporabnik lahko svojo oceno popravi, dokler je glasovanje odprto
create policy "posodobi svojo oceno" on ratings for update
  using (
    auth.uid() = voter_id
    and exists (
      select 1 from rounds r
      where r.id = ratings.round_id
        and now() >= coalesce(r.voting_opens_at, now())
        and now() <= coalesce(r.voting_closes_at, now())
    )
  );

-- Administratorji upravljajo kroge, klube in igralce
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create policy "admin ureja kroge" on rounds for all using (is_admin()) with check (is_admin());
create policy "admin ureja klube" on teams for all using (is_admin()) with check (is_admin());
create policy "admin ureja igralce" on players for all using (is_admin()) with check (is_admin());

-- Koliko glasov je igralec prejel v krogu (javno, brez razkritja posameznih ocen)
create or replace view round_vote_counts as
select round_id, player_id, count(*)::int as votes_count
from ratings
group by round_id, player_id;
