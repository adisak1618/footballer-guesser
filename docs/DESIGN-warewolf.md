# Warewolf — Grimoire Design System

> **Stadium Energy from `docs/DESIGN.md` does NOT apply to Warewolf.**
> Warewolf is **Grimoire** — parchment, ink, blood-red wax seals, Cormorant
> Garamond + Noto Serif Thai. Headball's Stadium Energy aesthetic (Bebas Neue,
> dark navy floodlight, jersey colors) is reserved for Headball.

This document is the single source of truth for every visual decision in
`apps/warewolf/`. Tokens here define the CSS variables; `apps/warewolf/app/globals.css`
mirrors them into Tailwind v4's `@theme inline` block. If the two ever
disagree, this doc wins — fix the CSS.

**Source artifacts (the prototype is the visual ground truth):**

- Interactive HTML prototype: `~/.gstack/projects/board-game/designs/warewolf-full-app-20260512/finalized.html`
- Approved wireframes (5):
  - `~/.gstack/projects/board-game/designs/warewolf-landing-20260512/`
  - `~/.gstack/projects/board-game/designs/warewolf-rules-20260512/`
  - `~/.gstack/projects/board-game/designs/warewolf-setup-picker-20260512/`
  - `~/.gstack/projects/board-game/designs/warewolf-variations-20260512/`
  - `~/.gstack/projects/board-game/designs/warewolf-customize-20260512/`
- Master design doc + Pass 1–7 decisions: `~/.gstack/projects/board-game/adisakchaiyakul-main-design-20260512-051400-werewolf-balance-tool.md`

---

## 1. Color palette

All hex values extracted from the prototype CSS block (`finalized.html:17–34`).
Semantic tokens are the names downstream code must use; mirrored 1:1 into
`apps/warewolf/app/globals.css` under `@theme inline`.

### Surfaces (parchment family)

| Semantic token | Hex | Use |
|---|---|---|
| `--color-parchment` | `#f5ecd6` | Page background. The "old paper" base. |
| `--color-parchment-soft` | `#f0e5c4` | Hover background on tiles + cards. |
| `--color-cream` | `#fbf4e0` | Card surface (off-cream). |
| `--color-cream-2` | `#e6dcc0` | Card border / divider rule. |

*Note on the earlier-doc `#f6ebd0` "off-cream cards" — superseded by the
prototype's `--cream: #fbf4e0`. Prototype is the visual ground truth (Pass 5
build step 0.5).*

### Ink (text family)

| Semantic token | Hex | Use |
|---|---|---|
| `--color-ink` | `#1a1612` | Primary body + display text. Near-black, warm. |
| `--color-ink-soft` | `#3a322a` | Secondary body text. |
| `--color-ink-muted` | `#5a4a36` | Subhead / caption text. |
| `--color-ink-faint` | `#9a8d6b` | Disabled state, watermarks, placeholder. |

### Accent (Grimoire blood)

| Semantic token | Hex | Use |
|---|---|---|
| `--color-blood` | `#8b1a1a` | Wax seal accent, focus ring, "red" balance state, danger. |
| `--color-blood-dim` | `#7a1818` | Pressed state for blood-accent interactions. |
| `--color-blood-bg` | `#f5d6d6` | Tinted background for blocker banners. |

### Status (verdict states for balance scale + banner)

| Semantic token | Hex | Use |
|---|---|---|
| `--color-green` | `#0f5132` | "Balanced" verdict ink. |
| `--color-green-bg` | `#dcf2e3` | "Balanced" banner background. |
| `--color-amber` | `#7a4d00` | Tilted-balance pointer color (caution, not blocker). |
| `--color-warn` | `#fbbf24` | Warning highlight. |
| `--color-warn-bg` | `#fdf0c4` | Warning banner background. |

> **Pointer color rule** (per design doc, pre-Pass-7 section on
> the balance scale): green inside the balanced band [−2..+2], **dark amber
> `#7a4d00`** when tilted outside the band but not a hard blocker, **blood-red
> `#8b1a1a`** when an actual blocker fires (`no-wolves`, `wolves-gte-village`,
> `role-count-mismatch`).

### Texture

- `--texture-grain: radial-gradient(rgba(120,90,40,.06) 1px, transparent 1px)`
  — subtle parchment grain overlay. Apply behind body, NOT on cards (cards
  stay clean cream).

### Dark mode

Grimoire is **light-only for V1** (Pass 6 decision). No `prefers-color-scheme:
dark` overrides. Dark-mode parchment-on-ink inversion is deferred to v2.

---

## 2. Typography

### Font stack

