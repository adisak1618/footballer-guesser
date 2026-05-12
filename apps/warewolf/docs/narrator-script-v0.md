# Narrator Script v0.2 — Warewolf V2 Multiplayer (5-Role Launch)

**Status:** v0.2 DRAFT — adds ElevenLabs v3 audio tags per cue (original Thai unchanged). Needs native Thai speaker review before paper playtest.

**Coverage:** 5 roles (Werewolf, Villager, Seer, Bodyguard, Apprentice Seer), 5–8 players, full game loop.

**Tone reference:** หนังผี (Thai horror film). Theatrical, slow, slightly menacing. Not customer-service. The narrator is a presence, not a UI element.

**Voice direction for the actor (week 6) AND the v3 TTS dev iterations:**
- Pace: deliberate. Add 200–500ms pauses between sentences, especially before action prompts.
- Pitch: medium-low, breath-supported. Avoid sing-song or news-anchor brightness.
- Emotion floor: ominous calm. Push toward dread on death announcements; stay neutral on action prompts so urgency comes from the situation, not the voice.
- Pronunciation: anglicized words (Werewolf, Seer, Bodyguard) — use Thai equivalents below, never the English term.
- For v3 generation: use stability 30–45%, similarity 75–85%, style exaggeration 0–20%, model `eleven_v3_alpha`. Generate 3–5 takes per cue and pick the best.

**Format:** each cue has `phase` (matches `phase-machine-mirror.ts` enum), `clip` (filename), Thai line (original, unchanged), Thai with v3 audio tags (input for ElevenLabs), English gloss, `duration_ms` target, and `wait_for` trigger. 26 cues total.

See `elevenlabs-audio-tags.md` for the tag palette and stacking patterns referenced below.

---

## Design rules applied (v0.1) and tag policy (v0.2)

1. **No name interpolation.** Voice never says player names or role names. Stadium screen shows them.
2. **No number interpolation.** Voice never says player counts, wolf counts, or specific times. Stadium shows counts and countdowns.
3. **Apprentice inheritance is SILENT.** Apprentice's phone shows a private message; reuses standard `seer_wake` cue. Other players cannot tell the inheritance happened.
4. **Tags are advisory, not required.** The "Thai (original)" field is the canonical script. The "Thai (with v3 audio tags)" field is the input you paste into ElevenLabs. If you book the human voice actor in week 6, the actor reads the original Thai and you brief them on the tag intent verbally — the bracketed tags themselves are NOT spoken.
5. **Tags use bold v3 verbs only.** No subtle/literary tags (`[wistful]`, `[contemplative]`) — they render unreliably in Thai. Stack 1–2 tags max per cue.

---

## Phase 0 — Game Start

### `game_start`

| field | value |
|---|---|
| clip | `th/00-game-start.mp3` |
| Thai (original) | "ยินดีต้อนรับสู่หมู่บ้าน คืนนี้ หมาป่าเดินอยู่ท่ามกลางพวกท่าน ขอให้ท่านพบมันก่อนที่มันจะพบท่าน" |
| Thai (with v3 audio tags) | "[ominous][slowly] ยินดีต้อนรับสู่หมู่บ้าน ... คืนนี้ หมาป่าเดินอยู่ท่ามกลางพวกท่าน ... [whispers] ขอให้ท่านพบมันก่อนที่มันจะพบท่าน" |
| English | "Welcome to the village. Tonight, wolves walk among you. Pray you find them before they find you." |
| duration_ms | 10000 |
| wait_for | `duration` |

> Stadium screen displays player count and wolf count. Voice does not.

---

## Phase 1 — Role Assignment

### `role_assignment`

| field | value |
|---|---|
| clip | `th/01-role-reveal.mp3` |
| Thai (original) | "บัตรของท่านปรากฏแล้ว แตะเพื่อพลิกดูบทบาทของท่าน อย่าให้ใครเห็น" |
| Thai (with v3 audio tags) | "[mysteriously] บัตรของท่านปรากฏแล้ว ... แตะเพื่อพลิกดูบทบาทของท่าน [whispers] อย่าให้ใครเห็น" |
| English | "Your card has appeared. Tap to flip and see your role. Show no one." |
| duration_ms | 7000 |
| wait_for | `all_players_card_flipped` |

