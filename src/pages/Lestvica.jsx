import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatirajTocke } from '../lib/pomozno'

const MEDALJE = ['🥇', '🥈', '🥉']

export default function Lestvica() {
  const [ekipe, setEkipe] = useState([])
  const [krog, setKrog] = useState(null)
  const [krogLestvica, setKrogLestvica] = useState([])
  const [vsiKrogiOdigrani, setVsiKrogiOdigrani] = useState([]) // [{id, number, season}]
  const [odigraneTocke, setOdigraneTocke] = useState([]) // fantasy_round_standings rows
  const [odKroga, setOdKroga] = useState(1) // filter "od kroga N naprej"
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)

  useEffect(() => {
    supabase
      .from('fantasy_team_standings')
      .select('fantasy_team_id, team_name, owner_name, total_points')
      .order('total_points', { ascending: false })
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setEkipe(data ?? [])
        setNalaganje(false)
      })

    // Zmagovalec zadnjega odigranega kroga — ta je pogosto zanimivejši od
    // skupne lestvice, ker se menja vsak teden.
    async function nalozi() {
      const { data: zadnji } = await supabase
        .from('zadnji_odigrani_krog')
        .select('id, season, number')
        .maybeSingle()
      setKrog(zadnji ?? null)
      if (!zadnji) return

      // Vsi odigrani krogi te sezone (za selektor "od kroga N").
      const { data: krogi } = await supabase
        .from('rounds')
        .select('id, number, season')
        .eq('season', zadnji.season)
        .order('number', { ascending: true })
      const idsOdigranih = new Set()
      // Odigran = ima fantasy_round_standings vrstice
      const { data: vseTocke } = await supabase
        .from('fantasy_round_standings')
        .select('round_id, fantasy_team_id, team_name, owner_name, points, penalty, transfers')
      for (const t of vseTocke ?? []) idsOdigranih.add(t.round_id)
      const odigraniKrogi = (krogi ?? []).filter((k) => idsOdigranih.has(k.id))
      setVsiKrogiOdigrani(odigraniKrogi)
      setOdigraneTocke(vseTocke ?? [])

      const { data } = await supabase
        .from('fantasy_round_standings')
        .select('fantasy_team_id, team_name, owner_name, points, transfers, penalty, rank')
        .eq('round_id', zadnji.id)
        .order('points', { ascending: false })
        .limit(10)
      setKrogLestvica(data ?? [])
    }
    nalozi()
  }, [])

  // Zmagovalec vsakega odigranega kroga — pregled sezone kdo je bil #1
  // kdaj. Iz fantasy_round_standings vzamemo vrstico z max points na
  // krog. (transfer penalty je že odšteta v .points, glede na definicijo
  // pogleda? Če ne, preverimo tudi tam.)
  const zmagovalciKrogov = useMemo(() => {
    const najPoKrogu = new Map()
    for (const t of odigraneTocke) {
      const prej = najPoKrogu.get(t.round_id)
      if (!prej || Number(t.points ?? 0) > Number(prej.points ?? 0)) {
        najPoKrogu.set(t.round_id, t)
      }
    }
    // Poveži s številkami krogov, sortiraj naraščajoče po number.
    return [...najPoKrogu.entries()]
      .map(([roundId, t]) => {
        const k = vsiKrogiOdigrani.find((x) => x.id === roundId)
        return k ? { ...t, round_number: k.number, season: k.season } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.round_number - b.round_number)
  }, [odigraneTocke, vsiKrogiOdigrani])

  // Lestvica "od kroga N naprej": sešteje points - penalty za vse kroge
  // te sezone, katerih number >= odKroga, in razvrsti ekipe.
  const lestvicaOd = useMemo(() => {
    if (odKroga <= 1) return null // enako kot Skupno
    const idsOd = new Set(
      vsiKrogiOdigrani.filter((k) => k.number >= odKroga).map((k) => k.id),
    )
    const skupine = new Map()
    for (const t of odigraneTocke) {
      if (!idsOd.has(t.round_id)) continue
      const prej = skupine.get(t.fantasy_team_id) ?? {
        fantasy_team_id: t.fantasy_team_id,
        team_name: t.team_name,
        owner_name: t.owner_name,
        points: 0,
        krogov: 0,
      }
      prej.points += Number(t.points ?? 0) - Number(t.penalty ?? 0)
      prej.krogov += 1
      skupine.set(t.fantasy_team_id, prej)
    }
    return [...skupine.values()].sort((a, b) => b.points - a.points)
  }, [odKroga, vsiKrogiOdigrani, odigraneTocke])

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (napaka) return <p className="text-rose-400">Napaka: {napaka}</p>

  if (ekipe.length === 0)
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black naslov">Lestvica</h1>
        <p className="kartica p-6 text-center text-slate-400">
          Lestvica je še prazna — sestavi prvo ekipo!
        </p>
      </div>
    )

  const najvec = Math.max(...ekipe.map((e) => Number(e.total_points) || 0), 1)

  const zmagovalecKroga = krogLestvica[0]

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black naslov sm:text-3xl">Lestvica</h1>

      {zmagovalecKroga && (
        <section className="kartica space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">
              🏆 Zmagovalec {krog?.number}. kroga
            </h2>
            <span className="text-xs text-slate-500">{krog?.season}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gnl-500/10 p-3 ring-1 ring-gnl-400/30">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{zmagovalecKroga.team_name}</div>
              <div className="text-xs text-slate-500">
                {zmagovalecKroga.owner_name}
              </div>
            </div>
            <span className="text-2xl font-black tabular-nums text-gnl-300">
              {formatirajTocke(zmagovalecKroga.points)}
            </span>
          </div>

          {krogLestvica.length > 1 && (
            <ul className="space-y-1">
              {krogLestvica.slice(1, 5).map((e) => (
                <li
                  key={e.fantasy_team_id}
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
                >
                  <span className="w-5 text-center text-xs font-black text-slate-600">
                    {e.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.team_name}</span>
                  {e.penalty > 0 && (
                    <span
                      className="text-xs text-rose-400"
                      title={`${e.transfers} prestopov — kazen ${e.penalty} točk`}
                    >
                      −{e.penalty}
                    </span>
                  )}
                  <span className="font-bold tabular-nums">
                    {formatirajTocke(e.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Zmagovalci vseh odigranih krogov — pregled sezone. */}
      {zmagovalciKrogov.length > 0 && (
        <section className="kartica space-y-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Zmagovalci po krogih</h2>
            <span className="text-xs text-slate-500">
              {zmagovalciKrogov.length}{' '}
              {zmagovalciKrogov.length === 1 ? 'odigran krog' : 'odigranih krogov'}
            </span>
          </div>
          <ul className="space-y-1">
            {zmagovalciKrogov.map((z) => (
              <li
                key={z.round_id}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
              >
                <span className="znacka bg-gnl-400/15 text-[10px] text-gnl-200">
                  {z.round_number}. krog
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  🏆 {z.team_name}
                </span>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {z.owner_name}
                </span>
                <span className="font-black tabular-nums text-gnl-300">
                  {formatirajTocke(z.points)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Selektor "od kroga X naprej" — če se ekipa priključi kasneje, ima
          še zmeraj svojo lestvico. */}
      {vsiKrogiOdigrani.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-bold">
              {odKroga === 1
                ? 'Skupno (celotna sezona)'
                : `Od ${odKroga}. kroga naprej`}
            </h2>
            <span className="text-xs text-slate-500">
              Priključil si se pozneje? Izberi svoj krog in tekmuj od tam.
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setOdKroga(1)}
              className={`znacka transition ${
                odKroga === 1
                  ? 'bg-gnl-500 text-slate-950'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Celotna sezona
            </button>
            {vsiKrogiOdigrani
              .filter((k) => k.number > 1)
              .map((k) => (
                <button
                  key={k.id}
                  onClick={() => setOdKroga(k.number)}
                  className={`znacka transition ${
                    odKroga === k.number
                      ? 'bg-gnl-500 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Od {k.number}. kroga
                </button>
              ))}
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {(lestvicaOd ?? ekipe).map((e, i) => {
          const tocke = lestvicaOd
            ? Number(e.points ?? 0)
            : Number(e.total_points ?? 0)
          const najvecTock = lestvicaOd
            ? Math.max(...(lestvicaOd.map((x) => Number(x.points) || 0)), 1)
            : najvec
          return (
            <li
              key={e.fantasy_team_id}
              className={`kartica kartica-hover relative overflow-hidden p-4 ${
                i === 0 ? 'ring-1 ring-amber-400/40' : ''
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-gnl-500/10"
                style={{ width: `${(tocke / najvecTock) * 100}%` }}
                aria-hidden
              />
              <div className="relative flex items-center gap-3">
                <span className="w-8 text-center text-lg font-black text-slate-500">
                  {MEDALJE[i] ?? i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{e.team_name}</div>
                  <div className="text-xs text-slate-500">{e.owner_name}</div>
                </div>
                <span className="text-xl font-black tabular-nums text-gnl-300">
                  {formatirajTocke(tocke)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
