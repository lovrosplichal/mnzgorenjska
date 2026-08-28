// Ročni popravki podatkov o igralcih — pozicije in klub.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/popravki-igralcev.mjs        (predogled)
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/popravki-igralcev.mjs --pisi (zapiši)
//
// Popravki so trdno zapisani spodaj. Uporabi `--pisi`, da jih dejansko
// zapiše v bazo. Pozicija se zapiše z `position_source='admin'`, kar
// pomeni, da je glasovanje skupnosti ne more več spremeniti.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// --- popravki ---------------------------------------------------------------
// Vsak popravek išče igralca po `ime` (ILIKE po polnem imenu). Če `klub`
// ni prazen, mora ustrezati tudi trenutni ali prihodnji klub (za razdvajanje
// istoimenih igralcev). `pozicija` ali `noviKlub` naj bo NULL, če se le ta
// popravlja.
const POPRAVKI = [
  { ime: 'Rok Jamšek',           pozicija: 'MID', noviKlub: null },
  { ime: 'Žiga Jerman',          pozicija: 'FWD', noviKlub: null },
  { ime: 'Rok Robert Mohorič',   pozicija: 'DEF', noviKlub: null },
  { ime: 'Aleksander Duraković', pozicija: 'DEF', noviKlub: null },
  { ime: 'Luka Markič',          pozicija: 'MID', noviKlub: null },
  { ime: 'Gal Lunder',           pozicija: 'DEF', noviKlub: null },
  { ime: 'Goodnews Daniel',      pozicija: 'FWD', noviKlub: null },
  { ime: 'Jakob Snedic',         pozicija: 'FWD', noviKlub: null },
  { ime: 'Lovro Gal Janc',       pozicija: 'FWD', noviKlub: null },
  { ime: 'Mark Klavora',         pozicija: 'DEF', noviKlub: null },
  { ime: 'Lovro Splichal',       pozicija: 'MID', noviKlub: null },
  { ime: 'Jaša Drobnjak',        pozicija: 'FWD', noviKlub: null },
  { ime: 'Djuran Matija Čarman', pozicija: 'DEF', noviKlub: null },
  { ime: 'Edi Japić',            pozicija: 'DEF', noviKlub: null },
  { ime: 'Matic Bertoncelj',     pozicija: 'DEF', noviKlub: null },
  { ime: 'Tine Trojanšek',       pozicija: 'DEF', noviKlub: null },
  { ime: 'Nejc Cvitkovič',       pozicija: 'DEF', noviKlub: null },
  { ime: 'Tim Vrečič',           pozicija: 'DEF', noviKlub: null },
  { ime: 'Nesad Bajramović',     pozicija: 'DEF', noviKlub: null },
  { ime: 'Žiga Bizant',          pozicija: 'DEF', noviKlub: null },
  { ime: 'Tim Matič',            pozicija: 'MID', noviKlub: null },
  { ime: 'Ažbe Repič',           pozicija: 'MID', noviKlub: null },
  { ime: 'Luka Prestor',         pozicija: 'MID', noviKlub: null },
  { ime: 'Žan Peklaj',           pozicija: 'MID', noviKlub: null },
  { ime: 'Gregor Kern',          pozicija: 'FWD', noviKlub: null },
  { ime: 'Gal Ribnikar',         pozicija: 'MID', noviKlub: 'Preddvor' },
  { ime: 'Čarman Djuran Simon',  pozicija: 'FWD', noviKlub: null },
  // Bor Repič je bil pri drugem klubu — premakni v Eltron Preddvor.
  { ime: 'Bor Repič',            pozicija: null,  noviKlub: 'Preddvor' },
  // Ročno postavljena vrednost — nastavi tudi value_locked=true, da naslednji
  // ovrednoti-igralce.mjs ne prepiše.
  { ime: 'Žiga Dobnikar',        pozicija: null,  noviKlub: null, vrednost: 8.0 },
]

