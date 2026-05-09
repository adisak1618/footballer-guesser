import type { ReactNode } from "react"

import { cn } from "./utils"

// US-079 / Phase 5d.5 — Phase-shape loading skeleton.
//
// Renders the same overall shell shape (header phase tag + body block + caption)
// as a real Insider screen while its primary data is fetching, so the eye lands
// in the right place when the content swaps in. The shimmer is implemented as
// `motion-safe:animate-pulse` so reduced-motion users see static placeholders
// (per US-073 / Phase 5c.8).
//
// Used by: lobby (room load), role-reveal (role+secret load), asking-phase
// (role+round-meta load). Voting/reveal screens render immediately with empty
// data so they don't currently swap to this skeleton.

export interface LoadingSkeletonProps {
  // Optional phase tag shown in the header skeleton (e.g. "ASKING", "VOTING",
  // "LOBBY"). Falls back to a hairline-bordered rectangle when omitted.
  phaseLabel?: ReactNode
  // Caption shown below the body block. Defaults to "กำลังโหลด..." per the
  // 5d.5 design-review spec.
  caption?: ReactNode
  testId?: string
  className?: string
}

export function LoadingSkeleton({
  phaseLabel,
  caption = "กำลังโหลด...",
  testId = "loading-skeleton",
  className,
}: LoadingSkeletonProps) {
  return (
    <main
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 px-6 pt-6 pb-8",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        {phaseLabel ? (
          <span
            data-testid="loading-skeleton-phase-tag"
            className="rounded-md border border-hairline bg-surface-elevated px-3 py-1 font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark-muted"
          >
            {phaseLabel}
          </span>
        ) : (
          <span
            aria-hidden
            className="h-8 w-24 rounded-md border border-hairline bg-surface-elevated motion-safe:animate-pulse"
          />
        )}
        <span
          aria-hidden
          className="h-8 w-20 rounded-md bg-surface-elevated motion-safe:animate-pulse"
        />
      </header>

      <section
        data-testid="loading-skeleton-body"
        className="flex flex-1 flex-col gap-3"
      >
        <span
          aria-hidden
          className="h-6 w-2/3 rounded-md bg-surface-elevated motion-safe:animate-pulse"
        />
        <span
          aria-hidden
          className="h-32 w-full rounded-2xl bg-surface-elevated motion-safe:animate-pulse"
        />
        <span
          aria-hidden
          className="h-12 w-full rounded-xl bg-surface-elevated motion-safe:animate-pulse"
        />
      </section>

      <p
        data-testid="loading-skeleton-caption"
        className="text-center font-body text-sm text-on-dark-soft"
      >
        {caption}
      </p>
    </main>
  )
}
