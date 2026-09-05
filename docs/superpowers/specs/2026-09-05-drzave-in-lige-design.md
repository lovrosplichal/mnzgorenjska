# Države in lige: priprava na več zvez in držav

Datum: 2026-09-05

## Zakaj

Aplikacija danes pokriva eno regijsko zvezo (MNZ Gorenjska) in dve tekmovanji
(člani, mladinci). Cilj je najprej več slovenskih lig, pozneje druge države.
Ta dokument opisuje, kaj je treba pripraviti **zdaj**, in kaj je namenoma
odloženo.

## Kaj obstaja

`competitions` združuje ligo in starostno skupino:

| id | slug | name | mnzg_liga |
|---|---|---|---|
| 1 | clani | 1. GNL — člani | 1601 |
| 2 | mladinci | GNL — mladinci | 1603 |

Nanj kažejo **štiri** tabele: `players`, `rounds`, `fantasy_teams`,
`email_log`.

Na `teams` (klube) kaže **šest**: `appearances`, `goals`, `matches.home_team_id`,
`matches.away_team_id`, `players`, `profiles.insider_team_id`. Klubi so
globalni in ime je globalno unikatno:

```
teams_name_key                UNIQUE (name)
teams_poenostavljeno_ime_idx  UNIQUE (poenostavljeno_ime(name))
```

Zajem podatkov je razpršen po skriptah: `IZVOR = 'https://www.mnzgkranj.si'`
je zapisan v štirih datotekah, naslovi so oblike
`index.cfm?akc=tekmovanja&liga=X`, `zapisnik.mjs` (391 vrstic) razčlenjuje
natanko njihov HTML, `klubi.mjs` pa preslikuje njihova poimenovanja klubov.

## Odločitev: dve ravni, ne tri

**`countries` → `competitions`.** Vmesne ravni (zveza/regija) namenoma **ni**.

Razlog je nesimetričnost popravljivosti. Na `competitions` kažejo štiri
tabele; na morebitno `federations` ne bi kazalo **nič** razen `competitions`.
Dodati vmesno raven pozneje pomeni: nova tabela, en ničelni stolpec, prepis
dveh vrstic. Nič drugega se ne premakne.

Zato vmesna raven ni zavarovanje, ampak prazna struktura: pri dveh
tekmovanjih bi imela eno vrstico, katere edina naloga bi bila hraniti osnovni
naslov. Ko bo Slovenija imela devet MNZ regij in se bo nastavitev vira
ponavljala, jo bomo dvignili — takrat bo oblika znana, ne ugibana.

### Kaj pa je treba narediti zdaj

Dvoje, ker je pozneje **drago**:

**1. Unikatnost imena kluba mora biti vezana na državo.** Trki čez mejo niso
teoretični: Dinamo, Rudar, Sloga, Olimpija obstajajo v več nekdanjih
jugoslovanskih ligah. `teams` je najbolj obremenjena tabela (šest tujih
ključev), na obeh indeksih pa slonita razdruževanje dvojnikov
(`zdruzi-klube.mjs`) in ujemanje klubov ob uvozu. Spreminjati to pri 18
klubih je enostavno, pri 400 ni.

**2. `mnzg_liga` je stolpec enega vira na splošni tabeli.** `1601` in `1603`
sta šifri MNZ Gorenjska. Razdelitev na `source` + `source_league_code` je
zdaj brezplačna (en vir, dve vrstici) in jo bo potreboval vsak nadaljnji vir.

## Shema

```sql
create table countries (
  id         bigint primary key generated always as identity,
  code       text not null unique,      -- ISO 3166-1 alpha-2: 'SI', 'AT', 'HR'
  name       text not null,             -- 'Slovenija'
  sort_order integer not null default 0,
  active     boolean not null default true
);

alter table competitions add column country_id bigint references countries(id);
alter table competitions add column source text;             -- 'mnzg'
alter table competitions add column source_league_code text; -- '1601'
-- mnzg_liga se preseli v source_league_code in odpade

alter table teams add column country_id bigint references countries(id);
-- ime kluba je unikatno ZNOTRAJ države, ne globalno
drop index teams_name_key, teams_poenostavljeno_ime_idx;
create unique index on teams (country_id, name);
create unique index on teams (country_id, poenostavljeno_ime(name));
```

Obstoječi podatki: ena država (`SI`, Slovenija), obe tekmovanji in vseh 18
klubov dobijo njen `country_id`. Za uporabnika se ne spremeni nič.

## Zajem podatkov: vir kot vtičnik

Danes je vir raztresen. Cilj: **en vir = ena mapa**, uvozne skripte pa vira
ne poznajo — dobijo ga iz tekmovanja.

```
scripts/viri/
  mnzg.mjs      # MNZ Gorenjska: naslovi + razčlenjevalnik + imena klubov
  index.mjs     # izbira vira po `competitions.source`
```

Vir izvozi ustaljen vmesnik:

```js
export default {
  ime: 'mnzg',
  osnovniNaslov: 'https://www.mnzgkranj.si',
  naslovRazporeda(liga)          { … },
  naslovSeznamaTekem(liga)       { … },
  naslovDelegiranja(liga, krog)  { … },
  naslovRegistracij()            { … },
  parsirajZapisnik(html, opts)   { … },   // iz zapisnik.mjs
  kljucKluba(ime)                { … },   // iz klubi.mjs
}
```

`zapisnik.mjs` in `klubi.mjs` ostaneta, kjer sta — vir ju samo ovije. Tako
je sprememba majhna in obstoječe skripte se ne prepisujejo na novo.

## Kaj NI del tega

Namenoma odloženo, da se ne gradi na ugibanju:

- **Vmesna raven (zveza/regija)** — glej odločitev zgoraj.
- **Prevodi.** Vsi nizi so slovenski (tako pravi CLAUDE.md). Avstrija pomeni
  nemščino, Hrvaška hrvaščino; to je samostojen projekt čez ~13k vrstic.
- **Točkovanje po ligah.** `tockovanje.ts` je zaenkrat skupen. Če bo katera
  zveza hotela drugačne vrednosti, bo to nastavitev na tekmovanju — in
  zgodovinske točke bodo morale vedeti, po katerih pravilih so nastale.
- **Drugi vir (AT/HR).** Ta dokument pripravi *strukturo*; vsak nov vir je
  svoj projekt, ker je razčlenjevalnik HTML-a vsakič nov.

## Preverjanje

- `npm run testno-okolje && npm test` — 41 trditev, mora ostati zeleno.
- Migracija se preizkusi na **produkcijskem posnetku** (808 klubov/igralcev,
  ki sem jih prenesel lokalno), ne le na demo podatkih — sprememba
  unikatnega indeksa mora preživeti resnična imena klubov.
- `npm run smoke`, `npm run typecheck`, `npm run build`.
- Uvoz mora po spremembi teči enako: `node scripts/uvoz-zapisnikov.mjs`
  proti lokalni bazi da enak rezultat kot prej.
