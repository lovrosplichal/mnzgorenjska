-- zakleni_krog: le ekipe, ki so obstajale PRED rokom kroga, dobijo posnetek.
--
-- Prej: cron je klical zakleni_krog(N) tudi ure/dneve po roku. Vsaka
-- ekipa z rosterjem je dobila posnetek in točke za nazaj, tudi če je
-- bila registrirana šele danes. Nepošteno do tistih, ki so v roku.
--
-- Zdaj: ekipa mora imeti fantasy_teams.created_at <= rounds.deadline_at,
-- da lahko dobi posnetek. Pravilo v strogo validaciji (roster_je_veljaven)
-- ostaja aktivno le od strogi_zaklep_od_kroga naprej.

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
  v_deadline   timestamptz;
  v_uporabi_v  boolean;
begin
  select r.number, r.deadline_at
    into v_stevilka, v_deadline
    from rounds r where r.id = p_round_id;
  v_uporabi_v := coalesce(v_stevilka, 999) >= v_strogo_od;

  insert into fantasy_lineups (
    round_id, fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order
  )
  select p_round_id, fr.fantasy_team_id, fr.player_id,
         fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  join fantasy_teams ft on ft.id = fr.fantasy_team_id
  where not exists (
    select 1 from fantasy_lineups fl
    where fl.round_id = p_round_id and fl.fantasy_team_id = fr.fantasy_team_id
  )
  -- Ekipa mora biti ustvarjena PRED rokom kroga
  and (v_deadline is null or ft.created_at <= v_deadline)
  and (not v_uporabi_v or roster_je_veljaven(fr.fantasy_team_id));

  get diagnostics v_posnetih = row_count;
  return v_posnetih;
end;
$$;
