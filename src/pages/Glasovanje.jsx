import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, razredPozicije, KRATKA_POZICIJA } from '../lib/pomozno'

const PRAG = 5

export default function Glasovanje() {
  const { session, loading } = useAuth()
  const [tekme, setTekme] = useState([])
  const [tekmaId, setTekmaId] = useState(null)
  const [goli, setGoli] = useState([])
  const [igralci, setIgralci] = useState([])
  const [glasovi, setGlasovi] = useState({}) // goal_id -> [{player_id, votes}]
  const [mojiGlasovi, setMojiGlasovi] = useState({}) // goal_id -> player_id
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)
  const [pravkarOddan, setPravkarOddan] = useState(null)

  // seznam tekem, ki imajo gole brez potrjene asistence
  useEffect(() => {
    async function nalozi() {
      const { data, error } = await supabase
        .from('matches')
        .select(
          'id, played_on, home_goals, away_goals, home:home_team_id(name, short_name), away:away_team_id(name, short_name), rounds(season, number)',
        )
        .order('played_on', { ascending: false })
        .limit(40)
      if (error) setNapaka(error.message)
      setTekme(data ?? [])
      setTekmaId(data?.[0]?.id ?? null)
      setNalaganje(false)
    }
    nalozi()
  }, [])

  // goli izbrane tekme + kandidati + glasovi
  useEffect(() => {
    if (!tekmaId) return
    let preklican = false

    async function nalozi() {
      const [{ data: g }, { data: nastopi }] = await Promise.all([
        supabase
          .from('goals')
          .select(
            'id, minute, is_own_goal, is_penalty, score_home, score_away, team_id, scorer:scorer_id(id, full_name), assist_player_id, assist:assist_player_id(full_name)',
          )
          .eq('match_id', tekmaId)
          .order('minute'),
        supabase
          .from('appearances')
          .select('player_id, team_id, minutes_played, players(id, full_name, position)')
          .eq('match_id', tekmaId),
      ])
      if (preklican) return
      setGoli(g ?? [])
      setIgralci(nastopi ?? [])

      const ids = (g ?? []).map((x) => x.id)
      if (ids.length) {
        const { data: st } = await supabase
          .from('assist_vote_counts')
          .select('goal_id, player_id, votes')
          .in('goal_id', ids)
        if (preklican) return
        const skupine = {}
        for (const v of st ?? []) {
          skupine[v.goal_id] = skupine[v.goal_id] ?? []
          skupine[v.goal_id].push(v)
        }
        for (const k of Object.keys(skupine))
          skupine[k].sort((a, b) => b.votes - a.votes)
        setGlasovi(skupine)

        if (session) {
          const { data: moji } = await supabase
            .from('assist_votes')
            .select('goal_id, player_id')
            .in('goal_id', ids)
            .eq('voter_id', session.user.id)
          if (preklican) return
          setMojiGlasovi(
            Object.fromEntries((moji ?? []).map((m) => [m.goal_id, m.player_id])),
          )
        }
      } else {
        setGlasovi({})
        setMojiGlasovi({})
      }
    }
    nalozi()
    return () => {
      preklican = true
    }
  }, [tekmaId, session])

  const tekma = useMemo(
    () => tekme.find((t) => t.id === tekmaId),
    [tekme, tekmaId],
  )

  async function glasuj(golId, playerId) {
    if (!session) return
    setNapaka(null)

    const { error } = await supabase.from('assist_votes').upsert(
      { goal_id: golId, voter_id: session.user.id, player_id: playerId },
      { onConflict: 'goal_id,voter_id' },
    )
    if (error) return setNapaka(error.message)

    setMojiGlasovi({ ...mojiGlasovi, [golId]: playerId })
    setPravkarOddan(golId)
    setTimeout(() => setPravkarOddan(null), 1200)

    // osveži števce in morebitno potrditev
    const [{ data: st }, { data: gg }] = await Promise.all([
      supabase
        .from('assist_vote_counts')
        .select('goal_id, player_id, votes')
        .eq('goal_id', golId),
      supabase
        .from('goals')
        .select('id, assist_player_id, assist:assist_player_id(full_name)')
        .eq('id', golId)
        .single(),
    ])
    setGlasovi((prej) => ({
      ...prej,
      [golId]: (st ?? []).sort((a, b) => b.votes - a.votes),
    }))
    if (gg)
      setGoli((prej) =>
        prej.map((x) =>
          x.id === golId
            ? { ...x, assist_player_id: gg.assist_player_id, assist: gg.assist }
            : x,
        ),
      )
  }

  if (loading || nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>

  const nepotrjenih = goli.filter((g) => !g.assist_player_id && !g.is_own_goal).length

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black naslov">Kdo je podal?</h1>
        <p className="max-w-2xl text-slate-400">
          Zapisniki MNZ Gorenjska beležijo strelce, asistenc pa ne. Določi jih
          skupnost: ko isti igralec pri golu zbere{' '}
          <strong className="text-gnl-300">{PRAG} glasov</strong>, se mu
          asistenca prizna in prinese <strong className="text-gnl-300">+3 točke</strong>.
        </p>
      </header>

      {/* izbira tekme */}
      <div className="kartica p-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Tekma
        </label>
        <select
          value={tekmaId ?? ''}
          onChange={(e) => setTekmaId(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
        >
          {tekme.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rounds?.number}. krog — {t.home?.name} {t.home_goals}:
              {t.away_goals} {t.away?.name}
            </option>
          ))}
        </select>
      </div>

      {!session && (
        <p className="kartica border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Za glasovanje se moraš prijaviti.
        </p>
      )}

      {tekma && (
        <div className="flex items-center justify-center gap-4 rounded-2xl bg-gradient-to-b from-gnl-800/50 to-slate-900/50 p-5 text-center ring-1 ring-white/10">
          <span className="flex-1 text-right font-bold">{tekma.home?.name}</span>
          <span className="rounded-xl bg-slate-950 px-4 py-2 text-2xl font-black tabular-nums">
            {tekma.home_goals} : {tekma.away_goals}
          </span>
          <span className="flex-1 text-left font-bold">{tekma.away?.name}</span>
        </div>
      )}

      {goli.length === 0 ? (
        <p className="text-slate-400">Na tej tekmi ni bilo golov.</p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {nepotrjenih === 0
              ? 'Vse asistence na tej tekmi so potrjene. 🎉'
              : `Čaka te ${nepotrjenih} ${nepotrjenih === 1 ? 'gol' : 'golov'} brez potrjene asistence.`}
          </p>

          <ul className="space-y-4">
            {goli.map((g) => (
              <GolKartica
                key={g.id}
                gol={g}
                tekma={tekma}
                kandidati={igralci.filter(
                  (i) =>
                    i.team_id === g.team_id &&
                    i.player_id !== g.scorer?.id &&
                    i.minutes_played > 0,
                )}
                glasovi={glasovi[g.id] ?? []}
                mojGlas={mojiGlasovi[g.id]}
                omogoceno={Boolean(session)}
                pravkar={pravkarOddan === g.id}
                onGlasuj={glasuj}
              />
            ))}
          </ul>
        </>
      )}

      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}

