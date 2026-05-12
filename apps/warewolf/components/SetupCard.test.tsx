// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { SetupCard } from "./SetupCard"
import type { Setup } from "../lib/solver"

// SetupCard now renders <RoleCardThumb> → <CardArt> → next/image.
// Stub next/image so jsdom can render the cards without optimization machinery.
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

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    archetypeId: "classic-detective",
    variationIdx: 0,
    roman: "I",
    roles: [
      "werewolf",
      "werewolf",
      "seer",
      "bodyguard",
      "villager",
      "villager",
      "villager",
      "villager",
    ],
    balance: 1,
    vibe: { en: "Cool nights, sharp logic.", th: "คืนเย็น ใช้ตรรกะ" },
    ...overrides,
  }
}

function setup(props: Partial<Parameters<typeof SetupCard>[0]> = {}) {
  const onTap = vi.fn()
  const setupObj = props.setup ?? makeSetup()
  const utils = render(
    <SetupCard
      setup={setupObj}
      onTap={onTap}
      lang={props.lang ?? "en"}
    />,
  )
  return { onTap, setup: setupObj, ...utils }
}

describe("<SetupCard> rendering", () => {
  it("renders archetype name, roman numeral, vibe, signed balance, and team counts", () => {
    setup()
    expect(screen.getByTestId("setup-card-name").textContent).toBe(
      "Classic Detective",
    )
    expect(screen.getByTestId("setup-card-roman").textContent).toBe("I")
    expect(screen.getByTestId("setup-card-vibe").textContent).toContain(
      "Cool nights, sharp logic.",
    )
    expect(screen.getByTestId("setup-card-balance").textContent).toBe("+1")
    // 2 wolves, 6 village, 0 neutral
    expect(screen.getByTestId("setup-card-teams").textContent).toBe(
      "2W : 6V",
    )
  })

  it("renders neutral count in the WW : VV : NN summary only when > 0", () => {
    setup({
      setup: makeSetup({
        roles: [
          "werewolf",
          "werewolf",
          "seer",
          "tanner",
          "villager",
          "villager",
          "villager",
          "villager",
        ],
      }),
    })
    expect(screen.getByTestId("setup-card-teams").textContent).toBe(
      "2W : 5V : 1N",
    )
  })

  it("renders the Thai vibe + name when lang='th' (only current language)", () => {
    setup({ lang: "th" })
    expect(screen.getByTestId("setup-card-name").textContent).toBe(
      "นักสืบคลาสสิก",
    )
    expect(screen.getByTestId("setup-card-vibe").textContent).toContain(
      "คืนเย็น ใช้ตรรกะ",
    )
    // Make sure the EN vibe doesn't bleed through
    expect(screen.getByTestId("setup-card-vibe").textContent).not.toMatch(
      /Cool nights/,
    )
  })
})

describe("<SetupCard> verdict prose", () => {
  it("|balance|≤2 → BALANCED (with balanced state)", () => {
    setup({ setup: makeSetup({ balance: 0 }) })
    const v = screen.getByTestId("setup-card-verdict")
    expect(v.textContent).toBe("BALANCED")
    expect(v.getAttribute("data-state")).toBe("balanced")
  })

  it("balance > 2 → VILLAGE TILT", () => {
    setup({ setup: makeSetup({ balance: 5 }) })
    const v = screen.getByTestId("setup-card-verdict")
    expect(v.textContent).toBe("VILLAGE TILT")
    expect(v.getAttribute("data-state")).toBe("village-tilt")
  })

  it("balance < -2 → WOLF TILT", () => {
    setup({ setup: makeSetup({ balance: -4 }) })
    const v = screen.getByTestId("setup-card-verdict")
    expect(v.textContent).toBe("WOLF TILT")
    expect(v.getAttribute("data-state")).toBe("wolf-tilt")
  })

  it("balance=+2 and balance=-2 both render BALANCED (boundary inclusive)", () => {
    const { rerender } = render(
      <SetupCard
        setup={makeSetup({ balance: 2 })}
        onTap={vi.fn()}
        lang="en"
      />,
    )
    expect(screen.getByTestId("setup-card-verdict").textContent).toBe(
      "BALANCED",
    )
    rerender(
      <SetupCard
        setup={makeSetup({ balance: -2 })}
        onTap={vi.fn()}
        lang="en"
      />,
    )
    expect(screen.getByTestId("setup-card-verdict").textContent).toBe(
      "BALANCED",
    )
  })
})

