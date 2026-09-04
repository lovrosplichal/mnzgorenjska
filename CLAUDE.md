# CLAUDE.md

Navodila za Claude Code pri delu na tem projektu.

## O projektu

Fantasy football aplikacija za 1. Gorenjsko nogometno ligo (MNZG Kranj). Pokriva
dve tekmovanji — **člane** in **mladince** — vsako s svojimi igralci, krogi,
ekipami in lestvico. Uporabniki sestavljajo fantasy ekipe iz realnih igralcev
znotraj proračuna in tekmujejo na skupni lestvici svoje lige.

Točke temeljijo na uradni statistiki iz zapisnikov MNZ Gorenjska. Skupnost z glasovanjem
določi le tisto, česar zapisnik ne pove: **asistence** in **pozicije** (zapisnik označi le
vratarja z (V), postave pa našteje po številkah dresov). Prag je 5 glasov.

## Tehnološki sklop

- Frontend: React + Vite + Tailwind CSS, **postopno v TypeScriptu**
- Backend / baza / avtentikacija: Supabase (PostgreSQL)
- Gostovanje: Vercel + Supabase

Lokalni razvoj teče na Supabase CLI stacku v Dockerju (`npx supabase start`).

## Dve ligi

`competitions` (`clani`, `mladinci`) nosita tri tabele, vse ostalo se izpelje:

- `rounds.competition_id` → krog in z njim tekme, goli, nastopi
- `players.competition_id` → mladinec in član sta **dve vrstici**, tudi če gre
  za isto osebo; prehod med selekcijama tako ne povleče statistike in cene
- `fantasy_teams.competition_id` → vsak ima lahko po eno ekipo v vsaki ligi

`teams` (klubi) so **skupni** — Šenčur je isti klub, ne glede na selekcijo.
Vir isti klub piše različno ("Eltron Preddvor" pri članih, "Preddvor SP Avto"
pri mladincih), zato uvoz imena preslika v `scripts/klubi.mjs`. Kateri klub
igra v kateri ligi, pove pogled `competition_teams`.

`competitions.prvi_fantasy_krog` pove, od katerega kroga liga šteje za fantasy
(mladinci od 2., ker se do takrat še vrstijo prestopi in prehodi med člane).
Vsi pogledi imajo stolpec `competition_id`; vmesnik izbrano ligo hrani v
`src/lib/tekmovanje.tsx` in jo doda v naslov kot `?t=mladinci`.

Uvozne skripte sprejmejo `--tekmovanje mladinci` (privzeto `clani`).

## Glavni koncepti podatkovnega modela

- `players` → realni igralci, vezani na realni klub (`teams`) in tekmovanje
- `fantasy_teams` → ekipe uporabnikov, `fantasy_roster` → izbrani igralci
  (`is_starter`, `is_captain`, `is_vice`, `bench_order`)
- `fantasy_chips` → vloženi pripomočki (zaenkrat le `klop_plus`, enkrat na sezono)
- `fantasy_lineups` → posnetek postave po krogih; nastane s `zakleni_krog(krog)`
  oz. `zakleni_zapadle_kroge()` (za cron). Točkovanje bere posnetek, če obstaja.
- `rounds` → krogi sezone, `matches` → tekme (z izvorom `zapisnik_id`)
- `appearances` → nastop igralca na tekmi (minute, goli, kartoni, prejeti goli)
- `goals` → posamezen gol; nosi tudi potrjeno asistenco
- `assist_votes`, `position_votes` → glasovanje skupnosti (prag v `settings`)
- `player_scores` → točke igralca na krog (iz pogleda `appearance_points`);
  posnetek se osveži sam, ko se spremeni pozicija igralca ali potrdi asistenca
  — pozicija odloča, koliko je vreden gol, zato bi brez tega lestvica kazala
  stanje ob uvozu, ko je pozicijo poznal samo vratar
- `ucinkovita_postava(ekipa, krog)` → postava po samodejnih menjavah z množitelji;
  iz nje računata `fantasy_round_points` in `fantasy_team_standings`
- `player_standings` → lestvica igralcev (točke, forma, na tekmo, izbranost)
- stran Rezultati (`/rezultati`, `/tekma/:id`) sestavi postavi tekme iz
  `appearances` + `appearance_points`; nove sheme ne potrebuje
- `match_assist_status` → odigrane tekme s številom golov brez asistence
  (stran Asistence izbira po korakih: krog → tekma → gol)
- `naslednji_krog` → prvi krog, ki se še ni zaklenil (rok na strani Moja ekipa)
- `teams.logo_url` → grb kluba; če je prazen, `src/components/Grb.jsx` nariše
  ščit z začetnicami

## Smernice za razvoj

- Vsi uporabniško vidni nizi naj bodo v **slovenščini**.
- Ohrani kodo preprosto in berljivo; to je skupnostni projekt, ne enterprise.
- Preden dodaš novo odvisnost, preveri ali je res potrebna.
- Ob spremembi podatkovnega modela posodobi tudi README in to datoteko.

## TypeScript

Ves `src/` je TypeScript (`strict`). `allowJs` ostaja vklopljen samo zato, da
skripte iz `scripts/` lahko uvazajo iz `src/lib` — v `src/` ni vec nobene
`.js` ali `.jsx` datoteke.

**Tailwind mora poznati `.ts`/`.tsx`.** V `tailwind.config.js` je `content`
`['./index.html', './src/**/*.{js,jsx,ts,tsx}']`. Ce se koncnica izgubi,
Tailwind razredov iz teh datotek ne najde in jih izpusti iz CSS — build,
`npm run typecheck` in `npm run smoke` ostanejo zeleni, stran pa je brez
slogov. To se je med migracijo ze zgodilo.

