// Katero ligo gleda uporabnik — člane ali mladince.
//
// Poti so za obe ligi iste (/lestvica, /moja-ekipa …), razlikuje jih parameter
// `?t=mladinci`. Tako je vsaka stran deljiva s povezavo, meni pa ostane en
// sam. Izbira se shrani v brskalnik, da je ob naslednjem obisku tam, kjer si
// pustil; parameter v naslovu jo vedno povozi, ker je bolj določen.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from './supabase'

export const PRIVZETO = 'clani'
const KLJUC = 'slff-tekmovanje'

/** Tekmovanje, kot ga bere vmesnik (podmnožica stolpcev `competitions`). */
export interface Tekmovanje {
  id: number
  slug: string
  name: string
  short_name: string | null
  prvi_fantasy_krog: number | null
}

/** Ukaz, ki ga vrne `uskladiTekmovanje` — kdo popravi koga. */
export type UskladitevUkaz =
  | { dejanje: 'nic' }
  | { dejanje: 'prevzemi-naslov'; slug: string }
  | { dejanje: 'zapisi-naslov'; param: string | null }

export interface UskladitevVhod {
  vNaslovu: string | null | undefined
  zadnjiVNaslovu: string | null | undefined
  slug: string
  potSeJeSpremenila?: boolean
}

/**
 * Kdo ima prav, ko se razideta naslov in izbrana liga.
 *
 * Izbrana liga je **lepljiva**: ko enkrat izbereš mladince, ostaneš pri njih,
 * dokler ne klikneš drugam. Parameter v naslovu (`?t=mladinci`) je zato le
 * vstopna točka za deljeno povezavo, ne pa vir resnice — povezave v meniju ga
 * ne prenašajo naprej in vsaka navigacija bi ligo sicer zavrgla.
 *
 * Ločiti moramo tri primere, sicer se dva popravka izničita:
 *   1. parameter je izginil ob **navigaciji** → vrnemo ga, liga ostane,
 *   2. parameter se je spremenil ob isti poti → uporabnik je kliknil preklop,
 *   3. parameter je prišel od zunaj (deljena povezava, gumb nazaj) → velja on.
 *
 * Ločena od Reacta, da jo je mogoče preveriti brez brskalnika (`npm run smoke`).
 */
export function uskladiTekmovanje({
  vNaslovu,
  zadnjiVNaslovu,
  slug,
  potSeJeSpremenila = false,
}: UskladitevVhod): UskladitevUkaz {
  if (vNaslovu !== zadnjiVNaslovu) {
    // 1. Navigacija je parameter izgubila — liga se zaradi klika na "Igralci"
    //    ne sme spremeniti.
    if (potSeJeSpremenila && vNaslovu == null && slug !== PRIVZETO) {
      return { dejanje: 'zapisi-naslov', param: slug }
    }
    // 3. Naslov pove kaj novega — velja on.
    const izNaslova = vNaslovu ?? PRIVZETO
    if (izNaslova !== slug) return { dejanje: 'prevzemi-naslov', slug: izNaslova }
  }
  // 2. Izbiro je spremenil uporabnik — zapišimo jo v naslov.
  const zeljen = slug === PRIVZETO ? null : slug
  if ((vNaslovu ?? null) === zeljen) return { dejanje: 'nic' }
  return { dejanje: 'zapisi-naslov', param: zeljen }
}

interface KontekstVrednost {
  slug: string
  id: number | null
  tekmovanje: Tekmovanje | null
  tekmovanja: Tekmovanje[]
  nastavi: (slug: string) => void
}

const Kontekst = createContext<KontekstVrednost>({
  slug: PRIVZETO,
  id: null,
  tekmovanje: null,
  tekmovanja: [],
  nastavi: () => {},
})

function shranjeno(): string | null {
  try {
    return localStorage.getItem(KLJUC)
  } catch {
    return null
  }
}

export function TekmovanjeProvider({ children }: { children: ReactNode }) {
  const [iskanje, setIskanje] = useSearchParams()
  const [tekmovanja, setTekmovanja] = useState<Tekmovanje[]>([])
  const [slug, setSlug] = useState<string>(
    () => iskanje.get('t') || shranjeno() || PRIVZETO,
  )

  useEffect(() => {
    supabase
      .from('competitions')
      .select('id, slug, name, short_name, prvi_fantasy_krog')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setTekmovanja((data as Tekmovanje[] | null) ?? []))
  }, [])

  const { pathname } = useLocation()
  const zadnjiVNaslovu = useRef<string | null>(iskanje.get('t'))
  const zadnjaPot = useRef(pathname)

  useEffect(() => {
    const vNaslovu = iskanje.get('t')
    const ukaz = uskladiTekmovanje({
      vNaslovu,
      zadnjiVNaslovu: zadnjiVNaslovu.current,
      slug,
      potSeJeSpremenila: pathname !== zadnjaPot.current,
    })
    zadnjiVNaslovu.current = vNaslovu
    zadnjaPot.current = pathname

    if (ukaz.dejanje === 'prevzemi-naslov') {
      setSlug(ukaz.slug)
    } else if (ukaz.dejanje === 'zapisi-naslov') {
      const novo = new URLSearchParams(iskanje)
      if (ukaz.param) novo.set('t', ukaz.param)
      else novo.delete('t')
      zadnjiVNaslovu.current = ukaz.param
      setIskanje(novo, { replace: true })
    }
  }, [iskanje, pathname, slug, setIskanje])

  // Neznana liga v naslovu (tipkarska napaka, stara povezava) naj ne pusti
  // strani prazne — vrnemo se na privzeto.
  useEffect(() => {
    if (!tekmovanja.length) return
    if (!tekmovanja.some((t) => t.slug === slug)) setSlug(PRIVZETO)
  }, [tekmovanja, slug])

  useEffect(() => {
    try {
      localStorage.setItem(KLJUC, slug)
    } catch {
      /* zasebno okno — izbira velja le za to sejo */
    }
  }, [slug])

  const tekmovanje = tekmovanja.find((t) => t.slug === slug) ?? null

  return (
    <Kontekst.Provider
      value={{
        slug,
        id: tekmovanje?.id ?? null,
        tekmovanje,
        tekmovanja,
        nastavi: setSlug,
      }}
    >
      {children}
    </Kontekst.Provider>
  )
}

/**
 * `id` je null, dokler se seznam lig ne naloži — dokler je, naj strani ne
 * poizvedujejo, sicer bi za hip pokazale igralce obeh lig skupaj.
 */
export function useTekmovanje(): KontekstVrednost {
  return useContext(Kontekst)
}
