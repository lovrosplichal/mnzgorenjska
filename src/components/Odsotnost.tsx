// Poročila o odsotnostih in poškodbah — skupne stvari za stran igralca in
// za forum.
//
// Samo informativno: poročilo igralca NE označi za nedosegljivega in ne
// vpliva na sestavo ekipe. Meja je zavestna — če bi vplivalo, bi lažna
// prijava postala orodje proti tekmecu in bi rabili prag glasov, kot ga
// imata asistenca in pozicija.
import type { ReactNode } from 'react'

/** Vrsta poročila; ujema se s `check` v tabeli `player_reports`. */
export type VrstaPorocila = 'poskodba' | 'odsotnost' | 'vrnitev' | 'drugo'

export interface Porocilo {
  id: number
  player_id: number
  user_id: string
  kind: VrstaPorocila
  content: string
  created_at: string
  player_name?: string | null
  team_name?: string | null
  team_short?: string | null
  team_logo?: string | null
  author_name?: string | null
}

export const VRSTE: Array<{ kljuc: VrstaPorocila; oznaka: string; ikona: string }> = [
  { kljuc: 'poskodba', oznaka: 'Poškodba', ikona: '🩹' },
  { kljuc: 'odsotnost', oznaka: 'Odsotnost', ikona: '🚫' },
  { kljuc: 'vrnitev', oznaka: 'Vrnitev', ikona: '✅' },
  { kljuc: 'drugo', oznaka: 'Drugo', ikona: '💬' },
]

const PO_KLJUCU: Record<VrstaPorocila, { oznaka: string; ikona: string; barva: string }> = {
  poskodba: { oznaka: 'Poškodba', ikona: '🩹', barva: 'bg-rose-500/15 text-rose-200' },
  odsotnost: { oznaka: 'Odsotnost', ikona: '🚫', barva: 'bg-amber-500/15 text-amber-200' },
  vrnitev: { oznaka: 'Vrnitev', ikona: '✅', barva: 'bg-gnl-500/15 text-gnl-200' },
  drugo: { oznaka: 'Drugo', ikona: '💬', barva: 'bg-white/10 text-slate-300' },
}

export function ZnackaVrste({ vrsta }: { vrsta: VrstaPorocila }) {
  const v = PO_KLJUCU[vrsta] ?? PO_KLJUCU.drugo
  return (
    <span className={`znacka shrink-0 ${v.barva}`}>
      {v.ikona} {v.oznaka}
    </span>
  )
}

/** "pred 3 h", "pred 2 d" — enako kot v klepetu. */
export function relativniCas(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'zdaj'
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`
  if (s < 604800) return `pred ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric' })
}

/**
 * Ena vrstica poročila. `naslov` je neobvezen — na strani igralca ga ne
 * potrebujemo, ker vemo, čigav je; na forumu pa pove, za koga gre.
 */
export function VrsticaPorocila({
  porocilo,
  naslov,
  naIzbris,
}: {
  porocilo: Porocilo
  naslov?: ReactNode
  naIzbris?: () => void
}) {
  return (
    <li className="kartica p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ZnackaVrste vrsta={porocilo.kind} />
        {naslov}
        <span className="ml-auto shrink-0 text-xs text-slate-500">
          {relativniCas(porocilo.created_at)}
          {naIzbris && (
            <button
              onClick={naIzbris}
              title="Izbriši poročilo"
              className="ml-2 text-slate-500 hover:text-rose-400"
            >
              ✕
            </button>
          )}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-200">
        {porocilo.content}
      </p>
      {porocilo.author_name && (
        <p className="mt-1 text-xs text-slate-500">— {porocilo.author_name}</p>
      )}
    </li>
  )
}