// Novi igralci, ki jih uvoz zapisnikov še ni zajel (npr. sveži prestopi).
// `klub` je delna oznaka imena kluba. `pozicija` se zapiše z virom 'admin'.
// Številko dresa in podatke NZS lahko admin dopolni pozneje prek /admin.
const NOVI_IGRALCI = [
  {
    prvo: 'Luka',
    priimek: 'Gajič',
    klub: 'Medvode',
    pozicija: 'FWD',
    stevilka: null,
  },
]

// Igralci, ki v ligi niso več aktivni (odšli, prekinili). Postavimo
// `active=false`; podatki ostanejo (za zgodovino), a se ne pojavljajo več
// na trgu, v postavah in v razvrstitvah.
const NEAKTIVNI = [
  'Alex Marolt Nagode',
  'Filip Iliev',
  'Mihail Jovanov', // v DB "Jovanov Mihail" (ne Mihael)
  // 'Gašper Fender' — v bazi ga ni, preskočeno
]

// --- okolje -----------------------------------------------------------------
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
  console.error('Manjka SUPABASE_SERVICE_ROLE_KEY (npx supabase status).')
  process.exit(1)
}
const pisi = process.argv.includes('--pisi')
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- klubi za lookup --------------------------------------------------------
const { data: klubi, error: eK } = await db.from('teams').select('id, name')
if (eK) {
  console.error('Napaka pri branju klubov:', eK.message)
  process.exit(1)
}
function najdiKlub(kljuc) {
  if (!kljuc) return null
  const najdeni = klubi.filter((k) =>
    k.name.toLowerCase().includes(kljuc.toLowerCase()),
  )
  if (najdeni.length === 0) return { napaka: `Klub s ključem "${kljuc}" ni najden` }
  if (najdeni.length > 1)
    return {
      napaka: `Klub "${kljuc}" ni enolično: ${najdeni.map((k) => k.name).join(', ')}`,
    }
  return najdeni[0]
}

// --- obdelava ---------------------------------------------------------------
let uspehov = 0
let opozoril = 0
for (const p of POPRAVKI) {
  // Baza hrani ime kot "Priimek Ime" — iskanje je neodvisno od vrstnega
  // reda: vsak del imena mora biti v full_name.
  let q = db
    .from('player_overview')
    .select('id, full_name, team_id, team_name, position, position_source, value')
  for (const del of p.ime.split(/\s+/).filter(Boolean)) {
    q = q.ilike('full_name', `%${del}%`)
  }
  const { data: kandidati, error: eI } = await q
  if (eI) {
    console.log(`✗ ${p.ime}: napaka pri iskanju — ${eI.message}`)
    opozoril++
    continue
  }
  if (!kandidati?.length) {
    console.log(`✗ ${p.ime}: ni igralca s tem imenom`)
    opozoril++
    continue
  }
  if (kandidati.length > 1) {
    console.log(
      `✗ ${p.ime}: najdenih več (${kandidati.map((c) => `${c.full_name}/${c.team_name}`).join(', ')}) — dopolni ime`,
    )
    opozoril++
    continue
  }
  const igralec = kandidati[0]

  const spremembe = {}
  const opis = []

  if (p.pozicija && (igralec.position !== p.pozicija || igralec.position_source !== 'admin')) {
    spremembe.position = p.pozicija
    spremembe.position_source = 'admin'
    opis.push(
      `pozicija ${igralec.position ?? '—'} → ${p.pozicija} (admin)`,
    )
  }

  if (p.noviKlub) {
    const klub = najdiKlub(p.noviKlub)
    if (klub?.napaka) {
      console.log(`✗ ${p.ime}: ${klub.napaka}`)
      opozoril++
      continue
    }
    if (klub.id !== igralec.team_id) {
      spremembe.team_id = klub.id
      opis.push(`klub ${igralec.team_name} → ${klub.name}`)
    }
  }

  if (p.vrednost != null) {
    const nova = Number(p.vrednost)
    if (Number(igralec.value) !== nova) {
      spremembe.value = nova
      spremembe.value_locked = true
      opis.push(`vrednost ${igralec.value} → ${nova} (zaklenjena)`)
    }
  }

  if (!Object.keys(spremembe).length) {
    console.log(`= ${igralec.full_name}: že v skladu s popravkom`)
    continue
  }

  console.log(`${pisi ? '→' : '·'} ${igralec.full_name}: ${opis.join('; ')}`)
  if (!pisi) continue

  const { error: eU } = await db
    .from('players')
    .update(spremembe)
    .eq('id', igralec.id)
  if (eU) {
    console.log(`  ✗ napaka: ${eU.message}`)
    opozoril++
  } else {
    uspehov++
  }
}