| Variable | Stack |
|---|---|
| `--font-serif` | `'Cormorant Garamond', serif` (Latin display + body) |
| `--font-serif-th` | `'Noto Serif Thai', serif` (Thai display + body) |
| `--font-ui` | `Inter, system-ui, sans-serif` (UI chrome, chips, micro labels) |

Body Latin and Thai serif are used independently — no bilingual side-by-side
rendering anywhere in shipped UI (reconciliation pass 2026-05-12). The
language toggle shows only the selected language.

### Type scale

Values match the prototype (`finalized.html:40–47`).
Sizes are mobile-floor; desktop scales up via `clamp()` only on display-xl.

| Token | px | Use |
|---|---|---|
| `--t-display-xl` | 48 | Hero / landing title, big archetype name on tiles. |
| `--t-display` | 32 | Page titles. |
| `--t-display-sm` | 26 | Subtitles, large-archetype labels on cards. |
| `--t-h` | 20 | Section heading (`h2`/`h3`). |
| `--t-body` | 16 | Default body copy. |
| `--t-body-sm` | 14 | Body floor (mobile minimum; Pass 6). Thai sublabels live here. |
| `--t-micro` | 13 | Chip labels, captions. Floor: 11px when explicitly scaled down. |

**Italics restriction (Pass 6):** italic Cormorant Garamond is restricted to
vibe quotes, decorative labels, role names in titles, and dropcaps. Body text
uses **upright** Cormorant Garamond regular for legibility.

**Touch + accessibility:**

- 44px minimum tap area on every interactive element (Pass 6). Visual size
  may be smaller; pad invisibly.
- Latin body floor 14px; Thai body floor 14px (NOT the 7–9px the early
  wireframe used for chip Thai sublabels — Pass 6 raised these).

---

## 3. Spacing scale

Values from the prototype `--s-1..--s-6`.

| Token | px |
|---|---|
| `--s-1` | 4 |
| `--s-2` | 8 |
| `--s-3` | 12 |
| `--s-4` | 16 |
| `--s-5` | 24 |
| `--s-6` | 32 |

Use these directly; do not invent new values. If a layout needs more than
32px, double a token (`calc(var(--s-6) * 2)` → 64px) rather than introducing
`--s-7`.

### Borders + radius

| Token | Value |
|---|---|
| `--b` | `1px solid var(--color-ink)` — default rule (cards, tiles, dividers). |
| `--b-thick` | `1.5px solid var(--color-ink)` — emphasized border (selected state). |
| `--b-soft` | `1px dashed rgba(26,22,18,.3)` — soft separator inside cards. |
| `--r-1` | 2px corner radius (chips, micro elements). |
| `--r-2` | 4px corner radius (cards, tiles, modals). |

No pill / fully-rounded shapes — Grimoire wants paper edges, not rubber.

---

## 4. Component vocabulary

Each component is one paragraph; full prop tables live in the implementing
story (US-013 onward). Names are the contract — don't rename in code.

- **Button** — flat parchment with 1px ink border, ink ink, hover darkens to
  `--color-parchment-soft`. Primary action (Open Setup, Save, Copy URL) uses
  blood-red text + 1.5px ink border. Disabled state: `--color-ink-faint` text,
  no border darken. 44px min tap height.

- **Card** — cream surface (`--color-cream`), 1px ink border (`--b`), 4px
  radius (`--r-2`), 16–24px internal padding (`--s-4`..`--s-5`). Used for
  setup-list items, archetype tiles, role detail blocks.

- **Modal / Sheet** — full-screen on mobile (slides up from bottom, 280ms
  with `cubic-bezier(.16,1,.3,1)`); inline panel on desktop ≥1024px (Pass 6:
  customize page becomes 2-column with sticky role-detail panel on the right
  replacing the modal). Background is `--color-cream`; backdrop overlay is
  `rgba(26,22,18,.5)`.

- **Banner** — single-line `glyph · VERDICT · reason`. Background tinted per
  state (`--color-green-bg`, `--color-warn-bg`, `--color-blood-bg`). Reason
  text ellipses on overflow; verdict + glyph never truncate. Banner state
  changes fade 200ms ease-in-out.

- **Balance scale** — 42px circular pointer slides along a horizontal axis.
  Wolves anchor LEFT (negative), Village anchor RIGHT (positive) — names the
  threat first, matches Grimoire mood (Pass 1). Pointer animates 200ms
  ease-out. Side sums render at 30px italic Cormorant; banner verdict 17px.
  `aria-live="polite"` so screen readers announce updates.

- **Tile** — archetype picker and setup-list item base. Cream card with the
  archetype's wax seal centered, archetype name in 26–32px serif underneath,
  vibe quote 13–14px italic ink-muted. Tap → 200ms scale 0.97 + opacity 0.85
  (Pass 3). Hover (desktop) → background shifts to `--color-parchment-soft`.

