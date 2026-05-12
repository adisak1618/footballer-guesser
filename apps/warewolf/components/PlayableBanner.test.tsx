// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PlayableBanner } from "./PlayableBanner"

describe("<PlayableBanner>", () => {
  it("renders the playable verdict with the ✓ glyph and green background", () => {
    render(<PlayableBanner state="playable" reason="Balanced lineup" />)
    const banner = screen.getByTestId("playable-banner")
    expect(banner.getAttribute("data-state")).toBe("playable")
    expect(screen.getByTestId("playable-banner-glyph")).toHaveTextContent("✓")
    expect(screen.getByTestId("playable-banner-verdict")).toHaveTextContent(
      /PLAYABLE\s*·\s*เล่นได้/,
    )
    expect(screen.getByTestId("playable-banner-reason")).toHaveTextContent(
      "Balanced lineup",
    )
  })

  it("renders the not-playable verdict with the ✕ glyph and red background", () => {
    render(<PlayableBanner state="not-playable" reason="Need at least 1 wolf" />)
    const banner = screen.getByTestId("playable-banner")
    expect(banner.getAttribute("data-state")).toBe("not-playable")
    expect(screen.getByTestId("playable-banner-glyph")).toHaveTextContent("✕")
    expect(screen.getByTestId("playable-banner-verdict")).toHaveTextContent(
      /NOT PLAYABLE\s*·\s*เล่นไม่ได้/,
    )
    expect(screen.getByTestId("playable-banner-reason")).toHaveTextContent(
      "Need at least 1 wolf",
    )
  })

  it("renders the warn state with the ! glyph", () => {
    render(<PlayableBanner state="warn" reason="Lineup tilts village" />)
    const banner = screen.getByTestId("playable-banner")
    expect(banner.getAttribute("data-state")).toBe("warn")
    expect(screen.getByTestId("playable-banner-glyph")).toHaveTextContent("!")
    expect(screen.getByTestId("playable-banner-reason")).toHaveTextContent(
      "Lineup tilts village",
    )
  })

  it("declares aria-live='polite' on the banner", () => {
    render(<PlayableBanner state="playable" reason="ok" />)
    expect(screen.getByTestId("playable-banner")).toHaveAttribute("aria-live", "polite")
  })

  it("includes the · separator between verdict and reason", () => {
    render(<PlayableBanner state="playable" reason="ok" />)
    expect(screen.getByTestId("playable-banner-sep")).toHaveTextContent("·")
  })
})
