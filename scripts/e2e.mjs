import { createClient } from '@supabase/supabase-js'

// Bere .env, sicer privzame lokalni Supabase stack.
import { readFileSync } from 'node:fs'

function izEnv() {
  try {
    const vsebina = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    return Object.fromEntries(
      vsebina
        .split(String.fromCharCode(10))
        .map((v) => v.trim())
        .filter((v) => v.includes('=') && !v.trim().startsWith('#'))
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
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!ANON) {
  console.error('Manjka VITE_SUPABASE_ANON_KEY (.env).')
  process.exit(1)
}

const fresh = () => createClient(BASE, ANON, { auth: { persistSession: false } })

let fails = 0
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

const stamp = process.argv[2] ?? Date.now().toString(36)

// --- 1. registracija treh uporabnikov -------------------------------------
const users = []
for (let n = 1; n <= 3; n++) {
  const c = fresh()
  const email = `test${n}.${stamp}@example.com`
  const { data, error } = await c.auth.signUp({
    email,
    password: 'geslo123',
    options: { data: { display_name: `Tester ${n}` } },
  })
  if (error) {
    ok(`signup ${email}`, false, error.message)
    process.exit(1)
  }
  users.push({ c, id: data.user.id, email })
}
ok('registracija 3 uporabnikov', users.length === 3)

// profil se je ustvaril prek trigerja
const { data: profil } = await users[0].c
  .from('profiles')
  .select('id, display_name')
  .eq('id', users[0].id)
  .maybeSingle()
ok('trigger ustvari profil', profil?.display_name === 'Tester 1', profil?.display_name)

// --- 2. fantasy ekipa + nabor ---------------------------------------------
const u = users[0]
const { data: ekipa, error: eEkipa } = await u.c
  .from('fantasy_teams')
  .insert({ owner_id: u.id, name: `Ekipa ${stamp}` })
  .select('id')
  .single()
ok('ustvari fantasy ekipo', !eEkipa, eEkipa?.message)

const { data: igralci } = await u.c
  .from('players')
  .select('id, position, team_id')
  .limit(60)

// 11 prvih + 4 na klopi, največ 3 iz kluba
const izbrani = []
const naKlub = {}
for (const p of igralci) {
  if (izbrani.length >= 15) break
  if ((naKlub[p.team_id] ?? 0) >= 3) continue
  naKlub[p.team_id] = (naKlub[p.team_id] ?? 0) + 1
  izbrani.push({
    fantasy_team_id: ekipa.id,
    player_id: p.id,
    is_starter: izbrani.length < 11,
  })
}
const { error: eNabor } = await u.c.from('fantasy_roster').insert(izbrani)
ok('shrani nabor 15 igralcev', !eNabor, eNabor?.message)

// --- 3. RLS: tuj uporabnik ne sme urejati moje ekipe -----------------------
const { error: eTuj } = await users[1].c
  .from('fantasy_teams')
  .update({ name: 'ugrabljeno' })
  .eq('id', ekipa.id)
  .select()
const { data: poNapadu } = await u.c
  .from('fantasy_teams')
  .select('name')
  .eq('id', ekipa.id)
  .single()
ok(
  'RLS: tujec ne more preimenovati ekipe',
  poNapadu.name === `Ekipa ${stamp}`,
  poNapadu.name,
)

// --- 4. glasovanje ---------------------------------------------------------
const { data: krogi } = await u.c
  .from('rounds')
  .select('id, number, voting_opens_at, voting_closes_at')
  .order('number')
const odprt = krogi.find((k) => {
  const z = Date.now()
  return z >= Date.parse(k.voting_opens_at) && z <= Date.parse(k.voting_closes_at)
})
const zaprt = krogi.find((k) => Date.parse(k.voting_closes_at) < Date.now())
ok('obstaja odprt krog', Boolean(odprt), odprt && `krog ${odprt.number}`)

const ocenjeni = izbrani.slice(0, 11).map((s) => s.player_id)
const ocene = [7, 8, 6] // po en glasovalec

for (let n = 0; n < 3; n++) {
  const { error } = await users[n].c.from('ratings').insert(
    ocenjeni.map((pid) => ({
      round_id: odprt.id,
      player_id: pid,
      voter_id: users[n].id,
      rating: ocene[n],
    })),
  )
  ok(`uporabnik ${n + 1} odda ocene`, !error, error?.message)
}

// zaprt krog mora zavrniti glas
const { error: eZaprt } = await u.c.from('ratings').insert({
  round_id: zaprt.id,
  player_id: ocenjeni[0],
  voter_id: u.id,
  rating: 9,
})
ok('RLS: glas v zaprtem krogu zavrnjen', Boolean(eZaprt), eZaprt?.code)

// tuji glasovi niso vidni
const { data: tujiGlasovi } = await users[1].c
  .from('ratings')
  .select('id, voter_id')
  .eq('round_id', odprt.id)
ok(
  'RLS: vidim le svoje ocene',
  tujiGlasovi.every((g) => g.voter_id === users[1].id),
  `${tujiGlasovi.length} vrstic`,
)

// --- 5. preračun točk ------------------------------------------------------
const { error: eRpc } = await u.c.rpc('recompute_round_scores', {
  p_round_id: odprt.id,
})
ok('recompute_round_scores', !eRpc, eRpc?.message)

// Baza lahko že vsebuje demo podatke drugih glasovalcev, zato ne preverjamo
// absolutnih vrednosti, ampak razmerja — ta držijo ne glede na ostale glasove.
const { data: scores } = await u.c
  .from('player_scores')
  .select('player_id, avg_rating, votes_count, points')
  .eq('round_id', odprt.id)
  .in('player_id', ocenjeni)

ok(
  'točke izračunane za vseh 11 ocenjenih igralcev',
  scores.length === ocenjeni.length,
  `${scores.length}/${ocenjeni.length}`,
)
ok(
  'vsak rezultat upošteva vsaj naše 3 glasove',
  scores.every((s) => s.votes_count >= 3),
  scores[0] && `votes=${scores[0].votes_count}`,
)
ok(
  'povprečje je v razponu 1–10 in enako točkam',
  scores.every(
    (s) =>
      Number(s.avg_rating) >= 1 &&
      Number(s.avg_rating) <= 10 &&
      Number(s.points) === Number(s.avg_rating),
  ),
  scores[0] && `avg=${scores[0].avg_rating} points=${scores[0].points}`,
)

// --- 6. lestvica -----------------------------------------------------------
// Lestvica mora biti vsota točk igralcev v prvi postavi.
const prviIgralci = izbrani.filter((s) => s.is_starter).map((s) => s.player_id)
const { data: vseTocke } = await u.c
  .from('player_scores')
  .select('player_id, points')
  .in('player_id', prviIgralci)

const pricakovanaVsota = vseTocke.reduce((v, s) => v + Number(s.points), 0)

const { data: lestvica } = await u.c
  .from('fantasy_team_standings')
  .select('team_name, total_points')
  .order('total_points', { ascending: false })
const moja = lestvica.find((l) => l.team_name === `Ekipa ${stamp}`)

ok(
  'lestvica sešteje točke prve postave',
  Math.abs(Number(moja?.total_points) - pricakovanaVsota) < 0.01,
  `${moja?.total_points} (pričakovano ${pricakovanaVsota.toFixed(2)})`,
)
// Rezerve morajo biti izključene: vsota vseh 15 je večja od vsote prve postave.
const { data: tockeVseh } = await u.c
  .from('player_scores')
  .select('player_id, points')
  .in('player_id', izbrani.map((s) => s.player_id))
const vsotaVseh = tockeVseh.reduce((v, s) => v + Number(s.points), 0)

ok(
  'rezerve ne prinašajo točk',
  vsotaVseh > pricakovanaVsota &&
    Math.abs(Number(moja?.total_points) - pricakovanaVsota) < 0.01,
  `prva postava ${pricakovanaVsota.toFixed(2)} < vseh 15: ${vsotaVseh.toFixed(2)}`,
)

// --- 7. anonimni obiskovalec -----------------------------------------------
const anon = fresh()
const { data: javniIgralci } = await anon.from('players').select('id').limit(5)
const { data: javnaLestvica } = await anon
  .from('fantasy_team_standings')
  .select('team_name')
const { data: anonOcene } = await anon.from('ratings').select('id')
ok('anonimni vidi igralce', javniIgralci?.length === 5)
ok('anonimni vidi lestvico', javnaLestvica?.length > 0)
ok('anonimni ne vidi ocen', (anonOcene ?? []).length === 0)

// --- 8. pospravljanje ------------------------------------------------------
// Testna ekipa se pobriše, da ne umaže lestvice. Testni uporabniki v auth.users
// ostanejo (brisanje zahteva service_role); pobrišeš jih z:
//   node scripts/demo-data.mjs   ali   npm run db:reset
await u.c.from('fantasy_roster').delete().eq('fantasy_team_id', ekipa.id)
const { error: eCist } = await u.c
  .from('fantasy_teams')
  .delete()
  .eq('id', ekipa.id)
const { data: poCiscenju } = await anon
  .from('fantasy_team_standings')
  .select('team_name')
ok(
  'testna ekipa je pospravljena',
  !eCist && !poCiscenju.some((l) => l.team_name === `Ekipa ${stamp}`),
  eCist?.message,
)

console.log(`\n${fails === 0 ? 'VSE OK' : fails + ' NAPAK'}`)
process.exit(fails === 0 ? 0 : 1)
