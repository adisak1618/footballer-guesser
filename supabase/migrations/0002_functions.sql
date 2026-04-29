-- Headball atomic write functions: create_room, join_room, start_round, submit_guess.
-- All run as SECURITY DEFINER; only the anon role gets EXECUTE so clients call them via RPC
-- without ever holding direct INSERT/UPDATE on the underlying tables.

-- ---------------------------------------------------------------------------
-- create_room: host opens a fresh room. Generates one 6-char code (caller is
-- expected to retry on unique violation per lib/room-code.ts).
-- ---------------------------------------------------------------------------
create or replace function create_room(
  p_max_rounds int,
  p_score_positions int,
  p_host_name text,
  p_host_player_id uuid
) returns table (code char(6), player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes ambiguous 0,O,1,I
  v_code   char(6);
  v_room   uuid;
  v_i      int;
  v_name   text := trim(p_host_name);
begin
  if p_max_rounds < 1 or p_max_rounds > 50 then
    raise exception 'invalid max_rounds: %', p_max_rounds;
  end if;
  if p_score_positions < 1 or p_score_positions > 8 then
    raise exception 'invalid score_positions: %', p_score_positions;
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'invalid display_name length';
  end if;
  if p_host_player_id is null then
    raise exception 'host_player_id required';
  end if;

  v_code := '';
  for v_i in 1..6 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;

  insert into rooms (code, max_rounds, score_positions, host_player_id, status)
  values (v_code, p_max_rounds, p_score_positions, p_host_player_id, 'LOBBY')
  returning id into v_room;

  insert into players (room_id, player_id, display_name, join_order)
  values (v_room, p_host_player_id, v_name, 1);

  return query select v_code, p_host_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room: a non-host player joins a LOBBY room. Idempotent on (room, player_id)
-- so a reconnecting client with the same localStorage UUID resumes safely.
-- ---------------------------------------------------------------------------
create or replace function join_room(
  p_code char(6),
  p_player_id uuid,
  p_display_name varchar(20)
) returns table (room_id uuid, player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_room_id uuid;
  v_status  room_status;
  v_count   int;
  v_next_jo int;
  v_name    text := trim(p_display_name);
begin
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'invalid display_name length' using errcode = 'P0001';
  end if;
  if p_player_id is null then
    raise exception 'player_id required' using errcode = 'P0001';
  end if;

  select id, status into v_room_id, v_status
  from rooms where code = upper(p_code)
  for update;

  if v_room_id is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_status <> 'LOBBY' then
    raise exception 'room not in lobby' using errcode = 'P0003';
  end if;

  -- Reconnect path: same player_id already in this room → no-op, return existing.
  perform 1 from players
  where room_id = v_room_id and player_id = p_player_id;
  if found then
    return query select v_room_id, p_player_id;
    return;
  end if;

  select count(*), coalesce(max(join_order), 0) + 1
    into v_count, v_next_jo
  from players where room_id = v_room_id;

  if v_count >= 8 then
    raise exception 'room full' using errcode = 'P0004';
  end if;

  insert into players (room_id, player_id, display_name, join_order)
  values (v_room_id, p_player_id, v_name, v_next_jo);

  return query select v_room_id, p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_round: host kicks off the round identified by rooms.current_round.
-- Picks distinct random football_players names for the room's category and
-- writes one round_state row per player + a fresh round_positions row.
-- Caller is responsible for rooms.status / rooms.current_round transitions.
-- ---------------------------------------------------------------------------
create or replace function start_round(
  p_room_id uuid,
  p_host_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host         uuid;
  v_round        int;
  v_category     text;
  v_player_count int;
  v_name_count   int;
begin
  select host_player_id, current_round, category
    into v_host, v_round, v_category
  from rooms where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'room not found';
  end if;
  if v_host <> p_host_player_id then
    raise exception 'not host';
  end if;
  if v_round < 1 then
    raise exception 'current_round must be >= 1 before start_round';
  end if;

  select count(*) into v_player_count
  from players where room_id = p_room_id;
  if v_player_count < 2 then
    raise exception 'need at least 2 players to start a round';
  end if;

  select count(*) into v_name_count
  from football_players where category = v_category;
  if v_name_count < v_player_count then
    raise exception 'not enough names in category % for % players', v_category, v_player_count;
  end if;

  -- Reset / create the atomic position counter for this round.
  insert into round_positions (room_id, round_number, next_position)
  values (p_room_id, v_round, 1)
  on conflict (room_id, round_number) do update
    set next_position = 1;

  -- Assign distinct random names: shuffle players, shuffle names, join on row number.
  with shuffled_players as (
    select player_id, row_number() over (order by random()) as rn
    from players where room_id = p_room_id
  ),
  shuffled_names as (
    select name, row_number() over (order by random()) as rn
    from football_players where category = v_category
  )
  insert into round_state (room_id, round_number, player_id, assigned_name,
                           score_this_round, is_active, final_position)
  select p_room_id, v_round, sp.player_id, sn.name, 0, true, null
  from shuffled_players sp
  join shuffled_names sn on sn.rn = sp.rn
  on conflict (room_id, round_number, player_id) do update
    set assigned_name     = excluded.assigned_name,
        score_this_round  = 0,
        is_active         = true,
        final_position    = null;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_guess: atomic guess + scoring. Locks the player's round_state row,
-- on correct guess increments round_positions.next_position atomically, on
-- foul flips is_active=false. Race-safe under concurrent guesses.
-- (Logic mirrors docs/PLAN.md verbatim.)
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

    select score_positions into v_score_pos from rooms where id = p_room_id;

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

-- ---------------------------------------------------------------------------
-- Lock down execution: revoke from public, grant only to anon.
-- ---------------------------------------------------------------------------
revoke execute on function create_room(int, int, text, uuid)            from public;
revoke execute on function join_room(char, uuid, varchar)               from public;
revoke execute on function start_round(uuid, uuid)                      from public;
revoke execute on function submit_guess(uuid, int, uuid, text)          from public;

grant execute on function create_room(int, int, text, uuid)             to anon;
grant execute on function join_room(char, uuid, varchar)                to anon;
grant execute on function start_round(uuid, uuid)                       to anon;
grant execute on function submit_guess(uuid, int, uuid, text)           to anon;
