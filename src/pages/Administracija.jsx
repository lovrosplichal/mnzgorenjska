import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

function lokalnoZaInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

export default function Administracija() {
  const { session, loading } = useAuth()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [krogi, setKrogi] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [novSezona, setNovSezona] = useState('2026/27')
  const [novStevilka, setNovStevilka] = useState('')

  async function nalozi() {
    const { data } = await supabase
      .from('rounds')
      .select('id, season, number, played_on, voting_opens_at, voting_closes_at')
      .order('number', { ascending: false })
    setKrogi(data ?? [])
  }

  useEffect(() => {
    if (loading) return
    if (!session) {
      setNalaganje(false)
      return
    }
    async function init() {
      const { data: profil } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      setJeAdmin(Boolean(profil?.is_admin))
      await nalozi()
      setNalaganje(false)
    }
    init()
  }, [session, loading])

  async function posodobiKrog(id, polje, vrednost) {
    setNapaka(null)
    setSporocilo(null)
    const iso = vrednost ? new Date(vrednost).toISOString() : null
    const { error } = await supabase
      .from('rounds')
      .update({ [polje]: iso })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setKrogi(krogi.map((k) => (k.id === id ? { ...k, [polje]: iso } : k)))
    setSporocilo('Krog posodobljen.')
  }

  async function dodajKrog(e) {
    e.preventDefault()
    setNapaka(null)
    setSporocilo(null)
    const { error } = await supabase
      .from('rounds')
      .insert({ season: novSezona.trim(), number: Number(novStevilka) })
    if (error) return setNapaka(error.message)
    setNovStevilka('')
    await nalozi()
    setSporocilo('Krog dodan.')
  }

  async function preracunaj(id) {
    setNapaka(null)
    setSporocilo(null)
    const { error } = await supabase.rpc('recompute_round_scores', {
      p_round_id: id,
    })
    if (error) return setNapaka(error.message)
    setSporocilo('Točke za krog so preračunane.')
  }

  if (loading || nalaganje) return <p className="text-slate-500">Nalaganje …</p>
  if (!session)
    return <p className="text-slate-600">Za dostop se moraš prijaviti.</p>
  if (!jeAdmin)
    return (
      <p className="text-slate-600">
        Ta stran je namenjena administratorjem lige.
      </p>
    )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administracija</h1>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Nov krog</h2>
        <form onSubmit={dodajKrog} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Sezona
            <input
              value={novSezona}
              onChange={(e) => setNovSezona(e.target.value)}
              className="mt-1 block rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-600">
            Številka kroga
            <input
              type="number"
              min="1"
              required
              value={novStevilka}
              onChange={(e) => setNovStevilka(e.target.value)}
              className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <button className="rounded bg-gnl-600 px-4 py-2 text-white hover:bg-gnl-700">
            Dodaj
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Krogi</h2>
        {krogi.map((k) => (
          <div
            key={k.id}
            className="rounded border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="mb-2 font-medium">
              {k.season} — {k.number}. krog
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="text-slate-600">
                Glasovanje se odpre
                <input
                  type="datetime-local"
                  defaultValue={lokalnoZaInput(k.voting_opens_at)}
                  onBlur={(e) =>
                    posodobiKrog(k.id, 'voting_opens_at', e.target.value)
                  }
                  className="mt-1 block rounded border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="text-slate-600">
                Glasovanje se zapre
                <input
                  type="datetime-local"
                  defaultValue={lokalnoZaInput(k.voting_closes_at)}
                  onBlur={(e) =>
                    posodobiKrog(k.id, 'voting_closes_at', e.target.value)
                  }
                  className="mt-1 block rounded border border-slate-300 px-2 py-1"
                />
              </label>
              <button
                onClick={() => preracunaj(k.id)}
                className="self-end rounded border border-gnl-600 px-3 py-1.5 text-gnl-600 hover:bg-gnl-50"
              >
                Preračunaj točke
              </button>
            </div>
          </div>
        ))}
      </section>

      {sporocilo && <p className="text-sm text-gnl-600">{sporocilo}</p>}
      {napaka && <p className="text-sm text-red-600">Napaka: {napaka}</p>}
    </div>
  )
}
