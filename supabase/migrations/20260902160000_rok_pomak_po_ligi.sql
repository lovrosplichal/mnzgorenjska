-- Koliko pred prvo tekmo se zaklene krog — po ligi, ne enotno.
--
-- `uvoz-delegiranja` postavi rok šest ur pred prvo tekmo v krogu. Pri članih
-- to pade na sobotnih 11:00 in je v redu. Pri mladincih pa se krog začne ob
-- 7:00, kar rok potisne na nedeljskih 5:00 zjutraj — takrat ekipe nihče ne
-- ureja. Šest ur torej ni pravilo lige, ampak navada ene lige.
--
-- Pomak dobi svoje mesto pri tekmovanju; `--pomak` v ukazni vrstici ga še
-- vedno povozi za posamezen zagon.
alter table competitions add column if not exists rok_pomak_ur int not null default 6;

comment on column competitions.rok_pomak_ur is
  'Koliko ur pred prvo tekmo v krogu se zaklene postava.';

update competitions set rok_pomak_ur = 2 where slug = 'mladinci';
