-- 0016_rooms_game_type.sql
-- Phase 4.1 / US-031 — add `game_type` to rooms so the hub can dispatch a
-- 6-char join code to the right game subdomain (per design doc Phase 4 / D5).
--
-- Additive only: existing Headball rows get the 'headball' default; runtime
-- behavior of the Headball game is byte-for-byte unchanged. Constrained to
-- the v1 game set ('headball','insider'); future games widen the check.
--
-- No realtime publication change: `rooms` is already in supabase_realtime,
-- and `alter table ... add column` propagates to existing publications.

alter table rooms
  add column game_type text not null default 'headball';

alter table rooms
  add constraint rooms_game_type_check
  check (game_type in ('headball', 'insider'));

create index rooms_game_type_idx on rooms (game_type);
