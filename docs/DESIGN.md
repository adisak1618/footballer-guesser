---
version: alpha
name: Stadium
description: A stadium-floodlight aesthetic for Headball (Thai mobile multiplayer football guessing game). Dark navy backgrounds mimic Anfield at night, jersey-bright player tag colors pop like kit colors under floodlights, and Bebas Neue display typography at scoreboard scale (120-160px) makes assigned player names readable across a 1.5-meter table. No mascots, no illustrations — names ARE the content. The energy is "Liverpool winning Champions League final" — celebratory, broadcast-grade, intentional.

colors:
  # Surfaces (dark default)
  ink: "#0a0e1a"
  surface: "#131826"
  surface-elevated: "#1c2236"
  hairline: "#2a3146"
  hairline-soft: "#1a2030"
  canvas: "#fafbfc"
  surface-soft: "#f3f4f6"
  surface-card: "#e9ebef"

  # Text
  on-dark: "#fafbfc"
  on-dark-soft: "#9ca3af"
  on-dark-muted: "#6b7280"
  on-light: "#0a0e1a"
  on-light-soft: "#374151"
  on-light-muted: "#6b7280"

  # Primary action
  goal: "#e63946"
  goal-active: "#c1121f"
  goal-disabled: "#7a1f26"

  # Player tag palette (each player gets one)
  tag-red: "#e63946"
  tag-blue: "#1d4ed8"
  tag-yellow: "#fbbf24"
  tag-green: "#16a34a"
  tag-purple: "#a855f7"
  tag-orange: "#f97316"
  tag-pink: "#ec4899"
  tag-cyan: "#06b6d4"

  # Semantic
  success: "#16a34a"
  warning: "#fbbf24"
  error: "#e63946"
  info: "#1d4ed8"

typography:
  # The hero — BIG NAME card
  hero-name:
    fontFamily: "'Bebas Neue', 'Sarabun', sans-serif"
    fontSize: 144px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: 1px
    textTransform: uppercase

  # Section displays — "ROUND 2", "FINAL SCORE"
  display-xl:
    fontFamily: "'Anton', 'Bebas Neue', sans-serif"
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.5px
    textTransform: uppercase
  display-lg:
    fontFamily: "'Anton', 'Bebas Neue', sans-serif"
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: 0.3px
    textTransform: uppercase
  display-md:
    fontFamily: "'Anton', 'Bebas Neue', sans-serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: 0.3px
    textTransform: uppercase

  # Numbers — scoreboard-aligned
  score-xl:
    fontFamily: "'Bebas Neue', sans-serif"
    fontSize: 64px
    fontWeight: 400
    fontFeatureSettings: "'tnum'"
    lineHeight: 1
  score-md:
    fontFamily: "'Bebas Neue', sans-serif"
    fontSize: 32px
    fontWeight: 400
    fontFeatureSettings: "'tnum'"
    lineHeight: 1

  # Body / UI (Thai + Latin)
  title-lg:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  title-md:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.3px

  # Buttons / interactive
  button-lg:
    fontFamily: "'Anton', 'Bebas Neue', sans-serif"
    fontSize: 20px
    fontWeight: 400
    letterSpacing: 1px
    textTransform: uppercase
    lineHeight: 1
  button-md:
    fontFamily: "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif"
    fontSize: 15px
    fontWeight: 600
    letterSpacing: 0.3px
    lineHeight: 1

  # Room code chip
  room-code:
    fontFamily: "'Bebas Neue', monospace"
    fontSize: 48px
    fontWeight: 400
    letterSpacing: 8px
    fontFeatureSettings: "'tnum'"

rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

motion:
  duration-instant: 50ms
  duration-fast: 150ms
  duration-medium: 300ms
  duration-slow: 600ms
  ease-out: cubic-bezier(0.16, 1, 0.3, 1)
  ease-in: cubic-bezier(0.7, 0, 0.84, 0)
  ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
  ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)

