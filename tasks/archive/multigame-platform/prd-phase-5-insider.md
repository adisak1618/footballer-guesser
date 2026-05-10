# PRD: Phase 5 — apps/insider (คนวงใน — Social Deduction Word Game)

**Source of truth:** `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260508-multigame-platform.md`

**Test plan:** `~/.gstack/projects/board-game/adisakchaiyakul-main-eng-review-test-plan-20260508-multigame-platform.md`

**Branch:** `feat/multigame-platform`

**Phase goal:** Build the full Insider game on top of the platform layers. Same-room party game where Master + Insider know a secret word and Commons must guess it via Yes/No/Unsure questions. After correct guess, players vote on who they think the Insider is.

**Honest estimate:** 13-15 working days (5-6 weeks total project; this is the bulk).

**Dependencies:** Phase 4 must be COMPLETE (`phase-4-done` tag pushed).

**Sub-phases (gated independently with /qa each):**
- 5a — Insider migrations + Postgres functions (3 days)
- 5b — e2e infra + happy path flows (3 days)
- 5c — Edge case e2e (10 more T-1.B flows) (4-5 days)
- 5d — UI polish + Stadium Energy theme (3-5 days)

---

## Introduction

This phase implements all design and engineering decisions captured in the source-of-truth design doc. Read the **Engineering Review Decisions** section (decisions A1-A6, C1-C4, T1-T8, T-2.A, T-3.B, T-4) and **Design Review Decisions** section (D1-D6) before starting any story. The state machine spec in C2.A is the contract every Postgres function must respect.

## Goals

### Sub-phase 5a (Postgres layer)
- 5 new tables: `game_insider_round`, `game_insider_roles`, `game_insider_responses`, `game_insider_votes` (with `eligible_voter_ids[]` per T-4)
- 8 new RPCs: `advance_to_asking`, `start_insider_round`, `master_respond`, `mark_correct_guess`, `expire_round`, `cast_vote`, `advance_to_reveal`, `get_my_insider_secret`
- 1 helper function: `reconcile_round_phase` (T-2.A)
- Column-level GRANT excluding `secret_value` from anon SELECT (A1.C)
- All Postgres function tests pass (T-2.B)

### Sub-phase 5b (UI + happy path)
- 7 Insider screens implemented (lobby, role-reveal Master/Insider/Common, asking Master/non-Master, voting, reveal)
- 5 new UI components in `packages/ui` (D1-D6: role-badge, response-button, response-feed-entry, vote-target-card, pack-chip)
- 3 happy-path e2e specs pass (full round caught, full round escaped, time expired)
- Multi-context Playwright config (T-3.A) running hub + headball + insider in parallel

### Sub-phase 5c (edge cases)
- 8 additional e2e flows covering: voting tie, disconnected can be voted for can't vote, mid-round reconnect, late master action rejected, common→master_respond rejected, anon SELECT secret column rejected, race on expire_round (idempotency), `prefers-reduced-motion` reduced animation

### Sub-phase 5d (polish)
- Stadium Energy aesthetic applied per DESIGN.md (Bebas Neue 144px BIG NAME, dark navy, jersey colors)
- All states covered: loading, empty, error, transitions
- Full a11y: keyboard nav, screen reader, color-blind triple-coding, reduced-motion
- 5 new components added to `docs/DESIGN.md`

---

## Sub-phase 5a — Migrations + Postgres Functions

### US-5a.1: Migration 0017 — game_insider_round table (with secret_value column-level access)
**Description:** As Insider, I need a per-round state table with column-level RLS protecting `secret_value` per A1.C.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing test: insert a `game_insider_round` row with secret, query as anon — `secret_value` is NOT returned (column GRANT denies); query via SECURITY DEFINER `get_my_insider_secret` as Master/Insider role — secret IS returned
- [ ] Migration `0017_game_insider_round.sql`:
  - Table with columns: room_id, round_number, pack_slug, secret_value, time_limit_s, started_at, vote_deadline, guessed_at, guessed_by_player_id, eligible_voter_ids uuid[] (T-4), phase enum check ('preparing','asking','guessed','voting','reveal','result_failed')
  - Primary key (room_id, round_number)
  - Enable RLS
  - GRANT SELECT on (all columns EXCEPT secret_value) to anon — explicit column list
  - `alter publication supabase_realtime add table game_insider_round`
