// Kartica gola z glasovanjem o asistenci. Ista je na strani Asistence in na
// strani posamezne tekme, zato živi tu.
//
// Kdaj je glasovanje zaključeno:
//   - asistenca je potrjena (dovolj glasov za istega igralca) — od tod naprej
//     je zaklenjeno, glasovi ne morejo več ničesar spremeniti,
//   - skupnost je z dovolj glasovi rekla »nihče« — gol ostane brez asistence
//     in prav tako ne čaka več,
//   - gol je bil iz enajstmetrovke ali avtogol — asistence po pravilih ni.
import { useState } from 'react'
import { prikazniIme, razredPozicije, KRATKA_POZICIJA } from '../lib/pomozno'
import type { Pozicija } from '../lib/tipi'

/** Gol, o katerem skupnost glasuje o asistenci. */
export interface Gol {
  id: number
  minute?: number | null
  team_id?: number | null
  is_own_goal?: boolean | null
  is_penalty?: boolean | null
  assist_player_id?: number | null
  score_home?: number | null
  score_away?: number | null
  scorer?: { id?: number | null; full_name?: string | null } | null
  assist?: { full_name?: string | null } | null
}

export interface Tekma {
  home_team_id?: number | null
  home_name?: string | null
  away_name?: string | null
}

/** Nastop na tekmi — kandidat za asistenco. */
export interface Kandidat {
  player_id: number
  shirt_number?: number | null
  team_id?: number | null
  minutes_played?: number | null
  players?: { full_name?: string | null; position?: Pozicija | null } | null
}

/** Seštevek glasov za enega kandidata; `player_id: null` pomeni "brez asistence". */
export interface Glas {
  player_id: number | null
  votes: number
}

export const PRAG_ASISTENCE = 3

/**
 * Številka dresa — neposredno iz zapisnika te tekme, ne iz profila igralca
 * (dres se med sezono lahko zamenja). Enak podpis kot v zapisniku ("16 —
 * Priimek Ime"), da je iskanje pravega podajalca na igrišču hitrejše.
 */
function StDres({ st }: { st?: number | null }) {
  if (st == null) return null
  return (
    <span className="znacka shrink-0 bg-white/10 font-mono tabular-nums text-slate-400">
      {st}
    </span>
  )
}

/** Ali gol sploh lahko dobi asistenco. */
export const lahkoImaAsistenco = (gol: Gol) => !gol.is_own_goal && !gol.is_penalty

/** Ali je skupnost odločila, da gol nima asistence. */
// `_gol` se ne bere — odlocijo samo glasovi. Parameter ostaja zaradi klicnih
// mest, ki ga podajajo, in ker je simetricen z `lahkoImaAsistenco(gol)`.
export const brezAsistencePotrjeno = (_gol: Gol, glasovi: Glas[] = []) => {
  const vodilni = glasovi[0]
  return Boolean(
    vodilni && vodilni.player_id == null && vodilni.votes >= PRAG_ASISTENCE,
  )
}

/** Ali gol še čaka na odločitev skupnosti. */
export const caka = (gol: Gol, glasovi: Glas[] = []) =>
  lahkoImaAsistenco(gol) &&
  !gol.assist_player_id &&
  !brezAsistencePotrjeno(gol, glasovi)

function Zakljucek({
  gol,
  ikona,
  besedilo,
  opomba,
}: {
  gol: Gol
  ikona: string
  besedilo: string
  opomba: string
}) {
  return (
    <li className="kartica p-4 opacity-70">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-12 shrink-0 text-center font-black tabular-nums text-slate-500">
          {gol.minute}&apos;
        </span>
        <span className="text-lg">{ikona}</span>
        <span className="min-w-0 flex-1 truncate text-slate-300">
          {besedilo}
        </span>
        <span className="znacka bg-white/10 text-slate-400">{opomba}</span>
      </div>
    </li>
  )
}

