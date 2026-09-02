-- Prestopi se spet beležijo.
--
-- `zakleni_krog` je prestope štel od migracije 20260828180000, izgubil pa jih
-- je v 20260829090000, ko je dobil strogo validacijo kadra: funkcija je bila
-- prepisana in tisti del je izpadel. Odtlej je `fantasy_transfers` prazna,
-- `fantasy_round_points` pa od tam odšteva kazen — kazni torej niso delovale
-- in vsak je lahko med krogoma zamenjal vseh petnajst igralcev zastonj.
--
-- Kako je mišljeno: šteje se razlika med DVEMA ZAKLENJENIMA POSNETKOMA, ne
-- vsako klikanje vmes. Med rokoma lahko lastnik poljubno preizkuša — dodaja,
-- briše, vrača. Ob roku se posname stanje in primerja s posnetkom prejšnjega
-- kroga: kdor je v novem in ga v prejšnjem ni bilo, šteje za prestop.
-- Brezplačnih je `prosti_prestopi` (3), vsak nadaljnji stane `kazen_prestopa`
-- (4 točke). Wildcard kazen odpravi.
--
-- Primerjamo znotraj iste sezone. Prvi zaklenjeni krog sezone je zastonj —
-- takrat se kader sestavlja na novo in primerjava z lansko postavo bi vsakemu
-- zaracunala petnajst prestopov.

create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih   int;
  v_strogo_od  int := nastavitev_int('strogi_zaklep_od_kroga', 2);
  v_prosti     int := nastavitev_int('prosti_prestopi', 3);
  v_kazen      int := nastavitev_int('kazen_prestopa', 4);
  v_stevilka   int;
  v_sezona     text;
  v_deadline   timestamptz;
  v_tekmovanje bigint;
  v_prvi       int;
  v_uporabi_v  boolean;
begin
  select r.number, r.season, r.deadline_at, r.competition_id, c.prvi_fantasy_krog
    into v_stevilka, v_sezona, v_deadline, v_tekmovanje, v_prvi
    from rounds r
    join competitions c on c.id = r.competition_id
   where r.id = p_round_id;

  if v_stevilka is null then
    return 0;
  end if;

  -- Krogi pred začetkom fantasy dela lige so samo rezultati.
  if v_stevilka < coalesce(v_prvi, 1) then
    return 0;
  end if;

  -- Stroga validacija kadra šele od drugega fantasy kroga naprej — prvi krog
  -- lige je vedno tudi krog, v katerem se pozicije šele izglasujejo.
  v_uporabi_v := v_stevilka >= greatest(v_strogo_od, coalesce(v_prvi, 1) + 1);

  insert into fantasy_lineups (
    round_id, fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order
  )
  select p_round_id, fr.fantasy_team_id, fr.player_id,
         fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  join fantasy_teams ft on ft.id = fr.fantasy_team_id
  where ft.competition_id = v_tekmovanje
  and not exists (
    select 1 from fantasy_lineups fl
    where fl.round_id = p_round_id and fl.fantasy_team_id = fr.fantasy_team_id
  )
  and (v_deadline is null or ft.created_at <= v_deadline)
  and (not v_uporabi_v or roster_je_veljaven(fr.fantasy_team_id));

  get diagnostics v_posnetih = row_count;

  -- --- prestopi glede na prejšnji zaklenjeni krog iste sezone --------------
  insert into fantasy_transfers (fantasy_team_id, round_id, transfers, free_transfers, penalty)
  select
    n.fantasy_team_id,
    p_round_id,
    n.prisli,
    v_prosti,
    case
      when exists (
        select 1 from fantasy_chips c
        where c.fantasy_team_id = n.fantasy_team_id
          and c.chip = 'wildcard'
          and c.round_id = p_round_id
      ) then 0
      else greatest(0, n.prisli - v_prosti) * v_kazen
    end
  from (
    select
      fl.fantasy_team_id,
      count(*) filter (
        where not exists (
          select 1 from fantasy_lineups prej
          where prej.fantasy_team_id = fl.fantasy_team_id
            and prej.player_id = fl.player_id
            and prej.round_id = prejsnji.round_id
        )
      ) as prisli
    from fantasy_lineups fl
    join lateral (
      -- zadnji zaklenjeni krog te ekipe PRED tem, znotraj iste sezone
      select fl2.round_id
      from fantasy_lineups fl2
      join rounds r2 on r2.id = fl2.round_id
      where fl2.fantasy_team_id = fl.fantasy_team_id
        and r2.season = v_sezona
        and r2.number < v_stevilka
      order by r2.number desc
      limit 1
    ) prejsnji on true
    where fl.round_id = p_round_id
    group by fl.fantasy_team_id
  ) n
  on conflict (fantasy_team_id, round_id) do nothing;

  return v_posnetih;
end;
$$;
