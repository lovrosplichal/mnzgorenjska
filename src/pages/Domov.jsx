import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PRAVILA_OPIS } from '../lib/tockovanje'
import { prikazniIme, formatirajTocke, formatirajCeno } from '../lib/pomozno'
import Grb from '../components/Grb'

export default function Domov() {
  const [stat, setStat] = useState(null)
  const [zvezde, setZvezde] = useState([])
  const [krog, setKrog] = useState(null)
  const [krogNajboljsi, setKrogNajboljsi] = useState([])

  useEffect(() => {
    async function nalozi() {
      const [tekme, igralci, goli, brezPozicije, brezAsistence, top] =
        await Promise.all([
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('players').select('id', { count: 'exact', head: true }),
          supabase.from('goals').select('id', { count: 'exact', head: true }),
          // Brez pozicije ni več nikogar; skupnost potrjuje tiste, ki jo imajo
          // le predlagano iz statistike.
          supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('position_source', 'ugibanje'),
          supabase
            .from('goals')
            .select('id', { count: 'exact', head: true })
            .is('assist_player_id', null)
            .eq('is_own_goal', false),
          supabase
            .from('player_overview')
            .select(
              'id, full_name, team_name, team_short, team_logo, position, value, goals, minutes',
            )
            .order('goals', { ascending: false })
            .limit(5),
        ])
      setStat({
        tekme: tekme.count ?? 0,
        igralci: igralci.count ?? 0,
        goli: goli.count ?? 0,
        brezPozicije: brezPozicije.count ?? 0,
        brezAsistence: brezAsistence.count ?? 0,
      })
      setZvezde(top.data ?? [])

      // Kdo je bil najboljši v zadnjem odigranem krogu.
      const { data: zadnji } = await supabase
        .from('zadnji_odigrani_krog')
        .select('id, season, number, played_on')
        .maybeSingle()
      setKrog(zadnji ?? null)
      if (zadnji) {
        const { data: najboljsi } = await supabase
          .from('krog_najboljsi')
          .select(
            'player_id, full_name, position, team_name, team_short, team_logo, points, minutes, price_delta, rank',
          )
          .eq('round_id', zadnji.id)
          .order('points', { ascending: false })
          .limit(5)
        setKrogNajboljsi(najboljsi ?? [])
      }
    }
    nalozi()
  }, [])

  return (
    <div className="space-y-10">
      {/* uvod */}
      <section className="relative overflow-hidden rounded-3xl p-6 ring-1 ring-white/10 sm:p-8">
        {/* Amaterska tekma pod reflektorji — natanko to, o čemer je liga. */}
        <img
          src="/foto/igrisce.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/75 to-gnl-900/80"
          aria-hidden
        />
        <div className="relative space-y-4">
          <img
            src="/logo/slff-grb.png"
            alt="SLFF — Sunday League Fantasy Football"
            className="h-24 w-24 drop-shadow-xl sm:h-32 sm:w-32"
          />
          <span className="znacka bg-gnl-400/20 text-gnl-200">
            1. Gorenjska nogometna liga
          </span>
          <h1 className="text-4xl font-black leading-tight naslov sm:text-5xl">
            Sunday League
            <br />
            Fantasy Football
          </h1>
          <p className="text-lg font-semibold text-gnl-300">
            Sestavi ekipo. Zberi točke. Zmagaj.
          </p>
          <p className="max-w-xl text-slate-300">
            Točke prihajajo iz uradnih zapisnikov MNZ Gorenjska — goli, minute,
            ohranjene mreže, kartoni. Vse razen asistenc, ki jih določi
            skupnost.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/moja-ekipa" className="gumb-glavni">
              Sestavi ekipo
            </Link>
            <Link to="/glasovanje" className="gumb-tih">
              Glasuj o asistencah
            </Link>
          </div>
        </div>
      </section>

      {/* številke */}
      {stat && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stevilka oznaka="Tekem" vrednost={stat.tekme} ikona="📋" />
          <Stevilka oznaka="Igralcev" vrednost={stat.igralci} ikona="👥" />
          <Stevilka oznaka="Golov" vrednost={stat.goli} ikona="⚽" />
          <Stevilka
            oznaka="Čaka glasov"
            vrednost={stat.brezPozicije + stat.brezAsistence}
            ikona="🗳️"
            poudari
          />
        </section>
      )}

      {/* naloge za skupnost */}
      {stat && (stat.brezPozicije > 0 || stat.brezAsistence > 0) && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Pomagaj skupnosti</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {stat.brezAsistence > 0 && (
              <Link
                to="/glasovanje"
                className="kartica kartica-hover flex items-center gap-4 p-4"
              >
                <span className="text-3xl">🅰️</span>
                <div className="min-w-0">
                  <div className="font-bold">
                    {stat.brezAsistence} golov brez asistence
                  </div>
                  <div className="text-sm text-slate-400">
                    Povej, kdo je podal — 5 glasov potrdi
                  </div>
                </div>
              </Link>
            )}
            {stat.brezPozicije > 0 && (
              <Link
                to="/pozicije"
                className="kartica kartica-hover flex items-center gap-4 p-4"
              >
                <span className="text-3xl">📍</span>
                <div className="min-w-0">
                  <div className="font-bold">
                    {stat.brezPozicije} igralcev čaka potrditev pozicije
                  </div>
                  <div className="text-sm text-slate-400">
                    Zapisnik označi le vratarja — ostalo potrdi skupnost
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* najboljši v zadnjem krogu */}
      {krogNajboljsi.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Najboljši v zadnjem krogu</h2>
            <span className="text-sm text-slate-500">
              {krog?.number}. krog · {krog?.season}
            </span>
          </div>
          <ul className="space-y-2">
            {krogNajboljsi.map((z, i) => (
              <li
                key={z.player_id}
                className={`kartica kartica-hover flex items-center gap-2 p-3 sm:gap-3 ${
                  i === 0 ? 'ring-1 ring-amber-300/40' : ''
                }`}
              >
                <span className="w-6 text-center text-lg">
                  {i === 0 ? '🏆' : i + 1}
                </span>
                <Grb
                  ime={z.team_name}
                  kratko={z.team_short}
                  logo={z.team_logo}
                  velikost={22}
                />
                <Link
                  to={`/igralec/${z.player_id}`}
                  className="min-w-0 flex-1 truncate font-semibold hover:text-gnl-300"
                >
                  {prikazniIme(z.full_name)}
                </Link>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {z.minutes} min
                </span>
                {Number(z.price_delta) !== 0 && (
                  <span
                    className={`text-xs font-bold ${
                      Number(z.price_delta) > 0 ? 'text-gnl-300' : 'text-rose-400'
                    }`}
                  >
                    {Number(z.price_delta) > 0 ? '▲' : '▼'}
                    {Math.abs(Number(z.price_delta)).toFixed(1)}
                  </span>
                )}
                <span className="w-12 text-right font-black tabular-nums">
                  {formatirajTocke(z.points)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* zvezde */}
      {zvezde.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Najboljši strelci lani</h2>
          <ul className="space-y-2">
            {zvezde.map((z, i) => (
              <li
                key={z.id}
                className="kartica kartica-hover flex items-center gap-2 p-3 sm:gap-3"
              >
                <span className="w-6 text-center font-black text-slate-500">
                  {i + 1}
                </span>
                <Grb
                  ime={z.team_name}
                  kratko={z.team_short}
                  logo={z.team_logo}
                  velikost={22}
                />
                <Link
                  to={`/igralec/${z.id}`}
                  className="min-w-0 flex-1 truncate font-semibold hover:text-gnl-300"
                >
                  {prikazniIme(z.full_name)}
                </Link>
                <span className="znacka bg-rose-400/15 text-rose-200">
                  {z.goals} ⚽
                </span>
                <span className="w-20 text-right font-black tabular-nums text-gnl-300">
                  {formatirajCeno(z.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* potek igre */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Kako igraš</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            [
              '1. Registracija',
              'Ustvari račun z e-pošto in geslom ter si izmisli ime ekipe.',
            ],
            [
              '2. Sestavi kader',
              'Na igrišču izbereš 15 igralcev: 2 vratarja, 5 branilcev, 5 vezistov in 3 napadalce — največ 3 iz istega kluba, znotraj proračuna 100.',
            ],
            [
              '3. Postavi enajsterico',
              'Enajst gre na igrišče, štirje na klop. Kapetan prinese trojne točke; če ne igra, trak prevzame namestnik.',
            ],
            [
              '4. Po vsakem krogu',
              'Točke se izračunajo iz zapisnikov. Igralca brez minut samodejno zamenja rezervni iste pozicije, enkrat na sezono pa lahko s Klop+ v točke šteješ vso klop.',
            ],
          ].map(([naslov, opis]) => (
            <li key={naslov} className="kartica p-4">
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gnl-300">
                {naslov}
              </h3>
              <p className="text-sm text-slate-300">{opis}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* pravila */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Kako se točkuje</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRAVILA_OPIS.map((s) => (
            <div key={s.skupina} className="kartica p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gnl-300">
                {s.skupina}
              </h3>
              <ul className="space-y-1 text-sm">
                {s.vrstice.map(([opis, tocke]) => (
                  <li key={opis} className="flex justify-between gap-3">
                    <span className="text-slate-300">{opis}</span>
                    <span
                      className={`shrink-0 font-black tabular-nums ${
                        tocke.startsWith('−') ? 'text-rose-400' : 'text-gnl-300'
                      }`}
                    >
                      {tocke}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stevilka({ oznaka, vrednost, ikona, poudari }) {
  return (
    <div
      className={`kartica p-4 ${poudari && vrednost > 0 ? 'ring-1 ring-gnl-400/40' : ''}`}
    >
      <div className="text-2xl">{ikona}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{vrednost}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {oznaka}
      </div>
    </div>
  )
}
