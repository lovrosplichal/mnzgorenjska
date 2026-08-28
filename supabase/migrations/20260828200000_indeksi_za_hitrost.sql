-- Indeksi za poglede, ki jih aplikacija odpira najpogosteje.
--
-- `player_scores` je imel le sestavljeni primarni kljuc (round_id, player_id),
-- zato je vsako iskanje po igralcu — forma, zadnji krog, stran igralca —
-- pomenilo pregled cele tabele. Enako velja za stetje lastnikov igralca in za
-- zgodovino cen.

create index if not exists player_scores_player_idx on player_scores (player_id);
create index if not exists fantasy_roster_player_idx on fantasy_roster (player_id);
create index if not exists price_changes_player_idx on price_changes (player_id);
create index if not exists fantasy_lineups_krog_idx on fantasy_lineups (round_id);

analyze player_scores;
analyze fantasy_roster;
