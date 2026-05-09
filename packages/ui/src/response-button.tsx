import type { ReactNode } from "react"

import { cn } from "./utils"

// US-076 / Phase 5d.2 — Response button: full-width tap target used by the
// Insider Master asking-phase Yes/No/Unsure controls and any future
// 3-option-tap-to-answer surface.
//
// Shape: ≥96px tall, flex-1 vertical, rounded-2xl, semantic-color filled
// background, three stacked spans (icon → Thai label → English caption).
// Variants:
//   success → bg-success  (Yes / Affirmative)
//   error   → bg-error    (No / Negative)
//   warning → bg-warning  (Unsure / Hedge)
//
// DOM is byte-for-byte identical to the prior inline implementation in
// `apps/insider/app/room/[code]/asking-master.tsx` so existing
// `master-respond-yes/no/unsure` e2e selectors keep working.

export type ResponseButtonVariant = "success" | "error" | "warning"

const VARIANT_BG: Record<ResponseButtonVariant, string> = {
  success: "bg-success",
  error: "bg-error",
  warning: "bg-warning",
}

export interface ResponseButtonProps {
  variant: ResponseButtonVariant
  icon: ReactNode
  labelTh: ReactNode
  labelEn: ReactNode
  disabled?: boolean
  onClick?: () => void
  testId?: string
  className?: string
  type?: "button" | "submit"
}

export function ResponseButton({
  variant,
  icon,
  labelTh,
  labelEn,
  disabled,
  onClick,
  testId,
  className,
  type = "button",
}: ResponseButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[96px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-6 text-on-dark transition-transform active:scale-[0.99] disabled:opacity-60",
        VARIANT_BG[variant],
        className,
      )}
    >
      <span className="font-hero text-[40px] leading-none">{icon}</span>
      <span className="font-display text-[28px] uppercase leading-none tracking-[1px]">
        {labelTh}
      </span>
      <span className="font-body text-[12px] uppercase tracking-[1px] opacity-80">
        {labelEn}
      </span>
    </button>
  )
}
