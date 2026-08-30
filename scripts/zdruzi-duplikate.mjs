// Samodejno prepozna igralce, ki so verjetno "duplikati" — dva ali več
// zapisov z istim polnim imenom, ki predstavljajo isto osebo (klasičen
// prestop med klubi ali sprememba številke dresa).
//
// Merger je varen samo, če se časovnice NE PREKRIVAJO. Če imata dva
// zapisa nastope v istem obdobju, sta to skoraj gotovo različni osebi
// z istim imenom (v amaterski Sloveniji so nekatera imena zelo pogosta).
//
// Kaj se preseli iz OLD v NEW: appearances, goals (scorer/assist),
// player_scores, price_changes, assist_votes, position_votes,
// position_priors, fantasy_roster, fantasy_lineups. OLD player se
// nato izbriše.
//
// Uporaba:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/zdruzi-duplikate.mjs        # predogled
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/zdruzi-duplikate.mjs --pisi # zapiši
//
// Zagon: dnevni cron po uvozu zapisnikov (glej .github/workflows/...).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const PREVEC_DUPLIKATOV = 3 // pri več kot 3 zapisih ne mergamo — v amaterski
// ligi ni verjetno, da bi bila ena oseba imela 4 zapise, in mnoštvo pomeni,
// da so to pač soimenjaki

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
const db = createClient(BASE, SERVICE, { auth: { persistSession: false } })

// --- najdi kandidate za merga -----------------------------------------------
async function najdiPare() {
  const { data: p } = await db
    .from('players')
    .select('id, full_name, team_id, shirt_number, active')
  const skupine = new Map()
  for (const x of p) {
    if (!skupine.has(x.full_name)) skupine.set(x.full_name, [])
    skupine.get(x.full_name).push(x)
  }
  const kandidati = []
  for (const [ime, arr] of skupine) {
    if (arr.length < 2 || arr.length > PREVEC_DUPLIKATOV) continue
    kandidati.push({ ime, zapisi: arr })
  }
  return kandidati
}

// --- časovnica nastopov za igralca ------------------------------------------
async function casovnica(playerId) {
  const { data } = await db
    .from('appearances')
    .select('matches(played_on)')
    .eq('player_id', playerId)
    .order('matches(played_on)', { ascending: true })
  const datumi = (data ?? [])
    .map((a) => a.matches?.played_on)
    .filter(Boolean)
    .sort()
  return { prvi: datumi[0] ?? null, zadnji: datumi[datumi.length - 1] ?? null, n: datumi.length }
}

// --- ali se dva razpona prekrivata -------------------------------------------
function prekrivataSe(a, b) {
  if (!a.prvi || !b.prvi) return false // vsaj eden nima nastopov → varno mergat
  return a.zadnji >= b.prvi && b.zadnji >= a.prvi
}

