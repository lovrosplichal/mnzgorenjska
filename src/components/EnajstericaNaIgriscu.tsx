// Prikaz idealne enajsterice na risanem igrišču. Podobno videzu Igrisca v
// Moji ekipi, ampak le za pregled — brez interakcije, s točkami namesto cene.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { prikazniIme, formatirajTocke } from '../lib/pomozno'
import { VRSTNI_RED } from '../lib/pravila'
import type { Pozicija } from '../lib/tipi'
import Grb from './Grb'
import Dres from './Dres'

/** Igralec v idealni enajsterici; pogledi ga vrnejo z `player_id` ali `id`. */
export interface IgralecEnajsterice {
  id?: number | string
  player_id?: number | string
  full_name?: string | null
  position?: Pozicija | null
  points?: number | string | null
  team_name?: string | null
  team_short?: string | null
  team_logo?: string | null
}

function KarticaIgralca({ igralec }: { igralec: IgralecEnajsterice }) {
  return (
    <Link
      to={`/igralec/${igralec.player_id ?? igralec.id}`}
      className="group relative w-[3.6rem] text-center transition sm:w-[5rem]"
    >
      <div className="flex justify-center">
        <Dres pozicija={igralec.position} razred="h-8 w-9 sm:h-10 sm:w-11" />
      </div>
      <div className="mt-0.5 truncate rounded-t-md bg-slate-900/90 px-1 py-0.5 text-[10px] font-semibold leading-tight text-slate-100 sm:text-[11px]">
        {prikazniIme(igralec.full_name).split(' ').slice(-1)[0]}
      </div>
      <div className="flex items-center justify-center gap-1 rounded-b-md bg-gnl-500/90 px-1 py-0.5 text-[10px] font-black leading-tight tabular-nums text-slate-950 sm:text-[11px]">
        <Grb
          ime={igralec.team_name}
          kratko={igralec.team_short}
          logo={igralec.team_logo}
          velikost={11}
        />
        {formatirajTocke(igralec.points)}
      </div>
    </Link>
  )
}

const Vrsta = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-start justify-center gap-1.5 sm:gap-3">
    {children}
  </div>
)

export default function EnajstericaNaIgriscu({
  igralci,
}: {
  igralci: IgralecEnajsterice[]
}) {
  const vrste: Record<Pozicija, IgralecEnajsterice[]> = {
    GK: igralci.filter((i) => i.position === 'GK'),
    DEF: igralci.filter((i) => i.position === 'DEF'),
    MID: igralci.filter((i) => i.position === 'MID'),
    FWD: igralci.filter((i) => i.position === 'FWD'),
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#14603f] to-[#0b3d2e] p-2 shadow-xl shadow-black/30 sm:rounded-3xl sm:p-4">
      <div className="igrisce pointer-events-none absolute inset-0" />
      {/* črte igrišča */}
      <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/20 sm:inset-3 sm:rounded-xl" />
      <div className="pointer-events-none absolute left-1/2 top-2 h-16 w-32 -translate-x-1/2 rounded-b-lg border-x-2 border-b-2 border-white/20 sm:top-3 sm:h-24 sm:w-48" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-0.5 w-[calc(100%-1rem)] -translate-x-1/2 bg-white/20 sm:bottom-3 sm:w-[calc(100%-1.5rem)]" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-14 w-14 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/20 sm:bottom-3 sm:h-20 sm:w-20" />

      <div className="relative space-y-3 py-2 sm:space-y-4 sm:py-4">
        {VRSTNI_RED.map((koda) => (
          <Vrsta key={koda}>
            {vrste[koda].map((i) => (
              <KarticaIgralca key={i.player_id ?? i.id} igralec={i} />
            ))}
          </Vrsta>
        ))}
      </div>
    </div>
  )
}
