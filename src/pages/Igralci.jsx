import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  prikazniIme,
  razredPozicije,
  KRATKA_POZICIJA,
  formatirajTocke,
} from '../lib/pomozno'
import { Link } from 'react-router-dom'
import { POZICIJE } from '../lib/pravila'
import Grb from '../components/Grb'

// Tabela vseh igralcev lige s tekočimi točkami — po kateremkoli stolpcu se da
// razvrstiti, da je razvidno, kdo je v sezoni ali v zadnjih krogih najboljši.
const STOLPCI = [
  { kljuc: 'points', naslov: 'Točke', opis: 'Skupaj v sezoni' },
  { kljuc: 'form', naslov: 'Forma', opis: 'Zadnji trije krogi' },
  { kljuc: 'last_round', naslov: 'Zadnji krog', opis: 'Točke zadnjega kroga' },
  { kljuc: 'points_per_match', naslov: 'Na tekmo', opis: 'Točke na odigrano tekmo' },
  { kljuc: 'points_per_value', naslov: 'Na ceno', opis: 'Točke na enoto cene' },
  { kljuc: 'value', naslov: 'Cena', opis: 'Cena v proračunu' },
  { kljuc: 'goals', naslov: 'Goli', opis: 'Doseženi goli' },
  { kljuc: 'minutes', naslov: 'Minute', opis: 'Odigrane minute' },
  { kljuc: 'owners', naslov: 'Izbran', opis: 'Št. fantasy ekip z igralcem' },
]

