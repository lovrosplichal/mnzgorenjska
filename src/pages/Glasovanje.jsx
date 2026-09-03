import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { useTekmovanje } from '../lib/tekmovanje'
import Grb from '../components/Grb'
import GolZaGlasovanje, {
  PRAG_ASISTENCE,
  caka,
} from '../components/GolZaGlasovanje'


export default function Glasovanje() {
  const { session, loading } = useAuth()
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [tekme, setTekme] = useState([])
  const [krogId, setKrogId] = useState(null)
  const [sezona, setSezona] = useState(null)
  const [tekmaId, setTekmaId] = useState(null)
  const [goli, setGoli] = useState([])
  const [igralci, setIgralci] = useState([])
  const [glasovi, setGlasovi] = useState({}) // goal_id -> [{player_id, votes}]
  const [mojiGlasovi, setMojiGlasovi] = useState({}) // goal_id -> player_id
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)
  const [pravkarOddan, setPravkarOddan] = useState(null)

  // Vse odigrane tekme naenkrat — samo TEKOČA sezona. Lanska liga ni bila
  // fantasy-aktivna, zato bi glasovanje o lanskih asistencah bilo brez smisla.
  useEffect(() => {
    if (!tekmovanjeId) return
    setNalaganje(true)
    async function nalozi() {
      const [{ data, error }, { data: sez }] = await Promise.all([
        supabase
          .from('match_assist_status')
          .select('*')
          .eq('competition_id', tekmovanjeId)
          .order('played_on', { ascending: false }),
        supabase
          .from('sezone')
          .select('season, tekoca')
          .eq('competition_id', tekmovanjeId),
      ])
      if (error) setNapaka(error.message)
      const tekocaSez = (sez ?? []).find((s) => s.tekoca)?.season ?? null
      const samoTekoca = (data ?? []).filter((t) => t.season === tekocaSez)
      setTekme(samoTekoca)
      setSezona(tekocaSez)
      const cakajoc = samoTekoca.find((t) => t.brez_asistence > 0)
      setKrogId(cakajoc?.round_id ?? samoTekoca[0]?.round_id ?? null)
      setNalaganje(false)
    }
    nalozi()
  }, [tekmovanjeId])

  // Ob menjavi kroga izberemo prvo tekmo, ki še potrebuje glasove.
  useEffect(() => {
    if (!krogId) return
    const vKrogu = tekme.filter((t) => t.round_id === krogId)
    const cakajoca = vKrogu.find((t) => t.brez_asistence > 0) ?? vKrogu[0]
    setTekmaId(cakajoca?.match_id ?? null)
  }, [krogId, tekme])

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
          // shirt_number je iz TE tekme (zapisnika), ne s profila igralca —
          // dres se med sezono lahko zamenja. Olajša iskanje pravega
          // podajalca: "16 — Priimek Ime" je isti zapis kot v zapisniku.
          .select(
            'player_id, team_id, minutes_played, shirt_number, players(id, full_name, position)',
          )
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

  const sezone = useMemo(
    () => [...new Set(tekme.map((t) => t.season))].sort().reverse(),
    [tekme],
  )

  // Krogi z odigranimi tekmami; značka pove, koliko golov v krogu še čaka.
  const krogi = useMemo(() => {
    const m = new Map()
    for (const t of tekme.filter((t) => !sezona || t.season === sezona)) {
      const k = m.get(t.round_id) ?? {
        id: t.round_id,
        number: t.round_number,
        season: t.season,
        brez_asistence: 0,
      }
      k.brez_asistence += t.brez_asistence
      m.set(t.round_id, k)
    }
    return [...m.values()].sort(
      (a, b) => b.season.localeCompare(a.season) || b.number - a.number,
    )
  }, [tekme, sezona])

  const tekmeVKrogu = useMemo(
    () => tekme.filter((t) => t.round_id === krogId),
    [tekme, krogId],
  )

  const tekma = useMemo(
    () => tekme.find((t) => t.match_id === tekmaId),
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

  const nepotrjenih = goli.filter((g) => caka(g, glasovi[g.id] ?? [])).length

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black naslov">
          Kdo je podal?
          {tekmovanje && (
            <span className="ml-2 align-middle text-base font-bold text-slate-500">
              {tekmovanje.short_name.toLowerCase()}
            </span>
          )}
        </h1>
        <p className="max-w-2xl text-slate-400">
          Zapisniki MNZ Gorenjska beležijo strelce, asistenc pa ne. Določi jih
          skupnost: ko isti igralec pri golu zbere{' '}
          <strong className="text-gnl-300">{PRAG_ASISTENCE} glasov</strong>, se mu
          asistenca prizna in prinese <strong className="text-gnl-300">+3 točke</strong>.
        </p>
      </header>

      {tekme.length === 0 && (
        <div className="kartica p-6 text-center text-sm text-slate-300">
          <p className="mb-2 text-lg font-semibold">
            V trenutni sezoni še ni odigranih tekem 🎯
          </p>
          <p className="text-slate-400">
            Glasovanje o asistencah se odpre takoj, ko bo prvi krog
            odigran. Vrni se, ko bodo zapisniki prispeli.
          </p>
        </div>
      )}

      {sezone.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {sezone.map((sz) => (
            <button
              key={sz}
              onClick={() => {
                setSezona(sz)
                const prva = tekme.find(
                  (t) => t.season === sz && t.brez_asistence > 0,
                )
                const katerakoli = tekme.find((t) => t.season === sz)
                setKrogId((prva ?? katerakoli)?.round_id ?? null)
              }}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                sezona === sz ? 'bg-gnl-500 text-slate-950' : 'kartica text-slate-300'
              }`}
            >
              {sz}
              {sz !== sezone[0] && (
                <span className="ml-1.5 text-[10px] uppercase opacity-70">
                  arhiv
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {sezona && sezona !== sezone[0] && (
        <p className="kartica border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Glasuješ o pretekli sezoni. Na točke tekoče lige to ne vpliva —
          popravi le zgodovino.
        </p>
      )}

      {/* 1. korak: krog */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          1. Izberi krog
        </h2>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {krogi.map((k) => (
            <button
              key={k.id}
              onClick={() => setKrogId(k.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                krogId === k.id
                  ? 'bg-gnl-500 text-slate-950'
                  : 'kartica text-slate-300'
              }`}
            >
              {k.number}. krog
              {k.brez_asistence > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    krogId === k.id
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-amber-400/20 text-amber-300'
                  }`}
                >
                  {k.brez_asistence}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. korak: tekma v krogu */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          2. Izberi tekmo
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tekmeVKrogu.map((t) => (
            <li key={t.match_id}>
              <button
                onClick={() => setTekmaId(t.match_id)}
                className={`flex w-full items-center gap-2 rounded-2xl p-2.5 text-left transition ${
                  tekmaId === t.match_id
                    ? 'bg-gnl-500/15 ring-1 ring-gnl-400/50'
                    : 'kartica kartica-hover'
                }`}
              >
                <Grb ime={t.home_name} kratko={t.home_short} logo={t.home_logo} velikost={22} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {t.home_short} – {t.away_short}
                </span>
                <Grb ime={t.away_name} kratko={t.away_short} logo={t.away_logo} velikost={22} />
                <span className="rounded-lg bg-slate-950/60 px-2 py-0.5 text-sm font-black tabular-nums">
                  {t.home_goals}:{t.away_goals}
                </span>
                {t.brez_asistence > 0 ? (
                  <span className="znacka bg-amber-400/20 text-amber-300">
                    {t.brez_asistence}
                  </span>
                ) : (
                  <span className="znacka bg-gnl-400/20 text-gnl-200">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!session && (
        <p className="kartica border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Za glasovanje se moraš prijaviti.
        </p>
      )}

      {tekma && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gnl-800/50 to-slate-900/50 p-3 text-center ring-1 ring-white/10 sm:gap-4 sm:p-5">
          <Grb ime={tekma.home_name} kratko={tekma.home_short} logo={tekma.home_logo} velikost={32} />
          <span className="min-w-0 flex-1 text-right text-sm font-bold sm:text-base">
            {tekma.home_name}
          </span>
          <span className="rounded-xl bg-slate-950 px-3 py-2 text-xl font-black tabular-nums sm:px-4 sm:text-2xl">
            {tekma.home_goals} : {tekma.away_goals}
          </span>
          <span className="min-w-0 flex-1 text-left text-sm font-bold sm:text-base">
            {tekma.away_name}
          </span>
          <Grb ime={tekma.away_name} kratko={tekma.away_short} logo={tekma.away_logo} velikost={32} />
        </div>
      )}

      {tekma && (
        <p className="text-center">
          <Link
            to={`/tekma/${tekma.match_id}`}
            className="text-sm text-slate-400 underline hover:text-gnl-300"
          >
            Poglej postavi in točke te tekme →
          </Link>
        </p>
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
              <GolZaGlasovanje
                key={g.id}
                gol={g}
                tekma={tekma}
                kandidati={igralci.filter(
                  (i) =>
                    i.team_id === g.team_id &&
                    i.player_id !== g.scorer?.id &&
                    i.minutes_played > 0,
                )}
                nastopi={igralci}
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
