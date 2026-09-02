-- Borza velja samo za tekočo sezono in šele od prvega fantasy kroga.
--
-- Kaj se je zgodilo: za mladince smo uvozili lansko sezono, da imajo igralci
-- izhodiščno ceno namesto vsi po 4.5. Arhiv ima točke po krogih, borza pa
-- obračuna vsak krog, ki ima točke in še ni bil obračunan — zato je nočni cron
-- vseh osemnajst lanskih krogov obračunal naenkrat. Lanska forma je tako štela
-- dvakrat: enkrat v izhodiščni ceni, drugič še kot premik cene. Cene so čez noč
-- poskočile do +3.0 (kolikor dopušča meja drifta), ekipe pa so dobile
-- namišljeno premoženje, ne da bi bil odigran en sam fantasy krog.
--
-- Odslej borza pogleda samo:
--   * kroge zadnje sezone tekmovanja (arhiv je zgodovina, ne trg) in
--   * kroge od `competitions.prvi_fantasy_krog` naprej.
--
-- Zadnjo sezono beremo kot `max(season)`, ne prek `sezone.tekoca`: ta je po
-- odigranem zadnjem krogu neresnična in bi borzo ustavila sredi sklepnega dela
-- sezone.

-- --------------------------------------------------------------------------
-- 1. Preračun cen zavrne kroge, ki ne sodijo na trg
-- --------------------------------------------------------------------------
drop function if exists preracunaj_cene(bigint);
create function preracunaj_cene(p_round_id bigint)
returns table (igralec bigint, stara_cena numeric, nova_cena numeric, forma numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  MEJA_DRIFTA constant numeric := 3.0;
  NAJNIZJA constant numeric := 4.0;
  NAJVISJA constant numeric := 15.0;
  v_stevilka int;
  v_sezona text;
  v_tekmovanje bigint;
  v_prvi int;
  v_zadnja_sezona text;
begin
  select r.number, r.season, r.competition_id, c.prvi_fantasy_krog
    into v_stevilka, v_sezona, v_tekmovanje, v_prvi
    from rounds r
    join competitions c on c.id = r.competition_id
   where r.id = p_round_id;
  if v_stevilka is null then
    raise exception 'krog % ne obstaja', p_round_id;
  end if;

  -- Arhivske sezone trga ne premikajo.
  select max(r.season) into v_zadnja_sezona
    from rounds r where r.competition_id = v_tekmovanje;
  if v_sezona is distinct from v_zadnja_sezona then
    return;
  end if;

  -- Krogi pred začetkom fantasy dela lige so samo rezultati.
  if v_stevilka < coalesce(v_prvi, 1) then
    return;
  end if;

  return query
  with forma as (
    select
      ps.player_id,
      sum(ps.points) as tocke
    from player_scores ps
    join rounds r on r.id = ps.round_id
    where r.season = v_sezona
      and r.competition_id = v_tekmovanje
      and r.number between greatest(1, v_stevilka - 2) and v_stevilka
    group by ps.player_id
  ),
  premik as (
    select
      p.id,
      p.value as stara,
      coalesce(f.tocke, 0) as tocke,
      case
        when coalesce(f.tocke, 0) >= 18 then 0.3
        when coalesce(f.tocke, 0) >= 12 then 0.2
        when coalesce(f.tocke, 0) >= 7 then 0.1
        when coalesce(f.tocke, 0) <= 0 then -0.2
        when coalesce(f.tocke, 0) <= 2 then -0.1
        else 0
      end as delta
    from players p
    left join forma f on f.player_id = p.id
    where not p.value_locked
      and p.competition_id = v_tekmovanje
      and not exists (
        select 1 from price_changes pc
        where pc.player_id = p.id and pc.round_id = p_round_id
      )
  ),
  omejeno as (
    select
      pr.id,
      pr.stara,
      pr.tocke,
      least(
        greatest(pr.stara + pr.delta, NAJNIZJA, p.value_start - MEJA_DRIFTA),
        NAJVISJA,
        p.value_start + MEJA_DRIFTA
      ) as nova
    from premik pr
    join players p on p.id = pr.id
    where pr.delta <> 0
  ),
  zapis as (
    insert into price_changes (player_id, round_id, old_value, new_value, form)
    select o.id, p_round_id, o.stara, o.nova, o.tocke
    from omejeno o
    where o.nova <> o.stara
    on conflict (player_id, round_id) do update
      set new_value = excluded.new_value,
          form = excluded.form,
          changed_at = now()
    returning price_changes.player_id, price_changes.old_value,
              price_changes.new_value, price_changes.form
  )
  select z.player_id, z.old_value, z.new_value, z.form from zapis z;
end;
$$;

-- --------------------------------------------------------------------------
-- 2. Cron ne ponuja več arhivskih krogov
-- --------------------------------------------------------------------------
create or replace function uveljavi_zapadle_cene()
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
    select r.id
    from rounds r
    join competitions c on c.id = r.competition_id
    where exists (select 1 from player_scores ps where ps.round_id = r.id)
      and not exists (select 1 from price_changes pc where pc.round_id = r.id)
      and r.number >= c.prvi_fantasy_krog
      and r.season = (
        select max(r2.season) from rounds r2 where r2.competition_id = r.competition_id
      )
    order by r.season, r.number
  loop
    v_skupaj := v_skupaj + uveljavi_cene(v_krog.id);
  end loop;
  return v_skupaj;
end;
$$;

-- --------------------------------------------------------------------------
-- 3. Povrnitev trga ligam, ki še niso odigrale nobenega fantasy kroga
-- --------------------------------------------------------------------------
-- Kjer še ni nobenega posnetka postave, se ni odigralo nič — trg lahko brez
-- škode povrnemo na izhodišče. Ligi, ki že teče (člani), se namenoma ne
-- dotaknemo: njene cene so plod pravih krogov in pravih prestopov.
do $$
declare
  v_liga record;
begin
  for v_liga in
    select c.id, c.slug
    from competitions c
    where not exists (
      select 1 from fantasy_lineups fl
      join rounds r on r.id = fl.round_id
      where r.competition_id = c.id
    )
  loop
    delete from price_changes pc
    using rounds r
    where r.id = pc.round_id and r.competition_id = v_liga.id;

    update players p
       set value = p.value_start
     where p.competition_id = v_liga.id
       and p.value_start is not null
       and p.value is distinct from p.value_start;

    -- Kar je bilo plačano, se poravna z izhodiščno ceno; brez tega bi komu
    -- ostal dobiček iz cen, ki jih ne bi smelo biti.
    update fantasy_roster fr
       set buy_value = p.value
      from players p, fantasy_teams ft
     where p.id = fr.player_id
       and ft.id = fr.fantasy_team_id
       and ft.competition_id = v_liga.id;

    update fantasy_teams ft
       set cash = ft.budget - coalesce((
             select sum(fr.buy_value) from fantasy_roster fr
             where fr.fantasy_team_id = ft.id
           ), 0)
     where ft.competition_id = v_liga.id;

    raise notice 'trg povrnjen za ligo %', v_liga.slug;
  end loop;
end;
$$;