export default function GolZaGlasovanje({
  gol,
  tekma,
  kandidati,
  nastopi = kandidati,
  glasovi = [],
  mojGlas,
  omogoceno,
  pravkar,
  onGlasuj,
}: {
  gol: Gol
  tekma?: Tekma | null
  kandidati: Kandidat[]
  nastopi?: Kandidat[]
  glasovi?: Glas[]
  mojGlas?: number | null
  omogoceno?: boolean
  pravkar?: boolean
  onGlasuj: (golId: number, playerId: number | null) => void
}) {
  const [odprto, setOdprto] = useState(false)
  const potrjeno = Boolean(gol.assist_player_id)
  const stGlasov: Record<string, number> = Object.fromEntries(
    glasovi.map((v) => [String(v.player_id), v.votes]),
  )
  const vodilni = glasovi[0]
  const brezAsistence = brezAsistencePotrjeno(gol, glasovi)
  const zakljuceno = potrjeno || brezAsistence

  // Strelec je iz `kandidati` izločen (nihče si ne da asistence), zato
  // njegovo številko poiščemo v vseh nastopih tekme, ne v seznamu kandidatov.
  const stDresa: Record<string, number | null | undefined> = Object.fromEntries(
    (nastopi ?? []).map((n) => [String(n.player_id), n.shirt_number]),
  )

  const domaci = gol.team_id === tekma?.home_team_id
  const ekipa = {
    name: domaci ? tekma?.home_name : tekma?.away_name,
  }

  const ime = prikazniIme(gol.scorer?.full_name) || 'neznan strelec'

  if (gol.is_own_goal)
    return (
      <Zakljucek
        gol={gol}
        ikona="🙈"
        besedilo={`Avtogol — ${ime}`}
        opomba="brez asistence"
      />
    )

  // Enajstmetrovka: strelec je sam pri žogi, asistence ni in o njej se ne
  // glasuje. Prej se je zanjo dalo glasovati in je gol večno čakal.
  if (gol.is_penalty)
    return (
      <Zakljucek
        gol={gol}
        ikona="⚽"
        besedilo={`${ime} — enajstmetrovka`}
        opomba="brez asistence"
      />
    )

  return (
    <li className={`kartica overflow-hidden ${pravkar ? 'animiraj-pulz' : ''}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="w-12 shrink-0 rounded-lg bg-slate-950 py-1 text-center font-black tabular-nums text-gnl-300">
          {gol.minute}&apos;
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">⚽</span>
            <StDres st={stDresa[String(gol.scorer?.id)]} />
            <strong className="truncate">{ime}</strong>
          </div>
          <div className="text-xs text-slate-500">
            {ekipa?.name} · {gol.score_home}:{gol.score_away}
          </div>
        </div>

        {potrjeno && (
          <div className="flex items-center gap-2 rounded-xl bg-gnl-500/15 px-3 py-2 ring-1 ring-gnl-400/30">
            <span>🅰️</span>
            <div className="text-sm">
              <div className="flex items-center gap-1.5 font-bold text-gnl-200">
                <StDres st={stDresa[String(gol.assist_player_id)]} />
                {prikazniIme(gol.assist?.full_name)}
              </div>
              <div className="text-xs text-gnl-400/80">
                asistenca potrjena — zaklenjeno
              </div>
            </div>
          </div>
        )}

        {!potrjeno && brezAsistence && (
          <div className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
            <div className="font-bold text-slate-200">Brez asistence</div>
            <div className="text-xs text-slate-500">
              tako je odločila skupnost
            </div>
          </div>
        )}

        {!zakljuceno && (
          <button
            onClick={() => setOdprto(!odprto)}
            disabled={!omogoceno}
            className={odprto ? 'gumb-tih' : 'gumb-glavni'}
            title={omogoceno ? undefined : 'Za glasovanje se moraš prijaviti'}
          >
            {odprto ? 'Zapri' : mojGlas !== undefined ? 'Spremeni glas' : 'Kdo je podal?'}
          </button>
        )}
      </div>

      {/* Napredek do praga je viden tudi pod pragom, da uporabnik ve, koliko
          glasov je zbranih in kdo vodi. */}
      {!zakljuceno && vodilni && (
        <div className="space-y-2 border-t border-white/5 bg-slate-950/30 px-4 pb-3 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm">
              {vodilni.player_id == null ? (
                <strong className="text-slate-200">Vodi »brez asistence«</strong>
              ) : (
                <>
                  Vodi{' '}
                  <strong className="text-gnl-200">
                    {stDresa[String(vodilni.player_id)] != null &&
                      `${stDresa[String(vodilni.player_id)]} — `}
                    {prikazniIme(
                      kandidati.find((k) => k.player_id === vodilni.player_id)
                        ?.players?.full_name,
                    ) || 'igralec brez zapisa'}
                  </strong>
                </>
              )}
            </div>
            <span className="tabular-nums text-sm font-black text-gnl-300">
              {vodilni.votes} / {PRAG_ASISTENCE}{' '}
              <span className="text-xs font-normal text-slate-500">
                — še {Math.max(0, PRAG_ASISTENCE - vodilni.votes)} do odločitve
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gnl-500 to-gnl-300 transition-all duration-300"
              style={{
                width: `${Math.min(100, (vodilni.votes / PRAG_ASISTENCE) * 100)}%`,
              }}
            />
          </div>
          {glasovi.length > 1 && (
            <div className="text-xs text-slate-500">
              Ostali:{' '}
              {glasovi
                .slice(1)
                .map((g) =>
                  g.player_id == null
                    ? `brez (${g.votes})`
                    : `${
                        stDresa[String(g.player_id)] != null
                          ? `${stDresa[String(g.player_id)]} — `
                          : ''
                      }${
                        prikazniIme(
                          kandidati.find((k) => k.player_id === g.player_id)
                            ?.players?.full_name,
                        ) || '?'
                      } (${g.votes})`,
                )
                .join(' · ')}
            </div>
          )}
        </div>
      )}

      {odprto && !zakljuceno && (
        <div className="animiraj-vstop border-t border-white/10 bg-slate-950/40 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
            Izberi podajalca — {ekipa?.name}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {kandidati.map((k) => {
              const izbran = mojGlas === k.player_id
              const n = stGlasov[String(k.player_id)] ?? 0
              return (
                <button
                  key={k.player_id}
                  onClick={() => onGlasuj(gol.id, k.player_id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    izbran
                      ? 'bg-gnl-500/25 ring-2 ring-gnl-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <StDres st={k.shirt_number} />
                  <span className={`znacka shrink-0 ${razredPozicije(k.players?.position)}`}>
                    {(k.players?.position && KRATKA_POZICIJA[k.players.position]) ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {prikazniIme(k.players?.full_name)}
                  </span>
                  {n > 0 && (
                    <span className="tabular-nums text-xs text-slate-400">{n}</span>
                  )}
                  {izbran && <span className="text-gnl-300">✓</span>}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onGlasuj(gol.id, null)}
            // mojGlas je null, če je uporabnik glasoval za "nihče",
            // in undefined, če še ni glasoval
            className={`mt-3 w-full rounded-xl px-3 py-2 text-sm transition ${
              mojGlas === null
                ? 'bg-white/15 ring-1 ring-white/30'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            Nihče — gol brez asistence
          </button>
        </div>
      )}
    </li>
  )
}
