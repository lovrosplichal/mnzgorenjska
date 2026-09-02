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

// Testi tečejo skozi RLS z javnim ključem. Servisni ključ rabimo le za
// pospravljanje na koncu: glasovi potrdijo asistenco in pozicijo, kar navaden
// uporabnik ne sme razveljaviti.
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = SERVICE
  ? createClient(BASE, SERVICE, { auth: { persistSession: false } })
  : null

let fails = 0
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

const stamp = process.argv[2] ?? Date.now().toString(36)

// --- 0. predpogoji ---------------------------------------------------------
const anon = fresh()

// Pragova bereva iz baze, ne iz konstante v testu: asistenca in pozicija ju
// imata različna in se dasta spremeniti brez posega v kodo.
const { data: nastavitve } = await anon.from('settings').select('key, value')
const nastavitev = (kljuc, privzeto) =>
  Number((nastavitve ?? []).find((n) => n.key === kljuc)?.value ?? privzeto)
const PRAG_ASISTENCE = nastavitev('prag_glasov_asistenca', 3)
const PRAG_POZICIJE = nastavitev('prag_glasov_pozicija', 5)
const PRAG = Math.max(PRAG_ASISTENCE, PRAG_POZICIJE) // toliko testnih glasovalcev
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
  // Enajstmetrovka in avtogol asistence nimata in sta že zaklenjena, prav tako
  // gol, o katerem je skupnost odločila, da podajalca ni — o teh ni glasovanja.
  .eq('is_penalty', false)
  .is('assist_player_id', null)
  .is('assist_none_confirmed_at', null)
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
for (let n = 0; n < PRAG_ASISTENCE - 1; n++) {
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
  `pri ${PRAG_ASISTENCE - 1} glasovih asistenca še ni potrjena`,
  podPragom.assist_player_id === null,
)

// zadnji glas doseže prag
await users[PRAG_ASISTENCE - 1].c.from('assist_votes').insert({
  goal_id: gol.id,
  voter_id: users[PRAG_ASISTENCE - 1].id,
  player_id: podajalec,
})
const { data: nadPragom } = await anon
  .from('goals')
  .select('assist_player_id, assist_confirmed_at')
  .eq('id', gol.id)
  .single()
