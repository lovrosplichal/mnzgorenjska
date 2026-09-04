# Gorenjska Fantasy Liga ⚽

Fantasy football aplikacija za **1. Gorenjsko nogometno ligo (MNZG Kranj)**. Pokriva dve ligi — **člane** in **mladince** — vsako s svojimi igralci, krogi, ekipami in lestvico. Uporabniki sestavljajo svoje ekipe iz realnih igralcev lige in zbirajo točke po uradni statistiki zapisnikov.

## Ideja

Točke izhajajo iz **uradnih zapisnikov MNZ Gorenjska** — goli, minute, ohranjene
mreže, kartoni, enajstmetrovke. Zapisniki pa dveh stvari ne povedo, zato ju
določi **skupnost z glasovanjem**:

1. **kdo je podal asistenco** za posamezni gol,
2. **na katerem mestu igralec igra** — zapisnik označi le vratarja z `(V)`,
   postave pa našteje po številkah dresov, ne po pozicijah.

Pri **5 glasovih** za istega kandidata se podatek potrdi in začne šteti.

## Ključne funkcionalnosti

- **Sestavljanje ekipe** — igrišče s prvo postavo in klopjo: 15 igralcev (2 vratarja,
  5 branilcev, 5 vezistov, 3 napadalci), 11 v prvi postavi, največ 3 iz kluba, proračun 100.
- **Kapetan** — trak prinese trojne točke; če kapetan ne igra, ga prevzame namestnik.
- **Samodejne menjave** — igralca prve postave brez minut zamenja rezervni iste pozicije.
- **Pripomoček Klop+** — enkrat na sezono v izbranem krogu štejejo tudi točke klopi.
- **Glasovanje o asistencah** — skupnost pove, kdo je podal; pri 5 glasovih se potrdi.
- **Glasovanje o pozicijah** — zapisnik pozicij ne pove, zato jih določi skupnost.
- **Točkovanje** — po pravilih lige iz statistike zapisnikov (glej spodaj).
- **Rezultati** — odigrane tekme; klik na tekmo pokaže obe postavi na igrišču in
  točke, ki jih je posamezen igralec na njej zaslužil.
- **Lestvica** — skupna razvrstitev vseh fantasy ekip lige.
- **Dve ligi** — v glavi se preklaplja med člani in mladinci; vsaka liga ima svoje igralce, svojo ekipo in svojo lestvico.
- **Uporabniški računi** — registracija in prijava z e-pošto in geslom.
- **Pregled kluba/igralcev** — seznam ekip in igralcev 1. GNL.
- **Administracija** — pregled nepopolnih zapisnikov, ročne pozicije, NZS podatki, preračun točk.

## Tehnološki sklop

- **Frontend:** React 18 + Vite + React Router
- **Backend / baza:** Supabase (PostgreSQL + avtentikacija + PostgREST)
- **Slog:** Tailwind CSS
- **Gostovanje:** Vercel (frontend) + Supabase (baza)

## Točkovanje

| | Točke |
|---|---|
| Nastop do 60 minut | +1 |
| Odigranih 60 minut ali več (brez sodniškega podaljška) | +2 |
| Gol vratarja / branilca / vezista / napadalca | +10 / +6 / +5 / +4 |
| Asistenca | +3 |
| Brez prejetega gola (vsaj 60 min) — vratar, branilec | +4 |
| Brez prejetega gola (vsaj 60 min) — vezist | +1 |
| Vsaka 2 prejeta gola — vratar, branilec | −1 |
| Obranjena enajstmetrovka | +5 |
| Zgrešena enajstmetrovka | −2 |
| Avtogol | −2 |
| Rumeni karton | −1 |
| Rdeči karton | −3 |

Pravila so na enem mestu v [`src/lib/tockovanje.js`](src/lib/tockovanje.js)
(prikaz) in v funkciji `tocke_za_nastop` (izračun v bazi). Vsako pravilo
pokriva test v `npm run smoke`.

## Vrednost igralcev

Cena (4.0–12.0) se izračuna iz statistike prejšnje sezone: goli na 90 minut,
delež tekem brez prejetega gola, rednost nastopanja in disciplina. Igralci z
manj kot 270 minutami dobijo privzeto ceno, da jih en dober nastop ne preceni.

> Vrednotenje namenoma **ne** izhaja iz fantasy točk, ker so te odvisne od
> pozicije — dokler skupnost pozicij ne izglasuje, bi to precenilo vratarje
> (edine z znano pozicijo iz zapisnika).

Administrator lahko doda podatke z NZS (najvišja odigrana liga in minute v njej),
kar ceno dvigne. Iskalnik NZS je v `robots.txt` prepovedan robotom, zato se ti
podatki vnesejo ročno v Administraciji.

## Pravila ekipe

Določena so v [`src/lib/pravila.js`](src/lib/pravila.js), da so na enem mestu:

| Pravilo | Vrednost |
|---|---|
| Velikost ekipe | 15 igralcev |
| Vratarji v kadru | 2 |
| Branilci v kadru | 5 |
| Vezisti v kadru | 5 |
| Napadalci v kadru | 3 |
| Prva postava | 11 igralcev |
| Vratarji v prvi postavi | 1 |
| Branilci v prvi postavi | 3–5 |
| Vezisti v prvi postavi | 2–5 |
| Napadalci v prvi postavi | 1–3 |
| Največ igralcev iz istega kluba | 3 |
| Proračun | 100.0 |
| Množitelj kapetana | 3× |
| Pripomoček Klop+ | enkrat na sezono |
| Rok kroga | `rounds.deadline_at` (privzeto 10:00 na dan tekme) |

Kvota kadra je enaka kot v Premier League Fantasy. Točke zbira prva postava; igralca
brez odigrane minute samodejno zamenja rezervni igralec iste pozicije, kapetan pa šteje
trikratno. V krogu, za katerega je vložen Klop+, se prištejejo še točke vseh štirih
rezervnih igralcev.

## Podatkovni model

| Tabela | Opis |
|---|---|
| `profiles` | Profili uporabnikov, zastavica `is_admin` |
| `competitions` | Ligi: `clani` in `mladinci` (šifra vira, prvi fantasy krog) |
| `teams` | Klubi — **skupni** obema ligama (grb, ime) |
| `players` | Igralci ene lige (cena, pozicija, vir pozicije); ista oseba je v obeh ligah dve vrstici |
| `rounds` / `matches` | Krogi in tekme (z izvorom: `zapisnik_id`, `source_url`) |
| `appearances` | Nastop igralca na tekmi: minute, goli, kartoni, prejeti goli |
| `goals` | Posamezni gol (strelec, minuta, 11m, avtogol, potrjena asistenca) |
| `assist_votes` | Glasovi skupnosti o asistenci |
| `position_votes` | Glasovi skupnosti o poziciji |
| `fantasy_teams` / `fantasy_roster` | Ekipe uporabnikov in njihovi nabori (kapetan, namestnik, vrstni red klopi) |
| `fantasy_chips` | Vloženi pripomočki ekipe (`klop_plus`) |
| `fantasy_lineups` | Posnetek postave ob roku kroga — po njem preteklih krogov ni več mogoče popravljati |
| `teams.logo_url` | Grb kluba; brez njega aplikacija nariše ščit z začetnicami |
| `player_scores` | Točke igralca po krogih |
| `settings` | Pragova glasov (privzeto 5) |

Vsi pogledi imajo stolpec `competition_id` — vmesnik po njem filtrira izbrano
ligo. Pogled `competition_teams` pove, kateri klubi igrajo v kateri ligi.

Pogledi: `appearance_points` (točke nastopa),
`player_overview`, `player_season_stats`,
`player_standings` (lestvica igralcev: točke, forma, na tekmo, izbranost),
`minute_kroga`, `fantasy_round_points` (točke ekipe po krogih, z menjavami in kapetanom),
`fantasy_team_standings`, `fantasy_team_budget`.
Funkcija `ucinkovita_postava(ekipa, krog)` vrne igralce, ki v krogu dejansko prinesejo
točke, in njihov množitelj.

### Varnost (RLS)

- Klubi, igralci, krogi, točke in lestvica so **javno berljivi**.
- Glasovi o asistencah in pozicijah so **javno vidni** (skupnost vidi napredek do praga), oddati pa jih je mogoče **le v svojem imenu**.
- Asistenco in pozicijo potrdi **sprožilec v bazi**, ne odjemalec — praga ni mogoče obiti iz brskalnika.
- Fantasy ekipo in nabor ureja **le lastnik**.
- Kroge, klube in igralce urejajo **le administratorji** (`profiles.is_admin`).

## Zagon lokalno

Potrebuješ **Node.js 20+** in **Docker** (za lokalni Supabase stack).

```bash
# 1. namesti odvisnosti
npm install

# 2. zaženi lokalni Supabase (PostgreSQL + Auth + API + Studio)
#    prvič potegne nekaj GB Docker slik
npx supabase start

# 3. nastavi okoljske spremenljivke
cp .env.example .env
#    URL in anon ključ izpiše `npx supabase status`

# 4. napolni testno okolje (zapisniki, pozicije, demo ekipe)
npm run testno-okolje

# 5. zaženi razvojni strežnik
npm run dev
```

Aplikacija teče na <http://localhost:5173>, Supabase Studio na <http://localhost:54323>,
prestreženo e-pošto pa vidiš v Mailpitu na <http://localhost:54324>.

Migracije iz `supabase/migrations/` se ob `supabase start` (oz. `npm run db:reset`)
uporabijo samodejno. `supabase/seed.sql` vsebuje le demo podatke za prvi zagon —
za prave podatke uporabi uvoz spodaj.

### Uvoz pravih podatkov