- [ ] Test passes
- [ ] `bunx supabase db reset` applies cleanly

### US-5a.2: Migration 0018 — game_insider_roles table
**Description:** As Insider, I need to store who has which role per round.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing test: insert role rows, query returns master/insider/player roles for given room+round
- [ ] Migration `0018_game_insider_roles.sql`:
  - Table: room_id, round_number, player_id, role enum check ('master','insider','player')
  - PK (room_id, round_number, player_id)
  - Enable RLS, anon SELECT policy (roles are public so players know their own role)
  - `alter publication supabase_realtime add table game_insider_roles`
- [ ] Test passes

### US-5a.3: Migration 0019 — game_insider_responses + game_insider_votes
**Description:** As Insider, I need response feed (Master Yes/No/Unsure) and vote storage.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests for both tables
- [ ] Migration `0019_game_insider_responses_votes.sql`:
  - `game_insider_responses (id bigserial PK, room_id, round_number, response text check (response in ('yes','no','unsure')), created_at default now())`
  - `game_insider_votes (room_id, round_number, voter_player_id, voted_player_id, voted_at default now(), PK (room_id, round_number, voter_player_id))`
  - Enable RLS, anon SELECT on both
  - `alter publication supabase_realtime add table game_insider_responses, game_insider_votes`
- [ ] Tests pass

### US-5a.4: reconcile_round_phase helper (T-2.A)
**Description:** As every Insider RPC, I need self-healing phase advancement when no client triggered expire_round.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing test: insert a round in 'asking' phase with `started_at = now() - interval '10 minutes'` and `time_limit_s = 300` (expired). Call `reconcile_round_phase`. Verify phase is now 'result_failed'.
- [ ] Test for voting phase: insert round in 'voting' with `vote_deadline = now() - interval '1 minute'`. Call reconcile. Phase = 'reveal'.
- [ ] Migration `0020_reconcile_round_phase.sql`:
  - SECURITY DEFINER function returns void
  - Updates 'asking' → 'result_failed' if `now() >= started_at + interval`
  - Updates 'voting' → 'reveal' if `now() >= vote_deadline`
  - GRANT EXECUTE to anon
- [ ] Tests pass

### US-5a.5: get_my_insider_secret RPC (A1.C)
**Description:** As Master/Insider, I need to retrieve the secret word via SECURITY DEFINER (anon has no SELECT on column).

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) Master calls returns secret, (b) Insider calls returns secret, (c) Common calls returns NULL, (d) anon direct SELECT on secret_value column raises permission denied
- [ ] Migration `0021_get_my_insider_secret.sql`:
  - SECURITY DEFINER function `get_my_insider_secret(p_room_id uuid, p_round int, p_player_id uuid) returns text`
  - Joins `game_insider_roles`, validates role IN ('master','insider'), returns `secret_value`; else NULL
  - GRANT EXECUTE to anon
- [ ] Tests pass

### US-5a.6: advance_to_asking RPC (T-3.B — anyone can advance)
**Description:** As any connected player, I need to start the asking phase from preparing.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) any player calls, phase advances 'preparing' → 'asking', `started_at` set, (b) idempotent — second call returns no-op (UPDATE WHERE phase='preparing' affects 0 rows on second call), (c) caller not in room → error errcode `'PGAME11'` (not in room), (d) phase != 'preparing' → no-op (idempotent)
- [ ] Migration `0022_advance_to_asking.sql`:
  - SECURITY DEFINER `advance_to_asking(p_room_id, p_round, p_player_id)`
  - First: `perform reconcile_round_phase(p_room_id, p_round)`
  - Validate caller is in room
  - `update game_insider_round set phase='asking', started_at=now() where room_id=p_room_id and round_number=p_round and phase='preparing'`
- [ ] Tests pass