components:
  # The hero of the game
  big-name-card:
    backgroundColor: "{colors.tag-*}"
    textColor: "{colors.on-dark}"
    typography: "{typography.hero-name}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    minHeight: 100vh

  # Lobby player chip
  player-chip:
    backgroundColor: "{colors.tag-*}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm} {spacing.md}"

  # Room code display
  room-code-display:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-dark}"
    typography: "{typography.room-code}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "2px solid {colors.hairline}"

  # Goal button (primary CTA — "ทายชื่อ")
  button-goal:
    backgroundColor: "{colors.goal}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md} {spacing.xl}"
    minHeight: 56px

  # Secondary button
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.lg}"
    minHeight: 44px
    border: "1px solid {colors.hairline}"

  # Scoreboard tile (results screen)
  scoreboard-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-dark}"
    typography: "{typography.score-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
    border: "1px solid {colors.hairline-soft}"

  # Text input (display name, guess)
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    minHeight: 56px
    border: "2px solid {colors.hairline}"

  text-input-focused:
    border: "2px solid {colors.goal}"

  # Status banner (reconnecting, error)
  banner-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-light}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm} {spacing.md}"

  banner-error:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm} {spacing.md}"

  # Insider role-reveal pill (Master / Insider / Common)
  role-badge:
    backgroundColor: "{colors.surface}/50"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-md}"  # 32px Anton, uppercase, leading-none
    captionTypography: "{typography.body-md}"  # 18px IBM Plex Thai
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.md}"
    border: "2px solid {variants}"
    variants:
      warning:  # Insider — high-stakes / hidden-role
        border: "{colors.warning}"      # #fbbf24
        captionColor: "{colors.warning}"
      info:     # Master — judge
        border: "{colors.info}"         # #1d4ed8
        captionColor: "{colors.info}"
      neutral:  # Common — plain player
        border: "{colors.hairline}"     # #2a3146
        captionColor: "{colors.on-dark-soft}"

  # Master Yes / No / Unsure response button (asking phase)
  response-button:
    minHeight: 96px
    width: flex-1
    rounded: "{rounded.xl}"  # rounded-2xl
    padding: "{spacing.md} {spacing.lg}"
    layout: "stacked: icon (40px font-hero) → labelTh (28px display-md) → labelEn (12px body)"
    textColor: "{colors.on-dark}"
    transition: "active:scale-[0.99]"
    variants:
      success: # Yes / Affirmative
        backgroundColor: "{colors.success}"  # #16a34a
      error:   # No / Negative
        backgroundColor: "{colors.error}"    # #e63946
      warning: # Unsure / Hedge
        backgroundColor: "{colors.warning}"  # #fbbf24

  # Asking-phase response feed row (Insider/Common live ticker)
  response-feed-entry:
    minHeight: 44px
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"  # rounded-lg
    padding: "{spacing.sm} {spacing.md}"
    layout: "horizontal: [tabular-nums timestamp] · [icon + labelEn + /labelTh]"
    timestampTypography: "{typography.body-xs} tabular-nums {colors.on-dark-soft}"
    answerTypography: "{typography.display-sm}"  # 18px Anton, uppercase
    interactive: false  # non-interactive list row, rendered inside <ul>

  # Voting phase tap target (Screen 7)
  vote-target-card:
    minHeight: 120px
    width: 100%
    backgroundColor: "{colors.tag-*}"  # palette by joinOrder, same as player-chip
    textColor: "{colors.on-dark}"
    typography: "{typography.display-md}"  # 24px Anton, uppercase
    rounded: "{rounded.xl}"  # rounded-2xl
    padding: "{spacing.md} {spacing.md}"
    transition: "active:scale-[0.99]"
    selectedRing: "4px solid {colors.goal} offset-2 offset-{colors.ink}"
    selectedOverlay: "✓ icon, top-right, 28px circle, bg {colors.goal}"
    privacy: "no per-player tally shown (D6 — anti-cheat: hidden tallies)"

  # Host-setup pack picker chip (Screen 1)
  pack-chip:
    minHeight: 64px  # min-h-16
    rounded: "{rounded.lg}"  # rounded-xl
    padding: "{spacing.sm} {spacing.md}"
    semantics: "radio (role=radio + aria-checked)"
    label: "{typography.body-md} uppercase, IBM Plex Thai display"
    subLabel: "{typography.body-xs} (optional English)"
    states:
      selected:
        backgroundColor: "{colors.tag-*}"  # joinIndex → palette
        textColor: "{colors.on-dark|on-light}"  # palette-aware
        border: "1px solid transparent"
        shadow: shadow-md
      unselected:
        backgroundColor: "{colors.surface-elevated}"
        textColor: "{colors.on-dark}"
        border: "1px solid {colors.hairline}"
        active: "active:bg-{colors.surface}"
