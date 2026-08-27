import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatirajTocke } from '../lib/pomozno'

const MEDALJE = ['🥇', '🥈', '🥉']

export default function Lestvica() {
  const [ekipe, setEkipe] = useState([])
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

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black naslov">Lestvica</h1>
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
