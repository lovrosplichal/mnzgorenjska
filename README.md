# Gorenjska Fantasy Liga ⚽

Fantasy football aplikacija za člansko kategorijo **1. Gorenjske nogometne lige (MNZG Kranj)**. Uporabniki sestavljajo svoje ekipe iz realnih igralcev lige, po vsakem krogu ocenjujejo kako je kdo igral, in glede na glasove/ocene zbirajo točke ter tekmujejo na skupni lestvici.

## Ideja

Za razliko od klasičnega fantasy footballa (kjer točke temeljijo na uradni statistiki), ta aplikacija temelji na **glasovanju skupnosti**. Ker gre za amatersko/polprofesionalno ligo, kjer podrobne statistike ni na voljo, navijači in obiskovalci tekem sami ocenijo predstavo posameznega igralca. Skupne ocene tvorijo točke, ki gredo v fantasy ekipe.

## Ključne funkcionalnosti

- **Sestavljanje ekipe** — vsak uporabnik izbere svoj nabor igralcev (npr. 11 + rezerve) znotraj proračuna ali brez omejitev.
- **Glasovanje / ocenjevanje** — po vsakem krogu uporabniki ocenijo predstavo igralcev (npr. ocena 1–10).
- **Točkovanje** — igralec dobi točke glede na povprečno oceno skupnosti; točke se seštejejo v fantasy ekipe.
- **Lestvica** — skupna razvrstitev vseh fantasy ekip po sezoni in po krogih.
- **Uporabniški računi** — registracija, prijava, profil s svojo ekipo.
- **Pregled kluba/igralcev** — seznam ekip in igralcev 1. GNL.

## Tehnološki sklop (predlog)

> Prilagodi glede na to, kar želiš. Spodaj je preprost, robusten predlog.

- **Frontend:** React + Vite (ali Next.js)
- **Backend / baza:** Supabase (PostgreSQL + avtentikacija + API) — hitro za postaviti, brezplačni nivo zadošča za začetek
- **Gostovanje:** Vercel (frontend) + Supabase (baza)
- **Slog:** Tailwind CSS

## Podatkovni model (osnutek)

| Tabela | Opis |
|---|---|
| `users` | Uporabniki (avtentikacija prek Supabase) |
| `teams` (klubi) | Realni klubi v 1. GNL |
| `players` | Realni igralci, povezani s klubom |
| `fantasy_teams` | Fantasy ekipe uporabnikov |
| `fantasy_roster` | Povezava fantasy ekipe ↔ izbrani igralci |
| `rounds` | Krogi sezone |
| `ratings` | Glasovi/ocene: uporabnik → igralec → krog → ocena |
| `player_scores` | Izračunane točke igralca na krog (povprečje ocen) |

## Zagon lokalno

```bash
# kloniraj repo
git clone <URL_TVOJEGA_REPO>
cd <ime-repo>

# namesti odvisnosti
npm install

# nastavi okoljske spremenljivke (glej .env.example)
cp .env.example .env

# zaženi razvojni strežnik
npm run dev
```

## Okoljske spremenljivke

Ustvari `.env` datoteko (glej `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Načrt razvoja (roadmap)

- [ ] Postavitev baze in avtentikacije
- [ ] Uvoz klubov in igralcev 1. GNL
- [ ] Sestavljanje fantasy ekipe
- [ ] Sistem glasovanja/ocenjevanja po krogih
- [ ] Izračun točk in lestvica
- [ ] Mobilni prikaz / PWA
- [ ] Administracija (dodajanje krogov, potrjevanje rezultatov)

## Podatki lige

Podatki o klubih, igralcih in rezultatih 1. Gorenjske nogometne lige: [MNZG Kranj](https://www.mnzgkranj.si/)

## Licenca

Osebni/skupnostni projekt. Dodaj licenco po želji (npr. MIT).
