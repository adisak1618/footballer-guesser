# Narrator Audio Inventory

Inventory of the Thai narrator MP3s shipped with this app. The cues drive every phase transition in the V2 multiplayer game.

**Source of truth for cue text + tags:** `docs/narrator-script-v0.md` (v0.2)
**Tag reference:** `docs/elevenlabs-audio-tags.md`
**Generator:** `scripts/build-narrator-audio.ts`

## Provenance

| Field | Value |
|---|---|
| Generated | 2026-05-13 (commit `1b86294`) |
| Voice | Brian (`nPczCjzI2devNBz1zQrb`) — ElevenLabs default stock voice |
| Model | `eleven_v3` (alpha) |
| Settings | stability 0.35, similarity_boost 0.8, style 0.1, speaker_boost off |
| Format | `mp3_22050_32` (22 kHz mono, 32 kbps) |
| Total | 26 files, ~464 KB on disk |
| Quota burn | ~1,685 chars, est. 4–8% of free monthly tier |
| Validated by | End-to-end audition by user (all 26 cues) |

## Status

These are **dev-quality placeholders.** They are good enough for paper playtests, dev iteration, and v0.x demos. Production launch (v2.0 ship) replaces them with **human voice actor recordings** in `public/audio/th/prod/` per the design doc.

The dev set lives in `public/audio/th/dev/`. An env flag picks dev vs prod at build time (not yet wired — added in week 6).

## Inventory

All paths relative to `public/audio/`. Each cue corresponds 1:1 to a row in `docs/narrator-script-v0.md` v0.2.

### Game start + role assignment

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `game_start` | `th/dev/00-game-start.mp3` | Lobby Start tapped, before role reveal | ~10s |
| `role_assignment` | `th/dev/01-role-reveal.mp3` | Cards dealt; players tap to flip | ~7s |

### Night cycle — wolves

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `wolves_wake` | `th/dev/20-wolves-wake.mp3` | Wolves open eyes, recognize each other | ~5s |
| `wolves_choose` | `th/dev/21-wolves-choose.mp3` | Wolves vote on prey via phone | ~5s |
| `wolves_sleep` | `th/dev/22-wolves-sleep.mp3` | Wolves close eyes | ~3s |

### Night cycle — seer (and apprentice, transparently)

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `seer_wake` | `th/dev/30-seer-wake.mp3` | Active seer opens eyes (every night) | ~3.5s |
| `seer_inspect` | `th/dev/31-seer-inspect.mp3` | Seer picks one player to inspect | ~5.5s |
| `seer_sleep` | `th/dev/32-seer-sleep.mp3` | Seer closes eyes | ~3s |

> Apprentice Seer inheritance is silent — see CLAUDE.md locked decision #6. The apprentice's phone vibrates on the standard `seer_wake` cue once the original Seer has died.

### Night cycle — bodyguard

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `bodyguard_wake` | `th/dev/40-bodyguard-wake.mp3` | Bodyguard opens eyes | ~3.5s |
| `bodyguard_protect` | `th/dev/41-bodyguard-protect.mp3` | Bodyguard picks tonight's protectee | ~6.5s |
| `bodyguard_sleep` | `th/dev/42-bodyguard-sleep.mp3` | Bodyguard closes eyes | ~3s |

### Night resolve (dawn)

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `night_resolve_death` | `th/dev/60-dawn-death.mp3` | Someone died last night | ~9s |
| `night_resolve_no_death` | `th/dev/61-dawn-spared.mp3` | Bodyguard saved the wolf target | ~7s |

### Day phase

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `day_intro` | `th/dev/70-day-intro.mp3` | Discussion phase opens | ~7.5s |
| `accusation_open` | `th/dev/71-accusation.mp3` | Time to nominate a suspect | ~7s |
| `defense_open` | `th/dev/80-defense.mp3` | Accused player must defend | ~6.5s |
| `defense_warning_final` | `th/dev/81-defense-final.mp3` | At 80% of configured defense window | ~2.5s |
| `vote_open` | `th/dev/90-vote-open.mp3` | Vote to execute or spare | ~4s |
| `execution_killed` | `th/dev/91-execution-killed.mp3` | Village voted yes; card flips reveal role | ~9s |
| `execution_spared` | `th/dev/92-execution-spared.mp3` | Village voted no | ~7.5s |