### US-5a.7: start_insider_round RPC
**Description:** As host, I need to create a new Insider round with secret + role assignment.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) host calls with pack_slug + time_limit_s, function inserts game_insider_round + roles for all current players, secret picked from get_random_pack_item, role distribution = 1 Master + 1 Insider + (N-2) Players, randomly assigned, (b) non-host caller → error PGAME12 'only host can start round', (c) room not in lobby → error PGAME13, (d) <3 players → error PGAME14
- [ ] Migration `0023_start_insider_round.sql`
- [ ] Tests pass

### US-5a.8: master_respond RPC
**Description:** As Master, I need to record Yes/No/Unsure to a question.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) Master calls with response='yes' inserts row, (b) non-Master caller → error PGAME15 'only master can respond', (c) phase != 'asking' → error PGAME16, (d) round expired (now() >= started_at + time_limit_s) → error PGAME02 'round expired' AND reconcile_round_phase advances to result_failed
- [ ] Migration `0024_master_respond.sql`:
  - First: `perform reconcile_round_phase`
  - Validate role = 'master', phase = 'asking', not expired
  - Insert into `game_insider_responses`
- [ ] Tests pass

### US-5a.9: mark_correct_guess RPC
**Description:** As Master, I need to declare the group guessed correctly, transitioning to voting.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) Master calls during 'asking' before deadline → phase='guessed' and `vote_deadline = now() + interval '60 seconds'`, eligible_voter_ids snapshotted from currently-connected players (T-4); auto-advance to 'voting' after 2s simulated, (b) non-Master → error PGAME15, (c) phase != 'asking' → error PGAME16, (d) round expired → error PGAME02
- [ ] Migration `0025_mark_correct_guess.sql`
- [ ] Tests pass

### US-5a.10: expire_round RPC (idempotent — A3.B)
**Description:** As any client whose timer hit zero, I need to advance the phase to result_failed.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) Round in 'asking' past deadline → phase='result_failed', (b) round still in time → no-op (UPDATE WHERE clause filters), (c) two concurrent calls → only one wins, second is no-op (verify by checking row update count), (d) phase != 'asking' → no-op
- [ ] Migration `0026_expire_round.sql`:
  - `update ... set phase='result_failed' where phase='asking' and now() >= started_at + interval`
- [ ] Tests pass

### US-5a.11: cast_vote RPC
**Description:** As an eligible voter, I need to vote for who I think the Insider is.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) eligible voter casts vote → row inserted/updated (PK conflict overwrites), (b) voter not in eligible_voter_ids[] → error PGAME17 'not eligible to vote', (c) phase != 'voting' → error PGAME18, (d) vote deadline passed → error PGAME19 + reconcile_round_phase advances, (e) all eligible voters have voted → auto-advance to 'reveal' (UPDATE returning rows checks count vs eligible array length)
- [ ] Migration `0027_cast_vote.sql`
- [ ] Tests pass

### US-5a.12: advance_to_reveal RPC (T-3.B — anyone can advance after vote complete or timeout)
**Description:** As any client, I need to move from voting to reveal when conditions met.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests: (a) all eligible voted → phase='reveal', (b) vote deadline passed → phase='reveal' (timeout path), (c) called early (not all voted, deadline not passed) → no-op
- [ ] Migration `0028_advance_to_reveal.sql`
- [ ] Computes scores per state machine spec (see C2.A in design doc):
  - Group caught Insider: Master + each Common +2 pts, Insider 0 pts
  - Insider escaped: Insider +3 pts, others 0 pts
  - Tied vote between suspects: all tied "caught"
  - Time expired (no guess): everyone 0 pts
- [ ] Insert score events into rooms.players.total_score (use existing players table for scores)
- [ ] Tests pass

### US-5a.13: TS wrappers for all Insider RPCs in apps/insider/lib/insider-rpc.ts
**Description:** As Insider UI, I need typed wrappers around the Postgres functions.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing tests for each wrapper
- [ ] Implement `apps/insider/lib/insider-rpc.ts` exporting typed functions for all 9 RPCs
- [ ] Each uses `dispatch()` from `@social-hub/core` so errors are `GameRpcError`
- [ ] All tests pass

### US-5a.14: 5a regression gate + /qa GATE
**Description:** Verify Postgres layer works before starting UI.

