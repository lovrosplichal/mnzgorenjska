-- Cena se premakne samo za krog, ki je bil res odigran — in takrat, ko je bil.
--
-- Prejšnja migracija je borzi vzela arhivske sezone, kar je odpravilo konkretno
-- nesrečo. Pravilo pa mora biti splošno: nakopičeni krogi se NE obračunavajo za
-- nazaj. Če cron teden dni ne teče, ali če kdo uvozi kup zapisnikov naenkrat,
-- se cene ne smejo premakniti desetkrat v eni noči — kdor je ekipo sestavil
-- včeraj, bi se zbudil v drug trg, ne da bi se karkoli odigralo.
--
-- Isto načelo že velja za posnetke postav: `zakleni_zapadle_kroge` zaklene le
-- kroge, ki so zapadli znotraj okna, starejši pa so zgodovina. Borza dobi zdaj
-- enako okno.
--
-- Skupaj torej krog premakne ceno le, če:
--   1. je iz zadnje sezone tekmovanja (arhiv ni trg),
--   2. je vsaj `competitions.prvi_fantasy_krog`,
--   3. je bil DEJANSKO odigran — ima vsaj eno uvoženo tekmo,
--   4. je bil odigran pred kratkim (privzeto 14 dni).

-- --------------------------------------------------------------------------
-- 1. Neodigran krog cene ne premakne
-- --------------------------------------------------------------------------
-- Točke lahko za krog obstajajo tudi, kadar so bile pravkar preračunane zaradi
-- spremenjene pozicije; šele uvožena tekma pa pomeni, da se je res igralo.
create or replace function krog_je_odigran(p_round_id bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from matches m
    where m.round_id = p_round_id and m.imported_at is not null
  );
$$;

comment on function krog_je_odigran(bigint) is
  'Ali ima krog vsaj eno uvoženo tekmo — torej se je res igralo.';

-- --------------------------------------------------------------------------
-- 2. Preračun cen zavrne neodigran krog
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

  -- Brez odigrane tekme ni premika cene.
  if not krog_je_odigran(p_round_id) then
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
-- 3. Cron gleda samo sveže odigrane kroge
-- --------------------------------------------------------------------------
-- Staro različico brez argumenta je treba odvreči, sicer ostaneta dve in klic
-- `uveljavi_zapadle_cene()` postane dvoumen — natanko to se je že zgodilo pri
-- zaklepanju krogov (migracija 20260828161000).
drop function if exists uveljavi_zapadle_cene();
drop function if exists uveljavi_zapadle_cene(interval);
create function uveljavi_zapadle_cene(p_okno interval default interval '14 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_krog record;
  v_skupaj int := 0;
  v_preskocenih int := 0;
begin
  for v_krog in
    select r.id, r.season, r.number, r.played_on
    from rounds r
    join competitions c on c.id = r.competition_id
    where r.number >= c.prvi_fantasy_krog
      and krog_je_odigran(r.id)
      and not exists (select 1 from price_changes pc where pc.round_id = r.id)
      and r.season = (
        select max(r2.season) from rounds r2 where r2.competition_id = r.competition_id
      )
    order by r.season, r.number
  loop
    -- Krog, ki je bil odigran pred več kot oknom, je zgodovina. Cene zanj ne
    -- popravljamo za nazaj — trg naj se premika sproti, ne v skokih.
    if v_krog.played_on is not null
       and v_krog.played_on < (current_date - p_okno) then
      v_preskocenih := v_preskocenih + 1;
      continue;
    end if;
    v_skupaj := v_skupaj + uveljavi_cene(v_krog.id);
  end loop;

  if v_preskocenih > 0 then
    raise notice 'borza je preskočila % starih krogov (zunaj okna %)',
      v_preskocenih, p_okno;
  end if;
  return v_skupaj;
end;
$$;
