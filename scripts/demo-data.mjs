// Ustvari demo uporabnike, fantasy ekipe in ocene za vse kroge.
// Uporablja service_role ključ, da lahko zapolni tudi že zaprte kroge.
// SAMO ZA LOKALNI RAZVOJ — nikoli ne poganjaj proti produkciji.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

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
const BASE = env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) {
  console.error(
    'Manjka SUPABASE_SERVICE_ROLE_KEY. Dobiš ga z ukazom: npx supabase status',
  )
  process.exit(1)
}
if (!BASE.includes('127.0.0.1') && !BASE.includes('localhost')) {
  console.error('Ta skripta je namenjena le lokalnemu stacku. Prekinjam.')
  process.exit(1)
}

const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// determinističen psevdo-naključni generator, da so podatki ponovljivi
let seme = 42
const nakljucno = () => {
  seme = (seme * 1103515245 + 12345) % 2147483648
  return seme / 2147483648
}
const izberi = (arr) => arr[Math.floor(nakljucno() * arr.length)]

const IMENA = [
  'Gorenjski Orli',
  'Sokoli s Save',
  'Triglavski Zmaji',
  'Karavanke FC',
  'Dolina Šampionov',
  'Kranjski Levi',
]

const { data: igralci } = await db
  .from('players')
  .select('id, position, team_id')
  .eq('active', true)
const { data: krogi } = await db.from('rounds').select('id, number').order('number')
console.log(`Najdenih ${igralci.length} igralcev, ${krogi.length} krogov.`)

// --- demo uporabniki + ekipe ----------------------------------------------
const uporabniki = []
for (let n = 0; n < IMENA.length; n++) {
  const email = `navijac${n + 1}@example.com`
  const { data: obstoj } = await db.auth.admin.listUsers({ perPage: 200 })
  let user = obstoj.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: 'geslo123',
      email_confirm: true,
      user_metadata: { display_name: IMENA[n] },
    })
    if (error) {
      console.error(email, error.message)
      continue
    }
    user = data.user
  }
  uporabniki.push({ id: user.id, ime: IMENA[n] })
}
console.log(`Demo uporabnikov: ${uporabniki.length}`)

// --- fantasy ekipe ---------------------------------------------------------
for (const u of uporabniki) {
  const { data: obstoj } = await db
    .from('fantasy_teams')
    .select('id')
    .eq('owner_id', u.id)
    .maybeSingle()

  let ekipaId = obstoj?.id
  if (!ekipaId) {
    const { data, error } = await db
      .from('fantasy_teams')
      .insert({ owner_id: u.id, name: u.ime })
      .select('id')
      .single()
    if (error) {
      console.error(u.ime, error.message)
      continue
    }
    ekipaId = data.id
  }

  await db.from('fantasy_roster').delete().eq('fantasy_team_id', ekipaId)

  // 1 GK, 4 DEF, 4 MID, 2 FWD v prvi postavi + 4 na klopi, max 3 iz kluba
  const kvota = { GK: 2, DEF: 5, MID: 5, FWD: 3 }
  const prvih = { GK: 1, DEF: 4, MID: 4, FWD: 2 }
  const naKlub = {}
  const nabor = []
  for (const poz of ['GK', 'DEF', 'MID', 'FWD']) {
    const bazen = igralci.filter((p) => p.position === poz)
    let dodani = 0
    let poskusi = 0
    while (dodani < kvota[poz] && poskusi < 500) {
      poskusi++
      const p = izberi(bazen)
      if (nabor.some((x) => x.player_id === p.id)) continue
      if ((naKlub[p.team_id] ?? 0) >= 3) continue
      naKlub[p.team_id] = (naKlub[p.team_id] ?? 0) + 1
      nabor.push({
        fantasy_team_id: ekipaId,
        player_id: p.id,
        is_starter: dodani < prvih[poz],
      })
      dodani++
    }
  }
  const { error } = await db.from('fantasy_roster').insert(nabor)
  if (error) console.error(u.ime, error.message)
}
console.log('Fantasy ekipe sestavljene.')

// --- tocke -----------------------------------------------------------------
// Tocke izhajajo iz statistike zapisnikov, ne iz ocen: tabelo `ratings` je
// odstranila migracija 20260827130000_odstrani_ocenjevanje.sql. Tu zato samo
// prezenemo preracun za vsak krog, da lestvica ni prazna.
for (const krog of krogi) {
  const { error } = await db.rpc('recompute_round_scores', {
    p_round_id: krog.id,
  })
  console.log(
    `Krog ${krog.number}: ${error ? 'RPC napaka: ' + error.message : 'tocke preracunane'}`,
  )
}

const { data: lestvica } = await db
  .from('fantasy_team_standings')
  .select('team_name, total_points')
  .order('total_points', { ascending: false })
console.log('\nLestvica:')
for (const [i, l] of lestvica.entries())
  console.log(`  ${i + 1}. ${l.team_name} — ${Number(l.total_points).toFixed(1)}`)
