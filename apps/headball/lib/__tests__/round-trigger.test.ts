import { describe, expect, test } from "vitest"
import {
  shouldTriggerNextRound,
  type ShouldTriggerNextRoundInput,
} from "@/lib/round-trigger"

const baseline: ShouldTriggerNextRoundInput = {
  roundStateLoaded: true,
  roundOver: true,
  isHost: true,
  triggeredRound: null,
  currentRound: 1,
}

describe("shouldTriggerNextRound", () => {
  test("fires when host sees a freshly loaded round end for the first time", () => {
    expect(shouldTriggerNextRound(baseline)).toBe(true)
  })

  test("rematch regression: blocks the trigger while round_state has not been refetched in this mount", () => {
    // Game 2 round-1 stall (#7): on Playing remount the Zustand store still
    // has stale rows from game 1, so roundOver looks true. The loaded gate
    // must hold the trigger off until refetch lands.
    expect(
      shouldTriggerNextRound({ ...baseline, roundStateLoaded: false }),
    ).toBe(false)
  })

  test("does not fire while the round still has active players", () => {
    expect(shouldTriggerNextRound({ ...baseline, roundOver: false })).toBe(
      false,
    )
  })

  test("non-host clients never trigger next_round", () => {
    expect(shouldTriggerNextRound({ ...baseline, isHost: false })).toBe(false)
  })

  test("idempotent: same round only fires once even if effect re-runs", () => {
    expect(
      shouldTriggerNextRound({ ...baseline, triggeredRound: 1 }),
    ).toBe(false)
  })

  test("re-fires once currentRound advances past the previously triggered round", () => {
    expect(
      shouldTriggerNextRound({
        ...baseline,
        triggeredRound: 1,
        currentRound: 2,
      }),
    ).toBe(true)
  })
})
