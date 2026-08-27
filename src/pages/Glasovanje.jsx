import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { IME_POZICIJE } from '../lib/pravila'

const OCENE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function jeOdprt(krog) {
  const zdaj = Date.now()
  const od = krog.voting_opens_at ? Date.parse(krog.voting_opens_at) : -Infinity
  const do_ = krog.voting_closes_at ? Date.parse(krog.voting_closes_at) : Infinity
  return zdaj >= od && zdaj <= do_
}

export default function Glasovanje() {
  const { session, loading } = useAuth()
  const [krogi, setKrogi] = useState([])
  const [krogId, setKrogId] = useState(null)
  const [klubi, setKlubi] = useState([])
  const [klubId, setKlubId] = useState(null)
  const [igralci, setIgralci] = useState([])
  const [ocene, setOcene] = useState({}) // player_id -> ocena
  const [nalaganje, setNalaganje] = useState(true)
  const [shranjujem, setShranjujem] = useState(false)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)

  // krogi in klubi
  useEffect(() => {
    async function nalozi() {
      const [{ data: r }, { data: t }] = await Promise.all([
        supabase
          .from('rounds')
          .select('id, season, number, played_on, voting_opens_at, voting_closes_at')
          .order('number', { ascending: false }),
        supabase.from('teams').select('id, name').order('name'),
      ])
      setKrogi(r ?? [])
      setKlubi(t ?? [])
      const odprt = (r ?? []).find(jeOdprt)
      setKrogId(odprt?.id ?? r?.[0]?.id ?? null)
      setKlubId(t?.[0]?.id ?? null)
      setNalaganje(false)
    }
    nalozi()
  }, [])

  // igralci izbranega kluba + moje obstoječe ocene za izbrani krog
  useEffect(() => {
    if (!klubId || !krogId) return
    let preklican = false

    async function nalozi() {
      const { data: p } = await supabase
        .from('players')
        .select('id, first_name, last_name, position')
        .eq('team_id', klubId)
        .eq('active', true)
        .order('position')
        .order('last_name')
      if (preklican) return
      setIgralci(p ?? [])

      if (session) {
        const { data: r } = await supabase
          .from('ratings')
          .select('player_id, rating')
          .eq('round_id', krogId)
          .eq('voter_id', session.user.id)
        if (preklican) return
        setOcene(Object.fromEntries((r ?? []).map((x) => [x.player_id, Number(x.rating)])))
      } else {
        setOcene({})
      }
    }
    nalozi()
    return () => {
      preklican = true
    }
  }, [klubId, krogId, session])

  const krog = useMemo(() => krogi.find((k) => k.id === krogId), [krogi, krogId])
  const odprto = krog ? jeOdprt(krog) : false

  async function shrani() {
    setNapaka(null)
    setSporocilo(null)
    setShranjujem(true)

    const vrstice = Object.entries(ocene)
      .filter(([, v]) => v != null)
      .map(([playerId, v]) => ({
        round_id: krogId,
        player_id: Number(playerId),
        voter_id: session.user.id,
        rating: v,
      }))

    if (vrstice.length === 0) {
      setShranjujem(false)
      setSporocilo('Ni ocen za shranjevanje.')
      return
    }

    const { error } = await supabase
      .from('ratings')
      .upsert(vrstice, { onConflict: 'round_id,player_id,voter_id' })

    setShranjujem(false)
    if (error) setNapaka(error.message)
    else setSporocilo('Ocene so shranjene. Hvala!')
  }

  if (loading || nalaganje) return <p className="text-slate-500">Nalaganje …</p>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Glasovanje</h1>
      <p className="text-slate-600">
        Oceni predstavo posameznega igralca z oceno od 1 do 10. Oceni le tiste, ki
        si jih dejansko videl igrati — ostale pusti prazne.
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-600">
          Krog
          <select
            value={krogId ?? ''}
            onChange={(e) => setKrogId(Number(e.target.value))}
            className="ml-2 rounded border border-slate-300 px-2 py-1"
          >
            {krogi.map((k) => (
              <option key={k.id} value={k.id}>
                {k.season} — {k.number}. krog{jeOdprt(k) ? ' (odprto)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-600">
          Klub
          <select
            value={klubId ?? ''}
            onChange={(e) => setKlubId(Number(e.target.value))}
            className="ml-2 rounded border border-slate-300 px-2 py-1"
          >
            {klubi.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!session && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Za oddajo ocen se moraš prijaviti.
        </p>
      )}

      {session && !odprto && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Glasovanje za ta krog je zaprto. Ocene si lahko ogledaš, ne moreš pa jih
          več spreminjati.
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
        {igralci.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span className="w-20 text-xs text-slate-500">
              {IME_POZICIJE[i.position] ?? '—'}
            </span>
            <span className="flex-1 text-sm">
              {i.first_name} {i.last_name}
            </span>
            <div className="flex items-center gap-2">
              <select
                disabled={!session || !odprto}
                value={ocene[i.id] ?? ''}
                onChange={(e) =>
                  setOcene({
                    ...ocene,
                    [i.id]: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">—</option>
                {OCENE.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>

      {session && odprto && (
        <div className="flex items-center gap-3">
          <button
            onClick={shrani}
            disabled={shranjujem}
            className="rounded bg-gnl-600 px-4 py-2 text-white hover:bg-gnl-700 disabled:opacity-50"
          >
            {shranjujem ? 'Shranjujem …' : 'Shrani ocene'}
          </button>
          <span className="text-xs text-slate-500">
            Ocene za ta klub: {Object.values(ocene).filter((v) => v != null).length}
          </span>
        </div>
      )}

      {sporocilo && <p className="text-sm text-gnl-600">{sporocilo}</p>}
      {napaka && <p className="text-sm text-red-600">Napaka: {napaka}</p>}
    </div>
  )
}
