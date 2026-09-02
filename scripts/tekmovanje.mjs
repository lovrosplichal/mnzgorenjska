// Katero ligo uvažamo — člane ali mladince.
//
// Vse uvozne skripte sprejmejo `--tekmovanje mladinci`; brez njega delajo s
// člansko ligo, tako kot so od nekdaj. Šifro lige na mnzgkranj.si hrani
// `competitions.mnzg_liga`, zato je `--liga` potreben le za arhiv prejšnjih
// sezon (npr. `--liga 1503` za mladince 2025/26).

export function slugTekmovanja(privzeto = 'clani') {
  const i = process.argv.indexOf('--tekmovanje')
  const v = i > -1 ? process.argv[i + 1] : null
  return v && !v.startsWith('--') ? v : privzeto
}

/** Vrne vrstico iz `competitions` za dani slug; brez nje se ne da uvažati. */
export async function tekmovanje(db, slug = slugTekmovanja()) {
  const { data, error } = await db
    .from('competitions')
    .select('id, slug, name, short_name, mnzg_liga, prvi_fantasy_krog, rok_pomak_ur')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`tekmovanja ni mogoče prebrati: ${error.message}`)
  if (!data)
    throw new Error(
      `tekmovanje "${slug}" ne obstaja — na voljo sta "clani" in "mladinci"`,
    )
  return data
}
