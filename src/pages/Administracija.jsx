import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, IME_POZICIJE, formatirajTocke, formatirajCeno } from '../lib/pomozno'
import { POZICIJE, VELIKOST_EKIPE, STEVILO_PRVIH, MAX_IZ_KLUBA, VRSTNI_RED, poPozicijah } from '../lib/pravila'
import { useTekmovanje } from '../lib/tekmovanje'

export default function Administracija() {
  const { session, loading } = useAuth()
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [nalaganje, setNalaganje] = useState(true)
  const [opozorila, setOpozorila] = useState([])
  const [brezPozicije, setBrezPozicije] = useState(0)
  const [brezAsistence, setBrezAsistence] = useState(0)
  const [krogi, setKrogi] = useState([])
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [iskanje, setIskanje] = useState('')
  const [zadetki, setZadetki] = useState([])
  const [klubi, setKlubi] = useState([])
  const [ekipe, setEkipe] = useState([])

  useEffect(() => {
    if (loading || !tekmovanjeId) return
    if (!session) {
      setNalaganje(false)
      return
    }
    async function init() {
      const { data: profil } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      const admin = Boolean(profil?.is_admin)
      setJeAdmin(admin)

      if (admin) {
        const [tekme, bp, ba, kr, kl] = await Promise.all([
          supabase
            .from('matches')
            .select(
              'id, zapisnik_id, source_url, import_warnings, rounds!inner(competition_id)',
            )
            .eq('rounds.competition_id', tekmovanjeId)
            .not('import_warnings', 'eq', '{}')
            .limit(50),
          supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('competition_id', tekmovanjeId)
            .is('position', null),
          supabase
            .from('goals')
            .select('id, matches!inner(rounds!inner(competition_id))', {
              count: 'exact',
              head: true,
            })
            .eq('matches.rounds.competition_id', tekmovanjeId)
            .is('assist_player_id', null)
            .eq('is_own_goal', false),
          supabase
            .from('rounds')
            .select('id, season, number')
            .eq('competition_id', tekmovanjeId)
            .order('season')
            .order('number'),
          supabase
            .from('competition_teams')
            .select('team_id, name')
            .eq('competition_id', tekmovanjeId)
            .order('name'),
        ])
        setOpozorila((tekme.data ?? []).filter((t) => t.import_warnings?.length))
        setBrezPozicije(bp.count ?? 0)
        setBrezAsistence(ba.count ?? 0)
        setKrogi(kr.data ?? [])
        setKlubi((kl.data ?? []).map((k) => ({ id: k.team_id, name: k.name })))

        // Vse fantasy ekipe s celo rostersko sliko za sanity-check.
        await naloziEkipe()
      }
      setNalaganje(false)
    }
    init()
  }, [session, loading, tekmovanjeId])

  async function naloziEkipe() {
    // wealth + owners + rosters + player positions/teams — dovolj za validacijo
    const [{ data: wealth }, { data: teamsBase }, { data: rosters }] =
      await Promise.all([
        supabase
          .from('fantasy_team_wealth')
          .select('fantasy_team_id, name, starting_budget, cash, roster_value, total_wealth')
          .eq('competition_id', tekmovanjeId)
          .order('total_wealth', { ascending: false }),
        supabase
          .from('fantasy_teams')
          .select('id, owner_id, profiles(display_name)')
          .eq('competition_id', tekmovanjeId),
        supabase
          .from('fantasy_roster')
          .select(
            'fantasy_team_id, player_id, is_starter, is_captain, is_vice, buy_value, players(id, full_name, position, team_id, value, active)',
          ),
      ])
    const podrostri = new Map()
    for (const r of rosters ?? []) {
      const arr = podrostri.get(r.fantasy_team_id) ?? []
      arr.push(r)
      podrostri.set(r.fantasy_team_id, arr)
    }
    const lastniki = Object.fromEntries(
      (teamsBase ?? []).map((t) => [
        t.id,
        t.profiles?.display_name ?? t.owner_id?.slice(0, 8) ?? '?',
      ]),
    )
    const napolnjene = (wealth ?? []).map((w) => {
      const roster = podrostri.get(w.fantasy_team_id) ?? []
      const kader = roster.map((r) => r.players).filter(Boolean)
      const napake = validacijaRosterja(roster, kader)
      return {
        ...w,
        owner: lastniki[w.fantasy_team_id] ?? '?',
        stIgralcev: roster.length,
        stStarterjev: roster.filter((r) => r.is_starter).length,
        stKapetanov: roster.filter((r) => r.is_captain).length,
        stNamestnikov: roster.filter((r) => r.is_vice).length,
        stNeaktivnih: kader.filter((p) => !p.active).length,
        kaderPoPoz: poPozicijah(kader),
        roster,
        napake,
      }
    })
    setEkipe(napolnjene)
  }

  function validacijaRosterja(roster, kader) {
    const napake = []
    if (roster.length !== VELIKOST_EKIPE)
      napake.push(`kader ${roster.length}/${VELIKOST_EKIPE}`)
    const starter = roster.filter((r) => r.is_starter).length
    if (starter !== STEVILO_PRVIH)
      napake.push(`postava ${starter}/${STEVILO_PRVIH}`)
    if (roster.filter((r) => r.is_captain).length !== 1)
      napake.push('kapetan ni določen ali jih je več')
    if (roster.filter((r) => r.is_vice).length !== 1)
      napake.push('namestnik ni določen ali jih je več')
    const kaderPo = poPozicijah(kader)
    for (const koda of VRSTNI_RED) {
      const p = POZICIJE[koda]
      if (kaderPo[koda] !== p.kader)
        napake.push(`${p.naslov} ${kaderPo[koda]}/${p.kader}`)
    }
    const poKlubu = {}
    for (const p of kader) poKlubu[p.team_id] = (poKlubu[p.team_id] ?? 0) + 1
    if (Object.values(poKlubu).some((n) => n > MAX_IZ_KLUBA))
      napake.push(`>${MAX_IZ_KLUBA} iz istega kluba`)
    if (kader.filter((p) => !p.active).length > 0)
      napake.push(`ima ${kader.filter((p) => !p.active).length} neaktivnih igralcev`)
    return napake
  }

  async function preracunajVse() {
    setNapaka(null)
    setSporocilo('Preračunavam …')
    for (const k of krogi) {
      const { error } = await supabase.rpc('recompute_round_scores', {
        p_round_id: k.id,
      })
      if (error) {
        setSporocilo(null)
        return setNapaka(`${k.season}/${k.number}: ${error.message}`)
      }
    }
    setSporocilo(`Točke preračunane za ${krogi.length} krogov.`)
  }

  async function isciIgralca(e) {
    e.preventDefault()
    if (!iskanje.trim()) return setZadetki([])
    const { data } = await supabase
      .from('player_overview')
      .select('id, full_name, team_id, team_name, position, value, minutes, goals')
      .eq('competition_id', tekmovanjeId)
      .ilike('full_name', `%${iskanje.trim()}%`)
      .limit(15)
    setZadetki(data ?? [])
  }

  async function premakniKlub(id, novKlubId) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ team_id: novKlubId })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    const novoIme = klubi.find((k) => k.id === novKlubId)?.name ?? ''
    setZadetki(
      zadetki.map((z) =>
        z.id === id ? { ...z, team_id: novKlubId, team_name: novoIme } : z,
      ),
    )
    setSporocilo(`Igralec prestavljen v klub ${novoIme}.`)
  }

  async function nastaviPozicijo(id, pozicija) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ position: pozicija, position_source: 'admin' })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setZadetki(zadetki.map((z) => (z.id === id ? { ...z, position: pozicija } : z)))
    setSporocilo('Pozicija nastavljena.')
  }

  async function shraniNzs(id, polje, vrednost) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ [polje]: vrednost, nzs_confirmed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setSporocilo('NZS podatek shranjen. Vrednost se posodobi ob naslednjem ovrednotenju.')
  }

  if (loading || nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (!session)
    return <p className="text-slate-300">Za dostop se moraš prijaviti.</p>
  if (!jeAdmin)
    return (
      <p className="kartica p-6 text-center text-slate-300">
        Ta stran je namenjena administratorjem lige.
      </p>
    )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black naslov">
        Administracija
        {tekmovanje && (
          <span className="ml-2 align-middle text-base font-bold text-slate-500">
            {tekmovanje.short_name.toLowerCase()}
          </span>
        )}
      </h1>

      {/* pregled */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kazalnik oznaka="Krogov" vrednost={krogi.length} />
        <Kazalnik oznaka="Fantasy ekip" vrednost={ekipe.length} />
        <Kazalnik
          oznaka="Neveljavnih rosterjev"
          vrednost={ekipe.filter((e) => e.napake.length > 0).length}
          opozori
        />
        <Kazalnik oznaka="Opozoril iz uvoza" vrednost={opozorila.length} opozori />
      </section>

      {/* Fantasy ekipe — vrednost, cash, veljavnost rosterja */}
      <section className="kartica space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Fantasy ekipe ({ekipe.length})</h2>
          <button
            onClick={naloziEkipe}
            className="text-xs text-slate-400 underline hover:text-gnl-300"
          >
            osveži
          </button>
        </div>
        {ekipe.length === 0 ? (
          <p className="text-sm text-slate-500">Ni ekip.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 pr-2">Ekipa</th>
                  <th className="pb-2 pr-2">Lastnik</th>
                  <th className="pb-2 pr-2 text-right">Cash</th>
                  <th className="pb-2 pr-2 text-right">Kader</th>
                  <th className="pb-2 pr-2 text-right">Bogastvo</th>
                  <th className="pb-2 pr-2">Postava</th>
                  <th className="pb-2 pr-2">GK/DEF/MID/FWD</th>
                  <th className="pb-2 pr-2">Kap/Nam</th>
                  <th className="pb-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ekipe.map((e) => (
                  <tr
                    key={e.fantasy_team_id}
                    className={`border-t border-white/5 ${
                      e.napake.length > 0 ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-2 font-semibold">{e.name}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{e.owner}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatirajCeno(e.cash)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatirajCeno(e.roster_value)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-bold tabular-nums">
                      <span
                        className={
                          Number(e.total_wealth) > Number(e.starting_budget)
                            ? 'text-gnl-300'
                            : Number(e.total_wealth) < Number(e.starting_budget)
                              ? 'text-rose-300'
                              : ''
                        }
                      >
                        {formatirajCeno(e.total_wealth)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">
                      {e.stStarterjev}/{STEVILO_PRVIH}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">
                      {VRSTNI_RED.map((k) => e.kaderPoPoz[k]).join('/')}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-slate-400">
                      {e.stKapetanov}/{e.stNamestnikov}
                    </td>
                    <td className="py-1.5 pr-2">
                      {e.napake.length === 0 ? (
                        <span className="znacka bg-gnl-400/20 text-gnl-200">
                          ✓ ok
                        </span>
                      ) : (
                        <span
                          title={e.napake.join('\n')}
                          className="znacka bg-rose-400/20 text-rose-200"
                        >
                          ⚠ {e.napake.length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ekipe.some((e) => e.napake.length > 0) && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-xs text-rose-100">
            <strong>Neveljavni rosterji</strong> po glasovanju pozicij:
            <ul className="mt-1 space-y-1">
              {ekipe
                .filter((e) => e.napake.length > 0)
                .map((e) => (
                  <li key={e.fantasy_team_id}>
                    <strong>{e.name}</strong> ({e.owner}) — {e.napake.join(' · ')}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="kartica space-y-3 p-4">
        <h2 className="font-bold">Točke</h2>
        <p className="text-sm text-slate-400">
          Točke se preračunajo iz nastopov. Poženi po uvozu zapisnikov ali ko se
          potrdi večje število asistenc in pozicij.
        </p>
        <button onClick={preracunajVse} className="gumb-glavni">
          Preračunaj vse kroge
        </button>
      </section>

      {/* uvoz */}
      <section className="kartica space-y-2 p-4">
        <h2 className="font-bold">Uvoz zapisnikov</h2>
        <p className="text-sm text-slate-400">
          Uvoz teče iz ukazne vrstice, ker zahteva dostop do spletne strani MNZ:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">
{`SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-zapisnikov.mjs --tekmovanje ${
  tekmovanje?.slug ?? 'clani'
}
SUPABASE_SERVICE_ROLE_KEY=... node scripts/ovrednoti-igralce.mjs --tekmovanje ${
  tekmovanje?.slug ?? 'clani'
}`}
        </pre>
      </section>

      {/* opozorila iz zapisnikov */}
      {opozorila.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Nepopolni zapisniki</h2>
          <p className="text-sm text-slate-400">
            Te tekme so bile uvožene, a zapisnik ni bil popoln. Preveri jih na
            izvoru.
          </p>
          <ul className="space-y-2">
            {opozorila.map((t) => (
              <li key={t.id} className="kartica p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Zapisnik {t.zapisnik_id}</span>
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gnl-300 hover:underline"
                  >
                    odpri ↗
                  </a>
                </div>
                <ul className="mt-1 text-amber-300">
                  {t.import_warnings.map((o, i) => (
                    <li key={i}>• {o}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* igralci: pozicija in NZS */}
      <section className="kartica space-y-3 p-4">
        <h2 className="font-bold">Igralec — pozicija in NZS</h2>
        <p className="text-sm text-slate-400">
          Administratorjeva pozicija povozi glasovanje. Podatke z NZS vnesi
          ročno — iskalnik NZS robotom ni dostopen.
        </p>
        <form onSubmit={isciIgralca} className="flex gap-2">
          <input
            value={iskanje}
            onChange={(e) => setIskanje(e.target.value)}
            placeholder="Priimek ali ime …"
            className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button className="gumb-glavni">Išči</button>
        </form>

        <ul className="space-y-2">
          {zadetki.map((z) => (
            <li key={z.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-semibold">
                  {prikazniIme(z.full_name)}
                </span>
                <span className="text-xs text-slate-500">{z.team_name}</span>
                <span className="text-xs text-slate-400">
                  {z.position ? IME_POZICIJE[z.position] : 'brez pozicije'} ·{' '}
                  {formatirajTocke(z.value)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {['GK', 'DEF', 'MID', 'FWD'].map((p) => (
                  <button
                    key={p}
                    onClick={() => nastaviPozicijo(z.id, p)}
                    className={`znacka poz-${p} ${
                      z.position === p ? 'ring-2 ring-white/40' : ''
                    }`}
                  >
                    {IME_POZICIJE[p]}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Prestavi v klub:</span>
                <select
                  value={z.team_id ?? ''}
                  onChange={(e) =>
                    e.target.value &&
                    Number(e.target.value) !== z.team_id &&
                    premakniKlub(z.id, Number(e.target.value))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                >
                  {klubi.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  onChange={(e) =>
                    e.target.value && shraniNzs(z.id, 'nzs_top_league', e.target.value)
                  }
                  defaultValue=""
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="">Najvišja liga (NZS) …</option>
                  <option value="1SNL">1. SNL</option>
                  <option value="2SNL">2. SNL</option>
                  <option value="3SNL">3. SNL</option>
                </select>
                <input
                  type="number"
                  placeholder="minute v tej ligi"
                  onBlur={(e) =>
                    e.target.value &&
                    shraniNzs(z.id, 'nzs_top_league_minutes', Number(e.target.value))
                  }
                  className="w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {sporocilo && <p className="text-sm text-gnl-300">{sporocilo}</p>}
      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}

function Kazalnik({ oznaka, vrednost, opozori }) {
  return (
    <div
      className={`kartica p-4 ${opozori && vrednost > 0 ? 'ring-1 ring-amber-400/40' : ''}`}
    >
      <div className="text-2xl font-black tabular-nums">{vrednost}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
