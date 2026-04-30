-- 0007_lobby_settings: host-configurable lobby settings + Phase 1 scoring guard.
--
-- Phase 1: clamp the *effective* score_positions used for scoring to
--   LEAST(rooms.score_positions, player_count - 1)
-- at round start, so 2-player games no longer hand out points to the loser
-- (top-N=3 default with 2 players previously gave 3pt/2pt; now gives 1pt/0pt).
--
-- Phase 2: update_room_settings RPC writes max_rounds / score_positions /
-- category from the host while room.status = 'LOBBY'. Category is locked once
-- any round has been played (rooms.category_locked).

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table rooms add column if not exists effective_score_positions int;
alter table rooms add column if not exists category_locked bool not null default false;

-- ---------------------------------------------------------------------------
-- start_game: same as 0004 plus effective_score_positions clamp +
-- category_locked flip on first start.
-- ---------------------------------------------------------------------------
create or replace function start_game(
  p_room_id uuid,
  p_host_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host         uuid;
  v_status       room_status;
  v_player_count int;
  v_score_pos    int;
begin
  select host_player_id, status, score_positions
    into v_host, v_status, v_score_pos
  from rooms where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_host <> p_host_player_id then
    raise exception 'not host' using errcode = 'P0005';
  end if;
  if v_status <> 'LOBBY' then
    raise exception 'room not in lobby' using errcode = 'P0003';
  end if;

  select count(*) into v_player_count
  from players where room_id = p_room_id;
  if v_player_count < 2 then
    raise exception 'need at least 2 players' using errcode = 'P0006';
  end if;

  update rooms
    set status = 'PLAYING',
        current_round = 1,
        effective_score_positions = least(v_score_pos, v_player_count - 1),
        category_locked = true
    where id = p_room_id;

  perform start_round(p_room_id, p_host_player_id);
end;
$$;

revoke execute on function start_game(uuid, uuid) from public;
grant execute on function start_game(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- next_round: same as 0005 plus effective_score_positions recompute when
-- starting the next round. Handles the edge case where a player drops
-- between rounds.
-- ---------------------------------------------------------------------------
create or replace function next_round(
  p_room_id uuid,
  p_host_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host         uuid;
  v_status       room_status;
  v_round        int;
  v_max          int;
  v_active_left  int;
  v_player_count int;
  v_score_pos    int;
begin
  select host_player_id, status, current_round, max_rounds, score_positions
    into v_host, v_status, v_round, v_max, v_score_pos
  from rooms where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_host <> p_host_player_id then
    raise exception 'not host' using errcode = 'P0005';
  end if;
  if v_status <> 'PLAYING' then
    raise exception 'room not playing' using errcode = 'P0007';
  end if;

  select count(*) into v_active_left
  from round_state
  where room_id = p_room_id
    and round_number = v_round
    and is_active = true;

  if v_active_left > 0 then
    raise exception 'round still in progress' using errcode = 'P0008';
  end if;

  update players p
  set total_score = coalesce(p.total_score, 0) + coalesce(rs.score_this_round, 0)
  from round_state rs
  where rs.room_id = p_room_id
    and rs.round_number = v_round
    and rs.player_id = p.player_id
    and rs.room_id = p.room_id;

  insert into round_events (room_id, round_number, player_id, type)
  values (p_room_id, v_round, p_host_player_id, 'ROUND_END');

  if v_round >= v_max then
    update rooms set status = 'ENDED' where id = p_room_id;
  else
    select count(*) into v_player_count
    from players where room_id = p_room_id;

    update rooms
      set current_round = v_round + 1,
          effective_score_positions = least(v_score_pos, greatest(v_player_count - 1, 1))
      where id = p_room_id;

    perform start_round(p_room_id, p_host_player_id);
  end if;
end;
$$;

revoke execute on function next_round(uuid, uuid) from public;
grant execute on function next_round(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- submit_guess: same as 0002 except effective_score_positions takes
-- precedence when set, falling back to score_positions for legacy rooms
-- created before this migration.
-- ---------------------------------------------------------------------------
create or replace function submit_guess(
  p_room_id uuid,
  p_round_number int,
  p_player_id uuid,
  p_guess text
) returns table (correct bool, "position" int, score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned  text;
  v_pos       int;
  v_score_pos int;
  v_score     int;
  v_correct   bool;
begin
  select assigned_name into v_assigned
  from round_state
  where room_id = p_room_id
    and round_number = p_round_number
    and player_id = p_player_id
    and is_active = true
  for update;

  if v_assigned is null then
    raise exception 'player not active or not found';
  end if;

  v_correct := lower(trim(p_guess)) = lower(trim(v_assigned));

  if v_correct then
    update round_positions
    set next_position = next_position + 1
    where room_id = p_room_id and round_number = p_round_number
    returning next_position - 1 into v_pos;

    select coalesce(effective_score_positions, score_positions)
      into v_score_pos
    from rooms where id = p_room_id;

    if v_pos <= v_score_pos then
      v_score := v_score_pos - v_pos + 1;
    else
      v_score := 0;
    end if;

    update round_state
    set score_this_round = v_score,
        is_active = false,
        final_position = v_pos
    where room_id = p_room_id
      and round_number = p_round_number
      and player_id = p_player_id;

    insert into round_events (room_id, round_number, player_id, type, guess_text, position)
    values (p_room_id, p_round_number, p_player_id, 'GUESS_OK', p_guess, v_pos);
  else
    update round_state
    set is_active = false
    where room_id = p_room_id
      and round_number = p_round_number
      and player_id = p_player_id;

    insert into round_events (room_id, round_number, player_id, type, guess_text)
    values (p_room_id, p_round_number, p_player_id, 'FOUL', p_guess);
  end if;

  return query select v_correct, v_pos, coalesce(v_score, 0);
end;
$$;

revoke execute on function submit_guess(uuid, int, uuid, text) from public;
grant execute on function submit_guess(uuid, int, uuid, text) to anon;

-- ---------------------------------------------------------------------------
-- update_room_settings: host writes max_rounds / score_positions / category
-- from the lobby. Validates host, room status, ranges, and the
-- category-locked flag (set once a round has been played).
-- ---------------------------------------------------------------------------
create or replace function update_room_settings(
  p_room_id uuid,
  p_host_player_id uuid,
  p_max_rounds int,
  p_score_positions int,
  p_category text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host           uuid;
  v_status         room_status;
  v_player_count   int;
  v_max_top_n      int;
  v_current_cat    text;
  v_locked         bool;
begin
  if p_max_rounds is null or p_max_rounds < 1 or p_max_rounds > 20 then
    raise exception 'invalid max_rounds: %', p_max_rounds using errcode = 'P0010';
  end if;
  if p_score_positions is null or p_score_positions < 1 or p_score_positions > 8 then
    raise exception 'invalid score_positions: %', p_score_positions using errcode = 'P0010';
  end if;
  if p_category is null or char_length(trim(p_category)) < 1 then
    raise exception 'invalid category' using errcode = 'P0010';
  end if;

  select host_player_id, status, category, category_locked
    into v_host, v_status, v_current_cat, v_locked
  from rooms where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_host <> p_host_player_id then
    raise exception 'not host' using errcode = 'P0005';
  end if;
  if v_status <> 'LOBBY' then
    raise exception 'room not in lobby' using errcode = 'P0003';
  end if;

  if v_locked and p_category <> v_current_cat then
    raise exception 'category locked' using errcode = 'P0011';
  end if;

  select count(*) into v_player_count
  from players where room_id = p_room_id;

  v_max_top_n := greatest(v_player_count - 1, 1);
  if p_score_positions > v_max_top_n then
    raise exception 'score_positions exceeds max for player count' using errcode = 'P0012';
  end if;

  update rooms
    set max_rounds      = p_max_rounds,
        score_positions = p_score_positions,
        category        = p_category
    where id = p_room_id;
end;
$$;

revoke execute on function update_room_settings(uuid, uuid, int, int, text) from public;
grant execute on function update_room_settings(uuid, uuid, int, int, text) to anon;
