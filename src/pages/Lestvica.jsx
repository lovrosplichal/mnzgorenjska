import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Lestvica() {
  const [ekipe, setEkipe] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)

  useEffect(() => {
    supabase
      .from('fantasy_team_standings')
      .select('fantasy_team_id, team_name, total_points')
      .order('total_points', { ascending: false })
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setEkipe(data ?? [])
        setNalaganje(false)
      })
  }, [])

  if (nalaganje) return <p className="text-slate-500">Nalaganje …</p>
  if (napaka) return <p className="text-red-600">Napaka: {napaka}</p>
  if (ekipe.length === 0)
    return <p className="text-slate-500">Lestvica je še prazna.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lestvica</h1>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-2 w-10">#</th>
            <th className="py-2">Ekipa</th>
            <th className="py-2 text-right">Točke</th>
          </tr>
        </thead>
        <tbody>
          {ekipe.map((e, idx) => (
            <tr key={e.fantasy_team_id} className="border-b border-slate-100">
              <td className="py-2 text-slate-500">{idx + 1}</td>
              <td className="py-2">{e.team_name}</td>
              <td className="py-2 text-right font-medium">
                {Number(e.total_points ?? 0).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
