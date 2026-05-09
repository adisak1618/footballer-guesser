"use client"

import type { ReactNode } from "react"

import { cn } from "./utils"

// US-077 / Phase 5d.3 — Pack chip: selectable radio-chip used by the Insider
// host-setup form (Screen 1) for picking a word pack. When selected the chip
// fills with a tag-color background; when unselected it shows a hairline
// outline on surface-elevated. Plex Thai display label as the headline; the
// optional English subtitle is dimmed.
//
// DOM mirrors the prior inline implementation in
// `apps/insider/app/new/host-setup-form.tsx` so the existing
// `pack-chip-<slug>` testid + `radio` semantics + transitions are preserved.

const TAG_BG: Record<number, string> = {
  1: "bg-tag-red",
  2: "bg-tag-blue",
  3: "bg-tag-yellow",
  4: "bg-tag-green",
  5: "bg-tag-purple",
  6: "bg-tag-orange",
  7: "bg-tag-pink",
  8: "bg-tag-cyan",
}

const TAG_TEXT: Record<number, string> = {
  1: "text-on-dark",
  2: "text-on-dark",
  3: "text-ink",
  4: "text-on-dark",
  5: "text-on-dark",
  6: "text-on-dark",
  7: "text-on-dark",
  8: "text-ink",
}

export interface PackChipProps {
  joinIndex: number
  label: ReactNode
  subLabel?: ReactNode
  selected: boolean
  disabled?: boolean
  onTap: () => void
  testId?: string
  className?: string
}

export function PackChip({
  joinIndex,
  label,
  subLabel,
  selected,
  disabled = false,
  onTap,
  testId,
  className,
}: PackChipProps) {
  const idx = (joinIndex % 8) + 1
  const bg = TAG_BG[idx] ?? "bg-tag-red"
  const text = TAG_TEXT[idx] ?? "text-on-dark"

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onTap}
      data-testid={testId}
      className={cn(
        "min-h-16 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60",
        selected
          ? cn(bg, text, "border-transparent shadow-md")
          : "border-hairline bg-surface-elevated text-on-dark active:bg-surface",
        className,
      )}
    >
      <span className="block font-display text-base uppercase tracking-[0.5px]">
        {label}
      </span>
      {subLabel ? (
        <span
          className={cn(
            "block text-xs",
            selected ? "opacity-90" : "text-on-dark-soft",
          )}
        >
          {subLabel}
        </span>
      ) : null}
    </button>
  )
}
