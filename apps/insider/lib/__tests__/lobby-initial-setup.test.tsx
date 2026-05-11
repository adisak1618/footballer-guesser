/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

// Issue #27 — initial-lobby variant of the Insider Lobby. The /new host-setup
// screen is deleted; the lobby is now the canonical surface for pre-game
// category + max_rounds selection. This file covers:
//   - host sees editable category chips + max_rounds stepper at current_round=0
//   - non-host sees read-only Category label + read-only Rounds value
//   - max_rounds stepper is enabled when rounds_locked=false
//
// Sibling lobby-between-rounds.test.tsx covers the post-round flow
// (current_round >= 1) and the RESET GAME confirm dialog.

const HOST_ID = "00000000-0000-4000-8000-000000000001"
const OTHER_ID = "00000000-0000-4000-8000-000000000002"

const state = vi.hoisted(() => {
  const HOST = "00000000-0000-4000-8000-000000000001"
  return {
    mockRoom: {
      id: "00000000-0000-4000-8000-000000000010",
      code: "INS27Z",
      status: "LOBBY",
      host_player_id: HOST,
      current_round: 0 as number,
      max_rounds: 5,
      rounds_locked: false,
    },
    mockPlayers: [] as Array<{
      id: string
      player_id: string
      display_name: string
      join_order: number
    }>,
    mockMePlayerId: HOST,
    mockPackSlug: "football-premier-league",
  }
})

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}))

supabaseMock.from.mockImplementation((table: string) => {
  if (table === "rooms") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.mockRoom, error: null }),
        }),
      }),
    }
  }
  if (table === "players") {
    return {
      select: () => ({
        eq: () => ({
          order: async () => ({ data: state.mockPlayers, error: null }),
        }),
      }),
    }
  }
  if (table === "game_insider_room_config") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { pack_slug: state.mockPackSlug },
            error: null,
          }),
        }),
      }),
    }
  }
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
  }
})
supabaseMock.channel.mockImplementation(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/supabase", () => ({ supabase: supabaseMock }))
vi.mock("@/lib/player-id", () => ({
  readPlayerId: () => state.mockMePlayerId,
  getOrCreatePlayerId: () => state.mockMePlayerId,
}))
vi.mock("@social-hub/core", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@social-hub/core")
  return {
    ...actual,
    useRoomRealtime: () => undefined,
  }
})
vi.mock("@/app/actions/start-insider-round", () => ({
  startInsiderRoundAction: vi.fn(async () => ({ ok: true, roundNumber: 1 })),
}))
vi.mock("@/app/actions/reset-insider-game", () => ({
  resetInsiderGameAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock("@/app/actions/change-insider-pack", () => ({
  changeInsiderPackAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock("@/app/actions/change-insider-max-rounds", () => ({
  changeInsiderMaxRoundsAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock("@/app/actions/join-insider-room", () => ({
  joinInsiderRoomAction: vi.fn(async () => ({ ok: true, playerId: HOST_ID })),
}))

import { Lobby } from "@/app/room/[code]/lobby"

const PACKS = [
  {
    slug: "football-premier-league",
    displayName: "Premier League",
    displayNameTh: "พรีเมียร์ลีก",
    handler: "football_category",
  },
  {
    slug: "football-la-liga",
    displayName: "La Liga",
    displayNameTh: "ลาลีกา",
    handler: "football_category",
  },
]

beforeEach(() => {
  state.mockRoom = {
    id: "00000000-0000-4000-8000-000000000010",
    code: "INS27Z",
    status: "LOBBY",
    host_player_id: HOST_ID,
    current_round: 0,
    max_rounds: 5,
    rounds_locked: false,
  }
  state.mockPlayers = [
    { id: "p1", player_id: HOST_ID, display_name: "Host", join_order: 1 },
    { id: "p2", player_id: OTHER_ID, display_name: "Other", join_order: 2 },
    { id: "p3", player_id: "0000-x-3", display_name: "Three", join_order: 3 },
  ]
  state.mockMePlayerId = HOST_ID
  state.mockPackSlug = "football-premier-league"
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("LobbyView initial-setup variant (issue #27)", () => {
  it("host in initial lobby sees the RoomSetupPanel with editable category chips", async () => {
    render(<Lobby code="INS27Z" packs={PACKS} />)

    await waitFor(() => {
      expect(screen.getByTestId("room-setup-panel")).toBeInTheDocument()
    })

    // Editable category chips (category is never locked in initial lobby).
    expect(
      screen.getByTestId("pack-chip-football-premier-league"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("pack-chip-football-la-liga")).toBeInTheDocument()

    // Non-host read-only path is NOT shown to host.
    expect(screen.queryByTestId("insider-pack-readonly")).not.toBeInTheDocument()
    expect(screen.queryByTestId("insider-rounds-readonly")).not.toBeInTheDocument()
  })

  it("host in initial lobby sees an enabled max_rounds stepper (rounds_locked=false)", async () => {
    render(<Lobby code="INS27Z" packs={PACKS} />)

    const control = await screen.findByTestId("insider-rounds-control")
    expect(control).toBeInTheDocument()

    const input = screen.getByTestId("insider-rounds-input") as HTMLInputElement
    expect(input.disabled).toBe(false)
    expect(input.value).toBe("5")

    const dec = screen.getByTestId("insider-rounds-dec") as HTMLButtonElement
    const inc = screen.getByTestId("insider-rounds-inc") as HTMLButtonElement
    expect(dec.disabled).toBe(false)
    expect(inc.disabled).toBe(false)

    // Panel surfaces options-locked=false in data attrs.
    expect(
      screen.getByTestId("room-setup-panel").getAttribute("data-options-locked"),
    ).toBe("false")
  })

  it("host max_rounds stepper is disabled once rounds_locked=true", async () => {
    state.mockRoom = {
      ...state.mockRoom,
      current_round: 0,
      rounds_locked: true,
    }
    render(<Lobby code="INS27Z" packs={PACKS} />)

    const input = (await screen.findByTestId(
      "insider-rounds-input",
    )) as HTMLInputElement
    expect(input.disabled).toBe(true)

    const dec = screen.getByTestId("insider-rounds-dec") as HTMLButtonElement
    const inc = screen.getByTestId("insider-rounds-inc") as HTMLButtonElement
    expect(dec.disabled).toBe(true)
    expect(inc.disabled).toBe(true)

    expect(
      screen.getByTestId("room-setup-panel").getAttribute("data-options-locked"),
    ).toBe("true")
  })

  it("non-host in initial lobby sees read-only category + rounds and no chips", async () => {
    state.mockMePlayerId = OTHER_ID
    render(<Lobby code="INS27Z" packs={PACKS} />)

    await waitFor(() => {
      expect(screen.getByTestId("insider-pack-readonly")).toBeInTheDocument()
    })

    expect(screen.getByTestId("insider-rounds-readonly")).toBeInTheDocument()
    expect(screen.getByTestId("insider-rounds-readonly-value").textContent).toBe(
      "5",
    )

    expect(
      screen.queryByTestId("pack-chip-football-premier-league"),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("insider-rounds-control")).not.toBeInTheDocument()
  })

  it("initial lobby does not surface the RESET GAME control (no rounds played yet)", async () => {
    render(<Lobby code="INS27Z" packs={PACKS} />)
    await waitFor(() => {
      expect(screen.getByTestId("room-setup-panel")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("insider-reset-game-cta")).not.toBeInTheDocument()
  })
})
