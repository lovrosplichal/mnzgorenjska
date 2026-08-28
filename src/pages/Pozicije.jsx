import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, IME_POZICIJE, KRATKA_POZICIJA } from '../lib/pomozno'
import Grb from '../components/Grb'
import { Link } from 'react-router-dom'

const PRAG = 5
const MIN_PRAG = 2
const POZICIJE = ['GK', 'DEF', 'MID', 'FWD']

const IKONA = { GK: '🧤', DEF: '🛡️', MID: '⚙️', FWD: '🎯' }

// Ista logika kot v migraciji `adaptivni_prag` — če je prior močan za neko
// pozicijo, prag za to pozicijo pade.
function adaptivniPrag(priorZaTo) {
  if (priorZaTo >= 0.70) return Math.max(MIN_PRAG, PRAG - 3)
  if (priorZaTo >= 0.50) return Math.max(MIN_PRAG, PRAG - 2)
  if (priorZaTo >= 0.30) return Math.max(MIN_PRAG, PRAG - 1)
  return PRAG
}

export default function Pozicije() {
  const { session, loading } = useAuth()
  const [klubi, setKlubi] = useState([])
  const [klubId, setKlubId] = useState(null)
  const [igralci, setIgralci] = useState([])
  const [glasovi, setGlasovi] = useState({}) // player_id -> {GK: {votes,weight}, ...}
  const [priori, setPriori] = useState({}) // player_id -> {GK: score, ...}
  const [mojiGlasovi, setMojiGlasovi] = useState({}) // player_id -> position
  const [insiderTeamId, setInsiderTeamId] = useState(null)
  const [mojaUtez, setMojaUtez] = useState(null)
  const [mojaTocnost, setMojaTocnost] = useState(null) // {correct, resolved}
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

  // Profil (insider status) in točnost glasovanja — enkrat ob prijavi.
  useEffect(() => {
    if (!session) {
      setInsiderTeamId(null)
      setMojaUtez(null)
      setMojaTocnost(null)
      return
    }
    let preklican = false
    ;(async () => {
      const [{ data: profil }, { data: tocnost }] = await Promise.all([
        supabase
          .from('profiles')
          .select('insider_team_id')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('voter_position_accuracy')
          .select('resolved, correct')
          .eq('voter_id', session.user.id)
          .maybeSingle(),
      ])
      if (preklican) return
      setInsiderTeamId(profil?.insider_team_id ?? null)
      const r = tocnost?.resolved ?? 0
      const c = tocnost?.correct ?? 0
      setMojaTocnost({ resolved: r, correct: c })
      // Ista formula kot voter_weight v migraciji.
      const min = 5
      const max = 2
      if (r < min) setMojaUtez(1.0)
      else setMojaUtez(Math.max(0.5, Math.min(max, 0.5 + (max - 0.5) * (c / r))))
    })()
    return () => { preklican = true }
  }, [session])

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

      // Uteži glasovanja (upoštevajo zaupanje + insider), priori za pozicije.
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase
          .from('position_vote_weights')
          .select('player_id, position, votes, weight')
          .in('player_id', ids),
        supabase
          .from('position_priors')
          .select('player_id, position, score')
          .in('player_id', ids),
      ])
      if (preklican) return
      const skupine = {}
      for (const v of st ?? []) {
        skupine[v.player_id] = skupine[v.player_id] ?? {}
        skupine[v.player_id][v.position] = {
          votes: v.votes,
          weight: Number(v.weight),
        }
      }
      setGlasovi(skupine)

      const priorMap = {}
      for (const v of pr ?? []) {
        priorMap[v.player_id] = priorMap[v.player_id] ?? {}
        priorMap[v.player_id][v.position] = Number(v.score)
      }
      setPriori(priorMap)

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
    // insiderTeamId je v DEP, ker sprememba insider statusa vpliva na uteži.
  }, [klubId, session, insiderTeamId])

  async function nastaviInsider(id) {
    if (!session) return
    setNapaka(null)
    const { error } = await supabase
      .from('profiles')
      .update({ insider_team_id: id })
      .eq('id', session.user.id)
    if (error) return setNapaka(error.message)
    setInsiderTeamId(id)
  }

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
        .from('position_vote_weights')
        .select('player_id, position, votes, weight')
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
        (st ?? []).map((v) => [
          v.position,
          { votes: v.votes, weight: Number(v.weight) },
        ]),
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

  const insiderVeljaZaKlub = insiderTeamId && insiderTeamId === klubId

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black naslov">Kje kdo igra?</h1>
        <p className="max-w-2xl text-slate-400">
          Zapisniki označijo le vratarja, postave pa naštejejo po številkah
          dresov — pozicij torej ni mogoče razbrati. Določi jih skupnost. Osnovni
          prag je <strong className="text-gnl-300">{PRAG} glasov</strong>, a se
          zniža (do {MIN_PRAG}), če je statistični prior (številka dresa, goli,
          kartoni) močan v tisto smer. Glasovi{' '}
          <strong className="text-gnl-300">poznavalcev kluba</strong> in
          uporabnikov z <strong className="text-gnl-300">visoko točnostjo</strong>{' '}
          štejejo več.
        </p>
      </header>

      {session && (
        <MojStatus
          klubi={klubi}
          insiderTeamId={insiderTeamId}
          onNastaviInsider={nastaviInsider}
          utez={mojaUtez}
          tocnost={mojaTocnost}
        />
      )}

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
                {insiderTeamId === t.id ? '  ★ poznavalec' : ''}
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
              prior={priori[i.id] ?? null}
              mojGlas={mojiGlasovi[i.id]}
              omogoceno={Boolean(session)}
              insiderVelja={Boolean(insiderVeljaZaKlub)}
              onGlasuj={glasuj}
            />
          ))}
        </ul>
      )}

      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}

