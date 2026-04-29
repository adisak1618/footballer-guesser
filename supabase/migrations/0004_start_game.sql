-- start_game: host transitions a LOBBY room into PLAYING + round 1.
-- Updates rooms.status='PLAYING', current_round=1, then delegates round_state
-- assignment to start_round. Anon cannot UPDATE rooms directly (RLS), so all
-- room state mutations must flow through this SECURITY DEFINER wrapper.
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
begin
  select host_player_id, status into v_host, v_status
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
        current_round = 1
    where id = p_room_id;

  perform start_round(p_room_id, p_host_player_id);
end;
$$;

revoke execute on function start_game(uuid, uuid) from public;
grant execute on function start_game(uuid, uuid) to anon;
