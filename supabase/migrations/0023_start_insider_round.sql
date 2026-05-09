-- 0023_start_insider_round.sql
-- Phase 5a.7 / US-044 — start_insider_round RPC.
--
-- Host-only RPC that begins a new Insider round. Validates LOBBY status and
-- player-count gate, picks a secret via get_random_pack_item (cross-game pack
-- dispatcher from migration 0015), inserts the new round in 'preparing' phase,
-- assigns roles randomly to all current players (1 master + 1 insider + (N-2)
-- player), and transitions rooms to PLAYING.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME04 / PG004 — room not found (cross-game)
--   PGAME12 / PG012 — only host can start round (insider)
--   PGAME13 / PG013 — room not in lobby (insider)
--   PGAME14 / PG014 — fewer than 3 players (insider)
--   PGAME01 / PG001 — pack not found (raised by get_random_pack_item)
--
-- Idempotency note: the LOBBY-only gate is the de-facto "exactly once per
-- game" guard. After the first successful call, rooms.status flips to PLAYING
-- and a second call returns PGAME13. Subsequent rounds (round 2+) are out of
-- scope for this story; a future "next_insider_round" RPC will own that edge.

begin;

create or replace function start_insider_round(
  p_room_id      uuid,
  p_pack_slug    text,
  p_time_limit_s int,
  p_player_id    uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host          uuid;
  v_status        room_status;
  v_player_count  int;
  v_player_ids    uuid[];
  v_round_number  int;
  v_secret        text;
begin
  -- 1. Lock the room row to read host_player_id + status atomically.
  select host_player_id, status
    into v_host, v_status
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  -- 2. Authorization: only host may start the round.
  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can start round'
      using errcode = 'PG012';
  end if;

  -- 3. Room must be in LOBBY.
  if v_status <> 'LOBBY' then
    raise exception 'PGAME13: room not in lobby (status=%)', v_status
      using errcode = 'PG013';
  end if;

  -- 4. Need at least 3 players (1 master + 1 insider + ≥1 commons).
  --    array_agg(... order by random()) shuffles the player list in a single
  --    pass — the first two slots become master/insider, the rest are commons.
  select count(*), array_agg(player_id order by random())
    into v_player_count, v_player_ids
    from players
   where room_id = p_room_id;

  if v_player_count < 3 then
    raise exception 'PGAME14: need at least 3 players (have %)', v_player_count
      using errcode = 'PG014';
  end if;

  -- 5. Pick the secret. get_random_pack_item raises PGAME01 / PG001 if the
  --    pack slug is unknown; we let that propagate.
  select display_value
    into v_secret
    from get_random_pack_item(p_pack_slug);

  -- 6. Determine the next round_number for this room. With the LOBBY gate this
  --    is always 1 today, but the coalesce(max+1) form is forward-compatible
  --    with a future "next_insider_round" RPC.
  select coalesce(max(round_number), 0) + 1
    into v_round_number
    from game_insider_round
   where room_id = p_room_id;

  -- 7. Insert the round in 'preparing' phase. started_at remains NULL until
  --    advance_to_asking (migration 0022) flips phase → 'asking'.
  insert into game_insider_round (
    room_id,
    round_number,
    pack_slug,
    secret_value,
    time_limit_s,
    phase
  ) values (
    p_room_id,
    v_round_number,
    p_pack_slug,
    v_secret,
    p_time_limit_s,
    'preparing'
  );

  -- 8. Assign roles. v_player_ids[1] = master, [2] = insider, rest = player.
  insert into game_insider_roles (room_id, round_number, player_id, role)
  select p_room_id,
         v_round_number,
         v_player_ids[i],
         case
           when i = 1 then 'master'
           when i = 2 then 'insider'
           else 'player'
         end
    from generate_subscripts(v_player_ids, 1) as g(i);

  -- 9. Transition room to PLAYING + bump current_round.
  update rooms
     set status        = 'PLAYING',
         current_round = v_round_number
   where id = p_room_id;

  return v_round_number;
end;
$$;

grant execute on function start_insider_round(uuid, text, int, uuid) to anon;

commit;