**Acceptance Criteria:**
- [ ] All ~50 Postgres function tests pass (each function × multiple guards)
- [ ] All existing Headball tests still pass (21 unit + 5 e2e)
- [ ] Migrations applied to staging Supabase
- [ ] Manual: `select * from get_random_pack_item('insider-thai-food')` returns a Thai food item
- [ ] **/qa GATE:** /qa headball preview shows zero regressions. NB: Insider has no UI yet, so /qa for Insider is deferred to 5b. Run `/qa standard` against `headball-preview.vercel.app` to confirm Headball untouched.
- [ ] Git tag `phase-5a-done` pushed

---

## Sub-phase 5b — UI + Happy Path e2e

### US-5b.1: Multi-context Playwright config (T-3.A)
**Description:** As Insider e2e, I need 4-context multi-browser tests for full multi-role flows.

**TDD:** Self-test on a trivial spec.

**Acceptance Criteria:**
- [ ] Update root `playwright.config.ts` to spawn webServer array: hub on :3000, headball on :3001, insider on :3002 (all via Turbo run dev --filter)
- [ ] Add helper `e2e/_helpers/multi-role.ts` with `createMultiRoleSession(playerCount: number)` returning N browser contexts + page objects
- [ ] Trivial smoke test: 4 contexts each open insider home, confirm independent localStorage
- [ ] Smoke test passes

### US-5b.2: Insider host setup screen (`/new`)
**Description:** As host, I want to pick a pack, time limit, round count, and create a room.

**TDD:** Test-first via Playwright.

**Acceptance Criteria:**
- [ ] Write failing e2e: visit `apps/insider/new`, select pack chip, click time chip, adjust round stepper, click CREATE ROOM, redirected to `/room/<code>` with room created
- [ ] Implement `apps/insider/app/new/page.tsx` per wireframe Screen 3
- [ ] Use `@social-hub/content` `listEnabledPacks` to populate pack chips
- [ ] Pack chips: selected = tag-color bg, unselected = surface-elevated, Plex Thai text only (no emoji per Pass 7 lock)
- [ ] Time chips (3/5/7 min) as segmented toggle
- [ ] Round count stepper (1-10 range, default 5)
- [ ] CREATE ROOM CTA goal-red, calls `create_insider_room` RPC (extends existing `create_room` with game_type='insider' + insider settings stored in extension table or rooms metadata)
- [ ] e2e passes

### US-5b.3: Insider lobby screen (extends Headball lobby pattern)
**Description:** As host or joined player, I want to see who's in the lobby and start when ready.

**TDD:** Test-first via Playwright (multi-context: 4 players join).

**Acceptance Criteria:**
- [ ] Write failing e2e: 4 contexts: host creates room, players 2-4 join via room code, all see player chips populate, anyone clicks START GAME (T-3.B), phase advances to preparing
- [ ] Implement `apps/insider/app/room/[code]/lobby.tsx` per wireframe Screen 4
- [ ] Reuses `@social-hub/ui` player-chip + room-code-display
- [ ] START GAME button enabled when ≥3 players, anyone can click (T-3.B)
- [ ] e2e passes

### US-5b.4: Role reveal screens (3 views: Master/Insider/Common)
**Description:** As a player after start, I want to see my role and (if applicable) the secret word.

**TDD:** Test-first via multi-context e2e.

**Acceptance Criteria:**
- [ ] Write failing e2e: after host starts round, 4 contexts each see one of: Master view (with secret), Insider view (with secret + warning visual), or Common view (with ??? mystery placeholder)
- [ ] Implement `apps/insider/app/room/[code]/role-reveal.tsx` with 3 sub-components per wireframes 5a/5b/5c
- [ ] Insider view uses tag-pink for secret card; Master uses same tag-pink (D3 — same color so phones look similar at a glance)
- [ ] Each role has distinct outline color on role-badge (warning-yellow / info-blue / hairline-neutral)
- [ ] Insider view shows warning-yellow scanline at top edge
- [ ] Common view shows "???" placeholder + warning hint "มีคนวงในซ่อนอยู่"
- [ ] Each shows "ฉันพร้อมแล้ว" CTA → calls `advance_to_asking` (T-3.B)
- [ ] Once advanced: secret hidden for Insider (D3 — must memorize); Master keeps small Bebas reminder; role badge hidden for ALL during asking (D4)
- [ ] e2e passes

