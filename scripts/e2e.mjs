// End-to-end preverjanje proti bazi: registracija, RLS, glasovanje o
// asistencah in pozicijah, točkovanje iz zapisnikov in lestvica.
//
// Zahteva uvožene zapisnike (node scripts/uvoz-zapisnikov.mjs).
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
const PRAG = 5

// --- 0. predpogoji ---------------------------------------------------------
const anon = fresh()
const { count: stTekem } = await anon
  .from('matches')
  .select('id', { count: 'exact', head: true })
if (!stTekem) {
  console.error(
    'V bazi ni tekem. Najprej poženi: node scripts/uvoz-zapisnikov.mjs --liga 1502',
  )
  process.exit(1)
}

// --- 1. registracija -------------------------------------------------------
const users = []
for (let n = 1; n <= PRAG; n++) {
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
ok(`registracija ${PRAG} uporabnikov`, users.length === PRAG)

const { data: profil } = await users[0].c
  .from('profiles')
  .select('display_name')
  .eq('id', users[0].id)
  .maybeSingle()
ok('trigger ustvari profil', profil?.display_name === 'Tester 1')

// --- 2. javno branje -------------------------------------------------------
const { data: javniIgralci } = await anon
  .from('player_overview')
  .select('id, full_name, value')
  .limit(5)
ok('anonimni vidi igralce', javniIgralci?.length === 5)

const { data: javneTekme } = await anon.from('matches').select('id').limit(3)
ok('anonimni vidi tekme', javneTekme?.length === 3)

// --- 3. glasovanje o asistenci ---------------------------------------------
const u = users[0]
const { data: gol } = await u.c
  .from('goals')
  .select('id, match_id, team_id, scorer_id, assist_player_id')
  .eq('is_own_goal', false)
  .is('assist_player_id', null)
  .limit(1)
  .single()
ok('najden gol brez asistence', Boolean(gol))

const { data: soigralci } = await u.c
  .from('appearances')
  .select('player_id')
  .eq('match_id', gol.match_id)
  .eq('team_id', gol.team_id)
  .neq('player_id', gol.scorer_id)
  .gt('minutes_played', 0)
  .limit(2)
const podajalec = soigralci[0].player_id
const drugi = soigralci[1].player_id

// prvi glasovi (pod pragom)
for (let n = 0; n < PRAG - 1; n++) {
  const { error } = await users[n].c
    .from('assist_votes')
    .insert({ goal_id: gol.id, voter_id: users[n].id, player_id: podajalec })
  if (error) ok(`glas ${n + 1}`, false, error.message)
}
const { data: podPragom } = await anon
  .from('goals')
  .select('assist_player_id')
  .eq('id', gol.id)
  .single()
ok(
  `pri ${PRAG - 1} glasovih asistenca še ni potrjena`,
  podPragom.assist_player_id === null,
)

// zadnji glas doseže prag
await users[PRAG - 1].c
  .from('assist_votes')
  .insert({ goal_id: gol.id, voter_id: users[PRAG - 1].id, player_id: podajalec })
const { data: nadPragom } = await anon
  .from('goals')
  .select('assist_player_id, assist_confirmed_at')
  .eq('id', gol.id)
  .single()
ok(
  `pri ${PRAG} glasovih se asistenca potrdi`,
  nadPragom.assist_player_id === podajalec,
  `${nadPragom.assist_player_id}`,
)

// --- 4. RLS pri glasovanju --------------------------------------------------
const { error: eTujGlas } = await users[1].c
  .from('assist_votes')
  .insert({ goal_id: gol.id, voter_id: users[0].id, player_id: drugi })
ok('RLS: ne morem glasovati v tujem imenu', Boolean(eTujGlas), eTujGlas?.code)

const { count: mojihGlasov } = await users[1].c
  .from('assist_votes')
  .select('id', { count: 'exact', head: true })
  .eq('voter_id', users[1].id)
ok('vsak uporabnik ima svoj glas', mojihGlasov === 1)

// --- 5. asistenca prinese točke ---------------------------------------------
const { data: nastopPodajalca } = await anon
  .from('appearance_points')
  .select('assists, points, position')
  .eq('match_id', gol.match_id)
  .eq('player_id', podajalec)
  .single()
ok(
  'potrjena asistenca se pripiše nastopu',
  nastopPodajalca.assists === 1,
  `assists=${nastopPodajalca.assists}`,
)

// --- 6. glasovanje o poziciji ------------------------------------------------
const { data: brezPozicije } = await u.c
  .from('players')
  .select('id, full_name')
  .is('position', null)
  .limit(1)
  .single()
ok('najden igralec brez pozicije', Boolean(brezPozicije))

for (let n = 0; n < PRAG - 1; n++)
  await users[n].c
    .from('position_votes')
    .insert({ player_id: brezPozicije.id, voter_id: users[n].id, position: 'MID' })
const { data: pozPod } = await anon
  .from('players')
  .select('position')
  .eq('id', brezPozicije.id)
  .single()
ok(`pri ${PRAG - 1} glasovih pozicija še ni potrjena`, pozPod.position === null)

await users[PRAG - 1].c
  .from('position_votes')
  .insert({
    player_id: brezPozicije.id,
    voter_id: users[PRAG - 1].id,
    position: 'MID',
  })
const { data: pozNad } = await anon
  .from('players')
  .select('position, position_source')
  .eq('id', brezPozicije.id)
  .single()
ok(
  `pri ${PRAG} glasovih se pozicija potrdi`,
  pozNad.position === 'MID' && pozNad.position_source === 'glasovanje',
  `${pozNad.position}/${pozNad.position_source}`,
)

// --- 7. vratar iz zapisnika ni odvisen od glasovanja ------------------------
const { data: vratar } = await anon
  .from('players')
  .select('id, position, position_source')
  .eq('position_source', 'zapisnik')
  .limit(1)
  .single()
ok(
  'vratarja določi zapisnik, ne glasovanje',
  vratar?.position === 'GK',
  `${vratar?.position}`,
)

// --- 8. točkovanje po pravilih -----------------------------------------------
// 90 minut + brez prejetega gola za vratarja = 2 + 4 = 6
const { data: vratarCS } = await anon
  .from('appearance_points')
  .select('points, minutes_played, clean_sheet, goals, assists, goals_conceded')
  .eq('position', 'GK')
  .eq('clean_sheet', true)
  .eq('minutes_played', 90)
  .eq('goals', 0)
  .eq('assists', 0)
  .limit(1)
  .single()
ok(
  'vratar 90 min brez prejetega gola = 6 točk',
  Number(vratarCS?.points) === 6,
  `${vratarCS?.points}`,
)

// prejeti goli: -1 za vsaka 2
const { data: vratarPrejeti } = await anon
  .from('appearance_points')
  .select('points, minutes_played, goals_conceded, goals, assists')
  .eq('position', 'GK')
  .eq('minutes_played', 90)
  .eq('clean_sheet', false)
  .eq('goals', 0)
  .eq('assists', 0)
  .gte('goals_conceded', 2)
  .limit(1)
  .single()
if (vratarPrejeti) {
  const pricakovano = 2 - Math.floor(vratarPrejeti.goals_conceded / 2)
  ok(
    'vratar: -1 za vsaka 2 prejeta gola',
    Number(vratarPrejeti.points) === pricakovano,
    `prejetih ${vratarPrejeti.goals_conceded} -> ${vratarPrejeti.points}, pričakovano ${pricakovano}`,
  )
}

// --- 9. fantasy ekipa in proračun --------------------------------------------
const { data: ekipa, error: eEkipa } = await u.c
  .from('fantasy_teams')
  .insert({ owner_id: u.id, name: `Ekipa ${stamp}` })
  .select('id, budget')
  .single()
ok('ustvari fantasy ekipo', !eEkipa, eEkipa?.message)
ok('ekipa ima privzet proračun', Number(ekipa?.budget) === 100)

const { data: poceni } = await u.c
  .from('player_overview')
  .select('id, value, team_id')
  .order('value')
  .limit(40)

const izbrani = []
const naKlub = {}
for (const p of poceni) {
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

const { data: proracun } = await u.c
  .from('fantasy_team_budget')
  .select('spent, remaining, budget')
  .eq('fantasy_team_id', ekipa.id)
  .single()
ok(
  'proračun se sešteje',
  Math.abs(Number(proracun.budget) - Number(proracun.spent) - Number(proracun.remaining)) < 0.01,
  `${proracun.spent} porabljeno, ${proracun.remaining} ostane`,
)

// --- 10. RLS na ekipi ---------------------------------------------------------
await users[1].c
  .from('fantasy_teams')
  .update({ name: 'ugrabljeno' })
  .eq('id', ekipa.id)
const { data: poNapadu } = await anon
  .from('fantasy_teams')
  .select('name')
  .eq('id', ekipa.id)
  .single()
ok(
  'RLS: tujec ne more preimenovati ekipe',
  poNapadu.name === `Ekipa ${stamp}`,
  poNapadu.name,
)

// --- 11. lestvica ---------------------------------------------------------------
const { data: krog } = await anon.from('rounds').select('id').limit(1).single()
await u.c.rpc('recompute_round_scores', { p_round_id: krog.id })

const prviIgralci = izbrani.filter((s) => s.is_starter).map((s) => s.player_id)
const { data: tocke } = await u.c
  .from('player_scores')
  .select('points')
  .in('player_id', prviIgralci)
const pricakovanaVsota = (tocke ?? []).reduce((v, s) => v + Number(s.points), 0)

const { data: lestvica } = await anon
  .from('fantasy_team_standings')
  .select('team_name, owner_name, total_points')
  .order('total_points', { ascending: false })
const moja = lestvica.find((l) => l.team_name === `Ekipa ${stamp}`)
ok(
  'lestvica sešteje točke prve postave',
  Math.abs(Number(moja?.total_points) - pricakovanaVsota) < 0.01,
  `${moja?.total_points} (pričakovano ${pricakovanaVsota.toFixed(2)})`,
)
ok('lestvica pokaže lastnika', moja?.owner_name === 'Tester 1', moja?.owner_name)

// --- 12. pospravljanje ------------------------------------------------------------
await u.c.from('fantasy_roster').delete().eq('fantasy_team_id', ekipa.id)
await u.c.from('fantasy_teams').delete().eq('id', ekipa.id)
for (const usr of users) {
  await usr.c.from('assist_votes').delete().eq('voter_id', usr.id)
  await usr.c.from('position_votes').delete().eq('voter_id', usr.id)
}
const { data: poCiscenju } = await anon
  .from('fantasy_team_standings')
  .select('team_name')
ok(
  'testni podatki so pospravljeni',
  !poCiscenju.some((l) => l.team_name === `Ekipa ${stamp}`),
)

console.log(`\n${fails === 0 ? 'VSE OK' : fails + ' NAPAK'}`)
process.exit(fails === 0 ? 0 : 1)
