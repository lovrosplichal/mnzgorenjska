-- Samodejno zaklepanje krogov ob roku.
--
-- Popravlja dve luknji v prvotni izvedbi posnetkov:
--
-- 1. `postava_kroga` je za krog brez posnetka vedno vzela trenutni kader. Za
--    *pretekli* krog to pomeni, da bi ekipa, ustvarjena danes, dobila točke za
--    kroge, ki so bili odigrani, preden je sploh obstajala. Odslej nadomestna
--    logika velja le, dokler rok kroga še ni potekel; po roku šteje izključno
--    posnetek, in kdor ga nima, v tistem krogu nima postave.
--
-- 2. `zakleni_zapadle_kroge()` je zaklepal vse kroge s preteklim rokom, torej
--    tudi vso lansko sezono. Odslej gleda samo kroge, ki so zapadli znotraj
--    okna (privzeto 7 dni) — starejši krogi so zgodovina in se ne posnamejo.

create or replace function postava_kroga(p_team bigint, p_round bigint)
returns table (
  player_id bigint,
  is_starter boolean,
  is_captain boolean,
  is_vice boolean,
  bench_order int
)
language sql
stable
as $$
  select fl.player_id, fl.is_starter, fl.is_captain, fl.is_vice, fl.bench_order
  from fantasy_lineups fl
  where fl.fantasy_team_id = p_team and fl.round_id = p_round
  union all
  -- Dokler rok ni potekel, velja trenutni kader; po roku samo še posnetek.
  select fr.player_id, fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  where fr.fantasy_team_id = p_team
    and exists (
      select 1 from rounds r
      where r.id = p_round
        and (r.deadline_at is null or r.deadline_at > now())
    )
    and not exists (
      select 1 from fantasy_lineups fl
      where fl.fantasy_team_id = p_team and fl.round_id = p_round
    );
$$;

-- Zaklene kroge, ki so zapadli znotraj okna. Starejših se ne dotakne, da se
-- odigrana zgodovina ne posname za nazaj.
create or replace function zakleni_zapadle_kroge(p_okno interval default interval '7 days')
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
    select id from rounds
    where deadline_at is not null
      and deadline_at <= now()
      and deadline_at > now() - p_okno
    order by number
  loop
    v_skupaj := v_skupaj + zakleni_krog(v_krog.id);
  end loop;
  return v_skupaj;
end;
$$;

-- --- urnik ---------------------------------------------------------------
-- pg_cron poganja zaklepanje vsakih pet minut. Če razširitev ni na voljo
-- (npr. v okrnjenem lokalnem stacku), migracija ne pade — zaklepanje se takrat
-- kliče ročno s `select zakleni_zapadle_kroge();`.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'zakleni-zapadle-kroge',
    '*/5 * * * *',
    $urnik$select public.zakleni_zapadle_kroge()$urnik$
  );
  raise notice 'pg_cron: zaklepanje krogov je na urniku vsakih 5 minut';
exception
  when others then
    raise notice 'pg_cron ni na voljo (%) — zaklepanje bo treba klicati ročno', sqlerrm;
end;
$$;
