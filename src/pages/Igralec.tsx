import { useEffect, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import {
  prikazniIme,
  razredPozicije,
  KRATKA_POZICIJA,
  IME_POZICIJE,
  formatirajTocke,
  formatirajCeno,
} from '../lib/pomozno'
import Grb from '../components/Grb'
import { tockeZaNastop } from '../lib/tockovanje'
import type { Pozicija, Postavka } from '../lib/tipi'

/** Vrstica pogleda `player_overview` — profil igralca. */
type Profil = Record<string, any> & {
  id: number
  competition_id?: number | null
  team_id?: number | null
  position?: Pozicija | null
  full_name?: string | null
}

/** Razlaga tock v enem krogu. */
interface Razlaga {
  round_id: number
  number: number | null
  season: string | null
  played_on: string | null
  match_id: number
  minute: number | null
  postavke: Postavka[]
  skupaj: number
}

const POZICIJE: Pozicija[] = ['GK', 'DEF', 'MID', 'FWD']
const IKONA: Record<Pozicija, string> = {
  GK: '🧤',
  DEF: '🛡️',
  MID: '⚙️',
  FWD: '🎯',
}

export default function Igralec() {
  const { id } = useParams()
  // Iz naslova pride niz; stolpci so stevilcni.
  const igralecId = Number(id)
  const { session } = useAuth()
  const [igralec, setIgralec] = useState<Profil | null>(null)
  const [razlage, setRazlage] = useState<Razlaga[]>([])
  const [odprtRazlaga, setOdprtRazlaga] = useState<number | null>(null)
  const [cene, setCene] = useState<any[]>([])
  const [tekme, setTekme] = useState<any[]>([])
  const [glasovi, setGlasovi] = useState<Record<string, number>>({})
  const [mojGlas, setMojGlas] = useState<Pozicija | null>(null)
  const [sporocilo, setSporocilo] = useState<string | null>(null)
  const [napaka, setNapaka] = useState<string | null>(null)
  const [nalaganje, setNalaganje] = useState(true)

  useEffect(() => {
    let preklican = false
    async function nalozi() {
      const { data: p, error } = await supabase
        .from('player_overview')
        .select('*')
        .eq('id', igralecId)
        .maybeSingle()
      if (preklican) return
      if (error) {
        setNapaka(error.message)
        setNalaganje(false)
        return
      }
      setIgralec((p as Profil | null) ?? null)

      // Trenutna sezona — potrebujemo, da price_changes filtriramo nanjo.
      // Ligo poberemo kar iz igralca: stran je dosegljiva tudi neposredno s
      // povezavo, brez izbranega tekmovanja v naslovu.
      const { data: sez } = await supabase
        .from('sezone')
        .select('season')
        .eq('competition_id', p?.competition_id ?? 0)
        .eq('tekoca', true)
        .maybeSingle()
      const tekocaSez = sez?.season ?? ''

      const [{ data: c }, { data: g }, { data: t }] = await Promise.all([
        // Samo spremembe cen v TEKOČI sezoni — sicer se pokažejo lanski
        // krogi brez konteksta in delujejo kot "napovedi" za prihodnost.
        supabase
          .from('price_changes')
          .select('old_value, new_value, changed_at, rounds!inner(number, season)')
          .eq('player_id', igralecId)
          .eq('rounds.season', tekocaSez)
          .order('changed_at', { ascending: false })
          .limit(5),
        supabase
          .from('position_vote_counts')
          .select('position, votes')
          .eq('player_id', igralecId),
        // Naslednje tekme kluba — pomaga pri odločitvi, koga vzeti.
        p?.team_id
          ? supabase
              .from('prihodnje_tekme')
              .select('round_number, played_on, opponent_short, opponent_name, opponent_logo, doma')
              .eq('competition_id', p.competition_id ?? 0)
              .eq('team_id', p.team_id)
              .order('played_on')
              .limit(5)
          : Promise.resolve({ data: [] }),
      ])
      if (preklican) return
      setCene((c ?? []) as any[])
      setTekme((t ?? []) as any[])
      setGlasovi(
        Object.fromEntries(
          ((g ?? []) as any[]).map((v) => [String(v.position), Number(v.votes)]),
        ),
      )

      // Razlaga točk per krog — nastopi + goli + asistence
      const { data: nastopi } = await supabase
        .from('appearances')
        .select(
          'match_id, minutes_played, goals, own_goals, penalties_missed, penalties_saved, yellow_cards, red_cards, goals_conceded, clean_sheet, matches(round_id, rounds(number, season, played_on))',
        )
        .eq('player_id', igralecId)
      // Asistence: število golov, kjer je ta igralec confirmed asistent
      const { data: asistGoli } = await supabase
        .from('goals')
        .select('match_id')
        .eq('assist_player_id', igralecId)
      const asistPoMatchu = new Map<number, number>()
      for (const gg of (asistGoli ?? []) as any[])
        asistPoMatchu.set(gg.match_id, (asistPoMatchu.get(gg.match_id) ?? 0) + 1)

      // Brez potrjene pozicije tock ni mogoce razcleniti; privzamemo vezista,
      // kakor je racunala tudi prejsnja razlicica.
      const pozicija = ((p as Profil | null)?.position ?? 'MID') as Pozicija
      const raz: Razlaga[] = []
      for (const n of (nastopi ?? []) as any[]) {
        const r = n.matches?.rounds
        if (!r) continue
        const nastop = {
          minute: n.minutes_played,
          goli: n.goals,
          asistence: asistPoMatchu.get(n.match_id) ?? 0,
          cleanSheet: n.clean_sheet,
          prejetiGoli: n.goals_conceded,
          obranjeneEnajstmetrovke: n.penalties_saved,
          zgreseneEnajstmetrovke: n.penalties_missed,
          avtogoli: n.own_goals,
          rumeni: n.yellow_cards,
          rdeci: n.red_cards,
        }
        const { skupaj, postavke } = tockeZaNastop(nastop, pozicija)
        raz.push({
          round_id: n.matches.round_id,
          number: r.number,
          season: r.season,
          played_on: r.played_on,
          match_id: n.match_id,
          minute: n.minutes_played,
          postavke,
          skupaj,
        })
      }
      raz.sort((a, b) => (b.played_on ?? '').localeCompare(a.played_on ?? ''))
      setRazlage(raz)

      if (session) {
        const { data: moj } = await supabase
          .from('position_votes')
          .select('position')
          .eq('player_id', igralecId)
          .eq('voter_id', session.user.id)
          .maybeSingle()
        if (!preklican) setMojGlas((moj?.position as Pozicija | null) ?? null)
      }
      setNalaganje(false)
    }
    nalozi()
    return () => {
      preklican = true
    }
  }, [igralecId, session])

  async function glasuj(pozicija: Pozicija) {
    if (!session) return
    setNapaka(null)
    const { error } = await supabase
      .from('position_votes')
      .upsert(
        {
          player_id: igralecId,
          voter_id: session.user.id,
          position: pozicija,
        },
        { onConflict: 'player_id,voter_id' },
      )
    if (error) return setNapaka(error.message)
    setMojGlas(pozicija)
    setGlasovi({ ...glasovi, [pozicija]: (glasovi[pozicija] ?? 0) + 1 })
    setSporocilo('Hvala — sporočilo je zabeleženo. Ko se zbere dovolj enakih, se pozicija popravi.')

    const { data: p } = await supabase
      .from('player_overview')
      .select('*')
      .eq('id', igralecId)
      .maybeSingle()
    if (p) setIgralec(p as Profil)
  }

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>
  if (napaka) return <p className="text-rose-400">Napaka: {napaka}</p>
  if (!igralec)
    return <p className="kartica p-6 text-center text-slate-400">Igralca ni.</p>

  const zadnjaSprememba = cene[0]
  const premik = zadnjaSprememba
    ? Number(zadnjaSprememba.new_value) - Number(zadnjaSprememba.old_value)
    : 0

  return (
    <div className="space-y-5">
      <Link to="/igralci" className="text-sm text-slate-400 hover:text-white">
        ← Vsi igralci
      </Link>

      {/* glava */}
      <div className="kartica flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Grb
          ime={igralec.team_name}
          kratko={igralec.team_short}
          logo={igralec.team_logo}
          velikost={56}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black naslov sm:text-3xl">
            {prikazniIme(igralec.full_name)}
          </h1>
          <p className="text-sm text-slate-400">
            {igralec.team_name}
            {igralec.shirt_number != null && ` · št. ${igralec.shirt_number}`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums text-gnl-300">
            {formatirajCeno(igralec.value)}
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            cena
            {premik !== 0 && (
              <span className={premik > 0 ? 'text-gnl-300' : 'text-rose-400'}>
                {' '}
                {premik > 0 ? '▲' : '▼'} {Math.abs(premik).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* številke */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stevilka oznaka="Točke" vrednost={formatirajTocke(igralec.points)} />
        <Stevilka oznaka="Tekem" vrednost={igralec.matches} />
        <Stevilka oznaka="Golov" vrednost={igralec.goals} />
        <Stevilka oznaka="Minut" vrednost={igralec.minutes} />
      </div>

      {/* pozicija — s hitrim glasovanjem, brez preskoka na /pozicije */}
      <section className="kartica space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`znacka ${razredPozicije(igralec.position)}`}>
            {igralec.position ? IKONA[igralec.position] : '❔'}{' '}
            {(igralec.position && IME_POZICIJE[igralec.position]) ??
              'Pozicija ni znana'}
          </span>
          {igralec.position_source === 'zapisnik' && (
            <span className="text-xs text-slate-500">
              iz zapisnika (vratar je uradno označen)
            </span>
          )}
        </div>

        {igralec.position_source !== 'zapisnik' && (
          <>
            <p className="text-xs text-slate-400">
              {session
                ? 'Kje po tvoje igra? Klikni pravo pozicijo. Utežena zbirka glasov skupnosti odloči.'
                : 'Prijavljeni uporabniki lahko glasujejo o poziciji.'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POZICIJE.map((p) => {
                const izbran = mojGlas === p
                const glasov = glasovi[p] ?? 0
                return (
                  <button
                    key={p}
                    onClick={() => glasuj(p)}
                    disabled={!session}
                    className={`relative rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${
                      izbran
                        ? 'ring-2 ring-gnl-400'
                        : 'ring-1 ring-white/10 hover:ring-white/30'
                    } poz-${p}`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {IKONA[p]} {KRATKA_POZICIJA[p]}
                      {glasov > 0 && (
                        <span className="tabular-nums opacity-70">
                          {glasov}
                        </span>
                      )}
                      {izbran && <span>✓</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {!session && (
              <p className="text-xs text-slate-500">
                Za glasovanje se{' '}
                <Link to="/prijava" className="underline">
                  prijavi
                </Link>
                .
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Podroben pregled vseh igralcev in uteži je na strani{' '}
              <Link to="/pozicije" className="underline hover:text-gnl-300">
                Pozicije
              </Link>
              .
            </p>
          </>
        )}
        {sporocilo && <p className="text-sm text-gnl-300">{sporocilo}</p>}
      </section>

      {/* prihodnji nasprotniki */}
      {tekme.length > 0 && (
        <section className="kartica p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Naslednje tekme
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tekme.map((t, n) => (
              <li
                key={n}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm"
                title={`${t.round_number}. krog — ${t.doma ? 'doma' : 'v gosteh'} proti ${t.opponent_name}`}
              >
                <Grb
                  ime={t.opponent_name}
                  kratko={t.opponent_short}
                  logo={t.opponent_logo}
                  velikost={20}
                />
                <span className="font-semibold">{t.opponent_short}</span>
                <span
                  className={`text-xs ${t.doma ? 'text-gnl-300' : 'text-slate-500'}`}
                >
                  {t.doma ? 'D' : 'G'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* zadnji krogi + razlaga točk */}
      {razlage.length > 0 && (
        <section className="kartica p-3 sm:p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Točke po krogih
          </h2>
          <p className="mb-3 text-[11px] text-slate-500">
            Klikni krog za razlago, iz kje točke prihajajo.
          </p>
          <ul className="space-y-1">
            {razlage.map((r) => {
              const odprto = odprtRazlaga === r.round_id
              return (
                <li key={r.round_id} className="rounded-lg bg-white/5">
                  <button
                    onClick={() =>
                      setOdprtRazlaga(odprto ? null : r.round_id)
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                  >
                    <span className="text-slate-300">
                      <strong className="text-slate-100">
                        {r.number}. krog
                      </strong>
                      <span className="ml-2 text-xs text-slate-500">
                        {r.season} · {r.minute} min
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`font-black tabular-nums ${
                          r.skupaj > 0
                            ? 'text-gnl-300'
                            : r.skupaj < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {formatirajTocke(r.skupaj)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {odprto ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>
                  {odprto && (
                    <div className="border-t border-white/5 px-3 py-2">
                      {r.postavke.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Ni igralnega časa — 0 točk.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {r.postavke.map((p, i) => (
                            <li
                              key={i}
                              className="flex justify-between gap-3"
                            >
                              <span className="text-slate-400">{p.opis}</span>
                              <span
                                className={`font-bold tabular-nums ${
                                  p.tocke > 0
                                    ? 'text-gnl-300'
                                    : 'text-rose-400'
                                }`}
                              >
                                {p.tocke > 0 ? '+' : ''}
                                {p.tocke}
                              </span>
                            </li>
                          ))}
                          <li className="mt-1 flex justify-between gap-3 border-t border-white/10 pt-1 text-slate-300">
                            <span className="font-semibold">Skupaj</span>
                            <span className="font-black tabular-nums">
                              {formatirajTocke(r.skupaj)}
                            </span>
                          </li>
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* gibanje cene */}
      {cene.length > 0 && (
        <section className="kartica p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Gibanje cene
          </h2>
          <ul className="space-y-1">
            {cene.map((c, n) => {
              const d = Number(c.new_value) - Number(c.old_value)
              return (
                <li
                  key={n}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
                >
                  <span className="text-slate-400">{c.rounds?.number}. krog</span>
                  <span className="tabular-nums">
                    {formatirajCeno(c.old_value)} →{' '}
                    <strong>{formatirajCeno(c.new_value)}</strong>
                    <span
                      className={`ml-2 ${d > 0 ? 'text-gnl-300' : 'text-rose-400'}`}
                    >
                      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stevilka({
  oznaka,
  vrednost,
}: {
  oznaka: string
  vrednost: ReactNode
}) {
  return (
    <div className="kartica p-3 text-center">
      <div className="text-xl font-black tabular-nums">{vrednost}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
