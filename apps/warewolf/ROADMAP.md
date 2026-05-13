# Warewolf — V2 Roadmap

Status snapshot of the path from V1 (shipped) to V2 launch and beyond.

V1 (shipped, on `main`): standalone Thai balance & setup recommender for the Thai Werewolf community. No backend. URL-canonical state. 5 routes, 22 vitest files / 182 tests. PRs #31–#33.

V2 (in design + pre-build): same-room mobile multiplayer game built on V1's Grimoire UI, role data, and solver. App-as-moderator with Thai audio narrator over a shared speaker. Two-surface "Stadium Mode" architecture (one phone is the village square, each player phone is a private role card + interaction surface). Card-art reveal as the signature moment.

**Source-of-truth design doc** (lives outside the repo, in the planning area):
`~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260513-020535-warewolf-multiplayer.md` (Status: APPROVED).

**Visual design contract:** `apps/warewolf/docs/V2-DESIGN.md` — page inventory, V1-mirror map, locked aesthetic decisions, prototype path. Read this before any V2 UI work.

Marker key: `[x]` done · `[ ]` to do · `BLOCKER:` gates downstream work.

---

## Phase 0 — Pre-build gates (this week)

- [x] Office hours brainstorm + design doc approved
- [x] Narrator script v0.2 (26 Thai cues with ElevenLabs v3 audio tags) — `docs/narrator-script-v0.md`
- [x] ElevenLabs audio tag reference doc — `docs/elevenlabs-audio-tags.md`
- [x] Quota-safe MP3 generation script — `scripts/build-narrator-audio.ts`
- [x] 26 dev-quality MP3s generated and auditioned (Brian voice, Eleven v3) — `public/audio/th/dev/`
- [x] All artifacts committed (`1b86294`)
- [x] Rotate ElevenLabs API key — explicitly waived by user (acceptable risk for solo dev)
- [x] Paper playtest — explicitly waived by user; audio + script validated via solo audition of all 26 cues. Trade-off: design-level invalidation (does anyone want to play again?) is now deferred to v2.0 beta in week 10 instead of catching it for free this week.
- [x] Native Thai speaker review — done by user
- [x] Voice path for v2.0 dev: **Brian (`nPczCjzI2devNBz1zQrb`)**. Production-launch recording (week 6) still uses a human voice actor per the design doc.

**Phase 0 complete.** Cleared to start Phase 0.5.

## Phase 0.5 — Visual design wireframes (this week)

Full V2 wireframe prototype shipped before any code. The design contract lives in **`apps/warewolf/docs/V2-DESIGN.md`** — read it before touching any V2 UI.

- [x] `/design-shotgun` per screen → 10 approved variants saved to `~/.gstack/projects/board-game/designs/warewolf-v2-*-20260513/`
- [x] 12 wireframes finalized in `~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/` (clickable prototype, mobile + desktop frames per screen, state grids, sticky proto-nav)
- [x] V1 UI mirror locked for 02a (Setup list) + 02b (Customize) — route-file change only, no new components
- [x] Card-back UI on vertical ellipse adopted for stadium / vote / death / game-over screens (overlap-tested at 5–8 players, stress-tested at 15)
- [x] 12 locked design decisions documented in V2-DESIGN.md (do not relitigate)
- [x] Finalized metadata + page inventory + V1-mirror map saved to `~/.gstack/projects/.../warewolf-v2-prototype-20260513/finalized.json`
- [x] `/plan-design-review` 7-pass run · scored 7/10 · trivial fixes applied · Tier 1 ship-blockers identified
- [x] **Tier 1 pitch-blockers wireframed (v1.1):**
  - 00a AudioUnlockGate (Lectern) — synchronous user-gesture handler, lantern-flame glow, RPC `audio_unlocked: true`
  - 04a Role reveal (Tap to Reveal) — 5 role states, 3D rotateY card-flip 300ms, audio cue at t=0, Apprentice silent inheritance
- [ ] **v1.2 sketches still to wireframe** (each needs `/design-shotgun` then `/design-html`):
  - Reconnect flow (60s narrator stall + auto-resolve overlay)
  - Stadium PAUSE (emergency override)
  - Room-not-found / room-full / room-ended error states
  - Lobby avatar picker (12 variants per asset list)
  - First-timer onboarding link from 01 to game-rules

**Resume design work:** `open ~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/index.html`. To wireframe a NEW screen: invoke `/design-shotgun` then `/design-html`. To polish: edit files in the prototype dir directly.

**Phase 0.5 v1.1 complete.** Cleared to start Phase 1. v1.2 wireframes can be added in parallel and don't block the build.

## Phase 1 — Architectural lock-in (1–2 days)

