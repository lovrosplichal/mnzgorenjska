// Uvozi razpored tekoče sezone: kroge z datumi in tekme brez rezultata.
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-razporeda.mjs --liga 1601
//   ... --tekmovanje mladinci   (mladinska liga; brez tega člani)
//   ... --pisi        (dejansko zapiše; brez tega samo pokaže, kaj bi naredil)
//   SUPABASE_URL=...  (za projekt v oblaku; sicer vzame VITE_SUPABASE_URL iz .env)
//
// Zapisniki nastanejo šele po odigrani tekmi, zato brez razporeda baza ne ve
// za noben prihodnji krog — igra pa rok potrebuje vnaprej. Razpored da kroge z
// datumi; rezultate in statistiko pozneje doda `uvoz-zapisnikov.mjs`.
//
// Rok kroga postavimo na 10:00 na dan prve tekme v krogu.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { vBesedilo } from './zapisnik.mjs'
import { tekmovanje as najdiTekmovanje } from './tekmovanje.mjs'
import { kljucKluba, kratkoIme } from './klubi.mjs'

const IZVOR = 'https://www.mnzgkranj.si'
const PREDPOMNILNIK = 'scripts/.predpomnilnik'
const URA_ROKA = 10

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
const pisi = process.argv.includes('--pisi')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

const tekmovanje = await najdiTekmovanje(db, arg('tekmovanje', 'clani'))
const liga = arg('liga', tekmovanje.mnzg_liga ?? '1601')
console.log(`Tekmovanje: ${tekmovanje.name} (liga ${liga})`)

async function prenesi(url, ime) {
  const pot = `${PREDPOMNILNIK}/${ime}`
  if (existsSync(pot)) return readFileSync(pot, 'utf8')
  const odgovor = await fetch(url)
  if (!odgovor.ok) throw new Error(`${odgovor.status} ${url}`)
  const html = await odgovor.text()
  if (!existsSync(PREDPOMNILNIK)) mkdirSync(PREDPOMNILNIK, { recursive: true })
  writeFileSync(pot, html)
  return html
}

