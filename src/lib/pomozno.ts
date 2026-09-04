// Skupne pomožne funkcije za prikaz.

import type { Pozicija } from './tipi'

export const IME_POZICIJE: Record<Pozicija, string> = {
  GK: 'Vratar',
  DEF: 'Branilec',
  MID: 'Vezist',
  FWD: 'Napadalec',
}

export const KRATKA_POZICIJA: Record<Pozicija, string> = {
  GK: 'VRA',
  DEF: 'BRA',
  MID: 'VEZ',
  FWD: 'NAP',
}

/** Iz "Priimek Ime" naredi "Ime Priimek" za prijaznejši prikaz. */
export function prikazniIme(polno: string | null | undefined): string {
  if (!polno) return ''
  const deli = polno.trim().split(/\s+/)
  if (deli.length < 2) return polno
  return deli.slice(1).join(' ') + ' ' + deli[0]
}

export function razredPozicije(poz: Pozicija | null | undefined): string {
  return poz ? `poz-${poz}` : 'poz-none'
}

export const formatirajTocke = (t: number | string | null | undefined): string => {
  const n = Number(t ?? 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * Cena v obliki valute: 5.5 -> "5,5 M€". Točke in cene se sicer izpisujejo z
 * isto funkcijo in ju je bilo na zaslonu težko ločiti.
 */
export const formatirajCeno = (v: number | string | null | undefined): string => {
  const n = Number(v ?? 0)
  return `${n.toFixed(1).replace('.', ',')} M€`
}
