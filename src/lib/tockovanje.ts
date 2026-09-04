// Točkovanje Gorenjske Fantasy Lige.
//
// Točke se računajo iz uradnih zapisnikov MNZ Gorenjska, razen asistenc in
// pozicij, ki jih določi skupnost z glasovanjem.

import type { IzracunTock, Nastop, Postavka, Pozicija } from './tipi'

export const TOCKE = {
  // igralni čas
  nastopDo60: 1,
  nastopOd60: 2,
  pragMinut: 60, // brez sodniškega podaljška

  // goli po pozicijah
  gol: { GK: 10, DEF: 6, MID: 5, FWD: 4 } as Record<Pozicija, number>,

  asistenca: 3,

  // clean sheet (vsaj 60 minut, brez prejetega gola)
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 } as Record<Pozicija, number>,

  // prejeti goli: -1 za vsaka 2 prejeta (vratarji in branilci)
  prejetiNaTocko: 2,
  prejetiPozicije: ['GK', 'DEF'] as Pozicija[],

  obranjenaEnajstmetrovka: 5,
  zgresenaEnajstmetrovka: -2,
  avtogol: -2,
  rumeniKarton: -1,
  rdeciKarton: -3,
}

/** Izračuna točke enega igralca na eni tekmi. */
export function tockeZaNastop(n: Nastop, pozicija: Pozicija): IzracunTock {
  const postavke: Postavka[] = []
  const dodaj = (opis: string, tocke: number) => {
    if (tocke !== 0) postavke.push({ opis, tocke })
  }

  const minute = n.minute ?? 0
  if (minute <= 0) return { skupaj: 0, postavke: [] }

  // igralni čas
  if (minute >= TOCKE.pragMinut) dodaj('Odigranih 60 minut ali več', TOCKE.nastopOd60)
  else dodaj('Nastop do 60 minut', TOCKE.nastopDo60)

  // goli
  const zaGol = TOCKE.gol[pozicija] ?? 0
  const goli = n.goli ?? 0
  if (goli > 0) dodaj(goli === 1 ? 'Gol' : `Goli (${goli})`, goli * zaGol)

  // asistence (iz glasovanja skupnosti)
  const asistence = n.asistence ?? 0
  if (asistence > 0)
    dodaj(
      asistence === 1 ? 'Asistenca' : `Asistence (${asistence})`,
      asistence * TOCKE.asistenca,
    )

  // clean sheet
  const zaCS = TOCKE.cleanSheet[pozicija] ?? 0
  if (n.cleanSheet && minute >= TOCKE.pragMinut && zaCS > 0)
    dodaj('Brez prejetega gola', zaCS)

  // prejeti goli
  const prejetiGoli = n.prejetiGoli ?? 0
  if (TOCKE.prejetiPozicije.includes(pozicija) && prejetiGoli > 0) {
    const odbitek = -Math.floor(prejetiGoli / TOCKE.prejetiNaTocko)
    if (odbitek !== 0) dodaj(`Prejeti goli (${prejetiGoli})`, odbitek)
  }

  // posebne akcije
  const obranjene = n.obranjeneEnajstmetrovke ?? 0
  if (obranjene > 0)
    dodaj(
      `Obranjena enajstmetrovka (${obranjene})`,
      obranjene * TOCKE.obranjenaEnajstmetrovka,
    )
  const zgresene = n.zgreseneEnajstmetrovke ?? 0
  if (zgresene > 0)
    dodaj(
      `Zgrešena enajstmetrovka (${zgresene})`,
      zgresene * TOCKE.zgresenaEnajstmetrovka,
    )
  const avtogoli = n.avtogoli ?? 0
  if (avtogoli > 0) dodaj(`Avtogol (${avtogoli})`, avtogoli * TOCKE.avtogol)
  const rumeni = n.rumeni ?? 0
  if (rumeni > 0) dodaj(`Rumeni karton (${rumeni})`, rumeni * TOCKE.rumeniKarton)
  const rdeci = n.rdeci ?? 0
  if (rdeci > 0) dodaj('Rdeči karton', rdeci * TOCKE.rdeciKarton)

  return {
    skupaj: postavke.reduce((v, p) => v + p.tocke, 0),
    postavke,
  }
}

/** Kratek opis pravil za prikaz uporabnikom. */
export const PRAVILA_OPIS: Array<{
  skupina: string
  vrstice: Array<[string, string]>
}> = [
  { skupina: 'Igralni čas', vrstice: [
    ['Nastop do 60 minut', '+1'],
    ['Odigranih 60 minut ali več', '+2'],
  ]},
  { skupina: 'Goli in asistence', vrstice: [
    ['Gol vratarja', '+10'],
    ['Gol branilca', '+6'],
    ['Gol vezista', '+5'],
    ['Gol napadalca', '+4'],
    ['Asistenca', '+3'],
  ]},
  { skupina: 'Obramba', vrstice: [
    ['Brez prejetega gola — vratar, branilec', '+4'],
    ['Brez prejetega gola — vezist', '+1'],
    ['Vsaka 2 prejeta gola — vratar, branilec', '−1'],
    ['Obranjena enajstmetrovka', '+5'],
  ]},
  { skupina: 'Kazni', vrstice: [
    ['Zgrešena enajstmetrovka', '−2'],
    ['Avtogol', '−2'],
    ['Rumeni karton', '−1'],
    ['Rdeči karton', '−3'],
  ]},
]
