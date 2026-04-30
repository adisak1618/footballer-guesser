-- 0008_fuzzy_match.sql
-- Replace submit_guess's exact match with levenshtein <= 2 fuzzy compare,
-- after stripping diacritics server-side via the unaccent extension.
-- Per docs/PLAN.md (issue #3): forgive spelling slips so a player who knows
-- the answer but mistypes one or two letters is not punished with a FOUL.
--
-- Layered on top of 0007_lobby_settings.sql, which introduced
-- effective_score_positions (Phase 1 scoring guard). This migration keeps
-- that COALESCE behavior — only the equality check changes.
--
-- Rubric numbering note: the issue body and groomed rubric referenced this
-- file as "0004_fuzzy_match.sql". 0004-0007 were already taken by the time
-- this branch landed, so the file is renumbered to 0008.

create extension if not exists fuzzystrmatch;
create extension if not exists unaccent;

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

  -- Server-side NFD-strip (via unaccent) + casefold + trim, then levenshtein
  -- with threshold 2. Catches: "Gerrand" vs "Gerrard" (1), "Cristano" vs
  -- "Cristiano" (1), missing diacritics on "Mbappe" / "Gundogan" (0 after
  -- unaccent). Rejects: distinct names whose distance exceeds 2.
  v_guess_norm    := lower(trim(unaccent(p_guess)));
  v_assigned_norm := lower(trim(unaccent(v_assigned)));
  v_correct       := levenshtein(v_guess_norm, v_assigned_norm) <= 2;

  if v_correct then
    update round_positions
    set next_position = next_position + 1
    where room_id = p_room_id and round_number = p_round_number
    returning next_position - 1 into v_pos;

    -- Phase 1 scoring guard: prefer effective_score_positions when set
    -- (clamped at start_game/next_round to player_count - 1), fall back
    -- to score_positions for legacy rooms. Mirrors 0007_lobby_settings.sql.
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
grant  execute on function submit_guess(uuid, int, uuid, text) to anon;
