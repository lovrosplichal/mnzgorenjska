import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useTekmovanje } from '../lib/tekmovanje'
import { supabase } from '../lib/supabase'

const povezave = [
  { pot: '/', naslov: 'Domov' },
  { pot: '/moja-ekipa', naslov: 'Moja ekipa' },
  { pot: '/glasovanje', naslov: 'Asistence' },
  { pot: '/pozicije', naslov: 'Pozicije' },
  { pot: '/igralci', naslov: 'Igralci' },
  { pot: '/rezultati', naslov: 'Rezultati' },
  { pot: '/lestvica', naslov: 'Lestvica' },
]

const VABILO_MAILTO =
  'mailto:?subject=' +
  encodeURIComponent('Fantasy liga za 1. GNL — pridi zraven') +
  '&body=' +
  encodeURIComponent(
    'Živjo!\n\nIgram fantasy nogometno ligo za 1. Gorenjsko nogometno ligo — sestaviš svojo ekipo iz igralcev naših klubov (Preddvor, Sava Kranj, Jezero Medvode, Bled-Bohinj Hirter, Britof, Visoko, Polet, Velesovo-Cerklje, Zarica, Bitnje, Niko Železniki, Tržič, Kranjska Gora) in tekmuješ z drugimi.\n\nPovsem brezplačno. Registriraj se na:\nhttps://slff.eu\n\nSestavi ekipo, določi kapetana in po vsakem krogu preveri, kdo je zbral največ točk.\n\nSe vidimo v ligi!',
  )

/**
 * Preklop med ligama. Stoji v vrstici z logotipom in je viden tudi na
 * telefonu — skrit v meniju bi pomenil, da med brskanjem ne vidiš, katero
 * ligo sploh gledaš. Brez druge lige v bazi se sploh ne izriše.
 */
function PreklopLige() {
  const { slug, tekmovanja, nastavi } = useTekmovanje()
  if (tekmovanja.length < 2) return null

  return (
    <div
      className="flex rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10"
      role="group"
      aria-label="Liga"
    >
      {tekmovanja.map((t) => (
        <button
          key={t.slug}
          onClick={() => nastavi(t.slug)}
          aria-pressed={t.slug === slug}
          className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${
            t.slug === slug
              ? 'bg-gnl-500/25 text-gnl-200'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          {t.short_name}
        </button>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { session } = useAuth()
  const { id: tekmovanjeId } = useTekmovanje()
  const [jeAdmin, setJeAdmin] = useState(false)
  const [odprt, setOdprt] = useState(false)
  // Koliko golov tekoče sezone še čaka na asistenco — značka ob povezavi je
  // najzanesljivejši opomnik, da liga brez glasov ne deluje.
  const [cakaGlasov, setCakaGlasov] = useState(0)

  useEffect(() => {
    if (!tekmovanjeId) return
    // Prikažemo le sveže odigrane tekme (zadnjih 21 dni), da lansko sezono
    // z ~700 nedokončanimi asistencami ne visimo večno v opozorilu.
    supabase
      .from('match_assist_status')
      .select('brez_asistence, played_on')
      .eq('competition_id', tekmovanjeId)
      .gte(
        'played_on',
        new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10),
      )
      .then(({ data }) => {
        setCakaGlasov(
          (data ?? []).reduce((v, x) => v + Number(x.brez_asistence ?? 0), 0),
        )
      })
  }, [tekmovanjeId])

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
      <nav className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3 lg:gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-black">
            <img src="/logo/slff-grb.png" alt="" className="h-8 w-8" />
            <span className="naslov">SLFF</span>
          </NavLink>

          <PreklopLige />

          <div className="ml-auto hidden items-center gap-1.5 text-sm lg:flex">
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
            {/* Povabi prijatelja — mailto link odpre lokalni mail klient.
                Na ozjih desktopih (lg 1024–1279) samo ikona, da menija ne
                stisne; polni napis se vrne na xl. */}
            <a
              href={VABILO_MAILTO}
              title="Povabi prijatelja"
              aria-label="Povabi prijatelja"
              className="rounded-lg bg-fuchsia-500/15 px-3 py-1.5 font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/30 hover:bg-fuchsia-500/25"
            >
              <span aria-hidden="true">✉️</span>
              <span className="ml-1 hidden xl:inline">Povabi</span>
            </a>
          </div>

          <div className="ml-auto text-sm lg:ml-2">
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
            <a
              href={VABILO_MAILTO}
              className="col-span-2 rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-center font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/30"
              onClick={() => setOdprt(false)}
            >
              ✉️ Povabi prijatelja
            </a>
          </div>
        )}
      </nav>
    </header>
  )
}
