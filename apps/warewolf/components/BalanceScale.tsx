/**
 * <BalanceScale> — the meter at the top of /setup/customize that shows
 * wolfSum on the LEFT, villageSum on the RIGHT, and a pointer at a position
 * derived from balance.
 *
 * Pointer color (per US-014 + design doc Pass 1 motion table):
 *   - GREEN  when balance ∈ [-2, +2] AND !hasBlocker  (state="balanced")
 *   - AMBER  when balance ∉ [-2, +2] AND !hasBlocker  (state="tilt")
 *   - RED    when hasBlocker===true (regardless of balance) (state="blocked")
 *
 * Pointer transition uses `--motion-med` (200ms) which is overridden to 0ms
 * inside `@media (prefers-reduced-motion: reduce)` in globals.css. Layout
 * mirrors prototype `finalized.html:130–148` exactly (wolves L, village R).
 */

const POINTER_AMBER = "#7a4d00"
const POINTER_RED = "#8b1a1a" // var(--color-blood)

function pointerPercent(balance: number): number {
  const clamped = Math.max(-15, Math.min(15, balance))
  return 50 + (clamped / 15) * 45
}

function pointerState(balance: number, hasBlocker: boolean): "balanced" | "tilt" | "blocked" {
  if (hasBlocker) return "blocked"
  if (balance >= -2 && balance <= 2) return "balanced"
  return "tilt"
}

function pointerBg(state: "balanced" | "tilt" | "blocked"): string {
  if (state === "balanced") return "var(--color-green)"
  if (state === "tilt") return POINTER_AMBER
  return POINTER_RED
}

export interface BalanceScaleProps {
  wolfSum: number
  villageSum: number
  balance: number
  hasBlocker: boolean
}

export function BalanceScale({ wolfSum, villageSum, balance, hasBlocker }: BalanceScaleProps) {
  const state = pointerState(balance, hasBlocker)
  const leftPct = pointerPercent(balance)
  const signedBalance = balance > 0 ? `+${balance}` : String(balance)
  const villageLabel = villageSum >= 0 ? `+${villageSum}` : String(villageSum)
  const wolfLabel = wolfSum > 0 ? `+${wolfSum}` : String(wolfSum)

  return (
    <div
      data-testid="balance-scale"
      aria-live="polite"
      style={{
        background: "var(--color-cream)",
        borderTop: "var(--b)",
        borderBottom: "var(--b)",
        padding: "var(--s-4) var(--s-4)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
        {/* Wolves — LEFT (Pass 1: name the threat first) */}
        <div data-side="wolf" style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--color-blood)",
            }}
          >
            Wolf Team
          </div>
          <div
            style={{
              font: "500 12px/1.2 var(--font-serif-th)",
              color: "var(--color-ink-muted)",
              marginTop: 2,
            }}
          >
            หมาป่า
          </div>
          <div
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 30,
              marginTop: 4,
              lineHeight: 1,
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {wolfLabel}
          </div>
        </div>

        {/* Meter */}
        <div style={{ flex: 2, height: 50, position: "relative" }}>
          {/* Center balanced zone (-2..+2) */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              height: 14,
              background: "rgba(22,163,74,.22)",
              left: "38%",
              right: "38%",
              borderRadius: 2,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 3,
              background: "var(--color-ink)",
              transform: "translateY(-50%)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {[
              "tick",
              "tick",
              "zone-edge",
              "tick",
              "mid",
              "tick",
              "zone-edge",
              "tick",
              "tick",
            ].map((kind, i) => (
              <span
                key={i}
                style={{
                  width: 2,
                  height: kind === "mid" ? 22 : kind === "zone-edge" ? 14 : 10,
                  background: "var(--color-ink)",
                  opacity: kind === "mid" ? 1 : kind === "zone-edge" ? 0.6 : 0.3,
                }}
              />
            ))}
          </div>
          <div
            data-testid="balance-pointer"
            data-state={state}
            style={{
              position: "absolute",
              top: "50%",
              left: `${leftPct}%`,
              transform: "translate(-50%, -50%)",
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: pointerBg(state),
              border: "3px solid var(--color-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-cream)",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 18,
              transition: "left var(--motion-med), background var(--motion-med)",
              boxShadow: "0 2px 6px rgba(0,0,0,.25)",
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {signedBalance}
          </div>
        </div>

        {/* Village — RIGHT */}
        <div data-side="village" style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--color-ink)",
            }}
          >
            Village Team
          </div>
          <div
            style={{
              font: "500 12px/1.2 var(--font-serif-th)",
              color: "var(--color-ink-muted)",
              marginTop: 2,
            }}
          >
            ชาวบ้าน
          </div>
          <div
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 30,
              marginTop: 4,
              lineHeight: 1,
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {villageLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
