// Razčlenjevalnik zapisnikov MNZ Gorenjska (www.mnzgkranj.si).
//
// Zapisnik vsebuje: postavi obeh ekip (z oznako (V) za vratarja), strelce z
// minuto in oznakama AG (avtogol) in 11m (gol iz enajstmetrovke), opominjane
// (rumeni), izključene (rdeči) in menjave z minuto.
//
// Česar zapisnik NE vsebuje: asistenc, pozicij (razen vratarja) ter
// obranjenih/zgrešenih enajstmetrovk. Te podatke aplikacija dobi drugje.

const DOLZINA_TEKME = 90

/** HTML pretvori v seznam neprazbih vrstic. */
export function vBesedilo(html) {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  h = h
    .replace(/<\/(tr|table|div|p|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\n')
  h = h.replace(/<[^>]+>/g, '\n')
  h = h
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return h
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const MARKERJI = [
  'POSTAVI',
  'TRENER',
  'STRELCI',
  'OPOMINJANI',
  'IZKLJUČENI',
  'MENJAVE',
  'REZULTATI',
]

function razdelki(vrstice) {
  const meje = []
  for (const m of MARKERJI) {
    const i = vrstice.findIndex((v) => v === m || v === m + ':')
    if (i >= 0) meje.push({ ime: m, i })
  }
  meje.sort((a, b) => a.i - b.i)
  const out = {}
  for (let k = 0; k < meje.length; k++) {
    const od = meje[k].i + 1
    const do_ = k + 1 < meje.length ? meje[k + 1].i : vrstice.length
    out[meje[k].ime] = vrstice.slice(od, do_)
  }
  return out
}

/** "16 - Jesenovec Jure" -> { st: 16, ime: 'Jesenovec Jure' } */
function igralecIzNiza(s) {
  const m = s.match(/^(\d{1,3})\s*-\s*(.+?)\s*$/)
  if (!m) return null
  return { st: Number(m[1]), ime: m[2].trim() }
}

function jeOznaka(s) {
  return /^\((V|K|V,K|K,V)\)$/.test(s)
}

/**
 * Iz razdelka POSTAVI potegne obe ekipi.
 * Vrstni red v zapisniku: postava 1, postava 2, rezerve 1, rezerve 2.
 */
function parsePostave(vrstice) {
  const skupine = []
  let trenutna = null

  for (let i = 0; i < vrstice.length; i++) {
    const v = vrstice[i]
    if (v === 'Priimek in ime') continue

    if (/^Rezervni igralci/i.test(v)) {
      trenutna = { naslov: 'rezerve', igralci: [] }
      skupine.push(trenutna)
      continue
    }

    if (/^\d{1,3}$/.test(v)) {
      const ime = vrstice[i + 1]
      if (!ime || /^\d{1,3}$/.test(ime) || jeOznaka(ime)) continue
      const oznaka = vrstice[i + 2]
      const vratar = jeOznaka(oznaka) && oznaka.includes('V')
      const kapetan = jeOznaka(oznaka) && oznaka.includes('K')
      if (!trenutna) continue
      trenutna.igralci.push({ st: Number(v), ime: ime.trim(), vratar, kapetan })
      i += jeOznaka(oznaka) ? 2 : 1
      continue
    }

    // ime ekipe
    if (v.length > 1 && !jeOznaka(v)) {
      trenutna = { naslov: 'ekipa', ime: v, igralci: [] }
      skupine.push(trenutna)
    }
  }

  const ekipe = skupine.filter((s) => s.naslov === 'ekipa' && s.igralci.length)
  const rezerve = skupine.filter((s) => s.naslov === 'rezerve')
  if (ekipe.length < 2) return null

  return [0, 1].map((k) => ({
    ime: ekipe[k].ime,
    postava: ekipe[k].igralci,
    rezerve: rezerve[k]?.igralci ?? [],
  }))
}

/**
 * Razdelek razbije na dva bloka po imenih ekip.
 * Vrne [vrsticeEkipe1, vrsticeEkipe2].
 */
function poEkipah(vrstice, imena) {
  const i1 = vrstice.findIndex((v) => v === imena[0])
  const i2 = vrstice.findIndex((v, k) => k > i1 && v === imena[1])
  if (i1 < 0 || i2 < 0) return [[], []]
  // "Uradne osebe" ni del igralskih podatkov
  const konec = vrstice.findIndex((v, k) => k > i2 && /^Uradne osebe/i.test(v))
  const prvi = vrstice.slice(i1 + 1, i2)
  const drugi = vrstice.slice(i2 + 1, konec > i2 ? konec : vrstice.length)
  const brezUradnih = (a) => {
    const j = a.findIndex((v) => /^Uradne osebe/i.test(v))
    return j >= 0 ? a.slice(0, j) : a
  }
  return [brezUradnih(prvi), brezUradnih(drugi)]
}

/**
 * Razdelek STRELCI je zaporedje vrstic:
 *   "1 : 0"                     -> tekoči rezultat (neobvezen!)
 *   "16 - Jesenovec Jure (54')" -> strelec
 *   "AG" / "11m"                -> neobvezni oznaki
 *
 * Ključno: dosežen gol ima PRED sabo vrstico s tekočim rezultatom.
 * Zgrešena enajstmetrovka je navedena BREZ rezultata — le igralec in "11m".
 * Zato ločimo gole od zgrešenih enajstmetrovk po prisotnosti rezultata.
 */
function parseStrelci(vrstice, imena) {
  const bloki = poEkipah(vrstice, imena)
  const goli = []
  const zgresenePosamezno = []

  for (const [idx, blok] of bloki.entries()) {
    let rezultat = null
    let zadnji = null

    for (const v of blok) {
      const mRez = v.match(/^(\d+)\s*:\s*(\d+)$/)
      if (mRez) {
        rezultat = [Number(mRez[1]), Number(mRez[2])]
        zadnji = null
        continue
      }

      const mIg = v.match(/^(\d{1,3})\s*-\s*(.+?)\s*\((\d+)'\)$/)
      if (mIg) {
        zadnji = {
          ekipaIdx: idx, // ekipa, pod katero je vpis naveden (= ekipa igralca)
          rezultat,
          st: Number(mIg[1]),
          ime: mIg[2].trim(),
          minuta: Number(mIg[3]),
          avtogol: false,
          enajstmetrovka: false,
        }
        if (rezultat) goli.push(zadnji)
        else zgresenePosamezno.push(zadnji)
        rezultat = null
        continue
      }

      if (!zadnji) continue
      if (/^AG$/i.test(v)) zadnji.avtogol = true
      if (/^11\s*m$/i.test(v)) zadnji.enajstmetrovka = true
    }
  }

  // brez rezultata in brez oznake 11m ne znamo razložiti — zavržemo
  const zgresene = zgresenePosamezno.filter((z) => z.enajstmetrovka)
  return { goli, zgresene }
}

/** "13 - Lebar Maks (8')" */
function parseKartoni(vrstice, imena) {
  const bloki = poEkipah(vrstice, imena)
  const kartoni = []
  for (const [idx, blok] of bloki.entries()) {
    for (const v of blok) {
      const m = v.match(/^(\d{1,3})\s*-\s*(.+?)\s*\((\d+)'\)\s*$/)
      if (!m) continue
      kartoni.push({
        ekipaIdx: idx,
        st: Number(m[1]),
        ime: m[2].trim(),
        minuta: Number(m[3]),
      })
    }
  }
  return kartoni
}

/** minuta, nato igralec ki pride, nato igralec ki gre ven */
function parseMenjave(vrstice, imena) {
  const bloki = poEkipah(vrstice, imena)
  const menjave = []
  for (const [idx, blok] of bloki.entries()) {
    let minuta = null
    let noter = null
    for (const v of blok) {
      if (v === 'Minuta' || v === 'Igralec') continue
      const mm = v.match(/^(\d{1,3})'$/)
      if (mm) {
        minuta = Number(mm[1])
        noter = null
        continue
      }
      const ig = igralecIzNiza(v)
      if (!ig || minuta == null) continue
      if (!noter) {
        noter = ig
      } else {
        menjave.push({ ekipaIdx: idx, minuta, noter, ven: ig })
        minuta = null
        noter = null
      }
    }
  }
  return menjave
}

/**
 * Razčleni HTML zapisnika v strukturo.
 * Vrne null, če zapisnik ni veljaven (prazna tekma).
 */
export function parsirajZapisnik(html, { zapisnikId = null, url = null } = {}) {
  const vrstice = vBesedilo(html)

  const tekmaVrstica = vrstice.find((v) => v.startsWith('TEKMA:'))
  if (!tekmaVrstica || /TEKMA:\s*-\s*\(\s*\)/.test(tekmaVrstica)) return null

  const r = razdelki(vrstice)
  if (!r.POSTAVI) return null

  const ekipe = parsePostave(r.POSTAVI)
  if (!ekipe) return null
  const imena = ekipe.map((e) => e.ime)

  // Rezultat: imena ekip lahko vsebujejo " - ", zato ju vzamemo iz postav.
  const mRez = tekmaVrstica.match(
    /(\d+)\s*:\s*(\d+)\s*\(\s*(\d+)\s*:\s*(\d+)\s*\)/,
  )
  if (!mRez) return null
  const rezultat = { domaci: Number(mRez[1]), gostje: Number(mRez[2]) }
  const polcas = { domaci: Number(mRez[3]), gostje: Number(mRez[4]) }

  // Krog in datum: "Zapisnik: 26. krog 30.05.26"
  const krogVrstica = vrstice.find((v) => /^Zapisnik:/.test(v)) ?? ''
  const mKrog = krogVrstica.match(/(\d+)\.\s*krog/)
  const mDatum = krogVrstica.match(/(\d{2})\.(\d{2})\.(\d{2})/)
  // sezona je v naslovni vrstici tekmovanja, npr. "Merkur GNL - člani 2025/26"
  const sezonaVrstica = vrstice.find((v) => /\d{4}\/\d{2}/.test(v)) ?? ''
  const mSezona = sezonaVrstica.match(/(\d{4}\/\d{2})/)

  const { goli, zgresene } = r.STRELCI
    ? parseStrelci(r.STRELCI, imena)
    : { goli: [], zgresene: [] }
  const rumeni = r.OPOMINJANI ? parseKartoni(r.OPOMINJANI, imena) : []
  const rdeci = r.IZKLJUČENI ? parseKartoni(r.IZKLJUČENI, imena) : []
  const menjave = r.MENJAVE ? parseMenjave(r.MENJAVE, imena) : []

  // Zapisniki so ročno vnešeni in včasih pomanjkljivi. Namesto da bi uvoz
  // spodletel, napake zberemo — uvoznik jih pokaže administratorju v pregled.
  const opozorila = []
  for (const [oznaka, e] of [
    ['domači', ekipe[0]],
    ['gostje', ekipe[1]],
  ]) {
    if (e.postava.length !== 11)
      opozorila.push(
        `${oznaka} (${e.ime}): v postavi je ${e.postava.length} igralcev namesto 11`,
      )
    const vratarjev = e.postava.filter((p) => p.vratar).length
    if (vratarjev !== 1)
      opozorila.push(
        `${oznaka} (${e.ime}): označenih vratarjev je ${vratarjev} namesto 1`,
      )
  }
  const skupajGolov = rezultat.domaci + rezultat.gostje
  if (goli.length !== skupajGolov)
    opozorila.push(
      `strelcev je ${goli.length}, rezultat pa pravi ${skupajGolov} golov`,
    )

  return {
    zapisnikId,
    url,
    sezona: mSezona ? mSezona[1] : null,
    krog: mKrog ? Number(mKrog[1]) : null,
    datum: mDatum ? `20${mDatum[3]}-${mDatum[2]}-${mDatum[1]}` : null,
    domaci: ekipe[0],
    gostje: ekipe[1],
    rezultat,
    polcas,
    goli,
    zgresene,
    rumeni,
    rdeci,
    menjave,
    opozorila,
  }
}

/**
 * Iz razčlenjenega zapisnika izračuna nastope igralcev:
 * minute, goli, avtogoli, kartoni, prejeti goli in clean sheet.
 * Asistence in pozicije se dodajo posebej (glasovanje uporabnikov).
 */
export function nastopi(z) {
  const out = []

  for (const [idx, ekipa] of [z.domaci, z.gostje].entries()) {
    const prejeti = idx === 0 ? z.rezultat.gostje : z.rezultat.domaci
    const menjaveEkipe = z.menjave.filter((m) => m.ekipaIdx === idx)

    const zapis = (ig, zacetnik) => {
      let od = zacetnik ? 0 : null
      let do_ = DOLZINA_TEKME

      const prisel = menjaveEkipe.find((m) => m.noter.st === ig.st)
      const sel = menjaveEkipe.find((m) => m.ven.st === ig.st)
      if (prisel) od = prisel.minuta
      if (sel) do_ = sel.minuta
      if (od == null) return null // rezerva, ki ni vstopila

      // sodniški podaljšek se ne šteje
      const minute = Math.max(0, Math.min(do_, DOLZINA_TEKME) - od)

      const rdec = z.rdeci.find((k) => k.ekipaIdx === idx && k.st === ig.st)
      if (rdec) do_ = Math.min(do_, rdec.minuta)

      const goliIgralca = z.goli.filter(
        (g) => g.ekipaIdx === idx && g.st === ig.st,
      )

      return {
        ekipaIdx: idx,
        ekipa: ekipa.ime,
        st: ig.st,
        ime: ig.ime,
        vratar: Boolean(ig.vratar),
        zacetnik,
        minutaOd: od,
        minutaDo: Math.min(do_, DOLZINA_TEKME),
        minute: Math.max(0, Math.min(do_, DOLZINA_TEKME) - od),
        goli: goliIgralca.filter((g) => !g.avtogol).length,
        goliIzEnajstmetrovke: goliIgralca.filter(
          (g) => !g.avtogol && g.enajstmetrovka,
        ).length,
        avtogoli: goliIgralca.filter((g) => g.avtogol).length,
        zgreseneEnajstmetrovke: z.zgresene.filter(
          (g) => g.ekipaIdx === idx && g.st === ig.st,
        ).length,
        rumeni: z.rumeni.filter((k) => k.ekipaIdx === idx && k.st === ig.st)
          .length,
        rdeci: rdec ? 1 : 0,
        prejetiGoli: prejeti,
        cleanSheet: prejeti === 0,
      }
    }

    for (const ig of ekipa.postava) {
      const n = zapis(ig, true)
      if (n) out.push(n)
    }
    for (const ig of ekipa.rezerve) {
      const n = zapis(ig, false)
      if (n) out.push(n)
    }
  }

  return out
}
