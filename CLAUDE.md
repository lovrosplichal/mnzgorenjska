# CLAUDE.md

Navodila za Claude Code pri delu na tem projektu.

## O projektu

Fantasy football aplikacija za člansko kategorijo 1. Gorenjske nogometne lige (MNZG Kranj). Uporabniki sestavljajo fantasy ekipe iz realnih igralcev znotraj proračuna in tekmujejo na skupni lestvici.

Točke temeljijo na uradni statistiki iz zapisnikov MNZ Gorenjska. Skupnost z glasovanjem
določi le tisto, česar zapisnik ne pove: **asistence** in **pozicije** (zapisnik označi le
vratarja z (V), postave pa našteje po številkah dresov). Prag je 5 glasov.

## Tehnološki sklop

- Frontend: React + Vite + Tailwind CSS
- Backend / baza / avtentikacija: Supabase (PostgreSQL)
- Gostovanje: Vercel + Supabase

Lokalni razvoj teče na Supabase CLI stacku v Dockerju (`npx supabase start`).

## Glavni koncepti podatkovnega modela

- `players` → realni igralci, vezani na realni klub (`teams`)
- `fantasy_teams` → ekipe uporabnikov, `fantasy_roster` → izbrani igralci
- `rounds` → krogi sezone, `matches` → tekme (z izvorom `zapisnik_id`)
- `appearances` → nastop igralca na tekmi (minute, goli, kartoni, prejeti goli)
- `goals` → posamezen gol; nosi tudi potrjeno asistenco
- `assist_votes`, `position_votes` → glasovanje skupnosti (prag v `settings`)
- `player_scores` → točke igralca na krog (iz pogleda `appearance_points`)

## Smernice za razvoj

- Vsi uporabniško vidni nizi naj bodo v **slovenščini**.
- Ohrani kodo preprosto in berljivo; to je skupnostni projekt, ne enterprise.
- Preden dodaš novo odvisnost, preveri ali je res potrebna.
- Ob spremembi podatkovnega modela posodobi tudi README in to datoteko.

## Ukazi

```bash
npm install         # namestitev odvisnosti
npx supabase start  # lokalna baza (Docker)
npm run dev         # razvojni strežnik
npm run build       # produkcijski build
npm test            # e2e test proti bazi (RLS, glasovanje, točke, lestvica)
npm run smoke       # izris vseh strani + pravila ekipe, brez brskalnika
```

## Preverjanje sprememb

- Po spremembi kode poženi `npm run smoke`.
- Po spremembi sheme ali RLS poženi še `npm test`.
- Ob spremembi podatkovnega modela **dodaj novo migracijo** v `supabase/migrations/`;
  obstoječih migracij ne spreminjaj, ker so že uporabljene.
- Pravila sestave ekipe so na enem mestu v `src/lib/pravila.js` — spreminjaj jih tam,
  ne razpršeno po komponentah.
