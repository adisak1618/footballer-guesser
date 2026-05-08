import { cn } from "./utils"

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

export interface PlayerChipProps {
  joinOrder: number
  displayName: string
  isMe?: boolean
  className?: string
}

export function PlayerChip({
  joinOrder,
  displayName,
  isMe = false,
  className,
}: PlayerChipProps) {
  const idx = ((joinOrder - 1) % 8) + 1
  const bg = TAG_BG[idx] ?? "bg-tag-red"
  const text = TAG_TEXT[idx] ?? "text-on-dark"

  return (
    <li
      aria-label={`Player ${displayName}${isMe ? " (คุณ)" : ""}, join order ${joinOrder}`}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3",
        bg,
        text,
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-base font-semibold tabular-nums text-on-dark"
      >
        {joinOrder}
      </span>
      <span className="text-base font-semibold tracking-[0.2px]">
        {displayName}
        {isMe ? (
          <span className="ml-2 text-xs font-medium uppercase tracking-[0.3px] opacity-80">
            (คุณ)
          </span>
        ) : null}
      </span>
    </li>
  )
}
