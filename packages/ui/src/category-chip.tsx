"use client"

import type { ReactNode } from "react"

import { cn } from "./utils"

// Selectable radio-chip used by the lobby category picker (formerly "pack" —
// issue #27 renamed user-facing strings to "category"; DB column stays
// `pack_slug`, so the `pack-chip-<slug>` test-id format is preserved for
// existing e2e selectors). Selected = tag-color fill + shadow; unselected =
// surface-elevated + hairline outline.

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

export interface CategoryChipProps {
  joinIndex: number
  label: ReactNode
  subLabel?: ReactNode
  selected: boolean
  disabled?: boolean
  onTap: () => void
  testId?: string
  className?: string
}

export function CategoryChip({
  joinIndex,
  label,
  subLabel,
  selected,
  disabled = false,
  onTap,
  testId,
  className,
}: CategoryChipProps) {
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
