# Game RPC Error Codes

Per design doc decision **C1.B**, every Postgres function in the multi-game platform uses the convention:

```sql
raise exception 'pack not found: %', p_slug using errcode = 'PGAME01';
```

The `dispatch()` wrapper in `packages/core/src/dispatch.ts` parses the Supabase error's `code` field and throws a `GameRpcError` carrying:

- `code` — the parsed PGAMExx code (or `"UNKNOWN"` if absent)
- `message` — the original Postgres message
- `context` — `{ rpc, args }` for debugging

## Reserved code ranges

| Range            | Owner                           |
| ---------------- | ------------------------------- |
| `PGAME01`–`PGAME09` | **Cross-game** (shared by all games) |
| `PGAME10`–`PGAME49` | **Insider** (game-specific)      |
| `PGAME50`–`PGAME89` | **Future games** (reserved)      |
| `PGAME90`–`PGAME99` | **Reserved for platform-level errors** |

> **Note on Postgres SQLSTATE conformance:** Postgres SQLSTATE codes are conventionally 5 chars. PostgreSQL rejects the literal 7-char string `'PGAME01'` as an unrecognized exception condition at apply time, so migrations map `PGAMExx` → 5-char SQLSTATE `'PGxxx'` (class `PG` is unreserved by PostgreSQL). The symbolic name `PGAMExx` is also embedded at the start of the error message for human readability and for downstream parsers that prefer the symbolic form. The dispatch wrapper is agnostic — it returns whatever string lives in `error.code` (i.e. the 5-char SQLSTATE).
>
> **SQLSTATE mapping (established in migration 0015):**
>
> | Symbolic   | SQLSTATE | First used in                         |
> | ---------- | -------- | ------------------------------------- |
> | `PGAME01`  | `PG001`  | `0015_get_random_pack_item.sql`       |
> | `PGAME11`  | `PG011`  | `0022_advance_to_asking.sql`          |
> | `PGAME12`  | `PG012`  | `0023_start_insider_round.sql`        |
> | `PGAME13`  | `PG013`  | `0023_start_insider_round.sql`        |
> | `PGAME14`  | `PG014`  | `0023_start_insider_round.sql`        |
> | `PGAME02`  | `PG002`  | `0024_master_respond.sql`             |
> | `PGAME15`  | `PG015`  | `0024_master_respond.sql`             |
> | `PGAME16`  | `PG016`  | `0024_master_respond.sql`             |
>
> Future codes follow the same pattern: `PGAME02` → `PG002`, …, `PGAME99` → `PG099`. When a Phase 5+ Insider migration introduces a new `PGAMExx`, raise it as `errcode = 'PGxxx'` with the message prefixed by `'PGAMExx: '`. App-side handlers can match on either `error.code === 'PGxxx'` (the SQLSTATE) or the message prefix.

## Cross-game codes (PGAME01–PGAME09)

| Code      | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `PGAME01` | Pack not found (content_packs lookup failed for the given slug). |
| `PGAME02` | Round expired (a per-RPC time guard tripped — see T-2.A).        |
| `PGAME03` | Player not authorized for this action.                           |
| `PGAME04` | Room not found.                                                  |
| `PGAME05` | Room state invalid for this action (e.g. not in `playing`).      |
| `PGAME06` | Reserved.                                                        |
| `PGAME07` | Reserved.                                                        |
| `PGAME08` | Reserved.                                                        |
| `PGAME09` | Reserved.                                                        |

## Insider codes (PGAME10–PGAME49)

Reserved for the Insider game (Phase 5). Specific assignments are made when the relevant migration lands. Bindings so far:

- `PGAME11` — player not in room (caller-membership check on Insider RPCs; bound by `0022_advance_to_asking.sql`)
- `PGAME12` — only host can start round (host authorization on `start_insider_round`; bound by `0023_start_insider_round.sql`)
- `PGAME13` — room not in lobby (LOBBY-status guard on `start_insider_round`; bound by `0023_start_insider_round.sql`)
- `PGAME14` — fewer than 3 players (player-count gate on `start_insider_round`; bound by `0023_start_insider_round.sql`)
- `PGAME15` — only master can respond (master-only authorization on `master_respond`; bound by `0024_master_respond.sql`)
- `PGAME16` — phase != 'asking' (phase guard on `master_respond`; bound by `0024_master_respond.sql`)
- `PGAME10`, `PGAME17`+ — unassigned. Future Insider RPCs (`mark_correct_guess`, `cast_vote`, …) will pick from the next free slots.

## Future games (PGAME50–PGAME89)

Reserved blocks for games that ship after Insider. Assigned per-game when the game lands.

## UNKNOWN

If the Supabase error has no `code` field, `dispatch()` throws `GameRpcError` with `code = "UNKNOWN"`. Treat this as an unexpected backend or network condition; surface a generic Thai error message in the UI and log `error.context` for diagnostics.

## Adding a new code

1. Pick the next free slot in the appropriate range.
2. Add the `raise exception ... using errcode = 'PGAMExx'` in the migration.
3. Append a row to the table above with a one-line meaning.
4. (Optional) Add a Thai user-facing message in the consuming app's error map.
