// Izračuna vrednost igralcev iz statistike prejšnjih sezon.
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/ovrednoti-igralce.mjs
//   ... --sezona 2025/26
//
// Vrednost je med 4.0 in 12.0 (kot pri klasičnem fantasyju). Sestavljena je iz:
//   - točk na 90 minut (kako dober je, ko igra),
//   - zanesljivosti (koliko je sploh igral — malo minut pomeni malo dokazov),
//   - bonusa za izkušnje iz višjih lig (podatek z NZS, če ga administrator vnese).
//
// Igralci brez zadostnih minut dobijo privzeto vrednost, da niso precenjeni
// zaradi enega samega dobrega nastopa.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const NAJNIZJA = 4.0
const NAJVISJA = 12.0
const PRIVZETA = 4.5
const MIN_MINUT = 270 // pod tem ni dovolj dokazov (3 cele tekme)
const MINUT_ZA_POLNO_ZAUPANJE = 900 // 10 celih tekem

// Bonus za nastope v višjih ligah (NZS)
const BONUS_LIGE = {
  '1SNL': 2.0,
  '2SNL': 1.2,
  '3SNL': 0.6,
}

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

function arg(ime, privzeto = null) {
  const i = process.argv.indexOf('--' + ime)
  if (i < 0) return privzeto
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const env = izEnv()
const BASE = env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) {
  console.error('Manjka SUPABASE_SERVICE_ROLE_KEY (npx supabase status)')
  process.exit(1)
}
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

const sezona = arg('sezona')

// --- statistika ------------------------------------------------------------
let poizvedba = db
  .from('player_season_stats')
  .select('player_id, season, minutes, goals, points, matches, clean_sheets, yellow_cards, red_cards')
if (sezona) poizvedba = poizvedba.eq('season', sezona)
const { data: stat, error } = await poizvedba
if (error) {
  console.error(error.message)
  process.exit(1)
}

// seštej po igralcu (če je sezon več)
const poIgralcu = new Map()
for (const s of stat ?? []) {
  const t = poIgralcu.get(s.player_id) ?? { minutes: 0, goals: 0, points: 0, matches: 0, clean_sheets: 0, yellow_cards: 0, red_cards: 0 }
  t.minutes += s.minutes ?? 0
  t.goals += s.goals ?? 0
  t.points += Number(s.points ?? 0)
  t.matches += s.matches ?? 0
  t.clean_sheets += s.clean_sheets ?? 0
  t.yellow_cards += s.yellow_cards ?? 0
  t.red_cards += s.red_cards ?? 0
  poIgralcu.set(s.player_id, t)
}
console.log(`Igralcev s statistiko: ${poIgralcu.size}`)

const { data: igralci } = await db
  .from('players')
  .select('id, full_name, position, value_locked, nzs_top_league, nzs_top_league_minutes')

// --- surova ocena ----------------------------------------------------------
// POMEMBNO: vrednost namenoma NE izhaja iz fantasy točk, ker so te odvisne od
// pozicije. Dokler skupnost pozicij ne izglasuje, ima večina igralcev pozicijo
// NULL in bi za gole in "brez prejetega gola" dobila 0 točk — vrednotenje bi
// tako precenilo vratarje (edine z znano pozicijo iz zapisnika).
// Zato ocenjujemo iz surove statistike, ki je od pozicije neodvisna.
const ocene = new Map()
for (const p of igralci ?? []) {
  const s = poIgralcu.get(p.id)
  if (!s || s.minutes < MIN_MINUT) continue

  const na90 = (v) => v / (s.minutes / 90)
  const goliNa90 = na90(s.goals)
  const csDelez = s.clean_sheets / Math.max(1, s.matches)
  const kartoniNa90 = na90(s.yellow_cards + 3 * s.red_cards)

  const ocena =
    goliNa90 * 3.0 + // napadalni prispevek
    csDelez * 1.0 + // obrambni prispevek
    Math.min(1, s.minutes / MINUT_ZA_POLNO_ZAUPANJE) * 0.8 - // igra redno
    kartoniNa90 * 0.5 // nediscipliniranost

  const zaupanje = Math.min(1, s.minutes / MINUT_ZA_POLNO_ZAUPANJE)
  // koren zaupanja: malo minut ceno zniža, a je ne izniči
  ocene.set(p.id, ocena * Math.sqrt(zaupanje))
}
console.log(`Igralcev z dovolj minutami (>=${MIN_MINUT}): ${ocene.size}`)

if (ocene.size === 0) {
  console.log('Ni dovolj podatkov za vrednotenje.')
  process.exit(0)
}

// --- razvrstitev v cenovni razpon -----------------------------------------
// Percentil je odpornejši od linearne lestvice, ker en izjemen igralec
// ne stisne vseh ostalih na dno.
const urejene = [...ocene.values()].sort((a, b) => a - b)
const percentil = (v) => {
  let lo = 0
  let hi = urejene.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (urejene[mid] < v) lo = mid + 1
    else hi = mid
  }
  return lo / Math.max(1, urejene.length - 1)
}

const zaokrozi = (v) => Math.round(v * 2) / 2 // na 0.5 natančno

let posodobljenih = 0
let zaklenjenih = 0
const razpored = new Map()

for (const p of igralci ?? []) {
  if (p.value_locked) {
    zaklenjenih++
    continue
  }

  let vrednost
  const ocena = ocene.get(p.id)
  if (ocena == null) {
    vrednost = PRIVZETA
  } else {
    const q = percentil(ocena)
    vrednost = NAJNIZJA + q * (NAJVISJA - NAJNIZJA)
  }

  // bonus za višje lige (NZS)
  const bonus = BONUS_LIGE[p.nzs_top_league] ?? 0
  if (bonus > 0) {
    const minute = p.nzs_top_league_minutes ?? 0
    // polni bonus pri 900+ minutah v tisti ligi
    vrednost += bonus * Math.min(1, minute / 900 || 1)
  }

  vrednost = zaokrozi(Math.min(NAJVISJA, Math.max(NAJNIZJA, vrednost)))
  razpored.set(vrednost, (razpored.get(vrednost) ?? 0) + 1)

  const { error: eUpd } = await db
    .from('players')
    .update({ value: vrednost })
    .eq('id', p.id)
  if (eUpd) console.log(`  ${p.full_name}: ${eUpd.message}`)
  else posodobljenih++
}

console.log(`\nPosodobljenih: ${posodobljenih}, zaklenjenih (ročno): ${zaklenjenih}`)

console.log('\nPorazdelitev vrednosti:')
for (const v of [...razpored.keys()].sort((a, b) => a - b))
  console.log(`  ${v.toFixed(1)}  ${'█'.repeat(Math.ceil(razpored.get(v) / 3))} ${razpored.get(v)}`)

const { data: najdrazji } = await db
  .from('player_overview')
  .select('full_name, team_name, position, value, points, minutes, goals')
  .order('value', { ascending: false })
  .limit(12)
console.log('\nNajdražji igralci:')
for (const p of najdrazji ?? [])
  console.log(
    `  ${String(p.value).padStart(5)}  ${p.full_name.padEnd(26)} ${(p.team_name ?? '').padEnd(20)} ${String(p.position ?? '—').padEnd(4)} ${String(p.points).padStart(6)} tock, ${p.goals} golov, ${p.minutes} min`,
  )
