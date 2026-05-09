import type { ReactNode } from "react"

import { cn } from "./utils"

// US-075 / Phase 5d.1 — Role badge: outlined pill used by Insider/Master/Common
// role-reveal screens. Anton 32px uppercase label; optional caption above.
// Variants:
//   warning → yellow #fbbf24 border + caption  (Insider)
//   info    → blue   #1d4ed8 border + caption  (Master)
//   neutral → hairline #2a3146 border + soft caption (Common)
//
// The variant tokens map to existing Stadium Energy theme colors:
//   warning  → border-warning  (var(--color-warning))
//   info     → border-info     (var(--color-info))
//   neutral  → border-hairline (var(--color-hairline))

export type RoleBadgeVariant = "warning" | "info" | "neutral"

const BORDER: Record<RoleBadgeVariant, string> = {
  warning: "border-warning",
  info: "border-info",
  neutral: "border-hairline",
}

const CAPTION_TEXT: Record<RoleBadgeVariant, string> = {
  warning: "text-warning",
  info: "text-info",
  neutral: "text-on-dark-soft",
}

export interface RoleBadgeProps {
  variant: RoleBadgeVariant
  label: ReactNode
  caption?: ReactNode
  testId?: string
  className?: string
}

export function RoleBadge({
  variant,
  label,
  caption,
  testId,
  className,
}: RoleBadgeProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border-2 bg-surface/50 px-4 py-4 text-center",
        BORDER[variant],
        className,
      )}
    >
      {caption ? (
        <span
          className={cn(
            "font-body text-[18px] tracking-[0.3px]",
            CAPTION_TEXT[variant],
          )}
        >
          {caption}
        </span>
      ) : null}
      <span className="font-display text-[32px] uppercase leading-none tracking-[1px] text-on-dark">
        {label}
      </span>
    </div>
  )
}
