# CLAUDE.md — `apps/warewolf/`

App-local context for Claude Code working inside this directory. Read this AFTER the repo-root `CLAUDE.md`. Repo-wide conventions (Bun + Turborepo, Vitest workspace projects, realtime publication discipline, no deep imports, etc.) are upstream — do not relitigate them here.

## What this app is

Two products in one Next.js app, sharing the Grimoire design system, Thai+English i18n, and the V1 role/balance data:

- **V1 (shipped):** standalone Thai balance & setup recommender for the Werewolf community. No backend. URL-canonical state. 5 user-facing routes. Production-ready.
- **V2 (in design + pre-build):** same-room mobile multiplayer game. App-as-moderator with Thai audio narrator. Two-surface "Stadium Mode" architecture. Builds on V1 verbatim. NOT yet implemented; design doc is APPROVED and pre-build artifacts are committed.

When in doubt about V2 design intent:
- Visual / UI / wireframe questions → **`apps/warewolf/docs/V2-DESIGN.md`** (page inventory, V1-mirror map, locked aesthetic decisions, prototype path)
- Game-design / architecture / strategy questions → `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260513-020535-warewolf-multiplayer.md` (the original office-hours brainstorm output, lives outside the repo)
- "What's left to ship" → `apps/warewolf/ROADMAP.md`

## Quick reference

| Thing | Value |
|---|---|
| Package name | `@social-hub/warewolf` |
| Dev port | `3003` |
| Stack | Next 16 + React 19 + TypeScript strict + Tailwind v4 + next-intl + Zod + Zustand 5 |
| Tests | Vitest (`bun run test`) + Playwright (`bunx playwright test`) + axe-core a11y |
| Lint | `tsc --noEmit` (no eslint) |
| Build | `bun run build` |
| Special builds | `bun run build:cards` (image pipeline), `bun run check:bundle` (perf gate) |

For env-setup, Supabase, monorepo conventions, see the repo-root `CLAUDE.md`. For perf gates, see `PERF.md`. For accessibility, see `A11Y.md`. For the V2 plan, see `ROADMAP.md`.

## V2 locked decisions (do not relitigate)

These were locked during office-hours brainstorm + adversarial review. Apply during implementation; do not propose alternatives unless the user explicitly asks.

1. **Same-room only.** Co-located players. No online/remote play in V2.
2. **App is a hard moderator.** Enforces phase order and timing. No freelance phase changes. Only escape hatch is a Stadium PAUSE button (v2.0).
3. **Stadium Mode is the architecture.** Two surfaces: shared Stadium phone (village square) + per-player phone (private role + actions). NOT single-phone-per-player.
4. **5 roles at v2.0:** Werewolf, Villager, Seer, Bodyguard, Apprentice Seer. Hunter is intentionally NOT in v2.0 (interrupt logic risk; ships v2.0.5).
5. **5–8 players at v2.0**, 9–12 at v2.1, 13–20 at v2.2.
6. **Apprentice Seer inheritance is SILENT.** No narrator audio when the Seer dies. Apprentice's phone shows a private message; reuses standard `seer_wake` cue every night. Other players never know if the original Seer or apprentice is acting. **This is a load-bearing game-design rule. Do not add an "apprentice_inherit" audio cue.**
7. **Reconnect always succeeds within game session** (no timeout). Narrator stalls with `waiting_for_action` cue, max 60s, then auto-resolves with random legal action.
8. **Dead players see everything.** Spectator UX shows full state including everyone's roles.
9. **Ephemeral rooms, no accounts.** Anon player_id (Supabase anonymous auth). Room dies 1 hour after game ends.
10. **PWA on Vercel, no app store.** Same distribution as Headball.
11. **Reuse V1 verbatim** — `lib/solver.ts`, `components/CardArt.tsx`, `components/BalanceScale.tsx`, `lib/store.ts` (extended), Grimoire tokens, next-intl. V2 extends V1; does not fork it.

## V2 audio pipeline rules (load-bearing)

The narrator audio is the pitch. Get this wrong, the design dies. Specific constraints:

