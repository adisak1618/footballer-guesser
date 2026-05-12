/**
 * <PlayableBanner> — the verdict banner under <BalanceScale> on
 * /setup/customize. Single-line layout: `glyph · VERDICT · reason`
 * (per design doc Reconciliation pass).
 *
 * State styling mirrors prototype `finalized.html:151–159`:
 *   - playable     → green background, ✓ glyph, "PLAYABLE · เล่นได้"
 *   - not-playable → red background,   ✕ glyph, "NOT PLAYABLE · เล่นไม่ได้"
 *   - warn         → yellow background, ! glyph (reserved — currently unused)
 *
 * The reason text ellipses on overflow; verdict + glyph never wrap.
 */

export type PlayableBannerState = "playable" | "not-playable" | "warn"

interface BannerVisual {
  glyph: string
  verdictEn: string
  verdictTh: string
  borderColor: string
  background: string
  color: string
  reasonColor: string
}

const VISUALS: Record<PlayableBannerState, BannerVisual> = {
  playable: {
    glyph: "✓",
    verdictEn: "PLAYABLE",
    verdictTh: "เล่นได้",
    borderColor: "var(--color-green)",
    background: "var(--color-green-bg)",
    color: "var(--color-green)",
    reasonColor: "var(--color-ink)",
  },
  "not-playable": {
    glyph: "✕",
    verdictEn: "NOT PLAYABLE",
    verdictTh: "เล่นไม่ได้",
    borderColor: "var(--color-blood)",
    background: "var(--color-blood-bg)",
    color: "var(--color-blood)",
    reasonColor: "#5a1818",
  },
  warn: {
    glyph: "!",
    verdictEn: "WARNING",
    verdictTh: "ระวัง",
    borderColor: "var(--color-warn)",
    background: "var(--color-warn-bg)",
    color: "#7a4d00",
    reasonColor: "#5a3700",
  },
}

export interface PlayableBannerProps {
  state: PlayableBannerState
  reason: string
}

export function PlayableBanner({ state, reason }: PlayableBannerProps) {
  const v = VISUALS[state]
  return (
    <div
      data-testid="playable-banner"
      data-state={state}
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-2)",
        marginTop: "var(--s-3)",
        padding: "8px 12px",
        border: `2px solid ${v.borderColor}`,
        background: v.background,
        color: v.color,
        minHeight: 44,
        transition:
          "background var(--motion-med), border-color var(--motion-med), color var(--motion-med)",
      }}
    >
      <div
        data-testid="playable-banner-glyph"
        style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
      >
        {v.glyph}
      </div>
      <div
        data-testid="playable-banner-verdict"
        style={{
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: ".02em",
          lineHeight: 1.1,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {v.verdictEn} · {v.verdictTh}
      </div>
      <span
        data-testid="playable-banner-sep"
        aria-hidden="true"
        style={{ color: "inherit", opacity: 0.5, fontWeight: 400, flexShrink: 0 }}
      >
        ·
      </span>
      <div
        data-testid="playable-banner-reason"
        style={{
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 14,
          color: v.reasonColor,
          opacity: state === "playable" ? 0.85 : 1,
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {reason}
      </div>
    </div>
  )
}
