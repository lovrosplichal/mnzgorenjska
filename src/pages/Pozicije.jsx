import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, IME_POZICIJE, KRATKA_POZICIJA } from '../lib/pomozno'
import Grb from '../components/Grb'
import { Link } from 'react-router-dom'

const PRAG = 5
const POZICIJE = ['GK', 'DEF', 'MID', 'FWD']

const IKONA = { GK: '🧤', DEF: '🛡️', MID: '⚙️', FWD: '🎯' }

export default function Pozicije() {
  const { session, loading } = useAuth()
  const [klubi, setKlubi] = useState([])
  const [klubId, setKlubId] = useState(null)
  const [igralci, setIgralci] = useState([])
  const [glasovi, setGlasovi] = useState({}) // player_id -> {GK: n, ...}
  const [mojiGlasovi, setMojiGlasovi] = useState({}) // player_id -> position
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)
  // Privzeto pokažemo tiste, ki jih je vredno popraviti: brez pozicije in
  // ugibanja iz statistike. Potrjene iz zapisnika glasovanje itak ne premakne.
  const [samoNepotrjene, setSamoNepotrjene] = useState(true)

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setKlubi(data ?? [])
        setKlubId(data?.[0]?.id ?? null)
        setNalaganje(false)
      })
  }, [])

  useEffect(() => {
    if (!klubId) return
    let preklican = false

    async function nalozi() {
      const { data: p } = await supabase
        .from('player_overview')
        .select(
          'id, full_name, position, position_source, shirt_number, minutes, goals, matches, clean_sheets, team_name, team_short, team_logo',
        )
        .eq('team_id', klubId)
        .order('minutes', { ascending: false })
      if (preklican) return
      setIgralci(p ?? [])

      const ids = (p ?? []).map((x) => x.id)
      if (!ids.length) return

      const { data: st } = await supabase
        .from('position_vote_counts')
        .select('player_id, position, votes')
        .in('player_id', ids)
      if (preklican) return
      const skupine = {}
      for (const v of st ?? []) {
        skupine[v.player_id] = skupine[v.player_id] ?? {}
        skupine[v.player_id][v.position] = v.votes
      }
      setGlasovi(skupine)

      if (session) {
        const { data: moji } = await supabase
          .from('position_votes')
          .select('player_id, position')
          .in('player_id', ids)
          .eq('voter_id', session.user.id)
        if (preklican) return
        setMojiGlasovi(
          Object.fromEntries((moji ?? []).map((m) => [m.player_id, m.position])),
        )
      }
    }
    nalozi()
    return () => {
      preklican = true
    }
  }, [klubId, session])

  async function glasuj(playerId, pozicija) {
    if (!session) return
    setNapaka(null)

    const { error } = await supabase.from('position_votes').upsert(
      { player_id: playerId, voter_id: session.user.id, position: pozicija },
      { onConflict: 'player_id,voter_id' },
    )
    if (error) return setNapaka(error.message)

    setMojiGlasovi({ ...mojiGlasovi, [playerId]: pozicija })

    const [{ data: st }, { data: p }] = await Promise.all([
      supabase
        .from('position_vote_counts')
        .select('player_id, position, votes')
        .eq('player_id', playerId),
      supabase
        .from('players')
        .select('id, position, position_source')
        .eq('id', playerId)
        .single(),
    ])
    setGlasovi((prej) => ({
      ...prej,
      [playerId]: Object.fromEntries(
        (st ?? []).map((v) => [v.position, v.votes]),
      ),
    }))
    if (p)
      setIgralci((prej) =>
        prej.map((x) =>
          x.id === playerId
            ? { ...x, position: p.position, position_source: p.position_source }
            : x,
        ),
      )
  }

  const vidni = useMemo(
    () =>
      samoNepotrjene
        ? igralci.filter(
            (i) => !i.position || i.position_source === 'ugibanje',
          )
        : igralci,
    [igralci, samoNepotrjene],
  )

  const stNepotrjenih = igralci.filter(
    (i) => !i.position || i.position_source === 'ugibanje',
  ).length

  if (loading || nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black naslov">Kje kdo igra?</h1>
        <p className="max-w-2xl text-slate-400">
          Zapisniki označijo le vratarja, postave pa naštejejo po številkah
          dresov — pozicij torej ni mogoče razbrati. Določi jih skupnost: pri{' '}
          <strong className="text-gnl-300">{PRAG} glasovih</strong> se pozicija
          potrdi. Od nje je odvisno, koliko je vreden gol in kdo dobi točke za
          ohranjeno mrežo.
        </p>
      </header>

      <div className="kartica flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-48 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Klub
          </span>
          <select
            value={klubId ?? ''}
            onChange={(e) => setKlubId(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          >
            {klubi.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={samoNepotrjene}
            onChange={(e) => setSamoNepotrjene(e.target.checked)}
            className="h-4 w-4 rounded accent-gnl-400"
          />
          Samo nepotrjene ({stNepotrjenih})
        </label>
      </div>

      {!session && (
        <p className="kartica border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Za glasovanje se moraš prijaviti.
        </p>
      )}

      {vidni.length === 0 ? (
        <p className="kartica p-6 text-center text-slate-400">
          {samoNepotrjene
            ? 'Vsi igralci tega kluba imajo potrjeno pozicijo. 🎉'
            : 'Ni igralcev.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {vidni.map((i) => (
            <IgralecKartica
              key={i.id}
              igralec={i}
              glasovi={glasovi[i.id] ?? {}}
              mojGlas={mojiGlasovi[i.id]}
              omogoceno={Boolean(session)}
              onGlasuj={glasuj}
            />
          ))}
        </ul>
      )}

      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}

function IgralecKartica({ igralec, glasovi, mojGlas, omogoceno, onGlasuj }) {
  // Zapisnika in ročnega vnosa administratorja glasovanje ne premakne; vse
  // ostalo (neznano, ugibanje, prejšnje glasovanje) je mogoče popraviti.
  const izZapisnika = igralec.position_source === 'zapisnik'
  const zaklenjeno = izZapisnika || igralec.position_source === 'admin'
  const ugibano = igralec.position_source === 'ugibanje'
  const potrjeno = Boolean(igralec.position)
  const vodilna = Object.entries(glasovi).sort((a, b) => b[1] - a[1])[0]

  return (
    <li className="kartica kartica-hover p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Grb
          ime={igralec.team_name}
          kratko={igralec.team_short}
          logo={igralec.team_logo}
          velikost={28}
        />
        {igralec.shirt_number != null && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 font-black tabular-nums text-slate-400">
            {igralec.shirt_number}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/igralec/${igralec.id}`}
            className="block truncate font-bold hover:text-gnl-300"
          >
            {prikazniIme(igralec.full_name)}
          </Link>
          <div className="text-xs text-slate-500">
            {igralec.matches} tekem · {igralec.minutes} min · {igralec.goals}{' '}
            {igralec.goals === 1 ? 'gol' : 'golov'} ·{' '}
            {igralec.clean_sheets} brez prejetega
          </div>
        </div>

        {potrjeno && (
          <span
            className={`znacka ${igralec.position ? `poz-${igralec.position}` : 'poz-none'}`}
            title={
              izZapisnika
                ? 'Iz zapisnika — vratar je označen z (V)'
                : ugibano
                  ? 'Pozicija še ni potrjena — glasovanje jo popravi'
                  : 'Potrdila skupnost'
            }
          >
            {IKONA[igralec.position]} {IME_POZICIJE[igralec.position]}
            {izZapisnika && ' · zapisnik'}
            {ugibano && ' · ni potrjeno'}
          </span>
        )}
      </div>

      {!zaklenjeno && potrjeno && (
        <p className="mt-2 text-xs text-slate-500">
          {ugibano
            ? 'Pozicija še ni potrjena — če ni prava, klikni pravo.'
            : 'Pozicijo je določila skupnost — z glasovi jo je mogoče popraviti.'}
        </p>
      )}

      {!zaklenjeno && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POZICIJE.map((p) => {
            const n = glasovi[p] ?? 0
            const izbran = mojGlas === p
            const delez = Math.min(100, (n / PRAG) * 100)
            return (
              <button
                key={p}
                onClick={() => onGlasuj(igralec.id, p)}
                disabled={!omogoceno}
                className={`relative overflow-hidden rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${
                  izbran
                    ? 'ring-2 ring-gnl-400'
                    : 'ring-1 ring-white/10 hover:ring-white/30'
                } ${p === 'GK' ? 'poz-GK' : p === 'DEF' ? 'poz-DEF' : p === 'MID' ? 'poz-MID' : 'poz-FWD'}`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white/10 transition-all duration-300"
                  style={{ width: `${delez}%` }}
                  aria-hidden
                />
                <span className="relative flex items-center justify-center gap-1">
                  {IKONA[p]} {KRATKA_POZICIJA[p]}
                  {n > 0 && (
                    <span className="tabular-nums opacity-70">{n}</span>
                  )}
                  {izbran && <span>✓</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!potrjeno && vodilna && (
        <p className="mt-2 text-xs text-slate-500">
          Vodi {IME_POZICIJE[vodilna[0]]} — {vodilna[1]} / {PRAG} glasov
        </p>
      )}
    </li>
  )
}
