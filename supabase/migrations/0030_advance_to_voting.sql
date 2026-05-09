-- 0030_advance_to_voting.sql
-- Phase 5b.6 / US-061 — advance_to_voting RPC.
--
-- Owns the guessed→voting edge of the C2.A state machine. mark_correct_guess
-- (migration 0025) flips phase to 'guessed' and pre-populates vote_deadline +
-- eligible_voter_ids, so this RPC is a thin phase-only flip — no extra inputs
-- needed. The 1-2s celebration UI on the voting screen calls this after its
-- transition delay so the room enters 'voting' for everyone simultaneously
-- via the existing realtime subscription on game_insider_round.
--
-- Per T-3.B "anyone can advance" — first client to fire wins; later callers
-- are silent no-ops thanks to the WHERE phase='guessed' filter.
--
-- Discipline (Insider RPC standard skeleton, per T-2.A):
--   1. perform reconcile_round_phase — self-heal an expired vote_deadline
--      (voting → reveal) before we inspect phase. This RPC runs in 'guessed'
--      so reconcile is a no-op for the common case, but it keeps the skeleton
--      uniform across every Insider mutation.
--   2. Caller membership check (PGAME11 / PG011).
--   3. UPDATE WHERE phase='guessed' so any other phase is a silent no-op.
--      The WHERE clause is the idempotency mechanism — no IF-branching for
--      "already advanced" cases.
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon has no direct UPDATE on
-- game_insider_round.

begin;

create or replace function advance_to_voting(
  p_room_id uuid,
  p_round int,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Self-heal any expired deadline before we inspect phase (T-2.A).
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Caller must be a member of the room.
  if not exists (
    select 1
      from players
     where room_id   = p_room_id
       and player_id = p_player_id
  ) then
    raise exception 'PGAME11: player % is not in room %', p_player_id, p_room_id
      using errcode = 'PG011';
  end if;

  -- 3. Advance guessed → voting. WHERE clause makes this idempotent: any
  --    other phase (preparing, asking, voting, reveal, result_failed) is a
  --    silent no-op — UPDATE simply matches zero rows. Score/voting state
  --    (vote_deadline, eligible_voter_ids) was populated by mark_correct_guess
  --    so this is a phase-only flip.
  update game_insider_round
     set phase = 'voting'
   where room_id      = p_room_id
     and round_number = p_round
     and phase        = 'guessed';
end;
$$;

grant execute on function advance_to_voting(uuid, int, uuid) to anon;

commit;
