-- 0036_change_insider_pack.sql
-- Issue #24 — between-rounds host-edit pack RPC.
--
-- After a round completes (rooms.status flips back to LOBBY via
-- advance_to_next_round, migration 0031) the host gets pack chips on the
-- lobby screen. This RPC is the write path for those chips. It updates
-- game_insider_room_config.pack_slug for the room, which the next
-- start_insider_round call reads (migration 0023's start_insider_round looks
-- up pack_slug on every call, so the new pack takes effect for round N+1).
--
-- Why between-rounds only:
--   The "initial lobby" before round 1 picks its pack on the host setup form
--   (apps/insider/app/new) which writes via create_insider_room (0029). That
--   is the canonical mechanism for picking the round-1 pack. This RPC is
--   strictly the "host changes their mind between rounds" path and rejects
--   the initial-lobby case so the host setup form stays the single owner of
--   first-round pack selection.
--
-- Numbering note: rubric called this 0035 but 0035_round_outcome.sql already
-- shipped (issue #17). 0036 is the next free slot.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME04 / PG004 — room not found (cross-game)
--   PGAME12 / PG012 — only host can change pack (matches start_insider_round)
--   PGAME13 / PG013 — room not in valid between-rounds state
--   PGAME20 / PG020 — pack not found or disabled (matches create_insider_room
--                     argument-validation channel)
--
-- Realtime: game_insider_room_config is `-- no-realtime` (per its create
-- comment in 0029) — clients re-fetch on the rooms.current_round flip that
-- accompanies start_insider_round. No publication change required.

begin;

create or replace function change_insider_pack(
  p_room_id   uuid,
  p_player_id uuid,
  p_pack_slug text
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
  -- 1. Lock the room row so host + state checks are atomic against any
  --    concurrent advance_to_next_round / start_insider_round.
  select host_player_id, status, current_round
    into v_host, v_status, v_current_round
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  -- 2. Authorization: host only. Mirrors start_insider_round (0023) so the
  --    UI's host-only chip rendering matches the server gate.
  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can change pack'
      using errcode = 'PG012';
  end if;

  -- 3. State guard: room must be in LOBBY (so no round is mid-flight) AND
  --    a round must already have been played (current_round >= 1 — the
  --    "between rounds" predicate). The initial-lobby case (current_round
  --    null/0) is rejected because that path goes through create_insider_room.
  --
  --    Also defend against the edge where status = LOBBY but the most-recent
  --    round row is still mid-phase (advance_to_next_round only flips status,
  --    not the round row). If the latest round is in 'preparing'/'asking'/
  --    'voting'/'guessed' the room is not really between rounds yet.
  if v_status <> 'LOBBY' or coalesce(v_current_round, 0) < 1 then
    raise exception 'PGAME13: pack can only be changed between rounds'
      using errcode = 'PG013';
  end if;

  select phase
    into v_round_phase
    from game_insider_round
   where room_id      = p_room_id
     and round_number = v_current_round;

  if v_round_phase is not null
     and v_round_phase not in ('reveal', 'result_failed') then
    raise exception 'PGAME13: pack cannot change during an active round'
      using errcode = 'PG013';
  end if;

  -- 4. Pack must exist + be enabled. Same convention as create_insider_room
  --    (0029), but raised under PGAME20 so the dispatch wrapper surfaces the
  --    "invalid argument" channel that the host-setup form already maps.
  if not exists (
    select 1 from content_packs
     where slug    = p_pack_slug
       and enabled = true
  ) then
    raise exception 'PGAME20: pack not found or disabled: %', p_pack_slug
      using errcode = 'PG020';
  end if;

  -- 5. Apply. Idempotent — same pack assignment is a no-op write.
  update game_insider_room_config
     set pack_slug = p_pack_slug
   where room_id   = p_room_id;
end;
$$;

revoke execute on function change_insider_pack(uuid, uuid, text) from public;
grant execute on function change_insider_pack(uuid, uuid, text) to anon;

commit;
