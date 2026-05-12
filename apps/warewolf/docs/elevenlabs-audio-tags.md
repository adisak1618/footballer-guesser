# ElevenLabs v3 Audio Tags — Reference for Warewolf Narrator

This doc is a curated reference for using **ElevenLabs Eleven v3 (alpha) audio tags** to direct the Thai narrator's emotional delivery. It is NOT a complete tag dictionary — the v3 ecosystem reportedly has 1800+ community-tracked tags. This doc covers the subset that's actually useful for the Werewolf narrator use case (theatrical Thai horror narration).

For the canonical 1800+ tag library, see the community-maintained [Eleven v3 Tag Library](https://audio-generation-plugin.com/eleven-v3-tag-library/). For ElevenLabs' own guidance, see the [v3 prompting docs](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3) (note: link occasionally 404s; use the [Help Center article](https://help.elevenlabs.io/hc/en-us/articles/35869142561297-How-do-audio-tags-work-with-Eleven-v3) as fallback).

---

## What audio tags are

Words wrapped in square brackets that v3 interprets as **performance cues**, not text to be spoken. The model treats them as stage directions. Example from the user's reference:

> ในดินแดนอันโบราณแห่งเอลโดเรีย ที่ซึ่งท้องฟ้าส่องประกายและป่าไม้กระซิบความลับกับสายลม มีมังกรชื่อเซฟีรอส [sarcastically] ไม่ใช่แบบที่ "เผาทุกอย่างให้วอดวาย" ... [giggles] แต่เขาอ่อนโยน ฉลาด และมีดวงตาเหมือนดวงดาวเก่าแก่ [whispers] แม้แต่เหล่านกก็เงียบสนิทเมื่อเขาผ่านไป

The model speaks the Thai text in its trained voice but adopts the directed delivery for the surrounding text.

---

## Syntax rules

1. **Square brackets only.** `[whispers]`, never `(whispers)` or `<whispers>`.
2. **Case-insensitive.** `[whispers]` = `[WHISPERS]` = `[Whispers]`. Lowercase is the convention.
3. **Affects subsequent text.** A tag changes delivery from the moment it appears until either the line ends or another tag overrides it.
4. **Tags can stack.** `[nervously][whispers]` layers nervousness AND whispering. Order doesn't strictly matter but read left-to-right when the actor previews.
5. **Tags are NOT spoken.** The TTS removes brackets from output.
6. **Punctuation augments tags.** Ellipses (`...`) create natural pauses. ALL CAPS adds emphasis. Standard punctuation paces rhythm.
7. **Leading tag = primary direction.** Place the most important tag at the start of the line.

---

## Thai language + audio tags

Eleven v3 supports 70+ languages including Thai. Audio tags work cross-language — the bracketed English keywords are interpreted by the model regardless of spoken language. **The tags themselves stay in English even when the spoken text is Thai.** Example:

```
[ominous][slowly] ค่ำคืนมาเยือน ... [whispers] ทุกคนหลับตา
```

**Thai-specific caveats:**
- Some emotion tags are tuned on English voice training data. Subtle deliveries (e.g., `[wistful]`, `[contemplative]`) may render less reliably in Thai. Bold tags (`[whispers]`, `[shouts]`, `[laughs]`, `[ominous]`) carry across languages well.
- Test every tag combination on your specific voice clone before locking it for the recording session.
- If a Thai line sounds flat with one tag, try stacking 2 tags or rephrasing the surrounding text to give the model more emotional context.

---

## Curated tag palette for Warewolf narrator

These are the tags I picked for the warewolf script, grouped by use case. Confirmed-working in Eleven v3 docs or widely-cited examples. Test each on your voice clone before committing.

### A. Atmosphere / mood (use on long atmospheric lines)

| Tag | When to use |
|---|---|
| `[ominous]` | Default narrator-default for night/death lines. Low, threatening. |
| `[mysteriously]` | Reveal moments that aren't violent. Seer prompts. |
| `[dramatic]` / `[dramatically]` | Climax beats — execution reveal, game-over lines. |
| `[hushed]` | Lower than normal, intimate. Night intro. |
| `[reverent]` | Slow, almost ritual delivery. Use sparingly for the most theatrical beats. |

### B. Volume / pacing (use on short imperatives)

| Tag | When to use |
|---|---|
| `[whispers]` | Hushed intimate delivery. Stall lines, tension peaks. |
| `[softly]` | Gentle close-the-loop lines (sleep cues). Less extreme than whispers. |
| `[slowly]` | Deliberate pacing, drags out a line. Pairs with `[ominous]` or `[dramatic]`. |
| `[urgently]` | Time pressure. Defense final warning. |
| `[shouts]` / `[shouting]` | NOT used in this script — too theatrical for Werewolf vibe. Listed for completeness. |

### C. Emotion (use to color a line)

| Tag | When to use |
|---|---|
| `[seriously]` | Default for action prompts (vote, accusation). Neutral authoritative. |
| `[curious]` | Seer inspect prompt. Inviting investigation. |
| `[triumphantly]` | Game-over lines (both sides). |
| `[wistful]` | Bittersweet moments — village showing mercy. Test in Thai before committing. |

### D. Reactions / non-verbal (sparingly)

| Tag | When to use |
|---|---|
| `[sighs]` | NOT used in v0.2 but available. Could fit "no one died tonight" if you want a relieved beat. |
| `[laughs]` / `[laughing]` | NOT used — wrong tone for Werewolf narrator. |
| `[gasp]` | NOT used — too cartoonish. |
| `[long pause]` | Available; `...` ellipsis usually does the same thing more naturally. |

### E. Sound effects (avoid — use SFX layer instead)

| Tag | Why we skip |
|---|---|
| `[door creaks]` | Inconsistent. Use a real SFX file from freesound.org. |
| `[wolf howl]` | Same. Real SFX is cheaper and reliable. |
| `[explosion]`, `[gunshot]` | N/A. |

The narrator should NEVER produce sound effects. Music + SFX go on a separate Howler.js track over the narrator audio.

---

## Stacking patterns that work

Verified pairings used in the Warewolf script. Each pattern has a "feel" you can audition before committing.

| Pattern | Feel | Used in |
|---|---|---|
| `[ominous][slowly]` | Doom incoming. Long pauses between phrases. | `night_intro`, `wolves_wake`, `night_resolve_death` |
| `[dramatic][slowly]` | Climax delivery. Heavier than ominous; more theatrical. | `execution_killed`, `wolves_win` |
| `[whispers][ominous]` | Quiet menace. Forces players to lean in. | `waiting_for_action` |
| `[urgently][seriously]` | Time pressure without panic. | `defense_warning_final` |
| `[mysteriously][curious]` | Inviting investigation. | `seer_inspect` |
| `[softly]` (alone) | Gentle close. | All `*_sleep` cues |
| `[triumphantly][slowly]` | Inevitable victory. | `wolves_win`, `village_wins` |

---

## Anti-patterns (what NOT to do)

1. **Don't tag every sentence.** A single tag at the start of a line is usually enough. Over-tagging confuses the model and produces uneven delivery.
2. **Don't combine contradictory emotions.** `[happy][sad]` is undefined behavior; the model picks one.
3. **Don't use sound-effect tags for production.** Layer real SFX files instead — cheaper, reliable, swappable.
4. **Don't use accent tags on a Thai voice.** `[strong British accent]` on a Thai voice clone produces unstable output.
5. **Don't expect tags to add words.** `[laughs]` does NOT insert a laugh sound; it directs delivery. For an actual laugh, use a sound-effect file.
6. **Don't rely on subtle tags in Thai.** `[wistful]`, `[contemplative]`, `[introspective]` are tuned on English data and may render flat in Thai. Use bold tags.

---

## Voice settings recommendations (for warewolf narrator)

Outside the tag system, ElevenLabs has knobs that interact with tag effectiveness. Use these as starting points; tune per voice clone:

| Setting | Recommended | Reason |
|---|---|---|
| Stability | 30–45% | Lower stability = more emotional variety. Tags work BETTER with lower stability. Don't go below 25% — output gets unstable. |
| Similarity | 75–85% | Maintains consistency across clips. |
| Style exaggeration | 0–20% | Let tags drive expression; style exaggeration competes with them. Keep low. |
| Speaker boost | OFF | Adds artifacts on ominous/whisper lines. |
| Model | `eleven_v3_alpha` | Required for audio tag support. v2.5 ignores brackets. |

For the warewolf use case (theatrical narration), generate **3–5 takes per cue** and pick the best. v3 produces variable output — regeneration is part of the workflow.

---

## Recording workflow with v3

1. **Lock the script first.** Tags are part of the script. Re-tagging requires re-generating the audio. Don't tag until v0.x of the script is locked.
2. **Pick or clone a Thai voice.** Instant Voice Clones work better with v3 tags than Professional Voice Clones (per ElevenLabs' own docs as of v3 alpha).
3. **Generate 3–5 takes per cue** with the same prompt + tags. v3 is variable.
4. **Audition on a Bluetooth speaker in a real room.** What sounds good in headphones often dies on a phone speaker across a kitchen table.
5. **Save the WINNING take's seed/parameters** so you can regenerate matching audio later if you tweak a line.
6. **Encode to MP3** at 64kbps mono / 22kHz (per Audio Pipeline section of design doc) before committing to repo.
7. **Generate per-cue, not per-batch.** A 26-line batch generation will have inconsistent voice character across cues. Generate one cue at a time and listen.

---

## When v3 isn't enough — fall back to voice actor

If after testing 5 takes per cue, you cannot get the menace/theatrical quality the design needs, the answer is to skip TTS entirely and book the voice actor. v3 is best-in-class TTS but a real Thai voice actor still beats it for theatrical work. Per the design doc, the voice-actor recording session is already in the v2.0 plan for week 6. v3 is the dev-iteration tool, not necessarily the launch tool.

---

## Sources

- [Prompting Eleven v3 (alpha) — ElevenLabs Documentation](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- [How do audio tags work with Eleven v3? — ElevenLabs Help Center](https://help.elevenlabs.io/hc/en-us/articles/35869142561297-How-do-audio-tags-work-with-Eleven-v3)
- [ElevenLabs Eleven v3 Tag Library (1806 tags, community-maintained)](https://audio-generation-plugin.com/eleven-v3-tag-library/)
- [ElevenLabs v3 Audio Tags User Guide — Jonathan Mast](https://jonathanmast.com/elevenlabs-v3-audio-tags-user-guide-mastering-emotional-voice-control/)
- [ElevenLabs Eleven v3 Alpha Complete Guide — Audio Generation Plugin](https://audio-generation-plugin.com/elevenlabs-v3/)
- [Eleven v3 — Most Expressive AI Voice Model](https://elevenlabs.io/v3)