- [x] `/plan-eng-review` on the design doc — Round 2 P1.1–P2.4 + CQ.1–4 + Perf.1–2 added to design doc (2026-05-14)
- [x] **BLOCKER CLEARED:** iOS Safari audio + Service Worker spike — `apps/audio-spike/` (commit `0913500`), tested on real iPhone 2026-05-14, **all 13 tests pass**. Results: `~/.gstack/projects/board-game/audio-spike-results-2026-05-14.md`. Confirms: AudioContext survives across cues + backgrounding + screen lock + 5min idle; SW activation does NOT cut audio (offline cards stay in scope); silent mode + BT speaker work; no Wake Lock needed.
- [x] Procure: real low-end Android (Pixel 4a-class) for parity testing, Bluetooth speaker for further BT testing
- ~~Domain decision~~ → **deferred to Phase 2 week 10** (ship week). All v2.0 build + test happens locally (`bunx supabase start` + `bun run dev` on `localhost:3003`) and on Vercel preview URLs. Domain only matters at the moment of `/ship` to production.

**Phase 1 complete.** Cleared to start Phase 2 (Week 1: backend foundations).

## Phase 2 — v2.0 build (target 10 weeks)

### Week 1 — Backend foundations

- [ ] Supabase migration `YYYYMMDD_warewolf_multiplayer.sql`:
  - `rooms` ALTER: `game_type`, `stadium_player_id`, `warewolf_config jsonb`, `stadium_heartbeat_at`
  - `game_warewolf_rounds` table
  - `game_warewolf_secrets` table + RLS policy: `USING (player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))`
  - `game_warewolf_actions` append-only log
  - `game_warewolf_assignments` immutable role mapping
  - Realtime publication: add tables clients subscribe to (per root CLAUDE.md A4 rule)
- [ ] RPC functions: `assign_roles`, `submit_night_action`, `submit_day_vote`, `advance_phase`, `claim_stadium`, `pause_game`, `resume_game`
- [ ] Supabase anonymous auth wired up: map `auth.uid()` → `players.auth_user_id` on first join

### Week 2 — Realtime + state plumbing

- [ ] `packages/core` extensions: `useWarewolfRoom`, `useWarewolfSecrets`, `useStadiumHeartbeat`
- [ ] Client phase machine mirror (`lib/phases/phase-machine-mirror.ts`) — read-only, DB-authoritative
- [ ] Phase audio cues map (`lib/phases/phase-audio-cues.ts`) — drafted in script v0.2

### Week 3 — Lobby

- [ ] Route `app/[lang]/play/lobby/[code]/page.tsx`
- [ ] Setup picker integrating V1's solver + BalanceScale + CardArt
- [ ] Player join + ready-gate (Start disabled until N players + all ready)
- [ ] QR code generation for join URL

### Week 4 — Player surface

- [ ] Route `app/[lang]/play/[code]/page.tsx`
- [ ] `RoleCardFlip.tsx` (extends V1 CardArt with rotateY animation + audio + perf gate ≤16KB gz)
- [ ] `ActionPanel.tsx` — context-sensitive prompts (eat / inspect / protect / vote)
- [ ] Connection state + reconnect overlay

### Week 5 — Stadium surface + SCRIPT LOCK

- [ ] Route `app/[lang]/play/stadium/[code]/page.tsx`
- [ ] `VillageSquare.tsx` — circular avatar layout + day/night background shift
- [ ] `NarratorSubtitle.tsx` — overlay subtitles for both surfaces
- [ ] `AudioUnlockGate.tsx` — iOS Safari "Tap to begin" gate (depends on Phase 1 spike)
- [ ] **MILESTONE:** narrator script LOCKED at v1.0 (no more cue text changes)
- [ ] **MILESTONE:** book Thai voice actor for week 6 recording (~10k THB, ~2 hours)

### Week 6 — Voice actor + Stadium failover

- [ ] Voice actor recording session
- [ ] Encode + place final MP3s in `public/audio/th/prod/`
- [ ] Env flag picks dev vs prod audio bucket per build
- [ ] `use-stadium-heartbeat.ts` — 5s heartbeat + 30s timeout detection
- [ ] `StadiumFailoverPrompt.tsx` — "claim Stadium" UI on player phones

### Week 7 — Game loop runtime

- [ ] Stadium-driven phase advancement (writes to DB + plays audio)
- [ ] Action validation in RPCs (Postgres-side)
- [ ] Apprentice Seer silent inheritance (private message + reuses standard seer cues)
- [ ] Bodyguard "no same target two nights in a row" rule enforcement

### Week 8 — Death moment + reconnect

