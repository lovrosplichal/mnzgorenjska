-- Dnevnik poslane e-pošte
--
-- Zakaj: opomnike za nedokončano ekipo pošiljamo iz strežnika (edge function
-- posli-opomnik prek Resend API). Brez dnevnika bi lahko istemu uporabniku
-- v enem dnevu poslali tri opomnike, ko admin večkrat klikne gumb — kar bi
-- prizadelo domensko reputacijo in razjezilo uporabnike.
--
-- Log hrani osnovne meta podatke (komu, kdaj, kateri tip). Vsebine ne
-- shranjujemo, ker jo predloga zgradi vsakič znova iz stanja tekmovanja.

create table if not exists email_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  email text not null,
  vrsta text not null,           -- npr. "opomnik-ekipa"
  competition_id bigint references competitions,
  poslano_at timestamptz not null default now(),
  resend_id text,                -- ID iz Resend odgovora za sledenje
  napaka text                    -- text napake, če pošiljanje ni uspelo
);

create index if not exists email_log_user_idx on email_log(user_id, vrsta, poslano_at desc);

alter table email_log enable row level security;

-- Samo admin lahko bere log; edge function s service role ključem tako ali
-- tako obide RLS, zato posebne INSERT policy ne rabimo.
drop policy if exists "admin bere email log" on email_log;
create policy "admin bere email log" on email_log for select using (is_admin());

-- Pomozna funkcija: koga NE smemo (spet) opomniti — je že dobil enak opomnik
-- v zadnjih 3 dneh za isto tekmovanje. Tri dni je izbrano tako, da zaporedni
-- krogi (Fri/Sat/Sun) ne dobijo istega opozorila dvakrat, hkrati pa naslednji
-- vikend spet gre skozi.
create or replace function nedavni_opomnik(p_user_id uuid, p_competition_id bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from email_log
    where user_id = p_user_id
      and vrsta = 'opomnik-ekipa'
      and competition_id = p_competition_id
      and poslano_at > now() - interval '3 days'
      and napaka is null
  );
$$;
