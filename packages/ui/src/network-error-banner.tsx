import type { ReactNode } from "react"

import { cn } from "./utils"

// US-079 / Phase 5d.5 — Network error banner. Slides down from the top edge
// when the realtime channel disconnects, persists until reconnect. Codifies
// the Headball ConnectionStatus pattern (apps/headball/components/
// connection-status.tsx) into a reusable @social-hub/ui primitive so the
// Insider screens reuse the exact same visual contract.
//
// Reduced-motion: gates the slide transition on `motion-safe:` so users who
// prefer no motion see the banner snap into view (still visible, no transform
// animation) per US-073 / Phase 5c.8.

export interface NetworkErrorBannerProps {
  visible: boolean
  // Banner copy. Defaults to the reconnect status used in Headball.
  message?: ReactNode
  // Optional leading icon (defaults to a red dot). Pass `null` to suppress.
  icon?: ReactNode
  testId?: string
  className?: string
}

export function NetworkErrorBanner({
  visible,
  message = "กำลังเชื่อมต่อ...",
  icon = <span aria-hidden="true" className="text-base motion-safe:animate-pulse">🔴</span>,
  testId = "network-error-banner",
  className,
}: NetworkErrorBannerProps) {
  return (
    <div
      data-testid={testId}
      data-state={visible ? "visible" : "hidden"}
      role="status"
      aria-live="assertive"
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-[13px] font-semibold tracking-[0.2px] text-on-light shadow-lg motion-safe:transition-transform motion-safe:duration-300",
        visible ? "translate-y-0" : "-translate-y-full",
        className,
      )}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}
