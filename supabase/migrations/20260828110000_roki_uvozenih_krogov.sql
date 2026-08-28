-- Roki za kroge, ki so prišli v bazo po uvozu.
--
-- Migracija z roki je v oblaku stekla nad prazno tabelo `rounds`, zato uvoženi
-- krogi roka nimajo. Poleg tega je pogled `naslednji_krog` kroge brez roka štel
-- za prihodnje in je kot naslednjega vrnil prvi krog stare sezone.

update rounds
   set deadline_at = (played_on::timestamp + time '10:00') at time zone 'Europe/Ljubljana'
 where deadline_at is null and played_on is not null;

-- Krog brez roka odslej ni samodejno "naslednji": rok privzeto izhaja iz dneva
-- tekme, sezona pa gre pred številko kroga.
create or replace view naslednji_krog as
select id, season, number, played_on, deadline_at
from rounds
where coalesce(
        deadline_at,
        (played_on::timestamp + time '10:00') at time zone 'Europe/Ljubljana'
      ) > now()
order by season, number
limit 1;
