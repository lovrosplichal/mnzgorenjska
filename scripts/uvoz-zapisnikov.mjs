// Uvozi zapisnike MNZ Gorenjska v bazo.
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-zapisnikov.mjs --liga 1502
//   ... --liga 1502 --omeji 5      (samo prvih 5 tekem, za preizkus)
//   ... --liga 1502 --pocisti      (najprej pobriše demo klube in igralce)
//
// Igralce prepozna po klubu in imenu. Vratarja postavi iz oznake (V) v
// zapisniku; ostale pozicije določi glasovanje uporabnikov.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { parsirajZapisnik, nastopi } from './zapisnik.mjs'

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
  console.error('Manjka SUPABASE_SERVICE_ROLE_KEY (dobiš ga z: npx supabase status)')
  process.exit(1)
}

const liga = arg('liga', '1502')
const omeji = arg('omeji') ? Number(arg('omeji')) : null
const pocisti = Boolean(arg('pocisti'))

const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- prenos s predpomnilnikom ---------------------------------------------
if (!existsSync(PREDPOMNILNIK)) mkdirSync(PREDPOMNILNIK, { recursive: true })

async function prenesi(url, datoteka) {
  const pot = `${PREDPOMNILNIK}/${datoteka}`
  if (existsSync(pot)) return readFileSync(pot, 'utf8')
  const odgovor = await fetch(url)
  if (!odgovor.ok) throw new Error(`${url} -> HTTP ${odgovor.status}`)
  const besedilo = await odgovor.text()
  writeFileSync(pot, besedilo)
  return besedilo
}

// --- predpomnilnik za klube in igralce -------------------------------------
const klubi = new Map() // ime -> id
const igralci = new Map() // `${team_id}|${ime}` -> id

async function klubId(ime) {
  const kljuc = ime.trim()
  if (klubi.has(kljuc)) return klubi.get(kljuc)

  const { data: obstoj } = await db
    .from('teams')
    .select('id')
    .eq('name', kljuc)
    .maybeSingle()
  if (obstoj) {
    klubi.set(kljuc, obstoj.id)
    return obstoj.id
  }

  const kratko = kljuc
    .split(/\s+/)
    .map((d) => d[0])
    .join('')
    .toUpperCase()
    .slice(0, 4)
  const { data, error } = await db
    .from('teams')
    .insert({ name: kljuc, short_name: kratko })
    .select('id')
    .single()
  if (error) throw new Error(`klub ${kljuc}: ${error.message}`)
  klubi.set(kljuc, data.id)
  return data.id
}

// V zapisniku je ime zapisano kot "Priimek Ime" (lahko več besed).
function razdeliIme(polno) {
  const deli = polno.trim().split(/\s+/)
  if (deli.length === 1) return { priimek: deli[0], ime: '' }
  return { priimek: deli[0], ime: deli.slice(1).join(' ') }
}

/**
 * Vrne id igralca; po potrebi ga ustvari.
 *
 * Igralca prepoznamo po klubu in imenu. V isti ekipi se lahko pojavita dva
 * soimenjaka (npr. Niko Železniki imajo dva "Potočnik Matic", št. 6 in 8),
 * zato ju v takem primeru ločimo še po številki dresa. Številke ne uporabimo
 * vedno, ker isti igralec med sezono lahko zamenja dres.
 */
async function igralecId(teamId, polnoIme, { vratar, st, dvoumno = false }) {
  const kljuc = `${teamId}|${polnoIme}${dvoumno ? '#' + st : ''}`
  if (igralci.has(kljuc)) return igralci.get(kljuc)

  let poizvedba = db
    .from('players')
    .select('id, position, position_source')
    .eq('team_id', teamId)
    .eq('full_name', polnoIme)
  if (dvoumno) poizvedba = poizvedba.eq('shirt_number', st)

  const { data: zadetki } = await poizvedba.limit(1)
  const obstoj = zadetki?.[0]

  if (obstoj) {
    igralci.set(kljuc, obstoj.id)
    // vratar iz zapisnika povozi ugibanje
    if (vratar && obstoj.position_source !== 'admin')
      await db
        .from('players')
        .update({ position: 'GK', position_source: 'zapisnik', shirt_number: st })
        .eq('id', obstoj.id)
    return obstoj.id
  }

  const { priimek, ime } = razdeliIme(polnoIme)
  const { data, error } = await db
    .from('players')
    .insert({
      team_id: teamId,
      full_name: polnoIme,
      last_name: priimek,
      first_name: ime,
      shirt_number: st,
      position: vratar ? 'GK' : null,
      position_source: vratar ? 'zapisnik' : 'neznano',
    })
    .select('id')
    .single()
  if (error) throw new Error(`igralec ${polnoIme}: ${error.message}`)
  igralci.set(kljuc, data.id)
  return data.id
}

