-- Točke igralca, ki ga v krogu ni bilo, morajo izginiti.
--
-- `recompute_round_scores` piše z `on conflict do update` — vrstice torej doda
-- in popravi, nikoli pa ne odstrani. Ko se zapisnik popravi (uvoz nastope za
-- tekmo pobriše in vpiše na novo) in kakšnega igralca v novi različici ni več,
-- njegov nastop izgine, vrstica s točkami pa ostane. Igralec tako v krogu
-- obdrži točke, ki jih ni zaslužil — in če ga ima kdo v postavi, jih dobi
-- tudi njegova ekipa.
--
-- V članski ligi je bilo takih 29 vrstic (38 + 2 točki), dve od njih v
-- zaklenjenih postavah.
create or replace function recompute_round_scores(p_round_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into player_scores (round_id, player_id, points, computed_at)
  select ap.round_id, ap.player_id, sum(ap.points), now()
  from appearance_points ap
  where ap.round_id = p_round_id
  group by ap.round_id, ap.player_id
  on conflict (round_id, player_id) do update
    set points = excluded.points,
        computed_at = excluded.computed_at;

  -- Kdor v tem krogu nima nastopa, v njem nima kaj iskati.
  delete from player_scores ps
  where ps.round_id = p_round_id
    and not exists (
      select 1 from appearance_points ap
      where ap.round_id = ps.round_id and ap.player_id = ps.player_id
    );
end;
$$;

-- Poravnava zgodovine: iste sirote poberemo tudi za nazaj.
delete from player_scores ps
where not exists (
  select 1 from appearance_points ap
  where ap.round_id = ps.round_id and ap.player_id = ps.player_id
);
