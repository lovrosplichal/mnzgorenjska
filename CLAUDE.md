# CLAUDE.md

Navodila za Claude Code pri delu na tem projektu.

## O projektu

Fantasy football aplikacija za člansko kategorijo 1. Gorenjske nogometne lige (MNZG Kranj). Uporabniki sestavljajo fantasy ekipe iz realnih igralcev, po vsakem krogu **glasujejo/ocenjujejo predstave igralcev**, in glede na povprečne ocene skupnosti zbirajo točke. Tekmujejo na skupni lestvici.

Ključna razlika od klasičnega fantasyja: točke **ne** temeljijo na uradni statistiki, ampak na glasovanju skupnosti (ocene 1–10 na igralca na krog).

## Tehnološki sklop

- Frontend: React + Vite + Tailwind CSS
- Backend / baza / avtentikacija: Supabase (PostgreSQL)
- Gostovanje: Vercel + Supabase

*(Če se sklad razlikuje od dejanskega stanja repozitorija, sledi dejanskemu stanju in posodobi to datoteko.)*

## Glavni koncepti podatkovnega modela

- `players` → realni igralci, vezani na realni klub (`teams`)
- `fantasy_teams` → ekipe uporabnikov, `fantasy_roster` → izbrani igralci
- `rounds` → krogi sezone
- `ratings` → posamezni glasovi (uporabnik × igralec × krog)
- `player_scores` → agregirane točke igralca na krog

## Smernice za razvoj

- Vsi uporabniško vidni nizi naj bodo v **slovenščini**.
- Ohrani kodo preprosto in berljivo; to je skupnostni projekt, ne enterprise.
- Preden dodaš novo odvisnost, preveri ali je res potrebna.
- Ob spremembi podatkovnega modela posodobi tudi README in to datoteko.

## Ukazi

```bash
npm install      # namestitev odvisnosti
npm run dev      # razvojni strežnik
npm run build    # produkcijski build
```
