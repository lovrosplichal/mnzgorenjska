// Pravila za sestavo fantasy ekipe.
//
// Kader je urejen enako kot v Premier League Fantasy: 15 igralcev v razmerju
// 2 vratarja, 5 branilcev, 5 vezistov, 3 napadalci; od tega 11 v prvi postavi
// in 4 na klopi. Postava je poljubna, dokler ima natanko enega vratarja in
// spoštuje spodnje in zgornje meje po pozicijah.

export const VELIKOST_EKIPE = 15
export const STEVILO_PRVIH = 11
export const MAX_IZ_KLUBA = 3
export const PRORACUN = 100.0
export const KAPETAN_MNOZITELJ = 3

export const POZICIJE = {
  GK: { naslov: 'Vratarji', kader: 2, min: 1, max: 1, privzeto: 1 },
  DEF: { naslov: 'Branilci', kader: 5, min: 3, max: 5, privzeto: 4 },
  MID: { naslov: 'Vezisti', kader: 5, min: 2, max: 5, privzeto: 4 },
  FWD: { naslov: 'Napadalci', kader: 3, min: 1, max: 3, privzeto: 2 },
}

/** Od zadnje do prve vrste igrišča — vrstni red uporabljamo povsod enako. */
export const VRSTNI_RED = ['GK', 'DEF', 'MID', 'FWD']

/** Prešteje igralce po pozicijah; igralci brez pozicije se ne štejejo. */
export function poPozicijah(igralci) {
  const n = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const i of igralci) if (n[i.position] != null) n[i.position]++
  return n
}

export function brezPozicije(igralci) {
  return igralci.filter((i) => !i.position)
}

/**
 * Ali lahko igralec te pozicije še stopi v prvo postavo? Poleg zgornje meje
 * preveri tudi, da za preostale pozicije ostane dovolj mest za njihov minimum.
 */
export function lahkoZacne(pozicija, prvi) {
  const n = poPozicijah(prvi)
  if (prvi.length >= STEVILO_PRVIH) return false
  if (n[pozicija] >= POZICIJE[pozicija].max) return false

  const prosto = STEVILO_PRVIH - prvi.length - 1
  const manjka = VRSTNI_RED.filter((p) => p !== pozicija).reduce(
    (v, p) => v + Math.max(0, POZICIJE[p].min - n[p]),
    0,
  )
  return manjka <= prosto
}

/**
 * Zakaj igralca ni mogoče dodati v kader? Vrne razlog ali null, če ga je.
 * Isti razlogi so uporabljeni na trgu igralcev, da gumbi in opozorila povedo
 * isto zgodbo.
 */
export function zakajNeGre(igralec, izbrani, preostalo) {
  if (izbrani.length >= VELIKOST_EKIPE)
    return `Kader je poln (${VELIKOST_EKIPE} igralcev).`

  if (igralec.position) {
    const p = POZICIJE[igralec.position]
    const n = poPozicijah(izbrani)[igralec.position]
    if (n >= p.kader)
      return `${p.naslov.toLowerCase()}: v kadru jih imaš že ${p.kader}.`
  }

  if (Number(igralec.value ?? 0) > preostalo)
    return `Premalo proračuna — igralec stane ${Number(igralec.value ?? 0)}, na voljo imaš ${preostalo.toFixed(1)}.`

  const izKluba = izbrani.filter((s) => s.team_id === igralec.team_id).length
  if (izKluba >= MAX_IZ_KLUBA)
    return `Iz kluba ${igralec.team_name ?? ''} imaš že ${MAX_IZ_KLUBA} igralce.`.replace(
      '  ',
      ' ',
    )

  return null
}

/** Vrne seznam napak; prazen seznam pomeni veljavno ekipo. */
export function preveriEkipo(izbrani, proracun = PRORACUN) {
  const napake = []
  const prvi = izbrani.filter((i) => i.is_starter)

  if (izbrani.length !== VELIKOST_EKIPE)
    napake.push(
      `Ekipa mora šteti ${VELIKOST_EKIPE} igralcev (trenutno ${izbrani.length}).`,
    )

  if (prvi.length !== STEVILO_PRVIH)
    napake.push(
      `V prvi postavi mora biti ${STEVILO_PRVIH} igralcev (trenutno ${prvi.length}).`,
    )

  // Pozicije nekaterih igralcev še niso izglasovane — brez njih postave
  // ni mogoče preveriti, zato na to posebej opozorimo.
  const manjkaPozicija = brezPozicije(izbrani).length
  if (manjkaPozicija > 0)
    napake.push(
      `${manjkaPozicija} izbranih igralcev še nima potrjene pozicije — pomagaj v razdelku Pozicije.`,
    )

  const vKadru = poPozicijah(izbrani)
  const vPostavi = poPozicijah(prvi)
  for (const koda of VRSTNI_RED) {
    const p = POZICIJE[koda]
    if (vKadru[koda] !== p.kader)
      napake.push(
        `${p.naslov} v kadru: ${vKadru[koda]} — biti jih mora ${p.kader}.`,
      )
    const n = vPostavi[koda]
    if (n < p.min || n > p.max)
      napake.push(`${p.naslov} v prvi postavi: ${n} — dovoljeno ${p.min}–${p.max}.`)
  }

  const kapetanov = prvi.filter((i) => i.is_captain).length
  if (kapetanov !== 1)
    napake.push(
      kapetanov === 0
        ? `Določi kapetana — v krogu prinese ${KAPETAN_MNOZITELJ}-kratne točke.`
        : 'Kapetan je lahko le eden.',
    )
  if (prvi.filter((i) => i.is_vice).length !== 1)
    napake.push('Določi namestnika, ki prevzame trak, če kapetan ne igra.')

  const poKlubih = {}
  for (const i of izbrani) poKlubih[i.team_id] = (poKlubih[i.team_id] ?? 0) + 1
  if (Object.values(poKlubih).some((n) => n > MAX_IZ_KLUBA))
    napake.push(`Iz istega kluba lahko izbereš največ ${MAX_IZ_KLUBA} igralce.`)

  const porabljeno = izbrani.reduce((v, i) => v + Number(i.value ?? 0), 0)
  if (porabljeno > proracun)
    napake.push(
      `Presegel si proračun za ${(porabljeno - proracun).toFixed(1)}.`,
    )

  return napake
}
