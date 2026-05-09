-- 0029_create_insider_room.sql
-- Phase 5b.2 / US-053 — create_insider_room RPC + game_insider_room_config table.
--
-- Insider host setup screen (apps/insider/new) collects three settings on top
-- of the host display name: pack slug, time limit per round, and round count.
-- These are written atomically with the room itself via a SECURITY DEFINER RPC
-- modeled on Headball's `create_room` (migration 0002), but with the Insider-
-- specific extras stashed in a sibling table `game_insider_room_config`.
--
-- Why a separate table (not extra columns on `rooms`):
--   - Keeps `rooms` game-agnostic (per design doc D3 / Phase 4 scope) — only
--     `game_type` distinguishes which game owns the room.
--   - Keeps Phase 5 changes additive vs. Headball schema (per C4 / FR-3.4).
--   - Future games that need different config (e.g. a hypothetical Hangman
--     pack + difficulty) get their own `game_<game>_room_config` table without
--     bloating `rooms` with optional/nullable columns.
--
-- Why `-- no-realtime`:
--   - The config row is written exactly once at room creation and never
--     mutated afterward. Clients that need it (lobby, start-round screen) can
--     fetch it via `select` once on mount; no row-event subscription needed.
--
-- Error codes (PGAMExx → 5-char SQLSTATE PGxxx, see error-codes.md):
--   PGAME20 / PG020 — invalid insider room args (range/length checks)

begin;

-- ---------------------------------------------------------------------------
-- game_insider_room_config: per-room Insider host settings.
-- ---------------------------------------------------------------------------
create table game_insider_room_config ( -- no-realtime
  room_id      uuid primary key references rooms(id) on delete cascade,
  pack_slug    text not null references content_packs(slug),
  time_limit_s int not null check (time_limit_s in (180, 300, 420)),
  round_count  int not null check (round_count between 1 and 10),
  created_at   timestamptz not null default now()
);

alter table game_insider_room_config enable row level security;

-- Anon can read the config (lobby + start-round screens need it). Writes are
-- locked down to the SECURITY DEFINER RPC below.
create policy game_insider_room_config_anon_select on game_insider_room_config
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- create_insider_room: host opens a fresh Insider room. Generates one 6-char
-- code (caller is expected to retry on unique violation per createRoomWithRetry
-- in packages/core/src/room-code.ts). Mirrors the create_room shape but adds
-- pack_slug / time_limit_s / round_count and tags game_type='insider'.
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
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes ambiguous 0,O,1,I
  v_code   char(6);
  v_room   uuid;
  v_i      int;
  v_name   text := trim(p_host_name);
begin
  -- Input validation. The form constrains these client-side, but server-side
  -- gates protect against direct-RPC abuse and surface clean errors.
  if p_time_limit_s not in (180, 300, 420) then
    raise exception 'PGAME20: invalid time_limit_s: % (allowed: 180, 300, 420)', p_time_limit_s
      using errcode = 'PG020';
  end if;
  if p_round_count is null or p_round_count < 1 or p_round_count > 10 then
    raise exception 'PGAME20: invalid round_count: % (allowed: 1..10)', p_round_count
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

  -- Pack must exist + be enabled. Doing the check here (rather than relying
  -- only on the FK on game_insider_room_config) lets us return a typed error
  -- code instead of a 23503 FK violation.
  if not exists (
    select 1 from content_packs
    where slug = p_pack_slug and enabled = true
  ) then
    raise exception 'PGAME01: pack not found or disabled: %', p_pack_slug
      using errcode = 'PG001';
  end if;

  -- Generate a 6-char room code. createRoomWithRetry retries on unique
  -- violation, so we don't loop here.
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

revoke execute on function create_insider_room(text, int, int, text, uuid) from public;
grant execute on function create_insider_room(text, int, int, text, uuid) to anon;

commit;
