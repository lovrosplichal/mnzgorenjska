-- Standardne pravice Supabase za shemo public.
--
-- Ob prenosu migracij v projekt v oblaku vloge `anon`, `authenticated` in
-- `service_role` niso dobile pravic nad tabelami (privzete pravice veljajo le
-- za objekte, ki jih ustvari `postgres`), zato je uvoz padel s
-- "permission denied for table teams". Pravice so enake kot pri projektu,
-- ustvarjenem prek nadzorne plošče: dostop ureja RLS, ki je vklopljen na vseh
-- tabelah, ne odsotnost pravic.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- Isto naj velja za vse, kar bo ustvarjeno kasneje.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
