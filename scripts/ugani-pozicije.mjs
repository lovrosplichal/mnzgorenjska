// Ugane pozicije igralcev iz statistike prejšnje sezone.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/ugani-pozicije.mjs
//   ... --pisi        (dejansko zapiše; brez tega samo pokaže predlog)
//
// Zamisel: kdor doseže veliko golov, je najbrž napadalec. Kdor golov skoraj
// nima, prejema pa veliko kartonov, je najbrž branilec. Vmesni so vezisti.
//
// Ugibanje ni resnica — zapisano je kot position_source = 'ugibanje' in ga
// glasovanje skupnosti povozi. Vratarjev se ne dotikamo, ker jih zanesljivo
// pove zapisnik (oznaka (V)).
//
// Namesto absolutnih mej razvrščamo znotraj vsakega kluba, ker se ekipe med
// sabo močno razlikujejo — v slabši ekipi ima najboljši strelec lahko manj
// golov kot rezervni napadalec v najboljši.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Pričakovana sestava enajsterice brez vratarja: 4 branilci, 4 vezisti,
// 2–3 napadalci. V deležih igralskega kadra kluba:
const DELEZ_NAPADALCEV = 0.25
const DELEZ_BRANILCEV = 0.42

const MIN_MINUT = 180 // pod tem je premalo za oceno

function izEnv() {
  try {
    const vsebina = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    return Object.fromEntries(
      vsebina
        .split(String.fromCharCode(10))
        .map((v) => v.trim())
        .filter((v) => v.includes('=') && !v.startsWith('#'))
        .map((v) => {
          const i = v.indexOf('=')
          return [v.slice(0, i).trim(), v.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

const env = izEnv()
const BASE =
  process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) {
  console.error('Manjka SUPABASE_SERVICE_ROLE_KEY (npx supabase status)')
  process.exit(1)
}
const pisi = process.argv.includes('--pisi')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- podatki ---------------------------------------------------------------
const { data: igralci, error } = await db
  .from('player_overview')
  .select('id, full_name, team_id, team_name, position, position_source, minutes, goals, matches')
if (error) {
  console.error(error.message)
  process.exit(1)
}

const { data: kartoni } = await db
  .from('appearances')
  .select('player_id, yellow_cards, red_cards')
const poIgralcu = new Map()
for (const a of kartoni ?? []) {
  const t = poIgralcu.get(a.player_id) ?? { rumeni: 0, rdeci: 0 }
  t.rumeni += a.yellow_cards ?? 0
  t.rdeci += a.red_cards ?? 0
  poIgralcu.set(a.player_id, t)
}

// --- razvrstitev po klubih --------------------------------------------------
const poKlubih = new Map()
for (const p of igralci) {
  // vratarji so znani iz zapisnika, administratorjevih in izglasovanih se ne dotikamo
  if (['zapisnik', 'admin', 'glasovanje'].includes(p.position_source)) continue
  if ((p.minutes ?? 0) < MIN_MINUT) continue
  const k = poKlubih.get(p.team_id) ?? []
  const kart = poIgralcu.get(p.id) ?? { rumeni: 0, rdeci: 0 }
  const na90 = (v) => v / Math.max(1, p.minutes / 90)
  k.push({
    ...p,
    goliNa90: na90(p.goals ?? 0),
    kartoniNa90: na90(kart.rumeni + kart.rdeci),
  })
  poKlubih.set(p.team_id, k)
}

const predlogi = []
for (const [, kader] of poKlubih) {
  const n = kader.length
  if (n < 4) continue

  // 1. najboljši strelci -> napadalci
  const poGolih = [...kader].sort((a, b) => b.goliNa90 - a.goliNa90)
  const stNapadalcev = Math.max(1, Math.round(n * DELEZ_NAPADALCEV))
  const napadalci = new Set(poGolih.slice(0, stNapadalcev).map((p) => p.id))

  // 2. med preostalimi tisti z največ kartoni -> branilci
  const ostali = kader.filter((p) => !napadalci.has(p.id))
  const poKartonih = [...ostali].sort((a, b) => {
    if (b.kartoniNa90 !== a.kartoniNa90) return b.kartoniNa90 - a.kartoniNa90
    // ob enakem številu kartonov je manj golov bolj obrambno
    return a.goliNa90 - b.goliNa90
  })
  const stBranilcev = Math.max(1, Math.round(n * DELEZ_BRANILCEV))
  const branilci = new Set(poKartonih.slice(0, stBranilcev).map((p) => p.id))

  for (const p of kader) {
    const poz = napadalci.has(p.id) ? 'FWD' : branilci.has(p.id) ? 'DEF' : 'MID'
    predlogi.push({ ...p, ugibanje: poz })
  }
}

// --- izpis -------------------------------------------------------------------
const steviloPo = {}
for (const p of predlogi)
  steviloPo[p.ugibanje] = (steviloPo[p.ugibanje] ?? 0) + 1

console.log(`Igralcev z dovolj minutami (>=${MIN_MINUT}): ${predlogi.length}`)
console.log('Predlagana razporeditev:')
for (const [k, v] of Object.entries(steviloPo)) console.log(`  ${k}: ${v}`)

console.log('\nPrimeri (najbolj izraziti):')
const vzorec = [
  ...predlogi.filter((p) => p.ugibanje === 'FWD').sort((a, b) => b.goliNa90 - a.goliNa90).slice(0, 3),
  ...predlogi.filter((p) => p.ugibanje === 'DEF').sort((a, b) => b.kartoniNa90 - a.kartoniNa90).slice(0, 3),
  ...predlogi.filter((p) => p.ugibanje === 'MID').slice(0, 3),
]
for (const p of vzorec)
  console.log(
    `  ${p.ugibanje}  ${p.full_name.padEnd(24)} ${String(p.goals).padStart(2)} golov (${p.goliNa90.toFixed(2)}/90), kartoni ${p.kartoniNa90.toFixed(2)}/90`,
  )

if (!pisi) {
  console.log('\nTo je le predlog. Za zapis v bazo dodaj --pisi')
  process.exit(0)
}

let zapisanih = 0
for (const p of predlogi) {
  const { error: e } = await db
    .from('players')
    .update({ position: p.ugibanje, position_source: 'ugibanje' })
    .eq('id', p.id)
  if (e) console.log(`  ${p.full_name}: ${e.message}`)
  else zapisanih++
}
console.log(`\nZapisanih ugibanj: ${zapisanih}`)

const { data: pregled } = await db.from('position_confidence').select('*')
console.log('\nIzvor pozicij:')
for (const r of pregled ?? []) console.log(`  ${r.position_source}: ${r.players}`)