---

## Phase 2 — Night 1 Intro

### `night_intro`

| field | value |
|---|---|
| clip | `th/10-night-falls.mp3` |
| Thai (original) | "ค่ำคืนมาเยือน หมู่บ้านหลับใหล ทุกคนหลับตา" |
| Thai (with v3 audio tags) | "[hushed][slowly] ค่ำคืนมาเยือน ... หมู่บ้านหลับใหล ... [whispers] ทุกคนหลับตา" |
| English | "Night falls. The village sleeps. Everyone, close your eyes." |
| duration_ms | 6000 |
| wait_for | `duration` |

---

## Phase 3 — Wolves Act

### `wolves_wake`

| field | value |
|---|---|
| clip | `th/20-wolves-wake.mp3` |
| Thai (original) | "หมาป่า ลืมตา จดจำกันและกัน" |
| Thai (with v3 audio tags) | "[ominous][slowly] หมาป่า ... ลืมตา ... จดจำกันและกัน" |
| English | "Werewolves, open your eyes. Recognize each other." |
| duration_ms | 5000 |
| wait_for | `duration` |

### `wolves_choose`

| field | value |
|---|---|
| clip | `th/21-wolves-choose.mp3` |
| Thai (original) | "หมาป่า เลือกเหยื่อของคืนนี้ แตะที่หน้าจอ" |
| Thai (with v3 audio tags) | "[ominous] หมาป่า ... เลือกเหยื่อของคืนนี้ ... [seriously] แตะที่หน้าจอ" |
| English | "Werewolves, choose tonight's prey. Tap your phone." |
| duration_ms | 5000 |
| wait_for | `wolves_action_complete` |

### `wolves_sleep`

| field | value |
|---|---|
| clip | `th/22-wolves-sleep.mp3` |
| Thai (original) | "หมาป่า หลับตา" |
| Thai (with v3 audio tags) | "[softly] หมาป่า ... หลับตา" |
| English | "Werewolves, close your eyes." |
| duration_ms | 3000 |
| wait_for | `duration` |

---

## Phase 4 — Seer Acts (and Apprentice Seer, transparently)

### `seer_wake`

| field | value |
|---|---|
| clip | `th/30-seer-wake.mp3` |
| Thai (original) | "ผู้หยั่งรู้ ลืมตา" |
| Thai (with v3 audio tags) | "[mysteriously] ผู้หยั่งรู้ ... ลืมตา" |
| English | "Seer, open your eyes." |
| duration_ms | 3500 |
| wait_for | `duration` |

> This cue plays every night. If the original Seer is alive, their phone vibrates and they act. If the original Seer is dead, the Apprentice Seer's phone vibrates and they act. The audio is identical either way. The village hears the same line every night and cannot tell which player is currently the Seer.

### `seer_inspect`

| field | value |
|---|---|
| clip | `th/31-seer-inspect.mp3` |
| Thai (original) | "เลือกหนึ่งคน ท่านจะเห็นว่าเขาคือชาวบ้านหรือหมาป่า" |
| Thai (with v3 audio tags) | "[mysteriously][curious] เลือกหนึ่งคน ... ท่านจะเห็นว่าเขาคือชาวบ้านหรือหมาป่า" |
| English | "Choose one. You will see if they are villager or wolf." |
| duration_ms | 5500 |
| wait_for | `seer_action_complete` |

### `seer_sleep`

| field | value |
|---|---|
| clip | `th/32-seer-sleep.mp3` |
| Thai (original) | "ผู้หยั่งรู้ หลับตา" |
| Thai (with v3 audio tags) | "[softly] ผู้หยั่งรู้ ... หลับตา" |
| English | "Seer, close your eyes." |
| duration_ms | 3000 |
| wait_for | `duration` |

---

