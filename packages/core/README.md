# @social-hub/core

Cross-game client primitives: room codes, Supabase clients, Realtime subscription
hook, dispatch wrapper with typed errors, player-id helpers.

Imported by every game app (`apps/headball`, future `apps/insider`, `apps/hub`).
Game-agnostic — never reach for game-specific tables, RPC names, or schemas in here.

See `error-codes.md` for the cross-game Postgres `errcode` ranges (PGAME01–PGAME99).

## Realtime publication discipline (decision A4)

When a migration creates a table whose rows clients need to **subscribe to** via
Supabase Realtime, the same migration (or any later migration) MUST also add the
table to the realtime publication:

```sql
alter publication supabase_realtime add table <table_name>;
```

Without this line, `useRoomRealtime` (and any future hook) will silently miss
INSERT/UPDATE/DELETE events for that table — clients show stale state until the
next manual refetch. This has burned us before; the eng review (A4) made it a
hard rule.

If a table is intentionally NOT published (write-only counter, lookup table
seeded server-side, audit log not surfaced to clients), mark the create with a
trailing comment so the guard knows you made a deliberate decision:

```sql
create table round_positions ( -- no-realtime
  ...
);
```

`scripts/check-realtime-publication.sh` (wired into `bun run lint`) enforces
both paths: every `create table <name>` in `supabase/migrations/*.sql` must
either have a matching `alter publication ... add table <name>;` somewhere in
the migrations, or be tagged with `-- no-realtime` on the same line. CI fails
otherwise.

Run the check directly:

```bash
bun run lint:realtime
```

### Tables currently in the publication (Headball)

- `rooms`, `players`, `round_state`, `round_events` — clients subscribe via
  `useRoomRealtime` from this package.

### Tables intentionally `-- no-realtime`

- `round_positions` — atomic counter; clients don't need its row events.
- `football_players`, `player_clubs`, `categories`, `category_players` — server-side
  lookup tables seeded out-of-band; clients query via RPC, never subscribe.

### Column-list publications for asymmetric secrets (A1.C)

Tables with a column the client must NOT see (e.g. `game_insider_round.secret_value`)
publish an explicit column list:

```sql
alter publication supabase_realtime add table game_insider_round (
  room_id, round_number, pack_slug, time_limit_s, started_at, vote_deadline,
  guessed_at, guessed_by_player_id, eligible_voter_ids, phase
);
```

Postgres column-level GRANTs (`grant select (col1, col2, ...) to anon`) protect
the REST path, but they do NOT filter Realtime payloads. Without the column list
above, anon subscribers receive `secret_value` in every change event regardless
of GRANTs. Master/Insider fetch the secret out-of-band via SECURITY DEFINER RPC.
The realtime-publication lint regex captures the table name and ignores the
column list, so this form passes the gate.
