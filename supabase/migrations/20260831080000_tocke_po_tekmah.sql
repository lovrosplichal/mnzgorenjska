-- Točke po tekmah: kdo je na posamezni tekmi dobil koliko točk.
--
-- Rezultate tekem že imamo (`match_assist_status`), ni pa bilo mogoče videti,
-- kako so se točke razdelile med igralce. Stran Rezultati zdaj ob kliku na
-- tekmo nariše obe postavi na igrišču, na vsakem dresu pa točke tega igralca.
--
-- Pogled je le prikaz nad `appearances` in `appearance_points`; točke ostajajo
-- izračunane na enem mestu (`tocke_za_nastop`).

create or replace view tekma_nastopi as
select
  a.match_id,
  m.round_id,
  a.team_id,
  a.player_id,
  p.full_name,
  p.position,
  a.shirt_number,
  a.started,
  a.minutes_played,
  a.minute_on,
  a.minute_off,
  a.goals,
  ap.assists,
  a.own_goals,
  a.penalties_scored,
  a.penalties_missed,
  a.penalties_saved,
  a.yellow_cards,
  a.red_cards,
  a.goals_conceded,
  a.clean_sheet,
  ap.points
from appearances a
join matches m on m.id = a.match_id
join players p on p.id = a.player_id
join appearance_points ap on ap.appearance_id = a.id;

comment on view tekma_nastopi is
  'Nastopi na tekmi z osvojenimi točkami — za prikaz postav in točk ob rezultatu.';
