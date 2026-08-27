import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/useAuth'
import Navbar from './components/Navbar'
import Domov from './pages/Domov'
import Igralci from './pages/Igralci'
import Lestvica from './pages/Lestvica'
import Prijava from './pages/Prijava'
import MojaEkipa from './pages/MojaEkipa'
import Glasovanje from './pages/Glasovanje'
import Administracija from './pages/Administracija'

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Domov />} />
            <Route path="/moja-ekipa" element={<MojaEkipa />} />
            <Route path="/glasovanje" element={<Glasovanje />} />
            <Route path="/igralci" element={<Igralci />} />
            <Route path="/lestvica" element={<Lestvica />} />
            <Route path="/prijava" element={<Prijava />} />
            <Route path="/admin" element={<Administracija />} />
            <Route
              path="*"
              element={<p className="text-slate-600">Stran ne obstaja.</p>}
            />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}
