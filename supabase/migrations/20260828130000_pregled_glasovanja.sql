-- Pregled tekem za glasovanje o asistencah.
--
-- Stran z glasovanjem je doslej ponujala en sam dolg spustni seznam zadnjih 40
-- tekem, kar je nepregledno. Odslej se izbira po korakih: najprej krog, nato
-- tekma v njem. Ta pogled da za vsako odigrano tekmo vse, kar seznam potrebuje
-- — grba, rezultat in koliko golov še čaka na asistenco — v eni poizvedbi.

create or replace view match_assist_status as
select
  m.id as match_id,
  m.round_id,
  r.season,
  r.number as round_number,
  m.played_on,
  h.name as home_name,
  h.short_name as home_short,
  h.logo_url as home_logo,
  a.name as away_name,
  a.short_name as away_short,
  a.logo_url as away_logo,
  m.home_goals,
  m.away_goals,
  count(g.id) filter (where not g.is_own_goal) as golov,
  count(g.id) filter (where not g.is_own_goal and g.assist_player_id is null)
    as brez_asistence
from matches m
join rounds r on r.id = m.round_id
join teams h on h.id = m.home_team_id
join teams a on a.id = m.away_team_id
left join goals g on g.match_id = m.id
where m.imported_at is not null
group by m.id, m.round_id, r.season, r.number, m.played_on,
         h.name, h.short_name, h.logo_url,
         a.name, a.short_name, a.logo_url,
         m.home_goals, m.away_goals;
