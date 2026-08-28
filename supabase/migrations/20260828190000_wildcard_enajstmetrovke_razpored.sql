-- Wildcard, obranjene enajstmetrovke in prihodnji nasprotniki.

-- --- 1. wildcard ---------------------------------------------------------
-- Enkrat na sezono ekipa v enem krogu prestavi kolikor igralcev hoče brez
-- kazni. Uporabno ob poškodbah ali ko se izkaže, da je kader zgrešen.
alter table fantasy_chips drop constraint if exists fantasy_chips_chip_check;
alter table fantasy_chips add constraint fantasy_chips_chip_check
  check (chip in ('klop_plus', 'wildcard'));

-- Kazen za prestope odpade v krogu, za katerega je vložen wildcard.
create or replace function zakleni_krog(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posnetih int;
  v_prosti int := nastavitev_int('prosti_prestopi', 3);
  v_kazen int := nastavitev_int('kazen_prestopa', 4);
begin
  insert into fantasy_lineups (
    round_id, fantasy_team_id, player_id, is_starter, is_captain, is_vice, bench_order
  )
  select p_round_id, fr.fantasy_team_id, fr.player_id,
         fr.is_starter, fr.is_captain, fr.is_vice, fr.bench_order
  from fantasy_roster fr
  where not exists (
    select 1 from fantasy_lineups fl
    where fl.round_id = p_round_id and fl.fantasy_team_id = fr.fantasy_team_id
  );

  get diagnostics v_posnetih = row_count;

  insert into fantasy_transfers (fantasy_team_id, round_id, transfers, free_transfers, penalty)
  select
    novi.fantasy_team_id,
    p_round_id,
    novi.prisli,
    v_prosti,
    case
      when exists (
        select 1 from fantasy_chips c
        where c.fantasy_team_id = novi.fantasy_team_id
          and c.chip = 'wildcard'
          and c.round_id = p_round_id
      ) then 0
      else greatest(0, novi.prisli - v_prosti) * v_kazen
    end
  from (
    select
      fl.fantasy_team_id,
      count(*) filter (
        where not exists (
          select 1 from fantasy_lineups prej
          where prej.fantasy_team_id = fl.fantasy_team_id
            and prej.player_id = fl.player_id
            and prej.round_id = (
              select fl2.round_id
              from fantasy_lineups fl2
              join rounds r2 on r2.id = fl2.round_id
              where fl2.fantasy_team_id = fl.fantasy_team_id
                and fl2.round_id <> p_round_id
              order by r2.season desc, r2.number desc
              limit 1
            )
        )
      ) as prisli
    from fantasy_lineups fl
    where fl.round_id = p_round_id
      and exists (
        select 1 from fantasy_lineups fl3
        where fl3.fantasy_team_id = fl.fantasy_team_id
          and fl3.round_id <> p_round_id
      )
    group by fl.fantasy_team_id
  ) novi
  on conflict (fantasy_team_id, round_id) do nothing;

  return v_posnetih;
end;
$$;

-- --- 2. obranjene enajstmetrovke -----------------------------------------
-- Zapisnik obrambe ne beleži, beleži pa zgrešene enajstmetrovke. Zgrešena
-- enajstmetrovka je z vratarjevega vidika skoraj vedno njegova zasluga, zato
-- jo pripišemo vratarju nasprotne ekipe. Ni popolno — žoga je lahko šla mimo
-- gola — zato je pravilo v nastavitvi in ga administrator lahko izklopi
-- (`pripisi_obranjene` = 0), ročno vnesene obrambe pa se ne povozijo.
insert into settings (key, value)
values ('pripisi_obranjene', '1')
on conflict (key) do nothing;

create or replace function pripisi_obranjene_enajstmetrovke(p_round_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spremenjenih int;
begin
  if nastavitev_int('pripisi_obranjene', 1) = 0 then
    return 0;
  end if;

  -- Za vsako tekmo: koliko enajstmetrovk je zgrešila ena ekipa, toliko jih
  -- pripišemo vratarju druge — tistemu z največ minutami, če jih je bilo več.
  with zgresene as (
    select a.match_id, a.team_id, sum(a.penalties_missed)::int as zgresenih
    from appearances a
    join matches m on m.id = a.match_id
    where m.round_id = p_round_id and a.penalties_missed > 0
    group by a.match_id, a.team_id
  ),
  vratarji as (
    select distinct on (a.match_id, a.team_id)
      a.id as appearance_id, a.match_id, a.team_id
    from appearances a
    join players p on p.id = a.player_id
    join matches m on m.id = a.match_id
    where m.round_id = p_round_id
      and p.position = 'GK'
      and a.minutes_played > 0
    order by a.match_id, a.team_id, a.minutes_played desc
  ),
  parji as (
    select v.appearance_id, z.zgresenih
    from zgresene z
    join matches m on m.id = z.match_id
    join vratarji v
      on v.match_id = z.match_id
     and v.team_id = case when z.team_id = m.home_team_id
                          then m.away_team_id else m.home_team_id end
  )
  update appearances a
     set penalties_saved = p.zgresenih
    from parji p
   where a.id = p.appearance_id
     and a.penalties_saved = 0;  -- ročno vnesenih ne povozimo

  get diagnostics v_spremenjenih = row_count;

  if v_spremenjenih > 0 then
    perform recompute_round_scores(p_round_id);
  end if;
  return v_spremenjenih;
end;
$$;

-- --- 3. prihodnji nasprotniki --------------------------------------------
-- Katere tekme klub še čakajo. Stran igralca iz tega pokaže naslednje
-- nasprotnike, kar pomaga pri izbiri kadra.
create or replace view prihodnje_tekme as
select
  m.id as match_id,
  m.round_id,
  r.season,
  r.number as round_number,
  m.played_on,
  m.home_team_id as team_id,
  m.away_team_id as opponent_id,
  a.name as opponent_name,
  a.short_name as opponent_short,
  a.logo_url as opponent_logo,
  true as doma
from matches m
join rounds r on r.id = m.round_id
join teams a on a.id = m.away_team_id
where m.imported_at is null and m.played_on >= current_date
union all
select
  m.id,
  m.round_id,
  r.season,
  r.number,
  m.played_on,
  m.away_team_id,
  m.home_team_id,
  h.name,
  h.short_name,
  h.logo_url,
  false
from matches m
join rounds r on r.id = m.round_id
join teams h on h.id = m.home_team_id
where m.imported_at is null and m.played_on >= current_date;
