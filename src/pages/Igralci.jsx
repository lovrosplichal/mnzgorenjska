import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Igralci() {
  const [igralci, setIgralci] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)

  useEffect(() => {
    supabase
      .from('players')
      .select('id, first_name, last_name, position, teams(name)')
      .order('last_name')
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setIgralci(data ?? [])
        setNalaganje(false)
      })
  }, [])

  if (nalaganje) return <p className="text-slate-500">Nalaganje …</p>
  if (napaka) return <p className="text-red-600">Napaka: {napaka}</p>
  if (igralci.length === 0)
    return <p className="text-slate-500">Ni še vnesenih igralcev.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Igralci</h1>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-2">Igralec</th>
            <th className="py-2">Klub</th>
            <th className="py-2">Pozicija</th>
          </tr>
        </thead>
        <tbody>
          {igralci.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="py-2">
                {i.first_name} {i.last_name}
              </td>
              <td className="py-2 text-slate-600">{i.teams?.name ?? '—'}</td>
              <td className="py-2 text-slate-600">{i.position ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