- **Voice IS the brand.** v2.0 ships with **human voice actor recording** (booked week 6). TTS via ElevenLabs Eleven v3 is for **dev iteration only** (script changes are cheap; recording session is once).
- **Static MP3s only.** No runtime TTS. No runtime audio splicing. No streaming. Files live in `public/audio/th/dev/` (ElevenLabs-generated) and `public/audio/th/prod/` (voice-actor-recorded). Env flag picks which set ships per build.
- **No name interpolation.** The narrator NEVER speaks player names. Stadium screen shows them.
- **No number interpolation.** The narrator NEVER says "5 players" or "60 seconds." Stadium shows counts and countdowns. Game timing is configurable per group.
- **No role-name interpolation in execution_killed.** The card-flip animation IS the reveal.
- **iOS Safari audio autoplay is the load-bearing UX gate.** Stadium needs an `AudioUnlockGate.tsx` that primes `AudioContext` with a 100ms silence file. Without it, the entire narrator pitch fails on first phase transition. Test on real iPhone 12+/iOS 17+ before merging any narrator code.
- **Encoding:** MP3, 22kHz mono, 32kbps via ElevenLabs `output_format=mp3_22050_32`. ~20KB per cue.

## V2 file layout (when built — most don't exist yet)

```
app/[lang]/
  play/
    lobby/[code]/page.tsx     ← lobby (host configures setup, players join + ready)
    [code]/page.tsx           ← player surface (role card + action panel)
    stadium/[code]/page.tsx   ← stadium surface (village square)
  setup/                      ← V1, kept for the standalone balance tool
  rules/                      ← V1, unchanged
components/play/              ← all V2 multiplayer components
lib/realtime/                 ← V2 Supabase realtime hooks
lib/phases/
  phase-machine-mirror.ts     ← read-only client mirror of DB phase enum
  phase-audio-cues.ts         ← phase event → audio file mapping
public/audio/
  th/dev/                     ← ElevenLabs-generated MP3s (committed; for dev)
  th/prod/                    ← voice-actor-recorded MP3s (added week 6)
scripts/
  build-narrator-audio.ts     ← ElevenLabs MP3 generator (already exists)
  build-cards.ts              ← V1 card image pipeline (already exists)
docs/
  V2-DESIGN.md                ← V2 visual design contract: 10-page wireframe inventory, V1-mirror map, locked aesthetic decisions, prototype path. READ BEFORE ANY V2 UI WORK.
  narrator-script-v0.md       ← script v0.2 (canonical Thai + tags)
  narrator-audio.md           ← inventory of generated MP3s + provenance
  elevenlabs-audio-tags.md    ← v3 audio tag reference
  generate-tts-mp3.md         ← local macOS say+lame fallback
```

## Things NOT to do

- **Do NOT run `bun scripts/build-narrator-audio.ts --all --force` casually.** Burns ~25% of the ElevenLabs free monthly quota in one shot.
- **Do NOT commit `apps/warewolf/.env`.** It contains the ElevenLabs API key. Already gitignored; double-check before any `git add`.
- **Do NOT add player names or numbers to narrator cue text.** Stadium screen carries that data.
- **Do NOT add an `apprentice_inherit` audio cue.** Inheritance is silent. The cue would leak "the Seer is dead" to the village.
- **Do NOT add specific times to narrator cue text.** Times are configurable per group; the narrator says "time is limited" / "time runs short", not "60 seconds".
- **Do NOT introduce a runtime TTS dependency.** Narrator audio is always pre-generated static MP3s in the repo.
- **Do NOT relitigate the locked decisions** above unless the user explicitly opens that thread.
- **Do NOT skip the iOS Safari audio spike** before writing realtime audio code. It is the highest-risk technical area.
- **Do NOT break the realtime publication discipline** when adding `game_warewolf_*` tables (see root CLAUDE.md A4).

## Skill routing additions for warewolf work

The repo-root `CLAUDE.md` lists general skill routing. Specific to this app:

- V2 visual / UI / wireframe questions → `apps/warewolf/docs/V2-DESIGN.md` (then the prototype dir it points to: `~/.gstack/projects/board-game/designs/warewolf-v2-prototype-20260513/`)
- V2 game-design / architecture / strategy questions → `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260513-020535-warewolf-multiplayer.md`
- "What's left to ship V2" → `apps/warewolf/ROADMAP.md`
- Audio cue text + tags → `apps/warewolf/docs/narrator-script-v0.md`
- "What MP3s do we have / when does each play" → `apps/warewolf/docs/narrator-audio.md`
- ElevenLabs / TTS questions → `apps/warewolf/docs/elevenlabs-audio-tags.md` and `scripts/build-narrator-audio.ts`
- Local TTS fallback (macOS `say` + lame, no API) → `apps/warewolf/docs/generate-tts-mp3.md`
- V1 design system / aesthetic → `docs/DESIGN-warewolf.md` at the repo root
