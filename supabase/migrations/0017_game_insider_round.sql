-- 0017_game_insider_round.sql
-- Phase 5a.1 / US-5a.1 — game_insider_round table with column-level secret RLS (A1.C).
--
-- Per-round Insider state. The `secret_value` column carries the asymmetric
-- secret (Master + Insider know; Commons must guess). Anon clients are the
-- only role players ever connect with, so they MUST NOT be able to read
-- `secret_value` directly. Master + Insider fetch it via SECURITY DEFINER
-- `get_my_insider_secret(...)` (added in US-5a.5).
--
-- Implementation (A1.C):
--   1. Create the table with all columns in one row (no split-table).
--   2. Enable RLS + anon SELECT policy so PostgREST can return non-secret cols.
--   3. REVOKE SELECT on the whole table from anon (Supabase grants table-wide
--      SELECT to anon by default), then re-GRANT SELECT only on the explicit
--      non-secret column list. Anon `select *` now fails with 42501; anon
--      explicit selects of the listed columns succeed.
--   4. Publish to supabase_realtime with the SAME explicit column list so
--      logical-replication payloads broadcast to subscribed clients also
--      exclude `secret_value`. This guards the realtime channel — column-level
--      GRANTs alone don't filter realtime payloads.
--
-- Phases (state machine per design doc C2):
--   preparing → asking → guessed → voting → reveal
--                                      ↘ result_failed (timer expired path)

begin;

create table game_insider_round (
  room_id                uuid not null references rooms(id) on delete cascade,
  round_number           int not null,
  pack_slug              text not null references content_packs(slug),
  secret_value           text not null,
  time_limit_s           int not null check (time_limit_s > 0),
  started_at             timestamptz,
  vote_deadline          timestamptz,
  guessed_at             timestamptz,
  guessed_by_player_id   uuid,
  -- T-4: snapshot of player_ids eligible to vote, frozen at vote phase entry.
  -- NULL during preparing/asking/guessed; populated when phase transitions to voting.
  eligible_voter_ids     uuid[],
  phase                  text not null default 'preparing'
    check (phase in ('preparing','asking','guessed','voting','reveal','result_failed')),
  primary key (room_id, round_number)
);

alter table game_insider_round enable row level security;

create policy game_insider_round_anon_select on game_insider_round
  for select to anon using (true);

-- Column-level secret protection (A1.C):
--   Strip the default broad SELECT grant Supabase gives anon, then re-grant
--   SELECT only on the non-secret columns. After this, `select *` from anon
--   fails with SQLSTATE 42501 (insufficient_privilege) because the * expands
--   to include `secret_value`, which anon has no GRANT for.
revoke select on game_insider_round from anon;

grant select (
  room_id,
  round_number,
  pack_slug,
  time_limit_s,
  started_at,
  vote_deadline,
  guessed_at,
  guessed_by_player_id,
  eligible_voter_ids,
  phase
) on game_insider_round to anon;

-- Realtime publication with explicit column list — secret_value is NOT
-- broadcast to subscribed clients. (PG15+ supports column-list publications.)
alter publication supabase_realtime add table game_insider_round (
  room_id,
  round_number,
  pack_slug,
  time_limit_s,
  started_at,
  vote_deadline,
  guessed_at,
  guessed_by_player_id,
  eligible_voter_ids,
  phase
);

commit;
