import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, IME_POZICIJE, formatirajTocke } from '../lib/pomozno'

export default function Administracija() {
  const { session, loading } = useAuth()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [nalaganje, setNalaganje] = useState(true)
  const [opozorila, setOpozorila] = useState([])
  const [brezPozicije, setBrezPozicije] = useState(0)
  const [brezAsistence, setBrezAsistence] = useState(0)
  const [krogi, setKrogi] = useState([])
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [iskanje, setIskanje] = useState('')
  const [zadetki, setZadetki] = useState([])

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
      const admin = Boolean(profil?.is_admin)
      setJeAdmin(admin)

      if (admin) {
        const [tekme, bp, ba, kr] = await Promise.all([
          supabase
            .from('matches')
            .select('id, zapisnik_id, source_url, import_warnings')
            .not('import_warnings', 'eq', '{}')
            .limit(50),
          supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .is('position', null),
          supabase
            .from('goals')
            .select('id', { count: 'exact', head: true })
            .is('assist_player_id', null)
            .eq('is_own_goal', false),
          supabase
            .from('rounds')
            .select('id, season, number')
            .order('season')
            .order('number'),
        ])
        setOpozorila((tekme.data ?? []).filter((t) => t.import_warnings?.length))
        setBrezPozicije(bp.count ?? 0)
        setBrezAsistence(ba.count ?? 0)
        setKrogi(kr.data ?? [])
      }
      setNalaganje(false)
    }
    init()
  }, [session, loading])

  async function preracunajVse() {
    setNapaka(null)
    setSporocilo('Preračunavam …')
    for (const k of krogi) {
      const { error } = await supabase.rpc('recompute_round_scores', {
        p_round_id: k.id,
      })
      if (error) {
        setSporocilo(null)
        return setNapaka(`${k.season}/${k.number}: ${error.message}`)
      }
    }
    setSporocilo(`Točke preračunane za ${krogi.length} krogov.`)
  }

  async function isciIgralca(e) {
    e.preventDefault()
    if (!iskanje.trim()) return setZadetki([])
    const { data } = await supabase
      .from('player_overview')
      .select('id, full_name, team_name, position, value, minutes, goals')
      .ilike('full_name', `%${iskanje.trim()}%`)
      .limit(15)
    setZadetki(data ?? [])
  }

  async function nastaviPozicijo(id, pozicija) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ position: pozicija, position_source: 'admin' })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setZadetki(zadetki.map((z) => (z.id === id ? { ...z, position: pozicija } : z)))
    setSporocilo('Pozicija nastavljena.')
  }

  async function shraniNzs(id, polje, vrednost) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ [polje]: vrednost, nzs_confirmed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setSporocilo('NZS podatek shranjen. Vrednost se posodobi ob naslednjem ovrednotenju.')
  }

  if (loading || nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (!session)
    return <p className="text-slate-300">Za dostop se moraš prijaviti.</p>
  if (!jeAdmin)
    return (
      <p className="kartica p-6 text-center text-slate-300">
        Ta stran je namenjena administratorjem lige.
      </p>
    )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black naslov">Administracija</h1>

      {/* pregled */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kazalnik oznaka="Krogov" vrednost={krogi.length} />
        <Kazalnik oznaka="Brez pozicije" vrednost={brezPozicije} opozori />
        <Kazalnik oznaka="Brez asistence" vrednost={brezAsistence} opozori />
        <Kazalnik oznaka="Opozoril" vrednost={opozorila.length} opozori />
      </section>

      <section className="kartica space-y-3 p-4">
        <h2 className="font-bold">Točke</h2>
        <p className="text-sm text-slate-400">
          Točke se preračunajo iz nastopov. Poženi po uvozu zapisnikov ali ko se
          potrdi večje število asistenc in pozicij.
        </p>
        <button onClick={preracunajVse} className="gumb-glavni">
          Preračunaj vse kroge
        </button>
      </section>

      {/* uvoz */}
      <section className="kartica space-y-2 p-4">
        <h2 className="font-bold">Uvoz zapisnikov</h2>
        <p className="text-sm text-slate-400">
          Uvoz teče iz ukazne vrstice, ker zahteva dostop do spletne strani MNZ:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">
{`SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-zapisnikov.mjs --liga 1600
SUPABASE_SERVICE_ROLE_KEY=... node scripts/ovrednoti-igralce.mjs`}
        </pre>
      </section>

      {/* opozorila iz zapisnikov */}
      {opozorila.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Nepopolni zapisniki</h2>
          <p className="text-sm text-slate-400">
            Te tekme so bile uvožene, a zapisnik ni bil popoln. Preveri jih na
            izvoru.
          </p>
          <ul className="space-y-2">
            {opozorila.map((t) => (
              <li key={t.id} className="kartica p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Zapisnik {t.zapisnik_id}</span>
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gnl-300 hover:underline"
                  >
                    odpri ↗
                  </a>
                </div>
                <ul className="mt-1 text-amber-300">
                  {t.import_warnings.map((o, i) => (
                    <li key={i}>• {o}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* igralci: pozicija in NZS */}
      <section className="kartica space-y-3 p-4">
        <h2 className="font-bold">Igralec — pozicija in NZS</h2>
        <p className="text-sm text-slate-400">
          Administratorjeva pozicija povozi glasovanje. Podatke z NZS vnesi
          ročno — iskalnik NZS robotom ni dostopen.
        </p>
        <form onSubmit={isciIgralca} className="flex gap-2">
          <input
            value={iskanje}
            onChange={(e) => setIskanje(e.target.value)}
            placeholder="Priimek ali ime …"
            className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button className="gumb-glavni">Išči</button>
        </form>

        <ul className="space-y-2">
          {zadetki.map((z) => (
            <li key={z.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-semibold">
                  {prikazniIme(z.full_name)}
                </span>
                <span className="text-xs text-slate-500">{z.team_name}</span>
                <span className="text-xs text-slate-400">
                  {z.position ? IME_POZICIJE[z.position] : 'brez pozicije'} ·{' '}
                  {formatirajTocke(z.value)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {['GK', 'DEF', 'MID', 'FWD'].map((p) => (
                  <button
                    key={p}
                    onClick={() => nastaviPozicijo(z.id, p)}
                    className={`znacka poz-${p} ${
                      z.position === p ? 'ring-2 ring-white/40' : ''
                    }`}
                  >
                    {IME_POZICIJE[p]}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  onChange={(e) =>
                    e.target.value && shraniNzs(z.id, 'nzs_top_league', e.target.value)
                  }
                  defaultValue=""
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="">Najvišja liga (NZS) …</option>
                  <option value="1SNL">1. SNL</option>
                  <option value="2SNL">2. SNL</option>
                  <option value="3SNL">3. SNL</option>
                </select>
                <input
                  type="number"
                  placeholder="minute v tej ligi"
                  onBlur={(e) =>
                    e.target.value &&
                    shraniNzs(z.id, 'nzs_top_league_minutes', Number(e.target.value))
                  }
                  className="w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {sporocilo && <p className="text-sm text-gnl-300">{sporocilo}</p>}
      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}

function Kazalnik({ oznaka, vrednost, opozori }) {
  return (
    <div
      className={`kartica p-4 ${opozori && vrednost > 0 ? 'ring-1 ring-amber-400/40' : ''}`}
    >
      <div className="text-2xl font-black tabular-nums">{vrednost}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