// --- novi igralci -----------------------------------------------------------
let dodanih = 0
for (const n of NOVI_IGRALCI) {
  // Baza uporablja konvencijo "Priimek Ime".
  const polnoIme = `${n.priimek} ${n.prvo}`.trim()

  // Ali igralec s tem imenom in klubom že obstaja? Če ja, preskočimo (raje
  // ga admin popravi kot da naredimo dvojnika).
  const klub = najdiKlub(n.klub)
  if (klub?.napaka) {
    console.log(`✗ ${polnoIme}: ${klub.napaka}`)
    opozoril++
    continue
  }
  const { data: obstoj } = await db
    .from('players')
    .select('id')
    .ilike('full_name', `%${polnoIme}%`)
    .eq('team_id', klub.id)
    .maybeSingle()
  if (obstoj) {
    console.log(`= ${polnoIme}: že obstaja v ${klub.name}`)
    continue
  }

  console.log(
    `${pisi ? '→' : '·'} DODAJ ${polnoIme} (${klub.name}, ${n.pozicija})`,
  )
  if (!pisi) continue

  const { error: eD } = await db.from('players').insert({
    team_id: klub.id,
    first_name: n.prvo,
    last_name: n.priimek,
    full_name: polnoIme,
    position: n.pozicija,
    position_source: 'admin',
    shirt_number: n.stevilka ?? null,
    active: true,
  })
  if (eD) {
    console.log(`  ✗ napaka: ${eD.message}`)
    opozoril++
  } else {
    dodanih++
  }
}

// --- neaktivni --------------------------------------------------------------
let deaktiviranih = 0
for (const ime of NEAKTIVNI) {
  let q = db.from('player_overview').select('id, full_name, team_name')
  for (const del of ime.split(/\s+/).filter(Boolean)) {
    q = q.ilike('full_name', `%${del}%`)
  }
  const { data: najdeni } = await q
  if (!najdeni?.length) {
    console.log(`✗ ${ime}: ni najden (že odstranjen?)`)
    opozoril++
    continue
  }
  if (najdeni.length > 1) {
    console.log(
      `✗ ${ime}: več zadetkov (${najdeni.map((n) => n.full_name).join(', ')})`,
    )
    opozoril++
    continue
  }
  const i = najdeni[0]
  console.log(
    `${pisi ? '→' : '·'} DEAKTIVIRAJ ${i.full_name} (${i.team_name})`,
  )
  if (!pisi) continue
  const { error: eA } = await db
    .from('players')
    .update({ active: false })
    .eq('id', i.id)
  if (eA) {
    console.log(`  ✗ napaka: ${eA.message}`)
    opozoril++
  } else {
    deaktiviranih++
  }
}

console.log(
  `\n${pisi ? 'Zapisano' : 'Predogled'}: ${uspehov} popravkov, ${dodanih} dodanih, ${deaktiviranih} deaktiviranih, ${opozoril} opozoril`,
)
if (!pisi)
  console.log('Za dejanski zapis dodaj `--pisi`.')
