-- 0035_round_outcome.sql
-- Issue #17 — record the round outcome explicitly + tighten round_count to 3-10.
--
-- BACKGROUND
-- ----------
-- Migration 0028/0032 already applies the scoring matrix server-side (Master +
-- Common +2 on caught, Insider +3 on escape, all 0 on time-up) into
-- players.total_score. What is missing is an explicit, queryable record of
-- WHICH outcome occurred — the UI infers it today by re-tallying votes.
--
-- This migration fills that gap by adding a typed `outcome` column on
-- game_insider_round and stamping it inside advance_to_reveal at the same
-- moment scored_at is stamped (so callers cannot observe "scored but no
-- outcome"). The three values mirror the scoring lib at
-- apps/insider/lib/scoring.ts.
--
-- WHY A COLUMN, NOT A SIBLING TABLE
-- ---------------------------------
-- The outcome is intrinsically 1:1 with a round and never updated after the
-- first stamp. A sibling table would only buy us anything if we needed
-- per-outcome metadata (timestamp ranges, sub-states) that don't fit on
-- game_insider_round. We don't, so the column is the smaller, faster, less
-- ceremonial choice. Same justification scored_at chose in 0028.
--
-- REALTIME PUBLICATION
-- --------------------
-- We deliberately do NOT add `outcome` to the column-list publication for
-- game_insider_round. The reveal screen already subscribes to the `phase`
-- column (already in the publication) and re-fetches the round row when
-- phase flips to 'reveal' / 'result_failed'. Adding `outcome` to the
-- publication would force a drop+re-add of the table (PG cannot edit a
-- column-list publication entry in place — see 0028 commentary), which is
-- more churn than the single derived bit warrants. Per-player score deltas
-- broadcast via the `players` table publication, which is what the rubric
-- A4 acceptance criterion (per-player per-match score broadcast) actually
-- requires.
--
-- ROUND COUNT TIGHTENING (3-10)
-- -----------------------------
-- Issue #17 also tightens the host-setup rounds control to 3-10 (was 1-10).
-- Drop the existing CHECK on game_insider_room_config.round_count and
-- replace with the tighter range; align the create_insider_room input
-- validation. Use NOT VALID so existing dev/local rooms with round_count=1
-- or 2 (created during pre-issue-17 testing) are not rejected at migration
-- time; only new INSERTs are enforced. There is no production data this
-- could affect — the local Postgres is the only consumer.

begin;

-- ---------------------------------------------------------------------------
-- 1. Outcome column on game_insider_round.
-- ---------------------------------------------------------------------------
alter table game_insider_round
  add column if not exists outcome text
    check (outcome in ('WORD_NOT_GUESSED','INSIDER_CAUGHT','INSIDER_ESCAPED'));

-- 0017 stripped table-wide SELECT from anon and re-grants column-by-column.
-- Add the new column to anon's grant list so the reveal screen can read it.
grant select (outcome) on game_insider_round to anon;

-- ---------------------------------------------------------------------------
-- 2. Tighten round_count to 3-10 on game_insider_room_config.
--    The constraint name follows Postgres' default `<table>_<column>_check`
--    naming for the original check (round_count between 1 and 10).
-- ---------------------------------------------------------------------------
alter table game_insider_room_config
  drop constraint if exists game_insider_room_config_round_count_check;

alter table game_insider_room_config
  add constraint game_insider_room_config_round_count_check
    check (round_count between 3 and 10) not valid;

-- ---------------------------------------------------------------------------
-- 3. create_insider_room: align input validation with the new range.
--    Same body as 0029, only the round_count guard tightens.
-- ---------------------------------------------------------------------------
create or replace function create_insider_room(
  p_pack_slug      text,
  p_time_limit_s   int,
  p_round_count    int,
  p_host_name      text,
  p_host_player_id uuid
) returns table (code char(6), player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code   char(6);
  v_room   uuid;
  v_i      int;
  v_name   text := trim(p_host_name);
begin
  if p_time_limit_s not in (180, 300, 420) then
    raise exception 'PGAME20: invalid time_limit_s: % (allowed: 180, 300, 420)', p_time_limit_s
      using errcode = 'PG020';
  end if;
  if p_round_count is null or p_round_count < 3 or p_round_count > 10 then
    raise exception 'PGAME20: invalid round_count: % (allowed: 3..10)', p_round_count
      using errcode = 'PG020';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'PGAME20: invalid display_name length'
      using errcode = 'PG020';
  end if;
  if p_host_player_id is null then
    raise exception 'PGAME20: host_player_id required'
      using errcode = 'PG020';
  end if;

  if not exists (
    select 1 from content_packs
    where slug = p_pack_slug and enabled = true
  ) then
    raise exception 'PGAME01: pack not found or disabled: %', p_pack_slug
      using errcode = 'PG001';
  end if;

  v_code := '';
  for v_i in 1..6 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;

  insert into rooms (
    code, max_rounds, score_positions, host_player_id, status, game_type
  ) values (
    v_code, p_round_count, 1, p_host_player_id, 'LOBBY', 'insider'
  )
  returning id into v_room;

  insert into players (room_id, player_id, display_name, join_order)
  values (v_room, p_host_player_id, v_name, 1);

  insert into game_insider_room_config (
    room_id, pack_slug, time_limit_s, round_count
  ) values (
    v_room, p_pack_slug, p_time_limit_s, p_round_count
  );

  return query select v_code, p_host_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. advance_to_reveal: stamp outcome alongside scored_at.
--    Same logic as 0032, three new lines (one per branch) that derive and
--    write the outcome string. The matrix stays where it was (server side);
--    the outcome column is purely a labeling convenience for clients +
--    audit queries.
-- ---------------------------------------------------------------------------
create or replace function advance_to_reveal(
  p_room_id uuid,
  p_round   int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase            text;
  v_scored_at        timestamptz;
  v_vote_deadline    timestamptz;
  v_eligible         uuid[];
  v_eligible_n       int;
  v_vote_count       int;
  v_insider_id       uuid;
  v_top_count        int;
  v_top_voted        uuid[];
  v_caught           boolean;
begin
  perform reconcile_round_phase(p_room_id, p_round);

  select phase, scored_at, vote_deadline, eligible_voter_ids
    into v_phase, v_scored_at, v_vote_deadline, v_eligible
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round
     for update;

  if v_scored_at is not null then
    return;
  end if;

  -- result_failed branch (asking-phase timeout): everyone +0, outcome =
  -- WORD_NOT_GUESSED.
  if v_phase = 'result_failed' then
    update game_insider_round
       set scored_at = now(),
           outcome   = 'WORD_NOT_GUESSED'
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  if v_phase = 'voting' then
    v_eligible_n := coalesce(array_length(v_eligible, 1), 0);

    select count(*) into v_vote_count
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible);

    if v_vote_count < v_eligible_n
       and (v_vote_deadline is null or now() < v_vote_deadline) then
      return;
    end if;

    update game_insider_round
       set phase = 'reveal'
     where room_id      = p_room_id
       and round_number = p_round
       and phase        = 'voting';

    v_phase := 'reveal';
  end if;

  if v_phase <> 'reveal' then
    return;
  end if;

  select player_id
    into v_insider_id
    from game_insider_roles
   where room_id      = p_room_id
     and round_number = p_round
     and role         = 'insider';

  select count(*) into v_vote_count
    from game_insider_votes
   where room_id      = p_room_id
     and round_number = p_round
     and voter_player_id = any(v_eligible);

  -- voting-phase timeout with zero votes: word was guessed but nobody voted
  -- so the Insider escapes detection by default. Per design doc D2 + the
  -- rubric matrix, this maps to INSIDER_ESCAPED (the Insider gets +3) NOT
  -- WORD_NOT_GUESSED — the word DID get guessed in this branch.
  --
  -- Note: if the vote-phase deadline expired with zero votes we still award
  -- the Insider escape; this matches the existing behavior of advance to
  -- reveal which already stamps scored_at without applying any vote tally
  -- when v_vote_count = 0. The rubric treats the question as binary
  -- ("Was the Insider correctly identified during the voting phase?"), so
  -- "no votes cast" → "not identified" → escaped.
  if v_vote_count = 0 then
    update players
       set total_score = total_score + 3
     where room_id   = p_room_id
       and player_id = v_insider_id;

    update game_insider_round
       set scored_at = now(),
           outcome   = 'INSIDER_ESCAPED'
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
    return;
  end if;

  with tally as (
    select voted_player_id, count(*)::int as c
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible)
     group by voted_player_id
  )
  select max(c) into v_top_count from tally;

  with tally as (
    select voted_player_id, count(*)::int as c
      from game_insider_votes
     where room_id      = p_room_id
       and round_number = p_round
       and voter_player_id = any(v_eligible)
     group by voted_player_id
  )
  select array_agg(voted_player_id) into v_top_voted
    from tally
   where c = v_top_count;

  v_caught := v_insider_id = any(v_top_voted);

  if v_caught then
    update players p
       set total_score = p.total_score + 2
      from game_insider_roles r
     where r.room_id      = p_room_id
       and r.round_number = p_round
       and r.player_id    = p.player_id
       and p.room_id      = p_room_id
       and r.role in ('master', 'player');

    update game_insider_round
       set scored_at = now(),
           outcome   = 'INSIDER_CAUGHT'
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
  else
    update players
       set total_score = total_score + 3
     where room_id   = p_room_id
       and player_id = v_insider_id;

    update game_insider_round
       set scored_at = now(),
           outcome   = 'INSIDER_ESCAPED'
     where room_id      = p_room_id
       and round_number = p_round
       and scored_at is null;
  end if;
end;
$$;

grant execute on function advance_to_reveal(uuid, int) to anon;

commit;