/** "29.08.26" → "2026-08-29" */
function datum(slovenski) {
  const m = slovenski.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (!m) return null
  const [, d, mes, l] = m
  const leto = l.length === 2 ? 2000 + Number(l) : Number(l)
  return `${leto}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Sezona iz datuma prvega kroga: avgust 2026 → "2026/27". */
function sezonaIz(datumIso) {
  const [leto, mesec] = datumIso.split('-').map(Number)
  const zacetek = mesec >= 7 ? leto : leto - 1
  return `${zacetek}/${String((zacetek + 1) % 100).padStart(2, '0')}`
}

// --- razčlenitev razporeda --------------------------------------------------
const url = `${IZVOR}/index.cfm?akc=tekmovanja&liga=${liga}&prikazi=razpored`
console.log(`Berem razpored: ${url}`)
const html = await prenesi(url, `razpored-${liga}.html`)

// Stran je ena velika tabela: naslov kroga ("1. krog  29.08.26"), pod njim pa
// vrstice "datum" + "Domači : Gostje". Zato beremo kar zaporedje besedila.
const vrstice = vBesedilo(html)

const krogi = []
let tekoci = null
let zadnjiDatum = null

// Ime kluba ima vedno vsaj eno črko. Rezultat ("8 : 1(5 : 0)") je nima — brez
// tega bi vsak že odigran krog dobil še enkrat toliko izmišljenih tekem.
const jeIme = (s) => /[a-zžčšđćA-ZŽČŠĐĆ]/.test(s)

for (const v of vrstice) {
  // Pod razporedom stran nadaljuje z blokom "REZULTATI" DRUGE lige (na strani
  // mladincev so to člani). Brez tega konca bi ti rezultati pristali v bazi
  // kot 19. krog mladincev. Naslov bloka je izpisan z velikimi črkami; enako
  // ime v meniju ("Rezultati") je zato treba pustiti pri miru.
  if (v === 'REZULTATI' && krogi.length) break

  const mKrog = v.match(/^(\d{1,2})\.\s*krog/i)
  if (mKrog) {
    tekoci = { stevilka: Number(mKrog[1]), tekme: [] }
    krogi.push(tekoci)
    zadnjiDatum = datum(v)
    continue
  }
  if (!tekoci) continue

  const mDatum = v.match(/^(\d{1,2}\.\d{1,2}\.\d{2,4})$/)
  if (mDatum) {
    zadnjiDatum = datum(mDatum[1])
    continue
  }

  // "Eltron Preddvor : Tržič 2012" (lahko z datumom na začetku iste vrstice)
  const mTekma = v.match(/^(?:\d{1,2}\.\d{1,2}\.\d{2,4}\s+)?(.+?)\s+:\s+(.+?)$/)
  if (mTekma && jeIme(mTekma[1]) && jeIme(mTekma[2])) {
    const vRstiDatum = datum(v)
    tekoci.tekme.push({
      domaci: mTekma[1].trim(),
      gostje: mTekma[2].trim(),
      datum: vRstiDatum ?? zadnjiDatum,
    })
  }
}

const veljavni = krogi.filter((k) => k.tekme.length)
console.log(`Najdenih krogov: ${veljavni.length}`)
if (!veljavni.length) {
  console.error('Razporeda ni bilo mogoče razbrati — se je stran spremenila?')
  process.exit(1)
}

const prviDatum = veljavni[0].tekme.find((t) => t.datum)?.datum
const sezona = sezonaIz(prviDatum)
console.log(`Sezona: ${sezona}`)
for (const k of veljavni.slice(0, 3))
  console.log(
    `  ${k.stevilka}. krog (${k.tekme[0].datum}): ${k.tekme.length} tekem, npr. ${k.tekme[0].domaci} : ${k.tekme[0].gostje}`,
  )
console.log(`  … skupaj ${veljavni.reduce((v, k) => v + k.tekme.length, 0)} tekem`)

if (!pisi) {
  console.log('\nTo je le predlog. Za zapis v bazo dodaj --pisi')
  process.exit(0)
}

// --- zapis ------------------------------------------------------------------
// Razpored in zapisniki isti klub pišejo različno, zato ga iščemo po ključu iz
// `klubi.mjs` — sicer bi ob vsakem uvozu nastal dvojnik.
const klubi = new Map()
const { data: vsiKlubi } = await db.from('teams').select('id, name')
for (const k of vsiKlubi ?? []) klubi.set(kljucKluba(k.name), k.id)

async function klubId(ime) {
  const kljuc = kljucKluba(ime)
  if (klubi.has(kljuc)) return klubi.get(kljuc)

  const polnoIme = ime.trim()
  const { data, error } = await db
    .from('teams')
    .insert({ name: polnoIme, short_name: kratkoIme(polnoIme) })
    .select('id')
    .single()
  if (error) throw new Error(`klub ${polnoIme}: ${error.message}`)
  console.log(`  nov klub: ${polnoIme}`)
  klubi.set(kljuc, data.id)
  return data.id
}

let novihKrogov = 0
let novihTekem = 0
const letosnjiKlubi = new Set()

for (const k of veljavni) {
  const datumKroga = k.tekme.map((t) => t.datum).filter(Boolean).sort()[0]
  const rok = datumKroga
    ? `${datumKroga}T${String(URA_ROKA).padStart(2, '0')}:00:00+02:00`
    : null

  const { data: obstoj } = await db
    .from('rounds')
    .select('id')
    .eq('competition_id', tekmovanje.id)
    .eq('season', sezona)
    .eq('number', k.stevilka)
    .maybeSingle()

  let krogId = obstoj?.id
  if (!krogId) {
    const { data, error } = await db
      .from('rounds')
      .insert({
        competition_id: tekmovanje.id,
        season: sezona,
        number: k.stevilka,
        played_on: datumKroga,
        deadline_at: rok,
      })
      .select('id')
      .single()
    if (error) {
      console.log(`  krog ${k.stevilka}: ${error.message}`)
      continue
    }
    krogId = data.id
    novihKrogov++
  } else {
    // Datum se lahko prestavi; rok mu sledi, dokler krog še ni odigran.
    await db
      .from('rounds')
      .update({ played_on: datumKroga, deadline_at: rok })
      .eq('id', krogId)
  }

  for (const t of k.tekme) {
    const domaciId = await klubId(t.domaci)
    const gostjeId = await klubId(t.gostje)
    letosnjiKlubi.add(domaciId)
    letosnjiKlubi.add(gostjeId)

    // Pred vstavljanjem preverimo obstoj z .limit(1) namesto .maybeSingle().
    // Prej: .maybeSingle() ob najdbi >1 vrstice vrne napako in `data`=null,
    // kar je koda razumela kot "tekme še ni" in vsakič vstavila še eno kopijo.
    // Tak scenarij se je zgodil po združitvi klubov z različnim zapisom
    // imena (Bled-Bohinj). Zdaj beremo array in preverjamo dolžino, tako da
    // je funkcija odporna tudi na že obstoječe podvojene vrstice.
    const { data: obstojTekme } = await db
      .from('matches')
      .select('id')
      .eq('round_id', krogId)
      .eq('home_team_id', domaciId)
      .eq('away_team_id', gostjeId)
      .limit(1)
    if (obstojTekme && obstojTekme.length > 0) continue

    const { error } = await db.from('matches').insert({
      round_id: krogId,
      home_team_id: domaciId,
      away_team_id: gostjeId,
      played_on: t.datum,
      source_url: url,
    })
    if (error) console.log(`  tekma ${t.domaci} : ${t.gostje}: ${error.message}`)
    else novihTekem++
  }
}

console.log(`\nNovih krogov: ${novihKrogov}, novih tekem: ${novihTekem}`)

// --- kdo letos sploh igra ---------------------------------------------------
// Razpored pove, kateri klubi so v ligi. Igralci klubov, ki jih letos ni,
// ne smejo ostati na trgu — sicer jih kdo kupi in do konca sezone ne dobi
// nobene točke. Pri mladincih to ni izjema, ampak pravilo: vsako leto ena
// generacija odide med člane, kakšen klub pa ekipe sploh ne prijavi.
if (letosnjiKlubi.size) {
  const seznam = [...letosnjiKlubi]
  const { count: deaktiviranih } = await db
    .from('players')
    .update({ active: false }, { count: 'exact' })
    .eq('competition_id', tekmovanje.id)
    .eq('active', true)
    .not('team_id', 'in', `(${seznam.join(',')})`)
  const { count: vrnjenih } = await db
    .from('players')
    .update({ active: true }, { count: 'exact' })
    .eq('competition_id', tekmovanje.id)
    .eq('active', false)
    .in('team_id', seznam)
  console.log(
    `Klubov v tej sezoni: ${seznam.length}; ` +
      `deaktiviranih igralcev zunaj lige: ${deaktiviranih ?? 0}, ` +
      `vrnjenih med aktivne: ${vrnjenih ?? 0}`,
  )
}
