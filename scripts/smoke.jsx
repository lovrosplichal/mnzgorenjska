// Preveri, da se vse strani izrišejo brez napake (brez brskalnika).
// Zaganja se prek: npm run smoke
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AuthProvider } from '../src/lib/useAuth'
import Navbar from '../src/components/Navbar'
import Domov from '../src/pages/Domov'
import Igralci from '../src/pages/Igralci'
import Lestvica from '../src/pages/Lestvica'
import Prijava from '../src/pages/Prijava'
import MojaEkipa from '../src/pages/MojaEkipa'
import Glasovanje from '../src/pages/Glasovanje'
import Administracija from '../src/pages/Administracija'
import { preveriEkipo, VELIKOST_EKIPE } from '../src/lib/pravila'

const strani = [
  ['Navbar', Navbar, '/'],
  ['Domov', Domov, '/'],
  ['Moja ekipa', MojaEkipa, '/moja-ekipa'],
  ['Glasovanje', Glasovanje, '/glasovanje'],
  ['Igralci', Igralci, '/igralci'],
  ['Lestvica', Lestvica, '/lestvica'],
  ['Prijava', Prijava, '/prijava'],
  ['Administracija', Administracija, '/admin'],
]

let napak = 0

for (const [ime, Komponenta, pot] of strani) {
  try {
    const html = renderToString(
      <StaticRouter location={pot}>
        <AuthProvider>
          <Komponenta />
        </AuthProvider>
      </StaticRouter>,
    )
    if (!html || html.length === 0) throw new Error('prazen izris')
    console.log(`PASS  izris: ${ime} (${html.length} znakov)`)
  } catch (e) {
    console.log(`FAIL  izris: ${ime} — ${e.message}`)
    napak++
  }
}

// --- logika pravil ekipe ---------------------------------------------------
const igralec = (id, position, team_id, is_starter) => ({
  id,
  position,
  team_id,
  is_starter,
})

const veljavna = [
  igralec(1, 'GK', 1, true),
  ...[2, 3, 4, 5].map((i) => igralec(i, 'DEF', i, true)),
  ...[6, 7, 8, 9].map((i) => igralec(i, 'MID', i, true)),
  ...[10, 11].map((i) => igralec(i, 'FWD', i, true)),
  igralec(12, 'GK', 6, false),
  igralec(13, 'DEF', 7, false),
  igralec(14, 'MID', 8, false),
  igralec(15, 'FWD', 2, false),
]

const preveri = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) napak++
}

preveri(
  'pravila: veljavna ekipa nima napak',
  preveriEkipo(veljavna).length === 0,
  preveriEkipo(veljavna).join(' | '),
)
preveri(
  'pravila: premajhna ekipa je zavrnjena',
  preveriEkipo(veljavna.slice(0, 10)).length > 0,
)
preveri(
  'pravila: 2 vratarja v prvi postavi sta zavrnjena',
  preveriEkipo(
    veljavna.map((i) => (i.id === 12 ? { ...i, is_starter: true } : i)),
  ).length > 0,
)
preveri(
  'pravila: 4 igralci iz istega kluba so zavrnjeni',
  preveriEkipo(veljavna.map((i) => ({ ...i, team_id: 1 }))).some((n) =>
    n.includes('istega kluba'),
  ),
)
preveri('pravila: velikost ekipe je 15', VELIKOST_EKIPE === 15)

console.log(napak === 0 ? '\nVSE OK' : `\n${napak} NAPAK`)
process.exit(napak === 0 ? 0 : 1)
