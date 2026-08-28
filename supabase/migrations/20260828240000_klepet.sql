-- Anonimni klepet na domači strani.
--
-- Uporabniki objavljajo kratke sporočila, prikazana pa so s psevdonimom
-- (npr. "Modri Napadalec 42"). Alias generira odjemalec deterministično iz
-- user_id, tako da isti uporabnik vedno vidi isti psevdonim — kar omogoča
-- pogovorno kontinuiteto brez razkritja identitete.
--
-- Za moderiranje: admin lahko izbriše katerokoli sporočilo, avtor svojega.
create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade,
  content text not null check (length(content) between 1 and 500),
  alias text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_idx on chat_messages (created_at desc);

alter table chat_messages enable row level security;

create policy "javno branje" on chat_messages for select using (true);

create policy "prijavljeni objavlja" on chat_messages for insert
  with check (auth.uid() = user_id);

create policy "avtor izbrise svoj" on chat_messages for delete
  using (auth.uid() = user_id);

create policy "admin brise vse" on chat_messages for delete
  using (is_admin());
