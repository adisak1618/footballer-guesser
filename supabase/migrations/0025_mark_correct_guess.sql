-- 0025_mark_correct_guess.sql
-- Phase 5a.9 / US-046 — mark_correct_guess RPC.
--
-- The Master declares "the group guessed correctly" during the 'asking' phase,
-- transitioning into 'guessed'. The RPC ALSO populates the data the next phase
-- ('voting') will need, so the guessed→voting auto-advance (driven by a 1-2s
-- celebration UI per design doc C2.A) needs no extra inputs:
--
--   * vote_deadline      = now() + 60s (per FR; voting window starts at guess)
--   * eligible_voter_ids = snapshot of currently-connected players (T-4)
--   * guessed_at         = now()
--   * guessed_by_player_id = p_player_id
--
-- Discipline mirrors master_respond (T-2.A / US-045):
--
--   1. perform reconcile_round_phase — self-heals any missed deadline first
--      so the asking→result_failed flip happens before we inspect phase.
--   2. Read the caller's role and the round's phase in one query (left join
--      so a stranger surfaces v_role IS NULL rather than no row).
--   3. Authorization: only role='master' may mark — else PGAME15 / PG015.
--   4. Expiry: if reconcile flipped phase to 'result_failed', the master ran
--      out of time → PGAME02 / PG002 ("round expired"). Distinct from phase
--      mismatch so the client can render the timeout state.
--   5. Phase guard: any non-'asking', non-'result_failed' phase (preparing,
--      guessed, voting, reveal) is the wrong moment to mark → PGAME16 / PG016.
--   6. UPDATE the round row in one shot (phase, guessed_at,
--      guessed_by_player_id, vote_deadline, eligible_voter_ids). The
--      eligible_voter_ids snapshot is taken inside the same UPDATE via a
--      sub-select against `players` (T-4: only `connected = true`).
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME02 / PG002 — round expired (cross-game timer guard, T-2.A)
--   PGAME15 / PG015 — only master can mark correct (insider game-specific;
--                     binding shared with master_respond per us-045)
--   PGAME16 / PG016 — phase != 'asking' (insider game-specific; binding
--                     shared with master_respond per us-045)
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon is the only role apps
-- connect with, and we need to bypass anon's column-level grants on
-- game_insider_round (secret_value column is hidden from anon — see A1.C).

begin;

create or replace function mark_correct_guess(
  p_room_id   uuid,
  p_round     int,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text;
  v_role  text;
begin
  -- 1. Self-heal any expired deadline before we inspect phase (T-2.A).
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Fetch phase + caller's role for this (room, round). Left join so a
  --    caller with no role row yields v_role IS NULL (treated as non-master).
  select r.phase, ro.role
    into v_phase, v_role
    from game_insider_round r
    left join game_insider_roles ro
      on ro.room_id      = r.room_id
     and ro.round_number = r.round_number
     and ro.player_id    = p_player_id
   where r.room_id      = p_room_id
     and r.round_number = p_round;

  -- 3. Authorization: master-only. Covers both "no role row" and "wrong role".
  if v_role is null or v_role <> 'master' then
    raise exception 'PGAME15: only master can mark correct guess'
      using errcode = 'PG015';
  end if;

  -- 4. Expiry: reconcile already flipped 'asking' → 'result_failed' if the
  --    timer elapsed. Surface as PGAME02 ("round expired") so the client can
  --    render the timeout state distinctly from a generic phase mismatch.
  if v_phase = 'result_failed' then
    raise exception 'PGAME02: round expired'
      using errcode = 'PG002';
  end if;

  -- 5. Phase guard: any other non-'asking' phase rejects.
  if v_phase <> 'asking' then
    raise exception 'PGAME16: phase is %, expected asking', v_phase
      using errcode = 'PG016';
  end if;

  -- 6. Stamp the guess and snapshot voting state in one UPDATE. T-4: snapshot
  --    eligible_voter_ids from connected players only — disconnected players
  --    are NOT eligible to vote, but voting still proceeds without waiting on
  --    them. Master, Insider, Commons all in eligible set if connected.
  update game_insider_round
     set phase                = 'guessed',
         guessed_at           = now(),
         guessed_by_player_id = p_player_id,
         vote_deadline        = now() + interval '60 seconds',
         eligible_voter_ids   = (
           select array_agg(player_id)
             from players
            where room_id = p_room_id
              and connected = true
         )
   where room_id      = p_room_id
     and round_number = p_round
     and phase        = 'asking';
end;
$$;

grant execute on function mark_correct_guess(uuid, int, uuid) to anon;

commit;
