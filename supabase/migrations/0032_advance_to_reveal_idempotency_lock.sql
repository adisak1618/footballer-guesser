-- 0032_advance_to_reveal_idempotency_lock.sql
-- US-062 / Phase 5b.7a — fix advance_to_reveal idempotency under concurrent
-- fires (T-3.B "anyone advances").
--
-- US-049's migration 0028 used the `scored_at` column as the idempotency
-- guard, but the read at the top of the function was a plain SELECT INTO
-- without a row lock. When all N reveal-screen clients fire
-- advance_to_reveal simultaneously (per T-3.B), every concurrent call
-- read `scored_at IS NULL` BEFORE any of them committed, so each then
-- proceeded to apply the +2 score updates. The final stamping UPDATE
-- (`where scored_at is null`) was idempotent, but the score arithmetic
-- in the body was not — players ended up with N×2 pts instead of 2.
--
-- Fix: re-issue the same function body with a `SELECT ... FOR UPDATE` on
-- the game_insider_round row at the start. PostgreSQL serializes the
-- concurrent calls on that row; the first call sees scored_at = NULL,
-- applies scoring, stamps scored_at, and commits. Subsequent calls block
-- until the first commits, then read the stamped scored_at and return
-- via the existing early-return guard.
--
-- This is an additive fix (CREATE OR REPLACE on the existing function);
-- no signature change, no app-side changes required. Behavior is
-- unchanged for serial callers; concurrent callers now correctly
-- collapse to one scoring application.

begin;

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
  -- 1. Self-heal expired deadline (T-2.A).
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Read post-reconcile state WITH a row lock so concurrent T-3.B
  --    "anyone advances" fires serialize on this row. Without the lock
  --    every concurrent call would read scored_at IS NULL and re-apply
  --    the score deltas (+2 / +3) N times.
  select phase, scored_at, vote_deadline, eligible_voter_ids
    into v_phase, v_scored_at, v_vote_deadline, v_eligible
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round
     for update;

  -- 3. Idempotency guard: scoring already applied. Subsequent calls early-
  --    return (after waiting on the FOR UPDATE lock above).
  if v_scored_at is not null then
    return;
  end if;

  -- 4. result_failed branch: asking-phase timed out, master never marked
  --    correct. No scoring (everyone +0); stamp scored_at and exit.
  if v_phase = 'result_failed' then
    update game_insider_round
       set scored_at = now()
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  -- 5. If we're in 'voting', try to advance to 'reveal'.
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

    update game_insider_round
       set phase = 'reveal'
     where room_id      = p_room_id
       and round_number = p_round
       and phase        = 'voting';

    v_phase := 'reveal';
  end if;

  -- 6. Compute scoring only if we're now in 'reveal'.
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

  -- 8. Count eligible-voter ballots.
  select count(*) into v_vote_count
    from game_insider_votes
   where room_id      = p_room_id
     and round_number = p_round
     and voter_player_id = any(v_eligible);

  -- 9. Time expired with no votes → everyone +0, just stamp scored_at.
  if v_vote_count = 0 then
    update game_insider_round
       set scored_at = now()
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  -- 10. Top-voted set (D2 — ties all share max).
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

  -- 11. Stamp scored_at last for the idempotency guard.
  update game_insider_round
     set scored_at = now()
   where room_id      = p_room_id
     and round_number = p_round
     and scored_at is null;
end;
$$;

grant execute on function advance_to_reveal(uuid, int) to anon;

commit;
