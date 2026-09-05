-- Forum za odsotnosti in poškodbe.
--
-- Zapisnik pove, kdo je igral, ne pa, kdo naslednjič ne bo. To ve skupnost:
-- kdo se je poškodoval, kdo je kaznovan, kdo je odpotoval. Doslej je bilo to
-- ustno izročilo; tu dobi mesto.
--
-- NAMENOMA samo informativno. Poročilo ne označi igralca za nedosegljivega in
-- ne vpliva na sestavo ekipe. Če bi vplivalo, bi lažna prijava postala orodje
-- za sabotažo tekmeca in bi potrebovali prag glasov, kot ga imata asistenca in
-- pozicija. To je zavestna meja, ne pozabljena funkcija.
--
-- Za razliko od klepeta (`chat_messages`) tu NI psevdonima. Klepet je anonimen,
-- ker je namenjen kritiki; tu gre za dejstva o soigralcih, kjer ime piscu
-- doda težo — in prikazna imena so na lestvici tako ali tako javna.

create table if not exists player_reports (
  id         bigint generated always as identity primary key,
  player_id  bigint not null references players on delete cascade,
  user_id    uuid   not null references profiles on delete cascade,
  kind       text   not null check (kind in ('poskodba', 'odsotnost', 'vrnitev', 'drugo')),
  content    text   not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table player_reports is
  'Skupnostna poročila o odsotnostih in poškodbah. Samo informativno — ne vplivajo na sestavo ekipe ne na točke.';
comment on column player_reports.kind is
  'poskodba | odsotnost | vrnitev | drugo — za ikono in filtriranje.';

-- Bralne poti: vsa poročila enega igralca, in zadnja poročila za forum.
create index if not exists player_reports_igralec_idx
  on player_reports (player_id, created_at desc);
create index if not exists player_reports_cas_idx
  on player_reports (created_at desc);

alter table player_reports enable row level security;

create policy "javno branje" on player_reports for select using (true);

create policy "prijavljeni objavlja" on player_reports for insert
  with check (auth.uid() = user_id);

create policy "avtor izbrise svoje" on player_reports for delete
  using (auth.uid() = user_id);

create policy "admin brise vse" on player_reports for delete
  using (is_admin());

-- --------------------------------------------------------------------------
-- Pogled za prikaz
-- --------------------------------------------------------------------------
-- Stran potrebuje ob poročilu še igralca, njegov klub in avtorja. Brez pogleda
-- bi vsaka stran to spajala sama in vsakič malo drugače.
create or replace view player_reports_view as
  select r.id,
         r.player_id,
         r.user_id,
         r.kind,
         r.content,
         r.created_at,
         -- `full_name` je pri delu igralcev prazen (seme, in igralci, ki so
         -- v bazo prišli brez njega) — takrat ime sestavimo iz priimka in
         -- imena, sicer bi stran pokazala prazno vrstico.
         coalesce(
           nullif(btrim(p.full_name), ''),
           btrim(coalesce(p.last_name, '') || ' ' || coalesce(p.first_name, ''))
         ) as player_name,
         p.competition_id,
         t.id             as team_id,
         t.name           as team_name,
         t.short_name     as team_short,
         t.logo_url       as team_logo,
         pr.display_name  as author_name
    from player_reports r
    join players  p  on p.id = r.player_id
    left join teams t on t.id = p.team_id
    left join profiles pr on pr.id = r.user_id;

comment on view player_reports_view is
  'Poročila skupaj z igralcem, klubom in avtorjem — za stran Odsotnosti in za stran igralca.';
