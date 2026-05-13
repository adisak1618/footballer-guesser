# V2 Design — Wireframe Prototype + Decisions

The visual design contract for Warewolf V2. Maps every screen to a wireframe, every wireframe to its V1 source (where applicable), and every locked aesthetic decision to its rationale.

**Status:** v1.1 finalized · 2026-05-13 · 12 wireframes (Tier 1 ship-blockers added per /plan-design-review)
**Prototype:** `~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/index.html`
**Metadata:** `~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/finalized.json`

Design artifacts live under `~/.gstack/projects/board-game/designs/` (outside the repo) because they are user data, not project files. They persist across branches, conversations, and worktrees.

For the upstream design doc (the original office-hours brainstorm + adversarial review output), see `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260513-020535-warewolf-multiplayer.md`.

For game-design locked decisions (gameplay rules, audio constraints, role catalog), see `apps/warewolf/CLAUDE.md` — this doc covers visual / UI design only.

---

## How to resume a design session

```bash
# 1. See the finalized prototype + cover page
open ~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/index.html

# 2. Read the metadata (page list, V1 mirror map, next steps)
cat ~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/finalized.json

# 3. List all per-screen design dirs (each has its own wireframe.html + approved.json)
ls -d ~/.gstack/projects/board-game/designs/warewolf-v2-*-20260513/

# 4. To wireframe a NEW screen: invoke /design-shotgun then /design-html
#    To polish the prototype: edit files in the prototype dir directly
```

---

## Aesthetic identity (locked)

**Grimoire / Folklore.** Parchment cream backgrounds, blood-red accents, italic serif (Cormorant Garamond + Noto Serif Thai), Roman numerals, fleuron dividers (❦), wax-seal motif. Inherited verbatim from V1 and re-validated for V2 during /design-shotgun.

| Token | Value | Used for |
|---|---|---|
| `--color-cream` | `#f5ecd6` | Card backgrounds, parchment surfaces |
| `--color-parchment` | `#ede2c8` | Page background, second surface |
| `--color-parchment-warm` | `#fbf4e0` | Tile fills, highlight surfaces |
| `--color-ink` | `#1a1612` | Body text, borders (`--b: 1px solid var(--color-ink)`) |
| `--color-ink-muted` | `#5b4a3a` | Secondary text |
| `--color-ink-soft` | `#8a7864` | Tertiary text, captions |
| `--color-blood` | `#8b1a1a` | Wolf signal, primary CTA, danger |
| `--color-village` | `#2f5f3f` | Village signal, success, ready |

**Fonts:**
- `Cormorant Garamond` (italic 400/500/600/700) — Latin display + body
- `Noto Serif Thai` (400/500/600/700) — Thai (paired in same line where bilingual)
- `JetBrains Mono` (500/600/700) — page meta, code, sticky proto-nav

**Spacing:** `--s-2: 8px`, `--s-3: 12px`, `--s-4: 16px`, `--s-5: 24px`. Same scale as V1.

**Reference doc:** `docs/DESIGN-warewolf.md` (repo root). That file is canonical for the V1 system; V2 inherits without deviation.

---

## Page inventory (12 wireframes, finalized)

Main flow walks 01 → 02 → 03 → 04 → 04a → 05 → 06 → 07 → 08. Stadium pre-flow: 00a (one-time audio gate). Lobby detours: 02a/02b (side-trips off host lobby).

| # | Screen | Route | Design dir | V1 source (if mirrored) |
|---|---|---|---|---|
| 00a | AudioUnlockGate | `/play/stadium/[code]` (pre) | `warewolf-v2-audio-unlock-gate-20260513/` | none — new for V2 (Tier 1 ship-blocker) |
| 01 | Play entry | `/play` | `warewolf-v2-play-entry-20260513/` | none — new for V2 |
| 02 | Lobby (host) | `/play/lobby/[code]` | `warewolf-v2-lobby-host-20260513/` | none — new for V2 |
| 02a | Find a balanced setup | `/play/lobby/[code]/setup` | `warewolf-v2-setup-list-20260513/` | `apps/warewolf/app/[lang]/setup/page.tsx` (415 lines) |
| 02b | Customize setup | `/play/lobby/[code]/customize` | `warewolf-v2-customize-setup-20260513/` | `apps/warewolf/app/[lang]/setup/customize/page.tsx` (835 lines) |
| 03 | Lobby (joiner) | `/play/lobby/[code]` | `warewolf-v2-lobby-joiner-20260513/` | none — new for V2 |
| 04 | Stadium surface | `/play/stadium/[code]` | `warewolf-v2-stadium-surface-20260513/` | none — new for V2 |
| 04a | Role reveal (the WHOA opener) | `/play/[code]` (pre) | `warewolf-v2-role-reveal-20260513/` | none — new for V2 (Tier 1 ship-blocker, 5 role states) |
| 05 | Player surface | `/play/[code]` | `warewolf-v2-player-surface-20260513/` | none — new for V2 |
| 06 | Day vote (paired) | `/play/[code]` + `/play/stadium/[code]` | `warewolf-v2-day-phase-vote-20260513/` | none — new for V2 |
| 07 | Death + Spectator (paired) | `/play/[code]` + `/play/stadium/[code]` | `warewolf-v2-death-spectator-20260513/` | none — new for V2 |
| 08 | Game over (paired) | `/play/[code]` + `/play/stadium/[code]` | `warewolf-v2-game-over-20260513/` | none — new for V2 |

