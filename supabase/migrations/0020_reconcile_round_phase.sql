-- 0020_reconcile_round_phase.sql
-- Phase 5a.4 / US-041 — reconcile_round_phase helper (T-2.A).
--
-- Self-healing phase advancement. Every Insider RPC calls this first via
-- `perform reconcile_round_phase(p_room_id, p_round)` so a missed
-- expire_round from any client (network blip, tab closed before the timer
-- fires, race) is fixed automatically the next time anyone touches the
-- round. This is the single source of truth for "did the deadline pass?";
-- individual RPCs check the resulting phase rather than recomputing the
-- deadline themselves.
--
-- Transitions (per state machine in design doc C2.A):
--   asking + (now() >= started_at + time_limit_s seconds)  → result_failed
--   voting + (now() >= vote_deadline)                      → reveal
--
-- All other phases (preparing, guessed, reveal, result_failed) and rounds
-- whose deadline has not passed are no-ops. Calling on a non-existent
-- (room_id, round_number) is a silent no-op — the UPDATE simply matches
-- zero rows. Function is idempotent: a second call on an already-resolved
-- round leaves the phase unchanged.
--
-- SECURITY DEFINER so anon clients can call it through their RPCs even
-- though anon does not have direct UPDATE on game_insider_round.
-- GRANT EXECUTE to anon — every Insider RPC needs to chain through here.

begin;

create or replace function reconcile_round_phase(
  p_room_id uuid,
  p_round int
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- asking → result_failed when the per-round timer has elapsed.
  update game_insider_round
     set phase = 'result_failed'
   where room_id = p_room_id
     and round_number = p_round
     and phase = 'asking'
     and started_at is not null
     and now() >= started_at + make_interval(secs => time_limit_s);

  -- voting → reveal when the vote deadline has passed.
  update game_insider_round
     set phase = 'reveal'
   where room_id = p_room_id
     and round_number = p_round
     and phase = 'voting'
     and vote_deadline is not null
     and now() >= vote_deadline;
end;
$$;

grant execute on function reconcile_round_phase(uuid, int) to anon;

commit;
