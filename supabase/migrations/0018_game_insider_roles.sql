-- 0018_game_insider_roles.sql
-- Phase 5a.2 / US-5a.2 — game_insider_roles table.
--
-- Per-round role assignment for Insider. Each row maps a (room_id,
-- round_number, player_id) tuple to one of three roles:
--   master  — knows the secret_value, answers Yes/No/Unsure
--   insider — knows the secret_value, blends in with commons
--   player  — commons; must guess and then vote on who the insider was
--
-- Roles are PUBLIC (anon SELECT) so each client can:
--   1. Filter by their own player_id to learn their own role at round start.
--   2. After result_failed, reveal who the insider was.
-- The asymmetric secret (secret_value) lives on game_insider_round and is
-- protected by column-level RLS (migration 0017). Knowing someone's role
-- does NOT leak the secret.
--
-- Realtime: subscribed so clients can react when role assignments land
-- (round starts) and pull their own role.

begin;

create table game_insider_roles (
  room_id      uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  player_id    uuid not null,
  role         text not null
    check (role in ('master','insider','player')),
  primary key (room_id, round_number, player_id)
);

alter table game_insider_roles enable row level security;

create policy game_insider_roles_anon_select on game_insider_roles
  for select to anon using (true);

alter publication supabase_realtime add table game_insider_roles;

commit;
