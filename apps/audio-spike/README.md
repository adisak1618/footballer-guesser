# iOS Audio + Service Worker Spike

Throwaway PWA for the Phase 1 BLOCKER per `apps/warewolf/ROADMAP.md`. Validates that:

1. iOS Safari `AudioContext` unlock survives across multiple HTMLAudio cue plays.
2. Unlock survives backgrounding, screen lock, and long idle.
3. Service worker activation does NOT cut in-flight audio (TODOS.md P2).

Result feeds the V2 Ralph PRD — outcomes change which stories ship in v2.0.

## What it is

Pure static HTML + a tiny SW + 5 real Werewolf cues copied from `apps/warewolf/public/audio/th/dev/`. No framework, no build step, no `package.json` (deliberately — Bun workspaces ignore package-less dirs).

## Deploy to Vercel

You need an HTTPS URL because iOS Safari treats `http://` differently for both audio + SW.

Easiest path (no git commit needed):

```bash
cd apps/audio-spike
npx vercel        # follow prompts; creates a new project on the fly
npx vercel --prod # promote to a stable URL
```

Vercel auto-detects this as static (no framework), serves files as-is. Takes ~30 seconds.

Alternative: drag-drop the directory onto vercel.com (works too).

## Test on the iPhone

Open the resulting URL in Safari on iPhone 12+ / iOS 17+. Run each row in the matrix below. Mark pass/fail/notes inline.

| # | Test | Steps | Pass criteria | Result |
|---|---|---|---|---|
| 1 | Cold-start unlock | Open URL, tap "Tap to begin", tap Cue 1 | Audio plays | |
| 2 | Sequential manual cues | Tap Cue 1..5 with short waits | All 5 play, no silent failures | |
| 3 | Auto-advance (no gesture) | Tap "Play cues 1→5 sequentially" | All 5 play; cue 2 proves the unlock persists | |
| 4 | Background tab | Tap Cue 2, switch to another app for 30s, return, tap Cue 3 | Cue 3 plays | |
| 5 | Screen lock | Tap Cue 2, lock phone, wait 30s, unlock, tap Cue 3 | Cue 3 plays | |
| 6 | Long idle | Tap "Begin", wait 5 min doing nothing, tap Cue 1 | Plays — context didn't auto-suspend | |
| 7 | SW register, then audio | Tap "Register SW", wait until status says "registered", tap Cue 1 | Plays | |
| 8 | SW update mid-playback | Tap Cue 2 (longest); during playback tap "Force SW update" | Audio finishes without cutting (P2 concern) | |
| 9 | New SW takes over | After test 8, tap Cue 3 | Plays | |
| 10 | Refresh after unlock | Tap "Begin", tap Cue 1, refresh page, tap Cue 1 (no Begin tap) | **Should fail.** Confirms gate is per-page-load (informs AudioUnlockGate state) | |
| 11 | Bluetooth speaker | Connect BT speaker, repeat tests 1–4 | Audio routes to BT, no dropouts | |
| 12 | Silent mode | Tap Cue 1 with phone in silent mode | HTMLAudio plays through silent mode (WebAudio doesn't — confirms HTMLAudio choice) | |
| 13 | Wake Lock + screen lock | Tap "Acquire Wake Lock", then repeat test 5 | Plays — fallback if test 5 fails | |

The status panel + log on the page shows `AudioContext.state`, last cue, last error, SW state, Wake Lock state, and visibility transitions. Take a screenshot of the page after each test.

## Outcomes that change V2 plans

| Result | Impact on PRD |
|---|---|
| Test 4 fails | Add "Stadium phone must stay foregrounded" to setup UX |
| Test 5 fails AND test 13 passes | Add story: Wake Lock API required on Stadium |
| Test 5 fails AND test 13 fails | Hard requirement: disable auto-lock manually; UX warning in `00a-audio-unlock-gate` |
| Test 8 fails | Drop service worker from v2.0 entirely. Removes ~2 stories. |
| Test 10 surprise (gate persists across refresh) | Simplify AudioUnlockGate state — no per-tab tracking needed |
| Test 12 fails | Update `00a` copy to require silent mode OFF |

## Recording results

Write outcomes to `~/.gstack/projects/board-game/audio-spike-results-YYYYMMDD.md` (outside the repo — it's planning, not code). Then this `apps/audio-spike/` dir can be deleted. The results doc feeds the V2 Ralph PRD.

## Cleanup

After spike is done:

```bash
rm -rf apps/audio-spike/
npx vercel projects rm <project-name>
```

Or just leave it; it's ~150KB and doesn't interfere with the workspace (no `package.json`, so Bun + Turbo + Vitest all skip it).
