import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PRAVILA_OPIS } from '../lib/tockovanje'
import { prikazniIme, formatirajTocke, formatirajCeno } from '../lib/pomozno'
import Grb from '../components/Grb'
import Klepet from '../components/Klepet'
import Odstevanje from '../components/Odstevanje'
import EnajstericaNaIgriscu from '../components/EnajstericaNaIgriscu'

export default function Domov() {
  const [stat, setStat] = useState(null)
  const [zvezde, setZvezde] = useState([])
  const [krog, setKrog] = useState(null)
  const [krogNajboljsi, setKrogNajboljsi] = useState([])
  const [idealnaPostava, setIdealnaPostava] = useState([])
  const [naslednjeTekme, setNaslednjeTekme] = useState([])
  const [zadnjiRezultati, setZadnjiRezultati] = useState([])
  const [naslednjiKrog, setNaslednjiKrog] = useState(null)

  useEffect(() => {
    async function nalozi() {
      const [tekme, igralci, goli, brezAsistence, top] =
        await Promise.all([
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('players').select('id', { count: 'exact', head: true }),
          supabase.from('goals').select('id', { count: 'exact', head: true }),
          // Samo tekme, ki so bile odigrane v zadnjih 21 dneh — sicer 704
          // nerešenih iz prejšnje sezone večno visijo v obvestilu.
          supabase
            .from('match_assist_status')
            .select('brez_asistence, played_on')
            .gte(
              'played_on',
              new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10),
            ),
          // Najboljši strelci TEKOČE sezone — iz player_season_standings.
          supabase
            .from('sezone')
            .select('season')
            .eq('tekoca', true)
            .maybeSingle()
            .then(({ data }) =>
              supabase
                .from('player_season_standings')
                .select(
                  'id, full_name, team_name, team_short, team_logo, position, value, goals, minutes',
                )
                .eq('season', data?.season ?? '')
                .order('goals', { ascending: false })
                .order('minutes', { ascending: false })
                .limit(5),
            ),
        ])
      setStat({
        tekme: tekme.count ?? 0,
        igralci: igralci.count ?? 0,
        goli: goli.count ?? 0,
        brezAsistence: (brezAsistence.data ?? []).reduce(
          (v, x) => v + Number(x.brez_asistence ?? 0),
          0,
        ),
      })
      setZvezde(top.data ?? [])

      // Naslednji krog — za odštevalnik do zaklepanja postave.
      const { data: nextRound } = await supabase
        .from('naslednji_krog')
        .select('id, number, season, played_on, deadline_at')
        .maybeSingle()
      setNaslednjiKrog(nextRound ?? null)

      // Naslednje tekme (neuvožene) + zadnji rezultati (uvožene v zadnjih 14 dneh).
      const enkratDavno = new Date(Date.now() - 14 * 86400000)
        .toISOString()
        .slice(0, 10)
      const [
        { data: prihajajoce },
        { data: nedavno },
        { data: vsiKlubi },
        { data: vsiKrogi },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select(
            'id, round_id, home_team_id, away_team_id, played_on, home_goals, away_goals',
          )
          .is('imported_at', null)
          .order('played_on', { ascending: true, nullsFirst: false })
          .limit(30),
        supabase
          .from('matches')
          .select(
            'id, round_id, home_team_id, away_team_id, played_on, home_goals, away_goals',
          )
          .not('imported_at', 'is', null)
          .gte('played_on', enkratDavno)
          .order('played_on', { ascending: false })
          .limit(30),
        supabase.from('teams').select('id, name, short_name, logo_url'),
        supabase.from('rounds').select('id, season, number, played_on'),
      ])
      const klubPo = Object.fromEntries((vsiKlubi ?? []).map((t) => [t.id, t]))
      const krogPo = Object.fromEntries((vsiKrogi ?? []).map((k) => [k.id, k]))
      const obogati = (m) => ({
        ...m,
        home: klubPo[m.home_team_id],
        away: klubPo[m.away_team_id],
        krog: krogPo[m.round_id],
      })
      // Placeholderji iz uvoz-razporeda (imported_at IS NULL) so pogosto
      // dvojnik uvoženih tekem. Iztlačimo tiste, za katere OBSTAJA uvožena
      // tekma z istimi ekipami na isti dan.
      const uvozeniKljuc = new Set(
        (nedavno ?? []).map(
          (m) =>
            `${m.home_team_id}-${m.away_team_id}-${m.played_on ?? ''}`,
        ),
      )
      const cistoNove = (prihajajoce ?? []).filter(
        (m) =>
          !uvozeniKljuc.has(
            `${m.home_team_id}-${m.away_team_id}-${m.played_on ?? ''}`,
          ),
      )
      setNaslednjeTekme(cistoNove.map(obogati))
      setZadnjiRezultati((nedavno ?? []).map(obogati))

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
          .limit(50)
        setKrogNajboljsi((najboljsi ?? []).slice(0, 5))

        // Idealna enajsterica: 1 GK + top 4 DEF + top 4 MID + top 2 FWD
        // po točkah v zadnjem odigranem krogu. Če je pozicij premalo,
        // dopolni z ostalimi najboljšimi. Pokaže, kaj se sistem šteje
        // za "the team of the week".
        const poPozicijah = { GK: [], DEF: [], MID: [], FWD: [] }
        for (const p of najboljsi ?? []) {
          if (poPozicijah[p.position]) poPozicijah[p.position].push(p)
        }
        const izbrani = [
          ...poPozicijah.GK.slice(0, 1),
          ...poPozicijah.DEF.slice(0, 4),
          ...poPozicijah.MID.slice(0, 4),
          ...poPozicijah.FWD.slice(0, 2),
        ]
        // Če je premalo (redke pozicije brez podatkov), dopolni s top preostalimi.
        const uporabljeni = new Set(izbrani.map((p) => p.player_id))
        for (const p of najboljsi ?? []) {
          if (izbrani.length >= 11) break
          if (!uporabljeni.has(p.player_id)) izbrani.push(p)
        }
        setIdealnaPostava(izbrani)
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
          {/* Poziv za novince — v hero, da ga vidi vsak prvič obiskovalec. */}
          <div className="rounded-2xl border border-gnl-400/40 bg-gnl-500/10 p-3 text-sm text-gnl-100 backdrop-blur">
            🏁 <strong>Zamudil si štart? Nič hudega.</strong> Vsak krog ima
            svojega zmagovalca. Na{' '}
            <Link to="/lestvica" className="underline">
              Lestvici
            </Link>{' '}
            izbereš "Od N. kroga naprej" in tekmuješ od trenutka, ko se
            pridružiš. Nič ni prepozno.
          </div>
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

      {/* glasovanje o asistencah je edino, kar liga potrebuje od ljudi */}
      {stat && stat.brezAsistence > 0 && (
        <Link
          to="/glasovanje"
          className="block overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 to-rose-500/10
                     p-5 ring-1 ring-amber-400/40 transition hover:ring-amber-300/70 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-4xl sm:text-5xl">🅰️</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-amber-100 sm:text-2xl">
                {stat.brezAsistence}{' '}
                {stat.brezAsistence === 1 ? 'gol čaka' : 'golov čaka'} na
                asistenco
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                Zapisniki asistenc ne beležijo — določi jih skupnost. Brez tvojih
                glasov podajalci ne dobijo <strong>+3 točk</strong>, tvoja ekipa
                pa ostane brez njih.
              </p>
            </div>
            <span className="gumb-glavni shrink-0">Glasuj zdaj →</span>
          </div>
        </Link>
      )}

      {/* odštevalnik do zaklepanja postave naslednjega kroga */}
      {naslednjiKrog?.deadline_at && (
        <Link
          to="/moja-ekipa"
          className="block overflow-hidden rounded-3xl bg-gradient-to-r from-gnl-500/15 to-gnl-800/10 p-4 ring-1 ring-gnl-400/30 transition hover:ring-gnl-300/60 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl">⏱️</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-bold text-gnl-200">
                  {naslednjiKrog.number}. krog se zakleni
                </span>
                <Odstevanje do={naslednjiKrog.deadline_at} />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Zadnji trenutek za spremembo ekipe, kapetana in namestnika.
                {' '}
                <span className="underline">Uredi ekipo →</span>
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* zadnji rezultati — odigrane tekme zadnjih 14 dni */}
      {zadnjiRezultati.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Zadnji rezultati</h2>
            <span className="text-xs text-slate-500">
              {zadnjiRezultati.length} tekem
            </span>
          </div>
          <div className="space-y-4">
            {(() => {
              const poKrogu = new Map()
              for (const t of zadnjiRezultati) {
                const key = t.krog?.id ?? 0
                if (!poKrogu.has(key))
                  poKrogu.set(key, { krog: t.krog, tekme: [] })
                poKrogu.get(key).tekme.push(t)
              }
              return [...poKrogu.values()]
                .sort((a, b) => (b.krog?.number ?? 0) - (a.krog?.number ?? 0))
                .slice(0, 2)
                .map(({ krog, tekme }) => (
                  <div key={krog?.id ?? 'brez'} className="kartica p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-gnl-300">
                        {krog ? `${krog.number}. krog` : 'Brez kroga'}
                        {krog?.season && (
                          <span className="ml-2 font-normal text-slate-500">
                            {krog.season}
                          </span>
                        )}
                      </span>
                      {krog?.played_on && (
                        <span className="text-xs text-slate-500">
                          {new Date(krog.played_on).toLocaleDateString('sl-SI', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {tekme.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm"
                        >
                          <div className="flex flex-1 items-center justify-end gap-2 truncate">
                            <span className="truncate font-semibold">
                              {t.home?.name ?? '?'}
                            </span>
                            <Grb
                              ime={t.home?.name}
                              kratko={t.home?.short_name}
                              logo={t.home?.logo_url}
                              velikost={22}
                            />
                          </div>
                          <span className="shrink-0 rounded-lg bg-slate-950/60 px-2 py-0.5 text-sm font-black tabular-nums">
                            {t.home_goals}:{t.away_goals}
                          </span>
                          <div className="flex flex-1 items-center gap-2 truncate">
                            <Grb
                              ime={t.away?.name}
                              kratko={t.away?.short_name}
                              logo={t.away?.logo_url}
                              velikost={22}
                            />
                            <span className="truncate font-semibold">
                              {t.away?.name ?? '?'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            })()}
          </div>
        </section>
      )}

      {/* Igralec kroga — najboljši posameznik kroga, velika kartica. */}
      {krogNajboljsi[0] && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-500/20 via-slate-950/60 to-fuchsia-500/10 p-5 shadow-lg shadow-black/40 sm:p-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="text-5xl sm:text-6xl">🌟</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-200/80">
                Igralec {krog?.number}. kroga
              </div>
              <Link
                to={`/igralec/${krogNajboljsi[0].player_id}`}
                className="mt-1 block truncate text-3xl font-black text-white hover:text-gnl-200 sm:text-4xl"
              >
                {prikazniIme(krogNajboljsi[0].full_name)}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <Grb
                  ime={krogNajboljsi[0].team_name}
                  kratko={krogNajboljsi[0].team_short}
                  logo={krogNajboljsi[0].team_logo}
                  velikost={20}
                />
                <span>{krogNajboljsi[0].team_name}</span>
                <span
                  className={`znacka poz-${krogNajboljsi[0].position}`}
                >
                  {krogNajboljsi[0].position}
                </span>
                <span className="text-slate-500">
                  · {krogNajboljsi[0].minutes} min
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black tabular-nums text-amber-200 sm:text-5xl">
                {formatirajTocke(krogNajboljsi[0].points)}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                točk
              </div>
            </div>
          </div>
        </section>
      )}

      {/* idealna enajsterica zadnjega kroga — na igrišču */}
      {idealnaPostava.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Idealna enajsterica</h2>
            <span className="text-xs text-slate-500">
              {krog?.number}. krog · sezona {krog?.season}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Najboljših 11 igralcev zadnjega odigranega kroga (1 GK, 4 BR, 4 VE,
            2 NA). Številka pod dresom je točke, ki jih je igralec zbral.
          </p>
          <EnajstericaNaIgriscu igralci={idealnaPostava} />
        </section>
      )}

      {/* naslednje tekme — razpored, da uporabniki vedo kaj prihaja */}
      {naslednjeTekme.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Naslednje tekme</h2>
            <span className="text-xs text-slate-500">
              {naslednjeTekme.length}{' '}
              {naslednjeTekme.length === 1 ? 'tekma' : 'tekem'} v razporedu
            </span>
          </div>
          <div className="space-y-4">
            {(() => {
              const poKrogu = new Map()
              for (const t of naslednjeTekme) {
                const key = t.krog?.id ?? 0
                if (!poKrogu.has(key))
                  poKrogu.set(key, { krog: t.krog, tekme: [] })
                poKrogu.get(key).tekme.push(t)
              }
              return [...poKrogu.values()]
                .sort((a, b) => (a.krog?.number ?? 0) - (b.krog?.number ?? 0))
                .slice(0, 3)
                .map(({ krog, tekme }) => (
                  <div key={krog?.id ?? 'brez'} className="kartica p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-gnl-300">
                        {krog ? `${krog.number}. krog` : 'Brez kroga'}
                        {krog?.season && (
                          <span className="ml-2 font-normal text-slate-500">
                            {krog.season}
                          </span>
                        )}
                      </span>
                      {krog?.played_on && (
                        <span className="text-xs text-slate-500">
                          {new Date(krog.played_on).toLocaleDateString('sl-SI', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {tekme.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm"
                        >
                          <div className="flex flex-1 items-center justify-end gap-2 truncate">
                            <span className="truncate font-semibold">
                              {t.home?.name ?? '?'}
                            </span>
                            <Grb
                              ime={t.home?.name}
                              kratko={t.home?.short_name}
                              logo={t.home?.logo_url}
                              velikost={22}
                            />
                          </div>
                          <span className="shrink-0 text-slate-500">
                            {t.played_on
                              ? new Date(t.played_on).toLocaleDateString(
                                  'sl-SI',
                                  { day: 'numeric', month: 'numeric' },
                                )
                              : 'vs'}
                          </span>
                          <div className="flex flex-1 items-center gap-2 truncate">
                            <Grb
                              ime={t.away?.name}
                              kratko={t.away?.short_name}
                              logo={t.away?.logo_url}
                              velikost={22}
                            />
                            <span className="truncate font-semibold">
                              {t.away?.name ?? '?'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            })()}
          </div>
        </section>
      )}

      {/* številke — iz zgodovine (vključno z lansko sezono, ne trenutne) */}
      {stat && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Iz zgodovine (pretekla sezona)
            </h2>
            <span className="text-[10px] uppercase tracking-wide text-slate-600">
              nova sezona še ni odigrana
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stevilka oznaka="Tekem" vrednost={stat.tekme} ikona="📋" />
            <Stevilka oznaka="Igralcev" vrednost={stat.igralci} ikona="👥" />
            <Stevilka oznaka="Golov" vrednost={stat.goli} ikona="⚽" />
            <Stevilka
              oznaka="Čaka glasov"
              vrednost={stat.brezAsistence}
              ikona="🗳️"
              poudari
            />
          </div>
        </section>
      )}

      {/* klepet — anonimni prostor za pogovor */}
      <Klepet />

      {/* naloge za skupnost — samo asistence, pozicij ne izpostavljamo, ker
          so postavljene iz statistike in jih glasovanje po potrebi popravi. */}
      {stat && stat.brezAsistence > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Pomagaj skupnosti</h2>
          <div className="grid gap-3 sm:grid-cols-2">
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
                  Povej, kdo je podal — 3 glasovi potrdijo
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* najboljši v zadnjem krogu */}
      {krogNajboljsi.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">
              Najboljši v zadnjem odigranem krogu
            </h2>
            <span className="text-sm text-slate-500">
              {krog?.number}. krog · sezona {krog?.season}
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
          <h2 className="text-xl font-bold">Najboljši strelci sezone</h2>
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
