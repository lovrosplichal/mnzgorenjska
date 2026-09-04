#!/usr/bin/env bash
#
# Postavi lokalno testno okolje od nule: prazna baza -> migracije -> seme ->
# resnicni zapisniki -> ugibanje pozicij -> demo uporabniki in fantasy ekipe.
#
# Zazeni z:  npm run testno-okolje
#
# Vse tece proti Supabase stacku na 127.0.0.1 (`npx supabase start`).
# Produkcijske baze se ne dotakne — URL bere iz .env in ga spodaj preveri.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Manjka .env. Kopiraj .env.example v .env in vpisi lokalne kljuce"
  echo "(dobis jih z: npx supabase status)."
  exit 1
fi

# .env je vir resnice za URL in kljuce; skripte berejo tudi iz okolja.
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${SUPABASE_SERVICE_ROLE_KEY:?Manjka SUPABASE_SERVICE_ROLE_KEY v .env}"

# VAROVALKA: to skripto sme pognati samo lokalna baza. Uvoz in demo podatki
# tecejo s servisnim kljucem, ki obide RLS — proti produkciji bi bilo usodno.
case "${VITE_SUPABASE_URL:-}" in
  *127.0.0.1*|*localhost*) ;;
  *)
    echo "USTAVLJENO: VITE_SUPABASE_URL ni lokalni naslov"
    echo "   (${VITE_SUPABASE_URL:-prazen})."
    echo "   Testno okolje se postavlja samo proti 127.0.0.1."
    exit 1
    ;;
esac

echo "==> 1/6  Prazna baza: migracije + seme"
npx --yes supabase db reset

echo
echo "==> 2/6  Uvoz zapisnikov: arhiv lige 1502 (izhodisce za cene) — nekaj minut"
node scripts/uvoz-zapisnikov.mjs --liga 1502

# Tekoca sezona mora biti uvozena, sicer testno okolje pozna samo stare kroge.
# `preracunaj_igralca` osvezi le kroge znotraj okna (privzeto 14 dni), zato bi
# `npm test` na sami arhivski sezoni padel pri "tocke sledijo potrjeni poziciji".
echo
echo "==> 3/6  Uvoz razporeda tekoce sezone (krogi z datumi)"
node scripts/uvoz-razporeda.mjs --pisi

echo
echo "==> 4/6  Uvoz zapisnikov tekoce sezone"
node scripts/uvoz-zapisnikov.mjs

echo
echo "==> 5/6  Ugibanje pozicij in cene igralcev"
node scripts/ugani-pozicije.mjs --pisi
node scripts/ovrednoti-igralce.mjs

echo
echo "==> 6/6  Demo uporabniki in fantasy ekipe"
node scripts/demo-data.mjs

echo
echo "Testno okolje je pripravljeno."
echo "  Studio:  http://127.0.0.1:54323"
echo "  Posta:   http://127.0.0.1:54324  (registracijska e-posta)"
echo "  Zazeni:  npm run dev   /   npm test   /   npm run smoke"
