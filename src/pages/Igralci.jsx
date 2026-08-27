import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  prikazniIme,
  razredPozicije,
  KRATKA_POZICIJA,
  formatirajTocke,
} from '../lib/pomozno'
import { POZICIJE } from '../lib/pravila'

const STOLPCI = [
  { kljuc: 'value', naslov: 'Cena' },
  { kljuc: 'points', naslov: 'Točke' },
  { kljuc: 'goals', naslov: 'Goli' },
  { kljuc: 'minutes', naslov: 'Minute' },
]

export default function Igralci() {
  const [igralci, setIgralci] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)
  const [iskanje, setIskanje] = useState('')
  const [filterPoz, setFilterPoz] = useState('vse')
  const [urejanje, setUrejanje] = useState('points')

  useEffect(() => {
    supabase
      .from('player_overview')
      .select(
        'id, full_name, position, team_name, team_short, value, points, goals, minutes, matches, clean_sheets',
      )
      .order('points', { ascending: false })
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setIgralci(data ?? [])
        setNalaganje(false)
      })
  }, [])

  const vidni = useMemo(() => {
    const f = igralci.filter((i) => {
      if (filterPoz !== 'vse' && i.position !== filterPoz) return false
      if (iskanje && !i.full_name.toLowerCase().includes(iskanje.toLowerCase()))
        return false
      return true
    })
    return [...f].sort((a, b) => Number(b[urejanje] ?? 0) - Number(a[urejanje] ?? 0))
  }, [igralci, iskanje, filterPoz, urejanje])

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (napaka) return <p className="text-rose-400">Napaka: {napaka}</p>

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black naslov">Igralci</h1>
      <p className="text-sm text-slate-400">
        Statistika prejšnje sezone iz uradnih zapisnikov. Cena izhaja iz nje.
      </p>

      <div className="kartica flex flex-wrap gap-2 p-3">
        <input
          value={iskanje}
          onChange={(e) => setIskanje(e.target.value)}
          placeholder="Išči po imenu …"
          className="min-w-40 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        />
        <select
          value={filterPoz}
          onChange={(e) => setFilterPoz(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="vse">Vse pozicije</option>
          {Object.entries(POZICIJE).map(([k, p]) => (
            <option key={k} value={k}>
              {p.naslov}
            </option>
          ))}
        </select>
        <select
          value={urejanje}
          onChange={(e) => setUrejanje(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        >
          {STOLPCI.map((s) => (
            <option key={s.kljuc} value={s.kljuc}>
              Uredi po: {s.naslov}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {vidni.slice(0, 100).map((i, idx) => (
          <li key={i.id} className="kartica kartica-hover flex items-center gap-3 p-3">
            <span className="w-6 text-center text-xs font-black text-slate-600">
              {idx + 1}
            </span>
            <span className={`znacka ${razredPozicije(i.position)}`}>
              {KRATKA_POZICIJA[i.position] ?? '?'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {prikazniIme(i.full_name)}
              </div>
              <div className="text-xs text-slate-500">
                {i.team_name} · {i.matches} tekem · {i.minutes} min
              </div>
            </div>
            <div className="hidden w-14 text-right text-sm tabular-nums text-slate-400 sm:block">
              {i.goals} ⚽
            </div>
            <div className="w-14 text-right font-black tabular-nums">
              {formatirajTocke(i.points)}
            </div>
            <div className="w-12 text-right font-black tabular-nums text-gnl-300">
              {formatirajTocke(i.value)}
            </div>
          </li>
        ))}
      </ul>
      {vidni.length > 100 && (
        <p className="text-center text-xs text-slate-500">
          Prikazanih prvih 100 od {vidni.length}.
        </p>
      )}
    </div>
  )
}
