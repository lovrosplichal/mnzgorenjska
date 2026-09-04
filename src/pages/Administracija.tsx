import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Pozicija } from '../lib/tipi'
import { useAuth } from '../lib/useAuth'
import { prikazniIme, IME_POZICIJE, formatirajTocke, formatirajCeno } from '../lib/pomozno'
import { POZICIJE, VELIKOST_EKIPE, STEVILO_PRVIH, MAX_IZ_KLUBA, VRSTNI_RED, poPozicijah } from '../lib/pravila'
import { useTekmovanje } from '../lib/tekmovanje'

export default function Administracija() {
  const { session, loading } = useAuth()
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [nalaganje, setNalaganje] = useState(true)
  const [opozorila, setOpozorila] = useState<any[]>([])
  const [krogi, setKrogi] = useState<any[]>([])
  const [sporocilo, setSporocilo] = useState<string | null>(null)
  const [napaka, setNapaka] = useState<string | null>(null)
  const [iskanje, setIskanje] = useState('')
  const [zadetki, setZadetki] = useState<any[]>([])
  const [klubi, setKlubi] = useState<any[]>([])
  const [ekipe, setEkipe] = useState<any[]>([])
  const [uporabniki, setUporabniki] = useState<any[]>([])
  const [filterNepopolne, setFilterNepopolne] = useState(false)
  const [urediEkipa, setUrediEkipa] = useState<any | null>(null)
  const [urediUporabnik, setUrediUporabnik] = useState<any | null>(null)
  const [kopirano, setKopirano] = useState(false)
  const [posiljam, setPosiljam] = useState(false)
  const [logMailov, setLogMailov] = useState<any[]>([])
  // Pošiljanje je bilo skrito za window.prompt/window.confirm. Na telefonu
  // ju brskalnik pogosto ne pokaže, na namizju pa ju po nekaj oknih ponudi
  // blokirati — koda je nato tiho ne naredila nič: brez zahteve, brez napake.
  // Zato vprašanje in vnos naslova živita kar na strani.
  const [testniNaslov, setTestniNaslov] = useState('')
  const [potrjujemOpomnike, setPotrjujemOpomnike] = useState(false)

  useEffect(() => {
    if (loading || !tekmovanjeId) return
    if (!session) {
      setNalaganje(false)
      return
    }
    const uporabnikId = session.user.id
    async function init() {
      const { data: profil } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', uporabnikId)
        .maybeSingle()
      const admin = Boolean(profil?.is_admin)
      setJeAdmin(admin)

      if (admin) {
        const [tekme, kr, kl] = await Promise.all([
          supabase
            .from('matches')
            .select(
              'id, zapisnik_id, source_url, import_warnings, rounds!inner(competition_id)',
            )
            .eq('rounds.competition_id', tekmovanjeId as number)
            .not('import_warnings', 'eq', '{}')
            .order('id', { ascending: false })
            .limit(50),
          supabase
            .from('rounds')
            .select('id, season, number')
            .eq('competition_id', tekmovanjeId as number)
            .order('season')
            .order('number'),
          supabase
            .from('competition_teams')
            .select('team_id, name')
            .eq('competition_id', tekmovanjeId as number)
            .order('name'),
        ])
        setOpozorila(
          ((tekme.data ?? []) as any[]).filter((t) => t.import_warnings?.length),
        )
        setKrogi((kr.data ?? []) as any[])
        setKlubi(
          ((kl.data ?? []) as any[]).map((k) => ({
            id: k.team_id,
            name: k.name,
          })),
        )

        // Vse fantasy ekipe s celo rostersko sliko za sanity-check.
        await naloziEkipe()
        await naloziUporabnike()
      }
      setNalaganje(false)
    }
    init()
  }, [session, loading, tekmovanjeId])

  async function naloziUporabnike() {
    const { data, error } = await supabase.rpc('admin_uporabniki', {
      p_competition_id: tekmovanjeId ?? undefined,
    })
    if (error) return setNapaka(error.message)
    setUporabniki((data ?? []) as any[])
    const { data: log } = await supabase
      .from('email_log')
      .select('id, email, vrsta, poslano_at, napaka')
      .eq('competition_id', tekmovanjeId as number)
      .order('poslano_at', { ascending: false })
      .limit(20)
    setLogMailov(log ?? [])
  }

  async function posljiOpomnike() {
    setPotrjujemOpomnike(false)
    setNapaka(null)
    setPosiljam(true)
    try {
      const { data, error } = await supabase.functions.invoke('posli-opomnik', {
        body: { competition_id: tekmovanjeId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const posl = data?.poslano ?? 0
      const presk = data?.preskoceno ?? 0
      setSporocilo(
        `Poslano ${posl}, preskočeno ${presk} (že prejel opomnik v zadnjih 3 dneh ali napaka).`,
      )
      await naloziUporabnike()
    } catch (e) {
      setNapaka(`Pošiljanje ni uspelo: ${(e as Error)?.message ?? e}`)
    } finally {
      setPosiljam(false)
    }
  }

  async function posljiTestniMail(naslov: string) {
    if (!naslov?.trim()) {
      setSporocilo(null)
      return setNapaka('Vpiši naslov, na katerega naj gre testni mail.')
    }
    setNapaka(null)
    setPosiljam(true)
    try {
      const { data, error } = await supabase.functions.invoke('posli-opomnik', {
        body: { competition_id: tekmovanjeId, test_email: naslov },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const r = data?.resend
      if (r?.napaka) throw new Error(r.napaka)
      setSporocilo(`Test mail poslan na ${naslov}. Resend ID: ${r?.id ?? '—'}`)
    } catch (e) {
      setNapaka(`Test ni uspel: ${(e as Error)?.message ?? e}`)
    } finally {
      setPosiljam(false)
    }
  }

  async function preimenujEkipo(id: number, novo: string) {
    setNapaka(null)
    const { error } = await supabase
      .from('fantasy_teams')
      .update({ name: novo })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setSporocilo(`Ekipa preimenovana v "${novo}".`)
    setUrediEkipa(null)
    await naloziEkipe()
    await naloziUporabnike()
  }

  async function preimenujUporabnika(user_id: string, novo: string) {
    setNapaka(null)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: novo })
      .eq('id', user_id)
    if (error) return setNapaka(error.message)
    setSporocilo(`Uporabnik preimenovan v "${novo}".`)
    setUrediUporabnik(null)
    await naloziEkipe()
    await naloziUporabnike()
  }

  async function kopirajEmaile(seznam: any[]) {
    const emaili = seznam.map((u) => u.email).filter(Boolean).join(', ')
    try {
      await navigator.clipboard.writeText(emaili)
      setKopirano(true)
      setSporocilo(`${seznam.length} e-poštnih naslovov v odložišču.`)
      setTimeout(() => setKopirano(false), 2500)
    } catch {
      setNapaka('Kopiranje ni uspelo — označi seznam ročno.')
    }
  }

  function mailtoNepopolnim(seznam: any[]) {
    const emaili = seznam.map((u) => u.email).filter(Boolean).join(',')
    const zadeva = encodeURIComponent(
      `SLFF ${tekmovanje?.short_name ?? ''} — dokončaj ekipo pred naslednjim krogom`,
    )
    const telo = encodeURIComponent(
      `Zdravo!\n\nSLFF ${tekmovanje?.short_name ?? ''} kmalu začne naslednji krog, tvoja ekipa pa še ni pripravljena. Brez veljavne ekipe v tem krogu ne dobiš točk.\n\nDokončaj ekipo tu: https://slff.eu/moja-ekipa\n\nHvala!`,
    )
    return `mailto:?bcc=${emaili}&subject=${zadeva}&body=${telo}`
  }

  // PostgREST vrne največ 1000 vrstic na zahtevo in to stori tiho: prenos se
  // preprosto odreže. Ekipe, ki so padle čez rob, so se na strani prikazale
  // brez enega samega igralca. Kadrov je čez obe ligi že 1324, zato jih
  // beremo po straneh in nikoli ne verjamemo, da je ena zahteva dovolj.
  async function vsiKadri(tekmovanje: any) {
    const STRAN = 1000
    const vse = []
    for (let od = 0; ; od += STRAN) {
      const { data, error } = await supabase
        .from('fantasy_roster')
        .select(
          'fantasy_team_id, player_id, is_starter, is_captain, is_vice, buy_value, buy_position, fantasy_teams!inner(competition_id), players(id, full_name, position, team_id, value, active)',
        )
        .eq('fantasy_teams.competition_id', tekmovanje)
        .order('fantasy_team_id')
        .order('player_id')
        .range(od, od + STRAN - 1)
      if (error) {
        setNapaka(error.message)
        break
      }
      vse.push(...(data ?? []))
      if (!data || data.length < STRAN) break
    }
    return vse
  }

  async function naloziEkipe() {
    // wealth + owners + rosters + player positions/teams — dovolj za validacijo
    const [{ data: wealth }, { data: teamsBase }, rosters] =
      await Promise.all([
        supabase
          .from('fantasy_team_wealth')
          .select('fantasy_team_id, name, starting_budget, cash, roster_value, total_wealth')
          .eq('competition_id', tekmovanjeId as number)
          .order('total_wealth', { ascending: false }),
        supabase
          .from('fantasy_teams')
          .select('id, owner_id, profiles(display_name)')
          .eq('competition_id', tekmovanjeId as number),
        vsiKadri(tekmovanjeId),
      ])
    const podrostri = new Map()
    for (const r of rosters ?? []) {
      const arr = podrostri.get(r.fantasy_team_id) ?? []
      arr.push(r)
      podrostri.set(r.fantasy_team_id, arr)
    }
    const lastniki = Object.fromEntries(
      (teamsBase ?? []).map((t) => [
        t.id,
        t.profiles?.display_name ?? t.owner_id?.slice(0, 8) ?? '?',
      ]),
    )
    const napolnjene = (wealth ?? []).map((w) => {
      const roster = podrostri.get(w.fantasy_team_id) ?? []
      // Kvoto sodi mesto ob nakupu, enako kot baza — sicer bi administracija
      // označila za neveljavne kadre, ki so v resnici v redu.
      const kader = (roster as any[])
        .map((r: any) =>
          r.players
            ? { ...r.players, position: r.buy_position ?? r.players.position }
            : null,
        )
        .filter(Boolean) as any[]
      const napake = validacijaRosterja(roster, kader)
      return {
        ...w,
        owner: lastniki[String(w.fantasy_team_id)] ?? '?',
        stIgralcev: roster.length,
        stStarterjev: (roster as any[]).filter((r: any) => r.is_starter).length,
        stKapetanov: (roster as any[]).filter((r: any) => r.is_captain).length,
        stNamestnikov: (roster as any[]).filter((r: any) => r.is_vice).length,
        stNeaktivnih: kader.filter((p: any) => !p.active).length,
        kaderPoPoz: poPozicijah(kader),
        roster,
        napake,
      }
    })
    setEkipe(napolnjene)
  }

  function validacijaRosterja(roster: any[], kader: any[]) {
    const napake = []
    if (roster.length !== VELIKOST_EKIPE)
      napake.push(`kader ${roster.length}/${VELIKOST_EKIPE}`)
    const starter = roster.filter((r) => r.is_starter).length
    if (starter !== STEVILO_PRVIH)
      napake.push(`postava ${starter}/${STEVILO_PRVIH}`)
    if (roster.filter((r) => r.is_captain).length !== 1)
      napake.push('kapetan ni določen ali jih je več')
    if (roster.filter((r) => r.is_vice).length !== 1)
      napake.push('namestnik ni določen ali jih je več')
    const kaderPo = poPozicijah(kader)
    for (const koda of VRSTNI_RED) {
      const p = POZICIJE[koda]
      if (kaderPo[koda] !== p.kader)
        napake.push(`${p.naslov} ${kaderPo[koda]}/${p.kader}`)
    }
    const poKlubu: Record<string, number> = {}
    for (const p of kader)
      poKlubu[String(p.team_id)] = (poKlubu[String(p.team_id)] ?? 0) + 1
    if (Object.values(poKlubu).some((n) => n > MAX_IZ_KLUBA))
      napake.push(`>${MAX_IZ_KLUBA} iz istega kluba`)
    if (kader.filter((p) => !p.active).length > 0)
      napake.push(`ima ${kader.filter((p) => !p.active).length} neaktivnih igralcev`)
    return napake
  }

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

  async function isciIgralca(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!iskanje.trim()) return setZadetki([])
    const { data } = await supabase
      .from('player_overview')
      .select('id, full_name, team_id, team_name, position, value, minutes, goals')
      .eq('competition_id', tekmovanjeId as number)
      .ilike('full_name', `%${iskanje.trim()}%`)
      .order('full_name')
      .limit(15)
    setZadetki(data ?? [])
  }

  async function premakniKlub(id: number, novKlubId: number) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ team_id: novKlubId })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    const novoIme = klubi.find((k) => k.id === novKlubId)?.name ?? ''
    setZadetki(
      zadetki.map((z) =>
        z.id === id ? { ...z, team_id: novKlubId, team_name: novoIme } : z,
      ),
    )
    setSporocilo(`Igralec prestavljen v klub ${novoIme}.`)
  }

  async function nastaviPozicijo(id: number, pozicija: Pozicija) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({ position: pozicija, position_source: 'admin' })
      .eq('id', id)
    if (error) return setNapaka(error.message)
    setZadetki(zadetki.map((z) => (z.id === id ? { ...z, position: pozicija } : z)))
    setSporocilo('Pozicija nastavljena.')
  }

  async function shraniNzs(id: number, polje: string, vrednost: any) {
    setNapaka(null)
    const { error } = await supabase
      .from('players')
      .update({
        [polje]: vrednost,
        nzs_confirmed_at: new Date().toISOString(),
      } as any)
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
      <h1 className="text-3xl font-black naslov">
        Administracija
        {tekmovanje && (
          <span className="ml-2 align-middle text-base font-bold text-slate-500">
            {tekmovanje.short_name?.toLowerCase()}
          </span>
        )}
      </h1>

      {/* pregled */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kazalnik oznaka="Uporabnikov" vrednost={uporabniki.length} />
        <Kazalnik oznaka="Fantasy ekip" vrednost={ekipe.length} />
        <Kazalnik
          oznaka="Brez veljavne ekipe"
          vrednost={uporabniki.filter((u) => !u.ekipa_veljavna).length}
          opozori
        />
        <Kazalnik oznaka="Opozoril iz uvoza" vrednost={opozorila.length} opozori />
      </section>

      {/* uporabniki + e-pošte za opomnik */}
      <section className="kartica space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">
            Uporabniki ({uporabniki.length})
            {filterNepopolne && (
              <span className="ml-2 text-xs font-normal text-amber-300">
                — brez veljavne ekipe: {uporabniki.filter((u) => !u.ekipa_veljavna).length}
              </span>
            )}
          </h2>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={filterNepopolne}
              onChange={(e) => setFilterNepopolne(e.target.checked)}
            />
            samo brez veljavne ekipe
          </label>
        </div>

        {(() => {
          const seznam = filterNepopolne
            ? uporabniki.filter((u) => !u.ekipa_veljavna && u.email)
            : uporabniki
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPotrjujemOpomnike(true)}
                  disabled={posiljam || potrjujemOpomnike}
                  className="gumb-glavni text-xs disabled:opacity-50"
                >
                  {posiljam ? 'Pošiljam …' : '📨 Pošlji opomnike'}
                </button>

                {/* Vnos naslova stoji na strani, ne v pogovornem oknu —
                    window.prompt na telefonu marsikje sploh ne skoči. */}
                <input
                  type="email"
                  value={testniNaslov}
                  onChange={(e) => setTestniNaslov(e.target.value)}
                  placeholder={session?.user?.email ?? 'naslov@primer.si'}
                  className="w-48 rounded-lg bg-white/5 px-2 py-1.5 text-xs
                             ring-1 ring-white/10 placeholder:text-slate-600"
                />
                <button
                  onClick={() =>
                    posljiTestniMail(testniNaslov || (session?.user?.email ?? ''))
                  }
                  disabled={posiljam}
                  className="gumb-tih text-xs disabled:opacity-50"
                >
                  🧪 Testni mail
                </button>
                <button
                  onClick={() =>
                    kopirajEmaile(
                      uporabniki.filter((u) => !u.ekipa_veljavna && u.email),
                    )
                  }
                  className="gumb-tih text-xs"
                >
                  {kopirano ? '✓ kopirano' : 'Kopiraj e-pošte'}
                </button>
                <a
                  href={mailtoNepopolnim(
                    uporabniki.filter((u) => !u.ekipa_veljavna && u.email),
                  )}
                  className="gumb-tih text-xs"
                >
                  ✉️ Mailto (BCC)
                </a>
                <button onClick={naloziUporabnike} className="text-xs text-slate-400 underline hover:text-gnl-300">
                  osveži
                </button>
              </div>

              {potrjujemOpomnike && (
                <div className="animiraj-vstop flex flex-wrap items-center gap-2 rounded-xl bg-amber-400/10 p-3 text-sm ring-1 ring-amber-400/30">
                  <span className="text-amber-100">
                    Poslati opomnik{' '}
                    <strong>
                      {
                        uporabniki.filter((u) => !u.ekipa_veljavna && u.email)
                          .length
                      }
                    </strong>{' '}
                    uporabnikom brez veljavne ekipe? Kdor ga je dobil v zadnjih
                    3 dneh, bo preskočen.
                  </span>
                  <button
                    onClick={posljiOpomnike}
                    disabled={posiljam}
                    className="gumb-glavni text-xs disabled:opacity-50"
                  >
                    Da, pošlji
                  </button>
                  <button
                    onClick={() => setPotrjujemOpomnike(false)}
                    className="gumb-tih text-xs"
                  >
                    Prekliči
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 pr-2">Uporabnik</th>
                      <th className="pb-2 pr-2">E-pošta</th>
                      <th className="pb-2 pr-2">Ekipa</th>
                      <th className="pb-2 pr-2 text-right">Kader</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">Registracija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seznam.map((u) => (
                      <tr key={u.user_id} className="border-t border-white/5 align-top">
                        <td className="py-1.5 pr-2 font-semibold">
                          {urediUporabnik?.user_id === u.user_id ? (
                            <VrsticaZaUrejanje
                              zacetna={urediUporabnik.display_name ?? ''}
                              nashrani={(v) => preimenujUporabnika(u.user_id, v)}
                              naprekini={() => setUrediUporabnik(null)}
                            />
                          ) : (
                            <button
                              onClick={() =>
                                setUrediUporabnik({
                                  user_id: u.user_id,
                                  display_name: u.display_name ?? '',
                                })
                              }
                              className="text-left hover:text-gnl-300"
                              title="Preimenuj uporabnika"
                            >
                              {u.display_name || <span className="text-slate-500">—</span>}
                              <span className="ml-1 text-slate-600">✎</span>
                              {u.is_admin && (
                                <span className="znacka ml-2 bg-gnl-400/20 text-gnl-200">admin</span>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-slate-400">
                          {u.email ? (
                            <a href={`mailto:${u.email}`} className="hover:text-gnl-300">
                              {u.email}
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {u.team_id ? (
                            urediEkipa?.id === u.team_id ? (
                              <VrsticaZaUrejanje
                                zacetna={urediEkipa.name ?? ''}
                                nashrani={(v) => preimenujEkipo(u.team_id, v)}
                                naprekini={() => setUrediEkipa(null)}
                              />
                            ) : (
                              <button
                                onClick={() =>
                                  setUrediEkipa({ id: u.team_id, name: u.team_name })
                                }
                                className="text-left hover:text-gnl-300"
                                title="Preimenuj ekipo"
                              >
                                {u.team_name}
                                <span className="ml-1 text-slate-600">✎</span>
                              </button>
                            )
                          ) : (
                            <span className="text-slate-600">nima ekipe</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {u.team_id ? `${u.roster_stevilo}/${VELIKOST_EKIPE}` : '—'}
                        </td>
                        <td className="py-1.5 pr-2">
                          {!u.team_id ? (
                            <span className="znacka bg-amber-400/20 text-amber-200">
                              brez ekipe
                            </span>
                          ) : u.ekipa_veljavna ? (
                            <span className="znacka bg-gnl-400/20 text-gnl-200">
                              ✓ ok
                            </span>
                          ) : (
                            <span className="znacka bg-rose-400/20 text-rose-200">
                              nepopolna
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-slate-500">
                          {u.registered_at
                            ? new Date(u.registered_at).toLocaleDateString('sl-SI', {
                                day: 'numeric',
                                month: 'numeric',
                                year: '2-digit',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filterNepopolne && seznam.length === 0 && (
                <p className="text-sm text-slate-500">
                  Vsi uporabniki imajo veljavno ekipo — nič za pošiljati.
                </p>
              )}
            </>
          )
        })()}

        {logMailov.length > 0 && (
          <details className="mt-2 rounded-xl bg-white/5 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-300">
              Zgodovina poslanih opomnikov (zadnjih {logMailov.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {logMailov.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span className={l.napaka ? 'text-rose-300' : 'text-slate-300'}>
                    {l.napaka ? '✗' : '✓'} {l.email}
                  </span>
                  <span className="text-slate-500">
                    {new Date(l.poslano_at).toLocaleString('sl-SI', {
                      day: 'numeric',
                      month: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {l.napaka && (
                      <span
                        title={l.napaka}
                        className="ml-2 text-rose-300"
                      >
                        napaka
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Fantasy ekipe — vrednost, cash, veljavnost rosterja */}
      <section className="kartica space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Fantasy ekipe ({ekipe.length})</h2>
          <button
            onClick={naloziEkipe}
            className="text-xs text-slate-400 underline hover:text-gnl-300"
          >
            osveži
          </button>
        </div>
        {ekipe.length === 0 ? (
          <p className="text-sm text-slate-500">Ni ekip.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 pr-2">Ekipa</th>
                  <th className="pb-2 pr-2">Lastnik</th>
                  <th className="pb-2 pr-2 text-right">Cash</th>
                  <th className="pb-2 pr-2 text-right">Kader</th>
                  <th className="pb-2 pr-2 text-right">Bogastvo</th>
                  <th className="pb-2 pr-2">Postava</th>
                  <th className="pb-2 pr-2">GK/DEF/MID/FWD</th>
                  <th className="pb-2 pr-2">Kap/Nam</th>
                  <th className="pb-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ekipe.map((e) => (
                  <tr
                    key={e.fantasy_team_id}
                    className={`border-t border-white/5 ${
                      e.napake.length > 0 ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-2 font-semibold">{e.name}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{e.owner}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatirajCeno(e.cash)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatirajCeno(e.roster_value)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-bold tabular-nums">
                      <span
                        className={
                          Number(e.total_wealth) > Number(e.starting_budget)
                            ? 'text-gnl-300'
                            : Number(e.total_wealth) < Number(e.starting_budget)
                              ? 'text-rose-300'
                              : ''
                        }
                      >
                        {formatirajCeno(e.total_wealth)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">
                      {e.stStarterjev}/{STEVILO_PRVIH}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">
                      {VRSTNI_RED.map((k) => e.kaderPoPoz[k]).join('/')}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-slate-400">
                      {e.stKapetanov}/{e.stNamestnikov}
                    </td>
                    <td className="py-1.5 pr-2">
                      {e.napake.length === 0 ? (
                        <span className="znacka bg-gnl-400/20 text-gnl-200">
                          ✓ ok
                        </span>
                      ) : (
                        <span
                          title={e.napake.join('\n')}
                          className="znacka bg-rose-400/20 text-rose-200"
                        >
                          ⚠ {e.napake.length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ekipe.some((e) => e.napake.length > 0) && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-xs text-rose-100">
            <strong>Neveljavni rosterji</strong> po glasovanju pozicij:
            <ul className="mt-1 space-y-1">
              {ekipe
                .filter((e) => e.napake.length > 0)
                .map((e) => (
                  <li key={e.fantasy_team_id}>
                    <strong>{e.name}</strong> ({e.owner}) — {e.napake.join(' · ')}
                  </li>
                ))}
            </ul>
          </div>
        )}
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
{`SUPABASE_SERVICE_ROLE_KEY=... node scripts/uvoz-zapisnikov.mjs --tekmovanje ${
  tekmovanje?.slug ?? 'clani'
}
SUPABASE_SERVICE_ROLE_KEY=... node scripts/ovrednoti-igralce.mjs --tekmovanje ${
  tekmovanje?.slug ?? 'clani'
}`}
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
                  {t.import_warnings.map((o: string, i: number) => (
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
                  {z.position
                    ? IME_POZICIJE[z.position as Pozicija]
                    : 'brez pozicije'}{' '}
                  ·{' '}
                  {formatirajTocke(z.value)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(['GK', 'DEF', 'MID', 'FWD'] as Pozicija[]).map((p) => (
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
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Prestavi v klub:</span>
                <select
                  value={z.team_id ?? ''}
                  onChange={(e) =>
                    e.target.value &&
                    Number(e.target.value) !== z.team_id &&
                    premakniKlub(z.id, Number(e.target.value))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                >
                  {klubi.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
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

function Kazalnik({
  oznaka,
  vrednost,
  opozori,
}: {
  oznaka: string
  vrednost: number
  opozori?: boolean
}) {
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

function VrsticaZaUrejanje({
  zacetna,
  nashrani,
  naprekini,
}: {
  zacetna: string
  nashrani: (v: string) => void
  naprekini: () => void
}) {
  const [vrednost, setVrednost] = useState(zacetna)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const t = vrednost.trim()
        if (t && t !== zacetna) nashrani(t)
        else naprekini()
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        value={vrednost}
        onChange={(e) => setVrednost(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && naprekini()}
        className="w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs"
      />
      <button type="submit" className="text-xs text-gnl-300 hover:text-gnl-200">
        ✓
      </button>
      <button
        type="button"
        onClick={naprekini}
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        ✕
      </button>
    </form>
  )
}