### Game over

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `wolves_win` | `th/dev/99-wolves-win.mp3` | Wolves equal villager count | ~10s |
| `village_wins` | `th/dev/98-village-wins.mp3` | Last wolf eliminated | ~9s |

### Utility (phase-independent, played opportunistically)

| Cue ID | File | Plays when | Duration |
|---|---|---|---|
| `pause` | `th/dev/u01-pause.mp3` | Stadium PAUSE button pressed | ~2.5s |
| `resume` | `th/dev/u02-resume.mp3` | Stadium RESUME button pressed | ~2.5s |
| `waiting_for_action` | `th/dev/u03-waiting.mp3` | Player action stall (loops every 15s, max 4×) | ~3s |

### Other phases

- **Night intro** (`night_intro` → `th/dev/10-night-falls.mp3`) — first cue every night, ~6s
- Apprentice Seer inheritance — **no audio cue exists** by design (preserves info asymmetry)

## File naming convention

```
th/<set>/<NN>-<short-id>.mp3
```

- `<set>` is `dev` (this dir) or `prod` (voice-actor recordings, added week 6).
- `<NN>` is a 2-digit prefix that sorts files into rough game-order (00, 01, 10, 20, 30, 40, 60, 70, 80, 90, 99 + `u01`/`u02`/`u03` for utility). Gaps are intentional — leaves room for new cues without renumbering the world.
- `<short-id>` is a kebab-case slug derived from the cue's purpose. NOT identical to the cue ID in `narrator-script-v0.md` (which uses snake_case). Both forms intentionally exist; the file slug is for human eyeballing in `ls`, the cue ID is for code.

## How to regenerate

```bash
cd apps/warewolf

# dry-run — see what would generate, no API calls
bun scripts/build-narrator-audio.ts

# regenerate one cue (e.g. after editing its text in narrator-script-v0.md)
bun scripts/build-narrator-audio.ts --cue night_resolve_death --force

# regenerate everything (burns ~25% of free monthly quota)
bun scripts/build-narrator-audio.ts --all --yes --force
```

The generator script embeds the cue list inline. **If you change cue text or tags in `narrator-script-v0.md`, you must also update `scripts/build-narrator-audio.ts`** (the `CUES` array). The markdown is the doc; the script is the executable. They should match.

## How to add a new cue

1. Add the cue to `docs/narrator-script-v0.md` (with `Thai (original)`, `Thai (with v3 audio tags)`, `English`, `duration_ms`, `wait_for`).
2. Add the matching entry to `CUES` in `scripts/build-narrator-audio.ts`. Pick a numeric prefix that fits the existing sort order.
3. Run `bun scripts/build-narrator-audio.ts --cue <new_id>` to generate the MP3.
4. Audition. If good, commit both the markdown and the new MP3.
5. Wire the cue into `lib/phases/phase-audio-cues.ts` when it exists.

## Quota math (rough)

ElevenLabs free tier ≈ 10,000 credits/month ≈ ~10 minutes of audio. The 26 cues in this set are ~1,685 chars of input; one full pass ≈ 4–8% of monthly quota depending on v3 alpha pricing.

For dev iteration, you can comfortably regenerate the whole set 5–10 times per month on the free tier. For aggressive iteration on a single cue, use `--cue X --force` repeatedly — each call is a few credits.

If you exceed the free tier, the script will fail on the first cue with an HTTP 429 / quota-exceeded error and abort the batch (per the script's first-failure-aborts safety).

## Known caveats

- **Brian is English-trained.** Thai pronunciation is comprehensible but accented. Acceptable for dev iteration; production launch ships a real Thai voice actor.
- **v3 is variable.** The same prompt + tags can produce different deliveries. If a cue feels off, regenerate with `--force`. Don't tune the prompt unless you've tried 3 takes first.
- **Audio tags work but are subtle on Thai.** Bold tags (`[ominous]`, `[whispers]`) carry; subtle tags (`[wistful]`) often render flat. The v0.2 palette uses 11 tags chosen for cross-language reliability.
- **No silence cue exists yet.** The iOS Safari `AudioContext` unlock needs a 100ms silence MP3 (referenced in the design doc as part of `AudioUnlockGate.tsx`). That file will be added when the Stadium surface is built (week 5).
