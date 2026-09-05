// Prebere zapisnike registracijske komisije MNZ Gorenjska in iz njih razbere
// prestope med klubi.
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-registracij.mjs
//   ... --leto 2026     (privzeto tekoče leto)
//   ... --pisi          (dejansko prestavi igralce; brez tega samo poroča)
//   ... --tekmovanje mladinci  (mladinska liga; brez tega člani)
//
// Zapisniki so PDF-i, v njih pa tabela po klubih:
//
//   Klub: NK Kranj (187)
//   235162   Atanasov David   6   NK Sava Kranj   29.03.2026
//            ^ ime            ^člen ^ prejšnji klub
//
// Vrstica s prejšnjim klubom pomeni prestop; vrstica brez njega je nova
// registracija (največkrat mladinec) in nas ne zanima.
//
// POZOR: zapisniki ne povedo selekcije, zato ne vemo, ali gre za člane ali
// mlajše kategorije. Zato prestavimo samo igralce, ki so že v naši bazi (torej
// so lani nastopili v 1. GNL) in le, če se klub dejansko razlikuje. Ujemanje je
// po imenu, kar pri soimenjakih lahko zgreši — zato je privzeto le poročilo.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import zlib from 'node:zlib'
import {
  slugTekmovanja,
  tekmovanje as najdiTekmovanje,
} from './tekmovanje.mjs'
import { viraZa } from './viri/index.mjs'

const IZVOR = 'https://www.mnzgkranj.si'
const PREDPOMNILNIK = 'scripts/.predpomnilnik'

// V zapisnikih so uradna imena klubov, v tekmovanju pa tržna. Preslikava velja
// samo za klube 1. GNL; ostale (mladinske, drugih lig) preskočimo.
const IMENA_KLUBOV = {
  'nk kranj': 'Zarica Kranj',
  'nk zarica kranj': 'Zarica Kranj',
  'nk sava kranj': 'Sava Kranj',
  'nk bitnje': 'Topdom Dom Trade Bitnje',
  'nk britof': 'Britof',
  'nk jezero medvode': 'Jezero Medvode',
  'nk niko zelezniki': 'Niko Železniki',
  'nk bohinj': 'Bled - Bohinj Hirter',
  'nk bled': 'Bled - Bohinj Hirter',
  'nk kranjska gora': 'Kranjska Gora',
  'nk trzic 2012': 'Tržič 2012',
  'sd storzic preddvor': 'Eltron Preddvor',
  'nk preddvor': 'Eltron Preddvor',
  'sd visoko': 'Visoko',
  'nk velesovo': 'Velesovo - Cerklje',
  'nk velesovo cerklje': 'Velesovo - Cerklje',
  'nk polet': 'Polet',
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
const leto = arg('leto', String(new Date().getFullYear()))
const pisi = process.argv.includes('--pisi')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// Tekmovanje razrešimo takoj: iz njega dobimo vir, ta pa naslove — potrebni
// so že pri seznamu zapisnikov niže.
const tekmovanje = await najdiTekmovanje(db, slugTekmovanja())
const vir = viraZa(tekmovanje)
console.log(`Tekmovanje: ${tekmovanje.name}`)

const poenostavi = (ime) =>
  (ime ?? '')
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// --- PDF -------------------------------------------------------------------
// Zapisniki so iz Skie in uporabljajo CID pisave: besedilo je zapisano kot
// kode glifov, zato ga je treba prevesti prek tabele ToUnicode.
function pdfVBesedilo(buf) {
  const lat = buf.toString('latin1')
  const tokovi = []
  const re = /stream\r?\n/g
  let m
  while ((m = re.exec(lat))) {
    const start = m.index + m[0].length
    const end = lat.indexOf('endstream', start)
    if (end < 0) continue
    try {
      tokovi.push(zlib.inflateSync(buf.slice(start, end)).toString('latin1'))
    } catch {
      /* nestisnjen tok */
    }
  }

  const cmap = new Map()
  const vHex = (hex) => {
    let s = ''
    for (let i = 0; i < hex.length; i += 4)
      s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
    return s
  }
  for (const t of tokovi) {
    for (const blok of t.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? [])
      for (const v of blok.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))
        cmap.set(parseInt(v[1], 16), vHex(v[2]))
    for (const blok of t.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? [])
      for (const v of blok.matchAll(
        /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
      )) {
        const od = parseInt(v[1], 16)
        const doo = parseInt(v[2], 16)
        const zac = parseInt(v[3], 16)
        for (let i = od; i <= doo; i++)
          cmap.set(i, String.fromCodePoint(zac + (i - od)))
      }
  }

  const prevedi = (hex) => {
    let s = ''
    for (let i = 0; i + 4 <= hex.length; i += 4)
      s += cmap.get(parseInt(hex.slice(i, i + 4), 16)) ?? ''
    return s
  }

  const vrstice = []
  for (const t of tokovi) {
    if (!t.includes('Tj') && !t.includes('TJ')) continue
    for (const kos of t.split(/(?:Td|TD|T\*|ET)\s/)) {
      const deli = []
      for (const v of kos.matchAll(/<([0-9A-Fa-f]+)>/g)) deli.push(prevedi(v[1]))
      const vrstica = deli.join('').replace(/\s+/g, ' ').trim()
      if (vrstica) vrstice.push(vrstica)
    }
  }
  return vrstice
}