### US-5b.5: Asking phase screens (Master view + non-Master view)
**Description:** As Master, I want 3 huge response buttons. As non-Master, I want a response feed.

**TDD:** Test-first via multi-context e2e.

**Acceptance Criteria:**
- [ ] Write failing e2e: round in asking phase, Master taps Yes button → response inserted, all 4 contexts see the new response in their feed via Realtime
- [ ] Implement `apps/insider/app/room/[code]/asking-master.tsx` per wireframe Screen 6a + D1:
  - Phase tag + timer (Bebas, turns red <30s)
  - Small "Secret: [WORD]" reminder Bebas 32px on-dark-soft
  - 3 response buttons (Yes green, No red, Unsure yellow), each 96px tall, fill viewport
  - Collapsed feed accordion below ("ตอบล่าสุด: ✓✗✓?✓"); tap to expand
  - Distinct goal-red "✓ ทายถูกแล้ว" CTA at bottom
- [ ] Implement `apps/insider/app/room/[code]/asking-other.tsx` per wireframe Screen 6b:
  - Phase tag + timer
  - "ASK OUT LOUD / ถามดัง ๆ" instruction (Anton 24px)
  - Full-height response feed (reverse-chronological, scrollable)
  - For Insider role: subtle warning-yellow caption "💡 Drop a question they can use" appears after 30s of silence (D2)
  - NO role badge visible (D4 — UI identical for Insider and Common)
- [ ] Both views update via Realtime subscription on `game_insider_responses`
- [ ] e2e passes

### US-5b.6: Voting phase screen
**Description:** As any eligible voter, I want to tap a player card to cast my vote.

**TDD:** Test-first.

**Acceptance Criteria:**
- [ ] Write failing e2e: after Master clicks "ทายถูก", phase advances to voting, all 4 see voting screen, each taps a player card, after all votes phase advances to reveal
- [ ] Implement `apps/insider/app/room/[code]/voting.tsx` per wireframe Screen 7 + D6:
  - "WHO IS THE INSIDER?" Anton 32px
  - 2-col grid of vote-target-card (full tag-color bg, 120px tall, player display name)
  - Tap = goal-red ring + ✓ icon overlay; tap again = de-select; tap different player = switch
  - NO per-player vote tallies visible during voting (D6)
  - Group progress: "3/4 voted" caption
  - Vote deadline countdown
- [ ] Add vote-target-card component to `packages/ui`
- [ ] Calls `cast_vote` RPC
- [ ] Auto-advance to reveal when all eligible voted (or deadline passes via reconcile)
- [ ] e2e passes

### US-5b.7: Reveal screen (3 variants — caught / escaped / time-expired)
**Description:** As all players, I want to see the secret + Insider identity + scoreboard.

**TDD:** Test-first via 3 e2e flows (one per variant).

**Acceptance Criteria:**
- [ ] Write 3 failing e2e specs: `insider-caught.spec.ts`, `insider-escaped.spec.ts`, `time-expired.spec.ts`
- [ ] Implement `apps/insider/app/room/[code]/reveal.tsx`:
  - Variant: caught (group identified Insider) — light alt mode bg `canvas` #fafbfc, BIG NAME card with secret, "INSIDER WAS X — CAUGHT!" + vote breakdown
  - Variant: escaped (Insider not caught) — dark mode + warning-yellow accent, "INSIDER WAS X — ESCAPED!" with Insider's score boost
  - Variant: time expired — dark mode + error-red top accent, "TIME UP / ทายไม่ทันเวลา", secret revealed, no voting
  - Scoreboard tiles + leaderboard (uses existing players.total_score)
  - "NEXT ROUND →" CTA — anyone can click (T-3.B), calls advance_to_next_round (or transitions back to lobby for new round)
- [ ] All 3 e2e specs pass

