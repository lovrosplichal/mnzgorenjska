import { Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './lib/useAuth'
import { TekmovanjeProvider } from './lib/tekmovanje'
import Navbar from './components/Navbar'
import RokKroga from './components/RokKroga'
import OpozoriloEkipe from './components/OpozoriloEkipe'
import Domov from './pages/Domov'
import Igralci from './pages/Igralci'
import Igralec from './pages/Igralec'
import Lestvica from './pages/Lestvica'
import Rezultati from './pages/Rezultati'
import Tekma from './pages/Tekma'
import Prijava from './pages/Prijava'
import NovoGeslo from './pages/NovoGeslo'
import Pravno from './pages/Pravno'
import MojaEkipa from './pages/MojaEkipa'
import Glasovanje from './pages/Glasovanje'
import Pozicije from './pages/Pozicije'
import Administracija from './pages/Administracija'

export default function App() {
  return (
    <AuthProvider>
      <TekmovanjeProvider>
        <div className="min-h-screen overflow-x-hidden">
          <RokKroga />
          <Navbar />
          <OpozoriloEkipe />
          <main className="mx-auto max-w-5xl px-4 py-8">
            <Routes>
              <Route path="/" element={<Domov />} />
              <Route path="/moja-ekipa" element={<MojaEkipa />} />
              <Route path="/glasovanje" element={<Glasovanje />} />
              <Route path="/pozicije" element={<Pozicije />} />
              <Route path="/igralci" element={<Igralci />} />
              <Route path="/igralec/:id" element={<Igralec />} />
              <Route path="/lestvica" element={<Lestvica />} />
              <Route path="/rezultati" element={<Rezultati />} />
              <Route path="/tekma/:id" element={<Tekma />} />
              <Route path="/prijava" element={<Prijava />} />
              <Route path="/novo-geslo" element={<NovoGeslo />} />
              <Route path="/pravno" element={<Pravno />} />
              <Route path="/admin" element={<Administracija />} />
              <Route
                path="*"
                element={<p className="text-slate-400">Stran ne obstaja.</p>}
              />
            </Routes>
          </main>
          <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-600">
            <Link to="/pravno" className="underline hover:text-slate-400">
              Zasebnost in pogoji
            </Link>
            {' · '}
            Podatki: uradni zapisniki{' '}
            <a
              href="https://www.mnzgkranj.si/"
              className="underline hover:text-slate-400"
              target="_blank"
              rel="noreferrer"
            >
              MNZ Gorenjska Kranj
            </a>
          </footer>
        </div>
      </TekmovanjeProvider>
    </AuthProvider>
  )
}
