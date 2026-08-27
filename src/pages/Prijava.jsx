import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function Prijava() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [nacin, setNacin] = useState('prijava') // 'prijava' | 'registracija'
  const [email, setEmail] = useState('')
  const [geslo, setGeslo] = useState('')
  const [ime, setIme] = useState('')
  const [napaka, setNapaka] = useState(null)
  const [posiljam, setPosiljam] = useState(false)

  async function poslji(e) {
    e.preventDefault()
    setNapaka(null)
    setPosiljam(true)

    const { error } =
      nacin === 'registracija'
        ? await supabase.auth.signUp({
            email,
            password: geslo,
            options: { data: { display_name: ime || email.split('@')[0] } },
          })
        : await supabase.auth.signInWithPassword({ email, password: geslo })

    setPosiljam(false)
    if (error) setNapaka(error.message)
    else navigate('/moja-ekipa')
  }

  if (session)
    return (
      <p className="text-slate-600">Prijavljen si kot {session.user.email}.</p>
    )

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">
        {nacin === 'registracija' ? 'Registracija' : 'Prijava'}
      </h1>

      <form onSubmit={poslji} className="space-y-3">
        {nacin === 'registracija' && (
          <label className="block text-sm text-slate-600">
            Prikazno ime
            <input
              value={ime}
              onChange={(e) => setIme(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        )}
        <label className="block text-sm text-slate-600">
          E-pošta
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-600">
          Geslo
          <input
            type="password"
            required
            minLength={6}
            value={geslo}
            onChange={(e) => setGeslo(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={posiljam}
          className="w-full rounded bg-gnl-600 px-4 py-2 text-white hover:bg-gnl-700 disabled:opacity-50"
        >
          {posiljam
            ? 'Pošiljam …'
            : nacin === 'registracija'
              ? 'Ustvari račun'
              : 'Prijava'}
        </button>
        {napaka && <p className="text-sm text-red-600">{napaka}</p>}
      </form>

      <button
        onClick={() => {
          setNacin(nacin === 'prijava' ? 'registracija' : 'prijava')
          setNapaka(null)
        }}
        className="text-sm text-gnl-600 hover:underline"
      >
        {nacin === 'prijava'
          ? 'Nimaš računa? Registriraj se'
          : 'Že imaš račun? Prijavi se'}
      </button>
    </div>
  )
}
