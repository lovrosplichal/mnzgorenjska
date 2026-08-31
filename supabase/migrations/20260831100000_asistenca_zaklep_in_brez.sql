-- Asistenca: ko je odločeno, je odločeno.
--
-- Tri stvari, ki jih glasovanje doslej ni znalo zaključiti:
--
-- 1. Če je zmagalo »nihče«, se ni zgodilo nič — asistenca ni bila zapisana,
--    gol pa je za vedno ostal med tistimi, ki čakajo. Odslej se tak izid
--    zabeleži v `assist_none_confirmed_at` in gol ne čaka več.
-- 2. Enajstmetrovka in avtogol asistence po pravilih nimata, glasovanje o njiju
--    pa je bilo odprto. Odslej sta takoj označena kot odločena.
-- 3. Potrjena asistenca se je lahko z novimi glasovi še premaknila. Odslej je
--    zaklenjena: nadaljnji glasovi se zavrnejo.

alter table goals add column if not exists assist_none_confirmed_at timestamptz;

comment on column goals.assist_none_confirmed_at is
  'Odločeno je, da gol nima asistence — skupnost je tako glasovala, ali pa gre za enajstmetrovko oziroma avtogol.';

-- --------------------------------------------------------------------------
-- Potrjevanje asistence
-- --------------------------------------------------------------------------
create or replace function potrdi_asistenco(p_goal_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prag int := nastavitev_int('prag_glasov_asistenca', 3);
  v_gol goals;
  v_player_id bigint;
  v_glasov int;
begin
  select * into v_gol from goals where id = p_goal_id;
  if not found then
    return;
  end if;

  -- Enkrat odločeno ostane odločeno.
  if v_gol.assist_player_id is not null
     or v_gol.assist_none_confirmed_at is not null then
    return;
  end if;

  -- Enajstmetrovka in avtogol asistence nimata.
  if v_gol.is_penalty or v_gol.is_own_goal then
    update goals set assist_none_confirmed_at = now() where id = p_goal_id;
    return;
  end if;

  -- Vodilna izbira, pri čemer »nihče« (player_id is null) šteje enako kot
  -- igralec. Ob izenačenju ima prednost imenovani podajalec.
  select av.player_id, count(*)
    into v_player_id, v_glasov
  from assist_votes av
  where av.goal_id = p_goal_id
  group by av.player_id
  order by count(*) desc, (av.player_id is null)
  limit 1;

  if v_glasov is null or v_glasov < v_prag then
    return;
  end if;

  if v_player_id is null then
    update goals set assist_none_confirmed_at = now() where id = p_goal_id;
  else
    update goals
       set assist_player_id = v_player_id,
           assist_confirmed_at = now()
     where id = p_goal_id;
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- Zaklep: o odločenem golu se ne glasuje več
-- --------------------------------------------------------------------------
create or replace function trg_assist_vote_zaklep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gol goals;
begin
  select * into v_gol from goals where id = new.goal_id;
  if not found then
    return new;
  end if;

  if v_gol.assist_player_id is not null
     or v_gol.assist_none_confirmed_at is not null then
    raise exception 'O tem golu je že odločeno — glasovanje je zaključeno.'
      using errcode = '42501';
  end if;

  if v_gol.is_penalty or v_gol.is_own_goal then
    raise exception 'Enajstmetrovka in avtogol asistence nimata.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists assist_votes_zaklep on assist_votes;
create trigger assist_votes_zaklep
  before insert or update on assist_votes
  for each row execute function trg_assist_vote_zaklep();

-- --------------------------------------------------------------------------
-- Pregled tekem: kaj res še čaka
-- --------------------------------------------------------------------------
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
  count(g.id) filter (
    where not g.is_own_goal
      and not g.is_penalty
      and g.assist_player_id is null
      and g.assist_none_confirmed_at is null
  ) as brez_asistence,
  m.home_team_id,
  m.away_team_id
from matches m
join rounds r on r.id = m.round_id
join teams h on h.id = m.home_team_id
join teams a on a.id = m.away_team_id
left join goals g on g.match_id = m.id
where m.imported_at is not null
group by m.id, m.round_id, r.season, r.number, m.played_on,
         h.name, h.short_name, h.logo_url,
         a.name, a.short_name, a.logo_url,
         m.home_goals, m.away_goals, m.home_team_id, m.away_team_id;

-- --------------------------------------------------------------------------
-- Poravnaj zgodovino: goli, ki so bili že odločeni, a se to ni zapisalo
-- --------------------------------------------------------------------------
select potrdi_asistenco(g.id)
from goals g
where g.assist_player_id is null
  and g.assist_none_confirmed_at is null;