Each per-screen dir contains `wireframe.html` (the standalone design) and (where saved) `approved.json` (design-shotgun selection + user feedback).

---

## V1 components reused verbatim (no new code)

For 02a and 02b we mirror V1 exactly. The V2 implementation is a route-file change only — same components, same balance solver, same role catalog rendering.

| Component | File | Used by |
|---|---|---|
| `ArchetypeChipStrip` | `apps/warewolf/components/ArchetypeChipStrip.tsx` | 02a |
| `SetupCard` | `apps/warewolf/components/SetupCard.tsx` | 02a |
| `SolverErrorRow` | `apps/warewolf/components/SolverErrorRow.tsx` | 02a |
| `BalanceScale` | `apps/warewolf/components/BalanceScale.tsx` | 02b, 02 (lobby preview) |
| `PlayableBanner` | `apps/warewolf/components/PlayableBanner.tsx` | 02b |
| `RoomCardButton` (inline in V1) | `apps/warewolf/app/[lang]/setup/customize/page.tsx` | 02b |
| `AddRoleSheet` | `apps/warewolf/components/AddRoleSheet.tsx` | 02b — filtered to v2.0 5-role catalog |
| `RoleDetailModal` | `apps/warewolf/components/RoleDetailModal.tsx` | 02b — side-panel on desktop, bottom-sheet on mobile |
| `CardArt` | `apps/warewolf/components/CardArt.tsx` | 02a, 02b, 04, 05, 07, 08 |
| `computeSetupList()` | `apps/warewolf/lib/solver.ts` | 02a |
| Stepper + clamp + toast | `apps/warewolf/app/[lang]/setup/page.tsx` (lines ~228–315) | 02a |

Only adapt: V1 navigates `/setup/customize?p=&roles=` via URL params. V2 navigates `/play/lobby/[code]/customize` and seeds via Zustand state — lobby code is the canonical share unit, not the setup URL.

---

## V2-specific patterns introduced (new in this prototype)

These don't exist in V1. Implementation will live under `components/play/` (per CLAUDE.md V2 file layout).

| Pattern | What it is | Where it shows up |
|---|---|---|
| **Stadium card-back UI** | Vertical-ellipse village square (rx=140, ry=180 mobile / 190×230 desktop). 60×90 face-down card thumbnails with ❦ wax seal. | 04 stadium, 06 vote, 07 death, 08 game-over |
| **Card-back vs face-up state** | Stadium NEVER shows roles during game (face-down only). At game-over, all flip face-up via the parade animation (v2.0.5 ships the actual parade; v2.0 ships static reveal). | 04 stays face-down. 08 reveals all. |
| **Phase-aware theme** | Player phone surface shifts: dark night (parchment-warm on dark navy) → light day (parchment cream on warm field). Triggered by phase transition cue. | 05 player surface |
| **Role anchor (persistent)** | Player phone shows their role card as a fixed top anchor through every phase. Contextual action panel below changes per phase. | 05 player surface |
| **Paired-view wireframes** | Two phones (player + stadium) shown side by side with a `=` synchronized timestamp. Pattern for design review of cross-device moments. | 06, 07, 08 |
| **Spectator UX (post-death)** | Persistent full-roster reveal with role labels for the dead player only. Other players still see face-down. | 07 |
| **Winner badge pill** | Prominent green (village wins) or blood-red (wolves win) pill at the top of the game-over screen with bilingual label. | 08 |
| **AudioUnlockGate (Lectern)** | Single-state "Tap to begin" iOS Safari audio prime screen. Synchronous click handler creates `AudioContext` + plays `silence-100ms.mp3` + RPC. Lantern-flame glow animation. | 00a (v1.1) |
| **Role reveal (Tap to Reveal)** | The WHOA opener — first phone-tap reveals your role with 3D `rotateY(180deg)` card-flip (300ms) + role audio cue at t=0. 5 role states: Werewolf, Seer, Apprentice Seer, Bodyguard, Villager. | 04a (v1.1) |

---

## Locked design decisions (do not relitigate)

These were locked during /design-shotgun + iterative feedback. Apply during implementation; do not propose alternatives unless the user explicitly opens the thread.