export default function Igralci() {
  const [igralci, setIgralci] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)
  const [iskanje, setIskanje] = useState('')
  const [filterPoz, setFilterPoz] = useState('vse')
  const [filterKlub, setFilterKlub] = useState('vsi')
  const [urejanje, setUrejanje] = useState('points')
  const [koliko, setKoliko] = useState(50)
  const [sezone, setSezone] = useState([])
  const [sezona, setSezona] = useState(null)

  // Sezone, ki sploh imajo odigrane tekme; privzeto odpremo tekočo.
  useEffect(() => {
    supabase
      .from('sezone')
      .select('season, odigranih, tekoca')
      .order('season', { ascending: false })
      .then(({ data, error }) => {
        if (error) return setNapaka(error.message)
        const vse = data ?? []
        setSezone(vse)
        const tekoca = vse.find((s) => s.tekoca && s.odigranih > 0)
        setSezona((tekoca ?? vse.find((s) => s.odigranih > 0) ?? vse[0])?.season)
      })
  }, [])

  useEffect(() => {
    if (!sezona) return
    setNalaganje(true)
    supabase
      .from('player_season_standings')
      .select(
        'id, full_name, position, team_id, team_name, team_short, team_logo, value, season, points, form, last_round, points_per_match, points_per_value, owners, goals, minutes, matches, clean_sheets, rank',
      )
      .eq('season', sezona)
      .order('points', { ascending: false })
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setIgralci(data ?? [])
        setNalaganje(false)
      })
  }, [sezona])

  const klubi = useMemo(() => {
    const m = new Map()
    for (const i of igralci) if (i.team_name) m.set(i.team_id, i.team_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sl'))
  }, [igralci])

  const vidni = useMemo(() => {
    const f = igralci.filter((i) => {
      if (filterPoz !== 'vse' && i.position !== filterPoz) return false
      if (filterKlub !== 'vsi' && String(i.team_id) !== filterKlub) return false
      if (iskanje && !i.full_name.toLowerCase().includes(iskanje.toLowerCase()))
        return false
      return true
    })
    return [...f].sort(
      (a, b) => Number(b[urejanje] ?? 0) - Number(a[urejanje] ?? 0),
    )
  }, [igralci, iskanje, filterPoz, filterKlub, urejanje])

  const sezonaPodatki = sezone.find((s) => s.season === sezona)
  const jeLanska = Boolean(sezonaPodatki) && !sezonaPodatki.tekoca

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (napaka) return <p className="text-rose-400">Napaka: {napaka}</p>

  const ekip = igralci.length ? Math.max(...igralci.map((i) => i.owners), 1) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black naslov sm:text-3xl">Igralci</h1>
        <p className="mt-1 text-sm text-slate-400">
          Statistika iz uradnih zapisnikov MNZ Gorenjska. Klikni stolpec za
          razvrstitev.
        </p>
      </div>

      {/* Sezona — brez tega ni jasno, ali gledaš letošnjo ali lansko statistiko. */}
      <div className="flex flex-wrap items-center gap-2">
        {sezone.map((s) => (
          <button
            key={s.season}
            onClick={() => setSezona(s.season)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
              sezona === s.season
                ? 'bg-gnl-500 text-slate-950'
                : 'kartica text-slate-300'
            }`}
          >
            {s.season}
            {s.tekoca && (
              <span className="ml-1.5 text-[10px] font-black uppercase opacity-70">
                tekoča
              </span>
            )}
          </button>
        ))}
        {sezonaPodatki && (
          <span className="text-xs text-slate-500">
            {sezonaPodatki.odigranih === 0
              ? 'sezona se še ni začela — spodaj ni podatkov'
              : `${sezonaPodatki.odigranih} odigranih tekem`}
          </span>
        )}
      </div>

      {jeLanska && (
        <p className="kartica border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          To je statistika sezone <strong>{sezona}</strong>, ne tekoče. Cene
          igralcev v fantasy ligi izhajajo prav iz nje, dokler nova sezona ne
          nabere dovolj tekem.
        </p>
      )}

      <div className="kartica flex flex-wrap gap-2 p-3">
        <input
          value={iskanje}
          onChange={(e) => setIskanje(e.target.value)}
          placeholder="Išči po imenu …"
          className="min-w-40 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        />
        <select
          value={filterKlub}
          onChange={(e) => setFilterKlub(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="vsi">Vsi klubi</option>
          {klubi.map(([id, ime]) => (
            <option key={id} value={id}>
              {ime}
            </option>
          ))}
        </select>
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
      </div>

      <div className="kartica overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Igralec</th>
              {STOLPCI.map((s) => (
                <th key={s.kljuc} className="px-2 py-2 text-right font-semibold">
                  <button
                    onClick={() => setUrejanje(s.kljuc)}
                    title={s.opis}
                    className={`whitespace-nowrap transition hover:text-white ${
                      urejanje === s.kljuc ? 'text-gnl-300' : ''
                    }`}
                  >
                    {s.naslov}
                    {urejanje === s.kljuc ? ' ↓' : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vidni.slice(0, koliko).map((i, idx) => (
              <tr
                key={i.id}
                className="border-b border-white/5 transition hover:bg-white/5"
              >
                <td className="px-3 py-2 text-xs font-black text-slate-600">
                  {idx + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Grb
                      ime={i.team_name}
                      kratko={i.team_short}
                      logo={i.team_logo}
                      velikost={24}
                    />
                    {/* Pozicija je pogosto le ugibanje — klik pelje na
                        glasovanje, kjer jo lahko kdorkoli popravi. */}
                    <Link
                      to="/pozicije"
                      title={
                        i.position
                          ? 'Ni prav? Popravi pozicijo'
                          : 'Pozicija ni znana — pomagaj jo določiti'
                      }
                      className={`znacka ${razredPozicije(i.position)} hover:ring-2`}
                    >
                      {KRATKA_POZICIJA[i.position] ?? '?'}
                    </Link>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {prikazniIme(i.full_name)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {i.team_short} · {i.matches} tekem
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-black tabular-nums">
                  {formatirajTocke(i.points)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                  {formatirajTocke(i.form)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                  {formatirajTocke(i.last_round)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {formatirajTocke(i.points_per_match)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {formatirajTocke(i.points_per_value)}
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-gnl-300">
                  {formatirajTocke(i.value)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {i.goals}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {i.minutes}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {i.owners}
                  <span className="ml-1 text-xs text-slate-600">
                    ({Math.round((i.owners / ekip) * 100)}%)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vidni.length > koliko ? (
        <div className="text-center">
          <button onClick={() => setKoliko(koliko + 50)} className="gumb-tih">
            Pokaži več ({vidni.length - koliko})
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500">
          Prikazanih vseh {vidni.length} igralcev.
        </p>
      )}
    </div>
  )
}
