// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { RoleCardThumb } from "./RoleCardThumb"

// Stub next/image with a plain <img> so we can assert on the DOM in jsdom.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { priority: _priority, alt, ...rest } = props as {
      priority?: boolean
      alt?: string
    }
    void _priority
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(rest as Record<string, unknown>)} alt={alt ?? ""} />
  },
}))

describe("<RoleCardThumb> basics", () => {
  it("renders the role card art via <CardArt>", () => {
    render(<RoleCardThumb roleId="werewolf" />)
    const thumb = screen.getByTestId("role-card-thumb-werewolf")
    expect(thumb).not.toBeNull()
    // CardArt renders next/image (mocked → <img>)
    const img = thumb.querySelector("img")
    expect(img).not.toBeNull()
  })

  it("defaults to count=1 with no badge", () => {
    render(<RoleCardThumb roleId="seer" />)
    expect(screen.queryByTestId("role-card-thumb-badge-seer")).toBeNull()
    expect(
      screen.getByTestId("role-card-thumb-seer").getAttribute("data-count"),
    ).toBe("1")
  })

  it("renders the count badge when count > 1", () => {
    render(<RoleCardThumb roleId="werewolf" count={3} />)
    const badge = screen.getByTestId("role-card-thumb-badge-werewolf")
    expect(badge.textContent).toBe("3")
  })
})

describe("<RoleCardThumb> accessibility", () => {
  it("declares role=img with the singular role name when count=1", () => {
    render(<RoleCardThumb roleId="witch" lang="en" />)
    const thumb = screen.getByTestId("role-card-thumb-witch")
    expect(thumb.getAttribute("role")).toBe("img")
    expect(thumb.getAttribute("aria-label")).toBe("Witch")
  })

  it("aria-label includes the count when count > 1", () => {
    render(<RoleCardThumb roleId="werewolf" count={2} lang="en" />)
    expect(
      screen.getByTestId("role-card-thumb-werewolf").getAttribute("aria-label"),
    ).toBe("Werewolf, 2 copies")
  })

  it("uses Thai name when lang='th'", () => {
    render(<RoleCardThumb roleId="werewolf" count={2} lang="th" />)
    const thumb = screen.getByTestId("role-card-thumb-werewolf")
    // Thai name should be present, not the English "Werewolf"
    const label = thumb.getAttribute("aria-label") ?? ""
    expect(label).not.toContain("Werewolf")
    expect(label).toContain("2 copies")
  })

  it("count badge is aria-hidden (already announced via aria-label)", () => {
    render(<RoleCardThumb roleId="werewolf" count={4} />)
    const badge = screen.getByTestId("role-card-thumb-badge-werewolf")
    expect(badge.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("<RoleCardThumb> name overlay", () => {
  it("renders the name overlay by default", () => {
    render(<RoleCardThumb roleId="seer" />)
    expect(screen.queryByTestId("role-card-thumb-name-seer")).not.toBeNull()
  })

  it("hides the name overlay when showNameOverlay=false", () => {
    render(<RoleCardThumb roleId="seer" showNameOverlay={false} />)
    expect(screen.queryByTestId("role-card-thumb-name-seer")).toBeNull()
  })

  it("name overlay text matches the resolved lang", () => {
    render(<RoleCardThumb roleId="seer" lang="en" />)
    expect(screen.getByTestId("role-card-thumb-name-seer").textContent).toBe(
      "Seer",
    )
  })
})

describe("<RoleCardThumb> sizing", () => {
  it("defaults to 96px width (2× post PR #34 review)", () => {
    render(<RoleCardThumb roleId="seer" />)
    const thumb = screen.getByTestId("role-card-thumb-seer") as HTMLElement
    expect(thumb.style.width).toBe("96px")
  })

  it("respects width prop", () => {
    render(<RoleCardThumb roleId="seer" width={64} />)
    const thumb = screen.getByTestId("role-card-thumb-seer") as HTMLElement
    expect(thumb.style.width).toBe("64px")
  })
})
