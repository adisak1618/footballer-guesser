import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"

import { PackChip } from "../pack-chip"

// US-077 / Phase 5d.3 — PackChip codifies the inline radio-chip block from
// `apps/insider/app/new/host-setup-form.tsx`. Selected = tag-color bg with
// shadow + border-transparent; unselected = surface-elevated + hairline outline.

describe("PackChip", () => {
  it("selected variant matches snapshot (tag-color filled)", () => {
    const { container } = render(
      <PackChip
        joinIndex={0}
        label="พรีเมียร์ลีก"
        subLabel="Premier League"
        selected
        onTap={() => {}}
        testId="pack-chip-pl"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("unselected variant matches snapshot (surface-elevated)", () => {
    const { container } = render(
      <PackChip
        joinIndex={0}
        label="พรีเมียร์ลีก"
        subLabel="Premier League"
        selected={false}
        onTap={() => {}}
        testId="pack-chip-pl"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders without subLabel (Thai-only)", () => {
    const { container, queryByText } = render(
      <PackChip
        joinIndex={2}
        label="กลุ่มยุโรป"
        selected
        onTap={() => {}}
        testId="pack-chip-eu"
      />,
    )
    expect(queryByText("กลุ่มยุโรป")).toBeInTheDocument()
    expect(container.querySelectorAll("span")).toHaveLength(1)
  })

  it("invokes onTap when clicked", () => {
    const handleTap = vi.fn()
    const { getByTestId } = render(
      <PackChip
        joinIndex={0}
        label="พรีเมียร์ลีก"
        selected={false}
        onTap={handleTap}
        testId="chip"
      />,
    )
    fireEvent.click(getByTestId("chip"))
    expect(handleTap).toHaveBeenCalledTimes(1)
  })

  it("does not invoke onTap when disabled", () => {
    const handleTap = vi.fn()
    const { getByTestId } = render(
      <PackChip
        joinIndex={0}
        label="พรีเมียร์ลีก"
        selected={false}
        disabled
        onTap={handleTap}
        testId="chip"
      />,
    )
    fireEvent.click(getByTestId("chip"))
    expect(handleTap).not.toHaveBeenCalled()
  })

  it("sets role=radio and aria-checked from selected", () => {
    const { getByTestId } = render(
      <PackChip
        joinIndex={0}
        label="X"
        selected
        onTap={() => {}}
        testId="chip"
      />,
    )
    const btn = getByTestId("chip")
    expect(btn.getAttribute("role")).toBe("radio")
    expect(btn.getAttribute("aria-checked")).toBe("true")
  })

  it("cycles tag-color via joinIndex (mod 8)", () => {
    const { getByTestId, rerender } = render(
      <PackChip
        joinIndex={0}
        label="A"
        selected
        onTap={() => {}}
        testId="chip"
      />,
    )
    expect(getByTestId("chip").className).toMatch(/bg-tag-red/)

    rerender(
      <PackChip
        joinIndex={1}
        label="A"
        selected
        onTap={() => {}}
        testId="chip"
      />,
    )
    expect(getByTestId("chip").className).toMatch(/bg-tag-blue/)

    rerender(
      <PackChip
        joinIndex={8}
        label="A"
        selected
        onTap={() => {}}
        testId="chip"
      />,
    )
    expect(getByTestId("chip").className).toMatch(/bg-tag-red/)
  })
})
