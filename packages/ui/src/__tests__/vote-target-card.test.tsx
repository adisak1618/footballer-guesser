import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"

import { VoteTargetCard } from "../vote-target-card"

// US-077 / Phase 5d.3 — VoteTargetCard codifies the Insider voting screen
// (Screen 7). Existed in packages/ui from US-061; this test suite locks the
// contract: tag-color bg per join-order, selected ring + ✓ overlay, disabled
// state. DOM byte-for-byte matches the prior inline implementation.

describe("VoteTargetCard", () => {
  it("unselected variant matches snapshot", () => {
    const { container } = render(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected={false}
        onTap={() => {}}
        testId="vote-target-card-alice"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("selected variant matches snapshot (goal ring + check overlay)", () => {
    const { container } = render(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected
        onTap={() => {}}
        testId="vote-target-card-alice"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("invokes onTap when clicked", () => {
    const handleTap = vi.fn()
    const { getByTestId } = render(
      <VoteTargetCard
        joinOrder={2}
        displayName="BOB"
        selected={false}
        onTap={handleTap}
        testId="vote-target-card-bob"
      />,
    )
    fireEvent.click(getByTestId("vote-target-card-bob"))
    expect(handleTap).toHaveBeenCalledTimes(1)
  })

  it("does not invoke onTap when disabled", () => {
    const handleTap = vi.fn()
    const { getByTestId } = render(
      <VoteTargetCard
        joinOrder={3}
        displayName="CARLA"
        selected={false}
        disabled
        onTap={handleTap}
        testId="vote-target-card-carla"
      />,
    )
    fireEvent.click(getByTestId("vote-target-card-carla"))
    expect(handleTap).not.toHaveBeenCalled()
  })

  it("renders the check overlay only when selected", () => {
    const { queryByTestId, rerender } = render(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected={false}
        onTap={() => {}}
      />,
    )
    expect(queryByTestId("vote-target-check")).toBeNull()

    rerender(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected
        onTap={() => {}}
      />,
    )
    expect(queryByTestId("vote-target-check")).not.toBeNull()
  })

  it("sets aria-pressed from selected", () => {
    const { getByTestId, rerender } = render(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected={false}
        onTap={() => {}}
        testId="card"
      />,
    )
    expect(getByTestId("card").getAttribute("aria-pressed")).toBe("false")

    rerender(
      <VoteTargetCard
        joinOrder={1}
        displayName="ALICE"
        selected
        onTap={() => {}}
        testId="card"
      />,
    )
    expect(getByTestId("card").getAttribute("aria-pressed")).toBe("true")
  })

  it("cycles tag-color via joinOrder (mod 8)", () => {
    const { getByTestId, rerender } = render(
      <VoteTargetCard
        joinOrder={1}
        displayName="A"
        selected={false}
        onTap={() => {}}
        testId="card"
      />,
    )
    expect(getByTestId("card").className).toMatch(/bg-tag-red/)

    rerender(
      <VoteTargetCard
        joinOrder={9}
        displayName="A"
        selected={false}
        onTap={() => {}}
        testId="card"
      />,
    )
    expect(getByTestId("card").className).toMatch(/bg-tag-red/)

    rerender(
      <VoteTargetCard
        joinOrder={3}
        displayName="A"
        selected={false}
        onTap={() => {}}
        testId="card"
      />,
    )
    expect(getByTestId("card").className).toMatch(/bg-tag-yellow/)
  })
})
