// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { ROLES } from "@social-hub/content"
import { AddRoleSheet } from "./AddRoleSheet"
import { TABS } from "../lib/category-tabs"

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

function renderSheet(
  overrides: Partial<Parameters<typeof AddRoleSheet>[0]> = {},
) {
  const onAdd = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <AddRoleSheet
      initialTab={overrides.initialTab ?? "wolves"}
      existingSetup={overrides.existingSetup ?? []}
      onAdd={overrides.onAdd ?? onAdd}
      onClose={overrides.onClose ?? onClose}
      lang={overrides.lang ?? "en"}
    />,
  )
  return { onAdd, onClose, ...utils }
}

describe("<AddRoleSheet> tabs", () => {
  it("renders all 6 tabs in TABS display order", () => {
    renderSheet()
    for (const tab of TABS) {
      expect(screen.queryByTestId(`add-role-tab-${tab}`)).not.toBeNull()
    }
    // Order matches TABS
    const tabButtons = screen.getAllByTestId(/^add-role-tab-/)
    expect(tabButtons.map((b) => b.getAttribute("data-tab"))).toEqual([
      ...TABS,
    ])
  })

  it("pre-selects initialTab (Replace flow → swapped role's tab)", () => {
    renderSheet({ initialTab: "info" })
    const infoTab = screen.getByTestId("add-role-tab-info")
    expect(infoTab.getAttribute("aria-selected")).toBe("true")
    const wolvesTab = screen.getByTestId("add-role-tab-wolves")
    expect(wolvesTab.getAttribute("aria-selected")).toBe("false")
  })

  it("switching tabs filters the candidate roles", () => {
    renderSheet({ initialTab: "wolves" })
    // wolves tab shows the werewolf
    expect(
      within(screen.getByTestId("add-role-candidates")).queryByTestId(
        "add-role-candidate-werewolf",
      ),
    ).not.toBeNull()
    expect(
      within(screen.getByTestId("add-role-candidates")).queryByTestId(
        "add-role-candidate-seer",
      ),
    ).toBeNull()

    fireEvent.click(screen.getByTestId("add-role-tab-info"))
    // info tab shows the seer; werewolf no longer present
    expect(
      within(screen.getByTestId("add-role-candidates")).queryByTestId(
        "add-role-candidate-seer",
      ),
    ).not.toBeNull()
    expect(
      within(screen.getByTestId("add-role-candidates")).queryByTestId(
        "add-role-candidate-werewolf",
      ),
    ).toBeNull()
  })
})

describe("<AddRoleSheet> candidate cards", () => {
  it("each candidate shows the role name + balance delta if added to existing setup", () => {
    renderSheet({
      initialTab: "info",
      existingSetup: ["villager", "villager"],
      lang: "en",
    })
    const seerCard = screen.getByTestId("add-role-candidate-seer")
    expect(seerCard.textContent).toContain(ROLES.seer.i18n.en.name)
    // Adding the seer (+7) to a setup of balance 0 → delta +7
    expect(
      within(seerCard).getByTestId("add-role-delta-seer").textContent,
    ).toContain("+")
  })

  it("renders Thai name when lang='th'", () => {
    renderSheet({ initialTab: "info", lang: "th" })
    const seerCard = screen.getByTestId("add-role-candidate-seer")
    expect(seerCard.textContent).toContain(ROLES.seer.i18n.th.name)
  })
})

describe("<AddRoleSheet> add behavior (multi-add)", () => {
  it("tapping a candidate fires onAdd and keeps the sheet open (no onClose)", () => {
    const { onAdd, onClose } = renderSheet({ initialTab: "wolves" })
    fireEvent.click(screen.getByTestId("add-role-candidate-werewolf"))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith("werewolf")
    // Sheet stays open
    expect(onClose).not.toHaveBeenCalled()
    // Sheet element still in the DOM
    expect(screen.queryByTestId("add-role-sheet")).not.toBeNull()
  })

  it("supports multi-add — tapping the same card twice fires onAdd twice", () => {
    const { onAdd } = renderSheet({ initialTab: "wolves" })
    const card = screen.getByTestId("add-role-candidate-werewolf")
    fireEvent.click(card)
    fireEvent.click(card)
    expect(onAdd).toHaveBeenCalledTimes(2)
  })
})

describe("<AddRoleSheet> dismissal", () => {
  it("X button fires onClose", () => {
    const { onClose } = renderSheet()
    fireEvent.click(screen.getByTestId("add-role-close"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("Escape key fires onClose", () => {
    const { onClose } = renderSheet()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
