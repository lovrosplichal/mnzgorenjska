-- En klub, en zapis.
--
-- Zapisnik in razpored isti klub pišeta različno ("Bled Bohinj Hirter" proti
-- "Bled - Bohinj Hirter"). Uvoz zapisnikov je klub iskal po natančnem imenu in
-- je ob prvem zapisniku nove sezone ustvaril drugi zapis istega kluba; sezona
-- se je razklala na dva — grb in lanska zgodovina pri enem, letošnji nastopi
-- pri drugem. Uvoz je popravljen, tu pa to zaklenemo še v bazi, da napaka ne
-- more nastati po nobeni poti.
--
-- Ime primerjamo poenostavljeno: brez ločil, brez velikih črk, brez odvečnih
-- presledkov — enako kot uvoz.
--
-- POZOR: indeksa ni mogoče ustvariti, dokler v bazi obstajata dva zapisa
-- istega kluba. Najprej poženi `node scripts/zdruzi-klube.mjs --pisi`.

create or replace function poenostavljeno_ime(p_ime text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(p_ime, '[^[:alnum:]]+', ' ', 'g')));
$$;

comment on function poenostavljeno_ime(text) is
  'Ime brez ločil in velikih črk — za primerjavo imen klubov iz različnih virov.';

create unique index if not exists teams_poenostavljeno_ime_idx
  on teams (poenostavljeno_ime(name));