function GolKartica({
  gol,
  tekma,
  kandidati,
  glasovi,
  mojGlas,
  omogoceno,
  pravkar,
  onGlasuj,
}) {
  const [odprto, setOdprto] = useState(false)
  const potrjeno = Boolean(gol.assist_player_id)
  const stGlasov = Object.fromEntries(glasovi.map((v) => [v.player_id, v.votes]))
  const vodilni = glasovi[0]

  const ekipa =
    gol.team_id === tekma?.home?.id ? tekma?.home : tekma?.away

  if (gol.is_own_goal)
    return (
      <li className="kartica p-4 opacity-60">
        <div className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-center font-black tabular-nums text-slate-500">
            {gol.minute}&apos;
          </span>
          <span className="text-slate-400">
            Avtogol — {prikazniIme(gol.scorer?.full_name)}
          </span>
          <span className="znacka ml-auto bg-white/10 text-slate-400">
            brez asistence
          </span>
        </div>
      </li>
    )

  return (
    <li className={`kartica overflow-hidden ${pravkar ? 'animiraj-pulz' : ''}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="w-12 shrink-0 rounded-lg bg-slate-950 py-1 text-center font-black tabular-nums text-gnl-300">
          {gol.minute}&apos;
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">⚽</span>
            <strong className="truncate">{prikazniIme(gol.scorer?.full_name)}</strong>
            {gol.is_penalty && (
              <span className="znacka bg-amber-400/20 text-amber-200">11m</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {ekipa?.name} · {gol.score_home}:{gol.score_away}
          </div>
        </div>

        {potrjeno ? (
          <div className="flex items-center gap-2 rounded-xl bg-gnl-500/15 px-3 py-2 ring-1 ring-gnl-400/30">
            <span>🅰️</span>
            <div className="text-sm">
              <div className="font-bold text-gnl-200">
                {prikazniIme(gol.assist?.full_name)}
              </div>
              <div className="text-xs text-gnl-400/80">asistenca potrjena</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOdprto(!odprto)}
            disabled={!omogoceno}
            className={odprto ? 'gumb-tih' : 'gumb-glavni'}
          >
            {odprto ? 'Zapri' : mojGlas ? 'Spremeni glas' : 'Kdo je podal?'}
          </button>
        )}
      </div>

      {/* napredek do praga */}
      {!potrjeno && vodilni && (
        <div className="px-4 pb-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>
              Vodi {prikazniIme(
                kandidati.find((k) => k.player_id === vodilni.player_id)?.players
                  ?.full_name,
              ) || 'nekdo'}
            </span>
            <span className="tabular-nums">
              {vodilni.votes} / {PRAG}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gnl-500 to-gnl-300 transition-all duration-300"
              style={{ width: `${Math.min(100, (vodilni.votes / PRAG) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {odprto && !potrjeno && (
        <div className="animiraj-vstop border-t border-white/10 bg-slate-950/40 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
            Izberi podajalca — {ekipa?.name}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {kandidati.map((k) => {
              const izbran = mojGlas === k.player_id
              const n = stGlasov[k.player_id] ?? 0
              return (
                <button
                  key={k.player_id}
                  onClick={() => onGlasuj(gol.id, k.player_id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    izbran
                      ? 'bg-gnl-500/25 ring-2 ring-gnl-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span
                    className={`znacka ${razredPozicije(k.players?.position)}`}
                  >
                    {KRATKA_POZICIJA[k.players?.position] ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {prikazniIme(k.players?.full_name)}
                  </span>
                  {n > 0 && (
                    <span className="tabular-nums text-xs text-slate-400">
                      {n}
                    </span>
                  )}
                  {izbran && <span className="text-gnl-300">✓</span>}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onGlasuj(gol.id, null)}
            // mojGlas je null, če je uporabnik glasoval za "nihče",
            // in undefined, če še ni glasoval
            className={`mt-3 w-full rounded-xl px-3 py-2 text-sm transition ${
              mojGlas === null
                ? 'bg-white/15 ring-1 ring-white/30'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            Nihče — gol brez asistence
          </button>
        </div>
      )}
    </li>
  )
}
