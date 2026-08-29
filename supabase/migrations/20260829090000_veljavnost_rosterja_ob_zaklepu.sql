-- Zaklep kroga: preskoči ekipe z neveljavnim kadrom.
--
-- Pravila (enaka klientski `preveriEkipo`):
--   • natanko 15 igralcev
--   • natanko 11 starterjev
--   • natanko 1 kapetan in 1 namestnik (med starterji)
--   • kader: 2 GK, 5 DEF, 5 MID, 3 FWD
--   • največ 3 igralci iz istega kluba
--   • vsi igralci morajo biti aktivni (active = true)
--   • vsak igralec mora imeti pozicijo (position != null)
--
-- Če ekipa ni skladna, se posnetek NE naredi → v tem krogu dobi 0 točk.
-- Uporabnik lahko roster popravi za naslednji krog.
--
-- Zakaj: sredi sezone lahko glasovanje o poziciji premakne igralca iz FWD
-- v MID, kar poruši kader neke ekipe (5 MID max). Prej so takšne ekipe
-- vseeno dobile točke kot da ni nič — kar je nepošteno do tistih, ki so
-- pravila spoštovali.

create or replace function roster_je_veljaven(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with roster as (
    select fr.*, p.position, p.team_id as klub_id, p.active
    from fantasy_roster fr
    join players p on p.id = fr.player_id
    where fr.fantasy_team_id = p_team_id
  ),
  po_poziciji as (
    select
      count(*) filter (where position = 'GK')  as gk,
      count(*) filter (where position = 'DEF') as def,
      count(*) filter (where position = 'MID') as mid,
      count(*) filter (where position = 'FWD') as fwd,
      count(*) filter (where position is null) as brez_poz,
      count(*) filter (where not active)       as neaktivnih,
      count(*)                                  as skupaj,
      count(*) filter (where is_starter)        as starterjev,
      count(*) filter (where is_captain)        as kapetanov,
      count(*) filter (where is_vice)           as namestnikov
    from roster
  ),
  po_klubu as (
    select max(cnt) as max_iz_kluba from (
      select klub_id, count(*) as cnt from roster group by klub_id
    ) s
  )
  select
    p.skupaj = 15
    and p.starterjev = 11
    and p.kapetanov = 1
    and p.namestnikov = 1
    and p.gk = 2 and p.def = 5 and p.mid = 5 and p.fwd = 3
    and p.brez_poz = 0
    and p.neaktivnih = 0
    and coalesce(k.max_iz_kluba, 0) <= 3
  from po_poziciji p, po_klubu k;
$$;

-- Prepiši zakleni_krog: filtriraj samo veljavne ekipe.
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
  )
  -- samo veljavni rosterji dobijo posnetek — s tem posledično točke
  and roster_je_veljaven(fr.fantasy_team_id);

  get diagnostics v_posnetih = row_count;
  return v_posnetih;
end;
$$;
