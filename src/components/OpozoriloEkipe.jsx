import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { useTekmovanje } from '../lib/tekmovanje'
import { preveriEkipo } from '../lib/pravila'

/**
 * Stalen pas nad glavno vsebino — dokler ekipa ni sestavljena in veljavna,
 * uporabniku pove, kaj konkretno še manjka. Prijava, ki ekipe sploh nima,
 * ta pas prikaže velik in vabeč: brez ekipe ni točk v naslednjem krogu.
 *
 * Skrijemo ga na strani Moja ekipa (uporabnik je že tam, popravlja) in na
 * strani Prijava/Novo geslo (preusmeritvene). Če ni prijave ali ni izbrane
 * lige, ne prikažemo nič — potem itak ne moremo preveriti ekipe.
 */
export default function OpozoriloEkipe() {
  const { session, loading } = useAuth()
  const { id: tekmovanjeId, tekmovanje } = useTekmovanje()
  const { pathname } = useLocation()
  const [napake, setNapake] = useState(null)
  const [imaEkipo, setImaEkipo] = useState(null) // null=še ne vem, true/false po poizvedbi
  const [nalaganje, setNalaganje] = useState(true)

  useEffect(() => {
    if (loading || !tekmovanjeId) return
    if (!session) {
      setNalaganje(false)
      return
    }
    let odjava = false
    async function preveri() {
      setNalaganje(true)
      // Ekipa uporabnika v tem tekmovanju
      const { data: ekipa } = await supabase
        .from('fantasy_teams')
        .select('id, name')
        .eq('owner_id', session.user.id)
        .eq('competition_id', tekmovanjeId)
        .maybeSingle()
      if (odjava) return
      if (!ekipa) {
        setImaEkipo(false)
        setNapake([])
        setNalaganje(false)
        return
      }
      setImaEkipo(true)
      // Roster s cenami in pozicijami za validacijo
      const { data: roster } = await supabase
        .from('fantasy_roster')
        .select(
          'is_starter, is_captain, is_vice, buy_position, players(id, position, team_id, value)',
        )
        .eq('fantasy_team_id', ekipa.id)
      if (odjava) return
      const izbrani = (roster ?? [])
        .map((r) => ({
          is_starter: r.is_starter,
          is_captain: r.is_captain,
          is_vice: r.is_vice,
          // Mesto v kadru je tisto ob nakupu — enako sodi baza, sicer bi pas
          // opozarjal na kader, ki je v resnici v redu.
          position: r.buy_position ?? r.players?.position ?? null,
          team_id: r.players?.team_id ?? null,
          value: Number(r.players?.value ?? 0),
        }))
      setNapake(preveriEkipo(izbrani))
      setNalaganje(false)
    }
    preveri()
    return () => {
      odjava = true
    }
  }, [session, loading, tekmovanjeId, pathname])

  if (loading || nalaganje) return null
  if (!session) return null
  // Skrij na straneh, kjer bi bilo moteče ali odveč.
  if (
    pathname.startsWith('/moja-ekipa') ||
    pathname.startsWith('/prijava') ||
    pathname.startsWith('/novo-geslo') ||
    pathname.startsWith('/pravno')
  )
    return null
  if (imaEkipo === null) return null

  const oznakaLige = tekmovanje?.short_name?.toLowerCase()

  // 1) Uporabnik ekipe še sploh nima
  if (!imaEkipo) {
    return (
      <div className="border-b border-amber-400/40 bg-amber-500/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-sm text-amber-100 sm:gap-3">
          <span className="text-lg leading-none">⚠</span>
          <span className="min-w-0 flex-1 font-semibold">
            Nimaš še ekipe
            {oznakaLige && (
              <span className="ml-1 font-normal text-amber-200/80">
                ({oznakaLige})
              </span>
            )}{' '}
            — brez nje v naslednjem krogu ne dobiš točk.
          </span>
          <Link
            to="/moja-ekipa"
            className="shrink-0 rounded-lg bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 hover:bg-amber-300"
          >
            Sestavi ekipo →
          </Link>
        </div>
      </div>
    )
  }

  // 2) Ekipa obstaja, a ima napake — prikaži konkretno, kaj še naredi
  if (napake && napake.length > 0) {
    return (
      <div className="border-b border-rose-400/40 bg-rose-500/10">
        <div className="mx-auto max-w-6xl px-4 py-2 text-sm text-rose-100">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg leading-none">🚨</span>
            <span className="font-black">
              Tvoja ekipa
              {oznakaLige && (
                <span className="ml-1 font-normal text-rose-200/80">
                  ({oznakaLige})
                </span>
              )}{' '}
              NE bo dobila točk v naslednjem krogu.
            </span>
            <Link
              to="/moja-ekipa"
              className="ml-auto shrink-0 rounded-lg bg-rose-400 px-3 py-1 text-xs font-black text-slate-950 hover:bg-rose-300"
            >
              Popravi →
            </Link>
          </div>
          <ul className="mt-1 ml-6 list-disc space-y-0.5 text-xs text-rose-100/90">
            {napake.slice(0, 4).map((n) => (
              <li key={n}>{n}</li>
            ))}
            {napake.length > 4 && (
              <li className="text-rose-200/70">
                … in še {napake.length - 4}
              </li>
            )}
          </ul>
        </div>
      </div>
    )
  }

  return null
}
