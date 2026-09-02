-- Podvajanje tekem v razporedu — čiščenje in preprečitev, da se spet zgodi
--
-- Zakaj: ko sta bila v teams dve vrstici za Bled-Bohinj (id 8 "Bled - Bohinj
-- Hirter" in id 15 "Bled Bohinj Hirter" — MNZ je klub v enem zapisniku
-- zapisal s pomišljajem, v drugem brez), sta bili v matches dve vrstici za
-- ISTO tekmo istega kroga. Po združitvi na id 8 sta obe kazali na isti klub
-- in postali podvojeni. Skripta uvoz-razporeda.mjs pred vstavljanjem preveri
-- obstoj z .maybeSingle() — ker vrne dva zadetka, klic pade z napako in
-- pomotoma sklepa, da tekma še ne obstaja. Vsak zagon zato doda še eno
-- kopijo, in skupaj so v produkciji nastale 4 identične vrstice na krog za
-- vsako Bled-Bohinjovo tekmo (3 dodatne).
--
-- Nobena od podvojenih vrstic ni imela zapisnika (played_on IS NULL,
-- zapisnik_id IS NULL) — vse gre za še neodigran razpored. Zato je varno
-- pobrisati vse razen najzgodnejše po id-ju, ki jo je uvoz sprva vstavil.
-- Odigrane tekme (z zapisnikom) se ne dotikamo, ker imajo pripete nastope
-- in gole; tak duplikat se z UVOZ-om itak ne pojavi, ker se tam preveri po
-- zapisnik_id.

delete from matches m
where m.zapisnik_id is null
  and exists (
    select 1 from matches drugi
    where drugi.round_id = m.round_id
      and drugi.home_team_id = m.home_team_id
      and drugi.away_team_id = m.away_team_id
      and drugi.id < m.id
  );

-- Unique index prepreči, da se to spet zgodi — tudi če bi klub kdaj ponovno
-- prišel v podvojenem zapisu (in bi kdo naredil merge), skripta bo padla na
-- vstavljanju in ne bo mogla naredila mesa. Popravljena logika v skripti
-- (edinstveno branje) je drugi obroč zaščite; ta index je varovalka.
create unique index if not exists matches_krog_klub_klub_key
  on matches (round_id, home_team_id, away_team_id);