async function prenesi(url, ime) {
  const pot = `${PREDPOMNILNIK}/${ime}`
  if (existsSync(pot)) return readFileSync(pot)
  const odgovor = await fetch(url)
  if (!odgovor.ok) throw new Error(`${odgovor.status}`)
  const buf = Buffer.from(await odgovor.arrayBuffer())
  if (!existsSync(PREDPOMNILNIK)) mkdirSync(PREDPOMNILNIK, { recursive: true })
  writeFileSync(pot, buf)
  return buf
}

// --- seznam zapisnikov -----------------------------------------------------
const stran = await (await fetch(vir.naslovRegistracij())).text()
const dokumenti = [
  ...new Set(
    [...stran.matchAll(/href="(dokumenti\/[^"]*?-(\d{4})\.pdf)"/g)]
      .filter((m) => m[2] === leto)
      .map((m) => m[1]),
  ),
]
console.log(`Zapisnikov za leto ${leto}: ${dokumenti.length}`)

// --- razčlenitev -----------------------------------------------------------
const prestopi = []
for (const dok of dokumenti) {
  let vrstice
  try {
    const buf = await prenesi(
      vir.naslovDokumenta(dok),
      dok.split('/').pop(),
    )
    vrstice = pdfVBesedilo(buf)
  } catch (e) {
    console.log(`  ${dok}: ${e.message}`)
    continue
  }

  let klub = null
  for (let i = 0; i < vrstice.length; i++) {
    const v = vrstice[i]

    const mKlub = v.match(/^Klub:\s*(.+?)\s*\(\d+\)\s*$/)
    if (mKlub) {
      klub = mKlub[1].trim()
      continue
    }
    // Vrstica z registrsko številko odpre zapis; ime je takoj za njo.
    if (!/^\d{5,7}$/.test(v)) continue

    const ime = vrstice[i + 1]
    const clen = vrstice[i + 2]
    const naslednja = vrstice[i + 3] ?? ''
    // Prejšnji klub je tam, kjer ni datuma.
    const prejsnji = /^\d{2}\.\d{2}\.\d{4}$/.test(naslednja) ? null : naslednja
    if (!prejsnji || !klub || !ime) continue

    prestopi.push({
      stevilka: v,
      ime,
      clen,
      iz: prejsnji,
      v: klub,
      dokument: dok.split('/').pop(),
    })
  }
}

console.log(`Najdenih zapisov s prejšnjim klubom: ${prestopi.length}`)

// --- ujemanje z našo bazo --------------------------------------------------
const { data: klubi } = await db.from('teams').select('id, name')
const klubPoImenu = new Map((klubi ?? []).map((k) => [poenostavi(k.name), k.id]))
const naKlub = (uradno) => {
  const kljuc = poenostavi(uradno)
  const preslikano = IMENA_KLUBOV[kljuc]
  return klubPoImenu.get(poenostavi(preslikano ?? uradno)) ?? null
}

// Zapisnik selekcije ne pove, zato prestavljamo v eni ligi naenkrat: če je
// isti fant v bazi kot mladinec in kot član, sicer ne bi vedeli, katerega
// od obeh zapisov popraviti.

const { data: igralci } = await db
  .from('players')
  .select('id, full_name, team_id, teams(name)')
  .eq('competition_id', tekmovanje.id)
const igralecPoImenu = new Map()
for (const p of igralci ?? []) igralecPoImenu.set(poenostavi(p.full_name), p)

const zaPrestavitev = []
const preskoceni = []
for (const p of prestopi) {
  const igralec = igralecPoImenu.get(poenostavi(p.ime))
  if (!igralec) {
    preskoceni.push(`${p.ime} (ni v naši bazi — najbrž mlajša selekcija)`)
    continue
  }
  const novKlub = naKlub(p.v)
  if (!novKlub) {
    preskoceni.push(`${p.ime} → ${p.v} (klub ni v 1. GNL)`)
    continue
  }
  if (novKlub === igralec.team_id) continue
  zaPrestavitev.push({ ...p, igralec, novKlub })
}

console.log(`\nPrestopi znotraj 1. GNL: ${zaPrestavitev.length}`)
for (const p of zaPrestavitev)
  console.log(
    `  ${p.ime.padEnd(26)} ${String(p.igralec.teams?.name ?? '?').padEnd(24)} → ${p.v}   (${p.dokument})`,
  )

if (preskoceni.length) {
  console.log(`\nPreskočenih: ${preskoceni.length}`)
  for (const s of preskoceni.slice(0, 10)) console.log(`  ${s}`)
  if (preskoceni.length > 10) console.log(`  … in še ${preskoceni.length - 10}`)
}

if (!pisi) {
  console.log('\nTo je le poročilo. Za prestavitev v bazi dodaj --pisi')
  process.exit(0)
}

let prestavljenih = 0
for (const p of zaPrestavitev) {
  const { error } = await db
    .from('players')
    .update({ team_id: p.novKlub })
    .eq('id', p.igralec.id)
  if (error) console.log(`  ${p.ime}: ${error.message}`)
  else prestavljenih++
}
console.log(`\nPrestavljenih igralcev: ${prestavljenih}`)
