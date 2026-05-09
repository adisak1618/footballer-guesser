import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { RoleBadge } from "../role-badge"

// US-075 / Phase 5d.1 — Snapshot per variant.
// The role-badge codifies the inline implementations in
// `apps/insider/app/room/[code]/role-reveal.tsx` (Insider/Master/Common).
// Variants map: warning (yellow border + caption) / info (blue border + caption) /
// neutral (hairline border + soft caption). Outlined pill, Anton 32px label.

describe("RoleBadge", () => {
  it("warning variant matches snapshot", () => {
    const { container } = render(
      <RoleBadge
        variant="warning"
        caption="⚠ คนวงใน ⚠"
        label="THE INSIDER"
        testId="insider-role-badge"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("info variant matches snapshot", () => {
    const { container } = render(
      <RoleBadge
        variant="info"
        caption="👁 ผู้ตัดสิน"
        label="THE MASTER"
        testId="master-role-badge"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("neutral variant matches snapshot", () => {
    const { container } = render(
      <RoleBadge
        variant="neutral"
        caption="ผู้เล่น"
        label="PLAYER"
        testId="common-role-badge"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders without caption (label-only)", () => {
    const { container, getByText } = render(
      <RoleBadge variant="info" label="JUDGE" />,
    )
    expect(getByText("JUDGE")).toBeInTheDocument()
    // Only the label span should be present inside the pill.
    expect(container.querySelectorAll("span")).toHaveLength(1)
  })

  it("applies the testId via data-testid", () => {
    const { getByTestId } = render(
      <RoleBadge variant="warning" label="X" testId="my-badge" />,
    )
    expect(getByTestId("my-badge")).toBeInTheDocument()
  })
})
