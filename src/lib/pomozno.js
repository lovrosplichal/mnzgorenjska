// Skupne pomožne funkcije za prikaz.

export const IME_POZICIJE = {
  GK: 'Vratar',
  DEF: 'Branilec',
  MID: 'Vezist',
  FWD: 'Napadalec',
}

export const KRATKA_POZICIJA = {
  GK: 'VRA',
  DEF: 'BRA',
  MID: 'VEZ',
  FWD: 'NAP',
}

/** Iz "Priimek Ime" naredi "Ime Priimek" za prijaznejši prikaz. */
export function prikazniIme(polno) {
  if (!polno) return ''
  const deli = polno.trim().split(/\s+/)
  if (deli.length < 2) return polno
  return deli.slice(1).join(' ') + ' ' + deli[0]
}

export function razredPozicije(poz) {
  return poz ? `poz-${poz}` : 'poz-none'
}

export const formatirajTocke = (t) => {
  const n = Number(t ?? 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
