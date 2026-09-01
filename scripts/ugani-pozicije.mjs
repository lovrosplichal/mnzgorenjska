// Ugane pozicije igralcev iz statistike prejšnje sezone.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/ugani-pozicije.mjs
//   ... --pisi                  (dejansko zapiše; brez tega samo pokaže predlog)
//   ... --tekmovanje mladinci   (mladinska liga; brez tega člani)
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
import {
  slugTekmovanja,
  tekmovanje as najdiTekmovanje,
} from './tekmovanje.mjs'

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
// V rednem (samodejnem) zagonu nočemo, da bi se pozicija igralca tedensko
// premetavala, ko se statistika nabira. S to zastavico skript le zapolni tiste,
// ki pozicije še nimajo — tipično novinci, ki so prišli med sezono.
const samoNove = process.argv.includes('--samo-nove')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- podatki ---------------------------------------------------------------
// Razvrščamo znotraj kluba, klub pa ima lahko ekipo v obeh ligah — zato
// najprej zožimo na eno tekmovanje, sicer bi mladince primerjali s člani.
const tekmovanje = await najdiTekmovanje(db, slugTekmovanja())
console.log(`Tekmovanje: ${tekmovanje.name}`)

const { data: igralci, error } = await db
  .from('player_overview')
  .select('id, full_name, team_id, team_name, position, position_source, minutes, goals, matches, shirt_number')
  .eq('competition_id', tekmovanje.id)
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
  if (samoNove && p.position) continue
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