async function krogId(sezona, stevilka, datum) {
  const { data: obstoj } = await db
    .from('rounds')
    .select('id')
    .eq('season', sezona)
    .eq('number', stevilka)
    .maybeSingle()
  if (obstoj) return obstoj.id

  const { data, error } = await db
    .from('rounds')
    .insert({ season: sezona, number: stevilka, played_on: datum })
    .select('id')
    .single()
  if (error) throw new Error(`krog ${sezona}/${stevilka}: ${error.message}`)
  return data.id
}

// --- čiščenje demo podatkov -------------------------------------------------
if (pocisti) {
  console.log('Brišem demo podatke ...')
  await db.from('players').delete().like('last_name', '%-%')
  const { data: prazniKlubi } = await db.from('teams').select('id, name')
  for (const k of prazniKlubi ?? []) {
    const { count } = await db
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', k.id)
    if (!count) await db.from('teams').delete().eq('id', k.id)
  }
  console.log('Demo podatki pobrisani.')
}

// --- seznam zapisnikov ------------------------------------------------------
const seznamUrl = `${IZVOR}/index.cfm?akc=tekmovanja&liga=${liga}`
console.log(`Berem seznam tekem: ${seznamUrl}`)
const seznam = await prenesi(seznamUrl, `liga-${liga}.html`)
let ids = [...new Set([...seznam.matchAll(/zapisnik=(\d+)/g)].map((m) => m[1]))]
ids.sort((a, b) => Number(a) - Number(b))
if (omeji) ids = ids.slice(0, omeji)
console.log(`Najdenih zapisnikov: ${ids.length}`)

let uvozenih = 0
let preskocenih = 0
const vsaOpozorila = []

