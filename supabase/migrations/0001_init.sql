-- Headball schema: rooms, players, round_state, round_positions, round_events, football_players.
-- All client writes go through Postgres functions (see 0002+); RLS allows anon SELECT only.

-- Enums
create type room_status as enum ('LOBBY', 'PLAYING', 'ENDED');
create type event_type as enum ('GUESS_OK', 'FOUL', 'ROUND_END');

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) unique not null,
  status room_status default 'LOBBY',
  current_round int default 0,
  max_rounds int not null,
  score_positions int not null,
  category text not null default 'premier-league',
  host_player_id uuid,
  created_at timestamptz default now()
);

-- Players (per room)
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid not null,
  display_name varchar(20) not null,
  join_order int not null,
  connected bool default true,
  total_score int default 0,
  unique(room_id, player_id)
);

-- Round state per player
create table round_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_number int not null,
  player_id uuid not null,
  assigned_name text not null,
  score_this_round int default 0,
  is_active bool default true,
  final_position int,
  unique(room_id, round_number, player_id)
);

-- Atomic position counter per round
create table round_positions (
  room_id uuid references rooms(id) on delete cascade,
  round_number int not null,
  next_position int default 1,
  primary key (room_id, round_number)
);

-- Round events (audit log)
create table round_events (
  id bigserial primary key,
  room_id uuid references rooms(id) on delete cascade,
  round_number int not null,
  player_id uuid not null,
  type event_type not null,
  guess_text text,
  position int,
  created_at timestamptz default now()
);

-- Football players (seeded in 0002_seed_players.sql)
create table football_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unique (name, category)
);
create index football_players_category_idx on football_players (category);

-- Realtime publication: clients subscribe to room/player/round-state changes.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table round_state;
alter publication supabase_realtime add table round_events;

-- RLS: anon role can SELECT every table (public lookup by room code).
-- All writes must go through SECURITY DEFINER functions; no INSERT/UPDATE/DELETE
-- policies are granted to anon, so direct table writes from the client fail.
alter table rooms             enable row level security;
alter table players           enable row level security;
alter table round_state       enable row level security;
alter table round_positions   enable row level security;
alter table round_events      enable row level security;
alter table football_players  enable row level security;

create policy rooms_anon_select            on rooms            for select to anon using (true);
create policy players_anon_select          on players          for select to anon using (true);
create policy round_state_anon_select      on round_state      for select to anon using (true);
create policy round_positions_anon_select  on round_positions  for select to anon using (true);
create policy round_events_anon_select     on round_events     for select to anon using (true);
create policy football_players_anon_select on football_players for select to anon using (true);
