import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { NetworkErrorBanner } from "../network-error-banner"

// US-079 / Phase 5d.5 — Network error banner lock-in. The visible/hidden DOM
// must stay symmetric (only translate-y class flips) so reduced-motion users
// see the banner snap into place without a transform animation.

describe("NetworkErrorBanner", () => {
  it("visible variant matches snapshot", () => {
    const { container } = render(<NetworkErrorBanner visible />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("hidden variant matches snapshot", () => {
    const { container } = render(<NetworkErrorBanner visible={false} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("aria-hidden mirrors `visible` prop", () => {
    const { rerender, getByTestId } = render(
      <NetworkErrorBanner visible={false} />,
    )
    expect(getByTestId("network-error-banner")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
    rerender(<NetworkErrorBanner visible />)
    expect(getByTestId("network-error-banner")).toHaveAttribute(
      "aria-hidden",
      "false",
    )
  })

  it("uses the default 'กำลังเชื่อมต่อ...' message", () => {
    const { getByText } = render(<NetworkErrorBanner visible />)
    expect(getByText("กำลังเชื่อมต่อ...")).toBeInTheDocument()
  })

  it("accepts a custom message override", () => {
    const { getByText } = render(
      <NetworkErrorBanner visible message="เชื่อมต่อใหม่..." />,
    )
    expect(getByText("เชื่อมต่อใหม่...")).toBeInTheDocument()
  })

  it("data-state reflects `visible` prop", () => {
    const { rerender, getByTestId } = render(
      <NetworkErrorBanner visible={false} />,
    )
    expect(getByTestId("network-error-banner")).toHaveAttribute(
      "data-state",
      "hidden",
    )
    rerender(<NetworkErrorBanner visible />)
    expect(getByTestId("network-error-banner")).toHaveAttribute(
      "data-state",
      "visible",
    )
  })
})
