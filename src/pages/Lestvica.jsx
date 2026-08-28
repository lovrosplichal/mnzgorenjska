import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatirajTocke } from '../lib/pomozno'

const MEDALJE = ['🥇', '🥈', '🥉']

export default function Lestvica() {
  const [ekipe, setEkipe] = useState([])
  const [krog, setKrog] = useState(null)
  const [krogLestvica, setKrogLestvica] = useState([])
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

      <h2 className="text-lg font-bold">Skupno</h2>
      <ul className="space-y-2">
        {ekipe.map((e, i) => (
          <li
            key={e.fantasy_team_id}
            className={`kartica kartica-hover relative overflow-hidden p-4 ${
              i === 0 ? 'ring-1 ring-amber-400/40' : ''
            }`}
          >
            <span
              className="absolute inset-y-0 left-0 bg-gnl-500/10"
              style={{
                width: `${(Number(e.total_points) / najvec) * 100}%`,
              }}
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
                {formatirajTocke(e.total_points)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
