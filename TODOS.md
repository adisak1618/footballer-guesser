# TODOs

Deferred work captured during reviews. Items here are explicitly scoped out of the current PR/phase but should be addressed before they bite. Format: `[priority] short title — context`.

---

## V2 Phase 1 / Phase 2 (warewolf multiplayer)

### [P3] Enumerate realtime publication membership in the v2 migration
**What:** When `YYYYMMDD_warewolf_multiplayer.sql` is written, it must explicitly `alter publication supabase_realtime add table` for every `game_warewolf_*` table that clients subscribe to, AND tag tables that should NOT be published with a trailing `-- no-realtime` comment per root CLAUDE.md A4 rule.
**Why:** Per A4, `scripts/check-realtime-publication.sh` runs first in `bun run lint` and will fail CI if a `create table` clause exists with neither `alter publication` nor `-- no-realtime`. Easy to miss for 5 new tables in one migration.
**Recommended membership:**
- `game_warewolf_rounds` → PUBLISH (everyone watches phase + day_number)
- `game_warewolf_secrets` → PUBLISH (RLS gates per-player visibility)
- `game_warewolf_actions` → PUBLISH (stadium watches submission count for "3 of 4 wolves voted" feedback)
- `game_warewolf_assignments` → NO-PUBLISH (immutable post-write, no client subscription needed) — tag with `-- no-realtime`
**Context:** From plan-eng-review Round 2 finding 1.9. Not blocking, but easy to defer-and-forget then trip CI on the migration PR.
**Depends on:** Phase 2 week 1 (backend foundations).

### [RESOLVED 2026-05-14] Service-worker × iOS Safari audio decision
**Outcome:** ✅ SW + audio works. Spike test 8 (SW activation during in-flight playback) passed on real iPhone. Offline-cards-via-SW stays in v2.0 scope. Test 9 (new SW takes over, next cue plays) also passed.
**Evidence:** `~/.gstack/projects/board-game/audio-spike-results-2026-05-14.md`

---

## V2 Design (warewolf wireframes)

### [P3] v1.2 wireframe sketches (5 screens still queued from /plan-design-review)
**What:** Wireframe these screens via /design-shotgun → /design-html, in this order of impact:
1. Reconnect overlay (60s narrator stall + auto-resolve countdown UI)
2. Stadium PAUSE state (emergency override)
3. Error states: room not found / room full / room ended / bad code
4. Lobby avatar picker (12 variants per asset list)
5. First-timer onboarding link from 01 to game-rules
**Why:** These are sketched in V2-DESIGN.md but not built. Without them, engineer ships browser defaults for first-impression failures (room-not-found especially — common for shared-too-late URLs).
**Context:** From v1.0 plan-design-review pass-7 (10 unresolved decisions, 8 deferred to v1.2).
**Depends on:** Can run in parallel with Phase 2 implementation. Avatar picker depends on real avatar art (asset list, week 3 ROADMAP).

### [P2] A11Y appendix added to V2-DESIGN.md
**What:** Add a section to `apps/warewolf/docs/V2-DESIGN.md` covering:
- Touch target sizes for stadium cards (60×90 passes 44pt min — restate)
- Reduced-motion variants for: card flip (300ms → 100ms cross-fade), flip parade (v2.0.5: full sequence → instant reveal), lantern-flame glow (00a)
- Color contrast validation: `--color-blood #8b1a1a` on `--color-cream #f5ecd6` — needs WCAG AA pass on all token pairs, especially small italic text
- Keyboard nav patterns: tab order on lobby (code input → submit), stadium (Begin / Pause / Skip), vote (Execute / Spare)
- ARIA live regions for narrator subtitles on paired-view phases
- Focus management on phase transitions (focus moves to action panel automatically? stays?)
- NarratorSubtitle.tsx UI for hard-of-hearing players (deaf-accessible — captions visible on stadium AND player phones)
**Why:** Pass 6 of plan-design-review scored 5/10 specifically because A11Y isn't restated for V2. V1's A11Y.md is inherited but engineers building new V2 components won't know which patterns apply.
**Context:** From plan-design-review re-run on 2026-05-13. Documentation work, no wireframing. Can run in parallel with Phase 1 / Phase 2 week 1.
**Depends on:** Nothing — can start anytime.

### [P3] Pass 1 surgical edits (3 minor design-review findings)
**What:** Edit existing wireframes:
1. `02-lobby-host.html` — reorder CTA hierarchy: make Begin-the-Night the visual anchor (full-bleed accent), demote Browse setups + Customize to text links above
2. `08-game-over.html` — make Play-again the single dominant CTA (currently buried with other actions)
3. `05-player-surface.html` — add a phase indicator strip ("Night II / 3 of 7 alive") so player phone has wayfinding parity with stadium
**Why:** From plan-design-review Pass 1 (Information Architecture, 8/10). Each is a 3-line CSS edit. Shouldn't ship without these — they're hierarchy violations on key conversion screens.
**Context:** ~10 min total per fix, 30 min total. Cosmetic but correct.

---

## Cross-cutting

### [P3] V2 patterns added to canonical `docs/DESIGN-warewolf.md`
**What:** Document V2-specific patterns in V1's canonical design system file so future apps in the monorepo (Hub, Insider) can reuse:
- Card-back UI on vertical ellipse (rx=140/ry=180 mobile, rx=190/ry=230 desktop) — tokenize the radii
- Paired-view layout (two phones side-by-side with synchronized timestamp)
- Phase-aware theme shift (dark night ↔ light day on player surface)
- Card-flip 3D animation primitive (rotateY 180deg, 300ms, perspective 1200px)
**Why:** Currently these only exist in V2-DESIGN.md. As Hub + Insider grow, they'll need access to the same primitives. Keep DESIGN-warewolf.md as the canonical source.
**Context:** From plan-design-review Pass 5. Not gating v2.0; useful for v2.1+ and other apps.
