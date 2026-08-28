// Igrišče s prvo postavo in klopjo — razporeditev je enaka kot v Premier
// League Fantasy: v vrsticah od vratarja do napadalcev, pod igriščem pa štirje
// rezervni igralci.
//
// Mere so mobile-first: na telefonu mora vrsta petih branilcev ostati v eni
// vrstici (5 × 3.4rem + razmiki gredo v 360 px), zato so kartice majhne in se
// od `sm` navzgor povečajo.
import { POZICIJE, VRSTNI_RED } from '../lib/pravila'
import { KRATKA_POZICIJA, prikazniIme, formatirajTocke } from '../lib/pomozno'
import Grb from './Grb'

const BARVA_DRESA = {
  GK: { dres: '#fbbf24', rokav: '#d97706' },
  DEF: { dres: '#38bdf8', rokav: '#0284c7' },
  MID: { dres: '#34d399', rokav: '#059669' },
  FWD: { dres: '#fb7185', rokav: '#e11d48' },
}

function Dres({ pozicija }) {
  const barva = BARVA_DRESA[pozicija] ?? { dres: '#94a3b8', rokav: '#475569' }
  return (
    <svg
      viewBox="0 0 48 44"
      className="h-7 w-8 drop-shadow sm:h-9 sm:w-10"
      aria-hidden="true"
    >
      <path
        d="M17 3 L24 7 L31 3 L44 10 L39 19 L34 16 V41 H14 V16 L9 19 L4 10 Z"
        fill={barva.dres}
        stroke={barva.rokav}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 3 L24 10 L31 3" fill="none" stroke={barva.rokav} strokeWidth="2" />
    </svg>
  )
}

function KarticaIgralca({ igralec, naKlik, naOdstrani, zatemnjen }) {
  return (
    <div
      className={`group relative w-[3.4rem] text-center sm:w-[4.75rem] ${
        zatemnjen ? 'opacity-70' : ''
      }`}
    >
      <button
        onClick={naKlik}
        title={
          igralec.is_starter
            ? 'Premakni na klop'
            : 'Uvrsti v prvo postavo'
        }
        className="block w-full transition duration-150 active:scale-95 sm:hover:-translate-y-0.5"
      >
        <div className="flex justify-center">
          <Dres pozicija={igralec.position} />
        </div>
        <div className="mt-0.5 truncate rounded-t-md bg-slate-900/90 px-1 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px]">
          {prikazniIme(igralec.full_name).split(' ').slice(-1)[0]}
        </div>
        <div className="flex items-center justify-center gap-1 rounded-b-md bg-gnl-500/90 px-1 py-0.5 text-[9px] font-bold leading-tight tabular-nums text-slate-950 sm:text-[10px]">
          <Grb
            ime={igralec.team_name}
            kratko={igralec.team_short}
            logo={igralec.team_logo}
            velikost={11}
          />
          {formatirajTocke(igralec.value)}
        </div>
      </button>

      {(igralec.is_captain || igralec.is_vice) && (
        <span
          title={igralec.is_captain ? 'Kapetan — trojne točke' : 'Namestnik kapetana'}
          className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full
                      text-[9px] font-black ring-1 sm:h-5 sm:w-5 sm:text-[10px] ${
                        igralec.is_captain
                          ? 'bg-amber-300 text-slate-950 ring-amber-200'
                          : 'bg-slate-800 text-amber-200 ring-amber-300/40'
                      }`}
        >
          {igralec.is_captain ? 'K' : 'N'}
        </span>
      )}

      {/* Na dotik ni prehoda z miško, zato je gumb za odstranitev vedno viden. */}
      <button
        onClick={naOdstrani}
        title="Odstrani iz kadra"
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full
                   bg-slate-900 text-[10px] text-slate-300 ring-1 ring-white/20
                   hover:text-rose-400 lg:hidden lg:group-hover:flex"
      >
        ✕
      </button>
    </div>
  )
}

function PraznoMesto({ pozicija, naKlik }) {
  return (
    <button
      onClick={() => naKlik(pozicija)}
      title={`Izberi: ${POZICIJE[pozicija].naslov.toLowerCase()}`}
      className="flex h-[3.6rem] w-[3.4rem] flex-col items-center justify-center gap-0.5
                 rounded-lg border-2 border-dashed border-white/25 text-white/60
                 transition active:scale-95 hover:border-gnl-300 hover:bg-white/10
                 hover:text-white sm:h-[4.6rem] sm:w-[4.75rem] sm:gap-1"
    >
      <span className="text-base leading-none sm:text-lg">＋</span>
      <span className="text-[9px] font-bold uppercase tracking-wide sm:text-[10px]">
        {KRATKA_POZICIJA[pozicija]}
      </span>
    </button>
  )
}

const Vrsta = ({ children }) => (
  <div className="flex flex-wrap items-start justify-center gap-1.5 sm:gap-3">
    {children}
  </div>
)

export default function Igrisce({
  izbrani,
  naPreklopPrvo,
  naOdstrani,
  naPraznoMesto,
}) {
  const prvi = izbrani.filter((i) => i.is_starter && i.position)
  const klop = izbrani.filter((i) => !i.is_starter && i.position)
  const neuvrsceni = izbrani.filter((i) => !i.position)

  // Prazna mesta razporedimo tako, da igrišče pokaže privzeto postavo
  // (1-4-4-2), preostanek kadra pa pristane na klopi.
  const manjka = {}
  const naIgriscu = {}
  for (const koda of VRSTNI_RED) {
    const vKadru = izbrani.filter((i) => i.position === koda).length
    manjka[koda] = Math.max(0, POZICIJE[koda].kader - vKadru)
    const vPostavi = prvi.filter((i) => i.position === koda).length
    naIgriscu[koda] = Math.min(
      manjka[koda],
      Math.max(0, POZICIJE[koda].privzeto - vPostavi),
    )
  }

  return (
    <div className="space-y-3">
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
              {prvi
                .filter((i) => i.position === koda)
                .map((i) => (
                  <KarticaIgralca
                    key={i.id}
                    igralec={i}
                    naKlik={() => naPreklopPrvo(i)}
                    naOdstrani={() => naOdstrani(i)}
                  />
                ))}
              {Array.from({ length: naIgriscu[koda] }, (_, n) => (
                <PraznoMesto key={n} pozicija={koda} naKlik={naPraznoMesto} />
              ))}
            </Vrsta>
          ))}
        </div>
      </div>

      {/* klop */}
      <div className="kartica p-2 sm:p-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Klop
        </h3>
        <Vrsta>
          {klop.map((i) => (
            <KarticaIgralca
              key={i.id}
              igralec={i}
              zatemnjen
              naKlik={() => naPreklopPrvo(i)}
              naOdstrani={() => naOdstrani(i)}
            />
          ))}
          {VRSTNI_RED.flatMap((koda) =>
            Array.from({ length: manjka[koda] - naIgriscu[koda] }, (_, n) => (
              <PraznoMesto
                key={`${koda}-${n}`}
                pozicija={koda}
                naKlik={naPraznoMesto}
              />
            )),
          )}
        </Vrsta>
      </div>

      {neuvrsceni.length > 0 && (
        <div className="kartica p-2 sm:p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Brez potrjene pozicije — na igrišče jih ni mogoče postaviti
          </h3>
          <Vrsta>
            {neuvrsceni.map((i) => (
              <KarticaIgralca
                key={i.id}
                igralec={i}
                zatemnjen
                naKlik={() => naPreklopPrvo(i)}
                naOdstrani={() => naOdstrani(i)}
              />
            ))}
          </Vrsta>
        </div>
      )}
    </div>
  )
}