## Phase 5 — Bodyguard Acts

### `bodyguard_wake`

| field | value |
|---|---|
| clip | `th/40-bodyguard-wake.mp3` |
| Thai (original) | "ผู้พิทักษ์ ลืมตา" |
| Thai (with v3 audio tags) | "[seriously] ผู้พิทักษ์ ... ลืมตา" |
| English | "Bodyguard, open your eyes." |
| duration_ms | 3500 |
| wait_for | `duration` |

### `bodyguard_protect`

| field | value |
|---|---|
| clip | `th/41-bodyguard-protect.mp3` |
| Thai (original) | "เลือกหนึ่งคนที่ท่านจะปกป้องคืนนี้ ห้ามเลือกคนเดิมจากคืนก่อน" |
| Thai (with v3 audio tags) | "[seriously][slowly] เลือกหนึ่งคนที่ท่านจะปกป้องคืนนี้ ... ห้ามเลือกคนเดิมจากคืนก่อน" |
| English | "Choose one to protect tonight. You may not choose the same person as last night." |
| duration_ms | 6500 |
| wait_for | `bodyguard_action_complete` |

### `bodyguard_sleep`

| field | value |
|---|---|
| clip | `th/42-bodyguard-sleep.mp3` |
| Thai (original) | "ผู้พิทักษ์ หลับตา" |
| Thai (with v3 audio tags) | "[softly] ผู้พิทักษ์ ... หลับตา" |
| English | "Bodyguard, close your eyes." |
| duration_ms | 3000 |
| wait_for | `duration` |

---

## Phase 6 — Apprentice Seer (silent, no audio cue)

**No narrator audio. No v3 generation needed for this phase.** When the original Seer dies, the Apprentice Seer's phone shows a private message: "ท่านคือผู้หยั่งรู้แล้ว ลืมตาเมื่อได้ยินเสียงเรียก" ("You are the Seer now. Open your eyes when called."). From that night onward, the standard `seer_wake` cue prompts the apprentice instead. Other players hear the same Seer cues and cannot tell the inheritance happened.

This is a deliberate game-design choice that preserves information asymmetry:
- The wolves don't know whether to fear the original Seer or the apprentice — they only know "a Seer is still acting."
- The villagers don't know whether the Seer is still alive or whether the apprentice has taken over.
- Only the apprentice (and the dead Seer, who watches as a spectator) knows the truth.

---

## Phase 7 — Night Resolve (Dawn)

### `night_resolve_death`

| field | value |
|---|---|
| clip | `th/60-dawn-death.mp3` |
| Thai (original) | "รุ่งอรุณมาถึง หมู่บ้านตื่น... และพบศพหนึ่งคนกลางลานหมู่บ้าน" |
| Thai (with v3 audio tags) | "[dramatic][slowly] รุ่งอรุณมาถึง ... หมู่บ้านตื่น ... [ominous] และพบศพหนึ่งคนกลางลานหมู่บ้าน" |
| English | "Dawn breaks. The village wakes... and finds a body in the village square." |
| duration_ms | 9000 |
| wait_for | `duration` |

> Stadium screen shows which player died (avatar greyed, name on cemetery). Voice stays generic. The reveal of WHO died is visual + the dead player's own card greying on their phone.

### `night_resolve_no_death`

| field | value |
|---|---|
| clip | `th/61-dawn-spared.mp3` |
| Thai (original) | "รุ่งอรุณมาถึง หมู่บ้านตื่น คืนนี้ ไม่มีใครต้องตาย" |
| Thai (with v3 audio tags) | "[softly] รุ่งอรุณมาถึง หมู่บ้านตื่น ... คืนนี้ ไม่มีใครต้องตาย" |
| English | "Dawn breaks. The village wakes. Tonight, no one died." |
| duration_ms | 7000 |
| wait_for | `duration` |

---

## Phase 8 — Day Discussion

### `day_intro`

