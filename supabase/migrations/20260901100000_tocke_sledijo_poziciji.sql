-- Točke morajo slediti poziciji in asistenci, ne le uvozu.
--
-- `player_scores` je posnetek, ki nastane ob uvozu zapisnikov. Pozicija in
-- asistenca pa se določita pozneje — s statističnim ugibanjem in glasovanjem
-- skupnosti — in nič ju ni preračunalo. Posledica: ob uvozu je pozicijo poznal
-- samo vratar (zapisnik ga označi z `(V)`), zato so goli in ohranjene mreže
-- vseh ostalih šteli nič. Na vrhu lestvice igralcev so bili sami vratarji,
-- napadalec z desetimi goli pa je imel točke samo za odigrane minute.
--
-- Odslej se točke preračunajo takoj:
--   * ko se igralcu spremeni pozicija (ugibanje, glasovanje, admin),
--   * ko se pri golu potrdi (ali umakne) asistenca.
--
-- Fantasy lestvica bere iste `player_scores`, zato to popravi tudi njo.

-- --------------------------------------------------------------------------
-- Preračun za enega igralca (vsi njegovi krogi)
-- --------------------------------------------------------------------------
-- `recompute_round_scores` predela cel krog; ob spremembi pozicije se spremeni
-- samo en igralec, zato ima smisel ožja različica — sicer bi ugibanje pozicij
-- za 350 igralcev predelalo vsak krog po 350-krat.
create or replace function preracunaj_igralca(p_player_id bigint)
returns int
language sql
security definer
set search_path = public
as $$
  with novo as (
    insert into player_scores (round_id, player_id, points, computed_at)
    select ap.round_id, ap.player_id, sum(ap.points), now()
    from appearance_points ap
    where ap.player_id = p_player_id
    group by ap.round_id, ap.player_id
    on conflict (round_id, player_id) do update
      set points = excluded.points,
          computed_at = excluded.computed_at
    returning 1
  )
  select count(*)::int from novo;
$$;

comment on function preracunaj_igralca(bigint) is
  'Osveži točke enega igralca v vseh krogih, v katerih je nastopil.';

-- --------------------------------------------------------------------------
-- Sprememba pozicije osveži točke igralca
-- --------------------------------------------------------------------------
create or replace function trg_pozicija_preracun()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.position is distinct from old.position then
    perform preracunaj_igralca(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists players_pozicija_preracun on players;
create trigger players_pozicija_preracun
  after update of position on players
  for each row execute function trg_pozicija_preracun();

-- --------------------------------------------------------------------------
-- Potrjena asistenca osveži točke tekme
-- --------------------------------------------------------------------------
-- Tu preračunamo cel krog: asistenca se lahko prestavi z enega igralca na
-- drugega in oba morata dobiti pravilne točke.
create or replace function trg_asistenca_preracun()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round bigint;
begin
  if new.assist_player_id is distinct from old.assist_player_id then
    select m.round_id into v_round from matches m where m.id = new.match_id;
    if v_round is not null then
      perform recompute_round_scores(v_round);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists goals_asistenca_preracun on goals;
create trigger goals_asistenca_preracun
  after update of assist_player_id on goals
  for each row execute function trg_asistenca_preracun();

-- --------------------------------------------------------------------------
-- Poravnava zgodovine: vsi krogi, ki so bili izračunani po stari poziciji
-- --------------------------------------------------------------------------
do $$
declare
  v_krog record;
begin
  for v_krog in
    select r.id from rounds r
    where exists (select 1 from player_scores ps where ps.round_id = r.id)
  loop
    perform recompute_round_scores(v_krog.id);
  end loop;
end;
$$;
