// Domenski tipi, ki jih deli več modulov.
//
// Vrstice tabel in pogledov NE sodijo sem — te generira Supabase iz migracij
// v `src/lib/baza.types.ts` (`npm run tipi`). Tu so samo pojmi, ki jih shema
// ne pozna, ker živijo v aplikaciji.

import type { Database } from './baza.types'

type Pogledi = Database['public']['Views']
type Tabele = Database['public']['Tables']

/** Pozicija igralca. V bazi je `players.position` (text, lahko prazen). */
export type Pozicija = 'GK' | 'DEF' | 'MID' | 'FWD'

/** Slug tekmovanja — `competitions.slug`. */
export type TekmovanjeSlug = 'clani' | 'mladinci'

/**
 * Igralec, kot ga potrebujejo pravila sestave ekipe. Namenoma ohlapen: strani
 * ga sestavijo iz različnih pogledov (`player_overview`, `player_standings`,
 * trg v Moji ekipi), zato zahtevamo le polja, ki jih pravila res berejo.
 */
export interface IgralecZaPravila {
  id?: number | string
  position?: Pozicija | null
  team_id?: number | string | null
  team_name?: string | null
  value?: number | string | null
}

/** Igralec v kadru — dodatno nosi vlogo v postavi. */
export interface IgralecVKadru extends IgralecZaPravila {
  is_starter?: boolean | null
  is_captain?: boolean | null
  is_vice?: boolean | null
  bench_order?: number | null
}

/** Nastop igralca na tekmi, kot ga bere točkovanje. */
export interface Nastop {
  minute?: number | null
  goli?: number | null
  asistence?: number | null
  cleanSheet?: boolean | null
  prejetiGoli?: number | null
  obranjeneEnajstmetrovke?: number | null
  zgreseneEnajstmetrovke?: number | null
  avtogoli?: number | null
  rumeni?: number | null
  rdeci?: number | null
}

/** Ena postavka v razčlenitvi točk ("Gol", "Rumeni karton" …). */
export interface Postavka {
  opis: string
  tocke: number
}

export interface IzracunTock {
  skupaj: number
  postavke: Postavka[]
}

// --- Vrstice pogledov in tabel --------------------------------------------
// Teh NE pisemo na roko: izpeljemo jih iz generiranih tipov, da se ob
// spremembi migracije popravijo same. `npm run tipi` osvezi `baza.types.ts`.

/** Odigrana tekma s stevilom golov brez asistence (`match_assist_status`). */
export type TekmaVrstica = Pogledi['match_assist_status']['Row']

/** Tocke igralca na eni tekmi (`appearance_points`). */
export type TockeNastopa = Pogledi['appearance_points']['Row']

/** Vrstica tabele `players`. */
export type IgralecVrstica = Tabele['players']['Row']
