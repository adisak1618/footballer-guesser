import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"

import { PhaseTransitionOverlay } from "../phase-transition-overlay"

// US-079 / Phase 5d.5 — Phase transition overlay lock-in.
//
// Behavior under test:
//  - First mount: NO overlay (only phase CHANGES trigger the flash).
//  - Subsequent phaseKey changes: overlay flashes for `durationMs` then unmounts.
//  - Reduced-motion (prefers-reduced-motion: reduce): NEVER renders an overlay,
//    even on phase changes. (US-073 contract — getComputedStyle .transform === 'none'
//    is satisfied trivially because the component returns null.)

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function mockReducedMotion(matches: boolean) {
  const listeners = new Set<() => void>()
  const mql: MediaQueryList = {
    matches,
    media: REDUCED_MOTION_QUERY,
    onchange: null,
    addEventListener: (_type: string, cb: EventListener) =>
      listeners.add(cb as () => void),
    removeEventListener: (_type: string, cb: EventListener) =>
      listeners.delete(cb as () => void),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => (q === REDUCED_MOTION_QUERY ? mql : { matches: false } as MediaQueryList)),
  )
}

describe("PhaseTransitionOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("does not render an overlay on initial mount", () => {
    const { queryByTestId } = render(
      <PhaseTransitionOverlay phaseKey="lobby" labelEn="LOBBY" labelTh="ห้องรอ" />,
    )
    expect(queryByTestId("phase-transition-overlay")).toBeNull()
  })

  it("flashes the overlay when phaseKey changes, then unmounts after durationMs", () => {
    const { rerender, queryByTestId } = render(
      <PhaseTransitionOverlay phaseKey="lobby" labelEn="LOBBY" />,
    )
    rerender(
      <PhaseTransitionOverlay phaseKey="asking" labelEn="ASKING" labelTh="ถาม" />,
    )
    expect(queryByTestId("phase-transition-overlay")).not.toBeNull()
    expect(queryByTestId("phase-transition-overlay-en")?.textContent).toBe(
      "ASKING",
    )
    expect(queryByTestId("phase-transition-overlay-th")?.textContent).toBe(
      "ถาม",
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(queryByTestId("phase-transition-overlay")).toBeNull()
  })

  it("falls back to upper-cased phaseKey when labelEn is omitted", () => {
    const { rerender, queryByTestId } = render(
      <PhaseTransitionOverlay phaseKey="lobby" />,
    )
    rerender(<PhaseTransitionOverlay phaseKey="voting" />)
    expect(queryByTestId("phase-transition-overlay-en")?.textContent).toBe(
      "VOTING",
    )
  })

  it("renders nothing in reduced-motion mode, even on phase change", () => {
    mockReducedMotion(true)
    const { rerender, queryByTestId } = render(
      <PhaseTransitionOverlay phaseKey="lobby" labelEn="LOBBY" />,
    )
    rerender(
      <PhaseTransitionOverlay phaseKey="asking" labelEn="ASKING" />,
    )
    expect(queryByTestId("phase-transition-overlay")).toBeNull()
  })
})