### US-5b.8: Stadium Energy theme applied
**Description:** As all Insider screens, I want DESIGN.md tokens applied so it matches Headball's broadcast aesthetic.

**TDD:** Visual; verify via /qa.

**Acceptance Criteria:**
- [ ] All screens use Bebas Neue 144px for BIG NAME card pattern (secret reveal)
- [ ] Anton 56px for phase headers
- [ ] IBM Plex Sans Thai for all body
- [ ] Dark navy #0a0e1a default bg (light alt only on reveal-caught variant)
- [ ] Goal-red CTA for primary actions
- [ ] All 8 player tag colors used by join_order
- [ ] Tabular nums for score and timer
- [ ] Manual review against `docs/DESIGN.md` checklist

### US-5b.9: 5b regression gate + /qa GATE
**Description:** Insider happy paths work, Headball untouched.

**Acceptance Criteria:**
- [ ] 3 happy-path e2e specs pass (caught, escaped, time-expired)
- [ ] All existing Headball tests pass (21 unit + 5 e2e)
- [ ] Multi-app webServer config works (hub + headball + insider start in parallel)
- [ ] Vercel insider preview deploys green
- [ ] Manual: full Insider round in 4 browsers from real preview URL
- [ ] **/qa GATE:** Run `/qa standard` against insider preview URL. Then `/qa standard` against headball preview to confirm no regression.
- [ ] Git tag `phase-5b-done` pushed

---

## Sub-phase 5c — Edge Case e2e (T-1.B remaining 8 flows)

### US-5c.1: Voting tie e2e
**Description:** When 2 players tie in votes, both are marked caught (per state machine spec).

**Acceptance Criteria:**
- [ ] Write e2e: 4 players, 2 vote for Mew, 2 vote for Bank → reveal shows both as caught, scoring applies to both
- [ ] Verify reveal_round logic handles tie correctly
- [ ] e2e passes

### US-5c.2: Disconnected player can be voted for, can't vote (T-4)
**Description:** Frozen eligible_voter_ids[] doesn't include disconnects; disconnected players still on player cards.

**Acceptance Criteria:**
- [ ] Write e2e: 4 players, player 4 disconnects during asking phase, phase advances to voting, player 4 still appears as a vote target, but vote completion fires when 3 eligible voters have voted (not waiting on the disconnected one)
- [ ] e2e passes

### US-5c.3: Mid-round reconnect e2e
**Description:** Player drops mid-asking, rejoins, sees correct role + remaining time + recent feed.

**Acceptance Criteria:**
- [ ] Write e2e: player 2 drops during asking, reconnects after 30s, sees their original role, current timer, last 5 responses
- [ ] e2e passes

### US-5c.4: Late master action rejected (mark_correct_guess after deadline)
**Description:** Per A3 mandatory time guards, expired actions return error.

**Acceptance Criteria:**
- [ ] Write e2e: round timer set to 5s for testing, wait 6s without guess, Master taps "ทายถูก" → server rejects with PGAME02 error, UI shows phase='result_failed' (reconcile fired)
- [ ] e2e passes

### US-5c.5: Common attempts master_respond → rejected
**Description:** Role-based access denial verified end-to-end.

**Acceptance Criteria:**
- [ ] Write e2e: bypass UI by direct RPC call (in test only) — Common player tries master_respond, server rejects with PGAME15 'role_denied'
- [ ] e2e passes

### US-5c.6: Anon SELECT secret_value column → permission denied
**Description:** RLS column-level GRANT verified.

**Acceptance Criteria:**
- [ ] Write integration test (not Playwright — pure Supabase client): create round, anon SELECT secret_value FROM game_insider_round WHERE … — expect Postgres permission denied error
- [ ] Test passes

### US-5c.7: Race on expire_round (idempotency)
**Description:** Two clients call expire_round simultaneously, only one advances phase.

**Acceptance Criteria:**
- [ ] Write integration test: insert round in asking past deadline, fire `expire_round` from 2 concurrent connections, verify exactly one update affected the row (count check)
- [ ] Test passes

### US-5c.8: prefers-reduced-motion respected
**Description:** A11y requirement: reduced motion disables BIG NAME flip + confetti + score-roll.

