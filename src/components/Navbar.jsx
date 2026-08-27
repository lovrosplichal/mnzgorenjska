import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const povezave = [
  { pot: '/', naslov: 'Domov' },
  { pot: '/moja-ekipa', naslov: 'Moja ekipa' },
  { pot: '/glasovanje', naslov: 'Glasovanje' },
  { pot: '/igralci', naslov: 'Igralci' },
  { pot: '/lestvica', naslov: 'Lestvica' },
]

export default function Navbar() {
  const { session } = useAuth()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [odprt, setOdprt] = useState(false)

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

  const vsePovezave = jeAdmin
    ? [...povezave, { pot: '/admin', naslov: 'Admin' }]
    : povezave

  const slog = ({ isActive }) =>
    isActive
      ? 'font-semibold text-gnl-600'
      : 'text-slate-600 hover:text-slate-900'

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gnl-600">Gorenjska Fantasy ⚽</span>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden gap-4 text-sm sm:flex">
              {vsePovezave.map((p) => (
                <NavLink key={p.pot} to={p.pot} className={slog} end={p.pot === '/'}>
                  {p.naslov}
                </NavLink>
              ))}
            </div>

            <div className="text-sm">
              {session ? (
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Odjava
                </button>
              ) : (
                <NavLink to="/prijava" className="text-gnl-600 hover:underline">
                  Prijava
                </NavLink>
              )}
            </div>

            <button
              onClick={() => setOdprt(!odprt)}
              aria-label="Meni"
              className="text-slate-600 sm:hidden"
            >
              ☰
            </button>
          </div>
        </div>

        {odprt && (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:hidden">
            {vsePovezave.map((p) => (
              <NavLink
                key={p.pot}
                to={p.pot}
                className={slog}
                end={p.pot === '/'}
                onClick={() => setOdprt(false)}
              >
                {p.naslov}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
