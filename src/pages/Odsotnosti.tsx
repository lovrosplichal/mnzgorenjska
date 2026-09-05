// Forum: kdo naslednjič ne bo igral.
//
// Zapisnik pove, kdo je igral — ne pa, kdo bo manjkal. To ve skupnost, in
// doslej je bilo to ustno izročilo. Tu je zbrano na enem mestu, urejeno po
// času, z možnostjo filtriranja po vrsti.
//
// Informacija je SAMO informacija: nič od tega ne označi igralca za
// nedosegljivega in ne vpliva na sestavo ekipe.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { useTekmovanje } from '../lib/tekmovanje'
import { prikazniIme } from '../lib/pomozno'
import Grb from '../components/Grb'
import {
  VRSTE,
  VrsticaPorocila,
  type Porocilo,
  type VrstaPorocila,
} from '../components/Odsotnost'

/** Igralec v izbirniku ob objavi. */
interface IgralecIzbira {
  id: number
  full_name: string | null
  team_name?: string | null
}

export default function Odsotnosti() {
  const { session } = useAuth()
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const [porocila, setPorocila] = useState<Porocilo[]>([])
  const [filter, setFilter] = useState<VrstaPorocila | 'vse'>('vse')
  const [nalaganje, setNalaganje] = useState(true)
  const [napaka, setNapaka] = useState<string | null>(null)

  // obrazec
  const [odprt, setOdprt] = useState(false)
  const [iskanje, setIskanje] = useState('')
  const [zadetki, setZadetki] = useState<IgralecIzbira[]>([])
  const [izbran, setIzbran] = useState<IgralecIzbira | null>(null)
  const [vrsta, setVrsta] = useState<VrstaPorocila>('poskodba')
  const [besedilo, setBesedilo] = useState('')
  const [posiljam, setPosiljam] = useState(false)

  useEffect(() => {
    if (!tekmovanjeId) return
    const ligaId = tekmovanjeId
    setNalaganje(true)
    supabase
      .from('player_reports_view')
      .select('*')
      .eq('competition_id', ligaId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setNapaka(error.message)
        else setPorocila((data ?? []) as Porocilo[])
        setNalaganje(false)
      })
  }, [tekmovanjeId])

  // Iskanje igralca ob objavi. Brez izbranega igralca poročilo nima smisla —
  // forum je urejen po igralcih, ne po prostem besedilu.
  useEffect(() => {
    const q = iskanje.trim()
    if (!tekmovanjeId || q.length < 2) return setZadetki([])
    const ligaId = tekmovanjeId
    let preklican = false
    const t = setTimeout(() => {
      supabase
        .from('player_overview')
        .select('id, full_name, team_name')
        .eq('competition_id', ligaId)
        .ilike('full_name', `%${q}%`)
        .order('full_name')
        .limit(8)
        .then(({ data }) => {
          if (!preklican) setZadetki((data ?? []) as IgralecIzbira[])
        })
    }, 250)
    return () => {
      preklican = true
      clearTimeout(t)
    }
  }, [iskanje, tekmovanjeId])

  const vidna = useMemo(
    () => (filter === 'vse' ? porocila : porocila.filter((p) => p.kind === filter)),
    [porocila, filter],
  )

  async function objavi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!session) return setNapaka('Za objavo se moraš prijaviti.')
    if (!izbran) return setNapaka('Najprej izberi igralca.')
    const t = besedilo.trim()
    if (!t) return
    setPosiljam(true)
    setNapaka(null)

    const { data, error } = await supabase
      .from('player_reports')
      .insert({
        player_id: izbran.id,
        user_id: session.user.id,
        kind: vrsta,
        content: t,
      })
      .select('id')
      .single()
    setPosiljam(false)
    if (error) return setNapaka(error.message)

    // Vstavimo na vrh brez ponovnega branja — pogled bi zahteval dodatno
    // poizvedbo samo za ime igralca, ki ga že imamo.
    if (data)
      setPorocila((prej) => [
        {
          id: data.id,
          player_id: izbran.id,
          user_id: session.user.id,
          kind: vrsta,
          content: t,
          created_at: new Date().toISOString(),
          player_name: izbran.full_name,
          team_name: izbran.team_name,
          author_name: null,
        },
        ...prej,
      ])
    setBesedilo('')
    setIzbran(null)
    setIskanje('')
    setOdprt(false)
  }

  async function izbrisi(id: number) {
    const { error } = await supabase.from('player_reports').delete().eq('id', id)
    if (error) return setNapaka(error.message)
    setPorocila((prej) => prej.filter((p) => p.id !== id))
  }

  if (nalaganje) return <p className="animiraj-utrip text-slate-400">Nalaganje …</p>

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-black naslov sm:text-3xl">
          Odsotnosti in poškodbe
          {tekmovanje?.short_name && (
            <span className="ml-2 align-middle text-base font-bold text-slate-500">
              {tekmovanje.short_name.toLowerCase()}
            </span>
          )}
        </h1>
        <p className="max-w-2xl text-slate-400">
          Zapisnik pove, kdo je igral — ne pa, kdo naslednjič ne bo. Če veš, da
          je nekdo poškodovan, kaznovan ali odsoten, povej tukaj.{' '}
          <strong className="text-slate-300">
            To je zgolj informacija za druge
          </strong>{' '}
          — igralca ne odstrani s trga in ne vpliva na točke.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('vse')}
          className={`znacka transition ${
            filter === 'vse'
              ? 'bg-gnl-500 text-slate-950'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          Vse
        </button>
        {VRSTE.map((v) => (
          <button
            key={v.kljuc}
            onClick={() => setFilter(v.kljuc)}
            className={`znacka transition ${
              filter === v.kljuc
                ? 'bg-gnl-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {v.ikona} {v.oznaka}
          </button>
        ))}
        <div className="ml-auto">
          {session ? (
            <button onClick={() => setOdprt(!odprt)} className={odprt ? 'gumb-tih' : 'gumb-glavni'}>
              {odprt ? 'Zapri' : 'Javi odsotnost'}
            </button>
          ) : (
            <Link to="/prijava" className="text-sm text-gnl-300 underline">
              Prijavi se za objavo
            </Link>
          )}
        </div>
      </div>

      {odprt && session && (
        <form onSubmit={objavi} className="kartica animiraj-vstop space-y-3 p-4">
          <div>
            <label className="block text-sm text-slate-400">
              Kdo?
              <input
                value={izbran ? prikazniIme(izbran.full_name) : iskanje}
                onChange={(e) => {
                  setIzbran(null)
                  setIskanje(e.target.value)
                }}
                placeholder="Išči igralca …"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            {!izbran && zadetki.length > 0 && (
              <ul className="mt-1 space-y-1">
                {zadetki.map((z) => (
                  <li key={z.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIzbran(z)
                        setZadetki([])
                      }}
                      className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-left text-sm hover:bg-white/10"
                    >
                      {prikazniIme(z.full_name)}
                      <span className="ml-2 text-xs text-slate-500">{z.team_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {VRSTE.map((v) => (
              <button
                key={v.kljuc}
                type="button"
                onClick={() => setVrsta(v.kljuc)}
                className={`znacka transition ${
                  vrsta === v.kljuc
                    ? 'bg-gnl-500 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {v.ikona} {v.oznaka}
              </button>
            ))}
          </div>

          <textarea
            value={besedilo}
            onChange={(e) => setBesedilo(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Npr. poškodba kolena, po besedah trenerja tri tedne."
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={posiljam || !izbran || !besedilo.trim()}
            className="gumb-glavni w-full sm:w-auto"
          >
            {posiljam ? 'Objavljam …' : 'Objavi'}
          </button>
        </form>
      )}

      {vidna.length === 0 ? (
        <p className="kartica p-6 text-center text-slate-400">
          {porocila.length === 0
            ? 'Še ni poročil. Če veš za koga, ki manjka, bodi prvi.'
            : 'V tej kategoriji ni poročil.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {vidna.map((p) => (
            <VrsticaPorocila
              key={p.id}
              porocilo={p}
              naslov={
                <span className="flex min-w-0 items-center gap-1.5">
                  <Grb
                    ime={p.team_name}
                    kratko={p.team_short}
                    logo={p.team_logo}
                    velikost={18}
                  />
                  <Link
                    to={`/igralec/${p.player_id}`}
                    className="truncate font-semibold hover:text-gnl-300"
                  >
                    {prikazniIme(p.player_name)}
                  </Link>
                </span>
              }
              naIzbris={
                session?.user?.id === p.user_id ? () => izbrisi(p.id) : undefined
              }
            />
          ))}
        </ul>
      )}

      {napaka && <p className="text-sm text-rose-400">Napaka: {napaka}</p>}
    </div>
  )
}
