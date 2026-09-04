// Ena tekma: obe postavi na igrišču in točke, ki jih je prinesla.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import type { Pozicija } from '../lib/tipi'
import Grb from '../components/Grb'
import IgrisceTocke from '../components/IgrisceTocke'
import GolZaGlasovanje, { caka } from '../components/GolZaGlasovanje'
import type { Gol, Glas, Kandidat } from '../components/GolZaGlasovanje'
import type { NastopNaTekmi } from '../components/IgrisceTocke'
import type { TekmaVrstica } from '../lib/tipi'

/**
 * Nastop na tekmi, kot ga sestavi ta stran: vrstica `appearances` z vlozenim
 * igralcem, sploscenimi imeni in tockami iz `appearance_points`.
 */
type NastopTekme = NastopNaTekmi &
  Kandidat & {
    team_id?: number | null
    players?: { full_name?: string | null; position?: Pozicija | null } | null
  }

const datum = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('sl-SI', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

export default function Tekma() {
  const { id } = useParams()
  // Iz naslova pride niz; stolpec je stevilcen. Doslej je pretvorbo tiho
  // opravil PostgREST, zdaj jo naredimo tu in je razvidna.
  const tekmaId = Number(id)
  const { session } = useAuth()
  const [tekma, setTekma] = useState<TekmaVrstica | null>(null)
  const [nastopi, setNastopi] = useState<NastopTekme[]>([])
  const [goli, setGoli] = useState<Gol[]>([])
  // goal_id -> glasovi, razvrsceni padajoce
  const [glasovi, setGlasovi] = useState<Record<string, Glas[]>>({})
  // goal_id -> igralec, za katerega sem glasoval (null = "brez asistence")
  const [mojiGlasovi, setMojiGlasovi] = useState<Record<string, number | null>>(
    {},
  )
  const [pravkarOddan, setPravkarOddan] = useState<number | null>(null)
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState<string | null>(null)

  useEffect(() => {
    let preklican = false
    async function nalozi() {
      setNalaganje(true)
      // Nastope in tocke beremo iz obstojecih tabel in pogleda appearance_points
      // ter ju zdruzimo tu. Tako stran deluje brez nove migracije v bazi.
      const [
        { data: t, error: eT },
        { data: nastopiTekme, error: eN },
        { data: tockeNastopov, error: eP },
        { data: g, error: eG },
      ] = await Promise.all([
        supabase
          .from('match_assist_status')
          .select('*')
          .eq('match_id', tekmaId)
          .maybeSingle(),
        supabase
          .from('appearances')
          .select(
            'id, team_id, player_id, started, shirt_number, minutes_played, goals, own_goals, penalties_scored, penalties_missed, penalties_saved, yellow_cards, red_cards, goals_conceded, clean_sheet, players(full_name, position)',
          )
          .eq('match_id', tekmaId)
          .order('shirt_number', { nullsFirst: false }),
        supabase
          .from('appearance_points')
          .select('appearance_id, points, assists')
          .eq('match_id', tekmaId),
        supabase
          .from('goals')
          .select(
            'id, minute, is_own_goal, is_penalty, score_home, score_away, team_id, scorer:scorer_id(id, full_name), assist_player_id, assist:assist_player_id(full_name)',
          )
          .eq('match_id', tekmaId)
          .order('minute'),
      ])
      if (preklican) return
      const napacno = eT ?? eN ?? eP ?? eG
      if (napacno) setNapaka(napacno.message)

      const tocke: Record<string, { points?: number | null; assists?: number | null }> =
        Object.fromEntries(
          (tockeNastopov ?? []).map((x: any) => [String(x.appearance_id), x]),
        )
      setTekma((t as TekmaVrstica | null) ?? null)
      setNastopi(
        (nastopiTekme ?? []).map((n: any) => ({
          ...n,
          full_name: n.players?.full_name,
          position: n.players?.position,
          points: tocke[String(n.id)]?.points ?? 0,
          assists: tocke[String(n.id)]?.assists ?? 0,
        })) as NastopTekme[],
      )
      setGoli(((g ?? []) as unknown) as Gol[])
      setNalaganje(false)

      // Glasovi o asistencah — na tej strani se da tudi glasovati.
      const idji = (g ?? []).map((x: any) => x.id as number)
      if (idji.length) osveziGlasove(idji)
    }
    async function osveziGlasove(idji: number[]) {
      const { data: st } = await supabase
        .from('assist_vote_counts')
        .select('goal_id, player_id, votes')
        .in('goal_id', idji)
      if (preklican) return
      const skupine: Record<string, Glas[]> = {}
      for (const x of (st ?? []) as any[])
        (skupine[String(x.goal_id)] ??= []).push({
          player_id: x.player_id,
          votes: x.votes,
        })
      for (const k of Object.keys(skupine))
        skupine[k].sort((a, b) => b.votes - a.votes)
      setGlasovi(skupine)

      if (!session) return setMojiGlasovi({})
      const { data: moji } = await supabase
        .from('assist_votes')
        .select('goal_id, player_id')
        .in('goal_id', idji)
        .eq('voter_id', session.user.id)
      if (preklican) return
      setMojiGlasovi(
        Object.fromEntries(
          (moji ?? []).map((m: any) => [String(m.goal_id), m.player_id]),
        ),
      )
    }

    nalozi()
    return () => {
      preklican = true
    }
  }, [tekmaId, session])

  async function glasuj(golId: number, playerId: number | null) {
    if (!session) return
    setNapaka(null)

    const { error } = await supabase.from('assist_votes').upsert(
      { goal_id: golId, voter_id: session.user.id, player_id: playerId },
      { onConflict: 'goal_id,voter_id' },
    )
    if (error) return setNapaka(error.message)

    setMojiGlasovi({ ...mojiGlasovi, [String(golId)]: playerId })
    setPravkarOddan(golId)
    setTimeout(() => setPravkarOddan(null), 1200)

    // Osveži števce in morebitno potrditev asistence (prag potrdi baza).
    const [{ data: st }, { data: gg }] = await Promise.all([
      supabase
        .from('assist_vote_counts')
        .select('goal_id, player_id, votes')
        .eq('goal_id', golId),
      supabase
        .from('goals')
        .select('id, assist_player_id, assist:assist_player_id(full_name)')
        .eq('id', golId)
        .single(),
    ])
    setGlasovi((prej) => ({
      ...prej,
      [String(golId)]: ((st ?? []) as any[])
        .map((x) => ({ player_id: x.player_id, votes: x.votes }))
        .sort((a, b) => b.votes - a.votes),
    }))
    if (gg)
      setGoli((prej) =>
        prej.map((x) =>
          x.id === golId
            ? {
                ...x,
                assist_player_id: gg.assist_player_id,
                assist: gg.assist as Gol['assist'],
              }
            : x,
        ),
      )
  }

  if (nalaganje)
    return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>

  if (!tekma)
    return (
      <div className="space-y-3">
        <p className="text-slate-400">Te tekme ni v zapisnikih.</p>
        <Link to="/rezultati" className="gumb-tih inline-block">
          ← Rezultati
        </Link>
      </div>
    )

  // Koliko golov te tekme še čaka na odločitev skupnosti. Enajstmetrovke,
  // avtogoli in goli, pri katerih je zmagalo »brez asistence«, ne čakajo.
  const cakajocih = goli.filter((g) => caka(g, glasovi[String(g.id)] ?? [])).length

  // Nastopi so v isti tabeli za obe ekipi; razdelimo jih po klubu.
  const domaci = nastopi.filter((n) => n.team_id === tekma.home_team_id)
  const gostje = nastopi.filter((n) => n.team_id === tekma.away_team_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/rezultati" className="text-sm text-slate-400 hover:text-gnl-300">
          ← Rezultati
        </Link>
        <span className="text-sm text-slate-500">
          {tekma.round_number}. krog · {tekma.season}
          {tekma.played_on && ` · ${datum(tekma.played_on)}`}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gnl-800/50 to-slate-900/50 p-3 text-center ring-1 ring-white/10 sm:gap-4 sm:p-5">
        <Grb ime={tekma.home_name} kratko={tekma.home_short} logo={tekma.home_logo} velikost={32} />
        <span className="min-w-0 flex-1 text-right text-sm font-bold sm:text-base">
          {tekma.home_name}
        </span>
        <span className="rounded-xl bg-slate-950 px-3 py-2 text-xl font-black tabular-nums sm:px-4 sm:text-2xl">
          {tekma.home_goals} : {tekma.away_goals}
        </span>
        <span className="min-w-0 flex-1 text-left text-sm font-bold sm:text-base">
          {tekma.away_name}
        </span>
        <Grb ime={tekma.away_name} kratko={tekma.away_short} logo={tekma.away_logo} velikost={32} />
      </div>

      {nastopi.length === 0 ? (
        <p className="kartica p-4 text-slate-400">
          Zapisnik te tekme ne navaja postav, zato točk po igralcih ni mogoče
          prikazati.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            Na dresu piše, koliko točk je igralec zaslužil na tej tekmi.
            Klik na igralca odpre njegovo stran.
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            <IgrisceTocke
              ekipa={{
                ime: tekma.home_name,
                kratko: tekma.home_short,
                logo: tekma.home_logo,
              }}
              nastopi={domaci}
            />
            <IgrisceTocke
              ekipa={{
                ime: tekma.away_name,
                kratko: tekma.away_short,
                logo: tekma.away_logo,
              }}
              nastopi={gostje}
            />
          </div>
        </>
      )}

      {cakajocih > 0 && (
        <p className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">
          🅰️ {cakajocih}{' '}
          {cakajocih === 1 ? 'gol na tej tekmi čaka' : 'golov na tej tekmi čaka'} na
          asistenco — dokler je ni, podajalec ostane brez +3 točk. Povej spodaj,
          kdo je podal.
        </p>
      )}

      {goli.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Goli in asistence</h2>
            {!session && (
              <Link to="/prijava" className="text-sm text-gnl-300 underline">
                Prijavi se za glasovanje
              </Link>
            )}
          </div>
          <ul className="space-y-3">
            {goli.map((g) => (
              <GolZaGlasovanje
                key={g.id}
                gol={g}
                tekma={tekma}
                kandidati={nastopi.filter(
                  (n) =>
                    n.team_id === g.team_id &&
                    n.player_id !== g.scorer?.id &&
                    Number(n.minutes_played ?? 0) > 0,
                )}
                nastopi={nastopi}
                glasovi={glasovi[String(g.id)] ?? []}
                mojGlas={mojiGlasovi[String(g.id)]}
                omogoceno={Boolean(session)}
                pravkar={pravkarOddan === g.id}
                onGlasuj={glasuj}
              />
            ))}
          </ul>
        </section>
      )}
      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}