---

## Product Context

- **What this is:** Headball — Thai mobile multiplayer game ทายชื่อนักฟุตบอลบนหัว
- **Who it's for:** แฟนบอล Thai 18-35 ที่ดูคอนเทนต์ฟุตบอลบน YouTube/TikTok (เทพลีลา ฯลฯ) และเล่นกับเพื่อน 3-7 คนในห้องเดียวกัน
- **Space/industry:** Casual mobile party game (Heads Up, Kahoot, Among Us category) intersected with sport fandom (Premier League, Champions League)
- **Project type:** Real-time multiplayer mobile web app — single-purpose game, no marketing site, no dashboard
- **The memorable thing:** "รู้สึกเหมือนเชียร์ Liverpool ตอนชนะ" — stadium energy, broadcast-grade, celebratory

## Aesthetic Direction

- **Direction:** Stadium Floodlight + Trading Card
- **Decoration level:** Intentional — subtle grain on dark surfaces, floodlight glow on celebrations, no mascots/illustrations
- **Mood:** กลางคืนที่ Anfield, floodlights สว่าง, jerseys สด, scoreboard นับคะแนน. Dark + saturated + broadcast-grade.
- **Reference moments:** Champions League final introduction, FIFA Ultimate Team card reveal, Premier League broadcast graphics
- **Why stadium energy:** Headball ใช้ "ชื่อนักเตะ" เป็น content หลัก — typography ที่ scoreboard-grade คือสิ่งที่ทำให้ users feel เหมือนอยู่ใน match จริง ไม่ใช่ casual phone game ทั่วไป

## Typography

### Font Family

The system uses **3 fonts** with strict role separation. All free, all Google Fonts.

