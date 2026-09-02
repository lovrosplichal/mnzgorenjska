-- Pozicije se premaknejo enkrat na teden, vse naenkrat.
--
-- Doslej je vsak oddan glas takoj poklical `potrdi_pozicijo` in pozicija se je
-- lahko premaknila sredi tedna, kadarkoli. To pomeni, da se je liga pod prsti
-- spreminjala: igralec, ki si ga v sredo gledal kot branilca, je bil v četrtek
-- napadalec, gol mu je bil vreden drugače, točke in s tem lestvica pa so se
-- premaknile brez vidnega povoda.
--
-- Odslej se glasovi zbirajo ves teden, uveljavijo pa se v enem zamahu v
-- ponedeljek zjutraj — po tem, ko so vikendovi zapisniki že uvoženi, in pred
-- osveževanjem cen, ker pozicija določa vrednost gola in s tem formo, po
-- kateri se premika cena.
--
-- Preostali del tedna je liga mirna: kar vidiš v torek, velja tudi v soboto,
-- ko se zaklene krog.
--
-- Zapisnik (vratar) in ročni popravek administratorja učinkujeta takoj —
-- prvi je dejstvo iz uradnega vira, drugi pa namerno dejanje človeka.

-- --------------------------------------------------------------------------
-- 1. Glas ne premakne pozicije več sam
-- --------------------------------------------------------------------------
drop trigger if exists position_votes_potrdi on position_votes;

comment on function trg_position_vote() is
  'Ni več v rabi kot sprožilec — pozicije uveljavi tedensko uveljavi_pozicije().';

-- --------------------------------------------------------------------------
-- 2. Tedenska uveljavitev
-- --------------------------------------------------------------------------
create or replace function uveljavi_pozicije()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igralec record;
  v_pred text;
  v_spremenjenih int := 0;
begin
  for v_igralec in
    select distinct pv.player_id from position_votes pv
  loop
    select position into v_pred from players where id = v_igralec.player_id;
    perform potrdi_pozicijo(v_igralec.player_id);
    if (select position from players where id = v_igralec.player_id)
       is distinct from v_pred then
      v_spremenjenih := v_spremenjenih + 1;
    end if;
  end loop;
  return v_spremenjenih;
end;
$$;

comment on function uveljavi_pozicije() is
  'Uveljavi vse izglasovane pozicije naenkrat. Teče v ponedeljek zjutraj, '
  'pred osveževanjem cen.';

-- --------------------------------------------------------------------------
-- 3. Kdo čaka na ponedeljek
-- --------------------------------------------------------------------------
-- Stran s pozicijami mora znati povedati "izglasovano, uveljavi se v
-- ponedeljek" — sicer uporabnik vidi zbran prag in nič se ne zgodi, kar je
-- videti kot okvara.
create or replace view pozicije_v_cakanju as
select
  p.id as player_id,
  p.full_name,
  p.competition_id,
  p.team_id,
  p.position as trenutna,
  v.position as izglasovana,
  v.weight as utez,
  v.votes as glasov,
  adaptivni_prag(p.id, v.position) as prag
from players p
join lateral (
  select pvw.position, pvw.weight, pvw.votes
  from position_vote_weights pvw
  where pvw.player_id = p.id
  order by pvw.weight desc
  limit 1
) v on true
where p.position_source not in ('zapisnik', 'admin')
  and v.weight >= adaptivni_prag(p.id, v.position)
  and p.position is distinct from v.position;

-- --------------------------------------------------------------------------
-- 4. Urnik
-- --------------------------------------------------------------------------
-- Ponedeljek ob 02:00 UTC: vikendovi zapisniki so uvoženi (uvoz teče vsako uro
-- ob koncu tedna), cene pa se osvežijo ob 03:30 — pozicije torej pridejo prve.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('uveljavi-pozicije');
exception
  when others then null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'uveljavi-pozicije',
    '0 2 * * 1',
    $urnik$select public.uveljavi_pozicije()$urnik$
  );
  raise notice 'pg_cron: pozicije se uveljavijo v ponedeljek ob 02:00 UTC';
exception
  when others then
    raise notice 'pg_cron ni na voljo (%) — pozicije je treba uveljaviti ročno', sqlerrm;
end;
$$;