| field | value |
|---|---|
| clip | `th/70-day-intro.mp3` |
| Thai (original) | "จงปรึกษากัน หาตัวหมาป่าก่อนที่หมาป่าจะหาเจอท่าน เวลามีจำกัด" |
| Thai (with v3 audio tags) | "[seriously] จงปรึกษากัน ... หาตัวหมาป่าก่อนที่หมาป่าจะหาเจอท่าน ... [urgently] เวลามีจำกัด" |
| English | "Discuss. Find the wolves before they find you. Time is limited." |
| duration_ms | 7500 |
| wait_for | `duration_or_skip` |

> Stadium shows the countdown timer. Discussion duration is configurable per group (default 3 min, host can adjust in lobby). Voice never names a specific number.

---

## Phase 9 — Accusation

### `accusation_open`

| field | value |
|---|---|
| clip | `th/71-accusation.mp3` |
| Thai (original) | "ถึงเวลาแล้ว แตะที่ผู้ที่ท่านสงสัยบนหน้าจอเพื่อกล่าวหา" |
| Thai (with v3 audio tags) | "[seriously][slowly] ถึงเวลาแล้ว ... แตะที่ผู้ที่ท่านสงสัยบนหน้าจอเพื่อกล่าวหา" |
| English | "The time has come. Tap the player you suspect, on your phone, to accuse them." |
| duration_ms | 7000 |
| wait_for | `accusation_made` |

---

## Phase 10 — Defense

### `defense_open`

| field | value |
|---|---|
| clip | `th/80-defense.mp3` |
| Thai (original) | "มีผู้ถูกกล่าวหาแล้ว จงแก้ต่างก่อนที่หมู่บ้านจะตัดสิน" |
| Thai (with v3 audio tags) | "[dramatic][seriously] มีผู้ถูกกล่าวหาแล้ว ... จงแก้ต่างก่อนที่หมู่บ้านจะตัดสิน" |
| English | "The accused has been named. Defend yourself before the village decides." |
| duration_ms | 6500 |
| wait_for | `duration` |

> Stadium shows who is accused (large card art + countdown). Voice stays generic.

### `defense_warning_final`

| field | value |
|---|---|
| clip | `th/81-defense-final.mp3` |
| Thai (original) | "เวลาใกล้หมดแล้ว" |
| Thai (with v3 audio tags) | "[urgently][whispers] เวลาใกล้หมดแล้ว" |
| English | "Time runs short." |
| duration_ms | 2500 |
| wait_for | `duration` |

> Played at a fixed fraction (e.g., 80%) of the configured defense window, not at a hard 10-second mark.

---

## Phase 11 — Vote

### `vote_open`

| field | value |
|---|---|
| clip | `th/90-vote-open.mp3` |
| Thai (original) | "ลงคะแนน ประหารหรือไว้ชีวิต" |
| Thai (with v3 audio tags) | "[seriously] ลงคะแนน ... ประหารหรือไว้ชีวิต" |
| English | "Vote. Execute, or spare." |
| duration_ms | 4000 |
| wait_for | `all_alive_voted` |

---

## Phase 12 — Execution

### `execution_killed`

| field | value |
|---|---|
| clip | `th/91-execution-killed.mp3` |
| Thai (original) | "หมู่บ้านตัดสินใจแล้ว ผู้ถูกกล่าวหาถูกประหาร เผยตัวตน..." |
| Thai (with v3 audio tags) | "[dramatic][slowly] หมู่บ้านตัดสินใจแล้ว ... ผู้ถูกกล่าวหาถูกประหาร ... [ominous][whispers] เผยตัวตน..." |
| English | "The village has decided. The accused is executed. The card is revealed..." |
| duration_ms | 9000 |
| wait_for | `card_flip_complete` |

> Player phone flips the card visually (animation reveals role). Voice does not say the role name; the card flip IS the reveal.

### `execution_spared`