**Acceptance Criteria:**
- [ ] Write Playwright e2e with `colorScheme: 'dark', reducedMotion: 'reduce'` context option
- [ ] Run full round; assert: BIG NAME card has no transform animation, no confetti elements appear, scores update instantly (no roll animation)
- [ ] e2e passes

### US-5c.9: 5c regression gate + /qa GATE
**Acceptance Criteria:**
- [ ] All 8 edge-case e2e specs pass
- [ ] All happy-path e2e still pass (3 from 5b)
- [ ] All Headball regression tests still pass
- [ ] Vercel insider preview green
- [ ] **/qa GATE:** /qa exhaustive on insider preview (all tiers — critical, high, medium, cosmetic)
- [ ] Git tag `phase-5c-done` pushed

---

## Sub-phase 5d — UI Polish + DESIGN.md Updates

### US-5d.1: Add 5 new components to packages/ui (D1-D6 + Pass 5)
**Description:** Codify the new component patterns as proper packages/ui exports with Stadium Energy tokens.

**Acceptance Criteria:**
- [ ] `role-badge` component: Anton 32px uppercase, status border (warning/info/neutral), proper padding
- [ ] `response-button` component: 96px tall, full-width, icon + Thai + English, success/error/warning variants
- [ ] `response-feed-entry` component: 44px tall, timestamp + icon + response text
- [ ] `vote-target-card` component: 120px tall, tag-color bg, supports `[selected]` ring + ✓ overlay
- [ ] `pack-chip` component: selectable, tag-color when selected, surface-elevated when not, Plex Thai text only
- [ ] All exported from `@social-hub/ui`
- [ ] All used by Insider screens (replace inline implementations from 5b)
- [ ] Visual regression check on each Insider screen (compare to 5c snapshot)

### US-5d.2: Update docs/DESIGN.md with the 5 new components
**Description:** Document new components in the design system spec.

**Acceptance Criteria:**
- [ ] Open `docs/DESIGN.md`
- [ ] Add 5 component specs to the `components:` YAML frontmatter section
- [ ] Add prose descriptions in the document body
- [ ] Update Decisions Log with 2026-05-08 entry summarizing Phase 5d additions
- [ ] Update Known Gaps section if any UX details still TBD

### US-5d.3: Implement all loading/empty/error/transition states per design review
**Description:** Apply state coverage decisions from design review Pass 2.

**Acceptance Criteria:**
- [ ] Loading: skeleton with phase placeholder + "กำลังโหลด..." caption on every screen
- [ ] Empty lobby: dashed empty slots + min-player hint
- [ ] Empty response feed: "ยังไม่มีคำตอบ" with hint
- [ ] Network error: banner-error slides down, persists until reconnect
- [ ] Phase transition: 600ms cross-fade + 400ms phase-name overlay (e.g., "VOTING / โหวต") between phases
- [ ] Mid-round reconnect: state correctly restored
- [ ] Visual verification: take 1 screenshot per state on each screen, manual review

### US-5d.4: A11y polish
**Description:** Apply a11y specs from design review Pass 6.

**Acceptance Criteria:**
- [ ] All interactive elements ≥44px touch target verified via Playwright `getBoundingClientRect`
- [ ] Tab order verified on all screens via keyboard-only test
- [ ] Focus ring 3px solid goal-red 2px offset visible on every focusable element including over tag-color backgrounds
- [ ] Screen reader test: secret word announced as "Your secret word: [WORD]"
- [ ] Response feed wrapped in `aria-live="polite"`
- [ ] Color-blind triple-coding verified: Yes/No/Unsure all have icon + text + color
- [ ] Reduced-motion mode tested (covered by 5c.8)
- [ ] ARIA landmarks: `<main>`, `<header>`, `<aside>` on each screen

### US-5d.5: Performance smoke test (per eng review Section 4)
**Description:** Verify Insider doesn't introduce performance regressions.

**Acceptance Criteria:**
- [ ] Bundle size of `apps/insider` after monorepo restructure ≤ 1.5x of headball baseline (Tailwind v4 should tree-shake)
- [ ] Insider page load <2s on Vercel preview
- [ ] Realtime subscription count ≤6 channels per game session
- [ ] No N+1 query patterns identified (Postgres function calls are atomic)

