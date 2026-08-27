# Gorenjska Fantasy Liga ⚽

Fantasy football aplikacija za člansko kategorijo **1. Gorenjske nogometne lige (MNZG Kranj)**. Uporabniki sestavljajo svoje ekipe iz realnih igralcev lige, po vsakem krogu ocenjujejo kako je kdo igral, in glede na glasove/ocene zbirajo točke ter tekmujejo na skupni lestvici.

## Ideja

Za razliko od klasičnega fantasy footballa (kjer točke temeljijo na uradni statistiki), ta aplikacija temelji na **glasovanju skupnosti**. Ker gre za amatersko/polprofesionalno ligo, kjer podrobne statistike ni na voljo, navijači in obiskovalci tekem sami ocenijo predstavo posameznega igralca. Skupne ocene tvorijo točke, ki gredo v fantasy ekipe.

## Ključne funkcionalnosti

- **Sestavljanje ekipe** — 15 igralcev, od tega 11 v prvi postavi; največ 3 iz istega kluba.
- **Glasovanje / ocenjevanje** — po vsakem krogu uporabniki ocenijo predstavo igralcev z oceno 1–10.
- **Točkovanje** — igralec dobi točke glede na povprečno oceno skupnosti (najmanj 3 glasovi); točke prve postave se seštejejo v fantasy ekipo.
- **Lestvica** — skupna razvrstitev vseh fantasy ekip.
- **Uporabniški računi** — registracija in prijava z e-pošto in geslom.
- **Pregled kluba/igralcev** — seznam ekip in igralcev 1. GNL.
- **Administracija** — dodajanje krogov, odpiranje/zapiranje glasovanja, preračun točk.

## Tehnološki sklop

- **Frontend:** React 18 + Vite + React Router
- **Backend / baza:** Supabase (PostgreSQL + avtentikacija + PostgREST)
- **Slog:** Tailwind CSS
- **Gostovanje:** Vercel (frontend) + Supabase (baza)

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

Točke zbirajo le igralci v prvi postavi.

## Podatkovni model

| Tabela | Opis |
|---|---|
| `profiles` | Profili uporabnikov (vezani na `auth.users`), zastavica `is_admin` |
| `teams` | Realni klubi v 1. GNL |
| `players` | Realni igralci, povezani s klubom |
| `fantasy_teams` | Fantasy ekipe uporabnikov (ena na uporabnika) |
| `fantasy_roster` | Povezava fantasy ekipe ↔ izbrani igralci (`is_starter`) |
| `rounds` | Krogi sezone + okno glasovanja (`voting_opens_at`, `voting_closes_at`) |
| `ratings` | Glasovi/ocene: uporabnik → igralec → krog → ocena |
| `player_scores` | Izračunane točke igralca na krog (povprečje ocen) |

Poleg tega:

- pogled `fantasy_team_standings` — lestvica fantasy ekip,
- funkcija `recompute_round_scores(p_round_id)` — preračuna povprečja za krog.

### Varnost (RLS)

- Klubi, igralci, krogi, točke in lestvica so **javno berljivi**.
- Posamezne ocene vidi **samo glasovalec sam** — javne so le agregirane vrednosti, da zgodnji glasovi ne vplivajo na kasnejše.
- Glas je mogoče oddati ali spremeniti **le, dokler je okno glasovanja odprto**.
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

Migracije iz `supabase/migrations/` in demo podatki iz `supabase/seed.sql` se ob
`supabase start` (oz. `npm run db:reset`) uporabijo samodejno.

### Demo podatki

`supabase/seed.sql` vnese 8 gorenjskih klubov, 14 demo igralcev na klub in 3 kroge.

> **Opomba:** imena klubov so resnična, **imena igralcev so izmišljena**.
> Pred uporabo v živo uvozi resnične nabore z [MNZG Kranj](https://www.mnzgkranj.si/).

Za bogatejšo demo vsebino (6 fantasy ekip in ocene za vse kroge):

```bash
export SUPABASE_SERVICE_ROLE_KEY=$(npx supabase status -o json | jq -r .SERVICE_ROLE_KEY)
node scripts/demo-data.mjs
```

## Ukazi

| Ukaz | Opis |
|---|---|
| `npm run dev` | razvojni strežnik |
| `npm run build` | produkcijski build |
| `npm run preview` | predogled builda |
| `npm test` | end-to-end test proti bazi (registracija, RLS, glasovanje, točke, lestvica) |
| `npm run smoke` | izris vseh strani + preverjanje pravil ekipe, brez brskalnika |
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
- [x] Sestavljanje fantasy ekipe
- [x] Sistem glasovanja/ocenjevanja po krogih
- [x] Izračun točk in lestvica
- [x] Administracija (dodajanje krogov, okno glasovanja, preračun točk)
- [ ] Uvoz resničnih klubov in igralcev 1. GNL
- [ ] Lestvica po posameznih krogih (trenutno le skupna)
- [ ] Mobilni prikaz / PWA (postavitev je odzivna, PWA še ni)
- [ ] Namestitev v produkcijo (Vercel + Supabase)

## Podatki lige

Podatki o klubih, igralcih in rezultatih 1. Gorenjske nogometne lige: [MNZG Kranj](https://www.mnzgkranj.si/)

## Licenca

Osebni/skupnostni projekt. Dodaj licenco po želji (npr. MIT).
