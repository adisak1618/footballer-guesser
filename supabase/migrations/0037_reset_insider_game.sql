-- 0037_reset_insider_game.sql
-- Issue #24 — host wipes per-round state mid-game.
--
-- Two callers:
--   1. Mid-game RESET — host between rounds taps the RESET GAME button on
--      the lobby. Wipes scores + rounds, keeps players + room shell.
--   2. End-of-game PLAY AGAIN / BACK TO LOBBY — host on the FinalScoreboard
--      (current_round >= max_rounds, phase ∈ reveal/result_failed) taps
--      either CTA. Both paths call this RPC; PLAY AGAIN then chains
--      start_insider_round, BACK TO LOBBY does not.
--
-- Numbering note: rubric called this 0036 but 0035_round_outcome.sql already
-- shipped (issue #17), so this is 0037 (paired with 0036_change_insider_pack).
--
-- Preserved across reset: room code, players (id + display_name + join_order),
-- host_player_id, and game_insider_room_config (pack_slug, time_limit_s,
-- round_count). Wiped: per-round tables (game_insider_round / _roles /
-- _votes / _responses), players.total_score, rooms.current_round, rooms.status.
--
-- Cross-reference: Headball's reset_game (0034_reset_game_unlock_category) is
-- the structural sibling. Differences are (a) Insider's per-round tables are
-- different and (b) Insider does not have category_locked.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME04 / PG004 — room not found (cross-game)
--   PGAME12 / PG012 — only host can reset (matches start_insider_round)
--   PGAME13 / PG013 — room not in a state where reset is allowed
--                     (rejects preparing/asking/voting/guessed phases)
--
-- Realtime: rooms is already published; the status flip + current_round flip
-- broadcast to all subscribers, so non-host clients see the reset without
-- needing a separate notification channel.

begin;

create or replace function reset_insider_game(
  p_room_id   uuid,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host          uuid;
  v_status        room_status;
  v_current_round int;
  v_round_phase   text;
begin
  -- 1. Lock the room row.
  select host_player_id, status, current_round
    into v_host, v_status, v_current_round
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  -- 2. Authorization: host only.
  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can reset game'
      using errcode = 'PG012';
  end if;

  -- 3. State guard. Allowed states:
  --      a. status = LOBBY AND current_round >= 1
  --         → "between rounds" (mid-game reset path).
  --      b. status = PLAYING AND latest round phase ∈ ('reveal','result_failed')
  --         → "end of game" (PLAY AGAIN / BACK TO LOBBY from FinalScoreboard).
  --    Any other state (initial lobby, preparing/asking/voting/guessed) is a
  --    PGAME13 reject so we never wipe scores out from under an in-flight
  --    round.
  if v_status = 'LOBBY' then
    if coalesce(v_current_round, 0) < 1 then
      raise exception 'PGAME13: nothing to reset (initial lobby)'
        using errcode = 'PG013';
    end if;
  elsif v_status = 'PLAYING' then
    select phase
      into v_round_phase
      from game_insider_round
     where room_id      = p_room_id
       and round_number = v_current_round;

    if v_round_phase is null
       or v_round_phase not in ('reveal', 'result_failed') then
      raise exception 'PGAME13: cannot reset during active round (phase=%)',
                      coalesce(v_round_phase, 'unknown')
        using errcode = 'PG013';
    end if;
  else
    raise exception 'PGAME13: room not in resettable state (status=%)', v_status
      using errcode = 'PG013';
  end if;

  -- 4. Wipe per-round tables. Order does not matter (no FKs between them) but
  --    we delete child-shaped tables (votes/responses/roles) before the
  --    parent (game_insider_round) for clarity.
  delete from game_insider_votes      where room_id = p_room_id;
  delete from game_insider_responses  where room_id = p_room_id;
  delete from game_insider_roles      where room_id = p_room_id;
  delete from game_insider_round      where room_id = p_room_id;

  -- 5. Zero per-player scores.
  update players
     set total_score = 0
   where room_id = p_room_id;

  -- 6. Reset room shell. We set current_round to 0 (not NULL) to match the
  --    initial state from create_insider_room (0029) — the rooms.current_round
  --    column defaults to 0, and the lobby UI treats `?? 0` as the not-yet-
  --    started sentinel. The "between rounds vs initial" distinction is
  --    encoded as current_round >= 1, so 0 here means "back to initial lobby".
  update rooms
     set status        = 'LOBBY',
         current_round = 0
   where id = p_room_id;

  -- game_insider_room_config (pack_slug, time_limit_s, round_count) is
  -- intentionally untouched — preserved across reset per the issue contract.
end;
$$;

revoke execute on function reset_insider_game(uuid, uuid) from public;
grant execute on function reset_insider_game(uuid, uuid) to anon;

commit;