### US-5d.6: 5d regression gate + final /qa GATE
**Description:** All sub-phases complete, design polish applied.

**Acceptance Criteria:**
- [ ] All Insider e2e specs pass (3 happy + 8 edge = 11 from T-1.B)
- [ ] All Headball regression tests pass
- [ ] All Hub e2e tests pass
- [ ] Visual review: every Insider screen matches Stadium Energy aesthetic per DESIGN.md
- [ ] All 3 Vercel deploys green (hub + headball + insider)
- [ ] **FINAL /qa GATE:** `/qa exhaustive` against Insider preview URL. All 4 tiers (critical/high/medium/cosmetic) pass.
- [ ] Run `/design-review` (live visual audit) for final Stadium Energy compliance check
- [ ] Git tag `phase-5d-done` pushed
- [ ] Git tag `phase-5-done` pushed (umbrella tag)

---

## Functional Requirements

- FR-5.1: Insider implements all decisions from design doc (A1-A6, C1-C4, D1-D6, T-1 through T-8 plus T-2.A, T-3.B, T-4).
- FR-5.2: All Postgres functions implement `reconcile_round_phase` first per T-2.A.
- FR-5.3: Asymmetric secret access via `get_my_insider_secret` SECURITY DEFINER RPC; anon has no SELECT on `secret_value` column.
- FR-5.4: Asymmetric privacy: secret AND role both hidden for Insider during asking phase.
- FR-5.5: Vote eligibility frozen at vote-phase entry via `eligible_voter_ids[]`.
- FR-5.6: Anyone can advance phase actions (T-3.B); only `mark_correct_guess` is Master-locked.
- FR-5.7: Stadium Energy aesthetic per DESIGN.md applied to every Insider screen.
- FR-5.8: 5 new components added to `packages/ui` and `docs/DESIGN.md`.

## Non-Goals

- Migrating Headball to use new patterns (deferred — Phase 3 left Headball untouched).
- Spectator mode (deferred per A5).
- Custom domain + cross-subdomain identity (deferred per A6).
- Pack creation admin UI (deferred — script-based seed for v1).
- Anti-cheat hardening (deferred to v2 TODO).
- Real prod Supabase deploy (still on staging per T-5.C; promote after Insider proves out).

## Technical Considerations

- The 11 e2e flows are aggressive coverage. With Claude Code's compression on tests (~50x), this should be ~1 day of focused work. Without it, plan for 4-5 days.
- Multi-context Playwright is performance-sensitive; 4 contexts × full round can be slow. Use `test.describe.serial()` per spec to avoid resource thrash.
- Postgres function tests (T-2.B) hit local Supabase; ensure `bunx supabase start` is part of the test setup.
- The `eligible_voter_ids[]` snapshot at vote phase entry is the most error-prone piece. Test it explicitly with disconnected-player scenarios.

## Success Metrics

- All 11 T-1.B e2e flows pass
- All ~50 Postgres function tests pass
- /qa exhaustive on Insider preview shows 0 critical, 0 high
- Design review (live) confirms Stadium Energy aesthetic on every screen
- Headball has 0 regressions throughout

## Open Questions

- Master question logging (currently NO per A5). If post-launch users ask for it, revisit.
- Custom pack creation UI. Currently script-based per US-3.4. Revisit at game #3+.

---

## Phase 5 Completion

Phase 5 is COMPLETE when:
- 5a, 5b, 5c, 5d all done with their /qa gates passed
- Git tag `phase-5-done` pushed
- All 11 e2e flows pass
- Both /qa exhaustive (insider) and /qa standard (headball) clean
- /design-review live audit passes

After phase 5 done:
1. Open PR `feat/multigame-platform → main`
2. Run `/review` for pre-landing PR review
3. Manual review by maintainer
4. After approval: merge to main, run `/document-release`
5. Promote staging Supabase → production Supabase migration when ready (T-5.C transition)
6. Buy custom domain (optional v2 milestone)