ok(
  `pri ${PRAG_ASISTENCE} glasovih se asistenca potrdi`,
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
// Brez pozicije ni več nikogar — vsak igralec ima vsaj ugibanje iz statistike,
// sicer ga ne bi bilo mogoče postaviti na igrišče. Glasovanje mora zato znati
// popraviti prav ugibanje.
const { data: brezPozicije } = await u.c
  .from('players')
  .select('id, full_name, position, position_source')
  .eq('position_source', 'ugibanje')
  .limit(1)
  .single()
ok('najden igralec z ugibano pozicijo', Boolean(brezPozicije))

// Glasujemo za pozicijo, ki je različna od ugibanja, da je popravek razviden.
const novaPozicija = brezPozicije?.position === 'MID' ? 'DEF' : 'MID'

// Prag pozicije ni fiksen: močan statistični prior ga zniža (adaptivni_prag).
// Test mora zato vprašati bazo, koliko glasov je v TEM primeru dovolj.
const { data: pragPozicije } = await anon.rpc('adaptivni_prag', {
  p_player_id: brezPozicije.id,
  p_position: novaPozicija,
})
const PRAG_TEGA = Math.min(PRAG_POZICIJE, Number(pragPozicije ?? PRAG_POZICIJE))

for (let n = 0; n < PRAG_TEGA - 1; n++)
  await users[n].c
    .from('position_votes')
    .insert({
      player_id: brezPozicije.id,
      voter_id: users[n].id,
      position: novaPozicija,
    })
const { data: pozPod } = await anon
  .from('players')
  .select('position, position_source')
  .eq('id', brezPozicije.id)
  .single()
ok(
  `pri ${PRAG_TEGA - 1} glasovih pozicija še ni potrjena`,
  pozPod.position_source === 'ugibanje',
  pozPod.position_source,
)

await users[PRAG_TEGA - 1].c.from('position_votes').insert({
  player_id: brezPozicije.id,
  voter_id: users[PRAG_TEGA - 1].id,
  position: novaPozicija,
})
const { data: pozNad } = await anon
  .from('players')
  .select('position, position_source')
  .eq('id', brezPozicije.id)
  .single()
ok(
  `pri ${PRAG_TEGA} glasovih se ugibanje popravi`,
  pozNad.position === novaPozicija && pozNad.position_source === 'glasovanje',
  `${pozNad.position}/${pozNad.position_source}`,
)

// Pozicija odloča, koliko je vreden gol in ohranjena mreža, zato se morajo
// točke osvežiti takoj — sicer lestvica do naslednjega uvoza kaže stanje,
// kakršno je bilo, ko je pozicijo poznal samo vratar.
const { data: izNastopov } = await anon
  .from('appearance_points')
  .select('points')
  .eq('player_id', brezPozicije.id)
const { data: izLestvice } = await anon
  .from('player_scores')
  .select('points')
  .eq('player_id', brezPozicije.id)
const vsota = (v) => (v ?? []).reduce((s, x) => s + Number(x.points ?? 0), 0)
ok(
  'točke sledijo potrjeni poziciji',
  Math.abs(vsota(izNastopov) - vsota(izLestvice)) < 0.01,
  `player_scores ${vsota(izLestvice)} proti nastopom ${vsota(izNastopov)}`,
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

// Rok tega kroga je davno mimo, zato ekipa brez posnetka v njem nima postave.
// Tako je tudi prav — kdor se pridruži pozneje, za odigrane kroge ne dobi točk.
// Za preizkus lestvice krog izrecno zaklenemo, kar naredi posnetek postave.
if (admin) {
  const { data: predZaklepom } = await anon
    .from('fantasy_team_standings')
    .select('total_points')
    .eq('fantasy_team_id', ekipa.id)
    .single()
  ok(
    'brez posnetka pretekli krog ne prinese točk',
    Number(predZaklepom?.total_points) === 0,
    `${predZaklepom?.total_points}`,
  )
  await admin.rpc('zakleni_krog', { p_round_id: krog.id })
} else {
  console.log('OPOMBA  brez servisnega ključa preskočen preizkus posnetka postave')
}

// Pričakovana vsota: točke zaklenjenega kroga za postavo po samodejnih
// menjavah, pomnožene s kapetanovim množiteljem. Lestvica sme šteti samo
// zaklenjeni krog, ne vseh krogov, v katerih so ti igralci kdaj nastopili.
const { data: ucinkovita } = await (admin ?? u.c).rpc('ucinkovita_postava', {
  p_team: ekipa.id,
  p_round: krog.id,
})
const { data: tocke } = await u.c
  .from('player_scores')
  .select('player_id, points')
  .eq('round_id', krog.id)
  .in(
    'player_id',
    (ucinkovita ?? []).map((x) => x.player_id),
  )
const pricakovanaVsota = (ucinkovita ?? []).reduce((v, x) => {
  const t = (tocke ?? []).find((p) => p.player_id === x.player_id)
  return v + Number(t?.points ?? 0) * x.mnozitelj
}, 0)

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

// --- 11b. borza se premakne samo za odigran krog ----------------------------
// Cena se sme premakniti šele, ko je krog res odigran, in samo takrat. Uvožen
// arhiv prejšnje sezone ima točke po krogih; če bi ga borza obračunala, bi
// cene čez noč poskočile za formo, ki je v izhodiščni ceni že upoštevana.
if (admin) {
  const preveriBorzo = async (opis, krog) => {
    if (!krog) return
    const { data, error } = await admin.rpc('preracunaj_cene', {
      p_round_id: krog.id,
    })
    ok(
      `borza ne premakne cen: ${opis}`,
      !error && (data ?? []).length === 0,
      error?.message ?? `${(data ?? []).length} premikov`,
    )
  }

  // Krog prejšnje sezone — arhiv, ki je le izhodišče za ceno.
  const { data: sezone } = await anon
    .from('rounds')
    .select('season')
    .order('season', { ascending: false })
  const zadnja = sezone?.[0]?.season
  const { data: arhivski } = await anon
    .from('rounds')
    .select('id, season, number')
    .neq('season', zadnja)
    .limit(1)
    .maybeSingle()
  await preveriBorzo('krog prejšnje sezone', arhivski)

  // Krog, ki še ni bil odigran (ni uvožene tekme).
  const { data: neodigran } = await anon
    .from('rounds')
    .select('id, number, matches!inner(imported_at)')
    .eq('season', zadnja)
    .is('matches.imported_at', null)
    .limit(1)
    .maybeSingle()
  await preveriBorzo('neodigran krog', neodigran)
}

// --- 12. dve ligi ostaneta ločeni ------------------------------------------
// Isti uporabnik ima lahko ekipo v vsaki ligi, mladinca pa v člansko ekipo ne
// more postaviti. Brez tega bi se ligi na tihem pomešali že ob prvem prestopu.
let mladinec = null
let ekipaM = null
if (admin) {
  const { data: mladinci } = await anon
    .from('competitions')
    .select('id')
    .eq('slug', 'mladinci')
    .maybeSingle()

  const { data: ekipaMlad, error: eEkipaM } = await u.c
    .from('fantasy_teams')
    .insert({
      owner_id: u.id,
      competition_id: mladinci.id,
      name: `Mladinci ${stamp}`,
    })
    .select('id, competition_id')
    .single()
  ekipaM = ekipaMlad
  ok('ista oseba ima ekipo v obeh ligah', !eEkipaM, eEkipaM?.message)

  const { data: nekKlub } = await anon.from('teams').select('id').limit(1).single()
  const { data: novMladinec } = await admin
    .from('players')
    .insert({
      competition_id: mladinci.id,
      team_id: nekKlub.id,
      full_name: `Testni Mladinec ${stamp}`,
      last_name: 'Testni',
      first_name: `Mladinec ${stamp}`,
      position: 'MID',
      position_source: 'admin',
    })
    .select('id')
    .single()
  mladinec = novMladinec

  const { error: eTujec } = await u.c.rpc('shrani_ekipo', {
    p_team_id: ekipa.id,
    p_roster: [{ player_id: mladinec.id, is_starter: true }],
  })
  ok('mladinec ne more v člansko ekipo', Boolean(eTujec), eTujec?.message)

  const { count: seVednoNabor } = await anon
    .from('fantasy_roster')
    .select('player_id', { count: 'exact', head: true })
    .eq('fantasy_team_id', ekipa.id)
  ok('zavrnjeno shranjevanje pusti kader pri miru', seVednoNabor === 15)
}

// --- 13. pospravljanje ------------------------------------------------------------
await u.c.from('fantasy_roster').delete().eq('fantasy_team_id', ekipa.id)
await u.c.from('fantasy_teams').delete().eq('id', ekipa.id)
if (ekipaM) await u.c.from('fantasy_teams').delete().eq('id', ekipaM.id)
if (mladinec) await admin.from('players').delete().eq('id', mladinec.id)
for (const usr of users) {
  await usr.c.from('assist_votes').delete().eq('voter_id', usr.id)
  await usr.c.from('position_votes').delete().eq('voter_id', usr.id)
}
// Glasovi so potrdili asistenco in pozicijo; brez povrnitve bi naslednji zagon
// tekel nad podatki, ki jih je pustil prejšnji, in test asistence bi padel.
if (admin) {
  await admin.from('goals').update({ assist_player_id: null }).eq('id', gol.id)
  await admin
    .from('players')
    .update({
      position: brezPozicije.position,
      position_source: brezPozicije.position_source,
    })
    .eq('id', brezPozicije.id)
} else {
  console.log(
    'OPOMBA  brez SUPABASE_SERVICE_ROLE_KEY potrjena asistenca in pozicija ostaneta — naslednji zagon naj uporabi drug gol',
  )
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
