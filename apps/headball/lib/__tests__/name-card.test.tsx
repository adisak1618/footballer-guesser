import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NameCard } from "@/components/name-card"
import type { Player, RoundState } from "@/lib/types"

vi.mock("@/app/actions/submit-guess", () => ({
  submitGuessAction: vi.fn(),
}))

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

const me: Player = {
  id: "player-row-1",
  player_id: "p1",
  room_id: "r1",
  display_name: "Tester",
  join_order: 1,
  total_score: 0,
  connected: true,
}

const myRoundState: RoundState = {
  id: "rs1",
  room_id: "r1",
  player_id: "p1",
  round_number: 1,
  assigned_name: "Steven Gerrard",
  is_active: true,
  is_correct: null,
  final_position: null,
  score_this_round: null,
}

function setup() {
  return render(
    <NameCard
      me={me}
      roomId="r1"
      round={1}
      maxRounds={5}
      myRoundState={myRoundState}
    />,
  )
}

describe("NameCard hero name reveal", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "")
    }
  })

  it("renders the assigned name in the BIG NAME card by default", () => {
    setup()
    const hero = screen.getByTestId("hero-name")
    expect(hero.textContent).toBe("STEVEN GERRARD")
  })

  it("swaps the hero text to ??? when the guess popup is open", () => {
    setup()
    fireEvent.click(screen.getByLabelText("แตะเพื่อเปิดตัวเลือก"))
    fireEvent.click(screen.getByRole("button", { name: /ทายชื่อ/ }))

    const hero = screen.getByTestId("hero-name")
    expect(hero.textContent).toBe("???")
    expect(hero.textContent).not.toContain("STEVEN")
  })
})
