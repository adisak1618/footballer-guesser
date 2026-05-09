import type { ReactNode } from "react"

import { cn } from "./utils"

// US-077 / Phase 5d.3 — Response feed entry: non-interactive list row used by
// the Insider asking-phase response feed (Screen 6b). 44px tall, full-width,
// rendered inside a <ul> by the consumer. Timestamp on the left, icon + EN/TH
// labels on the right.
//
// Shape mirrors the prior inline implementation in
// `apps/insider/app/room/[code]/asking-other.tsx` so existing
// `asking-other-feed-row` / `asking-other-feed-time` testid selectors keep
// working when the consumer passes them through.

export interface ResponseFeedEntryProps {
  timestamp: ReactNode
  icon: ReactNode
  labelEn?: ReactNode
  labelTh?: ReactNode
  testId?: string
  timeTestId?: string
  className?: string
}

export function ResponseFeedEntry({
  timestamp,
  icon,
  labelEn,
  labelTh,
  testId,
  timeTestId,
  className,
}: ResponseFeedEntryProps) {
  return (
    <li
      data-testid={testId}
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2",
        className,
      )}
    >
      <span
        data-testid={timeTestId}
        className="font-body text-xs tabular-nums text-on-dark-soft"
      >
        {timestamp}
      </span>
      <span className="flex items-center gap-2 font-display text-[18px] uppercase leading-none tracking-[1px] text-on-dark">
        <span aria-hidden>{icon}</span>
        {labelEn ? <span>{labelEn}</span> : null}
        {labelTh ? (
          <span className="font-body text-xs text-on-dark-soft">
            / {labelTh}
          </span>
        ) : null}
      </span>
    </li>
  )
}
