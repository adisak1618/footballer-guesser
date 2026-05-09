import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { EmptySlot } from "../empty-slot"

// US-079 / Phase 5d.5 — Empty slot lock-in. Two snapshots cover the default
// hint and a custom hint override; the dashed-border + index-bubble structure
// must match PlayerChip's geometry so the lobby layout doesn't shift when a
// real player joins and replaces an EmptySlot.

describe("EmptySlot", () => {
  it("renders with default hint", () => {
    const { container } = render(<EmptySlot index={4} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with a custom hint", () => {
    const { container } = render(
      <EmptySlot index={3} hint="ต้องการอย่างน้อย 3 คน" />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("default testId is 'empty-slot-<index>'", () => {
    const { getByTestId } = render(<EmptySlot index={5} />)
    expect(getByTestId("empty-slot-5")).toBeInTheDocument()
  })

  it("accepts a testId override", () => {
    const { getByTestId } = render(
      <EmptySlot index={1} testId="lobby-min-player-hint" />,
    )
    expect(getByTestId("lobby-min-player-hint")).toBeInTheDocument()
  })

  it("has aria-label describing the open slot", () => {
    const { getByLabelText } = render(<EmptySlot index={7} />)
    expect(getByLabelText("Open slot 7")).toBeInTheDocument()
  })
})
