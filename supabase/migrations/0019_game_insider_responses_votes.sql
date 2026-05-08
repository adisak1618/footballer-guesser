-- 0019_game_insider_responses_votes.sql
-- Phase 5a.3 / US-5a.3 — game_insider_responses + game_insider_votes.
--
-- game_insider_responses: append-only feed of Master answers (yes/no/unsure)
-- per round. Every response renders publicly so all clients can watch the
-- round unfold — there is no asymmetric secrecy here. The asymmetric secret
-- (the football term Master + Insider know) lives on game_insider_round and
-- is column-level protected by migration 0017 (A1.C); responses just say
-- whether the secret matches a player's question.
--
-- game_insider_votes: who voted whom in the post-guess voting phase. PK is
-- (room_id, round_number, voter_player_id) so each voter casts at most one
-- ballot per round. voted_player_id is uuid (player id) but we don't FK
-- into a player table because Insider does not yet have a per-game player
-- table — players are room-scoped via the existing `players` table from
-- Headball-era schema. The vote target is validated at RPC time (cast_vote
-- in a later story) against the round's `eligible_voter_ids[]`.
--
-- Both tables: RLS on, anon SELECT permitted (votes and responses are
-- public to the room). Both publish to supabase_realtime so clients can
-- live-update the response feed and the vote tally.

begin;

create table game_insider_responses (
  id           bigserial primary key,
  room_id      uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  response     text not null
    check (response in ('yes','no','unsure')),
  created_at   timestamptz not null default now()
);

create index game_insider_responses_room_round_idx
  on game_insider_responses (room_id, round_number, id);

alter table game_insider_responses enable row level security;

create policy game_insider_responses_anon_select on game_insider_responses
  for select to anon using (true);

create table game_insider_votes (
  room_id         uuid not null references rooms(id) on delete cascade,
  round_number    int not null,
  voter_player_id uuid not null,
  voted_player_id uuid not null,
  voted_at        timestamptz not null default now(),
  primary key (room_id, round_number, voter_player_id)
);

alter table game_insider_votes enable row level security;

create policy game_insider_votes_anon_select on game_insider_votes
  for select to anon using (true);

alter publication supabase_realtime add table game_insider_responses;
alter publication supabase_realtime add table game_insider_votes;

commit;
