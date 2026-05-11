import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { RoomSetupPanel } from "../room-setup-panel"

// Issue #27 — shared RoomSetupPanel. Validates the slot-based contract: panel
// is presentational, no game-specific branching, non-host view shows the
// read-only badge, and the lock state surfaces as data-attrs for testing.

describe("RoomSetupPanel", () => {
  it("renders category slot + read-only badge for non-host", () => {
    const { getByTestId, getByText } = render(
      <RoomSetupPanel
        categorySlot={<div data-testid="cat">CAT</div>}
        lockState={{ category: false }}
        isHost={false}
      />,
    )
    expect(getByTestId("room-setup-panel")).toBeInTheDocument()
    expect(getByTestId("cat")).toBeInTheDocument()
    expect(getByText("Read only")).toBeInTheDocument()
    expect(
      getByTestId("room-setup-panel").getAttribute("data-host"),
    ).toBe("false")
  })

  it("hides read-only badge when isHost=true", () => {
    const { queryByTestId } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        lockState={{ category: false }}
        isHost={true}
      />,
    )
    expect(queryByTestId("room-setup-panel-readonly-badge")).toBeNull()
  })

  it("renders options slot when provided", () => {
    const { getByTestId } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        optionsSlot={<div data-testid="opt">OPT</div>}
        lockState={{ category: false, options: false }}
        isHost={true}
      />,
    )
    expect(getByTestId("room-setup-panel-options-slot")).toBeInTheDocument()
    expect(getByTestId("opt")).toBeInTheDocument()
  })

  it("omits options slot wrapper when no optionsSlot prop", () => {
    const { queryByTestId } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        lockState={{ category: false }}
        isHost={true}
      />,
    )
    expect(queryByTestId("room-setup-panel-options-slot")).toBeNull()
  })

  it("surfaces lock state as data attributes", () => {
    const { getByTestId } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        optionsSlot={<div>OPT</div>}
        lockState={{ category: true, options: true }}
        isHost={true}
      />,
    )
    const panel = getByTestId("room-setup-panel")
    expect(panel.getAttribute("data-category-locked")).toBe("true")
    expect(panel.getAttribute("data-options-locked")).toBe("true")
  })

  it("uses default heading label when none provided", () => {
    const { getByText } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        lockState={{ category: false }}
        isHost={true}
      />,
    )
    expect(getByText("Game Settings")).toBeInTheDocument()
  })

  it("respects custom heading label", () => {
    const { getByText } = render(
      <RoomSetupPanel
        categorySlot={<div>CAT</div>}
        lockState={{ category: false }}
        isHost={true}
        headingLabel="Lobby"
      />,
    )
    expect(getByText("Lobby")).toBeInTheDocument()
  })
})
