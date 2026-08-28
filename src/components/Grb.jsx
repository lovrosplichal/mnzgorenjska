// Grb kluba. Če klub nima logotipa, narišemo ščit z začetnicami — barva izhaja
// iz imena, tako da ima vsak klub svojo in je enaka povsod v aplikaciji.

const BARVE = [
  ['#38bdf8', '#0c4a6e'],
  ['#34d399', '#065f46'],
  ['#fbbf24', '#78350f'],
  ['#fb7185', '#881337'],
  ['#a78bfa', '#4c1d95'],
  ['#f472b6', '#831843'],
  ['#facc15', '#713f12'],
  ['#4ade80', '#14532d'],
  ['#60a5fa', '#1e3a8a'],
  ['#fdba74', '#7c2d12'],
]

function barvaKluba(ime = '') {
  let vsota = 0
  for (let i = 0; i < ime.length; i++) vsota = (vsota + ime.charCodeAt(i)) % 997
  return BARVE[vsota % BARVE.length]
}

function zacetnice(ime = '', kratko) {
  if (kratko) return kratko.slice(0, 3).toUpperCase()
  return ime
    .split(/\s+/)
    .filter((d) => /[a-zčšžA-ZČŠŽ0-9]/.test(d))
    .map((d) => d[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)
}

export default function Grb({ ime, kratko, logo, velikost = 20, naslov }) {
  const opis = naslov ?? ime ?? 'klub'

  if (logo)
    return (
      <img
        src={logo}
        alt={opis}
        title={opis}
        width={velikost}
        height={velikost}
        loading="lazy"
        className="shrink-0 rounded object-contain"
        style={{ width: velikost, height: velikost }}
      />
    )

  const [svetla, temna] = barvaKluba(ime)
  const crke = zacetnice(ime, kratko)
  return (
    <svg
      viewBox="0 0 32 36"
      width={velikost}
      height={velikost}
      title={opis}
      aria-label={opis}
      role="img"
      className="shrink-0"
      style={{ width: velikost, height: velikost }}
    >
      <path
        d="M2 2 H30 V20 C30 28 22 33 16 35 C10 33 2 28 2 20 Z"
        fill={temna}
        stroke={svetla}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <text
        x="16"
        y="20"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={svetla}
        fontSize={crke.length > 2 ? 11 : 14}
        fontWeight="800"
        fontFamily="Inter, Segoe UI, system-ui, sans-serif"
      >
        {crke}
      </text>
    </svg>
  )
}
