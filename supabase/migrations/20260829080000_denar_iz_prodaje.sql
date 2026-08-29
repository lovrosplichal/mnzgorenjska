-- Sredstva ekipe: prodaja igralca vrne TRENUTNO vrednost, ne nakupno.
--
-- Do zdaj je bilo `proračun − sum(buy_value)` fiksno: če se ti je igralec
-- podražil, si na prodajo dobil le, kar si zanj plačal. To pomeni brez
-- dobička in fantasy trg ne "diha".
--
-- Zdaj:
--   • `fantasy_teams.cash` = trenutna gotovina (starta pri `budget`).
--   • RPC `shrani_ekipo(team_id, roster)` atomarno:
--       delta = sum(current_value ODSTRANJENIH) − sum(current_value DODANIH)
--       cash += delta
--       ohranimo `buy_value` za igralce, ki so ostali; novim ga postavimo
--       na trenutno ceno.
--   • Bogastvo (za prikaz) = `cash` + sum(current_value držanih igralcev).
--
-- Če se igralec od nakupa podraži, se dobiček realizira šele ob prodaji.
-- To zaustavlja abuse (kupi poceni, sam sebi proda draga).

-- --------------------------------------------------------------------------
-- 1. Cash kolona
-- --------------------------------------------------------------------------
alter table fantasy_teams add column if not exists cash numeric(6, 1)
  not null default 100.0;

-- Zaokroženje na 0.1 (naše cene so na desetico natančno)
alter table fantasy_teams drop constraint if exists fantasy_teams_cash_check;
alter table fantasy_teams add constraint fantasy_teams_cash_check
  check (cash >= -0.01);

comment on column fantasy_teams.cash is
  'Trenutna razpoložljiva sredstva. Zniža se ob nakupu (po trenutni ceni), '
  'zviša ob prodaji (po trenutni ceni — dobiček se realizira).';

-- --------------------------------------------------------------------------
-- 2. Backfill obstoječih ekip
--    cash = budget − sum(buy_value trenutnih igralcev)
-- Tako ohranimo trenutno stanje "kar so plačali" in šele naslednji prestop
-- začne izračunavati dobičke.
-- --------------------------------------------------------------------------
update fantasy_teams ft
  set cash = ft.budget - coalesce((
    select sum(fr.buy_value)
    from fantasy_roster fr
    where fr.fantasy_team_id = ft.id
  ), 0)
  where ft.cash = 100.0;  -- dotaknemo se le neposodobljenih

-- --------------------------------------------------------------------------
-- 3. RPC: shrani_ekipo
--
-- Klienti (Moja ekipa) namesto neposrednega delete+insert kličejo to funkcijo.
-- Ta izračuna delta, preveri sredstva in atomarno prepiše roster + cash.
-- --------------------------------------------------------------------------
create or replace function shrani_ekipo(
  p_team_id bigint,
  p_roster  jsonb   -- [{player_id, is_starter, is_captain, is_vice, bench_order}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash          numeric;
  v_delta         numeric;
  v_dobicek       numeric;
  v_strosek       numeric;
  v_stari_buy     jsonb;
begin
  -- Preveri lastništvo — RPC namreč beži izven RLS (security definer).
  if not exists (
    select 1 from fantasy_teams
    where id = p_team_id and owner_id = auth.uid()
  ) then
    raise exception 'Ni dovoljenja za urejanje te ekipe.'
      using errcode = '42501';
  end if;

  select cash into v_cash from fantasy_teams where id = p_team_id;

  -- Snapshot starega rosterja: player_id → buy_value (za ohranitev)
  select coalesce(jsonb_object_agg(player_id::text, buy_value), '{}'::jsonb)
    into v_stari_buy
    from fantasy_roster where fantasy_team_id = p_team_id;

  -- Dobiček ODSTRANJENIH = sum(current value) — vračilo pri trenutni ceni.
  select coalesce(sum(p.value), 0)::numeric into v_dobicek
  from fantasy_roster fr
  join players p on p.id = fr.player_id
  where fr.fantasy_team_id = p_team_id
    and not exists (
      select 1
      from jsonb_array_elements(p_roster) e
      where (e->>'player_id')::bigint = fr.player_id
    );

  -- Strošek DODANIH (novi v roster, prej ni bilo) = sum(current value).
  select coalesce(sum(p.value), 0)::numeric into v_strosek
  from jsonb_array_elements(p_roster) e
  join players p on p.id = (e->>'player_id')::bigint
  where not exists (
    select 1 from fantasy_roster fr
    where fr.fantasy_team_id = p_team_id
      and fr.player_id = (e->>'player_id')::bigint
  );

  v_delta := v_dobicek - v_strosek;

  if v_cash + v_delta < 0 then
    raise exception 'Premalo sredstev — potrebuješ še % M.', abs(v_cash + v_delta)::text
      using errcode = 'P0001';
  end if;

  -- Prepiši roster
  delete from fantasy_roster where fantasy_team_id = p_team_id;

  insert into fantasy_roster (
    fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order, buy_value
  )
  select
    p_team_id,
    (e->>'player_id')::bigint,
    coalesce((e->>'is_starter')::boolean, false),
    coalesce((e->>'is_captain')::boolean, false),
    coalesce((e->>'is_vice')::boolean, false),
    nullif(e->>'bench_order', '')::int,
    -- Ohranimo prejšnji buy_value; za nove igralce = trenutna cena.
    coalesce(
      (v_stari_buy ->> (e->>'player_id'))::numeric,
      (select value from players where id = (e->>'player_id')::bigint)
    )
  from jsonb_array_elements(p_roster) e;

  update fantasy_teams
    set cash = v_cash + v_delta
    where id = p_team_id;

  return jsonb_build_object(
    'cash',      v_cash + v_delta,
    'dobicek',   v_dobicek,
    'strosek',   v_strosek,
    'delta',     v_delta
  );
end;
$$;

grant execute on function shrani_ekipo(bigint, jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- 4. Pomožen pogled: bogastvo ekipe (cash + trenutna vrednost držanih)
-- --------------------------------------------------------------------------
create or replace view fantasy_team_wealth as
  select
    ft.id           as fantasy_team_id,
    ft.name,
    ft.budget       as starting_budget,
    ft.cash,
    coalesce(sum(p.value), 0)::numeric as roster_value,
    ft.cash + coalesce(sum(p.value), 0)::numeric as total_wealth
  from fantasy_teams ft
  left join fantasy_roster fr on fr.fantasy_team_id = ft.id
  left join players p on p.id = fr.player_id
  group by ft.id, ft.name, ft.budget, ft.cash;
