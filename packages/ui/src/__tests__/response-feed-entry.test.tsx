import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { ResponseFeedEntry } from "../response-feed-entry"

// US-077 / Phase 5d.3 — ResponseFeedEntry mirrors the prior inline list-row
// implementation in `apps/insider/app/room/[code]/asking-other.tsx`. Snapshot
// per shape variant + testid pass-through.

describe("ResponseFeedEntry", () => {
  it("renders timestamp + icon + EN/TH labels (asking-other shape)", () => {
    const { container } = render(
      <ul>
        <ResponseFeedEntry
          timestamp="0:05"
          icon="✓"
          labelEn="YES"
          labelTh="ใช่"
          testId="asking-other-feed-row"
          timeTestId="asking-other-feed-time"
        />
      </ul>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders without labelEn (icon + TH only)", () => {
    const { container } = render(
      <ul>
        <ResponseFeedEntry
          timestamp="0:12"
          icon="✗"
          labelTh="ไม่ใช่"
          testId="row-only-th"
        />
      </ul>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders without labelTh (icon + EN only)", () => {
    const { container } = render(
      <ul>
        <ResponseFeedEntry
          timestamp="0:18"
          icon="?"
          labelEn="UNSURE"
          testId="row-only-en"
        />
      </ul>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("forwards testId and timeTestId via data-testid", () => {
    const { getByTestId } = render(
      <ul>
        <ResponseFeedEntry
          timestamp="0:30"
          icon="✓"
          labelEn="YES"
          labelTh="ใช่"
          testId="my-row"
          timeTestId="my-time"
        />
      </ul>,
    )
    expect(getByTestId("my-row")).toBeInTheDocument()
    expect(getByTestId("my-time")).toBeInTheDocument()
    expect(getByTestId("my-time").textContent).toBe("0:30")
  })

  it("renders as an <li> with min-h-[44px]", () => {
    const { container } = render(
      <ul>
        <ResponseFeedEntry timestamp="0:01" icon="✓" labelEn="YES" />
      </ul>,
    )
    const li = container.querySelector("li")
    expect(li).not.toBeNull()
    expect(li?.className).toMatch(/min-h-\[44px\]/)
  })
})