- Tipe vrstic **ne piši na roko** — generira jih baza:
  `npm run tipi` zapiše `src/lib/baza.types.ts` iz lokalnih migracij.
  Po vsaki novi migraciji jo poženi znova in datoteke ne popravljaj ročno.
- `supabase` odjemalec je tipiziran z `Database`, zato napačno ime tabele
  javi napako že pri `npm run typecheck`.
- Pojmi, ki jih shema ne pozna (`Pozicija`, `IgralecVKadru` …), so v
  `src/lib/tipi.ts`.
- Uvozne skripte (`scripts/*.mjs`) ostajajo v JavaScriptu. Node 26 zna brati
  `.ts` neposredno, zato smejo uvažati iz `src/lib` (glej `zdruzi-klube.mjs`).

## Ukazi

```bash
npm install         # namestitev odvisnosti
npx supabase start  # lokalna baza (Docker)
npm run dev         # razvojni strežnik
npm run build       # produkcijski build
npm test            # e2e test proti bazi (RLS, glasovanje, točke, lestvica)
npm run smoke       # izris vseh strani + pravila ekipe, brez brskalnika
npm run typecheck   # preverjanje tipov (tsc --noEmit)
npm run tipi        # regeneriraj src/lib/baza.types.ts iz lokalne baze
```

`npm test` naj teče s `SUPABASE_SERVICE_ROLE_KEY` v okolju — brez njega ne more
povrniti asistence in pozicije, ki ju potrdi z glasovi, in naslednji zagon pade.

`npm test` je idempotenten — poganjaj ga zaporedoma, kolikorkrat hočeš.
Da tak tudi ostane, veljata dve pravili:

- **Vsak `.limit(1)` potrebuje `.order(...)`.** Brez njega Postgres vrne
  poljubno vrstico in test dobi vsakič drugega igralca ali krog: enkrat pade,
  drugič ne, koda pa je ves čas ista. Pri krogih `.order('number')` ni dovolj —
  številko 1 ima vsaka sezona, zato filtriraj še po `deadline_at`.
- **Kar test spremeni, mora tudi povrniti.** Posebej `zakleni_krog` naredi
  posnetke postav za vse ekipe; e2e si zapomni čas zaklepa in jih ob koncu
  pobriše, sicer naslednji zagon kroga ne vidi več kot "brez posnetka".

Testno okolje mora imeti uvoženo **tekočo** sezono, ne le arhiva:
`preracunaj_igralca` osveži samo kroge znotraj okna (14 dni, migracija
20260902110000), zato na sami arhivski sezoni točke ne dohitijo pozicije.
`npm run testno-okolje` poskrbi za oboje.

Uvoz podatkov (vsi sprejmejo `SUPABASE_URL` za projekt v oblaku):

```bash
node scripts/uvoz-zapisnikov.mjs --liga 1502         # arhiv (za cene igralcev)
node scripts/uvoz-zapisnikov.mjs                     # rezultati tekoče sezone
node scripts/uvoz-razporeda.mjs --pisi               # krogi in tekme z datumi
node scripts/ugani-pozicije.mjs --pisi               # ugibanje pozicij
node scripts/ovrednoti-igralce.mjs                   # cene igralcev
node scripts/prenesi-grbe.mjs --pisi                 # grbi klubov
```

Isto zaporedje za mladince — `--tekmovanje mladinci`, arhiv je `--liga 1503`:

```bash
node scripts/uvoz-zapisnikov.mjs --tekmovanje mladinci --liga 1503
node scripts/uvoz-zapisnikov.mjs --tekmovanje mladinci
node scripts/uvoz-razporeda.mjs  --tekmovanje mladinci --pisi
node scripts/ugani-pozicije.mjs  --tekmovanje mladinci --pisi
node scripts/ovrednoti-igralce.mjs --tekmovanje mladinci --sezona 2025/26
```

Brez `--liga` skripte vzamejo šifro tekoče sezone iz `competitions.mnzg_liga`
— ob novi sezoni je treba posodobiti njo, ne skript. `uvoz-razporeda` iz
razporeda razbere, kateri klubi letos igrajo, in igralce klubov zunaj lige
deaktivira (pri mladincih vsako leto odide cela generacija).

## Preverjanje sprememb

- Po spremembi kode poženi `npm run smoke`.
- Po spremembi sheme ali RLS poženi še `npm test`.
- Ob spremembi podatkovnega modela **dodaj novo migracijo** v `supabase/migrations/`;
  obstoječih migracij ne spreminjaj, ker so že uporabljene.
- Pravila sestave ekipe so na enem mestu v `src/lib/pravila.ts` — spreminjaj jih tam,
  ne razpršeno po komponentah.
- Vsaka nova poizvedba na strani mora filtrirati po `competition_id`, sicer
  stran pokaže obe ligi hkrati. `useTekmovanje().id` je `null`, dokler se
  seznam lig ne naloži — do takrat naj stran ne poizveduje.
- Statistika igralca v `player_overview` je seštevek **vseh** sezon. Kjer gre za
  tekočo sezono (trg v Moji ekipi, naslovnica, stran Igralci), beri
  `player_season_standings` s filtrom na sezono; lanska sezona je le zgodovina
  in izhodišče za ceno.
- Na trg sodijo samo aktivni igralci (`player_overview.active`) — kader z
  neaktivnim igralcem `roster_je_veljaven` zavrne in ekipa tiho ostane brez točk.
