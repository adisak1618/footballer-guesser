// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Container } from "./Container"

describe("<Container>", () => {
  it("renders children", () => {
    render(
      <Container>
        <span data-testid="child">hello</span>
      </Container>,
    )
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("applies default max-width of 1100px", () => {
    const { container } = render(
      <Container testId="container">
        <span>x</span>
      </Container>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.maxWidth).toBe("1100px")
    expect(el.style.marginInline).toBe("auto")
  })

  it("applies narrow variant max-width for long-form text", () => {
    const { container } = render(
      <Container variant="narrow">
        <span>x</span>
      </Container>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.maxWidth).toBe("760px")
  })

  it("forwards className prop", () => {
    const { container } = render(
      <Container className="my-section">
        <span>x</span>
      </Container>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toBe("my-section")
  })

  it("merges custom inline style with the layout base", () => {
    const { container } = render(
      <Container style={{ padding: "12px", color: "red" }}>
        <span>x</span>
      </Container>,
    )
    const el = container.firstElementChild as HTMLElement
    // Base layout still applies.
    expect(el.style.maxWidth).toBe("1100px")
    expect(el.style.marginInline).toBe("auto")
    // Caller overrides still apply.
    expect(el.style.padding).toBe("12px")
    expect(el.style.color).toBe("red")
  })

  it("forwards testId as data-testid", () => {
    render(
      <Container testId="my-container">
        <span>x</span>
      </Container>,
    )
    expect(screen.getByTestId("my-container")).toBeInTheDocument()
  })
})
