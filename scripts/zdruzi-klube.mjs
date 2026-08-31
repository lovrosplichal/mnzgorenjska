// Združi podvojene klube. Isti klub je v bazi dvakrat, kadar ga vir zapiše
// drugače ("Bled Bohinj Hirter" proti "Bled - Bohinj Hirter"): uvoz zapisnikov
// je nekoč iskal po natančnem imenu in je ob prvem zapisniku nove sezone
// ustvaril nov klub. Sezona se je s tem razklala na dva zapisa — grb in
// zgodovina pri starem, letošnji nastopi pri novem.
//
// Kaj se preseli iz odvečnega v obdržani klub: players, appearances, goals,
// matches (doma in v gosteh). Odvečni klub se nato izbriše.
//
// Igralcev ta skript ne združuje — po njem poženi `zdruzi-duplikate.mjs`, ki
// zna spojiti dva zapisa iste osebe (isto ime, časovnici se ne prekrivata).
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/zdruzi-klube.mjs        # predogled
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/zdruzi-klube.mjs --pisi # zapiši
//
// Privzeto dvojnike najde sam; z `--odvecni <id> --obdrzi <id>` mu par določiš.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { MAX_IZ_KLUBA } from '../src/lib/pravila.js'

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

const pisi = process.argv.includes('--pisi')
const arg = (ime) => {
  const i = process.argv.indexOf('--' + ime)
  return i > -1 ? process.argv[i + 1] : null
}

const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// Enako poenostavljanje kot pri uvozu: brez ločil in velikih črk.
const poenostavi = (ime) =>
  ime
    .toLowerCase()
    .replace(/[^a-zčšž0-9]+/g, ' ')
    .trim()

async function prestej(tabela, stolpec, id) {
  const { count } = await db
    .from(tabela)
    .select('id', { count: 'exact', head: true })
    .eq(stolpec, id)
  return count ?? 0
}

/** Kaj vse visi na klubu — po tem se odločimo, kateri zapis obdržimo. */
async function popis(id) {
  return {
    igralci: await prestej('players', 'team_id', id),
    nastopi: await prestej('appearances', 'team_id', id),
    goli: await prestej('goals', 'team_id', id),
    doma: await prestej('matches', 'home_team_id', id),
    gostje: await prestej('matches', 'away_team_id', id),
  }
}

const opisKluba = (k, p) =>
  `${p.igralci} igralcev, ${p.nastopi} nastopov, ${p.goli} golov, ` +
  `${p.doma + p.gostje} tekem, ${k.logo_url ? 'ima grb' : 'brez grba'}`

const { data: klubi, error: napakaKlubov } = await db
  .from('teams')
  .select('id, name, short_name, logo_url')
  .order('id')
if (napakaKlubov) {
  console.error('Klubov ni bilo mogoče prebrati:', napakaKlubov.message)
  process.exit(1)
}

// --- kateri pari se združijo ------------------------------------------------
const pari = []
if (arg('odvecni') && arg('obdrzi')) {
  const odvecni = klubi.find((k) => k.id === Number(arg('odvecni')))
  const obdrzi = klubi.find((k) => k.id === Number(arg('obdrzi')))
  if (!odvecni || !obdrzi) {
    console.error('Kluba s tema id-jema ni.')
    process.exit(1)
  }
  pari.push({ odvecni, obdrzi })
} else {
  const skupine = new Map()
  for (const k of klubi) {
    const kljuc = poenostavi(k.name)
    if (!skupine.has(kljuc)) skupine.set(kljuc, [])
    skupine.get(kljuc).push(k)
  }
  for (const zapisi of skupine.values()) {
    if (zapisi.length < 2) continue
    // Obdržimo tistega z največ zgodovine; ob izenačenju starejši zapis.
    const zPopisom = []
    for (const z of zapisi) zPopisom.push({ ...z, popis: await popis(z.id) })
    zPopisom.sort((a, b) => b.popis.nastopi - a.popis.nastopi || a.id - b.id)
    const [obdrzi, ...ostali] = zPopisom
    for (const odvecni of ostali) pari.push({ odvecni, obdrzi })
  }
}

if (pari.length === 0) {
  console.log('Podvojenih klubov ni.')
  process.exit(0)
}