| field | value |
|---|---|
| clip | `th/92-execution-spared.mp3` |
| Thai (original) | "หมู่บ้านเมตตา อีกหนึ่งคืนหมาป่ายังเดินอยู่" |
| Thai (with v3 audio tags) | "[softly][slowly] หมู่บ้านเมตตา ... [ominous] อีกหนึ่งคืนหมาป่ายังเดินอยู่" |
| English | "The village shows mercy. The wolves walk one more night." |
| duration_ms | 7500 |
| wait_for | `duration` |

---

## Phase 13 — Game Over

### `wolves_win`

| field | value |
|---|---|
| clip | `th/99-wolves-win.mp3` |
| Thai (original) | "หมาป่ามีจำนวนเท่ากับชาวบ้านแล้ว หมู่บ้านล่มสลาย หมาป่า... ชนะ" |
| Thai (with v3 audio tags) | "[ominous][slowly] หมาป่ามีจำนวนเท่ากับชาวบ้านแล้ว ... หมู่บ้านล่มสลาย ... [triumphantly][whispers] หมาป่า... ชนะ" |
| English | "The wolves now equal the villagers. The village falls. The wolves... win." |
| duration_ms | 10000 |
| wait_for | `duration` |

### `village_wins`

| field | value |
|---|---|
| clip | `th/98-village-wins.mp3` |
| Thai (original) | "หมาป่าตัวสุดท้ายล้มลง หมู่บ้านปลอดภัยอีกครั้ง ชาวบ้าน... ชนะ" |
| Thai (with v3 audio tags) | "[dramatic][slowly] หมาป่าตัวสุดท้ายล้มลง ... หมู่บ้านปลอดภัยอีกครั้ง ... [triumphantly] ชาวบ้าน... ชนะ" |
| English | "The last wolf falls. The village is safe again. The villagers... win." |
| duration_ms | 9000 |
| wait_for | `duration` |

---

## Utility Cues (non-phase, played opportunistically)

### `pause`

| field | value |
|---|---|
| clip | `th/u01-pause.mp3` |
| Thai (original) | "เกมหยุดชั่วคราว" |
| Thai (with v3 audio tags) | "[softly] เกมหยุดชั่วคราว" |
| English | "Game paused." |
| duration_ms | 2500 |
| wait_for | `manual_resume` |

### `resume`

| field | value |
|---|---|
| clip | `th/u02-resume.mp3` |
| Thai (original) | "เกมดำเนินต่อ" |
| Thai (with v3 audio tags) | "[softly] เกมดำเนินต่อ" |
| English | "Game resumes." |
| duration_ms | 2500 |
| wait_for | `duration` |

### `waiting_for_action`

| field | value |
|---|---|
| clip | `th/u03-waiting.mp3` |
| Thai (original) | "หมาป่ากำลังคิด..." |
| Thai (with v3 audio tags) | "[whispers][ominous] หมาป่ากำลังคิด..." |
| English | "The wolves are thinking..." |
| duration_ms | 3000 |
| wait_for | `action_received_or_timeout` |

> Loops every 15s of stall, max 4 plays before auto-resolve. Stall window is configurable.

---

## Cue count

26 cues total. See the v0.1 → v0.2 changelog at the bottom for which cues are newly tagged.

- 1 game start
- 1 role assignment
- 1 night intro
- 3 wolves (wake / choose / sleep)
- 3 seer (wake / inspect / sleep) — also serves apprentice
- 3 bodyguard (wake / protect / sleep)
- 0 apprentice (silent — no audio)
- 2 night resolve (death / no death)
- 1 day intro
- 1 accusation
- 2 defense (open / final warning)
- 1 vote open
- 2 execution (killed / spared)
- 2 game over (wolves win / village wins)
- 3 utility (pause / resume / waiting)

---

## Tag palette quick-reference (used in this script)

| Tag | Used in N cues | Purpose |
|---|---|---|
| `[ominous]` | 7 | Default narrator menace |
| `[slowly]` | 9 | Deliberate pacing on long lines |
| `[softly]` | 7 | Sleep cues, gentle close |
| `[whispers]` | 6 | Tension peaks, intimate menace |
| `[seriously]` | 5 | Action prompts, neutral authority |
| `[dramatic]` | 4 | Climax beats |
| `[mysteriously]` | 3 | Reveal moments without violence |
| `[urgently]` | 2 | Time pressure |
| `[triumphantly]` | 2 | Game over lines |
| `[curious]` | 1 | Seer inspect |
| `[hushed]` | 1 | Night intro |

