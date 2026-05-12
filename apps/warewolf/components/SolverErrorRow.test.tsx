// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ARCHETYPES } from "../lib/archetypes"
import { SolverErrorRow } from "./SolverErrorRow"

describe("<SolverErrorRow>", () => {
  it("renders the warn glyph plus the archetype name and player count", () => {
    render(<SolverErrorRow archetypeId="wolf-chaos" playerCount={9} />)
    const row = screen.getByTestId("solver-error-row")
    expect(row).toHaveTextContent("⚠")
    expect(row).toHaveTextContent(ARCHETYPES["wolf-chaos"].i18n.en.name)
    expect(row).toHaveTextContent("9p")
  })

  it("includes the canonical error sentence", () => {
    render(<SolverErrorRow archetypeId="classic-detective" playerCount={12} />)
    expect(screen.getByTestId("solver-error-row")).toHaveTextContent(
      /Solver can't balance this/i,
    )
  })

  it("declares role='alert' so the failure announces to assistive tech", () => {
    render(<SolverErrorRow archetypeId="info-heavy" playerCount={8} />)
    expect(screen.getByTestId("solver-error-row")).toHaveAttribute("role", "alert")
  })
})
