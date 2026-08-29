// Uvozi točne ure prihajajočih tekem iz delegacijske strani MNZ Gorenjska in
// nastavi rok kroga na 6 ur PRED prvo tekmo v krogu (Fri, Sat, Sun — karkoli).
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-delegiranja.mjs           # predogled
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-delegiranja.mjs --pisi    # zapiši
//   ... --liga 1601      (privzeto 1. GNL)
//   ... --sezona 2026/27 (privzeto trenutna tekoča iz baze)
//   ... --pomak 6        (koliko ur pred prvo tekmo naj bo rok, privzeto 6)
//
// Vir: https://www.mnzgkranj.si/print.cfm?prikazi=delegiranje&liga=X&krog=N&...
// Iz strani razberemo tekme, kot npr.
//     29.08.26 ob 16.00
//     Eltron Preddvor : Tržič 2012
// V slovenskem času (Europe/Ljubljana = CEST/CET). Rok zapišemo z UTC offset-om,
// ki ustreza mesecu (poletje +02:00, zima +01:00). Enostavno, brez tzdb.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { vBesedilo } from './zapisnik.mjs'

const IZVOR = 'https://www.mnzgkranj.si'
const PREDPOMNILNIK = 'scripts/.predpomnilnik'

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
  console.error('Manjka SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const arg = (ime, privzeto = null) => {
  const i = process.argv.indexOf(`--${ime}`)
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : privzeto
}
const liga = arg('liga', '1601')
const sezonaArg = arg('sezona', null)
const pomakUr = Number(arg('pomak', '6'))
const pisi = process.argv.includes('--pisi')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- prenos strani z lokalnim predpomnilnikom -------------------------------
async function prenesi(url, ime, sveze = false) {
  const pot = `${PREDPOMNILNIK}/${ime}`
  if (!sveze && existsSync(pot)) return readFileSync(pot, 'utf8')
  const odgovor = await fetch(url)
  if (!odgovor.ok) throw new Error(`${odgovor.status} ${url}`)
  const html = await odgovor.text()
  if (!existsSync(PREDPOMNILNIK)) mkdirSync(PREDPOMNILNIK, { recursive: true })
  writeFileSync(pot, html)
  return html
}

// --- pomožne ---------------------------------------------------------------
/** "29.08.26" → "2026-08-29" */
function datum(slo) {
  const m = slo.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (!m) return null
  const [, d, mes, l] = m
  const leto = l.length === 2 ? 2000 + Number(l) : Number(l)
  return `${leto}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "16.00" ali "16:00" → "16:00" */
function ura(slo) {
  const m = slo.match(/^(\d{1,2})[.:](\d{2})$/)
  if (!m) return null
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`
}

/** Slovenija: DST od zadnje nedelje marca do zadnje nedelje oktobra. */
function offsetLjubljana(datumIso) {
  const [y, m, d] = datumIso.split('-').map(Number)
  if (m < 3 || m > 10) return '+01:00'
  if (m > 3 && m < 10) return '+02:00'
  // Robna meseca: preverimo zadnjo nedeljo
  const zadnjaNedelja = (leto, mesec) => {
    const zadnji = new Date(Date.UTC(leto, mesec, 0)).getUTCDate()
    for (let dd = zadnji; dd > zadnji - 7; dd--) {
      if (new Date(Date.UTC(leto, mesec - 1, dd)).getUTCDay() === 0) return dd
    }
    return zadnji
  }
  const preklop = zadnjaNedelja(y, m)
  if (m === 3) return d >= preklop ? '+02:00' : '+01:00'
  return d < preklop ? '+02:00' : '+01:00'
}

/** Sestavi ISO čas s pravilnim offsetom. */
function isoLjubljana(datumIso, uraHhmm) {
  return `${datumIso}T${uraHhmm}:00${offsetLjubljana(datumIso)}`
}

// --- najdi trenutno sezono in kroge, ki še niso odigrani ---------------------
async function naloziKroge() {
  const { data: sez } = await db
    .from('sezone')
    .select('season, tekoca, odigranih')
    .order('season', { ascending: false })
  const sezona =
    sezonaArg ??
    (sez ?? []).find((s) => s.tekoca)?.season ??
    (sez ?? [])[0]?.season
  if (!sezona) throw new Error('Ni najdene sezone.')
  console.log(`Sezona: ${sezona}`)

  const { data: krogi } = await db
    .from('rounds')
    .select('id, number, season, played_on, deadline_at')
    .eq('season', sezona)
    .order('number')
  return { sezona, krogi: krogi ?? [] }
}

