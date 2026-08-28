import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const povezave = [
  { pot: '/', naslov: 'Domov' },
  { pot: '/moja-ekipa', naslov: 'Moja ekipa' },
  { pot: '/glasovanje', naslov: 'Asistence' },
  { pot: '/pozicije', naslov: 'Pozicije' },
  { pot: '/igralci', naslov: 'Igralci' },
  { pot: '/lestvica', naslov: 'Lestvica' },
]

export default function Navbar() {
  const { session } = useAuth()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [odprt, setOdprt] = useState(false)
  // Koliko golov tekoče sezone še čaka na asistenco — značka ob povezavi je
  // najzanesljivejši opomnik, da liga brez glasov ne deluje.
  const [cakaGlasov, setCakaGlasov] = useState(0)

  useEffect(() => {
    // Prikažemo le sveže odigrane tekme (zadnjih 21 dni), da lansko sezono
    // z ~700 nedokončanimi asistencami ne visimo večno v opozorilu.
    supabase
      .from('match_assist_status')
      .select('brez_asistence, played_on')
      .gte(
        'played_on',
        new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10),
      )
      .then(({ data }) => {
        setCakaGlasov(
          (data ?? []).reduce((v, x) => v + Number(x.brez_asistence ?? 0), 0),
        )
      })
  }, [])

  useEffect(() => {
    if (!session) {
      setJeAdmin(false)
      return
    }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setJeAdmin(Boolean(data?.is_admin)))
  }, [session])

  const vse = jeAdmin
    ? [...povezave, { pot: '/admin', naslov: 'Admin' }]
    : povezave

  const slog = ({ isActive }) =>
    isActive
      ? 'rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-gnl-300'
      : 'rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100'

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 font-black">
            <img src="/logo/slff-grb.png" alt="" className="h-8 w-8" />
            <span className="naslov">SLFF</span>
          </NavLink>

          <div className="ml-auto hidden items-center gap-1 text-sm lg:flex">
            {vse.map((p) => (
              <NavLink key={p.pot} to={p.pot} className={slog} end={p.pot === '/'}>
                {p.naslov}
                {p.pot === '/glasovanje' && cakaGlasov > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                    {cakaGlasov}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto text-sm lg:ml-0">
            {session ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-xl px-3 py-2.5 text-slate-400 hover:text-slate-100"
              >
                Odjava
              </button>
            ) : (
              <NavLink to="/prijava" className="gumb-glavni text-sm">
                Prijava
              </NavLink>
            )}
          </div>

          <button
            onClick={() => setOdprt(!odprt)}
            aria-label="Meni"
            aria-expanded={odprt}
            className="flex h-11 w-11 items-center justify-center rounded-xl border
                       border-white/15 bg-white/5 text-2xl leading-none text-slate-200
                       active:scale-95 lg:hidden"
          >
            ☰
          </button>
        </div>

        {odprt && (
          <div className="animiraj-vstop mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3 text-base lg:hidden">
            {vse.map((p) => (
              <NavLink
                key={p.pot}
                to={p.pot}
                className={slog}
                end={p.pot === '/'}
                onClick={() => setOdprt(false)}
              >
                {p.naslov}
                {p.pot === '/glasovanje' && cakaGlasov > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                    {cakaGlasov}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
