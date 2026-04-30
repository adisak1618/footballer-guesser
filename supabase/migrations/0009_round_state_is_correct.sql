-- 0009_round_state_is_correct.sql
-- Issue #8: GuessResult mislabels a non-top-N correct guess as Foul.
-- Root cause: playing.tsx routes the result screen off score_this_round > 0,
-- conflating "earned points" with "guessed correctly". With Top-N below
-- player count (e.g. Top-N=1, 2 players), the second correct guesser scores
-- 0 and is misclassified as Foul.
--
-- Fix: persist the correctness signal on round_state so the realtime client
-- (already subscribed to round_state) can route on it without conflating
-- with the score. round_events already records GUESS_OK vs FOUL but is not
-- realtime-subscribed by playing.tsx; adding the boolean to round_state is
-- the minimum-touch fix and matches the rubric intent (DB-sourced
-- is_correct boolean, not a points compare).
--
-- Layered on top of 0008_fuzzy_match.sql — only the round_state UPDATE
-- statements gain the new column write; fuzzy match logic is preserved.

alter table round_state
  add column if not exists is_correct boolean;

create or replace function submit_guess(
  p_room_id uuid,
  p_round_number int,
  p_player_id uuid,
  p_guess text
) returns table (correct bool, "position" int, score int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_assigned       text;
  v_assigned_norm  text;
  v_guess_norm     text;
  v_pos            int;
  v_score_pos      int;
  v_score          int;
  v_correct        bool;
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

  v_guess_norm    := lower(trim(unaccent(p_guess)));
  v_assigned_norm := lower(trim(unaccent(v_assigned)));
  v_correct       := levenshtein(v_guess_norm, v_assigned_norm) <= 2;

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
        final_position = v_pos,
        is_correct = true
    where room_id = p_room_id
      and round_number = p_round_number
      and player_id = p_player_id;

    insert into round_events (room_id, round_number, player_id, type, guess_text, position)
    values (p_room_id, p_round_number, p_player_id, 'GUESS_OK', p_guess, v_pos);
  else
    update round_state
    set is_active = false,
        is_correct = false
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
grant  execute on function submit_guess(uuid, int, uuid, text) to anon;