// --- nihče ne sme ostati brez pozicije ---------------------------------------
// Igralec brez pozicije se ne more postaviti na igrišče, zato je za fantasy
// ligo neuporaben. Kdor ima premalo minut za oceno (ali sploh ne igra), dobi
// vezista — najpogostejšo pozicijo na igrišču in najmanj tvegano ugibanje.
// Glasovanje skupnosti to popravi, brž ko kdo opazi napako.
const zeUgotovljeni = new Set(predlogi.map((p) => p.id))
for (const p of igralci) {
  if (zeUgotovljeni.has(p.id)) continue
  if (['zapisnik', 'admin', 'glasovanje'].includes(p.position_source)) continue
  if (p.position) continue
  predlogi.push({ ...p, ugibanje: 'MID', goliNa90: 0, kartoniNa90: 0, brezDokazov: true })
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

// --- priori pozicij ---------------------------------------------------------
// Za vsakega igralca izračunamo porazdelitev [0..1] po pozicijah. Močan prior
// (>= 0.70) spusti prag glasovanja s 5 na 2 — takrat lahko en glas insiderja
// pozicijo potrdi. Slabi priori (~ osnovna porazdelitev) ne vplivajo na prag.
// Priori niso resnica — le pomoč pri glasovanju.
function priorPozicij(p) {
  // 1) Številka dresa je najmočnejši posamični signal in dominira, če je znana.
  let s
  const n = p.shirt_number
  if (n === 1) s = { GK: 0.85, DEF: 0.05, MID: 0.05, FWD: 0.05 }
  else if (n === 12 || n === 13 || n === 22)
    s = { GK: 0.60, DEF: 0.15, MID: 0.15, FWD: 0.10 }
  else if ([2, 3, 4, 5].includes(n))
    s = { GK: 0.02, DEF: 0.65, MID: 0.25, FWD: 0.08 }
  else if (n === 6) s = { GK: 0.02, DEF: 0.45, MID: 0.45, FWD: 0.08 }
  else if ([7, 8].includes(n))
    s = { GK: 0.02, DEF: 0.15, MID: 0.55, FWD: 0.28 }
  else if (n === 9) s = { GK: 0.02, DEF: 0.03, MID: 0.20, FWD: 0.75 }
  else if (n === 10) s = { GK: 0.02, DEF: 0.05, MID: 0.35, FWD: 0.58 }
  else if (n === 11) s = { GK: 0.02, DEF: 0.03, MID: 0.30, FWD: 0.65 }
  else s = { GK: 0.05, DEF: 0.25, MID: 0.40, FWD: 0.30 } // neinformativno

  // 2) Statistika popravi prior, če imamo dovolj minut.
  if ((p.minutes ?? 0) >= MIN_MINUT) {
    const g = p.goliNa90 ?? 0
    if (g >= 0.40) { s.FWD += 0.25; s.DEF *= 0.3; s.GK *= 0.1 }
    else if (g >= 0.20) { s.FWD += 0.10; s.MID += 0.05; s.DEF *= 0.7 }
    else if (g < 0.05) { s.DEF += 0.10; s.FWD *= 0.5 }

    const k = p.kartoniNa90 ?? 0
    if (k >= 0.30) { s.DEF += 0.10; s.MID += 0.05; s.FWD *= 0.5; s.GK *= 0.1 }
  }

  // 3) Normalizacija na sum=1, brez negativnih.
  for (const key of Object.keys(s)) s[key] = Math.max(0, s[key])
  const skupaj = s.GK + s.DEF + s.MID + s.FWD
  if (skupaj === 0) return { GK: 0.25, DEF: 0.25, MID: 0.25, FWD: 0.25 }
  return {
    GK: s.GK / skupaj,
    DEF: s.DEF / skupaj,
    MID: s.MID / skupaj,
    FWD: s.FWD / skupaj,
  }
}

// Za priore uporabimo VSE igralce (tudi tiste, ki jih razvrščanje ni zajelo).
// Napolnimo tudi za novince brez minut — dobijo prior iz številke dresa.
const kartoniPoIgralcu = poIgralcu
const priori = igralci.map((p) => {
  const kart = kartoniPoIgralcu.get(p.id) ?? { rumeni: 0, rdeci: 0 }
  const na90 = (v) => v / Math.max(1, (p.minutes ?? 0) / 90)
  return {
    id: p.id,
    full_name: p.full_name,
    prior: priorPozicij({
      ...p,
      goliNa90: (p.minutes ?? 0) >= MIN_MINUT ? na90(p.goals ?? 0) : 0,
      kartoniNa90: (p.minutes ?? 0) >= MIN_MINUT ? na90(kart.rumeni + kart.rdeci) : 0,
    }),
  }
})

const vrstice = []
for (const pi of priori) {
  for (const koda of ['GK', 'DEF', 'MID', 'FWD']) {
    vrstice.push({
      player_id: pi.id,
      position: koda,
      score: Number(pi.prior[koda].toFixed(3)),
      updated_at: new Date().toISOString(),
    })
  }
}

// Vrstice zapisujemo v paketih, da ne presežemo request-sizea.
const { error: eDel } = await db
  .from('position_priors')
  .delete()
  .in('player_id', priori.map((p) => p.id))
if (eDel) console.log(`Napaka pri brisanju starih priorjev: ${eDel.message}`)

let zapisanihPriorjev = 0
for (let i = 0; i < vrstice.length; i += 200) {
  const paket = vrstice.slice(i, i + 200)
  const { error: eIns } = await db.from('position_priors').insert(paket)
  if (eIns) console.log(`Napaka pri zapisu priorjev: ${eIns.message}`)
  else zapisanihPriorjev += paket.length
}
console.log(`Zapisanih priorjev: ${zapisanihPriorjev} (${priori.length} igralcev × 4 pozicije)`)

// Nekaj najbolj prepričljivih primerov v izpis.
const najzanesljivejsi = [...priori]
  .map((p) => ({ ...p, max: Math.max(...Object.values(p.prior)) }))
  .sort((a, b) => b.max - a.max)
  .slice(0, 5)
console.log('\nNajmočnejši priori:')
for (const p of najzanesljivejsi) {
  const [koda, v] = Object.entries(p.prior).sort((a, b) => b[1] - a[1])[0]
  console.log(`  ${p.full_name.padEnd(24)} ${koda}: ${(v * 100).toFixed(0)}%`)
}

const { data: pregled } = await db.from('position_confidence').select('*')
console.log('\nIzvor pozicij:')
for (const r of pregled ?? []) console.log(`  ${r.position_source}: ${r.players}`)