for (const id of ids) {
  const url = `${IZVOR}/index.cfm?akc=zapisnik&liga=${liga}&zapisnik=${id}`
  let html
  try {
    html = await prenesi(url, `${id}.html`)
  } catch (e) {
    console.log(`  ${id}: prenos ni uspel — ${e.message}`)
    preskocenih++
    continue
  }

  const z = parsirajZapisnik(html, { zapisnikId: id, url })
  if (!z) {
    preskocenih++
    continue
  }
  if (!z.sezona || z.krog == null) {
    console.log(`  ${id}: manjka sezona ali krog — preskočeno`)
    preskocenih++
    continue
  }

  try {
    const domaciId = await klubId(z.domaci.ime)
    const gostjeId = await klubId(z.gostje.ime)
    const rId = await krogId(z.sezona, z.krog, z.datum)

    // tekma
    const { data: tekma, error: eTekma } = await db
      .from('matches')
      .upsert(
        {
          round_id: rId,
          home_team_id: domaciId,
          away_team_id: gostjeId,
          home_goals: z.rezultat.domaci,
          away_goals: z.rezultat.gostje,
          played_on: z.datum,
          zapisnik_id: id,
          source_url: url,
          imported_at: new Date().toISOString(),
          import_warnings: z.opozorila,
        },
        { onConflict: 'zapisnik_id' },
      )
      .select('id')
      .single()
    if (eTekma) throw new Error(eTekma.message)

    // ob ponovnem uvozu podatke tekme prepišemo
    await db.from('goals').delete().eq('match_id', tekma.id)
    await db.from('appearances').delete().eq('match_id', tekma.id)

    // nastopi
    const n = nastopi(z)

    // imena, ki se v isti ekipi pojavijo večkrat (soimenjaki)
    const stejIme = new Map()
    for (const x of n) {
      const k = `${x.ekipaIdx}|${x.ime}`
      stejIme.set(k, (stejIme.get(k) ?? 0) + 1)
    }
    const jeDvoumno = (x) => (stejIme.get(`${x.ekipaIdx}|${x.ime}`) ?? 0) > 1

    const idPoStevilki = new Map() // `${ekipaIdx}|${st}` -> player_id
    const vrstice = []
    for (const x of n) {
      const tId = x.ekipaIdx === 0 ? domaciId : gostjeId
      const pId = await igralecId(tId, x.ime, {
        vratar: x.vratar,
        st: x.st,
        dvoumno: jeDvoumno(x),
      })
      idPoStevilki.set(`${x.ekipaIdx}|${x.st}`, pId)
      vrstice.push({
        match_id: tekma.id,
        player_id: pId,
        team_id: tId,
        shirt_number: x.st,
        started: x.zacetnik,
        minute_on: x.minutaOd,
        minute_off: x.minutaDo,
        minutes_played: x.minute,
        goals: x.goli,
        own_goals: x.avtogoli,
        penalties_scored: x.goliIzEnajstmetrovke,
        penalties_missed: x.zgreseneEnajstmetrovke,
        yellow_cards: x.rumeni,
        red_cards: x.rdeci,
        goals_conceded: x.prejetiGoli,
        clean_sheet: x.cleanSheet,
      })
    }
    const { error: eNastopi } = await db.from('appearances').insert(vrstice)
    if (eNastopi) throw new Error(eNastopi.message)

    // goli
    const goliVrstice = []
    for (const g of z.goli) {
      const tId = g.ekipaIdx === 0 ? domaciId : gostjeId
      let pId = idPoStevilki.get(`${g.ekipaIdx}|${g.st}`)
      if (!pId) pId = await igralecId(tId, g.ime, { vratar: false, st: g.st })
      goliVrstice.push({
        match_id: tekma.id,
        scorer_id: pId,
        team_id: tId,
        minute: g.minuta,
        is_own_goal: g.avtogol,
        is_penalty: g.enajstmetrovka,
        score_home: g.rezultat?.[0] ?? null,
        score_away: g.rezultat?.[1] ?? null,
      })
    }
    if (goliVrstice.length) {
      const { error: eGoli } = await db.from('goals').insert(goliVrstice)
      if (eGoli) throw new Error(eGoli.message)
    }

    uvozenih++
    if (z.opozorila.length)
      vsaOpozorila.push(`${id} (${z.domaci.ime} — ${z.gostje.ime}): ${z.opozorila.join('; ')}`)
    process.stdout.write(
      `\r  uvoženih: ${uvozenih}/${ids.length}  (preskočenih: ${preskocenih})   `,
    )
  } catch (e) {
    console.log(`\n  ${id}: napaka — ${e.message}`)
    preskocenih++
  }
}

console.log(`\n\nUvoženih tekem: ${uvozenih}, preskočenih: ${preskocenih}`)

// --- preračun točk po krogih -------------------------------------------------
const { data: krogi } = await db.from('rounds').select('id, season, number')
for (const k of krogi ?? []) {
  const { error } = await db.rpc('recompute_round_scores', { p_round_id: k.id })
  if (error) console.log(`  krog ${k.season}/${k.number}: ${error.message}`)
}
console.log(`Točke preračunane za ${krogi?.length ?? 0} krogov.`)

// --- povzetek ----------------------------------------------------------------
const { count: stKlubov } = await db
  .from('teams')
  .select('id', { count: 'exact', head: true })
const { count: stIgralcev } = await db
  .from('players')
  .select('id', { count: 'exact', head: true })
const { count: stGolov } = await db
  .from('goals')
  .select('id', { count: 'exact', head: true })
const { count: brezPozicije } = await db
  .from('players')
  .select('id', { count: 'exact', head: true })
  .is('position', null)

console.log(`\nKlubov: ${stKlubov}, igralcev: ${stIgralcev}, golov: ${stGolov}`)
console.log(`Igralcev brez pozicije (čakajo na glasovanje): ${brezPozicije}`)

if (vsaOpozorila.length) {
  console.log(`\nOpozorila iz zapisnikov (${vsaOpozorila.length}):`)
  for (const o of vsaOpozorila.slice(0, 15)) console.log('  ' + o)
  if (vsaOpozorila.length > 15)
    console.log(`  ... in še ${vsaOpozorila.length - 15}`)
}
