-- Pozicija, uganjena iz statistike.
--
-- Zapisnik pozicij ne pove, glasovanje pa se zbira počasi. Da liga ni prazna,
-- pozicijo najprej ugibamo iz statistike prejšnje sezone (goli, kartoni).
-- Ugibanje je označeno kot tako in ga glasovanje skupnosti povozi.

alter table players drop constraint if exists players_position_source_check;
alter table players add constraint players_position_source_check
  check (position_source in ('neznano', 'ugibanje', 'zapisnik', 'glasovanje', 'admin'));

-- Glasovanje povozi ugibanje, ne pa zapisnika ali administratorja.
create or replace function potrdi_pozicijo(p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prag int := nastavitev_int('prag_glasov_pozicija', 5);
  v_position text;
  v_glasov int;
begin
  if exists (
    select 1 from players
    where id = p_player_id and position_source in ('zapisnik', 'admin')
  ) then
    return;
  end if;

  select position, count(*)
    into v_position, v_glasov
  from position_votes
  where player_id = p_player_id
  group by position
  order by count(*) desc
  limit 1;

  if v_glasov >= v_prag then
    update players
      set position = v_position,
          position_source = 'glasovanje'
    where id = p_player_id;
  end if;
end;
$$;

-- Koliko igralcev še čaka na potrditev skupnosti
create or replace view position_confidence as
select
  position_source,
  count(*)::int as players
from players
group by position_source;
