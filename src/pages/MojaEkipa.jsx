import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import {
  VELIKOST_EKIPE,
  STEVILO_PRVIH,
  MAX_IZ_KLUBA,
  PRORACUN,
  POZICIJE,
  VRSTNI_RED,
  KAPETAN_MNOZITELJ,
  poPozicijah,
  lahkoZacne,
  zakajNeGre,
  preveriEkipo,
} from '../lib/pravila'
import {
  prikazniIme,
  razredPozicije,
  KRATKA_POZICIJA,
  formatirajTocke,
  formatirajCeno,
} from '../lib/pomozno'
import Igrisce from '../components/Igrisce'
import Grb from '../components/Grb'

export default function MojaEkipa() {
  const { session, loading } = useAuth()
  const [ekipa, setEkipa] = useState(null)
  const [imeEkipe, setImeEkipe] = useState('')
  const [igralci, setIgralci] = useState([])
  const [izbrani, setIzbrani] = useState([])
  const [krogi, setKrogi] = useState([])
  const [naslednjiKrog, setNaslednjiKrog] = useState(null)
  const [pripomocki, setPripomocki] = useState([])
  const [zaklenjenaPostava, setZaklenjenaPostava] = useState(null)
  const [pravila, setPravila] = useState({ prosti: 3, kazen: 4 })
  const [izbranKrog, setIzbranKrog] = useState('')
  const [nalaganje, setNalaganje] = useState(true)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [filterKlub, setFilterKlub] = useState('vsi')
  const [filterPoz, setFilterPoz] = useState('vse')
  const [iskanje, setIskanje] = useState('')
  // Na telefonu je trg predal, ki se odpre ob kliku na prazno mesto.
  const [odprtTrg, setOdprtTrg] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!session) {
      setNalaganje(false)
      return
    }

    async function nalozi() {
      // Vse, kar ni odvisno drugo od drugega, gre hkrati — zaporedne poizvedbe
      // so na mobilnem omrežju pomenile nekaj sekund praznega čakanja.
      const [
        { data: vsi, error },
        { data: vsiKrogi },
        { data: naslednji },
        { data: moja },
        { data: nast },
      ] = await Promise.all([
        supabase
          .from('player_overview')
          .select(
            'id, full_name, position, team_id, team_name, team_short, team_logo, value, points, goals, minutes',
          )
          .order('value', { ascending: false }),
        supabase
          .from('rounds')
          .select('id, season, number')
          .order('number', { ascending: true }),
        supabase
          .from('naslednji_krog')
          .select('id, number, played_on, deadline_at')
          .maybeSingle(),
        supabase
          .from('fantasy_teams')
          .select('id, name, budget')
          .eq('owner_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('key, value')
          .in('key', ['prosti_prestopi', 'kazen_prestopa']),
      ])
      if (error) {
        setNapaka(error.message)
        setNalaganje(false)
        return
      }
      setIgralci(vsi ?? [])
      setKrogi(vsiKrogi ?? [])
      setNaslednjiKrog(naslednji ?? null)
      if (nast?.length) {
        const m = Object.fromEntries(nast.map((n) => [n.key, Number(n.value)]))
        setPravila({
          prosti: m.prosti_prestopi ?? 3,
          kazen: m.kazen_prestopa ?? 4,
        })
      }

      if (moja) {
        setEkipa(moja)
        setImeEkipe(moja.name)
        const [{ data: nabor }, { data: chips }, { data: zadnjiPosnetek }] =
          await Promise.all([
            supabase
              .from('fantasy_roster')
              .select('player_id, is_starter, is_captain, is_vice, buy_value')
              .eq('fantasy_team_id', moja.id),
            supabase
              .from('fantasy_chips')
              .select('chip, round_id')
              .eq('fantasy_team_id', moja.id),
            // Zadnja zaklenjena postava je izhodišče za štetje prestopov.
            supabase
              .from('fantasy_lineups')
              .select('round_id, player_id')
              .eq('fantasy_team_id', moja.id)
              .order('round_id', { ascending: false }),
          ])
        setIzbrani(nabor ?? [])
        setPripomocki(chips ?? [])
        if (zadnjiPosnetek?.length) {
          const zadnjiKrog = zadnjiPosnetek[0].round_id
          setZaklenjenaPostava(
            zadnjiPosnetek
              .filter((v) => v.round_id === zadnjiKrog)
              .map((v) => v.player_id),
          )
        }
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
  // Proračun se meri po ceni ob nakupu: če igralec med sezono podraži, to
  // lastniku ne sme razbiti že sestavljenega kadra.
  const porabljeno = izbraniPodrobno.reduce(
    (v, s) => v + Number(s.buy_value ?? s.value ?? 0),
    0,
  )
  const preostalo = proracun - porabljeno
  const napakeEkipe = preveriEkipo(izbraniPodrobno, proracun)
  const prvi = izbraniPodrobno.filter((s) => s.is_starter)
  const vKadru = poPozicijah(izbraniPodrobno)

  const klubi = useMemo(() => {
    const m = new Map()
    for (const i of igralci) if (i.team_name) m.set(i.team_id, i.team_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sl'))
  }, [igralci])

  function dodaj(igralec) {
    setSporocilo(null)
    const razlog = zakajNeGre(igralec, izbraniPodrobno, preostalo)
    if (razlog) return setSporocilo(razlog)

    setIzbrani([
      ...izbrani,
      {
        player_id: igralec.id,
        is_starter: igralec.position ? lahkoZacne(igralec.position, prvi) : false,
        is_captain: false,
        is_vice: false,
        buy_value: Number(igralec.value ?? 0),
      },
    ])
  }

  function odstrani(igralec) {
    setSporocilo(null)
    setIzbrani(izbrani.filter((s) => s.player_id !== igralec.id))
  }

  function preklopi(igralec) {
    if (izbrani.some((s) => s.player_id === igralec.id)) odstrani(igralec)
    else dodaj(igralec)
  }

  function preklopiPrvo(igralec) {
    setSporocilo(null)
    if (igralec.is_starter) {
      // Na klop; trak gre s seboj le, če ga ima kdo drug prevzeti.
      return setIzbrani(
        izbrani.map((s) =>
          s.player_id === igralec.id
            ? { ...s, is_starter: false, is_captain: false, is_vice: false }
            : s,
        ),
      )
    }
    if (!igralec.position)
      return setSporocilo(
        'Igralec še nima potrjene pozicije, zato ga ni mogoče postaviti na igrišče.',
      )
    if (!lahkoZacne(igralec.position, prvi))
      return setSporocilo(
        'V postavi ni prostora za še enega igralca na tej poziciji — najprej daj koga na klop.',
      )
    setIzbrani(
      izbrani.map((s) =>
        s.player_id === igralec.id ? { ...s, is_starter: true } : s,
      ),
    )
  }

  function nastaviTrak(playerId, polje) {
    setIzbrani(
      izbrani.map((s) => ({
        ...s,
        [polje]: s.player_id === Number(playerId),
        // Isti igralec ne more biti kapetan in namestnik hkrati.
        ...(polje === 'is_captain' && s.player_id === Number(playerId)
          ? { is_vice: false }
          : {}),
        ...(polje === 'is_vice' && s.player_id === Number(playerId)
          ? { is_captain: false }
          : {}),
      })),
    )
  }

  function naPraznoMesto(koda) {
    setFilterPoz(koda)
    setOdprtTrg(true)
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
      // Vrstni red klopi določa, kdo prvi vskoči ob samodejni menjavi.
      let naKlopi = 0
      const { error } = await supabase.from('fantasy_roster').insert(
        izbrani.map((s) => ({
          fantasy_team_id: ekipaId,
          player_id: s.player_id,
          is_starter: s.is_starter,
          is_captain: !!s.is_captain,
          is_vice: !!s.is_vice,
          bench_order: s.is_starter ? null : ++naKlopi,
          buy_value: s.buy_value ?? poId[s.player_id]?.value ?? null,
        })),
      )
      if (error) return setNapaka(error.message)
    }
    setSporocilo('Ekipa je shranjena. 💾')
  }

  async function vloziPripomocek(chip, krogId) {
    setNapaka(null)
    if (!ekipa?.id) return setNapaka('Najprej shrani ekipo.')
    if (!krogId) return setNapaka('Izberi krog, v katerem naj pripomoček velja.')
    const { error } = await supabase.from('fantasy_chips').insert({
      fantasy_team_id: ekipa.id,
      chip,
      round_id: Number(krogId),
    })
    if (error) return setNapaka(error.message)
    setPripomocki([...pripomocki, { chip, round_id: Number(krogId) }])
    setSporocilo(
      chip === 'wildcard'
        ? 'Wildcard je vložen — prestopi v tem krogu so brezplačni. 🃏'
        : 'Klop+ je vložen. 🎟️',
    )
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

  const klopPlus = pripomocki.find((c) => c.chip === 'klop_plus')
  const wildcard = pripomocki.find((c) => c.chip === 'wildcard')
  const krogPripomocka = krogi.find((k) => k.id === klopPlus?.round_id)
  const krogWildcard = krogi.find((k) => k.id === wildcard?.round_id)

  // Prestop je igralec, ki ga v zadnji zaklenjeni postavi ni bilo.
  const prestopi = zaklenjenaPostava
    ? izbrani.filter((s) => !zaklenjenaPostava.includes(s.player_id)).length
    : 0
  const wildcardVelja =
    wildcard && naslednjiKrog && wildcard.round_id === naslednjiKrog.id
  const kazen = wildcardVelja
    ? 0
    : Math.max(0, prestopi - pravila.prosti) * pravila.kazen

  const trg = (
    <TrgIgralcev
      vidni={vidni}
      izbrani={izbrani}
      izbraniPodrobno={izbraniPodrobno}
      preostalo={preostalo}
      vKadru={vKadru}
      klubi={klubi}
      iskanje={iskanje}
      setIskanje={setIskanje}
      filterKlub={filterKlub}
      setFilterKlub={setFilterKlub}
      filterPoz={filterPoz}
      setFilterPoz={setFilterPoz}
      naPreklop={preklopi}
    />
  )

  return (
    <div className="space-y-4 pb-24 sm:space-y-6 lg:pb-0">
      <h1 className="text-2xl font-black naslov sm:text-3xl">Moja ekipa</h1>

      {naslednjiKrog && <Rok krog={naslednjiKrog} />}

      {zaklenjenaPostava && (
        <div className="kartica flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
          <span className="font-semibold">
            Prestopi: {prestopi}/{pravila.prosti}
          </span>
          {wildcardVelja ? (
            <span className="znacka bg-gnl-400/20 text-gnl-200">
              wildcard — brez kazni
            </span>
          ) : kazen > 0 ? (
            <span className="text-rose-400">
              odbitek {kazen} točk v tem krogu
            </span>
          ) : (
            <span className="text-slate-400">
              še {pravila.prosti - prestopi} brezplačnih, nato −{pravila.kazen}{' '}
              za vsakega
            </span>
          )}
        </div>
      )}

      {/* proračun in kvote */}
      <div className="kartica grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        <Merilo oznaka="Proračun" vrednost={formatirajCeno(proracun)} />
        <Merilo
          oznaka="Porabljeno"
          vrednost={formatirajCeno(porabljeno)}
          barva={porabljeno > proracun ? 'text-rose-400' : undefined}
        />
        <Merilo
          oznaka="Ostane"
          vrednost={formatirajCeno(preostalo)}
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {izbrani.length}/{VELIKOST_EKIPE} igralcev · postava {prvi.length}/
              {STEVILO_PRVIH}
            </span>
            <span className="flex flex-wrap gap-1">
              {VRSTNI_RED.map((koda) => (
                <span
                  key={koda}
                  className={`znacka ${
                    vKadru[koda] === POZICIJE[koda].kader
                      ? razredPozicije(koda)
                      : 'poz-none'
                  }`}
                >
                  {KRATKA_POZICIJA[koda]} {vKadru[koda]}/{POZICIJE[koda].kader}
                </span>
              ))}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Igrisce
            izbrani={izbraniPodrobno}
            naPreklopPrvo={preklopiPrvo}
            naOdstrani={odstrani}
            naPraznoMesto={naPraznoMesto}
          />

          {/* trak in pripomoček */}
          <section className="kartica grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Trak
              </h3>
              <IzborTraku
                oznaka={`Kapetan (×${KAPETAN_MNOZITELJ})`}
                vrednost={prvi.find((s) => s.is_captain)?.id ?? ''}
                moznosti={prvi}
                naIzbor={(v) => nastaviTrak(v, 'is_captain')}
              />
              <IzborTraku
                oznaka="Namestnik"
                vrednost={prvi.find((s) => s.is_vice)?.id ?? ''}
                moznosti={prvi}
                naIzbor={(v) => nastaviTrak(v, 'is_vice')}
              />
              <p className="text-xs text-slate-500">
                Kapetan prinese trojne točke. Če ne igra, trak prevzame
                namestnik.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Pripomoček Klop+
              </h3>
              {krogPripomocka ? (
                <p className="text-sm text-gnl-300">
                  Vložen za {krogPripomocka.number}. krog — v njem štejejo tudi
                  točke klopi.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={izbranKrog}
                    onChange={(e) => setIzbranKrog(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="">Izberi krog …</option>
                    {krogi.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.number}. krog ({k.season})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => vloziPripomocek('klop_plus', izbranKrog)}
                    className="gumb-tih"
                  >
                    Vloži
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Enkrat na sezono: v izbranem krogu se prištejejo še točke vseh
                štirih rezervnih igralcev.
              </p>

              <h3 className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Pripomoček Wildcard
              </h3>
              {krogWildcard ? (
                <p className="text-sm text-gnl-300">
                  Vložen za {krogWildcard.number}. krog — prestopi v njem so
                  brezplačni.
                </p>
              ) : (
                <button
                  onClick={() =>
                    vloziPripomocek('wildcard', naslednjiKrog?.id ?? izbranKrog)
                  }
                  className="gumb-tih w-full"
                >
                  Vloži za {naslednjiKrog ? `${naslednjiKrog.number}. krog` : 'naslednji krog'}
                </button>
              )}
              <p className="text-xs text-slate-500">
                Enkrat na sezono: v tem krogu lahko zamenjaš kolikor igralcev
                hočeš, brez odbitka točk.
              </p>
            </div>
          </section>

          {/* opozorila in shranjevanje */}
          <section className="kartica p-3 sm:p-4">
            {napakeEkipe.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm text-amber-300">
                {napakeEkipe.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            )}
            <div className="hidden flex-wrap items-center gap-3 lg:flex">
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
            {sporocilo && (
              <p className="mt-2 text-sm text-gnl-300">{sporocilo}</p>
            )}
            {napaka && (
              <p className="mt-2 text-sm text-rose-400">Napaka: {napaka}</p>
            )}
          </section>
        </div>

        {/* trg — na velikih zaslonih stranski stolpec, ki ostane na mestu */}
        <aside className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          {trg}
        </aside>
      </div>

      {/* trg — na telefonu predal, ki se odpre ob kliku na prazno mesto */}
      {odprtTrg && (
        <div className="lg:hidden">
          <div
            onClick={() => setOdprtTrg(false)}
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm"
          />
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-slate-950 p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="mx-auto h-1 w-10 rounded-full bg-white/20" />
              <button
                onClick={() => setOdprtTrg(false)}
                className="absolute right-3 top-3 text-sm text-slate-400"
              >
                Zapri ✕
              </button>
            </div>
            {trg}
          </div>
        </div>
      )}

      {/* na telefonu sta glavni dejanji vedno pri roki */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => {
            setFilterPoz('vse')
            setOdprtTrg(true)
          }}
          className="gumb-tih flex-1"
        >
          ＋ Dodaj igralca
        </button>
        <button
          onClick={shrani}
          disabled={!imeEkipe.trim()}
          className="gumb-glavni flex-1"
        >
          Shrani
        </button>
      </div>
    </div>
  )
}

function TrgIgralcev({
  vidni,
  izbrani,
  izbraniPodrobno,
  preostalo,
  vKadru,
  klubi,
  iskanje,
  setIskanje,
  filterKlub,
  setFilterKlub,
  filterPoz,
  setFilterPoz,
  naPreklop,
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold sm:text-xl">
          {filterPoz === 'vse' ? 'Trg igralcev' : POZICIJE[filterPoz].naslov}
        </h2>
        <span className="text-xs text-slate-500">{vidni.length} igralcev</span>
      </div>
      <p className="text-xs text-slate-500">
        Goli in minute so iz zadnje odigrane sezone — iz nje izhajajo tudi cene.
      </p>

      {/* hitri preklop po pozicijah — pove tudi, koliko jih še manjka */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterPoz('vse')}
          className={`znacka transition ${
            filterPoz === 'vse'
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-slate-400'
          }`}
        >
          vsi
        </button>
        {VRSTNI_RED.map((koda) => (
          <button
            key={koda}
            onClick={() => setFilterPoz(koda)}
            title={POZICIJE[koda].naslov}
            className={`znacka transition ${
              filterPoz === koda
                ? razredPozicije(koda)
                : 'bg-white/5 text-slate-400'
            } ${vKadru[koda] >= POZICIJE[koda].kader ? 'opacity-50' : ''}`}
          >
            {KRATKA_POZICIJA[koda]} {vKadru[koda]}/{POZICIJE[koda].kader}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={iskanje}
          onChange={(e) => setIskanje(e.target.value)}
          placeholder="Išči po imenu …"
          className="min-w-32 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        />
        <select
          value={filterKlub}
          onChange={(e) => setFilterKlub(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="vsi">Vsi klubi</option>
          {klubi.map(([id, ime]) => (
            <option key={id} value={id}>
              {ime}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-1.5">
        {vidni.slice(0, 60).map((i) => {
          const jeIzbran = izbrani.some((s) => s.player_id === i.id)
          const razlog = jeIzbran
            ? null
            : zakajNeGre(i, izbraniPodrobno, preostalo)
          return (
            <li
              key={i.id}
              className={`kartica flex items-center gap-2 p-2 ${
                jeIzbran ? 'ring-1 ring-gnl-400/40' : ''
              } ${razlog ? 'opacity-50' : ''}`}
            >
              <Grb
                ime={i.team_name}
                kratko={i.team_short}
                logo={i.team_logo}
                velikost={22}
              />
              <span className={`znacka ${razredPozicije(i.position)}`}>
                {KRATKA_POZICIJA[i.position] ?? '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {prikazniIme(i.full_name)}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {i.team_short} · {i.goals} golov · {i.minutes} min
                </div>
              </div>
              <span className="w-16 text-right text-sm font-black tabular-nums text-gnl-300">
                {formatirajCeno(i.value)}
              </span>
              <button
                onClick={() => naPreklop(i)}
                disabled={!!razlog}
                title={razlog ?? undefined}
                className={`${
                  jeIzbran ? 'gumb-tih' : 'gumb-glavni'
                } px-3 py-1.5 text-sm`}
              >
                {jeIzbran ? '✕' : '⊕'}
              </button>
            </li>
          )
        })}
      </ul>

      {vidni.length > 60 && (
        <p className="text-center text-xs text-slate-500">
          Prikazanih prvih 60 — zoži izbor z iskanjem.
        </p>
      )}
      <p className="text-center text-xs text-slate-600">
        Iz istega kluba lahko izbereš največ {MAX_IZ_KLUBA} igralce.
      </p>
    </section>
  )
}

function Rok({ krog }) {
  const rok = krog.deadline_at ? new Date(krog.deadline_at) : null
  const zapadel = rok ? rok.getTime() <= Date.now() : false
  return (
    <div className="kartica flex flex-wrap items-center gap-x-2 gap-y-1 p-3 text-sm">
      <span className="znacka bg-gnl-400/20 text-gnl-200">{krog.number}. krog</span>
      {rok ? (
        <span className={zapadel ? 'text-amber-300' : 'text-slate-300'}>
          {zapadel ? 'Rok je potekel — ' : 'Rok za spremembe: '}
          <strong className="font-semibold">
            {rok.toLocaleString('sl-SI', {
              weekday: 'short',
              day: 'numeric',
              month: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </strong>
          {zapadel ? ' spremembe veljajo za naslednji krog.' : ''}
        </span>
      ) : (
        <span className="text-slate-400">Rok še ni določen.</span>
      )}
      <span className="w-full text-xs text-slate-500">
        Ob roku se postava posname; poznejše spremembe na že odigrane kroge ne
        vplivajo.
      </span>
    </div>
  )
}

function IzborTraku({ oznaka, vrednost, moznosti, naIzbor }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-slate-400 sm:w-28">{oznaka}</span>
      <select
        value={vrednost}
        onChange={(e) => naIzbor(e.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
      >
        <option value="">— nihče —</option>
        {moznosti.map((s) => (
          <option key={s.id} value={s.id}>
            {prikazniIme(s.full_name)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Merilo({ oznaka, vrednost, barva }) {
  return (
    <div>
      <div
        className={`text-xl font-black tabular-nums sm:text-2xl ${barva ?? ''}`}
      >
        {vrednost}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
        {oznaka}
      </div>
    </div>
  )
}