- [ ] `DeathScene.tsx` with synchronized cross-device animation (`event_at_timestamp` + 2s scheduling, <50ms skew)
- [ ] Dead-player spectator UX (full state visible, "spectator" header)
- [ ] Reconnect within session: rejoin via URL, narrator stalls with `waiting_for_action` cue, 60s auto-resolve

### Week 9 — Polish + simple end-game

- [ ] Emergency PAUSE button on Stadium
- [ ] Simple text-based end-game: "Wolves win" / "Village wins" + role list reveal (NOT the flip parade — that's v2.0.5)
- [ ] Lobby polish (avatar selection, room code copy/share)
- [ ] Error states: room not found, room full, room ended, bad code format

### Week 10 — Beta + ship

- [ ] Real-device matrix: iPhone 12+/iOS 17+, Pixel 4a-class Android, Bluetooth speaker test
- [ ] 5-group beta playtest (different cities/ages)
- [ ] Bug bash + UX fixes from playtest
- [ ] Performance gates: card flip 60fps on Pixel 4a, bundle ≤80KB gz on customize-equivalent route
- [ ] **Domain decision** (deferred from Phase 1): pick `warewolf.<your-domain>` vs free `*.vercel.app`, point Vercel project at it. All build + test up to this week runs on local dev + preview URLs.
- [ ] `/qa` full sweep
- [ ] `/ship` to production

## Phase 3 — v2.0.5 (target +2 weeks after v2.0 ships)

- [ ] Coordinated end-game card-flip parade (multi-device sync, the magical moment)
- [ ] Hunter role added (with full death-trigger interrupt logic — gnarliest state machine in Werewolf)
- [ ] First wave of community feedback fixes

## Phase 4 — v2.1 (target +4 weeks)

- [ ] Expand to 12 roles: Witch, Priest, Mason, Wolf Cub, Mayor, Tough Guy + 1 more from V1 catalog
- [ ] 9–12 player support (revisit narrator pacing for longer games)
- [ ] Voice actor recording session #2 (additive lines for new roles)
- [ ] House-rule overrides — moderator override panel for hosts who want to break the strict-mod rule

## Phase 5 — v2.2 (target +6 weeks)

- [ ] **Content prerequisite:** ship Cupid + Lycan to `packages/content/src/werewolf-roles.ts` (not in V1)
- [ ] All V1 roles supported (~30+)
- [ ] 13–20 player support (battery profile + narrator pacing tested)
- [ ] Spectator chat for dead players (private channel)
- [ ] Replay viewer (game state recorded; spectators can scrub through past phases)

---

## Parallel tracks (don't block the build)

### Asset production

- [ ] Card backs (Grimoire aesthetic, ~512×768 WebP) — needed by week 4
- [ ] Stadium backgrounds: day + night village square (1920×1080) — needed by week 5
- [ ] Death overlay treatment — needed by week 8
- [ ] Avatar placeholder set (12 variants) — needed by week 3
- [ ] SFX bundle from freesound.org (CC0): card flip, death thump, phase stinger, vote tick, notification chime, end-game stingers — needed by week 7
- [ ] App icon / favicon / PWA splash variant (or reuse V1)

### Marketing + community

- [ ] Domain purchase + setup
- [ ] Landing page copy (Thai + English)
- [ ] Launch posts: 2 Thai Werewolf communities + 1 BGG forum
- [ ] Demo video / screen recording for LINE shares

### Technical hygiene

- [x] `apps/warewolf/.env` untracked from git index
- [ ] Rotate ElevenLabs API key (still pending)
- [ ] Consider git-LFS if `public/audio/` grows past ~5MB

---

## Critical path

The single chain that determines ship date:

**paper playtest → wireframe prototype (V2-DESIGN.md) → /plan-eng-review → iOS Safari spike → backend migration → realtime hooks → lobby → player surface → stadium surface → script lock → voice actor → game loop → death scene → polish → beta → ship**

If any link breaks, everything downstream stalls. Items off the critical path (assets, marketing, v2.1+) can run in parallel and slip without delaying v2.0.

---

## Time budget

| Milestone | Duration | Cumulative from today |
|---|---|---|
| Phase 0 + 1 (gates + spike) | ~1 week | week 1 |
| v2.0 build | 10 weeks | week 11 |
| v2.0.5 (flip parade + Hunter) | 2 weeks | week 13 |
| v2.1 (catalog expansion + actor #2) | 4 weeks | week 17 |
| v2.2 (full Grimoire + spectator) | 6 weeks | week 23 |

**~10–12 weeks** from today to **v2.0 ship** (5 roles, Stadium Mode).
**~22–24 weeks (5–6 months)** from today to **v2.2 full Grimoire** if shipping continuously.

Single-engineer estimates with Claude Code. Slip 2 weeks if working part-time or if the iOS Safari spike turns up surprises.
