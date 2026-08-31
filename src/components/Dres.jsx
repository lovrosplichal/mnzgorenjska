// Dres v barvi pozicije. Isti znak nosita igrišče pri sestavi ekipe in igrišče
// s točkami ob rezultatu tekme, zato živi v svoji datoteki.

const BARVA_DRESA = {
  GK: { dres: '#fbbf24', rokav: '#d97706' },
  DEF: { dres: '#38bdf8', rokav: '#0284c7' },
  MID: { dres: '#34d399', rokav: '#059669' },
  FWD: { dres: '#fb7185', rokav: '#e11d48' },
}

export default function Dres({ pozicija, razred = 'h-7 w-8 sm:h-9 sm:w-10' }) {
  const barva = BARVA_DRESA[pozicija] ?? { dres: '#94a3b8', rokav: '#475569' }
  return (
    <svg
      viewBox="0 0 48 44"
      className={`drop-shadow ${razred}`}
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