```bash
export SUPABASE_SERVICE_ROLE_KEY=$(npx supabase status -o json | jq -r .SERVICE_ROLE_KEY)

# ČLANI (privzeto tekmovanje)
node scripts/uvoz-zapisnikov.mjs --liga 1502 --pocisti  # lanski arhiv, brez demo podatkov
node scripts/uvoz-zapisnikov.mjs                        # rezultati tekoče sezone
node scripts/uvoz-razporeda.mjs --pisi                  # krogi, tekme in roki
node scripts/ugani-pozicije.mjs --pisi                  # ugibanje pozicij
node scripts/ovrednoti-igralce.mjs                      # cene iz statistike

# MLADINCI — isto zaporedje z --tekmovanje mladinci
node scripts/uvoz-zapisnikov.mjs  --tekmovanje mladinci --liga 1503
node scripts/uvoz-zapisnikov.mjs  --tekmovanje mladinci
node scripts/uvoz-razporeda.mjs   --tekmovanje mladinci --pisi
node scripts/ugani-pozicije.mjs   --tekmovanje mladinci --pisi
node scripts/ovrednoti-igralce.mjs --tekmovanje mladinci --sezona 2025/26
```

Šifra lige na mnzgkranj.si: člani 2025/26 = `1502`, 2026/27 = `1601`;
mladinci 2025/26 = `1503`, 2026/27 = `1603`. Brez `--liga` skripta vzame
tekočo sezono iz `competitions.mnzg_liga`, tako da je ob novi sezoni treba
posodobiti bazo, ne skript. Prenesene strani se predpomnijo v
`scripts/.predpomnilnik/`, da ponovni uvoz ne obremenjuje strani MNZ.

Mladinci vsako leto zamenjajo generacijo — kdor ni več dovolj star, gre med
člane. `uvoz-razporeda` zato iz razporeda razbere, kateri klubi letos igrajo,
in igralce klubov zunaj lige deaktivira, da ne ostanejo na trgu.

Zapisniki so vnešeni ročno in so občasno pomanjkljivi (manjkajoča oznaka
vratarja, postava z 10 igralci). Uvoz jih vseeno prevzame, opozorila pa zapiše
v `matches.import_warnings` in jih pokaže v Administraciji.

## Ukazi

| Ukaz | Opis |
|---|---|
| `npm run dev` | razvojni strežnik |
| `npm run build` | produkcijski build |
| `npm run preview` | predogled builda |
| `npm test` | end-to-end test proti bazi (RLS, glasovanje, pragovi, točkovanje, proračun) |
| `npm run smoke` | izris vseh strani + vsa pravila točkovanja in sestave ekipe |
| `npm run db:start` / `db:stop` | zagon/ustavitev lokalnega Supabase |
| `npm run db:reset` | ponovna uporaba migracij in seed podatkov |
| `npm run testno-okolje` | postavi testno bazo od nule: reset + uvoz + pozicije + demo ekipe |
| `npm run typecheck` | preverjanje tipov (TypeScript) |
| `npm run tipi` | regeneracija `src/lib/baza.types.ts` iz lokalne baze |

## Okoljske spremenljivke

Ustvari `.env` datoteko (glej `.env.example`) — za **lokalni** razvoj vpiši
vrednosti, ki jih izpiše `npx supabase status`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_...    # lokalni, ne produkcijski
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...      # samo lokalno; rabita ga npm test in uvoz
```

`.env` je v `.gitignore` in ne sme v repozitorij.

**Zakaj je `.env.production` vseeno v repozitoriju.** Vsebuje samo URL in
*publishable* ključ, ki ju brskalnik tako ali tako prenese v bundlu — nista
skrivnost. Podatke varuje RLS (vseh 24 tabel jo ima vklopljeno), ne ta ključ.
Skrivni ključ (`sb_secret_…` / `SUPABASE_SERVICE_ROLE_KEY`) obide RLS in ne sme
nikoli v git — v CI je shranjen med GitHub Secrets.

Razvojni strežnik opozori, če je priklopljen na oddaljeno bazo, in
`npm run testno-okolje` se proti nelokalnem URL-ju sploh ne zažene.

## Načrt razvoja (roadmap)

- [x] Postavitev baze in avtentikacije
- [x] Uvoz klubov, igralcev in zapisnikov 1. GNL
- [x] Točkovanje iz uradne statistike
- [x] Glasovanje o asistencah in pozicijah (prag 5 glasov)
- [x] Vrednotenje igralcev in proračun
- [x] Sestavljanje fantasy ekipe
- [x] Lestvica
- [x] Administracija
- [ ] Samodejno osveževanje zapisnikov tekoče sezone
- [ ] Lestvica po posameznih krogih in menjave med krogi
- [ ] Obranjene enajstmetrovke (zapisnik jih ne beleži — ročni vnos)
- [ ] Povezava igralcev z NZS profili
- [ ] PWA in namestitev v produkcijo

## Podatki lige

Podatki o klubih, igralcih in rezultatih 1. Gorenjske nogometne lige: [MNZG Kranj](https://www.mnzgkranj.si/)

## Licenca

Osebni/skupnostni projekt. Dodaj licenco po želji (npr. MIT).
