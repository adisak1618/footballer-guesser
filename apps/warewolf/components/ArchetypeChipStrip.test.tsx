// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ArchetypeChipStrip } from "./ArchetypeChipStrip"
import type { ArchetypeId } from "../lib/archetypes"

function setup(
  playerCount: number,
  activeFilters: Set<ArchetypeId> = new Set(),
  lang: "en" | "th" = "en",
) {
  const onChange = vi.fn()
  const utils = render(
    <ArchetypeChipStrip
      playerCount={playerCount}
      activeFilters={activeFilters}
      onChange={onChange}
      lang={lang}
    />,
  )
  return { onChange, ...utils }
}

describe("<ArchetypeChipStrip> visibility per playerCount", () => {
  it("at playerCount=5, renders only wolf-chaos and social-bluff (others outside their [min,max])", () => {
    setup(5)
    // wolf-chaos [5,9] — RENDERS
    expect(screen.queryByTestId("chip-name-wolf-chaos")).not.toBeNull()
    // social-bluff [5,13] — RENDERS
    expect(screen.queryByTestId("chip-name-social-bluff")).not.toBeNull()
    // info-heavy [7,20] — HIDDEN
    expect(screen.queryByTestId("chip-name-info-heavy")).toBeNull()
    // neutral-mayhem [7,13] — HIDDEN
    expect(screen.queryByTestId("chip-name-neutral-mayhem")).toBeNull()
  })

  it("at playerCount=14, hides wolf-chaos / beginner / social-bluff / neutral-mayhem", () => {
    setup(14)
    expect(screen.queryByTestId("chip-name-wolf-chaos")).toBeNull()
    expect(screen.queryByTestId("chip-name-beginner")).toBeNull()
    expect(screen.queryByTestId("chip-name-social-bluff")).toBeNull()
    expect(screen.queryByTestId("chip-name-neutral-mayhem")).toBeNull()
    // and the in-range ones DO render
    expect(screen.queryByTestId("chip-name-classic-detective")).not.toBeNull()
    expect(screen.queryByTestId("chip-name-info-heavy")).not.toBeNull()
    expect(screen.queryByTestId("chip-name-power-roles")).not.toBeNull()
    expect(screen.queryByTestId("chip-name-balanced-power")).not.toBeNull()
  })
})

describe("<ArchetypeChipStrip> selection (single-select)", () => {
  it("tapping an inactive chip fires onChange with ONLY that id selected", () => {
    const { onChange } = setup(8, new Set())
    fireEvent.click(screen.getByTestId("chip-name-wolf-chaos"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Set<ArchetypeId>
    expect(next.has("wolf-chaos")).toBe(true)
    expect(next.size).toBe(1)
  })

  it("tapping a different chip replaces the active selection (single-select)", () => {
    const { onChange } = setup(8, new Set<ArchetypeId>(["power-roles"]))
    fireEvent.click(screen.getByTestId("chip-name-wolf-chaos"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Set<ArchetypeId>
    expect(next.has("wolf-chaos")).toBe(true)
    expect(next.has("power-roles")).toBe(false)
    expect(next.size).toBe(1)
  })

  it("tapping the active chip clears the filter back to empty (toggle off)", () => {
    const { onChange } = setup(8, new Set<ArchetypeId>(["wolf-chaos"]))
    fireEvent.click(screen.getByTestId("chip-name-wolf-chaos"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Set<ArchetypeId>
    expect(next.size).toBe(0)
  })

  it("renders active chip with aria-pressed=true and inactive with aria-pressed=false", () => {
    setup(8, new Set<ArchetypeId>(["wolf-chaos"]))
    const wolfChaos = screen.getByTestId("chip-name-wolf-chaos").closest("button")
    const powerRoles = screen.getByTestId("chip-name-power-roles").closest("button")
    expect(wolfChaos?.getAttribute("aria-pressed")).toBe("true")
    expect(powerRoles?.getAttribute("aria-pressed")).toBe("false")
  })
})

describe("<ArchetypeChipStrip> language", () => {
  it("renders the Thai display name when lang='th'", () => {
    setup(10, new Set(), "th")
    // Classic Detective Thai name is "นักสืบคลาสสิก" (per archetypes.ts)
    expect(screen.getByTestId("chip-name-classic-detective").textContent).toBe(
      "นักสืบคลาสสิก",
    )
  })

  it("renders only one language per chip (no en+th stacking)", () => {
    setup(10, new Set(), "en")
    const chip = screen.getByTestId("chip-name-classic-detective")
    expect(chip.textContent).toBe("Classic Detective")
    // Make sure the Thai name doesn't appear in the same chip
    expect(chip.textContent).not.toMatch(/นักสืบ/)
  })
})

describe("<ArchetypeChipStrip> a11y + tap target", () => {
  it("each chip is a <button> with min tap target 44px", () => {
    const { container } = setup(10)
    const buttons = container.querySelectorAll("button[data-chip]")
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of Array.from(buttons)) {
      const style = (btn as HTMLButtonElement).style
      expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(44)
      expect(parseInt(style.minWidth, 10)).toBeGreaterThanOrEqual(44)
    }
  })

  it("ArrowRight moves focus to the next chip; ArrowLeft moves back", () => {
    const { container } = setup(10)
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-chip]"),
    )
    expect(buttons.length).toBeGreaterThan(2)
    buttons[0].focus()
    expect(document.activeElement).toBe(buttons[0])
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" })
    expect(document.activeElement).toBe(buttons[1])
    fireEvent.keyDown(buttons[1], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(buttons[0])
  })

  it("ArrowLeft on first chip wraps to the last chip", () => {
    const { container } = setup(10)
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-chip]"),
    )
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })

  it("strip has a toolbar role and accessible label", () => {
    setup(10)
    const strip = screen.getByRole("toolbar", { name: /archetype filters/i })
    expect(strip).toBeInTheDocument()
  })
})