// --- merger enega OLD → NEW --------------------------------------------------
async function merga(oldId, newId, kontekst) {
  const spremembe = []
  // Tabele s "surovim" UPDATE-om, kjer unique constraint ni skrb.
  const enostavne = [
    ['appearances', 'player_id'],
    ['goals', 'scorer_id'],
    ['goals', 'assist_player_id'],
    ['price_changes', 'player_id'],
    ['position_priors', 'player_id'],
  ]
  for (const [t, c] of enostavne) {
    const { data, error } = await db
      .from(t)
      .update({ [c]: newId })
      .eq(c, oldId)
      .select('*')
    if (error?.code === '23505') {
      // Delete SAMO tiste specifične vrstice, ki povzročijo conflict —
      // najdemo v bazi, ne pobrišemo pavšalno. Za price_changes/priors
      // je edini unique (player_id, round_id/position), zato lahko
      // varno vzamemo tiste, kjer za NEW že obstaja isti kljuc.
      spremembe.push(`${t}.${c}: SPECIFICNI dupl. ni implementiran (skipped)`)
    } else if (error) {
      spremembe.push(`${t}.${c}: NAPAKA ${error.message}`)
    } else if (data?.length) {
      spremembe.push(`${t}.${c}: ${data.length}`)
    }
  }
  // assist_votes: unique (goal_id, voter_id). Če OLD ima glas za gol G od
  // voterja V, IN NEW ima ze glas za isti (G, V) → OLD zbrišemo, NEW obdrži.
  {
    const { data: oldRows } = await db
      .from('assist_votes')
      .select('id, goal_id, voter_id')
      .eq('player_id', oldId)
    let u = 0, d = 0
    for (const row of oldRows ?? []) {
      const { data: obst } = await db
        .from('assist_votes')
        .select('id')
        .eq('goal_id', row.goal_id)
        .eq('voter_id', row.voter_id)
        .eq('player_id', newId)
        .maybeSingle()
      if (obst) {
        await db.from('assist_votes').delete().eq('id', row.id)
        d++
      } else {
        await db.from('assist_votes').update({ player_id: newId }).eq('id', row.id)
        u++
      }
    }
    if (u || d) spremembe.push(`assist_votes: ${u} upd, ${d} del`)
  }
  // position_votes: unique (player_id, voter_id). Pri merga se KEY spremeni
  // (player_id: OLD → NEW). Če voter je že glasoval za NEW → OLD zbrišemo.
  {
    const { data: oldRows } = await db
      .from('position_votes')
      .select('id, voter_id')
      .eq('player_id', oldId)
    let u = 0, d = 0
    for (const row of oldRows ?? []) {
      const { data: obst } = await db
        .from('position_votes')
        .select('id')
        .eq('player_id', newId)
        .eq('voter_id', row.voter_id)
        .maybeSingle()
      if (obst) {
        await db.from('position_votes').delete().eq('id', row.id)
        d++
      } else {
        await db.from('position_votes').update({ player_id: newId }).eq('id', row.id)
        u++
      }
    }
    if (u || d) spremembe.push(`position_votes: ${u} upd, ${d} del`)
  }
  // Tabele z composite PK-jem, kjer mora ročno preveriti dupe
  async function mergaComposite(t, dodatniKljuci) {
    const { data: rows } = await db
      .from(t)
      .select(dodatniKljuci.join(','))
      .eq('player_id', oldId)
    for (const r of rows ?? []) {
      let q = db.from(t).select('*').eq('player_id', newId)
      for (const k of dodatniKljuci) q = q.eq(k, r[k])
      const { data: obst } = await q.maybeSingle()
      if (obst) {
        let dq = db.from(t).delete().eq('player_id', oldId)
        for (const k of dodatniKljuci) dq = dq.eq(k, r[k])
        await dq
      } else {
        let uq = db.from(t).update({ player_id: newId }).eq('player_id', oldId)
        for (const k of dodatniKljuci) uq = uq.eq(k, r[k])
        await uq
      }
    }
  }
  await mergaComposite('fantasy_roster', ['fantasy_team_id'])
  await mergaComposite('fantasy_lineups', ['round_id', 'fantasy_team_id'])
  await mergaComposite('player_scores', ['round_id'])

  const { error: ep } = await db.from('players').delete().eq('id', oldId)
  if (ep) spremembe.push(`players delete: ${ep.message}`)
  console.log(
    `  ${pisi ? '→' : '·'} ${kontekst}: ${oldId} → ${newId}  [${spremembe.join(', ') || 'brez sprememb'}]`,
  )
}

// --- glavni tok --------------------------------------------------------------
const kandidati = await najdiPare()
console.log(`Kandidatov (2–${PREVEC_DUPLIKATOV} zapisov na ime): ${kandidati.length}`)

let mergovanih = 0
let preskocenih = 0
const preskocenaZimena = []

for (const { ime, zapisi } of kandidati) {
  // Zberi časovnice
  const znastopi = []
  for (const z of zapisi) {
    znastopi.push({ ...z, ...(await casovnica(z.id)) })
  }
  // Sortiraj po zadnjem nastopu — najbolj sveži je "NEW", starejši so "OLD"
  znastopi.sort((a, b) => (a.zadnji ?? '').localeCompare(b.zadnji ?? ''))

  // Preveri prekrivanje: če se katerakoli dva prekrivata → soimenjaki, ne mergamo
  let jePrekrivanje = false
  for (let i = 0; i < znastopi.length && !jePrekrivanje; i++) {
    for (let j = i + 1; j < znastopi.length && !jePrekrivanje; j++) {
      if (prekrivataSe(znastopi[i], znastopi[j])) jePrekrivanje = true
    }
  }
  if (jePrekrivanje) {
    console.log(`✗ ${ime}: časovnice se prekrivajo → verjetno soimenjaki`)
    preskocenih++
    preskocenaZimena.push(ime)
    continue
  }

  // Ne mergamo, če vsi zapisi nimajo nobenega nastopa (novi, brez podatkov)
  if (znastopi.every((z) => z.n === 0)) {
    console.log(`✗ ${ime}: noben zapis nima nastopov — presko čim`)
    preskocenih++
    continue
  }

  // NEW je zadnji (največji zadnji nastop), vsi ostali se mergajo vanj
  const newRow = znastopi[znastopi.length - 1]
  for (let i = 0; i < znastopi.length - 1; i++) {
    const old = znastopi[i]
    if (pisi) await merga(old.id, newRow.id, `${ime}`)
    else
      console.log(
        `  · ${ime}: ${old.id} (team ${old.team_id}, ${old.n} nastopov, do ${old.zadnji}) → ${newRow.id} (team ${newRow.team_id}, ${newRow.n} nastopov)`,
      )
    mergovanih++
  }
}

console.log(
  `\n${pisi ? 'Zapisano' : 'Predogled'}: ${mergovanih} mergov, ${preskocenih} preskočenih (soimenjaki).`,
)
if (preskocenaZimena.length) {
  console.log('Soimenjaki (rocno preglej):', preskocenaZimena.join(', '))
}
if (!pisi) console.log('Za dejanski zapis dodaj `--pisi`.')
