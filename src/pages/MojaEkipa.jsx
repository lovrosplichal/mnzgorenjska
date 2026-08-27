import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import {
  VELIKOST_EKIPE,
  STEVILO_PRVIH,
  MAX_IZ_KLUBA,
  POZICIJE,
  IME_POZICIJE,
  preveriEkipo,
} from '../lib/pravila'

export default function MojaEkipa() {
  const { session, loading } = useAuth()
  const [ekipa, setEkipa] = useState(null)
  const [imeEkipe, setImeEkipe] = useState('')
  const [igralci, setIgralci] = useState([])
  const [izbrani, setIzbrani] = useState([]) // [{ player_id, is_starter }]
  const [nalaganje, setNalaganje] = useState(true)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [filterKlub, setFilterKlub] = useState('vsi')

  useEffect(() => {
    if (loading) return
    if (!session) {
      setNalaganje(false)
      return
    }

    async function nalozi() {
      const { data: vsiIgralci, error: e1 } = await supabase
        .from('players')
        .select('id, first_name, last_name, position, team_id, teams(name, short_name)')
        .eq('active', true)
        .order('last_name')
      if (e1) {
        setNapaka(e1.message)
        setNalaganje(false)
        return
      }
      setIgralci(vsiIgralci ?? [])

      const { data: mojaEkipa } = await supabase
        .from('fantasy_teams')
        .select('id, name')
        .eq('owner_id', session.user.id)
        .maybeSingle()

      if (mojaEkipa) {
        setEkipa(mojaEkipa)
        setImeEkipe(mojaEkipa.name)
        const { data: nabor } = await supabase
          .from('fantasy_roster')
          .select('player_id, is_starter')
          .eq('fantasy_team_id', mojaEkipa.id)
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

  const napakeEkipe = preveriEkipo(izbraniPodrobno)

  const klubi = useMemo(() => {
    const m = new Map()
    for (const i of igralci) if (i.teams) m.set(i.team_id, i.teams.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sl'))
  }, [igralci])

  function preklopi(igralec) {
    setSporocilo(null)
    const obstaja = izbrani.find((s) => s.player_id === igralec.id)
    if (obstaja) {
      setIzbrani(izbrani.filter((s) => s.player_id !== igralec.id))
      return
    }
    if (izbrani.length >= VELIKOST_EKIPE) {
      setSporocilo('Ekipa je polna (' + VELIKOST_EKIPE + ' igralcev).')
      return
    }
    const izKluba = izbraniPodrobno.filter(
      (s) => s.team_id === igralec.team_id,
    ).length
    if (izKluba >= MAX_IZ_KLUBA) {
      setSporocilo(
        'Iz kluba ' + igralec.teams?.name + ' imaš že ' + MAX_IZ_KLUBA + ' igralce.',
      )
      return
    }
    const prvih = izbrani.filter((s) => s.is_starter).length
    setIzbrani([
      ...izbrani,
      { player_id: igralec.id, is_starter: prvih < STEVILO_PRVIH },
    ])
  }

  function preklopiPrvo(playerId) {
    setSporocilo(null)
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
        .select('id, name')
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

    // nabor prepišemo v celoti
    const { error: eDel } = await supabase
      .from('fantasy_roster')
      .delete()
      .eq('fantasy_team_id', ekipaId)
    if (eDel) return setNapaka(eDel.message)

    if (izbrani.length > 0) {
      const { error: eIns } = await supabase.from('fantasy_roster').insert(
        izbrani.map((s) => ({
          fantasy_team_id: ekipaId,
          player_id: s.player_id,
          is_starter: s.is_starter,
        })),
      )
      if (eIns) return setNapaka(eIns.message)
    }
    setSporocilo('Ekipa je shranjena.')
  }

  if (loading || nalaganje) return <p className="text-slate-500">Nalaganje …</p>
  if (!session)
    return <p className="text-slate-600">Za sestavo ekipe se moraš prijaviti.</p>

  const vidni =
    filterKlub === 'vsi'
      ? igralci
      : igralci.filter((i) => String(i.team_id) === filterKlub)

  const steviloPrvih = izbraniPodrobno.filter((s) => s.is_starter).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moja ekipa</h1>

      <label className="block max-w-sm text-sm text-slate-600">
        Ime ekipe
        <input
          value={imeEkipe}
          onChange={(e) => setImeEkipe(e.target.value)}
          placeholder="npr. Gorenjski Orli"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">
          Izbrani igralci ({izbrani.length}/{VELIKOST_EKIPE}) — prva postava{' '}
          {steviloPrvih}/{STEVILO_PRVIH}
        </h2>

        {izbraniPodrobno.length === 0 ? (
          <p className="text-sm text-slate-500">Spodaj izberi igralce.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(POZICIJE).map(([koda, p]) => {
              const skupina = izbraniPodrobno.filter((s) => s.position === koda)
              if (skupina.length === 0) return null
              return (
                <div key={koda}>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">
                    {p.naslov}
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {skupina.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => preklopiPrvo(s.id)}
                          title="Preklopi med prvo postavo in klopjo"
                          className={
                            'rounded px-1.5 py-0.5 text-xs ' +
                            (s.is_starter
                              ? 'bg-gnl-600 text-white'
                              : 'bg-slate-200 text-slate-600')
                          }
                        >
                          {s.is_starter ? 'prva' : 'klop'}
                        </button>
                        <span className="flex-1">
                          {s.first_name} {s.last_name}
                        </span>
                        <span className="text-slate-400">
                          {s.teams?.short_name}
                        </span>
                        <button
                          onClick={() => preklopi(s)}
                          className="text-slate-400 hover:text-red-600"
                          title="Odstrani"
                        >
                          ×
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
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-amber-700">
            {napakeEkipe.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={shrani}
            disabled={!imeEkipe.trim()}
            className="rounded bg-gnl-600 px-4 py-2 text-white hover:bg-gnl-700 disabled:opacity-50"
          >
            Shrani ekipo
          </button>
          {napakeEkipe.length > 0 && (
            <span className="text-xs text-slate-500">
              Osnutek lahko shraniš tudi, če pravila še niso izpolnjena.
            </span>
          )}
        </div>
        {sporocilo && <p className="mt-2 text-sm text-gnl-600">{sporocilo}</p>}
        {napaka && <p className="mt-2 text-sm text-red-600">Napaka: {napaka}</p>}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Vsi igralci</h2>
          <select
            value={filterKlub}
            onChange={(e) => setFilterKlub(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="vsi">Vsi klubi</option>
            {klubi.map(([id, ime]) => (
              <option key={id} value={id}>
                {ime}
              </option>
            ))}
          </select>
        </div>

        <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
          {vidni.map((i) => {
            const jeIzbran = izbrani.some((s) => s.player_id === i.id)
            return (
              <li
                key={i.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-20 text-xs text-slate-500">
                  {IME_POZICIJE[i.position] ?? '—'}
                </span>
                <span className="flex-1">
                  {i.first_name} {i.last_name}
                </span>
                <span className="text-slate-500">{i.teams?.short_name}</span>
                <button
                  onClick={() => preklopi(i)}
                  className={
                    'rounded px-2 py-1 text-xs ' +
                    (jeIzbran
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-gnl-600 text-white hover:bg-gnl-700')
                  }
                >
                  {jeIzbran ? 'Odstrani' : 'Dodaj'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
