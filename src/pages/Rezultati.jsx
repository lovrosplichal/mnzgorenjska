// Rezultati odigranih tekem. Klik na tekmo odpre obe postavi s točkami.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTekmovanje } from '../lib/tekmovanje'
import Grb from '../components/Grb'

export default function Rezultati() {
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [tekme, setTekme] = useState([])
  const [sezona, setSezona] = useState(null)
  const [krogId, setKrogId] = useState(null)
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState(null)

  useEffect(() => {
    if (!tekmovanjeId) return
    setNalaganje(true)
    async function nalozi() {
      const { data, error } = await supabase
        .from('match_assist_status')
        .select('*')
        .eq('competition_id', tekmovanjeId)
        .order('played_on', { ascending: false })
      if (error) setNapaka(error.message)
      const vrstice = data ?? []
      setTekme(vrstice)
      const sezone = [...new Set(vrstice.map((t) => t.season))].sort().reverse()
      setSezona(sezone[0] ?? null)
      setKrogId(vrstice.find((t) => t.season === sezone[0])?.round_id ?? null)
      setNalaganje(false)
    }
    nalozi()
  }, [tekmovanjeId])

  const sezone = useMemo(
    () => [...new Set(tekme.map((t) => t.season))].sort().reverse(),
    [tekme],
  )

  const krogi = useMemo(() => {
    const m = new Map()
    for (const t of tekme.filter((t) => t.season === sezona))
      m.set(t.round_id, { id: t.round_id, number: t.round_number })
    return [...m.values()].sort((a, b) => b.number - a.number)
  }, [tekme, sezona])

  const vKrogu = useMemo(
    () => tekme.filter((t) => t.round_id === krogId),
    [tekme, krogId],
  )

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black naslov">
          Rezultati{tekmovanje ? ` — ${tekmovanje.short_name.toLowerCase()}` : ''}
        </h1>
        <p className="max-w-2xl text-slate-400">
          Odigrane tekme iz zapisnikov MNZ Gorenjska. Klikni na tekmo in vidiš
          obe postavi na igrišču — na vsakem dresu točke, ki jih je igralec
          zaslužil.
        </p>
      </header>

      {sezone.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {sezone.map((sz) => (
            <button
              key={sz}
              onClick={() => {
                setSezona(sz)
                setKrogId(tekme.find((t) => t.season === sz)?.round_id ?? null)
              }}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                sezona === sz ? 'bg-gnl-500 text-slate-950' : 'kartica text-slate-300'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {krogi.map((k) => (
          <button
            key={k.id}
            onClick={() => setKrogId(k.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              krogId === k.id ? 'bg-gnl-500 text-slate-950' : 'kartica text-slate-300'
            }`}
          >
            {k.number}. krog
          </button>
        ))}
      </div>

      {vKrogu.length === 0 ? (
        <p className="text-slate-400">V tem krogu ni odigranih tekem.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {vKrogu.map((t) => (
            <li key={t.match_id}>
              <Link
                to={`/tekma/${t.match_id}`}
                className="kartica kartica-hover flex items-center gap-2 p-3"
              >
                <Grb ime={t.home_name} kratko={t.home_short} logo={t.home_logo} velikost={24} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {t.home_short} – {t.away_short}
                </span>
                <Grb ime={t.away_name} kratko={t.away_short} logo={t.away_logo} velikost={24} />
                <span className="rounded-lg bg-slate-950/60 px-2 py-0.5 text-sm font-black tabular-nums">
                  {t.home_goals}:{t.away_goals}
                </span>
                <span className="text-slate-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}
