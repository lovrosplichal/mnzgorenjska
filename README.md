# Gorenjska Fantasy Liga ⚽

Fantasy football aplikacija za člansko kategorijo **1. Gorenjske nogometne lige (MNZG Kranj)**. Uporabniki sestavljajo svoje ekipe iz realnih igralcev lige in zbirajo točke po uradni statistiki zapisnikov ter tekmujejo na skupni lestvici.

## Ideja

Točke izhajajo iz **uradnih zapisnikov MNZ Gorenjska** — goli, minute, ohranjene
mreže, kartoni, enajstmetrovke. Zapisniki pa dveh stvari ne povedo, zato ju
določi **skupnost z glasovanjem**:

1. **kdo je podal asistenco** za posamezni gol,
2. **na katerem mestu igralec igra** — zapisnik označi le vratarja z `(V)`,
   postave pa našteje po številkah dresov, ne po pozicijah.

Pri **5 glasovih** za istega kandidata se podatek potrdi in začne šteti.

## Ključne funkcionalnosti

- **Sestavljanje ekipe** — 15 igralcev, 11 v prvi postavi, največ 3 iz kluba, proračun 100.
- **Glasovanje o asistencah** — skupnost pove, kdo je podal; pri 5 glasovih se potrdi.
- **Glasovanje o pozicijah** — zapisnik pozicij ne pove, zato jih določi skupnost.
- **Točkovanje** — po pravilih lige iz statistike zapisnikov (glej spodaj).
- **Lestvica** — skupna razvrstitev vseh fantasy ekip.
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
| Prva postava | 11 igralcev |
| Vratarji v prvi postavi | 1 |
| Branilci v prvi postavi | 3–5 |
| Vezisti v prvi postavi | 2–5 |
| Napadalci v prvi postavi | 1–3 |
| Največ igralcev iz istega kluba | 3 |
| Proračun | 100.0 |

Točke zbirajo le igralci v prvi postavi.

## Podatkovni model

| Tabela | Opis |
|---|---|
| `profiles` | Profili uporabnikov, zastavica `is_admin` |
| `teams` / `players` | Klubi in igralci 1. GNL (cena, pozicija, vir pozicije) |
| `rounds` / `matches` | Krogi in tekme (z izvorom: `zapisnik_id`, `source_url`) |
| `appearances` | Nastop igralca na tekmi: minute, goli, kartoni, prejeti goli |
| `goals` | Posamezni gol (strelec, minuta, 11m, avtogol, potrjena asistenca) |
| `assist_votes` | Glasovi skupnosti o asistenci |
| `position_votes` | Glasovi skupnosti o poziciji |
| `fantasy_teams` / `fantasy_roster` | Ekipe uporabnikov in njihovi nabori |
| `player_scores` | Točke igralca po krogih |
| `settings` | Pragova glasov (privzeto 5) |

Pogledi: `appearance_points` (točke nastopa), `player_overview`,
`player_season_stats`, `fantasy_team_standings`, `fantasy_team_budget`.

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

# 4. zaženi razvojni strežnik
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

# uvozi vse zapisnike sezone (--pocisti najprej pobriše demo podatke)
node scripts/uvoz-zapisnikov.mjs --liga 1502 --pocisti

# izračunaj cene igralcev iz uvožene statistike
node scripts/ovrednoti-igralce.mjs
```

`--liga 1502` je sezona 2025/26, `--liga 1600` tekoča. Prenesene strani se
predpomnijo v `scripts/.predpomnilnik/`, da ponovni uvoz ne obremenjuje strani
MNZ.

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

## Okoljske spremenljivke

Ustvari `.env` datoteko (glej `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

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
