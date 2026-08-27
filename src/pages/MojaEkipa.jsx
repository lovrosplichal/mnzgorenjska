import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import {
  VELIKOST_EKIPE,
  STEVILO_PRVIH,
  MAX_IZ_KLUBA,
  PRORACUN,
  POZICIJE,
  preveriEkipo,
} from '../lib/pravila'
import {
  prikazniIme,
  razredPozicije,
  KRATKA_POZICIJA,
  formatirajTocke,
} from '../lib/pomozno'

export default function MojaEkipa() {
  const { session, loading } = useAuth()
  const [ekipa, setEkipa] = useState(null)
  const [imeEkipe, setImeEkipe] = useState('')
  const [igralci, setIgralci] = useState([])
  const [izbrani, setIzbrani] = useState([])
  const [nalaganje, setNalaganje] = useState(true)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [filterKlub, setFilterKlub] = useState('vsi')
  const [filterPoz, setFilterPoz] = useState('vse')
  const [iskanje, setIskanje] = useState('')

  useEffect(() => {
    if (loading) return
    if (!session) {
      setNalaganje(false)
      return
    }

    async function nalozi() {
      const { data: vsi, error } = await supabase
        .from('player_overview')
        .select(
          'id, full_name, position, team_id, team_name, team_short, value, points, goals, minutes',
        )
        .order('value', { ascending: false })
      if (error) {
        setNapaka(error.message)
        setNalaganje(false)
        return
      }
      setIgralci(vsi ?? [])

      const { data: moja } = await supabase
        .from('fantasy_teams')
        .select('id, name, budget')
        .eq('owner_id', session.user.id)
        .maybeSingle()

      if (moja) {
        setEkipa(moja)
        setImeEkipe(moja.name)
        const { data: nabor } = await supabase
          .from('fantasy_roster')
          .select('player_id, is_starter')
          .eq('fantasy_team_id', moja.id)
        setIzbrani(nabor ?? [])
      }
      setNalaganje(false)
    }
    nalozi()
  }, [session, loading])

  const poId = useMemo(
    () => Object.fromEntries(igralci.map((i) => [i.id, i])),
    [igralci],
  )

  const izbraniPodrobno = useMemo(
    () =>
      izbrani
        .map((s) => ({ ...poId[s.player_id], ...s }))
        .filter((s) => s.id != null),
    [izbrani, poId],
  )

  const proracun = ekipa?.budget ?? PRORACUN
  const porabljeno = izbraniPodrobno.reduce((v, s) => v + Number(s.value ?? 0), 0)
  const preostalo = proracun - porabljeno
  const napakeEkipe = preveriEkipo(izbraniPodrobno, proracun)

  const klubi = useMemo(() => {
    const m = new Map()
    for (const i of igralci) if (i.team_name) m.set(i.team_id, i.team_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sl'))
  }, [igralci])

  function preklopi(igralec) {
    setSporocilo(null)
    if (izbrani.find((s) => s.player_id === igralec.id)) {
      setIzbrani(izbrani.filter((s) => s.player_id !== igralec.id))
      return
    }
    if (izbrani.length >= VELIKOST_EKIPE)
      return setSporocilo(`Ekipa je polna (${VELIKOST_EKIPE} igralcev).`)

    const cena = Number(igralec.value ?? 0)
    if (cena > preostalo)
      return setSporocilo(
        `Premalo proračuna — ${igralec.full_name} stane ${formatirajTocke(cena)}, na voljo imaš ${formatirajTocke(preostalo)}.`,
      )

    const izKluba = izbraniPodrobno.filter(
      (s) => s.team_id === igralec.team_id,
    ).length
    if (izKluba >= MAX_IZ_KLUBA)
      return setSporocilo(
        `Iz kluba ${igralec.team_name} imaš že ${MAX_IZ_KLUBA} igralce.`,
      )

    const prvih = izbrani.filter((s) => s.is_starter).length
    setIzbrani([
      ...izbrani,
      { player_id: igralec.id, is_starter: prvih < STEVILO_PRVIH },
    ])
  }

  function preklopiPrvo(playerId) {
    setIzbrani(
      izbrani.map((s) =>
        s.player_id === playerId ? { ...s, is_starter: !s.is_starter } : s,
      ),
    )
  }

  async function shrani() {
    setNapaka(null)
    setSporocilo(null)

    let ekipaId = ekipa?.id
    if (!ekipaId) {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .insert({ owner_id: session.user.id, name: imeEkipe.trim() })
        .select('id, name, budget')
        .single()
      if (error) return setNapaka(error.message)
      ekipaId = data.id
      setEkipa(data)
    } else if (imeEkipe.trim() !== ekipa.name) {
      const { error } = await supabase
        .from('fantasy_teams')
        .update({ name: imeEkipe.trim() })
        .eq('id', ekipaId)
      if (error) return setNapaka(error.message)
      setEkipa({ ...ekipa, name: imeEkipe.trim() })
    }

    await supabase.from('fantasy_roster').delete().eq('fantasy_team_id', ekipaId)
    if (izbrani.length) {
      const { error } = await supabase.from('fantasy_roster').insert(
        izbrani.map((s) => ({
          fantasy_team_id: ekipaId,
          player_id: s.player_id,
          is_starter: s.is_starter,
        })),
      )
      if (error) return setNapaka(error.message)
    }
    setSporocilo('Ekipa je shranjena. 💾')
  }

  if (loading || nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (!session)
    return (
      <p className="kartica p-6 text-center text-slate-300">
        Za sestavo ekipe se moraš prijaviti.
      </p>
    )

  const vidni = igralci.filter((i) => {
    if (filterKlub !== 'vsi' && String(i.team_id) !== filterKlub) return false
    if (filterPoz !== 'vse' && i.position !== filterPoz) return false
    if (iskanje && !i.full_name.toLowerCase().includes(iskanje.toLowerCase()))
      return false
    return true
  })

  const steviloPrvih = izbraniPodrobno.filter((s) => s.is_starter).length

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black naslov">Moja ekipa</h1>

      {/* proračun */}
      <div className="kartica grid grid-cols-3 gap-3 p-4">
        <Merilo oznaka="Proračun" vrednost={formatirajTocke(proracun)} />
        <Merilo
          oznaka="Porabljeno"
          vrednost={formatirajTocke(porabljeno)}
          barva={porabljeno > proracun ? 'text-rose-400' : undefined}
        />
        <Merilo
          oznaka="Ostane"
          vrednost={formatirajTocke(preostalo)}
          barva={preostalo < 0 ? 'text-rose-400' : 'text-gnl-300'}
        />
        <div className="col-span-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                porabljeno > proracun
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-gnl-500 to-gnl-300'
              }`}
              style={{
                width: `${Math.min(100, (porabljeno / proracun) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              {izbrani.length}/{VELIKOST_EKIPE} igralcev
            </span>
            <span>
              prva postava {steviloPrvih}/{STEVILO_PRVIH}
            </span>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ime ekipe
        </span>
        <input
          value={imeEkipe}
          onChange={(e) => setImeEkipe(e.target.value)}
          placeholder="npr. Gorenjski Orli"
          className="mt-1 w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
        />
      </label>

      {/* izbrani po pozicijah */}
      <section className="kartica p-4">
        {izbraniPodrobno.length === 0 ? (
          <p className="text-sm text-slate-400">
            Spodaj izberi igralce. Kliknil boš na ⊕, cena se odšteje od
            proračuna.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(POZICIJE).map(([koda, p]) => {
              const skupina = izbraniPodrobno.filter((s) => s.position === koda)
              if (!skupina.length) return null
              return (
                <div key={koda}>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                    {p.naslov}
                  </h3>
                  <ul className="space-y-1">
                    {skupina.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm"
                      >
                        <button
                          onClick={() => preklopiPrvo(s.id)}
                          title="Prva postava / klop"
                          className={`znacka ${
                            s.is_starter
                              ? 'bg-gnl-400/25 text-gnl-200'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {s.is_starter ? 'prva' : 'klop'}
                        </button>
                        <span className="min-w-0 flex-1 truncate">
                          {prikazniIme(s.full_name)}
                        </span>
                        <span className="tabular-nums text-slate-400">
                          {formatirajTocke(s.value)}
                        </span>
                        <button
                          onClick={() => preklopi(s)}
                          className="text-slate-500 hover:text-rose-400"
                          title="Odstrani"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {napakeEkipe.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-amber-300">
            {napakeEkipe.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={shrani}
            disabled={!imeEkipe.trim()}
            className="gumb-glavni"
          >
            Shrani ekipo
          </button>
          {napakeEkipe.length > 0 && (
            <span className="text-xs text-slate-500">
              Osnutek lahko shraniš tudi, če pravila še niso izpolnjena.
            </span>
          )}
        </div>
        {sporocilo && <p className="mt-2 text-sm text-gnl-300">{sporocilo}</p>}
        {napaka && <p className="mt-2 text-sm text-rose-400">Napaka: {napaka}</p>}
      </section>

      {/* trg igralcev */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Trg igralcev</h2>
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

        <ul className="space-y-2">
          {vidni.slice(0, 80).map((i) => {
            const jeIzbran = izbrani.some((s) => s.player_id === i.id)
            const predrag = !jeIzbran && Number(i.value) > preostalo
            return (
              <li
                key={i.id}
                className={`kartica flex items-center gap-3 p-3 ${
                  jeIzbran ? 'ring-1 ring-gnl-400/40' : ''
                } ${predrag ? 'opacity-50' : 'kartica-hover'}`}
              >
                <span className={`znacka ${razredPozicije(i.position)}`}>
                  {KRATKA_POZICIJA[i.position] ?? '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {prikazniIme(i.full_name)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {i.team_short} · {i.goals} golov · {i.minutes} min
                  </div>
                </div>
                <span className="w-12 text-right font-black tabular-nums text-gnl-300">
                  {formatirajTocke(i.value)}
                </span>
                <button
                  onClick={() => preklopi(i)}
                  disabled={predrag}
                  className={jeIzbran ? 'gumb-tih' : 'gumb-glavni'}
                >
                  {jeIzbran ? '✕' : '⊕'}
                </button>
              </li>
            )
          })}
        </ul>
        {vidni.length > 80 && (
          <p className="text-center text-xs text-slate-500">
            Prikazanih prvih 80 od {vidni.length} — zoži izbor z iskanjem.
          </p>
        )}
      </section>
    </div>
  )
}

function Merilo({ oznaka, vrednost, barva }) {
  return (
    <div>
      <div className={`text-2xl font-black tabular-nums ${barva ?? ''}`}>
        {vrednost}
      </div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
