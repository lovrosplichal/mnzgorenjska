-- Audit log za DELETE na assist_votes in position_votes.
--
-- Glasovi uporabnikov so edini podatek, ki ga NE moremo znova pridobiti
-- (razen s prošnjo uporabnikom, da ponovno glasujejo — kar je težko).
-- Če kdaj v prihodnje kaka skripta / merger / cascade zbriše glasove,
-- imamo popolno kopijo v audit-tabeli in jih lahko obnovimo.
--
-- Namerno NE trigger-am na UPDATE — samo DELETE, ker to je edini
-- destruktivni izgub. UPDATE (npr. player_id: OLD → NEW) je varen.

create table if not exists assist_votes_deleted (
  id bigint primary key,
  goal_id bigint,
  voter_id uuid,
  player_id bigint,
  created_at timestamptz,
  deleted_at timestamptz not null default now(),
  deleted_by text default session_user,
  reason text
);

create index if not exists assist_votes_deleted_deleted_at_idx
  on assist_votes_deleted (deleted_at desc);
create index if not exists assist_votes_deleted_goal_id_idx
  on assist_votes_deleted (goal_id);

create or replace function trg_audit_assist_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into assist_votes_deleted (id, goal_id, voter_id, player_id, created_at)
  values (old.id, old.goal_id, old.voter_id, old.player_id, old.created_at);
  return old;
end;
$$;

drop trigger if exists assist_votes_audit_delete on assist_votes;
create trigger assist_votes_audit_delete
  after delete on assist_votes
  for each row execute function trg_audit_assist_delete();

-- Isti pattern za position_votes
create table if not exists position_votes_deleted (
  id bigint primary key,
  player_id bigint,
  voter_id uuid,
  position text,
  created_at timestamptz,
  deleted_at timestamptz not null default now(),
  deleted_by text default session_user,
  reason text
);

create index if not exists position_votes_deleted_deleted_at_idx
  on position_votes_deleted (deleted_at desc);

create or replace function trg_audit_position_vote_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into position_votes_deleted (id, player_id, voter_id, position, created_at)
  values (old.id, old.player_id, old.voter_id, old.position, old.created_at);
  return old;
end;
$$;

drop trigger if exists position_votes_audit_delete on position_votes;
create trigger position_votes_audit_delete
  after delete on position_votes
  for each row execute function trg_audit_position_vote_delete();

-- RLS: samo admin bere audit tabele (osebni podatki voterjev).
alter table assist_votes_deleted enable row level security;
alter table position_votes_deleted enable row level security;
create policy "admin bere" on assist_votes_deleted for select using (is_admin());
create policy "admin bere" on position_votes_deleted for select using (is_admin());
