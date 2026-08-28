// Preveri, da se vse strani izrišejo brez napake, in da točkovanje
// natanko sledi pravilom lige. Brez brskalnika in brez baze.
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
import Pozicije from '../src/pages/Pozicije'
import Administracija from '../src/pages/Administracija'
import {
  preveriEkipo,
  lahkoZacne,
  zakajNeGre,
  VELIKOST_EKIPE,
  PRORACUN,
  POZICIJE,
  KAPETAN_MNOZITELJ,
} from '../src/lib/pravila'
import { tockeZaNastop } from '../src/lib/tockovanje'

let napak = 0
const preveri = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) napak++
}

// --- izris strani ----------------------------------------------------------
const strani = [
  ['Navbar', Navbar, '/'],
  ['Domov', Domov, '/'],
  ['Moja ekipa', MojaEkipa, '/moja-ekipa'],
  ['Asistence', Glasovanje, '/glasovanje'],
  ['Pozicije', Pozicije, '/pozicije'],
  ['Igralci', Igralci, '/igralci'],
  ['Lestvica', Lestvica, '/lestvica'],
  ['Prijava', Prijava, '/prijava'],
  ['Administracija', Administracija, '/admin'],
]

for (const [ime, Komponenta, pot] of strani) {
  try {
    const html = renderToString(
      <StaticRouter location={pot}>
        <AuthProvider>
          <Komponenta />
        </AuthProvider>
      </StaticRouter>,
    )
    preveri(`izris: ${ime}`, Boolean(html && html.length))
  } catch (e) {
    preveri(`izris: ${ime}`, false, e.message)
  }
}

// --- točkovanje ------------------------------------------------------------
const nastop = (o = {}) => ({
  minute: 90,
  goli: 0,
  asistence: 0,
  cleanSheet: false,
  prejetiGoli: 0,
  obranjeneEnajstmetrovke: 0,
  zgreseneEnajstmetrovke: 0,
  avtogoli: 0,
  rumeni: 0,
  rdeci: 0,
  ...o,
})

const t = (o, poz) => tockeZaNastop(nastop(o), poz).skupaj

console.log('')
preveri('ni nastopa = 0 točk', t({ minute: 0 }, 'MID') === 0)
preveri('nastop do 60 minut = 1', t({ minute: 59 }, 'MID') === 1)
preveri('nastop 60 minut = 2', t({ minute: 60 }, 'MID') === 2)
preveri('nastop 90 minut = 2', t({ minute: 90 }, 'MID') === 2)

preveri('gol vratarja = 10', t({ goli: 1 }, 'GK') === 2 + 10)
preveri('gol branilca = 6', t({ goli: 1 }, 'DEF') === 2 + 6)
preveri('gol vezista = 5', t({ goli: 1 }, 'MID') === 2 + 5)
preveri('gol napadalca = 4', t({ goli: 1 }, 'FWD') === 2 + 4)
preveri('dva gola vezista = 10', t({ goli: 2 }, 'MID') === 2 + 10)
preveri('asistenca = 3', t({ asistence: 1 }, 'FWD') === 2 + 3)

preveri(
  'clean sheet vratarja = 4',
  t({ cleanSheet: true }, 'GK') === 2 + 4,
)
preveri(
  'clean sheet branilca = 4',
  t({ cleanSheet: true }, 'DEF') === 2 + 4,
)
preveri('clean sheet vezista = 1', t({ cleanSheet: true }, 'MID') === 2 + 1)
preveri('clean sheet napadalca = 0', t({ cleanSheet: true }, 'FWD') === 2)
preveri(
  'clean sheet pod 60 minut se ne šteje',
  t({ minute: 45, cleanSheet: true }, 'DEF') === 1,
)

preveri(
  '2 prejeta gola = -1 (vratar)',
  t({ prejetiGoli: 2 }, 'GK') === 2 - 1,
)
preveri(
  '3 prejeti goli = -1 (branilec)',
  t({ prejetiGoli: 3 }, 'DEF') === 2 - 1,
)
preveri(
  '4 prejeti goli = -2 (vratar)',
  t({ prejetiGoli: 4 }, 'GK') === 2 - 2,
)
preveri(
  'prejeti goli ne kaznujejo vezista',
  t({ prejetiGoli: 4 }, 'MID') === 2,
)

preveri(
  'obranjena enajstmetrovka = 5',
  t({ obranjeneEnajstmetrovke: 1 }, 'GK') === 2 + 5,
)
preveri(
  'zgrešena enajstmetrovka = -2',
  t({ zgreseneEnajstmetrovke: 1 }, 'FWD') === 2 - 2,
)
preveri('avtogol = -2', t({ avtogoli: 1 }, 'DEF') === 2 - 2)
preveri('rumeni karton = -1', t({ rumeni: 1 }, 'MID') === 2 - 1)
preveri('rdeči karton = -3', t({ rdeci: 1 }, 'MID') === 2 - 3)