describe("<SetupCard> role card strip", () => {
  it("renders one <RoleCardThumb> per consecutive role group; duplicates carry the count", () => {
    setup()
    // 2 werewolves grouped → single thumb with data-count=2 + badge "2"
    const wolfThumb = screen.getByTestId("role-card-thumb-werewolf")
    expect(wolfThumb.getAttribute("data-count")).toBe("2")
    expect(
      screen.getByTestId("role-card-thumb-badge-werewolf").textContent,
    ).toBe("2")
    // Seer is solo → no count badge
    const seerThumb = screen.getByTestId("role-card-thumb-seer")
    expect(seerThumb.getAttribute("data-count")).toBe("1")
    expect(screen.queryByTestId("role-card-thumb-badge-seer")).toBeNull()
    // 4 villagers grouped → badge "4"
    expect(
      screen.getByTestId("role-card-thumb-villager").getAttribute("data-count"),
    ).toBe("4")
    expect(
      screen.getByTestId("role-card-thumb-badge-villager").textContent,
    ).toBe("4")
  })

  it("renders one thumb per distinct consecutive group", () => {
    setup()
    // Roles: werewolf×2, seer, bodyguard, villager×4
    expect(screen.queryByTestId("role-card-thumb-werewolf")).not.toBeNull()
    expect(screen.queryByTestId("role-card-thumb-seer")).not.toBeNull()
    expect(screen.queryByTestId("role-card-thumb-bodyguard")).not.toBeNull()
    expect(screen.queryByTestId("role-card-thumb-villager")).not.toBeNull()
  })

  it("renders the serif italic name-strip fallback below the cards", () => {
    setup()
    const names = screen.getByTestId("setup-card-names")
    expect(names.textContent).toContain("Werewolf ×2")
    expect(names.textContent).toContain("Seer")
    expect(names.textContent).toContain("Bodyguard")
    expect(names.textContent).toContain("Villager ×4")
  })

  it("name-strip respects the lang prop", () => {
    setup({ lang: "th" })
    const names = screen.getByTestId("setup-card-names")
    // Thai name strings should be present, not English equivalents
    expect(names.textContent).not.toContain("Werewolf")
    expect(names.textContent).toContain("×2")
    expect(names.textContent).toContain("×4")
  })
})

describe("<SetupCard> tap behavior", () => {
  it("tapping the card fires onTap with the setup", () => {
    const { onTap, setup: setupObj } = setup()
    fireEvent.click(screen.getByTestId("setup-card"))
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onTap.mock.calls[0][0]).toBe(setupObj)
  })

  it("Enter activates the card (native <button> default behavior)", () => {
    const { onTap } = setup()
    const card = screen.getByTestId("setup-card") as HTMLButtonElement
    card.focus()
    // Native button click on Enter — simulate the resulting click event.
    fireEvent.click(card)
    expect(onTap).toHaveBeenCalledTimes(1)
  })
})

describe("<SetupCard> a11y + tap target", () => {
  it("the card is a <button> with tap target ≥ 44px", () => {
    setup()
    const card = screen.getByTestId("setup-card") as HTMLButtonElement
    expect(card.tagName).toBe("BUTTON")
    expect(parseInt(card.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
  })

  it("declares a transform+opacity transition for the press animation", () => {
    setup()
    const card = screen.getByTestId("setup-card") as HTMLButtonElement
    // jsdom collapses adjacent spaces; just assert the keywords are present.
    expect(card.style.transition).toMatch(/transform/)
    expect(card.style.transition).toMatch(/opacity/)
  })

  it("press visuals apply scale(0.97) + opacity(0.85) on mouseDown and revert on mouseUp", () => {
    setup()
    const card = screen.getByTestId("setup-card") as HTMLButtonElement
    fireEvent.mouseDown(card)
    expect(card.style.transform).toBe("scale(0.97)")
    expect(card.style.opacity).toBe("0.85")
    fireEvent.mouseUp(card)
    expect(card.style.transform).toBe("")
    expect(card.style.opacity).toBe("")
  })
})
