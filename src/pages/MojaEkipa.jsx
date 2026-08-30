import { useEffect, useMemo, useRef, useState } from 'react'
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
import Odstevanje from '../components/Odstevanje'
import EnajstericaNaIgriscu from '../components/EnajstericaNaIgriscu'

export default function MojaEkipa() {
  const { session, loading } = useAuth()
  const [ekipa, setEkipa] = useState(null)
  const [imeEkipe, setImeEkipe] = useState('')
  const [igralci, setIgralci] = useState([])
  const [izbrani, setIzbrani] = useState([])
  // Set player_id-jev, ki so bili v DB ob nalaganju. Nujno za izračun
  // "denar od prodaje" — sprememba glede na ta izhodiščni stanje pove,
  // koliko denarja se osvobodi (odstranjeni) oz. porabi (dodani).
  const [zacetniIds, setZacetniIds] = useState(new Set())
  const [krogi, setKrogi] = useState([])
  const [naslednjiKrog, setNaslednjiKrog] = useState(null)
  const [zadnjiKrog, setZadnjiKrog] = useState(null)
  const [tockeZadnjiKrog, setTockeZadnjiKrog] = useState({}) // player_id → points
  const [posnetkiPoKrogih, setPosnetkiPoKrogih] = useState([]) // [{krog, igralci}]
  const [zgodovinaKrogId, setZgodovinaKrogId] = useState(null)
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
  const imeRef = useRef(null)

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
          .select('id, season, number, played_on, deadline_at')
          .order('number', { ascending: true }),
        supabase
          .from('naslednji_krog')
          .select('id, number, played_on, deadline_at')
          .maybeSingle(),
        supabase
          .from('fantasy_teams')
          .select('id, name, budget, cash')
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
        setZacetniIds(new Set((nabor ?? []).map((s) => s.player_id)))
        setPripomocki(chips ?? [])
        if (zadnjiPosnetek?.length) {
          const zadnjiKrog = zadnjiPosnetek[0].round_id
          setZaklenjenaPostava(
            zadnjiPosnetek
              .filter((v) => v.round_id === zadnjiKrog)
              .map((v) => v.player_id),
          )
        }

        // Točke igralcev v zadnjem odigranem krogu — da uporabnik vidi,
        // koliko je vsak njegov igralec prinesel.
        const { data: zadnji } = await supabase
          .from('zadnji_odigrani_krog')
          .select('id, number, season')
          .maybeSingle()
        setZadnjiKrog(zadnji ?? null)
        if (zadnji && (nabor ?? []).length) {
          const { data: tocke } = await supabase
            .from('player_scores')
            .select('player_id, points')
            .eq('round_id', zadnji.id)
            .in(
              'player_id',
              nabor.map((s) => s.player_id),
            )
          setTockeZadnjiKrog(
            Object.fromEntries(
              (tocke ?? []).map((t) => [t.player_id, Number(t.points)]),
            ),
          )
        }

        // Zgodovina postav — za vsak odigrani krog vzamemo fantasy_lineups
        // snapshot in točke igralcev. Uporabniku omogoča ogled "kakšno ekipo
        // sem imel v N. krogu".
        const { data: posnetki } = await supabase
          .from('fantasy_lineups')
          .select(
            'round_id, player_id, is_starter, is_captain, is_vice, bench_order, rounds(number, season, played_on)',
          )
          .eq('fantasy_team_id', moja.id)
          .order('round_id', { ascending: false })
        const idsIgralcev = [
          ...new Set((posnetki ?? []).map((p) => p.player_id)),
        ]
        const roundIds = [...new Set((posnetki ?? []).map((p) => p.round_id))]
        const [{ data: igralciDet }, { data: vseTocke }] = await Promise.all([
          idsIgralcev.length
            ? supabase
                .from('player_overview')
                .select(
                  'id, full_name, position, team_name, team_short, team_logo, value',
                )
                .in('id', idsIgralcev)
            : Promise.resolve({ data: [] }),
          roundIds.length
            ? supabase
                .from('player_scores')
                .select('round_id, player_id, points')
                .in('round_id', roundIds)
                .in('player_id', idsIgralcev)
            : Promise.resolve({ data: [] }),
        ])
        const igralecPo = Object.fromEntries(
          (igralciDet ?? []).map((i) => [i.id, i]),
        )
        const tockePo = new Map()
        for (const t of vseTocke ?? [])
          tockePo.set(`${t.round_id}-${t.player_id}`, Number(t.points))
        const poKrogih = new Map()
        for (const p of posnetki ?? []) {
          const key = p.round_id
          const prej = poKrogih.get(key) ?? {
            round_id: key,
            krog: p.rounds,
            igralci: [],
          }
          const det = igralecPo[p.player_id]
          if (det) {
            prej.igralci.push({
              ...det,
              player_id: p.player_id,
              is_starter: p.is_starter,
              is_captain: p.is_captain,
              is_vice: p.is_vice,
              bench_order: p.bench_order,
              points: tockePo.get(`${p.round_id}-${p.player_id}`) ?? 0,
            })
          }
          poKrogih.set(key, prej)
        }
        const zgod = [...poKrogih.values()].sort(
          (a, b) => (b.krog?.number ?? 0) - (a.krog?.number ?? 0),
        )
        setPosnetkiPoKrogih(zgod)
        setZgodovinaKrogId(zgod[0]?.round_id ?? null)
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
        .map((s) => ({
          ...poId[s.player_id],
          ...s,
          // Točke zadnjega odigranega kroga (za prikaz na igrišču).
          tocke_krog: tockeZadnjiKrog[s.player_id] ?? null,
        }))
        .filter((s) => s.id != null),
    [izbrani, poId, tockeZadnjiKrog],
  )

  const proracun = ekipa?.budget ?? PRORACUN
  // Cash iz baze je stanje po zadnjem "Shrani". Draft (spremembe od tedaj)
  // ga premika navidezno: pri odstranitvi igralca dobiš njegovo TRENUTNO
  // vrednost (dobiček od podražitve se realizira ob prodaji), pri dodajanju
  // ga plačaš po trenutni ceni.
  const cashPersistiran =
    ekipa?.cash != null ? Number(ekipa.cash) : proracun
  const dodaniIds = izbraniPodrobno
    .filter((s) => !zacetniIds.has(s.player_id ?? s.id))
    .map((s) => s.player_id ?? s.id)
  const odstranjeniIds = [...zacetniIds].filter(
    (id) => !izbraniPodrobno.some((s) => (s.player_id ?? s.id) === id),
  )
  const stroskiNovih = dodaniIds.reduce(
    (v, id) => v + Number(poId[id]?.value ?? 0),
    0,
  )
  const dobicekOdstranjenih = odstranjeniIds.reduce(
    (v, id) => v + Number(poId[id]?.value ?? 0),
    0,
  )
  const preostalo = cashPersistiran + dobicekOdstranjenih - stroskiNovih
  // Porabljeno = kar so plačali za trenutno držane igralce (buy_value).
  const porabljeno = izbraniPodrobno.reduce(
    (v, s) => v + Number(s.buy_value ?? s.value ?? 0),
    0,
  )
  // Bogastvo = cash + trenutna vrednost kadra (za info okvirček).
  const bogastvo =
    preostalo +
    izbraniPodrobno.reduce((v, s) => v + Number(s.value ?? 0), 0)
  const napakeEkipe = preveriEkipo(izbraniPodrobno, cashPersistiran + porabljeno)
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

  function poskusiShraniti() {
    if (!imeEkipe.trim()) {
      setSporocilo(null)
      setNapaka('Najprej vpiši ime ekipe.')
      imeRef.current?.focus()
      imeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    shrani()
  }

  async function shrani() {
    setNapaka(null)
    setSporocilo(null)

    let ekipaId = ekipa?.id
    if (!ekipaId) {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .insert({ owner_id: session.user.id, name: imeEkipe.trim() })
        .select('id, name, budget, cash')
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

    // Vrstni red klopi določa, kdo prvi vskoči ob samodejni menjavi.
    let naKlopi = 0
    const roster = izbrani.map((s) => ({
      player_id: s.player_id,
      is_starter: !!s.is_starter,
      is_captain: !!s.is_captain,
      is_vice: !!s.is_vice,
      bench_order: s.is_starter ? null : ++naKlopi,
    }))

    // RPC atomarno posodobi roster + cash (dobiček od odstranjenih ostane
    // v ekipi kot dodaten denar).
    const { data: rezultat, error } = await supabase.rpc('shrani_ekipo', {
      p_team_id: ekipaId,
      p_roster: roster,
    })
    if (error) return setNapaka(error.message)

    const novCash =
      typeof rezultat === 'object' ? Number(rezultat?.cash ?? 0) : null
    if (novCash != null) {
      setEkipa((prej) => (prej ? { ...prej, cash: novCash } : prej))
    }

    // Osveži lokalno stanje: zdaj so vsi izbrani "začetni" (pomeni: ni več
    // "novih" ali "odstranjenih" v draftu).
    const { data: svezRoster } = await supabase
      .from('fantasy_roster')
      .select('player_id, is_starter, is_captain, is_vice, buy_value')
      .eq('fantasy_team_id', ekipaId)
    if (svezRoster) {
      setIzbrani(svezRoster)
      setZacetniIds(new Set(svezRoster.map((s) => s.player_id)))
    }

    const dobicek = Number(rezultat?.dobicek ?? 0)
    const strosek = Number(rezultat?.strosek ?? 0)
    const delta = dobicek - strosek
    if (delta > 0)
      setSporocilo(`Ekipa shranjena. Prodaja ti je prinesla +${delta.toFixed(1)} M. 💰`)
    else if (delta < 0)
      setSporocilo(`Ekipa shranjena. Nakupi so pobrali ${Math.abs(delta).toFixed(1)} M. 💾`)
    else setSporocilo('Ekipa je shranjena. 💾')
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

  async function prekliciPripomocek(chip) {
    setNapaka(null)
    if (!ekipa?.id) return
    // Preklic je dovoljen SAMO dokler rok kroga še ni potekel. Ob roku se
    // postava (in učinek pripomočka) posname; kasneje preklic ne velja več.
    const chipVpis = pripomocki.find((c) => c.chip === chip)
    if (!chipVpis) return
    const krogVpisa = krogi.find((k) => k.id === chipVpis.round_id)
    if (
      krogVpisa?.deadline_at &&
      new Date(krogVpisa.deadline_at) <= new Date()
    ) {
      return setNapaka(
        'Rok kroga je potekel — pripomočka ni več mogoče preklicati.',
      )
    }
    const { error } = await supabase
      .from('fantasy_chips')
      .delete()
      .eq('fantasy_team_id', ekipa.id)
      .eq('chip', chip)
    if (error) return setNapaka(error.message)
    setPripomocki(pripomocki.filter((c) => c.chip !== chip))
    setSporocilo(
      chip === 'wildcard'
        ? 'Wildcard je preklican — na voljo je za drug krog.'
        : 'Klop+ je preklican — na voljo je za drug krog.',
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

      {/* Rdeč opozorilni pas s KONKRETNIMI napakami + katerim krogom velja. */}
      {izbrani.length > 0 && napakeEkipe.length > 0 && (
        <div className="kartica animiraj-utrip border-2 border-rose-400/60 bg-rose-500/10 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-sm font-black text-rose-100 sm:text-base">
                Tvoja ekipa NE ustreza pravilom
              </div>
              {naslednjiKrog && (
                <div className="text-xs text-rose-100/90">
                  <strong>Za {naslednjiKrog.number}. krog</strong>
                  {naslednjiKrog.deadline_at && (
                    <>
                      {' '}(rok:{' '}
                      {new Date(naslednjiKrog.deadline_at).toLocaleString(
                        'sl-SI',
                        {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                      )
                    </>
                  )}{' '}
                  v tem stanju <strong>NE boš dobil točk</strong>.
                </div>
              )}
              <div className="text-xs text-rose-100/90">
                Konkretne napake:
                <ul className="mt-1 space-y-0.5 pl-4">
                  {napakeEkipe.map((n) => (
                    <li key={n} className="list-disc">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-rose-100/70">
                Pogosto se to zgodi, ker glasovanje o poziciji premakne igralca
                (npr. iz napadalca v vezista) in ti poruši kader. Popravi zdaj,
                dokler rok ni potekel.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sticky povzetek — proračun, napredek in shrani so vedno pri roki. */}
      <div className="kartica sticky top-0 z-30 space-y-3 p-3 shadow-lg shadow-black/30 backdrop-blur sm:top-2 sm:p-4">
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Na voljo še
            </div>
            <div
              className={`text-3xl font-black tabular-nums leading-none sm:text-4xl ${
                preostalo < 0 ? 'text-rose-400' : 'text-gnl-300'
              }`}
            >
              {formatirajCeno(preostalo)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              bogastvo <strong className={bogastvo > proracun ? 'text-gnl-300' : bogastvo < proracun ? 'text-rose-300' : 'text-slate-300'}>
                {formatirajCeno(bogastvo)}
              </strong>
              {bogastvo !== proracun && (
                <span className={bogastvo > proracun ? 'text-gnl-300' : 'text-rose-300'}>
                  {' '}({bogastvo > proracun ? '+' : ''}{(bogastvo - proracun).toFixed(1)})
                </span>
              )}
              {' · '}kader{' '}
              <span>{formatirajCeno(porabljeno)} </span>
              <span className="text-slate-500">plačano</span>
            </div>
          </div>
          <button
            onClick={poskusiShraniti}
            className="gumb-glavni whitespace-nowrap px-4 py-2 text-sm"
          >
            Shrani ekipo
          </button>
        </div>

        <div>
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

        <div className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Ime ekipe
          </span>
          {ekipa?.name ? (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm">
              <span className="flex-1 font-semibold text-slate-100">
                {ekipa.name}
              </span>
              <span
                title="Ime ekipe je po prvi shranitvi fiksno — enotna oznaka na lestvici in v zgodovini."
                className="znacka bg-white/10 text-[10px] text-slate-400"
              >
                🔒 fiksno
              </span>
            </div>
          ) : (
            <input
              ref={imeRef}
              value={imeEkipe}
              onChange={(e) => setImeEkipe(e.target.value)}
              placeholder="npr. Gorenjski Orli"
              className={`mt-1 w-full rounded-xl border bg-slate-900 px-3 py-2 text-sm ${
                !imeEkipe.trim() && napaka
                  ? 'border-rose-400/60 ring-1 ring-rose-400/30'
                  : 'border-white/10'
              }`}
            />
          )}
        </div>
      </div>

      {/* Uvodni nasvet, ko ekipa še nima igralcev. */}
      {izbrani.length === 0 && (
        <div className="kartica border-gnl-400/30 bg-gnl-500/5 p-3 text-sm sm:p-4">
          <h2 className="mb-1 text-sm font-bold text-gnl-200">Kje začeti?</h2>
          <ol className="ml-4 list-decimal space-y-1 text-slate-300">
            <li>
              Vpiši ime ekipe zgoraj — brez njega shranjevanje ne bo delovalo.
            </li>
            <li>
              Klikni <strong className="text-white">＋</strong> na praznem mestu
              igrišča ali gumb <strong className="text-white">Dodaj igralca</strong>{' '}
              spodaj (na telefonu) oz. izberi z <strong className="text-white">
                trga igralcev
              </strong>{' '}
              desno.
            </li>
            <li>
              Kader je {VELIKOST_EKIPE} igralcev: {POZICIJE.GK.kader} GK,{' '}
              {POZICIJE.DEF.kader} BR, {POZICIJE.MID.kader} VE,{' '}
              {POZICIJE.FWD.kader} NA. Iz istega kluba največ {MAX_IZ_KLUBA}.
            </li>
            <li>
              Ko so mesta zapolnjena, določi{' '}
              <strong className="text-white">kapetana</strong> in{' '}
              <strong className="text-white">namestnika</strong>, nato pritisni{' '}
              <strong className="text-white">Shrani ekipo</strong>.
            </li>
          </ol>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Igrisce
            izbrani={izbraniPodrobno}
            naPreklopPrvo={preklopiPrvo}
            naOdstrani={odstrani}
            naPraznoMesto={naPraznoMesto}
          />

          {/* Zgodovina postav — za vsak odigran krog izberi in glej svojo
              takratno ekipo (fantasy_lineups snapshot). */}
          {posnetkiPoKrogih.length > 0 && (
            <section className="kartica space-y-3 p-3 sm:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Zgodovina postav
                </h2>
                <span className="text-xs text-slate-500">
                  {posnetkiPoKrogih.length}{' '}
                  {posnetkiPoKrogih.length === 1
                    ? 'krog s posnetkom'
                    : 'krogov s posnetki'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...posnetkiPoKrogih]
                  .sort(
                    (a, b) => (a.krog?.number ?? 0) - (b.krog?.number ?? 0),
                  )
                  .map((p) => (
                    <button
                      key={p.round_id}
                      onClick={() => setZgodovinaKrogId(p.round_id)}
                      className={`znacka transition ${
                        zgodovinaKrogId === p.round_id
                          ? 'bg-gnl-500 text-slate-950'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {p.krog?.number}. krog
                    </button>
                  ))}
              </div>
              {(() => {
                const izbrani = posnetkiPoKrogih.find(
                  (p) => p.round_id === zgodovinaKrogId,
                )
                if (!izbrani) return null
                const starterji = izbrani.igralci.filter((i) => i.is_starter)
                const skupaj = starterji.reduce(
                  (v, s) =>
                    v +
                    Number(s.points ?? 0) *
                      (s.is_captain ? KAPETAN_MNOZITELJ : 1),
                  0,
                )
                return (
                  <>
                    <div className="text-xs text-slate-500">
                      {izbrani.krog?.number}. krog ·{' '}
                      sezona {izbrani.krog?.season} · skupaj{' '}
                      <strong className="text-gnl-300">
                        {skupaj.toFixed(0)} točk
                      </strong>
                    </div>
                    <EnajstericaNaIgriscu
                      igralci={starterji.map((s) => ({ ...s, position: s.position }))}
                    />
                  </>
                )
              })()}
            </section>
          )}

          {/* Skupaj v zadnjem odigranem krogu — vsota točk starterjev
              (kapetan × 3, ostali × 1) glede na dejansko stanje v krogu. */}
          {zadnjiKrog &&
            Object.keys(tockeZadnjiKrog).length > 0 && (
              <section className="kartica flex flex-wrap items-center justify-between gap-2 p-3 text-sm sm:p-4">
                <span className="text-slate-400">
                  Tvoja postava v <strong className="text-slate-200">{zadnjiKrog.number}. krogu</strong>{' '}
                  ({zadnjiKrog.season})
                </span>
                <span className="text-lg font-black tabular-nums text-gnl-300">
                  {izbraniPodrobno
                    .filter((s) => s.is_starter)
                    .reduce(
                      (v, s) =>
                        v +
                        (s.tocke_krog ?? 0) *
                          (s.is_captain ? KAPETAN_MNOZITELJ : 1),
                      0,
                    )
                    .toFixed(0)}{' '}
                  točk
                </span>
              </section>
            )}

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
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gnl-300">
                      Vložen za {krogPripomocka.number}. krog — v njem štejejo
                      tudi točke klopi.
                    </p>
                    {krogPripomocka.deadline_at &&
                    new Date(krogPripomocka.deadline_at) > new Date() ? (
                      <button
                        onClick={() => prekliciPripomocek('klop_plus')}
                        className="text-xs text-slate-400 underline hover:text-rose-400"
                      >
                        prekliči
                      </button>
                    ) : (
                      <span className="znacka bg-white/10 text-[10px] text-slate-400">
                        🔒 zaklenjen
                      </span>
                    )}
                  </div>
                  {krogPripomocka.deadline_at &&
                    new Date(krogPripomocka.deadline_at) > new Date() && (
                      <p className="text-[11px] text-slate-500">
                        Prekliči lahko do <Odstevanje do={krogPripomocka.deadline_at} />
                      </p>
                    )}
                </div>
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
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gnl-300">
                      Vložen za {krogWildcard.number}. krog — prestopi v njem so
                      brezplačni.
                    </p>
                    {krogWildcard.deadline_at &&
                    new Date(krogWildcard.deadline_at) > new Date() ? (
                      <button
                        onClick={() => prekliciPripomocek('wildcard')}
                        className="text-xs text-slate-400 underline hover:text-rose-400"
                      >
                        prekliči
                      </button>
                    ) : (
                      <span className="znacka bg-white/10 text-[10px] text-slate-400">
                        🔒 zaklenjen
                      </span>
                    )}
                  </div>
                  {krogWildcard.deadline_at &&
                    new Date(krogWildcard.deadline_at) > new Date() && (
                      <p className="text-[11px] text-slate-500">
                        Prekliči lahko do <Odstevanje do={krogWildcard.deadline_at} />
                      </p>
                    )}
                </div>
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

          {/* status ekipe in shranjevanje */}
          <section className="kartica p-3 sm:p-4">
            {(() => {
              const brezImena = !imeEkipe.trim()
              const pripravljena = !brezImena && napakeEkipe.length === 0
              return (
                <div className="space-y-3">
                  <div
                    className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                      pripravljena
                        ? 'border-gnl-400/40 bg-gnl-500/10 text-gnl-200'
                        : 'border-amber-400/30 bg-amber-500/5 text-amber-200'
                    }`}
                  >
                    <span className="text-lg leading-none">
                      {pripravljena ? '✅' : 'ℹ️'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {pripravljena
                          ? 'Ekipa je pripravljena za shranjevanje.'
                          : 'Za dokončno shranitev je še nekaj potrebnega:'}
                      </div>
                      {!pripravljena && (
                        <ul className="mt-2 space-y-1 text-amber-100/90">
                          {brezImena && (
                            <li>• Vpiši ime ekipe (v polju zgoraj).</li>
                          )}
                          {napakeEkipe.map((n) => (
                            <li key={n}>• {n}</li>
                          ))}
                        </ul>
                      )}
                      {!pripravljena && !brezImena && (
                        <div className="mt-2 text-xs text-slate-400">
                          Osnutek lahko shraniš tudi zdaj — pravila boš dopolnil
                          pozneje.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden flex-wrap items-center gap-3 lg:flex">
                    <button onClick={poskusiShraniti} className="gumb-glavni">
                      {pripravljena ? 'Shrani ekipo' : 'Shrani osnutek'}
                    </button>
                    {brezImena && (
                      <span className="text-xs text-rose-300">
                        Ime ekipe je obvezno — klik te vrne na polje zgoraj.
                      </span>
                    )}
                  </div>

                  {/* Kaj se pravzaprav zgodi ob shranjevanju — jasno pojasnilo. */}
                  <div className="rounded-xl bg-slate-950/40 p-3 text-[11px] leading-snug text-slate-400">
                    <strong className="text-slate-300">
                      Kaj pomeni "Shrani"?
                    </strong>{' '}
                    Tvoje spremembe (kader, postava, kapetan) se zapišejo v bazo.
                    Za trenutni krog velja stanje ob roku
                    {naslednjiKrog?.deadline_at && (
                      <>
                        {' '}
                        (
                        <strong className="text-slate-300">
                          {naslednjiKrog.number}. krog —{' '}
                          {new Date(naslednjiKrog.deadline_at).toLocaleString(
                            'sl-SI',
                            {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </strong>
                        )
                      </>
                    )}
                    . Do roka lahko poljubno spreminjaš in ponovno pritiskaš
                    Shrani — velja zadnja verzija.{' '}
                    <strong className="text-slate-300">"Shrani osnutek"</strong>{' '}
                    pomeni isto, samo z opombo, da ekipa še ne izpolnjuje vseh
                    pravil (za točke rabiš popravke — glej seznam zgoraj).
                  </div>

                  {sporocilo && (
                    <p className="text-sm text-gnl-300">{sporocilo}</p>
                  )}
                  {napaka && (
                    <p className="text-sm text-rose-400">Napaka: {napaka}</p>
                  )}
                </div>
              )
            })()}
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
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 text-xs tabular-nums">
          <span className="text-slate-400">
            Ostane{' '}
            <strong
              className={`text-sm ${
                preostalo < 0 ? 'text-rose-400' : 'text-gnl-300'
              }`}
            >
              {formatirajCeno(preostalo)}
            </strong>
          </span>
          <span className="text-slate-500">
            {izbrani.length}/{VELIKOST_EKIPE} · postava {prvi.length}/
            {STEVILO_PRVIH}
          </span>
        </div>
        <div className="flex gap-2 p-3 pt-2">
          <button
            onClick={() => {
              setFilterPoz('vse')
              setOdprtTrg(true)
            }}
            className="gumb-tih flex-1"
          >
            ＋ Dodaj igralca
          </button>
          <button onClick={poskusiShraniti} className="gumb-glavni flex-1">
            {!imeEkipe.trim() || napakeEkipe.length ? 'Shrani osnutek' : 'Shrani'}
          </button>
        </div>
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
              className={`kartica flex flex-col gap-1 p-2 ${
                jeIzbran ? 'ring-1 ring-gnl-400/40' : ''
              } ${razlog ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
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
                title={razlog ?? undefined}
                className={`${
                  jeIzbran ? 'gumb-tih' : 'gumb-glavni'
                } px-3 py-1.5 text-sm`}
              >
                {jeIzbran ? '✕' : '⊕'}
              </button>
              </div>
              {razlog && (
                <p className="text-[11px] leading-tight text-amber-300/90">
                  ⚠ {razlog}
                </p>
              )}
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
    <div className="kartica flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
      <span className="znacka bg-gnl-400/20 text-gnl-200">{krog.number}. krog</span>
      {rok ? (
        <>
          <span className="text-slate-300">
            {zapadel ? 'Rok je potekel — ' : 'Rok: '}
            <strong className="font-semibold">
              {rok.toLocaleString('sl-SI', {
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </span>
          <Odstevanje do={krog.deadline_at} ozadje />
        </>
      ) : (
        <span className="text-slate-400">Rok še ni določen.</span>
      )}
      <span className="w-full text-xs text-slate-500">
        {zapadel
          ? 'Spremembe zdaj veljajo za naslednji krog.'
          : 'Ob roku se postava posname — dokler ni potekel, prosto spreminjaj.'}
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
