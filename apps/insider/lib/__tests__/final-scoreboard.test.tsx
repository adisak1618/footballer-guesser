/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

// vi.mock factories are hoisted to the top of the file. To share state with
// the mocks, we use vi.hoisted so the helpers also run pre-import.
const mocks = vi.hoisted(() => {
  const fakePlayers = [
    { id: "p1", player_id: "host", display_name: "Host", join_order: 1, total_score: 7 },
    { id: "p2", player_id: "alice", display_name: "Alice", join_order: 2, total_score: 12 },
    { id: "p3", player_id: "bob", display_name: "Bob", join_order: 3, total_score: 4 },
  ]
  const supabaseMock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: fakePlayers, error: null })),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    })),
    removeChannel: vi.fn(),
  }
  const advanceToRevealMock = vi.fn(async (..._args: unknown[]) => undefined)
  const startActionMock = vi.fn(async (_input: unknown) => ({
    ok: true as const,
    roundNumber: 1,
  }))
  const resetActionMock = vi.fn(async (_input: unknown) => ({ ok: true as const }))
  return {
    supabaseMock,
    advanceToRevealMock,
    startActionMock,
    resetActionMock,
  }
})

vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabaseMock }))
vi.mock("@/lib/insider-rpc", () => ({
  advanceToReveal: mocks.advanceToRevealMock,
}))
vi.mock("@/app/actions/start-insider-round", () => ({
  startInsiderRoundAction: mocks.startActionMock,
}))
vi.mock("@/app/actions/reset-insider-game", () => ({
  resetInsiderGameAction: mocks.resetActionMock,
}))

import { FinalScoreboard } from "@/app/room/[code]/final-scoreboard"

beforeEach(() => {
  mocks.advanceToRevealMock.mockClear()
  mocks.startActionMock.mockClear()
  mocks.resetActionMock.mockClear()
  mocks.supabaseMock.from.mockClear()
  mocks.supabaseMock.channel.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("FinalScoreboard (issue #24)", () => {
  it("renders GAME OVER header + leaderboard sorted desc by total_score", async () => {
    render(
      <FinalScoreboard
        roomId="room-1"
        round={5}
        mePlayerId="host"
        isHost
        phase="reveal"
      />,
    )

    expect(screen.getByTestId("insider-final-header")).toHaveTextContent(
      "GAME OVER",
    )

    await waitFor(() => {
      expect(screen.getByTestId("insider-final-winner-name")).toHaveTextContent(
        "ALICE",
      )
    })

    expect(screen.getByTestId("insider-final-winner-score")).toHaveTextContent(
      "12 pts",
    )

    const rows = screen.getAllByTestId(/insider-final-row-/)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute("data-rank", "1")
    expect(rows[0].dataset.testid).toBe("insider-final-row-alice")
    expect(rows[1]).toHaveAttribute("data-rank", "2")
    expect(rows[1].dataset.testid).toBe("insider-final-row-host")
    expect(rows[2]).toHaveAttribute("data-rank", "3")
    expect(rows[2].dataset.testid).toBe("insider-final-row-bob")
  })

  it("fires advance_to_reveal on mount (idempotent scoring seal)", async () => {
    render(
      <FinalScoreboard
        roomId="room-2"
        round={5}
        mePlayerId="host"
        isHost
        phase="reveal"
      />,
    )

    await waitFor(() => {
      expect(mocks.advanceToRevealMock).toHaveBeenCalledWith(mocks.supabaseMock, {
        roomId: "room-2",
        round: 5,
      })
    })
  })

  it("PLAY AGAIN CTA is host-only — non-host sees disabled state with rest copy", async () => {
    render(
      <FinalScoreboard
        roomId="room-3"
        round={5}
        mePlayerId="alice"
        isHost={false}
        phase="reveal"
      />,
    )

    const cta = await screen.findByTestId("insider-final-play-again-cta")
    expect(cta).toBeDisabled()
    expect(cta).toHaveTextContent("รอโฮสต์เริ่มเกมใหม่")

    const back = screen.getByTestId("insider-final-back-to-lobby-cta")
    expect(back).toBeDisabled()
  })

  it("BACK TO LOBBY calls resetInsiderGameAction (no startInsiderRound)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(
      <FinalScoreboard
        roomId="room-4"
        round={5}
        mePlayerId="host"
        isHost
        phase="reveal"
      />,
    )

    const cta = await screen.findByTestId("insider-final-back-to-lobby-cta")
    await user.click(cta)

    await waitFor(() => {
      expect(mocks.resetActionMock).toHaveBeenCalledWith({
        roomId: "room-4",
        playerId: "host",
      })
    })
    expect(mocks.startActionMock).not.toHaveBeenCalled()
  })

  it("PLAY AGAIN calls reset then startInsiderRound", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(
      <FinalScoreboard
        roomId="room-5"
        round={5}
        mePlayerId="host"
        isHost
        phase="reveal"
      />,
    )

    const cta = await screen.findByTestId("insider-final-play-again-cta")
    await user.click(cta)

    await waitFor(() => {
      expect(mocks.resetActionMock).toHaveBeenCalledWith({
        roomId: "room-5",
        playerId: "host",
      })
      expect(mocks.startActionMock).toHaveBeenCalledWith({
        roomId: "room-5",
        playerId: "host",
      })
    })
  })
})
