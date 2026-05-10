-- 0024_master_respond.sql
-- Phase 5a.8 / US-045 — master_respond RPC.
--
-- TODO(#16 follow-up): the asking-phase UI no longer calls master_respond
-- (Y/N/Unsure response buttons removed in #16 — Headball is a same-room
-- offline social game; answers are spoken). The function and migration are
-- intentionally kept in place for one release so pinned mid-deploy clients
-- do not error on a missing RPC. Drop in a follow-up migration once the
-- deploy fan-out is complete; the regression suites for this RPC live as
-- describe.skip in migration-0024-master-respond.test.ts and
-- us-070-common-master-respond-denied.test.ts.
--
-- The Master records Yes/No/Unsure to the group's question. Per design doc
-- C2.A this is the only authority that may write into game_insider_responses
-- during the 'asking' phase. Discipline mirrors advance_to_asking (T-2.A):
--
--   1. perform reconcile_round_phase — self-heals any missed deadline first
--      so the asking→result_failed flip happens before we inspect phase.
--   2. Read the caller's role and the round's phase + timing in one query
--      (left join so a stranger surfaces v_role IS NULL rather than no row).
--   3. Authorization: only role='master' may respond. Otherwise PGAME15/PG015.
--   4. Expiry: if reconcile flipped phase to 'result_failed', the master ran
--      out of time → PGAME02/PG002 ("round expired"). The phase mutation
--      is already persisted by reconcile, so the client sees the new phase
--      on its next realtime tick.
--   5. Phase guard: any non-'asking', non-'result_failed' phase (preparing,
--      guessed, voting, reveal) is the wrong moment to record a response →
--      PGAME16/PG016 ("phase is X, expected asking").
--   6. Insert the response row. The CHECK on game_insider_responses.response
--      (yes|no|unsure, migration 0019) enforces the value domain — invalid
--      strings surface as SQLSTATE 23514 (check_violation) which the dispatch
--      wrapper passes through unchanged.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME02 / PG002 — round expired (cross-game timer guard, T-2.A)
--   PGAME15 / PG015 — only master can respond (insider game-specific)
--   PGAME16 / PG016 — phase != 'asking' (insider game-specific)
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon is the only role apps
-- connect with, and we need to bypass anon's column-level grants on
-- game_insider_round (secret_value column is hidden from anon — see A1.C).

begin;

create or replace function master_respond(
  p_room_id   uuid,
  p_round     int,
  p_player_id uuid,
  p_response  text
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
    raise exception 'PGAME15: only master can respond'
      using errcode = 'PG015';
  end if;

  -- 4. Expiry: reconcile already flipped 'asking' → 'result_failed' if the
  --    timer elapsed. Surface that as PGAME02 ("round expired") so the client
  --    can render the timeout state distinctly from a generic phase mismatch.
  if v_phase = 'result_failed' then
    raise exception 'PGAME02: round expired'
      using errcode = 'PG002';
  end if;

  -- 5. Phase guard: any other non-'asking' phase rejects.
  if v_phase <> 'asking' then
    raise exception 'PGAME16: phase is %, expected asking', v_phase
      using errcode = 'PG016';
  end if;

  -- 6. Append response. response check constraint (yes|no|unsure) lives on
  --    the table from migration 0019 — invalid values bubble up as 23514.
  insert into game_insider_responses (room_id, round_number, response)
  values (p_room_id, p_round, p_response);
end;
$$;

grant execute on function master_respond(uuid, int, uuid, text) to anon;

commit;
