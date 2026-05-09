-- 0022_advance_to_asking.sql
-- Phase 5a.6 / US-043 — advance_to_asking RPC (T-3.B).
--
-- Any connected player (host or not) can advance an Insider round from
-- 'preparing' → 'asking', stamping started_at = now(). Per the design doc
-- T-3.B "anyone can advance" rule, the lobby's "ฉันพร้อมแล้ว" CTA is wired
-- to this RPC for every player; whichever player taps first kicks off the
-- timer for everyone.
--
-- Discipline (per T-2.A):
--   1. perform reconcile_round_phase(p_room_id, p_round) — self-heal any
--      missed deadline before we inspect/advance phase.
--   2. Validate the caller is in the room (members of `players` for this
--      room). Strangers raise PGAME11 / SQLSTATE PG011.
--   3. UPDATE WHERE phase='preparing' so a second call (or any other phase)
--      is a silent no-op. The state machine in design doc C2.A is the
--      contract; this RPC only owns the preparing→asking edge.
--
-- SECURITY DEFINER + GRANT EXECUTE to anon — anon is the only role apps
-- connect with, and the RLS-bypass is needed because anon has no UPDATE on
-- game_insider_round.

begin;

create or replace function advance_to_asking(
  p_room_id uuid,
  p_round int,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Self-heal any expired deadline before we inspect phase (T-2.A).
  perform reconcile_round_phase(p_room_id, p_round);

  -- 2. Caller must be a member of the room.
  if not exists (
    select 1
      from players
     where room_id   = p_room_id
       and player_id = p_player_id
  ) then
    raise exception 'PGAME11: player % is not in room %', p_player_id, p_room_id
      using errcode = 'PG011';
  end if;

  -- 3. Advance preparing → asking. WHERE clause makes this idempotent: any
  -- other phase (asking, guessed, voting, reveal, result_failed) is a
  -- silent no-op — UPDATE simply matches zero rows.
  update game_insider_round
     set phase      = 'asking',
         started_at = now()
   where room_id      = p_room_id
     and round_number = p_round
     and phase        = 'preparing';
end;
$$;

grant execute on function advance_to_asking(uuid, int, uuid) to anon;

commit;
