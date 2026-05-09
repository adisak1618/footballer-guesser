-- 0033_get_revealed_secret.sql
-- US-062 / Phase 5b.7a — public secret reveal RPC.
--
-- During the asking phase, game_insider_round.secret_value is column-RLS-
-- protected (migration 0017): anon SELECT is denied so Common players never
-- see it via PostgREST or Realtime. Master/Insider fetch it via the
-- SECURITY DEFINER `get_my_insider_secret` RPC (migration 0021).
--
-- On the reveal screen (phase ∈ {'reveal', 'result_failed'}) every player
-- needs to see the secret. Adding `secret_value` to the anon column grant
-- would leak it during 'asking', so we expose it through a SECURITY DEFINER
-- RPC that gates on the phase column. Anyone in the room can call it once
-- the round has resolved.
--
-- Membership check: caller must be in the room (PGAME11). Phase check:
-- secret only returned when phase ∈ {'reveal', 'result_failed'}; otherwise
-- raise PGAME21 = "secret not yet revealed". The phase guard is the
-- contract; anti-cheat is bulletproof against direct-RPC abuse.

begin;

create or replace function get_revealed_secret(
  p_room_id   uuid,
  p_round     int,
  p_player_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase  text;
  v_secret text;
begin
  -- Self-heal expired deadlines so a "should be reveal" round whose
  -- phase column is stale (timed out) returns the secret instead of
  -- raising PGAME21.
  perform reconcile_round_phase(p_room_id, p_round);

  -- Membership check (PGAME11).
  if not exists (
    select 1 from players
     where room_id = p_room_id and player_id = p_player_id
  ) then
    raise exception 'PGAME11: caller is not a member of this room'
      using errcode = 'PG011';
  end if;

  -- Phase + secret read in one shot.
  select phase, secret_value
    into v_phase, v_secret
    from game_insider_round
   where room_id      = p_room_id
     and round_number = p_round;

  if v_phase is null then
    raise exception 'PGAME22: round not found'
      using errcode = 'PG022';
  end if;

  if v_phase not in ('reveal', 'result_failed') then
    raise exception 'PGAME21: secret not yet revealed (phase=%)', v_phase
      using errcode = 'PG021';
  end if;

  return v_secret;
end;
$$;

grant execute on function get_revealed_secret(uuid, int, uuid) to anon;

commit;
