-- Administratorske pravice nad uporabniki in ekipami
--
-- Zakaj: v ligi se že pred prvim krogom pojavijo priimki narobe zapisani in
-- imena ekip s tipkami. Do zdaj tega ni imel kdo popraviti, ker RLS pusti
-- urejati profil in ekipo le lastniku sami; ta pa se pogosto ne odzove, ker
-- ne ve, kje je gumb "preimenuj". Admin naj to lahko popravi na enem mestu.
--
-- Poleg tega pred zaklepom kroga rabimo seznam uporabnikov, ki ekipe še niso
-- dokončali (napak v roster ali ekipe sploh ni), skupaj z njihovimi e-poštami,
-- da jim lahko pošljemo opomnik. auth.users je zunaj public sheme in do
-- e-pošte ne pridemo z branjem tabele — zato SECURITY DEFINER funkcija, ki
-- na začetku preveri is_admin().

-- 1) RLS: admin ureja ekipe in profile (obstoječi lastniški polic ostane)
drop policy if exists "admin ureja fantasy ekipe" on fantasy_teams;
create policy "admin ureja fantasy ekipe" on fantasy_teams for update
  using (is_admin()) with check (is_admin());

drop policy if exists "admin ureja profile" on profiles;
create policy "admin ureja profile" on profiles for update
  using (is_admin()) with check (is_admin());

-- 2) Skupaj uporabnikov (samo število) — brez varnostnih vprašanj, ker
--    profiles je javno berljiv; le count naredimo bolj priročen za frontend.
create or replace function skupaj_uporabnikov()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from profiles;
$$;

grant execute on function skupaj_uporabnikov() to authenticated;

-- 3) Seznam vseh uporabnikov z e-poštami in stanjem ekipe v izbranem
--    tekmovanju. auth.users ni v public; branje varujemo s SECURITY DEFINER
--    in eksplicitno preverimo is_admin() na začetku, sicer bi bila
--    e-pošta uporabnikov razkrita komurkoli, ki bi funkcijo poklical.
create or replace function admin_uporabniki(p_competition_id bigint default null)
returns table (
  user_id uuid,
  email text,
  display_name text,
  registered_at timestamptz,
  is_admin boolean,
  team_id bigint,
  team_name text,
  roster_stevilo int,
  ekipa_veljavna boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Samo administrator lahko bere uporabnike.';
  end if;

  return query
  select
    u.id                                                       as user_id,
    u.email::text                                              as email,
    p.display_name                                             as display_name,
    u.created_at                                               as registered_at,
    coalesce(p.is_admin, false)                                as is_admin,
    ft.id                                                      as team_id,
    ft.name                                                    as team_name,
    coalesce(
      (select count(*)::int
         from fantasy_roster fr
         where fr.fantasy_team_id = ft.id),
      0
    )                                                          as roster_stevilo,
    coalesce(roster_je_veljaven(ft.id), false)                 as ekipa_veljavna
  from auth.users u
  left join profiles p on p.id = u.id
  left join fantasy_teams ft
    on ft.owner_id = u.id
   and (p_competition_id is null or ft.competition_id = p_competition_id)
  order by u.created_at;
end;
$$;

grant execute on function admin_uporabniki(bigint) to authenticated;
