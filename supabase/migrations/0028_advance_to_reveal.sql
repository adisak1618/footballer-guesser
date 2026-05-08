-- 0028_advance_to_reveal.sql
-- Phase 5a.12 / US-049 — advance_to_reveal RPC + scoring (T-3.B).
--
-- ANY connected client may call this RPC to drive the round into 'reveal'
-- and apply scoring. Per design doc C2.A:
--
--   * voting → reveal happens when (a) every eligible voter has cast (in
--     which case cast_vote/US-048 already auto-flipped the phase), or
--     (b) vote_deadline passed (reconcile_round_phase/T-2.A flips it).
--   * advance_to_reveal also handles the result_failed branch (asking-phase
--     timeout, master never marked correct) — there is no scoring outcome
--     for that branch ("Time expired = everyone 0"), but we still stamp
--     scored_at so the call is observably "done" and clients can move on.
--   * Called too early (phase=voting, not all voted, deadline future) →
--     silent no-op. The function is the canonical "compute the scoreboard"
--     entry point and is expected to be invoked from a UI timer hook plus
--     from a "go to reveal" client action.
--
-- Idempotency mechanism: a new column `scored_at timestamptz` on
-- game_insider_round records when scoring ran. The function early-returns
-- if scored_at is non-null, so any number of concurrent or sequential calls
-- apply scoring exactly once. The phase flip itself is also idempotent via
-- a WHERE-clause guard (`phase = 'voting'`) — no double-flip is possible.
--
-- Scoring rules (per C2.A and PRD US-5a.12):
--   * Group caught Insider (Insider's player_id ∈ top-voted set):
--       Master + each Common  +2 pts
--       Insider               +0
--   * Insider escaped (Insider ∉ top-voted set):
--       Insider               +3 pts
--       others                +0
--   * Tied vote between suspects (D2 — generous to detection): all tied
--     are 'caught'. If Insider is in the tied set → caught case; otherwise
--     → escaped. (My implementation falls out of "is Insider in top_voted?".)
--   * Time expired:
--       - asking-phase timeout (phase = result_failed): everyone +0.
--       - voting-phase timeout with zero votes: everyone +0.
--     Both branches stamp scored_at without applying any total_score
--     updates so the round is observably scored.
--
-- Realtime: the new `scored_at` column is intentionally NOT added to the
-- `supabase_realtime` publication's column list for game_insider_round.
-- Clients react to the `phase` column (already broadcast); when they see
-- phase='reveal' or phase='result_failed' they fetch the scoreboard from
-- the players table directly. Adding scored_at to realtime would require
-- dropping and re-adding the table to the publication (PG cannot edit a
-- column-list publication entry in place), which is more churn than the
-- single bit of derived state warrants. Anon SELECT grant on scored_at is
-- still added so test/admin clients can read it via PostgREST.
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon is the only role apps
-- connect with, and the RLS-bypass is needed because anon has no UPDATE on
-- game_insider_round or players.

begin;

-- 1. Idempotency column. NULL until scoring runs; stamped once at the
--    moment scores are applied. game_insider_round was created in 0017
--    with column-level anon SELECT grants — extend that list with the
--    new column so anon clients (and tests) can read it.
alter table game_insider_round
  add column if not exists scored_at timestamptz;

grant select (scored_at) on game_insider_round to anon;

create or replace function advance_to_reveal(
  p_room_id uuid,
  p_round   int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase            text;
  v_scored_at        timestamptz;
  v_vote_deadline    timestamptz;
  v_eligible         uuid[];
  v_eligible_n       int;
  v_vote_count       int;
  v_insider_id       uuid;
  v_top_count        int;
  v_top_voted        uuid[];
  v_caught           boolean;
begin
  -- 1. Self-heal any expired deadline (T-2.A). reconcile flips
  --    voting → reveal if vote_deadline passed and asking → result_failed
  --    if the asking timer expired.
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Read post-reconcile state.
  select phase, scored_at, vote_deadline, eligible_voter_ids
    into v_phase, v_scored_at, v_vote_deadline, v_eligible
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round;

  -- 3. Idempotency guard: scoring already applied. Subsequent calls early-
  --    return. The phase is whatever it was (reveal or result_failed); no
  --    further state change.
  if v_scored_at is not null then
    return;
  end if;

  -- 4. result_failed branch: asking-phase timed out, master never marked
  --    correct. No scoring (everyone +0); stamp scored_at and exit so the
  --    UI can move on. Phase stays 'result_failed' (Screen 16c).
  if v_phase = 'result_failed' then
    update game_insider_round
       set scored_at = now()
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  -- 5. If we're in 'voting', try to advance to 'reveal'. Conditions:
  --    (a) every eligible voter has cast — count game_insider_votes rows
  --        whose voter_player_id ∈ eligible_voter_ids[] and compare to the
  --        snapshot length, OR
  --    (b) vote_deadline already passed (reconcile would have flipped it,
  --        so this falls into the next branch below).
  --    If neither, we were called too early — silent no-op.
  if v_phase = 'voting' then
    v_eligible_n := coalesce(array_length(v_eligible, 1), 0);

    select count(*) into v_vote_count
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible);

    if v_vote_count < v_eligible_n
       and (v_vote_deadline is null or now() < v_vote_deadline) then
      return;  -- called early; not all voted and deadline not passed.
    end if;

    -- Flip voting → reveal. WHERE-clause phase guard makes this idempotent
    -- if cast_vote (US-048) flipped it concurrently.
    update game_insider_round
       set phase = 'reveal'
     where room_id      = p_room_id
       and round_number = p_round
       and phase        = 'voting';

    v_phase := 'reveal';
  end if;

  -- 6. Compute scoring only if we're now in 'reveal'. Other phases
  --    (preparing, asking, guessed) shouldn't reach this point but guard
  --    defensively — bail without stamping scored_at so a later call can
  --    pick up correctly when the phase advances.
  if v_phase <> 'reveal' then
    return;
  end if;

  -- 7. Find this round's Insider.
  select player_id
    into v_insider_id
    from game_insider_roles
   where room_id      = p_room_id
     and round_number = p_round
     and role         = 'insider';

  -- 8. Count eligible-voter ballots. (Eligibility is already enforced at
  --    cast_vote time, but re-filter defensively in case eligibility was
  --    backfilled later or a row leaked in via admin tooling.)
  select count(*) into v_vote_count
    from game_insider_votes
   where room_id      = p_room_id
     and round_number = p_round
     and voter_player_id = any(v_eligible);

  -- 9. Time expired with no votes (voting-phase timeout, nobody voted)
  --    → everyone +0, just stamp scored_at.
  if v_vote_count = 0 then
    update game_insider_round
       set scored_at = now()
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  -- 10. Compute the top-voted set. Tied players all share the top count
  --     per D2 ("all tied counted as caught"). v_top_voted is the array
  --     of player_ids tied at the maximum vote count.
  with tally as (
    select voted_player_id, count(*)::int as c
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible)
     group by voted_player_id
  )
  select max(c) into v_top_count from tally;

  with tally as (
    select voted_player_id, count(*)::int as c
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible)
     group by voted_player_id
  )
  select array_agg(voted_player_id) into v_top_voted
    from tally
   where c = v_top_count;

  v_caught := v_insider_id = any(v_top_voted);

  if v_caught then
    -- Group caught Insider: Master + each Common +2 pts, Insider +0.
    update players p
       set total_score = p.total_score + 2
      from game_insider_roles r
     where r.room_id      = p_room_id
       and r.round_number = p_round
       and r.player_id    = p.player_id
       and p.room_id      = p_room_id
       and r.role in ('master', 'player');
  else
    -- Insider escaped: Insider +3, others +0.
    update players
       set total_score = total_score + 3
     where room_id   = p_room_id
       and player_id = v_insider_id;
  end if;

  -- 11. Stamp scored_at last so the function is idempotent: any concurrent
  --     advance_to_reveal call observing scored_at IS NOT NULL early-returns
  --     in step 3 instead of re-applying scoring.
  update game_insider_round
     set scored_at = now()
   where room_id      = p_room_id
     and round_number = p_round
     and scored_at is null;
end;
$$;

grant execute on function advance_to_reveal(uuid, int) to anon;

commit;
