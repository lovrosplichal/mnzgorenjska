// Izbira vira podatkov po `competitions.source`.
//
// En vir = ena datoteka v tej mapi. Nov vir (druga zveza, druga država)
// pomeni novo datoteko in eno vrstico spodaj — uvoznih skript se ne dotika.
//
// Zavestno je to preprost slovar in ne samodejno branje mape: tako je iz kode
// razvidno, kateri viri obstajajo, in tipkarska napaka v `source` pade takoj
// z razumljivo napako namesto na pol poti skozi uvoz.
import mnzg from './mnzg.mjs'

const VIRI = {
  mnzg,
}

/**
 * Vrne vir za dano tekmovanje.
 *
 * @param {{ source?: string, slug?: string }} tekmovanje vrstica iz `competitions`
 */
export function viraZa(tekmovanje) {
  const ime = tekmovanje?.source ?? 'mnzg'
  const vir = VIRI[ime]
  if (!vir) {
    const znani = Object.keys(VIRI).join(', ')
    throw new Error(
      `Tekmovanje "${tekmovanje?.slug ?? '?'}" navaja vir "${ime}", ki ga ne poznam. Znani viri: ${znani}.`,
    )
  }
  return vir
}

/** Vsi znani viri — za izpise in preverjanje. */
export const znaniViri = () => Object.keys(VIRI)

export default VIRI
