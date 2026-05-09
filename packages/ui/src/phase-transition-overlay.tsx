"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import { cn } from "./utils"

// US-079 / Phase 5d.5 — Phase transition overlay. When `phaseKey` changes the
// component flashes a centered phase-name overlay (e.g. "VOTING / โหวต") with
// a 400ms label hold + 600ms cross-fade total. After the window expires it
// unmounts the overlay, leaving the underlying screen visible.
//
// The overlay is positioned absolutely over the parent container (z-30) and
// uses opacity (NOT transform) for the fade so reduced-motion users still see
// the destination screen instantly without the cross-fade. When the user has
// `prefers-reduced-motion: reduce`, the entire overlay is skipped (returns
// null) — the screen swap happens with no fade, matching the US-073 contract
// (`getComputedStyle(el).transform === 'none'` for any animated element).
//
// Caller is expected to render this once at the route shell level and update
// `phaseKey` whenever the visible sub-screen changes — typical keys:
//   "lobby" | "role-reveal" | "asking" | "voting" | "guessed" | "reveal"
// On the first mount with the initial key, NO overlay is shown (only changes
// trigger the flash) so the first paint isn't gated on a 1s delay.

export interface PhaseTransitionOverlayProps {
  // Current visible phase key. When this prop changes the overlay flashes.
  phaseKey: string
  // Optional English headline. Falls back to the upper-cased phaseKey.
  labelEn?: ReactNode
  // Optional Thai sub-headline.
  labelTh?: ReactNode
  // Total visible window in ms (label hold + fade out). Default 1000.
  durationMs?: number
  // Cross-fade duration in ms. Default 600.
  fadeMs?: number
  testId?: string
  className?: string
}

export function PhaseTransitionOverlay({
  phaseKey,
  labelEn,
  labelTh,
  durationMs = 1000,
  fadeMs = 600,
  testId = "phase-transition-overlay",
  className,
}: PhaseTransitionOverlayProps) {
  const [shown, setShown] = useState(false)
  const [contentKey, setContentKey] = useState(phaseKey)
  const firstRender = useRef(true)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    // Skip the very first mount — no overlay on initial paint.
    if (firstRender.current) {
      firstRender.current = false
      setContentKey(phaseKey)
      return
    }
    if (reducedMotion) {
      // Reduced-motion: no overlay at all. Just track the key for any future
      // tooling that wants to read it.
      setContentKey(phaseKey)
      return
    }
    setContentKey(phaseKey)
    setShown(true)
    const t = window.setTimeout(() => setShown(false), durationMs)
    return () => window.clearTimeout(t)
  }, [phaseKey, durationMs, reducedMotion])

  if (reducedMotion) return null
  if (!shown) return null

  const en = labelEn ?? contentKey.toUpperCase()

  return (
    <div
      data-testid={testId}
      data-phase-key={contentKey}
      role="status"
      aria-live="polite"
      style={{ transitionDuration: `${fadeMs}ms` }}
      className={cn(
        "pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-ink/85 text-center motion-safe:transition-opacity",
        shown ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <p
        data-testid="phase-transition-overlay-en"
        className="font-display text-[40px] uppercase leading-none tracking-[2px] text-on-dark"
      >
        {en}
      </p>
      {labelTh ? (
        <p
          data-testid="phase-transition-overlay-th"
          className="font-body text-[16px] tracking-[0.3px] text-on-dark-soft"
        >
          {labelTh}
        </p>
      ) : null}
    </div>
  )
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mql.matches)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return reduced
}
