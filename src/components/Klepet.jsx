import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

// Anonimni klepet — sporočila so javna, avtor pa skrit za psevdonimom, ki se
// deterministično izpelje iz user_id, tako da ista oseba vedno "govori" kot
// isti psevdonim (npr. "Modri Napadalec 42"). Prijavljen mora biti, da lahko
// objavi (proti spam-u), a njegovega imena nihče ne vidi.

const PRIDEVNIKI = [
  'Modri', 'Rdeči', 'Zeleni', 'Rumeni', 'Črni', 'Beli', 'Srebrni', 'Zlati',
  'Hitri', 'Divji', 'Tihi', 'Ognjeni', 'Ledeni', 'Nočni', 'Jutranji',
  'Železni', 'Bakreni', 'Sončni', 'Nebeški', 'Brezčutni',
]
const SAMOSTALNIKI = [
  'Vratar', 'Branilec', 'Vezist', 'Napadalec', 'Kapetan', 'Sodnik', 'Trener',
  'Navijač', 'Strelec', 'Podajalec', 'Rezervist', 'Vekar', 'Junak', 'Volk',
  'Orel', 'Zmaj', 'Bik', 'Konj', 'Sokol', 'Ris',
]

function stringHash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return Math.abs(h)
}

export function psevdonim(userId) {
  if (!userId) return 'Gost'
  const h = stringHash(userId)
  const p = PRIDEVNIKI[h % PRIDEVNIKI.length]
  const s = SAMOSTALNIKI[Math.floor(h / PRIDEVNIKI.length) % SAMOSTALNIKI.length]
  const st = h % 100
  return `${p} ${s} ${st}`
}

function relativniCas(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'zdaj'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  if (s < 604800) return `${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'numeric',
  })
}

export default function Klepet() {
  const { session } = useAuth()
  const [sporocila, setSporocila] = useState([])
  const [besedilo, setBesedilo] = useState('')
  const [posiljam, setPosiljam] = useState(false)
  const [napaka, setNapaka] = useState(null)
  const mojPsev = psevdonim(session?.user?.id)

  useEffect(() => {
    let preklican = false
    async function nalozi() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, user_id, content, alias, created_at')
        .order('created_at', { ascending: false })
        .limit(30)
      if (preklican) return
      if (error) setNapaka(error.message)
      else setSporocila((data ?? []).reverse())
    }
    nalozi()
    // Vsakih 20 s osveži — realtime bi bil boljši, a to zadošča za začetek.
    const id = setInterval(nalozi, 20000)
    return () => {
      preklican = true
      clearInterval(id)
    }
  }, [])

  async function posljem(e) {
    e.preventDefault()
    if (!session) return setNapaka('Za objavo se moraš prijaviti.')
    const t = besedilo.trim()
    if (!t) return
    if (t.length > 500)
      return setNapaka('Sporočilo je predolgo (največ 500 znakov).')
    setPosiljam(true)
    setNapaka(null)
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ user_id: session.user.id, content: t, alias: mojPsev })
      .select('id, user_id, content, alias, created_at')
      .single()
    setPosiljam(false)
    if (error) return setNapaka(error.message)
    setSporocila([...sporocila, data])
    setBesedilo('')
  }

  async function izbrisi(id) {
    if (!confirm('Izbrišem sporočilo?')) return
    const { error } = await supabase.from('chat_messages').delete().eq('id', id)
    if (error) return setNapaka(error.message)
    setSporocila(sporocila.filter((s) => s.id !== id))
  }

  return (
    <section className="kartica space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Klepet</h2>
        <span className="text-xs text-slate-500">
          {session ? (
            <>
              tvoje ime v klepetu:{' '}
              <strong className="text-slate-300">{mojPsev}</strong>
            </>
          ) : (
            'anonimno · za objavo se prijavi'
          )}
        </span>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-2">
        {sporocila.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Bodi prvi, ki napiše sporočilo.
          </p>
        ) : (
          sporocila.map((s) => {
            const mojeSporocilo = session?.user?.id === s.user_id
            return (
              <div
                key={s.id}
                className={`rounded-lg p-2 text-sm ${
                  mojeSporocilo
                    ? 'ml-6 bg-gnl-500/10 ring-1 ring-gnl-400/30'
                    : 'mr-6 bg-white/5'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-bold text-gnl-300">{s.alias}</span>
                  <span className="text-slate-500">
                    {relativniCas(s.created_at)}
                    {mojeSporocilo && (
                      <button
                        onClick={() => izbrisi(s.id)}
                        className="ml-2 text-slate-500 hover:text-rose-400"
                        title="Izbriši sporočilo"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-slate-200">
                  {s.content}
                </p>
              </div>
            )
          })
        )}
      </div>

      {session ? (
        <form onSubmit={posljem} className="flex gap-2">
          <input
            value={besedilo}
            onChange={(e) => setBesedilo(e.target.value)}
            placeholder="Napiši sporočilo …"
            maxLength={500}
            className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={posiljam || !besedilo.trim()}
            className="gumb-glavni px-4 py-2 text-sm"
          >
            Pošlji
          </button>
        </form>
      ) : (
        <p className="text-center text-xs text-slate-500">
          Za objavo se{' '}
          <a href="/prijava" className="underline hover:text-gnl-300">
            prijavi
          </a>
          .
        </p>
      )}

      {napaka && <p className="text-xs text-rose-400">Napaka: {napaka}</p>}
    </section>
  )
}
