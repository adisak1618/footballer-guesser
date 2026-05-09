-- 0027_cast_vote.sql
-- Phase 5a.11 / US-048 — cast_vote RPC.
--
-- An eligible voter records their guess for who the Insider is during the
-- 'voting' phase. The RPC chains reconcile_round_phase first (T-2.A) so a
-- missed deadline is converted into voting → reveal before phase checks run.
-- A re-vote (same voter) overwrites their previous ballot via PK conflict.
-- After every successful vote, the RPC checks whether all eligible voters
-- have now cast — if so it flips phase 'voting' → 'reveal' in the same call,
-- so the late-coming client UI sees the transition without a separate poll.
--
-- Discipline (mirrors master_respond / mark_correct_guess shape):
--
--   1. perform reconcile_round_phase(p_room_id, p_round) — self-heals an
--      expired vote_deadline (voting → reveal) before we inspect phase.
--   2. Read phase + eligible_voter_ids + vote_deadline in one query.
--   3. Expiry: if reconcile flipped phase to 'reveal' AND vote_deadline is
--      in the past, surface PGAME19 ('vote deadline passed'). The phase
--      mutation is already persisted so the client sees the new phase on
--      its next realtime tick. Distinct from a generic phase mismatch so
--      the timeout state can render specifically.
--   4. Phase guard: any other non-'voting' phase rejects with PGAME18
--      ('phase is X, expected voting').
--   5. Eligibility: voter must be in eligible_voter_ids[] (snapshotted at
--      vote start by mark_correct_guess, US-046). Otherwise → PGAME17.
--   6. UPSERT into game_insider_votes — PK (room_id, round_number,
--      voter_player_id) makes a re-vote overwrite the previous row, and
--      voted_at is bumped to now() on conflict so the audit trail reflects
--      the most recent intent.
--   7. Auto-advance: if every entry in eligible_voter_ids[] now has a vote
--      row, flip phase 'voting' → 'reveal'. The phase='voting' filter on
--      the UPDATE keeps it idempotent if multiple final-voters race.
--      Score computation is intentionally NOT here — that lives in
--      advance_to_reveal (US-049 / Phase 5a.12), which is idempotent and
--      runs after the transition.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME17 / PG017 — voter not in eligible_voter_ids[] (insider game-specific).
--   PGAME18 / PG018 — phase != 'voting' (insider game-specific).
--   PGAME19 / PG019 — vote deadline passed (insider game-specific). Distinct
--                     from PGAME02 (the cross-game asking-deadline expiry)
--                     because UI copy + handler differ between the two timers.
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon has no direct UPDATE on
-- game_insider_round. set search_path = public per SECURITY DEFINER convention.

begin;

create or replace function cast_vote(
  p_room_id         uuid,
  p_round           int,
  p_player_id       uuid,
  p_voted_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase         text;
  v_eligible      uuid[];
  v_vote_deadline timestamptz;
  v_vote_count    int;
  v_eligible_n    int;
begin
  -- 1. Self-heal any passed vote_deadline before we inspect phase (T-2.A).
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Read post-reconcile state.
  select phase, eligible_voter_ids, vote_deadline
    into v_phase, v_eligible, v_vote_deadline
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round;

  -- 3. Deadline expiry path: reconcile already flipped voting → reveal if
  --    the deadline elapsed. Surface as PGAME19 so the client renders the
  --    timeout distinctly from a generic phase mismatch.
  if v_phase = 'reveal'
     and v_vote_deadline is not null
     and now() >= v_vote_deadline then
    raise exception 'PGAME19: vote deadline passed'
      using errcode = 'PG019';
  end if;

  -- 4. Phase guard: any non-'voting' phase rejects.
  if v_phase <> 'voting' then
    raise exception 'PGAME18: phase is %, expected voting', v_phase
      using errcode = 'PG018';
  end if;

  -- 5. Voter eligibility: must be in the snapshot taken at vote start.
  if v_eligible is null or not (p_player_id = any(v_eligible)) then
    raise exception 'PGAME17: not eligible to vote'
      using errcode = 'PG017';
  end if;

  -- 6. UPSERT — PK (room, round, voter) absorbs re-votes. voted_at is bumped
  --    to now() on conflict so the audit trail reflects the latest intent.
  insert into game_insider_votes (
    room_id, round_number, voter_player_id, voted_player_id
  ) values (
    p_room_id, p_round, p_player_id, p_voted_player_id
  )
  on conflict (room_id, round_number, voter_player_id) do update
    set voted_player_id = excluded.voted_player_id,
        voted_at        = now();

  -- 7. Auto-advance: if every eligible voter now has a row, flip the phase
  --    so other clients (and advance_to_reveal — US-049) see 'reveal' on
  --    their next realtime tick. The phase='voting' filter keeps this
  --    idempotent if a future race ever calls cast_vote twice in parallel
  --    on the final ballot.
  v_eligible_n := coalesce(array_length(v_eligible, 1), 0);
  select count(*) into v_vote_count
    from game_insider_votes
   where room_id      = p_room_id
     and round_number = p_round
     and voter_player_id = any(v_eligible);

  if v_vote_count >= v_eligible_n then
    update game_insider_round
       set phase = 'reveal'
     where room_id      = p_room_id
       and round_number = p_round
       and phase        = 'voting';
  end if;
end;
$$;

grant execute on function cast_vote(uuid, int, uuid, uuid) to anon;

commit;
