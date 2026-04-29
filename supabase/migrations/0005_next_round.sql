-- next_round: host advances the room from one round to the next (or to ENDED).
-- Verifies the round is fully resolved (no remaining is_active=true rows), settles
-- per-player score_this_round into players.total_score, then either ends the game
-- or increments rooms.current_round and re-runs start_round to seed fresh names.
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
begin
  select host_player_id, status, current_round, max_rounds
    into v_host, v_status, v_round, v_max
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

  -- Settle: roll score_this_round into players.total_score for the just-finished round.
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
    update rooms set current_round = v_round + 1 where id = p_room_id;
    perform start_round(p_room_id, p_host_player_id);
  end if;
end;
$$;

revoke execute on function next_round(uuid, uuid) from public;
grant execute on function next_round(uuid, uuid) to anon;
