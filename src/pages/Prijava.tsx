import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

type Nacin = 'prijava' | 'registracija' | 'pozabljeno'

export default function Prijava() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [nacin, setNacin] = useState<Nacin>('prijava')
  const [email, setEmail] = useState('')
  const [geslo, setGeslo] = useState('')
  const [ime, setIme] = useState('')
  const [napaka, setNapaka] = useState<string | null>(null)
  const [sporocilo, setSporocilo] = useState<string | null>(null)
  const [posiljam, setPosiljam] = useState(false)

  async function poslji(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setNapaka(null)
    setSporocilo(null)
    setPosiljam(true)

    // Ponastavitev gesla pošlje povezavo na e-pošto; uporabnik se vrne na
    // /novo-geslo, kjer vpiše novo.
    if (nacin === 'pozabljeno') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/novo-geslo`,
      })
      setPosiljam(false)
      if (error) return setNapaka(error.message)
      return setSporocilo(
        'Poslali smo ti povezavo za ponastavitev gesla. Preveri e-pošto (tudi vsiljeno).',
      )
    }

    const { error } =
      nacin === 'registracija'
        ? await supabase.auth.signUp({
            email,
            password: geslo,
            options: {
              data: { display_name: ime || email.split('@')[0] },
              emailRedirectTo: `${window.location.origin}/moja-ekipa`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password: geslo })

    setPosiljam(false)
    if (error) return setNapaka(error.message)
    if (nacin === 'registracija')
      return setSporocilo(
        'Račun je ustvarjen. Na e-pošto smo poslali potrditveno povezavo — odpri jo in se vrni.',
      )
    navigate('/moja-ekipa')
  }

  if (session)
    return (
      <p className="text-slate-300">Prijavljen si kot {session.user.email}.</p>
    )

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-3xl font-black naslov">
        {nacin === 'registracija'
          ? 'Registracija'
          : nacin === 'pozabljeno'
            ? 'Pozabljeno geslo'
            : 'Prijava'}
      </h1>

      <form onSubmit={poslji} className="space-y-3">
        {nacin === 'registracija' && (
          <label className="block text-sm text-slate-400">
            Prikazno ime
            <input
              value={ime}
              onChange={(e) => setIme(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
            />
          </label>
        )}
        <label className="block text-sm text-slate-400">
          E-pošta
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
          />
        </label>
        {nacin !== 'pozabljeno' && (
          <label className="block text-sm text-slate-400">
            Geslo
            <input
              type="password"
              required
              minLength={6}
              value={geslo}
              onChange={(e) => setGeslo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={posiljam}
          className="gumb-glavni w-full"
        >
          {posiljam
            ? 'Pošiljam …'
            : nacin === 'registracija'
              ? 'Ustvari račun'
              : nacin === 'pozabljeno'
                ? 'Pošlji povezavo'
                : 'Prijava'}
        </button>
        {napaka && <p className="text-sm text-rose-400">{napaka}</p>}
        {sporocilo && <p className="text-sm text-gnl-300">{sporocilo}</p>}
      </form>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => {
            setNacin(nacin === 'registracija' ? 'prijava' : 'registracija')
            setNapaka(null)
            setSporocilo(null)
          }}
          className="text-left text-sm text-gnl-300 hover:underline"
        >
          {nacin === 'registracija'
            ? 'Že imaš račun? Prijavi se'
            : 'Nimaš računa? Registriraj se'}
        </button>
        {nacin !== 'pozabljeno' ? (
          <button
            onClick={() => {
              setNacin('pozabljeno')
              setNapaka(null)
              setSporocilo(null)
            }}
            className="text-left text-sm text-slate-400 hover:underline"
          >
            Pozabljeno geslo?
          </button>
        ) : (
          <button
            onClick={() => {
              setNacin('prijava')
              setNapaka(null)
              setSporocilo(null)
            }}
            className="text-left text-sm text-slate-400 hover:underline"
          >
            ← Nazaj na prijavo
          </button>
        )}
      </div>
    </div>
  )
}