- **Bebas Neue** — Display hero. The font of stadium scoreboards since 1965. Used at 120-160px for the BIG NAME card, smaller for scores. All-caps, condensed, sport-poster classic.
- **Anton** — Section display. Heavier than Bebas, for "ROUND 2", "FINAL SCORE", uppercase button labels. 28-56px range.
- **IBM Plex Sans Thai Looped** — Body, UI, Thai-script content. Excellent Thai legibility + Latin support. Fallback: **Sarabun** (Google's default Thai web font) if Plex Thai fails to load.

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Use `font-display: swap` to avoid invisible text during font load.

### Hierarchy

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `{typography.hero-name}` | 144px | 400 | THE BIG NAME card (Bebas Neue, all-caps) |
| `{typography.display-xl}` | 56px | 400 | Section heads (Anton, all-caps) |
| `{typography.display-lg}` | 40px | 400 | Sub-section heads |
| `{typography.display-md}` | 28px | 400 | Card titles |
| `{typography.score-xl}` | 64px | 400 | Final scores (Bebas, tabular-nums) |
| `{typography.score-md}` | 32px | 400 | Round scores |
| `{typography.title-lg}` | 20px | 600 | Page titles in Thai/Latin |
| `{typography.title-md}` | 16px | 600 | Card titles, list labels |
| `{typography.body-md}` | 16px | 400 | Default running text |
| `{typography.body-sm}` | 14px | 400 | Secondary text |
| `{typography.caption}` | 12px | 500 | Metadata, captions |
| `{typography.button-lg}` | 20px | 400 | Primary CTAs (Anton, all-caps) |
| `{typography.button-md}` | 15px | 600 | Secondary buttons (Plex Thai) |
| `{typography.room-code}` | 48px | 400 | 6-char room code (Bebas, letter-spaced) |

### Principles

- **Bebas Neue** is reserved for sport moments: BIG NAME card, scores, room code. Never use for body.
- **Anton** appears at section breaks and primary CTA labels (uppercase). Never for body.
- **IBM Plex Thai** does ALL body, ALL UI, ALL form input, ALL Thai-script content.
- Mixing Bebas/Anton with each other inside the same paragraph is a system violation.
- All-caps usage is restricted to: hero name, section displays, primary buttons. Never all-caps body text.

## Color

### Approach
**Expressive** — color carries meaning. Player tag colors create identity. Goal red drives action. Stadium navy creates atmosphere.

### Surface (Dark default)
- `{colors.ink}` (#0a0e1a) — Default page background. Stadium navy-black.
- `{colors.surface}` (#131826) — Elevated panels (lobby cards, scoreboard tiles).
- `{colors.surface-elevated}` (#1c2236) — Buttons, room code background, modals.
- `{colors.hairline}` (#2a3146) — 1-2px borders on interactive elements.

### Surface (Light alt for celebration)
- `{colors.canvas}` (#fafbfc) — Used ONLY on win celebration screen (light scoreboard moment, like a trophy ceremony).
- `{colors.surface-soft}` (#f3f4f6) — Light panels in alt mode.

### Player Tags (8 colors, each player gets ONE)
- `tag-red` (#e63946) — Player 1 default
- `tag-blue` (#1d4ed8) — Player 2 default
- `tag-yellow` (#fbbf24) — Player 3 default
- `tag-green` (#16a34a) — Player 4 default
- `tag-purple` (#a855f7) — Player 5 default
- `tag-orange` (#f97316) — Player 6 default
- `tag-pink` (#ec4899) — Player 7 default
- `tag-cyan` (#06b6d4) — Player 8 default

Assignment: by `join_order` (Player 1 = red, etc.) — deterministic so re-joins keep same color.

### Action
- `{colors.goal}` (#e63946) — Primary CTA "ทายชื่อ" button. Same red as `tag-red` for visual consistency, but used here as semantic action color.
- `{colors.goal-active}` (#c1121f) — Pressed state.
- `{colors.goal-disabled}` (#7a1f26) — When player is foul/inactive.

### Text
- On dark: `on-dark` (#fafbfc), `on-dark-soft` (#9ca3af), `on-dark-muted` (#6b7280)
- On light: `on-light` (#0a0e1a), `on-light-soft` (#374151), `on-light-muted` (#6b7280)
- On player tag: ALWAYS `on-dark` (#fafbfc) — all 8 tag colors have sufficient contrast for white text

### Semantic
- `success` (#16a34a) — Correct guess feedback
- `warning` (#fbbf24) — Reconnecting banner
- `error` (#e63946) — Foul, network error, validation
- `info` (#1d4ed8) — Tooltips, hint text

### Contrast
- All text/background pairs meet WCAG AA (4.5:1 for body, 3:1 for large text)
- BIG NAME card: white text on saturated tag color → all 8 tags verified ≥4.5:1

## Spacing

### Base
4px base unit. Mobile-first, generous but not bloated.

### Scale
- `xxs` 4 / `xs` 8 / `sm` 12 / `md` 16 / `lg` 24 / `xl` 32 / `xxl` 48 / `section` 64

### Density
**Comfortable** — phones are small but BIG NAME needs full breathing room. Padding generous around hero, tighter around UI chrome (lobby lists, scoreboard rows).

## Layout

### Approach
**Single-purpose per screen** — every screen has ONE job, no scrolling on game screens. The BIG NAME card is the entire viewport. Lobby is a list. Results is a scoreboard.

### Grid
- Mobile only (320-480px width primary, 480-768px secondary)
- Single column always
- Max content width: 480px centered (for tablet/large phone)

### Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `{rounded.xs}` | 4px | Small inline badges |
| `{rounded.sm}` | 8px | Scoreboard tiles (broadcast-sharp) |
| `{rounded.md}` | 12px | Buttons, text inputs |
| `{rounded.lg}` | 16px | Player chips, content cards |
| `{rounded.xl}` | 24px | BIG NAME card (hero, generous) |
| `{rounded.pill}` | 9999px | Status chips, badges |

## Motion

### Approach
**Intentional sport-broadcast** — every motion serves comprehension or celebration. No decorative animation.

### Easing
- `ease-out` — entrance (fade in, slide in)
- `ease-in` — exit (fade out)
- `ease-in-out` — state transitions
- `ease-bounce` — celebration moments (correct guess pop, score flip)

### Duration
- `duration-instant` 50ms — haptic-paired flash (correct/wrong feedback)
- `duration-fast` 150ms — button press, hover state
- `duration-medium` 300ms — modal open/close, banner slide
- `duration-slow` 600ms — round transition, name reveal

### Specific Animations

**Correct guess** (when player taps "ทายชื่อ" and gets it right):
1. 50ms: green flash overlay on screen
2. 50ms: device haptic vibrate (50ms)
3. 300ms ease-out: BIG NAME card flips to show "✓ +N" with score
4. 300ms ease-bounce: confetti particles from card edges
5. 600ms: transition to "waiting for next round" state

**Foul** (wrong guess):
1. 50ms: red flash overlay
2. 100ms: device haptic vibrate (100ms double)
3. 200ms ease-in-out: BIG NAME card shake (3 oscillations, 8px amplitude)
4. 600ms: card grays out, "FOUL" overlay appears

**Score flip** (results screen):
- Numbers roll from old to new value over 600ms ease-in-out
- Tabular-nums alignment ensures no width jitter

**Round end celebration** (when round completes with high scores):
- "GOAL!" letter cascade from top, each letter 100ms apart, ease-bounce
- Stadium roar audio (optional, user-toggleable)

**Reconnecting banner**:
- Slides down from top in 300ms ease-out
- Pulses subtle 2-second cycle
- Slides up on reconnect

## Result Screens

The transient post-guess screen (`<GuessResult>`) routes off `round_state.is_correct` (DB row), NOT off `score_this_round`. Three visual variants share the same shell — radial overlay, big icon, big headline, divider, "คะแนนรอบนี้" pill, and the assigned-name reveal — and differ only in headline copy, accent color, icon, and the top-right pill.

### Correct (`is_correct=true` AND `score_this_round>0`)
- Headline: **"ทายถูก!"** (Bebas Neue 88px, `text-success`)
- Icon: 🎉 with `motion-safe:animate-hb-pop`
- Accent: `text-success` (#16a34a)
- Score pill: `+N pts` (green `+` prefix)
- Top-right slot: empty (rank is implicit in the +N)
- Wait copy: "รอผู้เล่นคนอื่น..." + "คะแนนรวม: N pts"

### Correct — no points (didn't make Top-N) (`is_correct=true` AND `score_this_round=0`)
Reuses the regular Correct layout — same green accent, same `motion-safe:animate-hb-pop` icon, same Correct waiting copy ("รอผู้เล่นคนอื่น..." + "คะแนนรวม: N pts"). The ONLY differences from Correct:
- Headline: **"ทายถูก แต่ช้าไป"** (TENTATIVE Thai copy — flag for human review before merge)
- Score pill: `+0 pts` (still green `+` prefix, same positive style as `+N pts`)

This variant fires when a player guessed the right name but a faster opponent already claimed all the Top-N slots. They guessed correctly — they just didn't score. Visually staying inside the Correct family is intentional: it tells the player "you got the answer, you just lost the race" rather than "you were wrong."

### Foul (`is_correct=false`)
- Headline: **"ทายผิด"** (Bebas Neue 88px, `text-goal`)
- Icon: 😩 (no animation)
- Accent: `text-goal` (#e63946)
- Score pill: `0 pts` (no `+` prefix)
- Top-right slot: total-score pill `{totalScore} pts` (goal color)
- Wait copy: "รอเล่นใหม่ในรอบหน้า" + "ผู้เล่นคนอื่นยังเล่นต่ออยู่"

### Shared behavior
- 8s auto-advance via `setTimeout`, identical across all three variants
- Tap anywhere skips to the scoreboard
- `localStorage` key `headball_last_result_seen_<roundStateId>_<playerId>` debounces on subsequent renders so the screen does not re-show after a refresh

### Error / fallback (`is_correct` missing/null)
The `selectGuessResultMode()` helper falls back to **Foul** if `is_correct` is null or undefined. This is a defensive choice: if the DB ever fails to write the boolean, showing Foul is closer to the conservative outcome than falsely celebrating a guess.

## Components — Insider additions (Phase 5d)

These five components were extracted into `@social-hub/ui` during Phase 5d to lock the visual contract for the Insider game and any future role-asymmetric / multi-tap / list-row screens. All five preserve the prior inline DOM byte-for-byte (same `data-testid`, same classes, same structure) so existing e2e selectors keep working.

### `role-badge`
Outlined pill used by Insider/Master/Common role-reveal screens (Screen 4). Anton 32px uppercase label, optional 18px Plex Thai caption above. Three variants:

- **`warning`** — yellow `#fbbf24` border + caption color. The Insider's high-stakes / hidden-role reveal.
- **`info`** — blue `#1d4ed8` border + caption color. The Master's judge reveal.
- **`neutral`** — hairline `#2a3146` border + soft caption (`text-on-dark-soft`). The Common player's plain reveal.

Reusable beyond Insider: any future role-asymmetric reveal (Mafia/Spy/Civilian, Werewolf/Villager) should reach for this primitive rather than re-inlining the div+span+span pile.

### `response-button`
Master's Yes / No / Unsure tap-target on Screen 6a (asking phase). 96px min-height, full-width via `flex-1`, three stacked spans (40px icon → 28px Thai display → 12px English caption). Three variants:

- **`success`** — `bg-success` (`#16a34a`). Yes / Affirmative.
- **`error`** — `bg-error` (`#e63946`). No / Negative.
- **`warning`** — `bg-warning` (`#fbbf24`). Unsure / Hedge.

Reusable for any future polarized-tap-to-answer screen.

### `response-feed-entry`
Non-interactive 44px list row used by the Insider asking-phase response feed (Screen 6b). Renders inside a `<ul>` rendered by the consumer. Layout is timestamp on the left (tabular-nums, 12px Plex Thai, soft color), then icon + 18px Anton uppercase EN label + optional `/ TH` subtext on the right. The consumer passes both `testId` (the row) and `timeTestId` (the timestamp) so existing `asking-other-feed-row` / `asking-other-feed-time` selectors keep working.

### `vote-target-card`
Voting-phase tap target on Screen 7. 120px tall, full-width, tag-color background driven by `joinOrder` (mirrors `player-chip`'s 8-color palette so a player carries the same tag-color across lobby and voting). Selected state: 4px goal-red ring with 2px ink offset + a 28px circular ✓ overlay anchored top-right. Per design decision **D6 (hidden tallies)** the card never shows per-player vote counts — only the group's progress lives outside this component. Anti-cheat: zero indication of who else has voted for whom.

### `pack-chip`
Selectable radio chip used by the Insider host-setup form (Screen 1). 64px min-height. Selected state: tag-color fill keyed by `joinIndex` (palette-aware text color: `text-on-dark` for most colors, `text-ink` for yellow/cyan). Unselected state: `surface-elevated` with hairline outline and an `active:bg-surface` press state. Carries proper accessibility semantics (`role="radio"` + `aria-checked`) — keyboard and screen readers see it as a real radio control. Headline is IBM Plex Thai display (16px uppercase); optional English subtitle is dimmed below.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-30 | Initial Stadium Energy design system | Created by /design-consultation. Memorable thing: "Liverpool winning Champions League final" |
| 2026-04-30 | Bebas Neue at 144px for BIG NAME | Phone-held-out UX requires readability from 1.5m distance |
| 2026-04-30 | Dark navy background default | Differentiates from bright casual game category, mimics floodlit stadium |
| 2026-04-30 | No mascot/illustration system | Player names ARE the content; illustrations would compete |
| 2026-04-30 | 8-color player tag palette | Each player ≤8 in MVP scope; deterministic by join_order |
| 2026-04-30 | IBM Plex Thai Looped + Sarabun fallback | Best Thai script legibility on small screens |
| 2026-04-30 | Correct-zero variant stays in Correct family | Issue #8: a non-top-N correct guess must not visually collapse to Foul. Same green accent + `+0 pts` pill, only the headline changes. |
| 2026-05-08 | Phase 5d component extraction (US-075…US-077) | Five Insider screens' inline JSX (role-reveal pill, master Yes/No/Unsure button block, asking-phase feed row, voting tap card, host-setup pack chip) extracted into `@social-hub/ui` as `role-badge`, `response-button`, `response-feed-entry`, `vote-target-card`, `pack-chip`. Snapshot tests per variant lock byte-for-byte DOM equivalence so existing e2e selectors keep working. Variants reuse Stadium Energy semantic tokens (warning/info/success/error/neutral + 8-color tag palette) — no new colors introduced. Reusable beyond Insider: future role-asymmetric reveal screens (Mafia/Spy/Civilian) and 3-option tap surfaces should reach for these primitives instead of re-inlining the patterns. |
| 2026-05-08 | Phase 5d component specs added to DESIGN.md (US-078) | Five components codified in both the YAML `components:` frontmatter (token-bound props, variant tables) and a prose `## Components — Insider additions` section (usage notes, variant semantics, reusability guidance). Decisions Log + Known Gaps refreshed accordingly. |

## Don'ts

- ❌ Don't use Inter, Roboto, Arial, Helvetica, Montserrat, Poppins, or Space Grotesk anywhere
- ❌ Don't use purple/violet gradients (AI slop pattern)
- ❌ Don't use 3-column SaaS card grid layouts
- ❌ Don't add mascots, claymation, illustrations, or character art
- ❌ Don't use Bebas Neue or Anton for body text or running paragraphs
- ❌ Don't use light mode as default — celebration screen only
- ❌ Don't add hover-only affordances (mobile has no hover)
- ❌ Don't use less than 44px tall touch targets (WCAG AAA mobile)
- ❌ Don't use less than 16px body text (mobile readability)
- ❌ Don't repeat the same player tag color twice in one room
- ❌ Don't break tabular-nums on score displays — alignment matters

## Known Gaps

- Stadium roar audio asset not yet sourced (royalty-free option needed)
- Confetti particle system implementation not specified (CSS-only vs canvas)
- Haptic API support varies on iOS Safari (graceful degradation needed)
- Bebas Neue at 144px on small screens (320px width) may need responsive scaling
- Print/PDF export not in scope
- Light celebration alt mode tokens defined but UX not yet wireframed
- Sound on/off toggle not yet specified in component vocabulary
- Insider reveal screen (Screen 8) animations — flip / confetti / score-roll — gated behind `prefers-reduced-motion: reduce` per US-073 contract; Phase 5d.5 will add the actual animations
- Insider asking-phase loading/empty/error/transition state coverage (Phase 5d.5)
- Insider a11y polish (Phase 5d.6) — focus rings over tag-color backgrounds, aria-live response feed, ARIA landmarks audit