Total: 11 distinct tags across 26 cues, ~2 tags average per cue. Conservative palette — easy to QA on a voice clone.

See `elevenlabs-audio-tags.md` for full tag rationale and stacking patterns.

---

## Generation workflow (v3 dev iteration)

1. Open ElevenLabs Studio with the Thai voice clone selected.
2. Set model: `eleven_v3_alpha`. Settings: stability 35%, similarity 80%, style exaggeration 10%, speaker boost OFF.
3. For each cue: paste the "Thai (with v3 audio tags)" field. Generate 3 takes.
4. Audition on a Bluetooth speaker propped on a table. NOT through headphones — that hides whether the cue carries the room.
5. Pick the best take. Save the seed/parameters in a sidecar JSON for reproducibility.
6. Encode to MP3 (64kbps mono, 22kHz) before committing to `apps/warewolf/public/audio/th/dev/`.
7. If you can't get a good take after 5 generations on a cue, mark that cue as "ESCALATE TO VOICE ACTOR" — some lines genuinely need a human.

---

## Open lines that still need native-speaker review

These are the Thai lines I'm least confident in. Get a Thai Werewolf player to read them aloud and tell you if they sound right or stilted:

1. `wolves_choose`: "หมาป่า เลือกเหยื่อของคืนนี้" — "เหยื่อ" feels right but check "ของคืนนี้" placement.
2. `night_resolve_death`: "พบศพหนึ่งคนกลางลานหมู่บ้าน" — "ลานหมู่บ้าน" is poetic; check if "หน้าบ้าน" or just "ในหมู่บ้าน" feels more natural.
3. `execution_killed`: "เผยตัวตน" — formal. Casual alt: "เปิดบัตร". Pick the tone you want.
4. `execution_spared`: "อีกหนึ่งคืนหมาป่ายังเดินอยู่" — dramatic. Check if it lands or feels overwritten.
5. `wolves_win` and `village_wins`: the dramatic ellipsis "...ชนะ" is a directing cue, not a Thai writing convention. Make sure the v3 model (or actor) lands the pause.

---

## Playtest checklist

- [ ] Print this file or load it on your laptop next to the table.
- [ ] Phone on the table set to voice-record the whole session.
- [ ] Read each cue at the indicated phase (use the "Thai (original)" field — ignore the audio tags during the human-mod paper playtest).
- [ ] After each cue, watch what players DO. Confusion = the line was unclear. Long silence = duration too short. Players talking over you = duration too long.
- [ ] After the game, mark every cue with: ✅ worked / ⚠️ needs rework / 🗑️ cut entirely.

---

## v0.1 → v0.2 changelog

| Change | Reason |
|---|---|
| Added "Thai (with v3 audio tags)" field to all 26 cues | User requested ElevenLabs v3 audio tag integration for TTS |
| Kept "Thai (original)" field unchanged | User requested original preservation |
| Added tag palette quick-reference section | Track which tags are used and how often |
| Added v3 generation workflow section | Concrete steps to use these tags in ElevenLabs |
| Updated cue table headers | Distinguish original vs tagged input |
| Tag policy clarification in design rules | Tags advisory only; original is canonical |

---

## Versioning

- **v0** — first draft.
- **v0.1** — applied user feedback: no name/number interpolation, silent apprentice inheritance, generic time language.
- **v0.2** (this file) — added ElevenLabs v3 audio tag field per cue, original Thai preserved.
- **v0.3** — post paper-playtest revisions.
- **v0.4** — post first dev playtest (week 3).
- **v1.0** — script-locked, ready for voice actor session OR final v3 generation (week 5).
- **v1.1+** — additional roles for v2.1+ (additive, do not modify v1.0 lines unless absolutely necessary).
