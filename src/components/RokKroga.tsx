import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTekmovanje } from '../lib/tekmovanje'

/** Vrstica pogleda `naslednji_krog` — prvi krog, ki se še ni zaklenil. */
interface NaslednjiKrog {
  number: number
  season: string
  played_on: string | null
  deadline_at: string | null
}

/**
 * Pas nad glavo strani z odštevanjem do naslednjega zaklepa.
 *
 * Rok je edini trenutek, ki v tej igri res šteje: kar imaš ob njem, s tem
 * greš v krog. Zato stoji na vrhu vsake strani, ne le v Moji ekipi.
 *
 * Zadnjo uro odšteva po sekundah, prej po minutah — sekundna natančnost je
 * takrat, ko je res pomembna, sicer pa bi le po nepotrebnem risala.
 */
function razdeli(ms: number) {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return { d, h, m, s }
}

function niz(ms: number) {
  const { d, h, m, s } = razdeli(ms)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`
  return `${s} s`
}

export default function RokKroga() {
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [krog, setKrog] = useState<NaslednjiKrog | null>(null)
  const [zdaj, setZdaj] = useState(() => Date.now())
  // Ko rok poteče, je "naslednji krog" že drug — osvežimo, da pas ne obtiči
  // na zaklenjenem, dokler kdo ne naloži strani znova.
  const [osvezitev, setOsvezitev] = useState(0)

  useEffect(() => {
    if (!tekmovanjeId) return
    let odjava = false
    supabase
      .from('naslednji_krog')
      .select('number, season, played_on, deadline_at')
      .eq('competition_id', tekmovanjeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!odjava) setKrog((data as NaslednjiKrog | null) ?? null)
      })
    return () => {
      odjava = true
    }
  }, [tekmovanjeId, osvezitev])

  const rok = krog?.deadline_at ? new Date(krog.deadline_at).getTime() : null
  const preostanek = rok ? rok - zdaj : null
  const zapadel = preostanek != null && preostanek <= 0
  // Zadnjo uro tiktaka po sekundah, sicer vsakih pol minute.
  const hitro = preostanek != null && preostanek < 3600000

  useEffect(() => {
    if (rok == null || zapadel) return
    const id = setInterval(() => setZdaj(Date.now()), hitro ? 1000 : 30000)
    return () => clearInterval(id)
  }, [rok, hitro, zapadel])

  useEffect(() => {
    if (!zapadel) return
    const id = setTimeout(() => setOsvezitev((n) => n + 1), 60000)
    return () => clearTimeout(id)
  }, [zapadel])

  if (!krog?.deadline_at || preostanek == null) return null

  const nujno = !zapadel && preostanek < 2 * 3600000 // manj kot 2 uri
  const blizu = !zapadel && !nujno && preostanek < 24 * 3600000

  const slog = zapadel
    ? 'bg-slate-800/60 text-slate-400'
    : nujno
      ? 'bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/30'
      : blizu
        ? 'bg-amber-400/15 text-amber-100 ring-1 ring-inset ring-amber-400/30'
        : 'bg-gnl-500/10 text-gnl-100 ring-1 ring-inset ring-gnl-400/20'

  const datum = new Date(krog.deadline_at).toLocaleString('sl-SI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={slog}>
      <Link
        to="/moja-ekipa"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center
                   gap-x-2 gap-y-0.5 px-4 py-1.5 text-xs sm:text-sm"
        title={`Zaklep ${krog.number}. kroga: ${datum}`}
      >
        <span className="font-semibold">
          {tekmovanje?.short_name ?? ''} · {krog.number}. krog
        </span>
        {zapadel ? (
          <span>zaklenjen — postave ni več mogoče spreminjati</span>
        ) : (
          <>
            <span className="opacity-80">zaklep čez</span>
            <strong className="tabular-nums">{niz(preostanek)}</strong>
            <span className="hidden opacity-60 sm:inline">({datum})</span>
          </>
        )}
      </Link>
    </div>
  )
}
