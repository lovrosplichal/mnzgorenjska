// Vir: MNZ Gorenjska (www.mnzgkranj.si)
//
// Vse, kar je značilno za TA vir, je zbrano tu: osnovni naslov, oblika
// naslovov, razčlenjevalnik zapisnikov in preslikava imen klubov. Uvozne
// skripte vira ne poznajo — dobijo ga iz `competitions.source`.
//
// Doslej je bil `IZVOR = 'https://www.mnzgkranj.si'` prepisan v štirih
// datotekah, naslovi pa zgrajeni sproti. Dokler je vir en sam, to ni motilo;
// pri drugem bi pomenilo, da je treba vsako skripto odpreti posebej.
//
// `zapisnik.mjs` in `klubi.mjs` ostajata, kjer sta — tu ju samo ovijemo,
// da sprememba ostane majhna in se obstoječa logika ne prepisuje.
import { parsirajZapisnik, nastopi, vBesedilo } from '../zapisnik.mjs'
import { kljucKluba, kratkoIme, poenostavi } from '../klubi.mjs'

const OSNOVNI = 'https://www.mnzgkranj.si'

export default {
  ime: 'mnzg',
  polnoIme: 'MNZ Gorenjska',
  drzava: 'SI',
  osnovniNaslov: OSNOVNI,

  // --- naslovi -------------------------------------------------------------
  naslovRazporeda: (liga) =>
    `${OSNOVNI}/index.cfm?akc=tekmovanja&liga=${liga}&prikazi=razpored`,

  naslovSeznamaTekem: (liga) =>
    `${OSNOVNI}/index.cfm?akc=tekmovanja&liga=${liga}`,

  naslovZapisnika: (liga, zapisnikId) =>
    `${OSNOVNI}/index.cfm?akc=zapisnik&liga=${liga}&zapisnik=${zapisnikId}`,

  // Parametri `sodnik/delegat/klub/liga1` vklopijo stolpce v izpisu; brez njih
  // stran vrne okrnjeno tabelo brez ur.
  naslovDelegiranja: (liga, krog) =>
    `${OSNOVNI}/print.cfm?prikazi=delegiranje&liga=${liga}` +
    `&krog=${krog}&sodnik=1&delegat=1&klub=1&liga1=1`,

  naslovRegistracij: () => `${OSNOVNI}/index.cfm?akc=registracije`,

  naslovDokumenta: (pot) => `${OSNOVNI}/${encodeURI(pot)}`,

  // --- razčlenjevanje ------------------------------------------------------
  parsirajZapisnik,
  nastopi,
  vBesedilo,

  // --- klubi ---------------------------------------------------------------
  kljucKluba,
  kratkoIme,
  poenostavi,
}
