import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"

import { ResponseButton } from "../response-button"

// US-076 / Phase 5d.2 — Snapshot per variant + behavioural assertions.
// The response-button codifies the inline Yes/No/Unsure tap-to-answer
// implementation in `apps/insider/app/room/[code]/asking-master.tsx`.
// Variants map: success (bg-success, Yes) / error (bg-error, No) /
// warning (bg-warning, Unsure). 96px tall, full-width, icon + Thai + English.

describe("ResponseButton", () => {
  it("success variant matches snapshot", () => {
    const { container } = render(
      <ResponseButton
        variant="success"
        icon="✓"
        labelTh="ใช่"
        labelEn="YES"
        testId="master-respond-yes"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("error variant matches snapshot", () => {
    const { container } = render(
      <ResponseButton
        variant="error"
        icon="✗"
        labelTh="ไม่ใช่"
        labelEn="NO"
        testId="master-respond-no"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("warning variant matches snapshot", () => {
    const { container } = render(
      <ResponseButton
        variant="warning"
        icon="?"
        labelTh="ไม่แน่ใจ"
        labelEn="UNSURE"
        testId="master-respond-unsure"
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("invokes onClick when tapped", () => {
    const handleClick = vi.fn()
    const { getByTestId } = render(
      <ResponseButton
        variant="success"
        icon="✓"
        labelTh="ใช่"
        labelEn="YES"
        testId="resp"
        onClick={handleClick}
      />,
    )
    fireEvent.click(getByTestId("resp"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("does not invoke onClick when disabled", () => {
    const handleClick = vi.fn()
    const { getByTestId } = render(
      <ResponseButton
        variant="error"
        icon="✗"
        labelTh="ไม่ใช่"
        labelEn="NO"
        testId="resp"
        disabled
        onClick={handleClick}
      />,
    )
    fireEvent.click(getByTestId("resp"))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it("applies the testId via data-testid", () => {
    const { getByTestId } = render(
      <ResponseButton
        variant="warning"
        icon="?"
        labelTh="ไม่แน่ใจ"
        labelEn="UNSURE"
        testId="my-btn"
      />,
    )
    expect(getByTestId("my-btn")).toBeInTheDocument()
  })
})
