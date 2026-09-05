-- Države nad tekmovanji, in vir podatkov kot lastnost tekmovanja.
--
-- Doslej je bilo vse implicitno eno: ena država (Slovenija), ena regijska
-- zveza (MNZ Gorenjska), dve tekmovanji. Za širitev najprej na druge
-- slovenske lige in pozneje na tuje je treba to zapisati eksplicitno.
--
-- Vmesne ravni (zveza/regija) namenoma NI. Na `competitions` kažejo štiri
-- tabele, na morebitno `federations` pa ne bi kazalo nič razen `competitions`
-- — zato jo je pozneje poceni dodati, zdaj pa bi bila prazna struktura z eno
-- vrstico. Ko se bo nastavitev vira ponavljala čez devet MNZ regij, jo bomo
-- dvignili; takrat bo oblika znana, ne ugibana.

-- --------------------------------------------------------------------------
-- 1. Države
-- --------------------------------------------------------------------------
create table if not exists countries (
  id         bigint primary key generated always as identity,
  code       text    not null unique,   -- ISO 3166-1 alpha-2: SI, AT, HR
  name       text    not null,
  sort_order integer not null default 0,
  active     boolean not null default true
);

comment on table countries is
  'Država tekmovanja. Klubi in tekmovanja so vezani nanjo; imena klubov so unikatna znotraj države, ne globalno.';

insert into countries (code, name, sort_order)
values ('SI', 'Slovenija', 1)
on conflict (code) do nothing;

alter table countries enable row level security;

drop policy if exists "drzave so javne" on countries;
create policy "drzave so javne" on countries
  for select using (true);

drop policy if exists "admin ureja drzave" on countries;
create policy "admin ureja drzave" on countries
  for all using (is_admin()) with check (is_admin());

-- --------------------------------------------------------------------------
-- 2. Tekmovanje pripada državi in ve, od kod so njegovi podatki
-- --------------------------------------------------------------------------
-- `mnzg_liga` je bil stolpec ENEGA vira na splošni tabeli: 1601 in 1603 sta
-- šifri MNZ Gorenjska. Razdelimo ga na to, kdo je vir, in na njegovo šifro —
-- vsak nadaljnji vir bo potreboval oboje.
alter table competitions add column if not exists country_id bigint references countries(id);
alter table competitions add column if not exists source text;
alter table competitions add column if not exists source_league_code text;

update competitions
   set country_id = (select id from countries where code = 'SI')
 where country_id is null;

update competitions
   set source = coalesce(source, 'mnzg'),
       source_league_code = coalesce(source_league_code, mnzg_liga)
 where source is null or source_league_code is null;

alter table competitions alter column country_id set not null;
alter table competitions alter column source set not null;

comment on column competitions.source is
  'Kateri vir zna prebrati to tekmovanje — mapa v scripts/viri/ (npr. "mnzg").';
comment on column competitions.source_league_code is
  'Šifra lige pri viru. Pri MNZ Gorenjska npr. 1601 (člani), 1603 (mladinci).';

-- `mnzg_liga` ostane še naprej, dokler ga skripte ne nehajo brati; podvojen
-- podatek je manjše zlo od migracije, ki se ne da vrniti. Odstrani ga
-- naslednja migracija, ko bo uvoz dokazano tekel na `source_league_code`.
comment on column competitions.mnzg_liga is
  'OPUŠČENO — uporabi source_league_code. Ostane samo za prehodno obdobje.';

-- --------------------------------------------------------------------------
-- 3. Klub pripada državi; ime je unikatno ZNOTRAJ nje
-- --------------------------------------------------------------------------
-- Trki imen čez mejo niso teoretični: Dinamo, Rudar, Sloga in Olimpija
-- obstajajo v več nekdanjih jugoslovanskih ligah. Globalna unikatnost bi ob
-- prvi tuji ligi zavrnila uvoz povsem legitimnega kluba.
--
-- `teams` je najbolj obremenjena tabela (nanjo kaže šest tujih ključev), na
-- teh dveh indeksih pa slonita zdruzi-klube.mjs in ujemanje klubov ob uvozu.
-- Zato to naredimo zdaj, pri 18 klubih, ne pozneje pri 400.
alter table teams add column if not exists country_id bigint references countries(id);

update teams
   set country_id = (select id from countries where code = 'SI')
 where country_id is null;

alter table teams alter column country_id set not null;

drop index if exists teams_poenostavljeno_ime_idx;
alter table teams drop constraint if exists teams_name_key;

create unique index if not exists teams_drzava_ime_idx
  on teams (country_id, name);

create unique index if not exists teams_drzava_poenostavljeno_ime_idx
  on teams (country_id, poenostavljeno_ime(name));

comment on column teams.country_id is
  'Država kluba. Ime kluba je unikatno znotraj države — isto ime v drugi državi je drug klub.';

-- --------------------------------------------------------------------------
-- 4. Pogled: tekmovanja z državo, da vmesniku ni treba spajati
-- --------------------------------------------------------------------------
create or replace view competitions_view as
  select c.*,
         d.code as country_code,
         d.name as country_name
    from competitions c
    join countries d on d.id = c.country_id;

comment on view competitions_view is
  'Tekmovanja skupaj z državo — za izbirnike v vmesniku.';
