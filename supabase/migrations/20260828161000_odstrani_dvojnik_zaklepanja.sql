-- `create or replace` ni zamenjal prvotne `zakleni_zapadle_kroge()`, ker ima
-- nova različica parameter (z privzeto vrednostjo) in je zato ločena funkcija.
-- Ostali sta dve in klic brez argumenta je postal dvoumen — tudi tisti, ki ga
-- poganja pg_cron. Staro brišemo; obvelja različica z oknom.

drop function if exists public.zakleni_zapadle_kroge();
