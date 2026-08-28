import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/useAuth'
import Navbar from './components/Navbar'
import Domov from './pages/Domov'
import Igralci from './pages/Igralci'
import Igralec from './pages/Igralec'
import Lestvica from './pages/Lestvica'
import Prijava from './pages/Prijava'
import MojaEkipa from './pages/MojaEkipa'
import Glasovanje from './pages/Glasovanje'
import Pozicije from './pages/Pozicije'
import Administracija from './pages/Administracija'

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Domov />} />
            <Route path="/moja-ekipa" element={<MojaEkipa />} />
            <Route path="/glasovanje" element={<Glasovanje />} />
            <Route path="/pozicije" element={<Pozicije />} />
            <Route path="/igralci" element={<Igralci />} />
            <Route path="/igralec/:id" element={<Igralec />} />
            <Route path="/lestvica" element={<Lestvica />} />
            <Route path="/prijava" element={<Prijava />} />
            <Route path="/admin" element={<Administracija />} />
            <Route
              path="*"
              element={<p className="text-slate-400">Stran ne obstaja.</p>}
            />
          </Routes>
        </main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-600">
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
    </AuthProvider>
  )
}
