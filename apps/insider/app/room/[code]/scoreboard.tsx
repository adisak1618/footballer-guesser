"use client"

import { useMemo } from "react"

// Issue #17 — shared scoreboard surface for the round-end reveal screen and
// the final-results screen.
//
// Visual contract (Stadium Energy / docs/DESIGN.md):
//   - LEADER (or co-leader on tie) renders as a BIG NAME card: Bebas Neue at
//     scoreboard scale (140px) in the leader's jersey color, score below in
//     score-md.
//   - Supporting cast: row list, Bebas Neue numerals on the right with a
//     small jersey-color dot prefix on the left, names in body type.
//   - Tie state: BIG NAME slot shrinks to fit two-or-more co-winners with a
//     'TIE / เสมอ' label above. Font scales down per number of co-winners
//     so two names sit side-by-side, three or more stack vertically.
//
// Loading + error states drive the bottom CTA's affordance, not the BIG
// NAME card itself — the card always shows the latest known leaderboard
// even while a re-tally is in flight.

const TAG_COLORS = [
  "red",
  "blue",
  "yellow",
  "green",
  "purple",
  "orange",
  "pink",
  "cyan",
] as const

function tagColorFor(joinOrder: number): string {
  const idx = ((joinOrder - 1) % TAG_COLORS.length + TAG_COLORS.length) % TAG_COLORS.length
  return TAG_COLORS[idx]!
}

export interface ScoreboardPlayer {
  id: string
  player_id: string
  display_name: string
  join_order: number
  total_score: number
}

interface ScoreboardProps {
  players: ScoreboardPlayer[]
  /** Visual mode: round-end shows "LEADER", final-results shows "WINNER". */
  variant: "round-end" | "final"
  /** Light shell (caught) needs dark text; dark shell (escaped, time-up) flips. */
  surface: "light" | "dark"
}

export function Scoreboard({ players, variant, surface }: ScoreboardProps) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score),
    [players],
  )

  // Top score determines the hero set (one or more co-leaders on a tie).
  const topScore = sorted[0]?.total_score ?? 0
  const heroes = sorted.filter((p) => p.total_score === topScore)
  const supportingCast = sorted.filter((p) => p.total_score !== topScore)
  const isTie = heroes.length >= 2
  const sectionLabel = variant === "final" ? "FINAL SCORE" : "SCOREBOARD"
  const heroLabel =
    variant === "final"
      ? isTie
        ? "TIE / เสมอ"
        : "WINNER / ผู้ชนะ"
      : isTie
        ? "TIE / เสมอ"
        : "LEADER / ผู้นำ"

  // Hero font shrinks as more co-winners share the slot — keeps the card
  // legible without horizontal overflow on a 480px container.
  // 1 hero  → 140px (max for a tight 1.5m read)
  // 2 heroes → 88px stacked
  // 3+      → 56px stacked
  const heroFontPx = heroes.length === 1 ? 140 : heroes.length === 2 ? 88 : 56

  const labelTextClass =
    surface === "light" ? "text-on-light-soft" : "text-on-dark-soft"
  const cardBorderClass =
    surface === "light" ? "border-on-light/10" : "border-hairline"
  const cardBgClass =
    surface === "light" ? "bg-surface-card" : "bg-surface"
  const rowTextClass =
    surface === "light" ? "text-on-light" : "text-on-dark"
  const rowSoftTextClass =
    surface === "light" ? "text-on-light-soft" : "text-on-dark-soft"

  return (
    <section className="flex flex-col gap-3" data-testid="round-scoreboard">
      <p className={`font-display text-[12px] uppercase tracking-[2px] text-center ${labelTextClass}`}>
        ── {sectionLabel} ──
      </p>

      {/* BIG NAME hero card — leader (or co-leaders) in their jersey color.
          Tailwind class is built from the literal jersey palette below so the
          v4 content scanner picks up all 8 bg-tag-* variants statically. */}
      <div
        data-testid="scoreboard-hero-card"
        data-tie={isTie ? "true" : "false"}
        className={`relative flex flex-col items-center gap-2 rounded-2xl px-4 py-6 text-on-dark ${
          heroes[0] ? `bg-tag-${tagColorFor(heroes[0].join_order)}` : "bg-surface"
        }`}
      >
        <p className="font-display text-[12px] uppercase tracking-[2px] text-on-dark/80">
          {heroLabel}
        </p>
        <div className="flex w-full flex-col items-center gap-1">
          {heroes.map((hero) => (
            <p
              key={hero.id}
              data-testid={`scoreboard-hero-name-${hero.player_id}`}
              className="font-hero leading-[0.95] tracking-[1px] text-on-dark"
              style={{ fontSize: `${heroFontPx}px` }}
            >
              {hero.display_name.toUpperCase()}
            </p>
          ))}
        </div>
        <p
          data-testid="scoreboard-hero-score"
          className="font-hero text-[40px] leading-none tabular-nums text-on-dark/95"
        >
          {topScore} pts
        </p>
      </div>

      {/* Supporting cast — row list with jersey-color accent dot + score. */}
      {supportingCast.length > 0 ? (
        <ul
          aria-label="Supporting cast scoreboard"
          data-testid="scoreboard-row-list"
          className="flex flex-col gap-1.5"
        >
          {supportingCast.map((p, idx) => {
            const tag = tagColorFor(p.join_order)
            return (
              <li
                key={p.id}
                data-testid={`scoreboard-row-${p.player_id}`}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${cardBorderClass} ${cardBgClass}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`inline-block h-2.5 w-2.5 rounded-full bg-tag-${tag}`}
                  />
                  <span className={`font-display text-[14px] tracking-[0.5px] uppercase ${rowSoftTextClass}`}>
                    {heroes.length + idx + 1}.
                  </span>
                  <span className={`font-body text-[14px] font-medium ${rowTextClass}`}>
                    {p.display_name}
                  </span>
                </span>
                <span className={`font-hero text-[24px] tabular-nums ${rowTextClass}`}>
                  {p.total_score}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
