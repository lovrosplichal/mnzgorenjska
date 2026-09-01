// Edge Function: posli-opomnik
//
// Poslje e-poštni opomnik uporabnikom, ki v izbrani ligi še nimajo veljavne
// fantasy ekipe. Kdo dobi mail, določi RPC admin_uporabniki v bazi — enak
// vir kot admin stran, da UI in server vidita isto sliko.
//
// Zahteva se dostopa preko admin računa (Authorization: Bearer <access_token>);
// funkcija to preveri z is_admin() klicem prek anon supabase klienta.
//
// Vsak poskus pošiljanja se zapiše v tabelo email_log — z ali brez napake.
// Tabela služi za dvoje: 1) da ne pošljemo istega opomnika dvakrat v 3 dneh
// (glej funkcijo nedavni_opomnik), 2) za sledenje in reševanje težav, če
// kdo reče "nisem dobil".
//
// Skrivnosti pridemo iz Supabase env: RESEND_API_KEY, EMAIL_FROM, in privzeto
// nastavljeni SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (dodeljena vsem edge
// funkcijam avtomatsko).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Zahteva {
  competition_id: number
  test_email?: string // če je nastavljen, gre samo test mail nanj (za preizkus)
  suho?: boolean // dry-run: samo prešteje, ne pošilja
}

interface Uporabnik {
  user_id: string
  email: string
  display_name: string | null
  team_id: number | null
  ekipa_veljavna: boolean
}

interface ResendOdgovor {
  id?: string
  message?: string
  name?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')
    return json({ error: 'Samo POST.' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Manjka Authorization.' }, 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'SLFF <noreply@slff.eu>'

  if (!RESEND_KEY)
    return json({ error: 'Pomanjkljiva nastavitev: RESEND_API_KEY.' }, 500)

  // 1) Preveri, ali kliče admin (skozi anon klienta z uporabnikovim tokenom).
  const uporabnikov = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })
  const { data: adminOk, error: adminErr } = await uporabnikov.rpc('is_admin')
  if (adminErr) return json({ error: adminErr.message }, 500)
  if (!adminOk) return json({ error: 'Samo administrator.' }, 403)

  // 2) Parsiraj vhod.
  let vhod: Zahteva
  try {
    vhod = await req.json()
  } catch {
    return json({ error: 'Neveljaven JSON.' }, 400)
  }
  const { competition_id, test_email, suho } = vhod
  if (!competition_id)
    return json({ error: 'Manjka competition_id.' }, 400)

  // 3) Beri seznam uporabnikov brez veljavne ekipe (s service role, ker
  //    RPC admin_uporabniki bi tudi delal, a je varneje eksplicitno filtrirati).
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: vsi, error: rpcErr } = await service.rpc('admin_uporabniki', {
    p_competition_id: competition_id,
  })
  if (rpcErr) return json({ error: rpcErr.message }, 500)

  const kandidati: Uporabnik[] = (vsi ?? []).filter(
    (u: Uporabnik) => !u.ekipa_veljavna && u.email,
  )

  // Podatek o ligi za predlogo
  const { data: liga } = await service
    .from('competitions')
    .select('slug, name, short_name')
    .eq('id', competition_id)
    .maybeSingle()
  const oznaka = liga?.short_name ?? ''

  // Test režim: pošlji samo en mail na testni naslov, brez preverbe za log.
  if (test_email) {
    const rez = await posljiEnega(RESEND_KEY, EMAIL_FROM, test_email, oznaka, {
      display_name: 'Test',
      brez_ekipe: false,
    })
    return json({ test: true, resend: rez })
  }

  if (suho)
    return json({ suho: true, kandidati_stevilo: kandidati.length })

  // 4) Za vsakega: preveri, ali je nedavno dobil isti opomnik; če ne, pošlji.
  const rezultati: Array<{
    email: string
    ok: boolean
    razlog?: string
    resend_id?: string
  }> = []
  for (const u of kandidati) {
    const { data: nedavni } = await service.rpc('nedavni_opomnik', {
      p_user_id: u.user_id,
      p_competition_id: competition_id,
    })
    if (nedavni) {
      rezultati.push({ email: u.email, ok: false, razlog: 'nedavno poslano' })
      continue
    }

    const rez = await posljiEnega(RESEND_KEY, EMAIL_FROM, u.email, oznaka, {
      display_name: u.display_name ?? '',
      brez_ekipe: !u.team_id,
    })

    await service.from('email_log').insert({
      user_id: u.user_id,
      email: u.email,
      vrsta: 'opomnik-ekipa',
      competition_id,
      resend_id: rez.id ?? null,
      napaka: rez.napaka ?? null,
    })

    rezultati.push({
      email: u.email,
      ok: !rez.napaka,
      razlog: rez.napaka,
      resend_id: rez.id,
    })
  }

  return json({
    kandidati_stevilo: kandidati.length,
    poslano: rezultati.filter((r) => r.ok).length,
    preskoceno: rezultati.filter((r) => !r.ok).length,
    rezultati,
  })
})

async function posljiEnega(
  apiKey: string,
  from: string,
  to: string,
  ozn: string,
  meta: { display_name: string; brez_ekipe: boolean },
): Promise<{ id?: string; napaka?: string }> {
  const naslov = meta.brez_ekipe
    ? `SLFF ${ozn} — še nimaš ekipe za naslednji krog`
    : `SLFF ${ozn} — dokončaj ekipo pred naslednjim krogom`

  const uvod = meta.display_name
    ? `Živjo, ${meta.display_name.split(' ')[0]}!`
    : 'Živjo!'

  const glavno = meta.brez_ekipe
    ? `V ${ozn.toUpperCase()} še nimaš sestavljene fantasy ekipe. Brez nje v naslednjem krogu ne dobiš točk.`
    : `Tvoja fantasy ekipa v ${ozn.toUpperCase()} še ni popolna (manjka kader, kapetan, namestnik ali podobno). Brez veljavne ekipe v naslednjem krogu ne dobiš točk.`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <p style="font-size: 18px; font-weight: 700; margin: 0 0 12px;">${uvod}</p>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 20px;">${glavno}</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="https://slff.eu/moja-ekipa" style="display: inline-block; background: #22c55e; color: #052e16; text-decoration: none; font-weight: 800; padding: 12px 20px; border-radius: 10px;">
          Sestavi / popravi ekipo →
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 20px 0 0;">
        Če opomnika ne rabiš (ekipe letos ne boš sestavil/a), lahko ta mail ignoriraš.
        Naslednjič ti bomo pisali šele pred naslednjim krogom.
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
        SLFF — Sunday League Fantasy Football · slff.eu
      </p>
    </div>
  `

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject: naslov, html }),
    })
    const odgovor: ResendOdgovor = await r.json()
    if (!r.ok) return { napaka: odgovor.message ?? `HTTP ${r.status}` }
    return { id: odgovor.id }
  } catch (e) {
    return { napaka: String(e) }
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
