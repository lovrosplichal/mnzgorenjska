// Pravila za sestavo fantasy ekipe
export const VELIKOST_EKIPE = 15
export const STEVILO_PRVIH = 11
export const MAX_IZ_KLUBA = 3

export const POZICIJE = {
  GK: { naslov: 'Vratarji', min: 1, max: 1 },
  DEF: { naslov: 'Branilci', min: 3, max: 5 },
  MID: { naslov: 'Vezisti', min: 2, max: 5 },
  FWD: { naslov: 'Napadalci', min: 1, max: 3 },
}

export const IME_POZICIJE = {
  GK: 'Vratar',
  DEF: 'Branilec',
  MID: 'Vezist',
  FWD: 'Napadalec',
}

// Vrne seznam napak; prazen seznam pomeni veljavno ekipo.
export function preveriEkipo(izbrani) {
  const napake = []
  const prvi = izbrani.filter((i) => i.is_starter)

  if (izbrani.length !== VELIKOST_EKIPE)
    napake.push(`Ekipa mora šteti ${VELIKOST_EKIPE} igralcev (trenutno ${izbrani.length}).`)

  if (prvi.length !== STEVILO_PRVIH)
    napake.push(`V prvi postavi mora biti ${STEVILO_PRVIH} igralcev (trenutno ${prvi.length}).`)

  for (const [koda, p] of Object.entries(POZICIJE)) {
    const n = prvi.filter((i) => i.position === koda).length
    if (n < p.min || n > p.max)
      napake.push(
        `${p.naslov} v prvi postavi: ${n} — dovoljeno ${p.min}–${p.max}.`,
      )
  }

  const poKlubih = {}
  for (const i of izbrani) poKlubih[i.team_id] = (poKlubih[i.team_id] ?? 0) + 1
  for (const [, n] of Object.entries(poKlubih))
    if (n > MAX_IZ_KLUBA) {
      napake.push(`Iz istega kluba lahko izbereš največ ${MAX_IZ_KLUBA} igralce.`)
      break
    }

  return napake
}
