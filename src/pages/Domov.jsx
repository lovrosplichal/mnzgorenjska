import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PRAVILA_OPIS } from '../lib/tockovanje'
import { prikazniIme, formatirajTocke } from '../lib/pomozno'

export default function Domov() {
  const [stat, setStat] = useState(null)
  const [zvezde, setZvezde] = useState([])

  useEffect(() => {
    async function nalozi() {
      const [tekme, igralci, goli, brezPozicije, brezAsistence, top] =
        await Promise.all([
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('players').select('id', { count: 'exact', head: true }),
          supabase.from('goals').select('id', { count: 'exact', head: true }),
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
            .from('player_overview')
            .select('id, full_name, team_short, position, value, goals, minutes')
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
    }
    nalozi()
  }, [])

  return (
    <div className="space-y-10">
      {/* uvod */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gnl-800/60 via-slate-900 to-slate-950 p-8 ring-1 ring-white/10">
        <div className="igrisce absolute inset-0 opacity-40" aria-hidden />
        <div className="relative space-y-4">
          <span className="znacka bg-gnl-400/20 text-gnl-200">
            1. Gorenjska nogometna liga
          </span>
          <h1 className="text-4xl font-black leading-tight naslov sm:text-5xl">
            Sestavi ekipo.
            <br />
            Zberi točke. Zmagaj.
          </h1>
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
                    {stat.brezPozicije} igralcev brez pozicije
                  </div>
                  <div className="text-sm text-slate-400">
                    Zapisnik označi le vratarja — ostalo določiš ti
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* zvezde */}
      {zvezde.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Najboljši strelci lani</h2>
          <ul className="space-y-2">
            {zvezde.map((z, i) => (
              <li key={z.id} className="kartica kartica-hover flex items-center gap-3 p-3">
                <span className="w-6 text-center font-black text-slate-500">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {prikazniIme(z.full_name)}
                </span>
                <span className="text-xs text-slate-500">{z.team_short}</span>
                <span className="znacka bg-rose-400/15 text-rose-200">
                  {z.goals} ⚽
                </span>
                <span className="w-14 text-right font-black tabular-nums text-gnl-300">
                  {formatirajTocke(z.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