// --- predogled in združevanje ------------------------------------------------
for (const { odvecni, obdrzi } of pari) {
  const pOdvecni = odvecni.popis ?? (await popis(odvecni.id))
  const pObdrzi = obdrzi.popis ?? (await popis(obdrzi.id))

  console.log('')
  console.log(
    `${odvecni.name} (id ${odvecni.id}) → ${obdrzi.name} (id ${obdrzi.id})`,
  )
  console.log(`  odvečni:  ${opisKluba(odvecni, pOdvecni)}`)
  console.log(`  obdržani: ${opisKluba(obdrzi, pObdrzi)}`)

  // Kdo se bo po selitvi podvojil po imenu — to pospravi zdruzi-duplikate.mjs.
  const { data: igralciOdvecnega } = await db
    .from('players')
    .select('id, full_name')
    .eq('team_id', odvecni.id)
  const { data: igralciObdrzanega } = await db
    .from('players')
    .select('id, full_name')
    .eq('team_id', obdrzi.id)
  const imena = new Set((igralciObdrzanega ?? []).map((i) => i.full_name))
  const dvojniki = (igralciOdvecnega ?? []).filter((i) => imena.has(i.full_name))
  console.log(
    `  po selitvi bo ${dvojniki.length} igralcev z istim imenom` +
      (dvojniki.length ? `: ${dvojniki.map((d) => d.full_name).join(', ')}` : ''),
  )

  // Fantasy ekipe, ki bi po združitvi presegle mejo igralcev iz enega kluba.
  const vsiIdji = [
    ...(igralciOdvecnega ?? []).map((i) => i.id),
    ...(igralciObdrzanega ?? []).map((i) => i.id),
  ]
  if (vsiIdji.length) {
    const { data: nabori } = await db
      .from('fantasy_roster')
      .select('fantasy_team_id, player_id, fantasy_teams(name)')
      .in('player_id', vsiIdji)
    const poEkipah = new Map()
    for (const n of nabori ?? []) {
      const e = poEkipah.get(n.fantasy_team_id) ?? {
        ime: n.fantasy_teams?.name ?? `ekipa ${n.fantasy_team_id}`,
        n: 0,
      }
      e.n++
      poEkipah.set(n.fantasy_team_id, e)
    }
    const prevec = [...poEkipah.values()].filter((e) => e.n > MAX_IZ_KLUBA)
    console.log(
      prevec.length
        ? `  POZOR: ${prevec.length} ekip bo imelo več kot ${MAX_IZ_KLUBA} igralce iz kluba: ` +
            prevec.map((e) => `${e.ime} (${e.n})`).join(', ')
        : `  nobena fantasy ekipa ne preseže meje ${MAX_IZ_KLUBA} igralcev iz kluba`,
    )
  }

  if (!pisi) {
    console.log('  (predogled — za zapis dodaj --pisi)')
    continue
  }

  for (const [tabela, stolpec] of [
    ['players', 'team_id'],
    ['appearances', 'team_id'],
    ['goals', 'team_id'],
    ['matches', 'home_team_id'],
    ['matches', 'away_team_id'],
  ]) {
    const { data, error } = await db
      .from(tabela)
      .update({ [stolpec]: obdrzi.id })
      .eq(stolpec, odvecni.id)
      .select('id')
    if (error) console.log(`  ${tabela}.${stolpec}: NAPAKA ${error.message}`)
    else console.log(`  ${tabela}.${stolpec}: preseljenih ${data?.length ?? 0}`)
  }

  // Grb prevzame obdržani klub, če ga sam nima.
  if (!obdrzi.logo_url && odvecni.logo_url) {
    await db
      .from('teams')
      .update({ logo_url: odvecni.logo_url })
      .eq('id', obdrzi.id)
    console.log('  grb prenesen na obdržani klub')
  }

  const { error: napakaBrisanja } = await db
    .from('teams')
    .delete()
    .eq('id', odvecni.id)
  console.log(
    napakaBrisanja
      ? `  klub ${odvecni.id} NI izbrisan: ${napakaBrisanja.message}`
      : `  klub ${odvecni.id} izbrisan`,
  )
}

if (pisi)
  console.log(
    '\nZdaj poženi še `node scripts/zdruzi-duplikate.mjs --pisi`, ' +
      'da se spojijo podvojeni zapisi istih igralcev.',
  )
