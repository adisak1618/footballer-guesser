-- 0011_difficulty.sql
-- Adds a difficulty selector to rooms. Pool is ranked by sitelinks (fame proxy):
--   easy   → top 50 in the chosen category
--   medium → top 100 (includes easy)
--   hard   → rank 101+ (deeper cuts; falls back to full pool if category ≤ 100)

begin;

alter table rooms
  add column difficulty text not null default 'medium'
  check (difficulty in ('easy','medium','hard'));

-- Old signature changes (added p_difficulty); drop and recreate cleanly.
drop function if exists update_room_settings(uuid, uuid, int, int, text);

create or replace function update_room_settings(
  p_room_id uuid,
  p_host_player_id uuid,
  p_max_rounds int,
  p_score_positions int,
  p_category text,
  p_difficulty text
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
  if p_difficulty is null or p_difficulty not in ('easy','medium','hard') then
    raise exception 'invalid difficulty: %', p_difficulty using errcode = 'P0010';
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
        category        = p_category,
        difficulty      = p_difficulty
    where id = p_room_id;
end;
$$;

revoke execute on function update_room_settings(uuid, uuid, int, int, text, text) from public;
grant execute on function update_room_settings(uuid, uuid, int, int, text, text) to anon;

-- Recreate start_round so the pool is filtered by difficulty + category.
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
  v_difficulty   text;
  v_player_count int;
  v_name_count   int;
begin
  select host_player_id, current_round, category, difficulty
    into v_host, v_round, v_category, v_difficulty
  from rooms where id = p_room_id;

  if v_host is null then
    raise exception 'room % not found', p_room_id;
  end if;
  if v_host <> p_host_player_id then
    raise exception 'only host can start a round';
  end if;

  select count(*) into v_player_count
  from players where room_id = p_room_id;
  if v_player_count = 0 then
    raise exception 'no players in room %', p_room_id;
  end if;

  -- Pool size after applying difficulty filter
  with ranked as (
    select fp.id,
           row_number() over (order by fp.sitelinks desc, fp.id) as rank,
           count(*) over () as cat_size
    from category_players cp
    join football_players fp on fp.id = cp.player_id
    where cp.category_slug = v_category
  )
  select count(*) into v_name_count
  from ranked
  where
    (v_difficulty = 'easy'   and rank <= 50)
    or (v_difficulty = 'medium' and rank <= 100)
    or (v_difficulty = 'hard'   and (rank > 100 or cat_size <= 100));

  if v_name_count < v_player_count then
    raise exception 'not enough names in category % (difficulty %) for % players',
      v_category, v_difficulty, v_player_count
      using errcode = 'P0013';
  end if;

  insert into round_positions (room_id, round_number, next_position)
  values (p_room_id, v_round, 1)
  on conflict (room_id, round_number) do update set next_position = 1;

  with shuffled_players as (
    select player_id, row_number() over (order by random()) as rn
    from players where room_id = p_room_id
  ),
  ranked_names as (
    select fp.name,
           row_number() over (order by fp.sitelinks desc, fp.id) as rank,
           count(*) over () as cat_size
    from category_players cp
    join football_players fp on fp.id = cp.player_id
    where cp.category_slug = v_category
  ),
  filtered_names as (
    select name
    from ranked_names
    where
      (v_difficulty = 'easy'   and rank <= 50)
      or (v_difficulty = 'medium' and rank <= 100)
      or (v_difficulty = 'hard'   and (rank > 100 or cat_size <= 100))
  ),
  shuffled_names as (
    select name, row_number() over (order by random()) as rn
    from filtered_names
  )
  insert into round_state (room_id, round_number, player_id, assigned_name,
                           score_this_round, is_active, final_position)
  select p_room_id, v_round, sp.player_id, sn.name, 0, true, null
  from shuffled_players sp
  join shuffled_names sn on sn.rn = sp.rn
  on conflict (room_id, round_number, player_id) do update
    set assigned_name    = excluded.assigned_name,
        score_this_round = 0,
        is_active        = true,
        final_position   = null;
end;
$$;

commit;
