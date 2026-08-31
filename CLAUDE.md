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
  (`is_starter`, `is_captain`, `is_vice`, `bench_order`)
- `fantasy_chips` → vloženi pripomočki (zaenkrat le `klop_plus`, enkrat na sezono)
- `fantasy_lineups` → posnetek postave po krogih; nastane s `zakleni_krog(krog)`
  oz. `zakleni_zapadle_kroge()` (za cron). Točkovanje bere posnetek, če obstaja.
- `rounds` → krogi sezone, `matches` → tekme (z izvorom `zapisnik_id`)
- `appearances` → nastop igralca na tekmi (minute, goli, kartoni, prejeti goli)
- `goals` → posamezen gol; nosi tudi potrjeno asistenco
- `assist_votes`, `position_votes` → glasovanje skupnosti (prag v `settings`)
- `player_scores` → točke igralca na krog (iz pogleda `appearance_points`)
- `ucinkovita_postava(ekipa, krog)` → postava po samodejnih menjavah z množitelji;
  iz nje računata `fantasy_round_points` in `fantasy_team_standings`
- `player_standings` → lestvica igralcev (točke, forma, na tekmo, izbranost)
- `tekma_nastopi` → nastopi na tekmi s točkami; stran Rezultati iz njih nariše
  obe postavi (`/rezultati` in `/tekma/:id`)
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

## Ukazi

```bash
npm install         # namestitev odvisnosti
npx supabase start  # lokalna baza (Docker)
npm run dev         # razvojni strežnik
npm run build       # produkcijski build
npm test            # e2e test proti bazi (RLS, glasovanje, točke, lestvica)
npm run smoke       # izris vseh strani + pravila ekipe, brez brskalnika
```

`npm test` naj teče s `SUPABASE_SERVICE_ROLE_KEY` v okolju — brez njega ne more
povrniti asistence in pozicije, ki ju potrdi z glasovi, in naslednji zagon pade.

Uvoz podatkov (vsi sprejmejo `SUPABASE_URL` za projekt v oblaku):

```bash
node scripts/uvoz-razporeda.mjs --liga 1601 --pisi   # krogi in tekme z datumi
node scripts/uvoz-zapisnikov.mjs --liga 1502         # rezultati in statistika
node scripts/ovrednoti-igralce.mjs                   # cene igralcev
node scripts/ugani-pozicije.mjs --pisi               # ugibanje pozicij
node scripts/prenesi-grbe.mjs --pisi                 # grbi klubov
```

## Preverjanje sprememb

- Po spremembi kode poženi `npm run smoke`.
- Po spremembi sheme ali RLS poženi še `npm test`.
- Ob spremembi podatkovnega modela **dodaj novo migracijo** v `supabase/migrations/`;
  obstoječih migracij ne spreminjaj, ker so že uporabljene.
- Pravila sestave ekipe so na enem mestu v `src/lib/pravila.js` — spreminjaj jih tam,
  ne razpršeno po komponentah.
