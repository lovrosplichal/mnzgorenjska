-- Borza mora ceno tudi uveljaviti, ne le zapisati.
--
-- `uveljavi_cene` naredi dvoje: preračuna premike (zapis v `price_changes`) in
-- jih prepiše v `players.value`. `uveljavi_zapadle_cene` pa je krog preskočila,
-- če je zanj že obstajal zapis o premiku. Če je torej prvi korak uspel, drugi
-- pa ne — ali če je cene pozneje povozila skripta za vrednotenje, ki jih
-- zaokroži na polovice — krog ni bil nikoli več v obravnavi in cena je za
-- vedno ostala pri stari.
--
-- Tako se je zgodilo pri članih: za 1. krog 2026/27 je bilo zapisanih 324
-- premikov, uveljavljen ni bil niti eden. Igralec je na svoji strani kazal
-- podražitev na 4.3, v glavi pa ceno 4.0.
--
-- Odslej pogoj ni "krog še nima zapisov", ampak "krog je primeren za trg".
-- Ponovni zagon ni nevaren: `preracunaj_cene` igralca, ki za ta krog že ima
-- zapis, preskoči, prepis v `players.value` pa je idempotenten.

-- --------------------------------------------------------------------------
-- 1. Prepis cene ne povozi ročno zaklenjene
-- --------------------------------------------------------------------------
create or replace function uveljavi_cene(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spremenjenih int;
begin
  perform preracunaj_cene(p_round_id);

  update players p
     set value = pc.new_value
    from price_changes pc
   where pc.player_id = p.id
     and pc.round_id = p_round_id
     and not p.value_locked
     and p.value <> pc.new_value;

  get diagnostics v_spremenjenih = row_count;
  return v_spremenjenih;
end;
$$;

-- --------------------------------------------------------------------------
-- 2. Arhivski premiki, ki jih ne bi smelo biti
-- --------------------------------------------------------------------------
-- Isti zaplet kot pri mladincih: uvožena prejšnja sezona ima točke po krogih,
-- borza pa jih je obračunala. Pri članih ti premiki nikoli niso bili
-- uveljavljeni (nobena cena ni imela decimalke razen .0 in .5), so pa kazili
-- zgodovino in računanje zadnjega stanja. Pobrišemo jih; tekoča sezona ostane.
delete from price_changes pc
using rounds r
where r.id = pc.round_id
  and r.season <> (
    select max(r2.season) from rounds r2 where r2.competition_id = r.competition_id
  );

-- --------------------------------------------------------------------------
-- 3. Cron ne preskoči kroga, ki čaka na uveljavitev
-- --------------------------------------------------------------------------
create or replace function uveljavi_zapadle_cene(p_okno interval default interval '14 days')
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
      and r.season = (
        select max(r2.season) from rounds r2 where r2.competition_id = r.competition_id
      )
    order by r.season, r.number
  loop
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
