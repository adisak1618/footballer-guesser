-- 0031_advance_to_next_round.sql
-- Phase 5b.7a / US-062 — advance_to_next_round RPC (T-3.B).
--
-- ANY connected player on the reveal (or result_failed) screen may click the
-- NEXT ROUND CTA. This RPC drives the room out of the just-finished round and
-- back to LOBBY so the host can start the next round (start_insider_round
-- already enforces the host-only gate + computes the next round_number via
-- max+1, which keeps multi-round support forward-compatible).
--
-- Per design doc C2.A state machine: reveal → (next round). The simplest
-- wiring that respects T-3.B "anyone advances" + the existing LOBBY-only
-- start_insider_round gate is to flip rooms.status back to 'LOBBY'. Players,
-- their total_score, and the just-completed game_insider_round row are all
-- preserved (the round_number on the next start_insider_round call will be
-- max(round_number)+1 = 2). Future Phase-6 multi-round automation can replace
-- this with a richer "auto-advance to round N+1" path; for now the design
-- contract is clear and minimal.
--
-- Idempotency: phase- and status-guarded. The WHERE clause demands the room
-- is currently PLAYING and the round is in 'reveal' or 'result_failed';
-- concurrent fires by all 4 clients collapse safely to one DB write (the
-- second hit updates zero rows because status was just flipped).
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon is the only role apps
-- connect with, and the RLS-bypass is needed because anon has no UPDATE on
-- rooms.

begin;

create or replace function advance_to_next_round(
  p_room_id   uuid,
  p_round     int,
  p_player_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase    text;
  v_status   text;
  v_count    int;
begin
  -- 1. Self-heal expired deadlines (T-2.A) so a stale 'voting' phase from a
  --    timeout ride-out advances to 'reveal' before we evaluate.
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Membership check (PGAME11) — caller must be in the room.
  if not exists (
    select 1 from players
     where room_id = p_room_id and player_id = p_player_id
  ) then
    raise exception 'PGAME11: caller is not a member of this room'
      using errcode = 'PG011';
  end if;

  -- 3. Read post-reconcile state.
  select phase into v_phase
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round;

  select status into v_status
    from rooms
   where id = p_room_id;

  -- 4. Phase guard. Only callable after the round resolved. Anything else is
  --    a no-op (concurrent / out-of-order client click); return 0 so callers
  --    can observe nothing-happened without an error.
  if v_phase not in ('reveal', 'result_failed') then
    return 0;
  end if;

  if v_status <> 'PLAYING' then
    return 0;
  end if;

  -- 5. Flip room back to LOBBY. WHERE-clause guard makes concurrent fires
  --    idempotent (only one writer succeeds; the rest update zero rows).
  update rooms
     set status = 'LOBBY'
   where id     = p_room_id
     and status = 'PLAYING';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function advance_to_next_round(uuid, int, uuid) to anon;

commit;
