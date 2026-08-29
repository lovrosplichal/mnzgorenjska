-- Prvi krog: brez stroge validacije — vsi dobijo točke.
--
-- Prej: `zakleni_krog` je od migracije 20260829090000 preskočil ekipe z
-- neveljavnim kadrom. To je pravilno na dolgi rok, ampak za PRVI krog bi
-- prekomerno kaznovalo uporabnike, ki so ekipe sestavljali predno smo
-- (ročno + z glasovanjem) prestavili pozicije.
--
-- Rešitev: nastavitev `strogi_zaklep_od_kroga` (default = 2). `zakleni_krog`
-- odigra strogo validacijo šele od tega kroga naprej; nižji krogi dobijo
-- posnetek NE glede na napake.
insert into settings (key, value) values
  ('strogi_zaklep_od_kroga', '2'::jsonb)
on conflict (key) do nothing;

create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih   int;
  v_strogo_od  int := nastavitev_int('strogi_zaklep_od_kroga', 2);
  v_stevilka   int;
  v_uporabi_v  boolean;
begin
  select r.number into v_stevilka from rounds r where r.id = p_round_id;
  v_uporabi_v := coalesce(v_stevilka, 999) >= v_strogo_od;

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
  and (not v_uporabi_v or roster_je_veljaven(fr.fantasy_team_id));

  get diagnostics v_posnetih = row_count;
  return v_posnetih;
end;
$$;
