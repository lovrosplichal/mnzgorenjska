// Igrišče z odigrano postavo in točkami — prikaz ene ekipe na eni tekmi.
//
// Za razliko od igrišča pri sestavi ekipe se tu ne da ničesar premikati:
// postava pride iz zapisnika, na dresu pa piše, koliko točk je igralec na tej
// tekmi zaslužil. Dve takšni igrišči stojita eno ob drugem — domači levo,
// gostje desno.
import { Link } from 'react-router-dom'
import { VRSTNI_RED } from '../lib/pravila'
import { prikazniIme, formatirajTocke } from '../lib/pomozno'
import Dres from './Dres'
import Grb from './Grb'

/** Drobne ikone dogodkov pod dresom — kar je pripeljalo do točk. */
function dogodki(n) {
  const z = []
  for (let i = 0; i < Number(n.goals ?? 0); i++) z.push('⚽')
  for (let i = 0; i < Number(n.assists ?? 0); i++) z.push('🅰️')
  for (let i = 0; i < Number(n.own_goals ?? 0); i++) z.push('🙈')
  for (let i = 0; i < Number(n.penalties_saved ?? 0); i++) z.push('🧤')
  for (let i = 0; i < Number(n.penalties_missed ?? 0); i++) z.push('❌')
  if (Number(n.yellow_cards ?? 0) > 0) z.push('🟨')
  if (Number(n.red_cards ?? 0) > 0) z.push('🟥')
  return z
}

function opisNastopa(n) {
  const deli = [`${n.minutes_played} min`]
  if (Number(n.goals ?? 0) > 0) deli.push(`${n.goals} × gol`)
  if (Number(n.assists ?? 0) > 0) deli.push(`${n.assists} × asistenca`)
  if (n.clean_sheet && n.minutes_played >= 60) deli.push('brez prejetega gola')
  if (Number(n.goals_conceded ?? 0) > 0) deli.push(`prejetih ${n.goals_conceded}`)
  if (Number(n.yellow_cards ?? 0) > 0) deli.push('rumeni karton')
  if (Number(n.red_cards ?? 0) > 0) deli.push('rdeči karton')
  return `${prikazniIme(n.full_name)} — ${deli.join(', ')}`
}

function Kartica({ nastop, zatemnjen }) {
  const tocke = Number(nastop.points ?? 0)
  const znaki = dogodki(nastop)
  return (
    <Link
      to={`/igralec/${nastop.player_id}`}
      title={opisNastopa(nastop)}
      className={`block w-[3.4rem] text-center transition duration-150
                  active:scale-95 lg:w-[4.4rem] lg:hover:-translate-y-0.5 ${
                    zatemnjen ? 'opacity-70' : ''
                  }`}
    >
      <div className="flex justify-center">
        <Dres pozicija={nastop.position} razred="h-7 w-8 lg:h-9 lg:w-10" />
      </div>
      <div className="mt-0.5 truncate rounded-t-md bg-slate-900/90 px-1 py-0.5 text-[10px] font-semibold leading-tight lg:text-[11px]">
        {prikazniIme(nastop.full_name).split(' ').slice(-1)[0]}
      </div>
      <div
        className={`rounded-b-md px-1 py-0.5 text-[10px] font-black leading-tight tabular-nums ${
          tocke > 0
            ? 'bg-gnl-500/90 text-slate-950'
            : tocke < 0
              ? 'bg-rose-500/90 text-slate-950'
              : 'bg-slate-700/90 text-slate-200'
        }`}
      >
        {formatirajTocke(tocke)}
      </div>
      {znaki.length > 0 && (
        <div className="mt-0.5 truncate text-[9px] leading-none">
          {znaki.join('')}
        </div>
      )}
    </Link>
  )
}

const Vrsta = ({ children }) => (
  <div className="flex flex-wrap items-start justify-center gap-1.5 lg:gap-2.5">
    {children}
  </div>
)

export default function IgrisceTocke({ ekipa, nastopi }) {
  const prvi = nastopi.filter((n) => n.started)
  const menjave = nastopi.filter((n) => !n.started)
  const igrale = menjave.filter((n) => Number(n.minutes_played ?? 0) > 0)
  const brezMinut = menjave.filter((n) => !Number(n.minutes_played ?? 0))
  const skupaj = nastopi.reduce((v, n) => v + Number(n.points ?? 0), 0)

  // Postava iz zapisnika je poljubna; kdor nima potrjene pozicije, gre v
  // zadnjo vrsto, da se z igrišča nihče ne izgubi.
  const vrste = VRSTNI_RED.map((koda) => prvi.filter((n) => n.position === koda))
  const brezPozicije = prvi.filter((n) => !VRSTNI_RED.includes(n.position))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Grb ime={ekipa.ime} kratko={ekipa.kratko} logo={ekipa.logo} velikost={26} />
        <h3 className="min-w-0 flex-1 truncate font-bold">{ekipa.ime}</h3>
        <span className="znacka bg-gnl-400/20 text-gnl-200">
          {formatirajTocke(skupaj)} točk
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#14603f] to-[#0b3d2e] p-2 shadow-xl shadow-black/30 sm:rounded-3xl sm:p-3">
        <div className="igrisce pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/20 sm:rounded-xl" />
        <div className="pointer-events-none absolute left-1/2 top-2 h-14 w-28 -translate-x-1/2 rounded-b-lg border-x-2 border-b-2 border-white/20 sm:h-20 sm:w-40" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-0.5 w-[calc(100%-1rem)] -translate-x-1/2 bg-white/20" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-14 w-14 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/20" />

        {prvi.length === 0 ? (
          <p className="relative py-8 text-center text-sm text-white/70">
            Zapisnik za to ekipo ne navaja postave.
          </p>
        ) : (
          <div className="relative space-y-3 py-2 lg:space-y-4 lg:py-3">
            {vrste.map((vrsta, i) =>
              vrsta.length === 0 ? null : (
                <Vrsta key={VRSTNI_RED[i]}>
                  {vrsta.map((n) => (
                    <Kartica key={n.player_id} nastop={n} />
                  ))}
                </Vrsta>
              ),
            )}
            {brezPozicije.length > 0 && (
              <Vrsta>
                {brezPozicije.map((n) => (
                  <Kartica key={n.player_id} nastop={n} />
                ))}
              </Vrsta>
            )}
          </div>
        )}
      </div>

      {menjave.length > 0 && (
        <div className="kartica p-2">
          <h4 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Klop
            {igrale.length > 0 && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">
                — {igrale.length} vstopilo v igro
              </span>
            )}
          </h4>
          <Vrsta>
            {[...igrale, ...brezMinut].map((n) => (
              <Kartica key={n.player_id} nastop={n} zatemnjen={!n.minutes_played} />
            ))}
          </Vrsta>
        </div>
      )}
    </div>
  )
}