1. **Card-back is the stadium primitive.** Face-down trading-card thumbnails on a vertical ellipse. NOT circles with first-letter avatars (rejected after first stadium iteration).
2. **Vertical ellipse, not horizontal.** Cards are 2:3 (taller than wide). Vertical ellipse keeps adjacent cards from overlapping. (Verified mathematically at adjacent positions for 5–8 player counts; stress-tested at 15 players.)
3. **Stadium info asymmetry preserved.** Stadium NEVER reveals roles mid-game (cards stay face-down) so spectators glancing at the stadium phone don't leak info to the table. Only at game-over.
4. **Customize uses V1 UI verbatim.** When the user said "we already have UI for this don't create new" we threw out the preset chips + stepper paradigm and mirrored V1's `customize/page.tsx` exactly. This is now the rule for any v2 feature where V1 already has a working pattern.
5. **Joiner code-hero matches host.** Both can copy/share/show QR. The room code is the canonical share unit; both roles need it.
6. **Joiner ready button uses Begin-the-Night style.** Full-width blood-red `.cta-primary` with `.is-on` modifier flipping to village-green ✓. Not a pill toggle (rejected after first joiner iteration).
7. **Setup preview above ready button on joiner.** Per user feedback. Joiner needs to see what they're about to play before committing.
8. **Game-over reveals winning team prominently.** Winner badge pill at top + role labels under every name in village square + flip-parade preview (v2.0.5 ships full animation).
9. **Apprentice Seer inheritance is silent in UI too.** No visual marker on the apprentice's card differentiates them from the Seer. The apprentice's phone shows a private message; the village sees no change. Mirrors the audio rule from `apps/warewolf/CLAUDE.md` decision #6.
10. **Bilingual everywhere it costs nothing.** EN primary, Thai secondary on the same line where space allows (`Begin the Night · เริ่มเกม`). When space is tight, EN only and rely on i18n routing.
11. **AudioUnlockGate is "The Lectern".** Centered minimal Grimoire chrome with single full-width blood-red CTA "Tap to begin · แตะเพื่อเริ่ม". Tap = synchronous user-gesture handler that creates AudioContext + plays `silence-100ms.mp3` + RPC writes `audio_unlocked: true`. NO setTimeout, NO async-await before audio.play(). Lantern-flame glow animation respects `prefers-reduced-motion`. Single state, no error path.
12. **Role reveal is "Tap to Reveal".** Card-back fills middle of dark-night surface. Tap = 3D `rotateY(180deg)` over 300ms ease-in-out (parent `perspective: 1200px`). Audio cue plays synchronously inside click handler. Persistent "I've seen it · เห็นแล้ว" CTA dismisses to player surface. Apprentice Seer reveals AS Apprentice — silent inheritance preserved. 5 role states locked with hero copy + audio file + balance pip per role. Pre-load all 5 art + 5 audio (~250KB) during lobby phase.

---

## Sketched but not yet wireframed (v1.2 candidates)

These came up during the build but were deferred. Each needs `/design-shotgun` + `/design-html` before adding to the prototype. v1.1 already added the Tier 1 ship-blockers (AudioUnlockGate, Role reveal); v1.2 covers the recovery + edge-case set.

- **Reconnect flow** — narrator stalls with `waiting_for_action` cue. UI: "Waiting for X to return... 47s" countdown on stadium + "Reconnecting..." overlay on player phone. Auto-resolve at 60s with random legal action.
- **Stadium PAUSE** — emergency override on stadium phone. UI: pause overlay + "Resume from where we left off" CTA. Audio cuts cleanly.
- **Room not found / room full / room ended** — error states from join flow. Need empathetic copy + clear next action.
- **Lobby avatar selection** — currently just first-initial placeholders in the wireframes. Need a picker (12 variants per ROADMAP asset list).
- **First-timer onboarding** — link from 01 entry to game-rules for someone who's never played.

---

## Out of scope (v2.0)

Per the v2.0 locked decisions in `apps/warewolf/CLAUDE.md`:

- Hunter role (ships v2.0.5 — death-trigger interrupt logic is the gnarliest state machine in Werewolf)
- 9–12 player layouts (v2.1)
- 13–20 player layouts (v2.2)
- Online / remote play (never — same-room only)
- Accounts (ephemeral rooms only)
- App store distribution (PWA only)
- Coordinated end-game flip parade animation (sketched in 08; ships v2.0.5)

---

## Iteration history

The user gave 28 directives during the design session. Highlights worth keeping:

- **Card-back UI introduced** after rejecting first-letter circles (round 1)
- **Vertical ellipse adopted** after horizontal proved too tight at 8 players (round 2)
- **Joiner ready CTA unified** with host Begin-the-Night styling (round 3)
- **Setup preview moved above** ready button on joiner (round 4)
- **Customize completely rewritten** to mirror V1 verbatim (round 5 — major reset)
- **Game-over winner badge added** prominently with role reveal labels (round 6)
- **Setup-list page added** post-finalize when user noticed the V1 `/setup` page hadn't been wireframed yet (round 7)

All approved variants are saved as `approved.json` in their per-screen dirs. The metadata file (`finalized.json` in the prototype dir) cross-references them all.

---

## Next steps

**For engineering:** Use the prototype as the design contract. Build routes per the V2 file layout in `apps/warewolf/CLAUDE.md`. Reuse V1 components verbatim for 02a/02b (route-file change only).

**For design:** Wireframe v1.1 sketches before they block implementation. Run `/design-shotgun` per screen, then `/design-html` to package into the prototype.

**For QA:** Walk all 4 scenarios from the prototype index.html. Verify the proto-nav PREV/NEXT chain. Check mobile + desktop frames render in Safari + Chrome. Real-device test required during week 10 per ROADMAP.
