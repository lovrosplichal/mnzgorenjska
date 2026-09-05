// Katero ligo uvažamo — člane ali mladince.
//
// Vse uvozne skripte sprejmejo `--tekmovanje mladinci`; brez njega delajo s
// člansko ligo, tako kot so od nekdaj. Šifro lige pri viru hrani
// `competitions.source_league_code`, zato je `--liga` potreben le za arhiv
// prejšnjih sezon (npr. `--liga 1503` za mladince 2025/26).
//
// Tekmovanje pove tudi, KDO je vir (`source`) — uvozne skripte naslovov ne
// gradijo več same, ampak jih dobijo od vira v `scripts/viri/`.

export function slugTekmovanja(privzeto = 'clani') {
  const i = process.argv.indexOf('--tekmovanje')
  const v = i > -1 ? process.argv[i + 1] : null
  return v && !v.startsWith('--') ? v : privzeto
}

// Stolpci, ki obstajajo šele po migraciji 20260905090000 (države in viri).
const NOVI = 'source, source_league_code, country_id'
const STARI = 'id, slug, name, short_name, mnzg_liga, prvi_fantasy_krog, rok_pomak_ur'

/**
 * Vrne vrstico iz `competitions` za dani slug; brez nje se ne da uvažati.
 *
 * Kodo in migracije uveljavlja vsak svoja pot: koda gre v git in na Vercel,
 * migracija pa jo mora nekdo pognati proti Supabase. Uvoz zato ne sme
 * predpostavljati, da je oboje prišlo hkrati — če novih stolpcev še ni,
 * PostgREST vrne 400 in nočni uvoz bi se ustavil. Zato poskusimo s polnim
 * naborom in ob napaki pademo nazaj na starega.
 */
export async function tekmovanje(db, slug = slugTekmovanja()) {
  let { data, error } = await db
    .from('competitions')
    .select(`${STARI}, ${NOVI}`)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    const staraShema = await db
      .from('competitions')
      .select(STARI)
      .eq('slug', slug)
      .maybeSingle()
    if (staraShema.error)
      throw new Error(`tekmovanja ni mogoče prebrati: ${error.message}`)
    console.log(
      '  opomba: baza še nima stolpcev za države in vire — uvoz teče po starem',
    )
    data = staraShema.data
  }

  if (!data)
    throw new Error(
      `tekmovanje "${slug}" ne obstaja — na voljo sta "clani" in "mladinci"`,
    )
  return data
}

/**
 * Šifra lige pri viru.
 *
 * Med prehodom bere `source_league_code`, če ga ni, pa stari `mnzg_liga` —
 * tako uvoz teče tudi proti bazi, kjer migracija še ni stekla.
 */
export const sifraLige = (tekmovanje, privzeto = null) =>
  tekmovanje?.source_league_code ?? tekmovanje?.mnzg_liga ?? privzeto