// sestavljen primer: branilec, 90 min, gol, clean sheet, rumeni karton
preveri(
  'sestavljen primer: 2+6+4-1 = 11',
  t({ goli: 1, cleanSheet: true, rumeni: 1 }, 'DEF') === 11,
)

// --- pravila ekipe ---------------------------------------------------------
console.log('')
const igralec = (id, position, team_id, is_starter, value = 5) => ({
  id,
  position,
  team_id,
  is_starter,
  value,
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
].map((i) => ({
  ...i,
  is_captain: i.id === 10,
  is_vice: i.id === 11,
}))

preveri(
  'veljavna ekipa nima napak',
  preveriEkipo(veljavna, 100).length === 0,
  preveriEkipo(veljavna, 100).join(' | '),
)
preveri('velikost ekipe je 15', VELIKOST_EKIPE === 15)
preveri('privzet proračun je 100', PRORACUN === 100)
preveri(
  'premajhna ekipa je zavrnjena',
  preveriEkipo(veljavna.slice(0, 10), 100).length > 0,
)
preveri(
  '2 vratarja v prvi postavi sta zavrnjena',
  preveriEkipo(
    veljavna.map((i) => (i.id === 12 ? { ...i, is_starter: true } : i)),
    100,
  ).length > 0,
)
preveri(
  '4 igralci iz istega kluba so zavrnjeni',
  preveriEkipo(veljavna.map((i) => ({ ...i, team_id: 1 })), 100).some((n) =>
    n.includes('istega kluba'),
  ),
)
preveri(
  'presežen proračun je zavrnjen',
  preveriEkipo(veljavna, 50).some((n) => n.includes('proračun')),
)
preveri(
  'igralec brez pozicije sproži opozorilo',
  preveriEkipo(
    veljavna.map((i) => (i.id === 5 ? { ...i, position: null } : i)),
    100,
  ).some((n) => n.includes('pozicije')),
)

// --- kvote kadra, trak in menjave -----------------------------------------
preveri(
  'kvota kadra je 2-5-5-3',
  POZICIJE.GK.kader === 2 &&
    POZICIJE.DEF.kader === 5 &&
    POZICIJE.MID.kader === 5 &&
    POZICIJE.FWD.kader === 3,
)
preveri(
  'kader s 4 branilci je zavrnjen',
  preveriEkipo(
    veljavna.map((i) => (i.id === 13 ? { ...i, position: 'MID' } : i)),
    100,
  ).some((n) => n.includes('v kadru')),
)
preveri('kapetan prinese trojne točke', KAPETAN_MNOZITELJ === 3)
preveri(
  'ekipa brez kapetana je zavrnjena',
  preveriEkipo(
    veljavna.map((i) => ({ ...i, is_captain: false })),
    100,
  ).some((n) => n.includes('kapetana')),
)
preveri(
  'dva kapetana sta zavrnjena',
  preveriEkipo(
    veljavna.map((i) => (i.id === 11 ? { ...i, is_captain: true } : i)),
    100,
  ).some((n) => n.includes('Kapetan')),
)

const prviIzVeljavne = veljavna.filter((i) => i.is_starter)
preveri(
  'šesti branilec ne more v postavo',
  lahkoZacne('DEF', prviIzVeljavne) === false,
)
preveri(
  'drugi vratar ne more v postavo',
  lahkoZacne('GK', prviIzVeljavne) === false,
)
preveri(
  'v postavo z desetimi gre še napadalec',
  lahkoZacne('FWD', prviIzVeljavne.slice(0, 10)) === true,
)
preveri(
  'zadnje mesto v postavi pripada manjkajočemu vratarju',
  lahkoZacne(
    'MID',
    prviIzVeljavne.filter((i) => i.position !== 'GK').slice(0, 10),
  ) === false,
)

preveri(
  'igralec šestega kluba se doda',
  zakajNeGre(
    { id: 99, position: 'FWD', team_id: 42, value: 5 },
    veljavna.slice(0, 14),
    50,
  ) === null,
)
preveri(
  'četrti igralec istega kluba je zavrnjen',
  (zakajNeGre(
    { id: 99, position: 'FWD', team_id: 1, value: 5 },
    veljavna.slice(0, 14).map((i) => ({ ...i, team_id: 1 })),
    50,
  ) ?? '').includes('kluba'),
)
preveri(
  'presežena kvota pozicije je zavrnjena',
  (zakajNeGre({ id: 99, position: 'GK', team_id: 42, value: 5 }, veljavna.slice(0, 14), 50) ??
    '').includes('kadru'),
)

console.log(napak === 0 ? '\nVSE OK' : `\n${napak} NAPAK`)
process.exit(napak === 0 ? 0 : 1)
