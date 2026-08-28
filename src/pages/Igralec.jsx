import { useEffect, useState } from 'react'
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

const POZICIJE = ['GK', 'DEF', 'MID', 'FWD']
const IKONA = { GK: '🧤', DEF: '🛡️', MID: '⚙️', FWD: '🎯' }

export default function Igralec() {
  const { id } = useParams()
  const { session } = useAuth()
  const [igralec, setIgralec] = useState(null)
  const [krogi, setKrogi] = useState([])
  const [cene, setCene] = useState([])
  const [tekme, setTekme] = useState([])
  const [glasovi, setGlasovi] = useState({})
  const [mojGlas, setMojGlas] = useState(null)
  const [prijava, setPrijava] = useState(false)
  const [sporocilo, setSporocilo] = useState(null)
  const [napaka, setNapaka] = useState(null)
  const [nalaganje, setNalaganje] = useState(true)

  useEffect(() => {
    let preklican = false
    async function nalozi() {
      const { data: p, error } = await supabase
        .from('player_overview')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (preklican) return
      if (error) {
        setNapaka(error.message)
        setNalaganje(false)
        return
      }
      setIgralec(p)

      const [{ data: k }, { data: c }, { data: g }, { data: t }] = await Promise.all([
        supabase
          .from('player_scores')
          .select('points, rounds(number, season, played_on)')
          .eq('player_id', id)
          .order('round_id', { ascending: false })
          .limit(10),
        supabase
          .from('price_changes')
          .select('old_value, new_value, changed_at, rounds(number)')
          .eq('player_id', id)
          .order('changed_at', { ascending: false })
          .limit(5),
        supabase
          .from('position_vote_counts')
          .select('position, votes')
          .eq('player_id', id),
        // Naslednje tekme kluba — pomaga pri odločitvi, koga vzeti.
        p?.team_id
          ? supabase
              .from('prihodnje_tekme')
              .select('round_number, played_on, opponent_short, opponent_name, opponent_logo, doma')
              .eq('team_id', p.team_id)
              .order('played_on')
              .limit(5)
          : Promise.resolve({ data: [] }),
      ])
      if (preklican) return
      setKrogi(k ?? [])
      setCene(c ?? [])
      setTekme(t ?? [])
      setGlasovi(Object.fromEntries((g ?? []).map((v) => [v.position, v.votes])))

      if (session) {
        const { data: moj } = await supabase
          .from('position_votes')
          .select('position')
          .eq('player_id', id)
          .eq('voter_id', session.user.id)
          .maybeSingle()
        if (!preklican) setMojGlas(moj?.position ?? null)
      }
      setNalaganje(false)
    }
    nalozi()
    return () => {
      preklican = true
    }
  }, [id, session])

  async function glasuj(pozicija) {
    if (!session) return
    setNapaka(null)
    const { error } = await supabase
      .from('position_votes')
      .upsert(
        { player_id: Number(id), voter_id: session.user.id, position: pozicija },
        { onConflict: 'player_id,voter_id' },
      )
    if (error) return setNapaka(error.message)
    setMojGlas(pozicija)
    setGlasovi({ ...glasovi, [pozicija]: (glasovi[pozicija] ?? 0) + 1 })
    setSporocilo('Hvala — sporočilo je zabeleženo. Ko se zbere dovolj enakih, se pozicija popravi.')

    const { data: p } = await supabase
      .from('player_overview')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (p) setIgralec(p)
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

      {/* pozicija */}
      <section className="kartica space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`znacka ${razredPozicije(igralec.position)}`}>
            {IKONA[igralec.position]}{' '}
            {IME_POZICIJE[igralec.position] ?? 'Pozicija ni znana'}
          </span>
          {!prijava && (
            <button
              onClick={() => setPrijava(true)}
              className="text-sm text-slate-400 underline hover:text-white"
            >
              Ni prava pozicija? Obvesti nas
            </button>
          )}
        </div>

        {prijava && (
          <div className="space-y-2">
            {igralec.position_source === 'zapisnik' ? (
              <p className="text-sm text-slate-400">
                Pozicija tega igralca je iz uradnega zapisnika (vratar je v njem
                izrecno označen), zato je ni mogoče spreminjati.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-300">
                  Kje po tvoje igra? Ko se zbere dovolj enakih sporočil, se
                  pozicija popravi.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {POZICIJE.map((p) => (
                    <button
                      key={p}
                      onClick={() => glasuj(p)}
                      disabled={!session}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${
                        mojGlas === p ? 'ring-2 ring-gnl-400' : 'ring-1 ring-white/10'
                      } ${razredPozicije(p)}`}
                    >
                      {IKONA[p]} {KRATKA_POZICIJA[p]}
                      {glasovi[p] ? (
                        <span className="ml-1 text-xs opacity-70">
                          {glasovi[p]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                {!session && (
                  <p className="text-xs text-slate-500">
                    Za sporočilo se moraš{' '}
                    <Link to="/prijava" className="underline">
                      prijaviti
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </div>
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

      {/* zadnji krogi */}
      {krogi.length > 0 && (
        <section className="kartica p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Zadnji krogi
          </h2>
          <ul className="space-y-1">
            {krogi.map((k, n) => (
              <li
                key={n}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
              >
                <span className="text-slate-400">
                  {k.rounds?.number}. krog
                  <span className="ml-2 text-xs text-slate-600">
                    {k.rounds?.season}
                  </span>
                </span>
                <span className="font-black tabular-nums">
                  {formatirajTocke(k.points)}
                </span>
              </li>
            ))}
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

function Stevilka({ oznaka, vrednost }) {
  return (
    <div className="kartica p-3 text-center">
      <div className="text-xl font-black tabular-nums">{vrednost}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
