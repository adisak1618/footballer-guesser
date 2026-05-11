-- 0038_insider_rounds_locked.sql
-- Issue #27 — unified RoomSetupPanel + lockable round count for Insider.
--
-- Adds `rounds_locked` to rooms (default false). Mirrors the existing
-- `category_locked` lifecycle (migration 0007): flip true at first
-- start_insider_round; flip back to false on reset_insider_game.
--
-- Also adds change_insider_max_rounds RPC for the new editable max_rounds
-- control on the Insider lobby. Gated on rounds_locked = false (so once a
-- match is underway the round count is frozen until reset). Authorization
-- mirrors change_insider_pack (PG012 host-only, PG013 wrong-state).
--
-- Also widens change_insider_pack: previously rejected status='LOBBY' when
-- current_round < 1 (initial-lobby case). The redesign deletes the /new
-- host-setup screen, so the initial lobby is now the canonical place to pick
-- the pack — change_insider_pack must accept current_round = 0.
--
-- Realtime: `rooms` is already published; rounds_locked rides on the existing
-- row-event broadcast, no publication change required (CLAUDE.md A4).

begin;

-- ---------------------------------------------------------------------------
-- Schema: rooms.rounds_locked
-- ---------------------------------------------------------------------------
alter table rooms add column if not exists rounds_locked bool not null default false;

-- ---------------------------------------------------------------------------
-- start_insider_round: flip rounds_locked true on first round start. Mirrors
-- the category_locked flip in headball start_game (migration 0007).
-- ---------------------------------------------------------------------------
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
  select host_player_id, status
    into v_host, v_status
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can start round'
      using errcode = 'PG012';
  end if;

  if v_status <> 'LOBBY' then
    raise exception 'PGAME13: room not in lobby (status=%)', v_status
      using errcode = 'PG013';
  end if;

  select count(*), array_agg(player_id order by random())
    into v_player_count, v_player_ids
    from players
   where room_id = p_room_id;

  if v_player_count < 3 then
    raise exception 'PGAME14: need at least 3 players (have %)', v_player_count
      using errcode = 'PG014';
  end if;

  select display_value
    into v_secret
    from get_random_pack_item(p_pack_slug);

  select coalesce(max(round_number), 0) + 1
    into v_round_number
    from game_insider_round
   where room_id = p_room_id;

  insert into game_insider_round (
    room_id, round_number, pack_slug, secret_value, time_limit_s, phase
  ) values (
    p_room_id, v_round_number, p_pack_slug, v_secret, p_time_limit_s, 'preparing'
  );

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

  -- Issue #27 — flip rounds_locked on first round start. Idempotent on
  -- subsequent rounds (already true). reset_insider_game (0037, patched below)
  -- restores the unlocked state.
  update rooms
     set status        = 'PLAYING',
         current_round = v_round_number,
         rounds_locked = true
   where id = p_room_id;

  return v_round_number;
end;
$$;

grant execute on function start_insider_round(uuid, text, int, uuid) to anon;

-- ---------------------------------------------------------------------------
-- reset_insider_game: clear rounds_locked alongside the existing wipe. Mirrors
-- reset_game (0034) clearing category_locked.
-- ---------------------------------------------------------------------------
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
  select host_player_id, status, current_round
    into v_host, v_status, v_current_round
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can reset game'
      using errcode = 'PG012';
  end if;

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

  delete from game_insider_votes      where room_id = p_room_id;
  delete from game_insider_responses  where room_id = p_room_id;
  delete from game_insider_roles      where room_id = p_room_id;
  delete from game_insider_round      where room_id = p_room_id;

  update players
     set total_score = 0
   where room_id = p_room_id;

  update rooms
     set status        = 'LOBBY',
         current_round = 0,
         rounds_locked = false
   where id = p_room_id;
end;
$$;

revoke execute on function reset_insider_game(uuid, uuid) from public;
grant execute on function reset_insider_game(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- change_insider_pack: widen state guard so status='LOBBY' is allowed even
-- when current_round = 0 (initial lobby — /new host-setup screen is removed
-- in issue #27; the lobby owns initial pack selection). Between-rounds rule
-- still rejects mid-flight phases (preparing/asking/voting/guessed).
-- ---------------------------------------------------------------------------
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
  select host_player_id, status, current_round
    into v_host, v_status, v_current_round
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can change pack'
      using errcode = 'PG012';
  end if;

  -- Issue #27 — accept any LOBBY status (initial lobby OR between-rounds).
  if v_status <> 'LOBBY' then
    raise exception 'PGAME13: pack can only be changed in lobby (status=%)', v_status
      using errcode = 'PG013';
  end if;

  -- If a round has been played, guard against mid-flight phase.
  if coalesce(v_current_round, 0) >= 1 then
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
  end if;

  if not exists (
    select 1 from content_packs
     where slug    = p_pack_slug
       and enabled = true
  ) then
    raise exception 'PGAME20: pack not found or disabled: %', p_pack_slug
      using errcode = 'PG020';
  end if;

  update game_insider_room_config
     set pack_slug = p_pack_slug
   where room_id   = p_room_id;
end;
$$;

revoke execute on function change_insider_pack(uuid, uuid, text) from public;
grant execute on function change_insider_pack(uuid, uuid, text) to anon;

-- ---------------------------------------------------------------------------
-- change_insider_max_rounds: host edits the per-match round cap from the
-- lobby. Writes to rooms.max_rounds (the canonical Insider round cap, set on
-- create_insider_room → 0029). Gated on rounds_locked=false so the cap is
-- frozen once round 1 starts (until reset_insider_game clears the lock).
-- ---------------------------------------------------------------------------
create or replace function change_insider_max_rounds(
  p_room_id    uuid,
  p_player_id  uuid,
  p_max_rounds int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host          uuid;
  v_status        room_status;
  v_rounds_locked bool;
begin
  select host_player_id, status, rounds_locked
    into v_host, v_status, v_rounds_locked
    from rooms
   where id = p_room_id
   for update;

  if v_host is null then
    raise exception 'PGAME04: room not found: %', p_room_id
      using errcode = 'PG004';
  end if;

  if v_host <> p_player_id then
    raise exception 'PGAME12: only host can change round count'
      using errcode = 'PG012';
  end if;

  if v_status <> 'LOBBY' then
    raise exception 'PGAME13: round count can only be changed in lobby (status=%)', v_status
      using errcode = 'PG013';
  end if;

  if v_rounds_locked then
    raise exception 'PGAME13: round count is locked for this match'
      using errcode = 'PG013';
  end if;

  if p_max_rounds is null or p_max_rounds < 1 or p_max_rounds > 10 then
    raise exception 'PGAME20: invalid max_rounds: % (allowed: 1..10)', p_max_rounds
      using errcode = 'PG020';
  end if;

  update rooms
     set max_rounds = p_max_rounds
   where id = p_room_id;

  -- Mirror the change in game_insider_room_config.round_count so the seed of
  -- truth for create_insider_room's contract (round count) stays consistent.
  update game_insider_room_config
     set round_count = p_max_rounds
   where room_id     = p_room_id;
end;
$$;

revoke execute on function change_insider_max_rounds(uuid, uuid, int) from public;
grant execute on function change_insider_max_rounds(uuid, uuid, int) to anon;

commit;
