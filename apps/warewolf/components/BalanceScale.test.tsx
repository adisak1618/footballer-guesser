// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { BalanceScale } from "./BalanceScale"

describe("<BalanceScale>", () => {
  it("renders both side sums with wolves on the left and village on the right", () => {
    const { container } = render(
      <BalanceScale wolfSum={-7} villageSum={9} balance={2} hasBlocker={false} />,
    )
    const sides = container.querySelectorAll<HTMLElement>("[data-side]")
    expect(sides).toHaveLength(2)
    expect(sides[0].getAttribute("data-side")).toBe("wolf")
    expect(sides[1].getAttribute("data-side")).toBe("village")
    // Wolves render their negative sum unprefixed; village prefixes with `+`.
    expect(sides[0].textContent).toContain("-7")
    expect(sides[1].textContent).toContain("+9")
  })

  it("uses green pointer when balance is in [-2, +2] and no blocker", () => {
    render(<BalanceScale wolfSum={-5} villageSum={6} balance={1} hasBlocker={false} />)
    const pointer = screen.getByTestId("balance-pointer")
    expect(pointer.getAttribute("data-state")).toBe("balanced")
    // Green token resolves to #0f5132 (var(--color-green)).
    expect(pointer.style.background).toContain("--color-green")
  })

  it("uses dark amber pointer when balance is outside [-2, +2] and no blocker", () => {
    render(<BalanceScale wolfSum={-3} villageSum={9} balance={6} hasBlocker={false} />)
    const pointer = screen.getByTestId("balance-pointer")
    expect(pointer.getAttribute("data-state")).toBe("tilt")
    // jsdom normalizes hex to rgb form; #7a4d00 → rgb(122, 77, 0).
    expect(pointer.style.background).toBe("rgb(122, 77, 0)")
  })

  it("uses blood-red pointer when hasBlocker is true (regardless of balance)", () => {
    render(<BalanceScale wolfSum={-2} villageSum={2} balance={0} hasBlocker />)
    const pointer = screen.getByTestId("balance-pointer")
    expect(pointer.getAttribute("data-state")).toBe("blocked")
    // #8b1a1a → rgb(139, 26, 26).
    expect(pointer.style.background).toBe("rgb(139, 26, 26)")
  })

  it("declares aria-live='polite' on the scale region", () => {
    render(<BalanceScale wolfSum={-4} villageSum={5} balance={1} hasBlocker={false} />)
    expect(screen.getByTestId("balance-scale")).toHaveAttribute("aria-live", "polite")
  })

  it("positions the pointer based on balance (50% at zero, clamps at ±15)", () => {
    const { rerender } = render(
      <BalanceScale wolfSum={-5} villageSum={5} balance={0} hasBlocker={false} />,
    )
    expect(screen.getByTestId("balance-pointer").style.left).toBe("50%")

    rerender(<BalanceScale wolfSum={-20} villageSum={5} balance={-15} hasBlocker={false} />)
    expect(screen.getByTestId("balance-pointer").style.left).toBe("5%")

    rerender(<BalanceScale wolfSum={-5} villageSum={20} balance={15} hasBlocker={false} />)
    expect(screen.getByTestId("balance-pointer").style.left).toBe("95%")

    // Extreme values clamp.
    rerender(<BalanceScale wolfSum={-1} villageSum={50} balance={49} hasBlocker={false} />)
    expect(screen.getByTestId("balance-pointer").style.left).toBe("95%")
  })

  it("renders the signed balance inside the pointer", () => {
    const { rerender } = render(
      <BalanceScale wolfSum={-3} villageSum={5} balance={2} hasBlocker={false} />,
    )
    expect(screen.getByTestId("balance-pointer")).toHaveTextContent("+2")
    rerender(<BalanceScale wolfSum={-7} villageSum={4} balance={-3} hasBlocker={false} />)
    expect(screen.getByTestId("balance-pointer")).toHaveTextContent("-3")
  })
})
