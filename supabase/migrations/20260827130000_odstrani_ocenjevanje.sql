-- Odstrani ostanke prvotnega modela z ocenami 1–10.
--
-- Točke odslej izhajajo iz statistike zapisnikov (glej 20260827110000),
-- zato tabela `ratings` in stolpca `avg_rating` / `votes_count` niso več v rabi.
-- Skupnost namesto ocen glasuje o asistencah in pozicijah.

drop table if exists ratings cascade;

alter table player_scores drop column if exists avg_rating;
alter table player_scores drop column if exists votes_count;

-- Preračun brez odstranjenih stolpcev
create or replace function recompute_round_scores(p_round_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into player_scores (round_id, player_id, points, computed_at)
  select ap.round_id, ap.player_id, sum(ap.points), now()
  from appearance_points ap
  where ap.round_id = p_round_id
  group by ap.round_id, ap.player_id
  on conflict (round_id, player_id) do update
    set points = excluded.points,
        computed_at = excluded.computed_at;
$$;

-- Okno glasovanja se je nanašalo na ocenjevanje kroga; glasovanje o asistencah
-- in pozicijah je odprto ves čas, zato stolpcev ne potrebujemo več.
comment on column rounds.voting_opens_at is
  'Ni več v rabi — glasovanje o asistencah in pozicijah ni časovno omejeno.';
comment on column rounds.voting_closes_at is
  'Ni več v rabi — glej voting_opens_at.';
