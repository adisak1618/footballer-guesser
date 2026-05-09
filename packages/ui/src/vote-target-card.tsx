"use client"

import { cn } from "./utils"

// US-061 / Phase 5b.6 — vote-target-card.
//
// Tap target on Screen 7 (Voting). Renders one player as a 120px-tall full
// tag-color card. Selected state = goal-red ring + ✓ icon overlay. Per D6
// no per-player vote tally is shown — only group progress lives outside this
// component. Anti-cheat: zero indication of who else has voted for whom.
//
// Tag-color follows the same join-order → palette mapping as PlayerChip so the
// tag-color a player carries in the lobby is consistent on the voting screen.

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
  3: "text-on-light",
  4: "text-on-dark",
  5: "text-on-dark",
  6: "text-on-dark",
  7: "text-on-dark",
  8: "text-on-dark",
}

export interface VoteTargetCardProps {
  joinOrder: number
  displayName: string
  selected: boolean
  disabled?: boolean
  testId?: string
  onTap: () => void
  className?: string
}

export function VoteTargetCard({
  joinOrder,
  displayName,
  selected,
  disabled = false,
  testId,
  onTap,
  className,
}: VoteTargetCardProps) {
  const idx = ((joinOrder - 1) % 8) + 1
  const bg = TAG_BG[idx] ?? "bg-tag-red"
  const text = TAG_TEXT[idx] ?? "text-on-dark"

  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      aria-label={`Vote ${displayName}`}
      disabled={disabled}
      onClick={onTap}
      className={cn(
        "relative flex min-h-[120px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-4 py-3 transition-transform active:scale-[0.99] disabled:opacity-60",
        bg,
        text,
        selected ? "ring-4 ring-goal ring-offset-2 ring-offset-ink" : "",
        className,
      )}
    >
      <span className="font-display text-[24px] uppercase leading-none tracking-[1px]">
        {displayName}
      </span>
      {selected ? (
        <span
          data-testid="vote-target-check"
          aria-hidden
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-goal text-on-dark"
        >
          ✓
        </span>
      ) : null}
    </button>
  )
}
