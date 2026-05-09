import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { LoadingSkeleton } from "../loading-skeleton"

// US-079 / Phase 5d.5 — Loading skeleton lock-in.
// Snapshot the with-phaseLabel and without-phaseLabel shapes so any future
// drift (motion-safe class removal, caption rename, structure change) shows
// up in the diff.

describe("LoadingSkeleton", () => {
  it("with phaseLabel matches snapshot", () => {
    const { container } = render(
      <LoadingSkeleton phaseLabel="ASKING" />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("without phaseLabel renders a skeleton header rect", () => {
    const { container } = render(<LoadingSkeleton />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("uses the default 'กำลังโหลด...' caption", () => {
    const { getByTestId } = render(<LoadingSkeleton phaseLabel="LOBBY" />)
    expect(getByTestId("loading-skeleton-caption").textContent).toBe(
      "กำลังโหลด...",
    )
  })

  it("accepts a custom caption override", () => {
    const { getByTestId } = render(
      <LoadingSkeleton phaseLabel="VOTING" caption="กำลังเตรียมโหวต..." />,
    )
    expect(getByTestId("loading-skeleton-caption").textContent).toBe(
      "กำลังเตรียมโหวต...",
    )
  })

  it("has aria-busy='true' for assistive tech", () => {
    const { getByTestId } = render(<LoadingSkeleton phaseLabel="REVEAL" />)
    expect(getByTestId("loading-skeleton")).toHaveAttribute(
      "aria-busy",
      "true",
    )
  })
})