- **Ornament frame** — decorative 4-corner ornament around hero blocks on the
  landing page. Pure CSS borders + corner glyphs (`✦` or fleuron); no images.

- **Role detail block** — inside the customize-page side panel (desktop) or
  bottom sheet (mobile). Wax-seal team icon at top, role name in serif title,
  Thai sublabel, ability copy in upright Cormorant body, then category tab
  pill, then "Replace" CTA.

---

## 5. Iconography

### Wax seals

- **Set:** ~34 single-color blood-red wax seal glyphs total: 8 archetype + 4
  team + 22 role.
- **V1 placeholder:** Unicode glyphs (e.g. `𓁹`, `⚷`, `✿`) inline in
  copy. The Pass 4 design doc note ("**bespoke SVG commission required**")
  is **deferred to v1.1**. V1 ships with Unicode + a clear
  `// TODO: bespoke wax-seal SVG (Pass 4 commission)` comment in
  `apps/warewolf/components/WaxSeal.tsx` when that component lands.
- **Style spec for the eventual SVG commission:** single-color
  `--color-blood`, 1.5px stroke weight matching `--b-thick`, 32×32 viewBox.
- **No emoji-as-design-element** anywhere in shipped UI (Pass 4). Unicode
  symbols are acceptable only where they read as a wax-seal substitute, not
  as expressive emoji.

### Fleurons

- Use `*` as the inline fleuron separator inside body copy (e.g.
  `Setup 1 ∗ +1 BALANCED ∗ 12 players`). Render in `--color-ink-faint`.
- Decorative section dividers use a 3-glyph fleuron row centered between
  sections: `❦  ✦  ❦`.

### Ornament dots

Use `•` (U+2022) for inline list bullets and `·` (U+00B7) for inline
separators inside compact metadata strings. Both render in
`--color-ink-muted`.

---

## 6. Motion language

Full timing table per Pass 7. All durations collapse to **0ms** under
`@media (prefers-reduced-motion: reduce)`.

| Transition | Duration | Easing | Reduced-motion |
|---|---|---|---|
| Balance scale pointer slide | 200ms | `cubic-bezier(0.2, 0, 0.2, 1)` (ease-out) | 0ms |
| Modal slide-up (mobile) | 280ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 0ms |
| Sheet slide-up (mobile) | 280ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 0ms |
| Tile press feedback | 150ms | `ease-out` | 0ms |
| Fade transitions (banner state change) | 200ms | `ease-in-out` | 0ms |
| Page route transitions | none (instant) | n/a | n/a |
| Card-fan idle animation (landing) | none (static) V1 | n/a | 0ms |

### CSS variable bindings

| Token | Value | Maps to |
|---|---|---|
| `--motion-fast` | `150ms ease-out` | Tile press, button press. |
| `--motion-med` | `200ms cubic-bezier(.2,0,.2,1)` | Balance pointer, banner fade. |
| `--motion-slide` | `280ms cubic-bezier(.16,1,.3,1)` | Modal/sheet slide-up. |

Under `prefers-reduced-motion: reduce`, redefine all three to `0ms` plus a
global `*{ animation-duration:0ms !important; transition-duration:0ms !important }`
override (mirrors the prototype lines 73–76).

---

## 7. Focus + accessibility

- **Focus ring:** 2px `--color-blood` outline at 2px offset, OUTSIDE the
  element (Pass 3 + Pass 6). Use `outline-offset: 2px; outline: 2px solid
  var(--color-blood)` — do not use `box-shadow` (clips at borders).
- **Landmarks:** `<header>`, `<main>`, `<nav>` on every page (Pass 6).
- **`aria-label`** on every icon-only button.
- **`aria-live="polite"`** on the balance scale, Playable banner, and toast.
- **Keyboard nav:** Tab moves top-to-bottom + left-to-right within sections.
  Enter / Space activates buttons + tiles. Escape closes modal/sheet. Arrow
  keys navigate inside sheets and the customize grid.

---

## 8. Mirror to `apps/warewolf/app/globals.css`

US-009 mirrors all `--color-*`, `--font-*`, `--t-*`, `--s-*`, `--b*`, `--r-*`,
`--motion-*`, and `--texture-grain` tokens above into Tailwind v4's
`@theme inline` block of `apps/warewolf/app/globals.css`. Variable names MUST
match this doc 1:1 so a future audit can `grep` either file and find the
other.

Tailwind v4 does NOT yet support cross-package `@theme` imports (see
CLAUDE.md "Adding a new app" note), so the tokens are copy-pasted, not
imported. When this doc changes, US-009's `globals.css` must change in
lockstep — both files are the source of truth in different audiences (this
doc for humans, the CSS for the compiler).
