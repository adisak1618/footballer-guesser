-- 0026_expire_round.sql
-- Phase 5a.10 / US-047 — expire_round RPC (idempotent — A3.B).
--
-- Any client whose Insider asking-phase timer hit zero calls this RPC to advance
-- the round to 'result_failed'. Many clients race to call it (each player's local
-- timer fires independently); the WHERE-clause phase guard keeps the operation
-- idempotent: only the first concurrent call observes phase='asking' and updates
-- the row; subsequent calls match zero rows and return 0.
--
-- Transition:
--   asking + (now() >= started_at + time_limit_s seconds)  → phase='result_failed'
--
-- All other phases (preparing, guessed, voting, reveal, result_failed) and
-- not-yet-expired rounds are silent no-ops (zero rows updated). Returns the
-- count of rows actually changed (0 or 1) so callers can detect "I won the
-- race and should kick off the post-expiry UI" if needed.
--
-- This is a public-facing slice of `reconcile_round_phase` (migration 0020) —
-- the helper continues to handle BOTH asking→result_failed and voting→reveal
-- as a chained safety net inside every Insider RPC, while expire_round is the
-- single-purpose call clients fire directly when their countdown ticks to zero.
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon clients have no direct UPDATE
-- on game_insider_round, so the function impersonates a privileged caller for
-- the row update. set search_path = public per SECURITY DEFINER convention.

begin;

create or replace function expire_round(
  p_room_id uuid,
  p_round int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update game_insider_round
     set phase = 'result_failed'
   where room_id = p_room_id
     and round_number = p_round
     and phase = 'asking'
     and started_at is not null
     and now() >= started_at + make_interval(secs => time_limit_s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function expire_round(uuid, int) to anon;

commit;
