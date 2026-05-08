-- 0021_get_my_insider_secret.sql
-- Phase 5a.5 / US-042 — get_my_insider_secret RPC (A1.C).
--
-- Asymmetric secret access. The Insider `secret_value` column on
-- `game_insider_round` is column-protected (migration 0017): anon has no
-- direct SELECT grant, so `select secret_value` and `select *` both fail with
-- 42501. Master and Insider need the secret to play; commons must not see it.
-- This SECURITY DEFINER function bridges the gap: it joins
-- `game_insider_roles` to determine the caller's role for the round, and
-- returns the secret only when that role is 'master' or 'insider'. Commons
-- and any caller without a role assignment receive NULL (not an error — we
-- want clients to be able to call this freely without per-role branching).
--
-- Identity model (T-3): there is no auth.uid() — players are anonymous and
-- pass their `player_id` in every RPC call. This function therefore takes
-- p_player_id as a parameter; it cannot be derived from the JWT. This is
-- safe because role assignment for the round is the access-control source of
-- truth: a caller who guesses someone else's player_id only sees the secret
-- if that other player happens to be master/insider, which is the same
-- information that player would have leaked themselves.

begin;

create or replace function get_my_insider_secret(
  p_room_id uuid,
  p_round int,
  p_player_id uuid
) returns text
language sql
security definer
set search_path = public
as $$
  select r.secret_value
    from game_insider_round r
    join game_insider_roles roles
      on roles.room_id      = r.room_id
     and roles.round_number = r.round_number
   where r.room_id      = p_room_id
     and r.round_number = p_round
     and roles.player_id = p_player_id
     and roles.role in ('master', 'insider');
$$;

grant execute on function get_my_insider_secret(uuid, int, uuid) to anon;

commit;
