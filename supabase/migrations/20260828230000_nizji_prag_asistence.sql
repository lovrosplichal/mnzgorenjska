-- Prag glasov za asistenco: 5 -> 3.
--
-- V amaterski ligi je vzorec glasovalcev majhen (nekaj sto uporabnikov, od
-- teh redni je peščica); 5 glasov na gol pomeni, da ogromno asistenc ostane
-- nedodeljenih. En gol ima še vedno lahko le eno asistenco — to enforce-a
-- kolona `goals.assist_player_id` (single value).
update settings
  set value = '3'::jsonb
  where key = 'prag_glasov_asistenca';