// --- razčleni delegacijsko stran enega kroga --------------------------------
function razclenit(html) {
  // Stran je zaporedje vrstic, npr:
  //   "GNL - člani  1. krog"
  //   "29.08.26 ob 16.00"
  //   "Srednja Bela Športni park Preddvor"
  //   "Eltron Preddvor : Tržič 2012"
  // Ker so vse tekme kroga v isti tabeli, pobiramo pare (datum+ura → tekma).
  const vrstice = vBesedilo(html)
  const tekme = []
  let zadnjiDatum = null
  let zadnjaUra = null
  for (const v of vrstice) {
    const m = v.match(/^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+ob\s+(\d{1,2}[.:]\d{2})$/i)
    if (m) {
      zadnjiDatum = datum(m[1])
      zadnjaUra = ura(m[2])
      continue
    }
    const t = v.match(/^(.+?)\s+:\s+(.+?)$/)
    if (t && zadnjiDatum && zadnjaUra && !/^\d+$/.test(t[2])) {
      tekme.push({
        domaci: t[1].trim(),
        gostje: t[2].trim(),
        datum: zadnjiDatum,
        ura: zadnjaUra,
        zacetek: isoLjubljana(zadnjiDatum, zadnjaUra),
      })
    }
  }
  return tekme
}

// --- glavni tok ------------------------------------------------------------
const { sezona, krogi } = await naloziKroge()
console.log(`Krogov v bazi za sezono: ${krogi.length}`)

let posodobljenih = 0
let opozoril = 0
const zdaj = Date.now()

for (const k of krogi) {
  // Preskočimo že odigrane kroge (played_on v preteklosti) — njihov rok ne
  // igra več vloge; postava je posneta.
  if (k.played_on && new Date(k.played_on).getTime() < zdaj - 86400000) continue

  const url =
    `${IZVOR}/print.cfm?prikazi=delegiranje&liga=${liga}` +
    `&krog=${k.number}&sodnik=1&delegat=1&klub=1&liga1=1`
  let html
  try {
    // Sveže — delegacije se pogosto spreminjajo (menjava ur, prestavitve).
    html = await prenesi(url, `delegiranje-${liga}-${k.number}.html`, true)
  } catch (e) {
    console.log(`✗ ${k.number}. krog: prenos ni uspel — ${e.message}`)
    opozoril++
    continue
  }

  const tekme = razclenit(html)
  if (!tekme.length) {
    // Delegacije za oddaljene kroge še ni objavljene — to ni napaka. MNZ
    // običajno delegira 1-3 tedne vnaprej.
    console.log(`  ${k.number}. krog: delegacije še ni (MNZ še ni objavil)`)
    continue
  }

  // Najzgodnejša tekma → rok = zacetek - pomak ur.
  const zacetkiSort = tekme
    .map((t) => new Date(t.zacetek).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  const prvaMs = zacetkiSort[0]
  if (!prvaMs) {
    console.log(`✗ ${k.number}. krog: neveljavni datumi/ur`)
    opozoril++
    continue
  }
  const rokMs = prvaMs - pomakUr * 3600000
  const rokIso = new Date(rokMs).toISOString()
  const prvaTekma = tekme.find(
    (t) => new Date(t.zacetek).getTime() === prvaMs,
  )

  const stariRok = k.deadline_at ? new Date(k.deadline_at).toISOString() : null
  const jeSprememba = stariRok !== rokIso

  console.log(
    `${jeSprememba ? (pisi ? '→' : '·') : '='} ${k.number}. krog: ` +
      `prva tekma ${prvaTekma.domaci} : ${prvaTekma.gostje} ` +
      `${prvaTekma.datum} ob ${prvaTekma.ura} → rok ${new Date(rokMs).toLocaleString('sl-SI', { timeZone: 'Europe/Ljubljana' })}` +
      (jeSprememba ? '' : ' (že enak)'),
  )

  if (!pisi || !jeSprememba) continue

  const { error } = await db
    .from('rounds')
    .update({
      deadline_at: rokIso,
      played_on: prvaTekma.datum,
    })
    .eq('id', k.id)
  if (error) {
    console.log(`  ✗ napaka: ${error.message}`)
    opozoril++
  } else {
    posodobljenih++
  }
}

console.log(
  `\n${pisi ? 'Zapisano' : 'Predogled'}: ${posodobljenih} posodobljenih, ${opozoril} opozoril, pomak = ${pomakUr}h`,
)
if (!pisi) console.log('Za dejanski zapis dodaj `--pisi`.')
