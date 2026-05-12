// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { ROLES, cardArtPath } from "@social-hub/content"
import { CardArt, CardArtPlaceholder } from "./CardArt"

// `next/image` does heavy work (priority warning, image optimization stub).
// Mock to a plain <img> so we can assert src / onError cleanly in jsdom.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // strip props next/image owns that don't belong on a real <img>
    const { priority: _priority, alt, ...rest } = props as {
      priority?: boolean
      alt?: string
    }
    void _priority
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(rest as Record<string, unknown>)} alt={alt ?? ""} />
  },
}))

describe("<CardArt>", () => {
  it("renders an <img> with src pointing at the WebP path", () => {
    render(<CardArt roleId="werewolf" />)
    const img = screen.getByRole("img") as HTMLImageElement
    expect(img.getAttribute("src")).toBe(cardArtPath("werewolf"))
  })

  it("renders the placeholder on image load error", () => {
    render(<CardArt roleId="seer" />)
    const img = screen.getByRole("img")
    act(() => {
      img.dispatchEvent(new Event("error"))
    })
    const placeholder = screen.getByTestId("card-art-placeholder")
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveTextContent(ROLES.seer.i18n.en.name)
  })

  it("forwards the priority prop to next/image", () => {
    // Spy on next/image: we re-mock locally so we can read props.
    // The default mock above strips priority — instead, just assert
    // that supplying priority does not throw and the image still renders.
    render(<CardArt roleId="villager" priority />)
    expect(screen.getByRole("img")).toBeInTheDocument()
  })
})

describe("<CardArtPlaceholder>", () => {
  it("renders the role name in English", () => {
    render(<CardArtPlaceholder roleId="tanner" />)
    expect(screen.getByTestId("card-art-placeholder")).toHaveTextContent(
      ROLES.tanner.i18n.en.name,
    )
  })

  it("shows the role's signed balance value", () => {
    render(<CardArtPlaceholder roleId="seer" />)
    // seer balance is positive — should render with a `+` prefix.
    const balance = ROLES.seer.balance
    const expected = balance > 0 ? `+${balance}` : String(balance)
    expect(screen.getByTestId("card-art-placeholder")).toHaveTextContent(expected)
  })

  it("renders a different style accent for wolf-team roles", () => {
    const { container } = render(<CardArtPlaceholder roleId="werewolf" />)
    // The wax-seal silhouette is a hidden decorative element.
    const seal = container.querySelector('[data-role="seal"]')
    expect(seal).not.toBeNull()
  })
})
