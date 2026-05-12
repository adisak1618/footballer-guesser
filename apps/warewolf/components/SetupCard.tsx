"use client"

/**
 * <SetupCard> — one row in the /setup list. Each card represents an
 * (archetype × variation) recommendation produced by `computeSetupList`
 * (lib/solver.ts, US-005). Tapping the card fires `onTap(setup)` so the
 * parent route can navigate to /setup/customize with that setup
 * pre-loaded (reconciliation: "re-roll" and "open selected" affordances
 * were removed; tap = open directly).
 *
 * Visual contract: design doc lines 484–499 + prototype `.variation-card`
 * rules at `finalized.html:253–288`. Verdict copy per Pass 1:
 *   |balance| ≤ 2   → BALANCED
 *   balance > 2     → VILLAGE TILT
 *   balance < -2    → WOLF TILT
 *
 * `lang` defaults to 'en' so the component renders without an
 * `<IntlProvider>` wrapper in unit tests; the /setup page wires it from
 * next-intl's `useLocale()`. Only the selected language renders inside
 * the card — no bilingual stacking.
 *
 * Tap target ≥ 44px (the whole card is the button). Tap visual uses
 * inline CSS variables for scale + opacity; the global
 * `@media (prefers-reduced-motion: reduce)` rule in globals.css zeros
 * out `--motion-fast` and `--motion-med`, neutralizing the press
 * animation automatically.
 */

import { ARCHETYPES } from "../lib/archetypes"
import { ROLES, type RoleId } from "@social-hub/content"
import type { Setup } from "../lib/solver"
import { RoleCardThumb } from "./RoleCardThumb"

export interface SetupCardProps {
  setup: Setup
  onTap: (setup: Setup) => void
  /** Resolved by caller via next-intl. Defaults to 'en'. */
  lang?: "en" | "th"
}

interface RoleGroup {
  id: RoleId
  count: number
}

function groupRoles(roles: RoleId[]): RoleGroup[] {
  const groups: RoleGroup[] = []
  for (const id of roles) {
    const last = groups[groups.length - 1]
    if (last && last.id === id) last.count += 1
    else groups.push({ id, count: 1 })
  }
  return groups
}

function countTeams(roles: RoleId[]): { wolf: number; village: number; neutral: number } {
  let wolf = 0
  let village = 0
  let neutral = 0
  for (const id of roles) {
    const r = ROLES[id]
    if (!r) continue
    if (r.team === "werewolf") wolf += 1
    else if (r.team === "village") village += 1
    else neutral += 1
  }
  return { wolf, village, neutral }
}

function verdictFor(balance: number): {
  key: "balanced" | "village-tilt" | "wolf-tilt"
  label: string
  color: string
} {
  if (balance >= -2 && balance <= 2) {
    return { key: "balanced", label: "BALANCED", color: "var(--color-green)" }
  }
  if (balance > 2) {
    return { key: "village-tilt", label: "VILLAGE TILT", color: "var(--color-ink)" }
  }
  return { key: "wolf-tilt", label: "WOLF TILT", color: "var(--color-blood)" }
}

export function SetupCard({ setup, onTap, lang = "en" }: SetupCardProps) {
  const arch = ARCHETYPES[setup.archetypeId]
  const counts = countTeams(setup.roles)
  const verdict = verdictFor(setup.balance)
  const groups = groupRoles(setup.roles)
  const signedBalance = setup.balance > 0 ? `+${setup.balance}` : String(setup.balance)
  const vibe = setup.vibe[lang]
  const teamSummary =
    counts.neutral > 0
      ? `${counts.wolf}W : ${counts.village}V : ${counts.neutral}N`
      : `${counts.wolf}W : ${counts.village}V`

  return (
    <button
      type="button"
      data-testid="setup-card"
      data-archetype={setup.archetypeId}
      data-variation={setup.variationIdx}
      onClick={() => onTap(setup)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        border: "var(--b)",
        background: "var(--color-cream)",
        padding: "var(--s-3)",
        marginBottom: "var(--s-3)",
        position: "relative",
        cursor: "pointer",
        minHeight: 44,
        transition:
          "transform var(--motion-fast), opacity var(--motion-fast)",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)"
        e.currentTarget.style.opacity = "0.85"
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.opacity = ""
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.opacity = ""
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = "scale(0.97)"
        e.currentTarget.style.opacity = "0.85"
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.opacity = ""
      }}
    >
      {/* Archetype label: seal + name + roman numeral */}
      <div
        data-testid="setup-card-arch"
        style={{
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: "var(--t-micro)",
          color: "var(--color-blood)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        <span data-testid="setup-card-seal" aria-hidden="true" style={{ paddingRight: 2 }}>
          {arch.seal}
        </span>{" "}
        <span data-testid="setup-card-name">{arch.i18n[lang].name}</span>
        {" · "}
        <span data-testid="setup-card-roman">{setup.roman}</span>
      </div>

      {/* Vibe + balance head */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--s-2)",
          marginBottom: 8,
        }}
      >
        <div
          data-testid="setup-card-vibe"
          style={{
            flex: 1,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "var(--t-body)",
            color: "var(--color-ink-soft)",
            lineHeight: 1.4,
          }}
        >
          &ldquo;{vibe}&rdquo;
        </div>
        <div
          style={{
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            flexShrink: 0,
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          <span data-testid="setup-card-balance">{signedBalance}</span>
          <span
            data-testid="setup-card-verdict"
            data-state={verdict.key}
            style={{
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: 9,
              color: verdict.color,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            {verdict.label}
          </span>
        </div>
      </div>

      {/* Role card strip — variant A "Mini Card Strip", approved 2026-05-13 */}
      <div
        data-testid="setup-card-strip"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          rowGap: 12,
          marginBottom: 6,
          paddingTop: 4,
        }}
      >
        {groups.map((g) => (
          <RoleCardThumb
            key={g.id}
            roleId={g.id}
            count={g.count}
            lang={lang}
          />
        ))}
      </div>

      {/* Serif italic name-strip fallback — visible for sighted users and
          read by AT users alongside the per-card aria-labels. */}
      <div
        data-testid="setup-card-names"
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "var(--t-micro)",
          color: "var(--color-ink-muted)",
          lineHeight: 1.4,
          marginBottom: 4,
        }}
      >
        {groups
          .map((g) => {
            const role = ROLES[g.id]
            if (!role) return null
            return role.i18n[lang].name + (g.count > 1 ? ` ×${g.count}` : "")
          })
          .filter(Boolean)
          .join("  ·  ")}
      </div>

      {/* Team counts + tap affordance */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
        }}
      >
        <span
          data-testid="setup-card-teams"
          style={{
            font: "500 var(--t-micro)/1 var(--font-ui), sans-serif",
            color: "var(--color-ink-muted)",
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {teamSummary}
        </span>
        <span
          data-testid="setup-card-pick"
          aria-hidden="true"
          style={{
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-body-sm)",
            color: "var(--color-blood)",
          }}
        >
          {lang === "th" ? "ปรับแต่ง ▸" : "Customize ▸"}
        </span>
      </div>
    </button>
  )
}
