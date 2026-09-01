-- DEMO PODATKI za lokalni razvoj.
-- Klubi so resnični iz gorenjske regije; IGRALCI SO IZMIŠLJENI (demo).
-- Pred produkcijo uvozi resnične nabore igralcev z https://www.mnzgkranj.si/

insert into teams (name, short_name) values
  ('NK Triglav Kranj', 'TRI'),
  ('NK Šenčur', 'SEN'),
  ('NK Britof', 'BRI'),
  ('NK Bled', 'BLE'),
  ('NK Kranjska Gora', 'KGO'),
  ('NK Železniki', 'ZEL'),
  ('NK Visoko', 'VIS'),
  ('NK Naklo', 'NAK')
on conflict (name) do nothing;

-- Demo igralci: 14 na klub, razporejeni po pozicijah
insert into players (team_id, first_name, last_name, position)
select
  t.id,
  'Igralec',
  t.short_name || '-' || lpad(g::text, 2, '0'),
  case
    when g <= 2 then 'GK'
    when g <= 7 then 'DEF'
    when g <= 11 then 'MID'
    else 'FWD'
  end
from teams t
cross join generate_series(1, 14) as g
where not exists (select 1 from players p where p.team_id = t.id);

-- Prvi trije krogi sezone 2026/27; glasovanje odprto za 3. krog
insert into rounds (season, number, played_on, voting_opens_at, voting_closes_at) values
  ('2026/27', 1, date '2026-08-09', timestamptz '2026-08-09 20:00+02', timestamptz '2026-08-13 23:59+02'),
  ('2026/27', 2, date '2026-08-16', timestamptz '2026-08-16 20:00+02', timestamptz '2026-08-20 23:59+02'),
  ('2026/27', 3, date '2026-08-23', now() - interval '1 day', now() + interval '6 days')
-- Krog je enoličen znotraj tekmovanja; privzeto tekmovanje so člani.
on conflict (competition_id, season, number) do nothing;