function MojStatus({ klubi, insiderTeamId, onNastaviInsider, utez, tocnost }) {
  return (
    <div className="kartica space-y-3 border-gnl-400/20 bg-gnl-500/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gnl-200">Moj status glasovalca</h2>
        {utez != null && (
          <span
            title="Utež posameznega glasu — sešteje se z insider bonusom, če glasuješ za igralca svojega kluba."
            className="znacka bg-white/10 text-slate-200"
          >
            utež {utez.toFixed(2)}×
            {tocnost && tocnost.resolved > 0 && (
              <span className="ml-1 text-[10px] text-slate-400">
                ({tocnost.correct}/{tocnost.resolved} točnih)
              </span>
            )}
          </span>
        )}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-slate-400">
          Klub, ki ga dobro poznam (poznavalec) — moj glas za igralce tega kluba
          šteje več:
        </span>
        <select
          value={insiderTeamId ?? ''}
          onChange={(e) =>
            onNastaviInsider(e.target.value ? Number(e.target.value) : null)
          }
          className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
        >
          <option value="">— nisem poznavalec nobenega kluba —</option>
          {klubi.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-snug text-slate-500">
        Poznavalec označi le en klub. Uteži se s časom umirijo — če se tvoji
        glasovi kažejo za napačne, se zaupanje niža. Zaupanje se preračuna iz
        preteklih glasov, ko je pozicija znana.
      </p>
    </div>
  )
}

function IgralecKartica({
  igralec,
  glasovi,
  prior,
  mojGlas,
  omogoceno,
  insiderVelja,
  onGlasuj,
}) {
  // Zapisnika in ročnega vnosa administratorja glasovanje ne premakne; vse
  // ostalo (neznano, ugibanje, prejšnje glasovanje) je mogoče popraviti.
  const izZapisnika = igralec.position_source === 'zapisnik'
  const zaklenjeno = izZapisnika || igralec.position_source === 'admin'
  const ugibano = igralec.position_source === 'ugibanje'
  const potrjeno = Boolean(igralec.position)
  // Vodilna pozicija po SEŠTETIH UTEŽEH (ne surovih glasovih).
  const vodilna = Object.entries(glasovi)
    .map(([p, v]) => [p, v.weight ?? v.votes ?? 0])
    .sort((a, b) => b[1] - a[1])[0]

  const priorVodilna = prior
    ? Object.entries(prior).sort((a, b) => b[1] - a[1])[0]
    : null

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

      {!zaklenjeno && priorVodilna && priorVodilna[1] >= 0.30 && (
        <p className="mt-2 text-xs text-slate-500">
          Statistika kaže na{' '}
          <strong className="text-slate-300">
            {IME_POZICIJE[priorVodilna[0]]} ({Math.round(priorVodilna[1] * 100)}%)
          </strong>
          {' '}— glas v tej smeri se šteje z nižjim pragom{' '}
          ({adaptivniPrag(priorVodilna[1])} namesto {PRAG}).
        </p>
      )}

      {!zaklenjeno && potrjeno && !priorVodilna && (
        <p className="mt-2 text-xs text-slate-500">
          {ugibano
            ? 'Pozicija še ni potrjena — če ni prava, klikni pravo.'
            : 'Pozicijo je določila skupnost — z glasovi jo je mogoče popraviti.'}
        </p>
      )}

      {!zaklenjeno && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POZICIJE.map((p) => {
            const g = glasovi[p] ?? {}
            const votes = g.votes ?? 0
            const weight = g.weight ?? 0
            const priorZa = prior?.[p] ?? 0
            const pragZa = adaptivniPrag(priorZa)
            const izbran = mojGlas === p
            const delez = Math.min(100, (weight / pragZa) * 100)
            const potrjenBiVajino = weight >= pragZa
            return (
              <button
                key={p}
                onClick={() => onGlasuj(igralec.id, p)}
                disabled={!omogoceno}
                title={
                  `Utež ${weight.toFixed(1)} / prag ${pragZa}` +
                  (priorZa ? ` · prior ${Math.round(priorZa * 100)}%` : '') +
                  (insiderVelja ? ' · tvoj glas kot poznavalec šteje več' : '')
                }
                className={`relative overflow-hidden rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${
                  izbran
                    ? 'ring-2 ring-gnl-400'
                    : potrjenBiVajino
                      ? 'ring-2 ring-emerald-400/60'
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                } poz-${p}`}
              >
                {/* Napredek do praga (utežno). */}
                <span
                  className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-300"
                  style={{ width: `${delez}%` }}
                  aria-hidden
                />
                {/* Prior — tanka črtica na dnu. */}
                {priorZa > 0 && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-1 bg-slate-100/40"
                    style={{ width: `${Math.round(priorZa * 100)}%` }}
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center justify-center gap-1">
                  {IKONA[p]} {KRATKA_POZICIJA[p]}
                  {votes > 0 && (
                    <span className="tabular-nums opacity-70">
                      {weight.toFixed(1)}
                    </span>
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
          Vodi {IME_POZICIJE[vodilna[0]]} — utež {vodilna[1].toFixed(1)} /{' '}
          {adaptivniPrag(prior?.[vodilna[0]] ?? 0)}
        </p>
      )}
    </li>
  )
}
