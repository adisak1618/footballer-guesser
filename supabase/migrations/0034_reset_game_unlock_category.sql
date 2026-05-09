-- 0034_reset_game_unlock_category: when the host returns the room from ENDED
-- to LOBBY, also clear `category_locked` so players can pick a different
-- category for the next game. Issue #14: Category selector was stuck disabled
-- after the first game ended because 0006_reset_game.sql never reset the flag
-- that 0007_lobby_settings.sql / start_game flips on first start.

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
     set status          = 'LOBBY',
         current_round   = 0,
         category_locked = false
   where id = p_room_id;
end;
$$;

revoke execute on function reset_game(uuid, uuid) from public;
grant execute on function reset_game(uuid, uuid) to anon;
