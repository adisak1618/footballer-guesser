import type { ReactNode } from "react"

import { cn } from "./utils"

// US-079 / Phase 5d.5 — Empty player slot. Dashed-hairline placeholder used by
// the Insider lobby to indicate "this seat is open" so the room visually
// communicates min/max-player capacity without an explicit count caption.
//
// Mirrors PlayerChip's shape (rounded-2xl, min-h-14, padding) so when a real
// player joins the layout doesn't shift.

export interface EmptySlotProps {
  // 1-indexed slot number rendered in the avatar circle.
  index: number
  // Optional caption shown to the right of the avatar (defaults to a Thai
  // "open seat" hint).
  hint?: ReactNode
  testId?: string
  className?: string
}

export function EmptySlot({
  index,
  hint = "เปิดรับผู้เล่น",
  testId,
  className,
}: EmptySlotProps) {
  return (
    <li
      data-testid={testId ?? `empty-slot-${index}`}
      aria-label={`Open slot ${index}`}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-hairline bg-surface/40 px-4 py-3 text-on-dark-soft",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-hairline text-base font-semibold tabular-nums text-on-dark-muted"
      >
        {index}
      </span>
      <span className="text-sm font-medium tracking-[0.2px] text-on-dark-soft">
        {hint}
      </span>
    </li>
  )
}
