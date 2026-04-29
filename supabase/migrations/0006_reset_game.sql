-- reset_game: host returns the room from ENDED back to LOBBY for a rematch.
-- Wipes per-round state (round_state, round_positions, round_events), zeros each
-- player's total_score, sets rooms.status='LOBBY' and current_round=0. Realtime
-- publication on rooms/players will flip every client back to the lobby view.
create or replace function reset_game(
  p_room_id uuid,
  p_host_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host   uuid;
  v_status room_status;
begin
  select host_player_id, status
    into v_host, v_status
  from rooms where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_host <> p_host_player_id then
    raise exception 'not host' using errcode = 'P0005';
  end if;
  if v_status <> 'ENDED' then
    raise exception 'room not ended' using errcode = 'P0009';
  end if;

  delete from round_events    where room_id = p_room_id;
  delete from round_state     where room_id = p_room_id;
  delete from round_positions where room_id = p_room_id;

  update players set total_score = 0 where room_id = p_room_id;

  update rooms
     set status = 'LOBBY',
         current_round = 0
   where id = p_room_id;
end;
$$;

revoke execute on function reset_game(uuid, uuid) from public;
grant execute on function reset_game(uuid, uuid) to anon;
