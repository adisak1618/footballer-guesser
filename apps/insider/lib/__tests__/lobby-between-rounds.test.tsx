/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

// Mocks for the dependencies the Lobby reaches into. We're focused on the
// between-rounds UI variants — pack chips visible to host, read-only label
// visible to non-host, dialog gating on RESET GAME — not on the realtime
// plumbing or the asking/voting/reveal sub-screens (those have their own
// tests + are exercised by Playwright in apps/insider/e2e).

const HOST_ID = "00000000-0000-4000-8000-000000000001"
const OTHER_ID = "00000000-0000-4000-8000-000000000002"

const state = vi.hoisted(() => {
  const HOST = "00000000-0000-4000-8000-000000000001"
  return {
    mockRoom: {
      id: "00000000-0000-4000-8000-000000000010",
      code: "INS24Z",
      status: "LOBBY",
      host_player_id: HOST,
      current_round: 1 as number,
      max_rounds: 5,
      rounds_locked: true,
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

// Wire the table-aware behavior after the hoisted blocks (vi.fn was constructed
// above; we just configure its implementation here).
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
  if (table === "game_insider_round") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { phase: "reveal" },
              error: null,
            }),
          }),
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
vi.mock("@/app/actions/join-insider-room", () => ({
  joinInsiderRoomAction: vi.fn(async () => ({ ok: true, playerId: HOST_ID })),
}))

// stub UI bits we don't care about — minimize render footprint.
vi.mock("@social-hub/ui", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@social-hub/ui")
  return actual
})

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
    code: "INS24Z",
    status: "LOBBY",
    host_player_id: HOST_ID,
    current_round: 1,
    max_rounds: 5,
    rounds_locked: true,
  }
  state.mockPlayers = [
    { id: "p1", player_id: HOST_ID, display_name: "Host", join_order: 1 },
    { id: "p2", player_id: OTHER_ID, display_name: "Other", join_order: 2 },
    { id: "p3", player_id: "0000-x-3", display_name: "Three", join_order: 3 },
  ]
  state.mockMePlayerId = HOST_ID
  state.mockPackSlug = "football-premier-league"

  // jsdom does not implement HTMLDialogElement.showModal/close — polyfill so
  // the RESET GAME confirm flow doesn't throw on click.
  if (
    typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal !== "function"
  ) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "")
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open")
    }
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("LobbyView between-rounds variant (issue #24)", () => {
  it("host between rounds sees editable pack chips + RESET GAME button", async () => {
    render(<Lobby code="INS24Z" packs={PACKS} />)

    // Host pack chips render (radiogroup with PackChip role=radio).
    await waitFor(() => {
      expect(
        screen.getByTestId("pack-chip-football-premier-league"),
      ).toBeInTheDocument()
    })
    expect(screen.getByTestId("pack-chip-football-la-liga")).toBeInTheDocument()
    expect(screen.getByTestId("insider-reset-game-cta")).toBeInTheDocument()

    // Read-only label is NOT shown to host.
    expect(
      screen.queryByTestId("insider-pack-readonly"),
    ).not.toBeInTheDocument()
  })

  it("non-host between rounds sees read-only Pack label and no destructive controls", async () => {
    state.mockMePlayerId = OTHER_ID
    render(<Lobby code="INS24Z" packs={PACKS} />)

    await waitFor(() => {
      expect(screen.getByTestId("insider-pack-readonly")).toBeInTheDocument()
    })

    expect(
      screen.queryByTestId("pack-chip-football-premier-league"),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("insider-reset-game-cta")).not.toBeInTheDocument()
  })

  it("RESET GAME opens custom <dialog> confirm (not native confirm)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(<Lobby code="INS24Z" packs={PACKS} />)

    const reset = await screen.findByTestId("insider-reset-game-cta")
    // jsdom's HTMLDialogElement.showModal exists but doesn't toggle :modal;
    // we assert the element is in the DOM and confirm CTAs render after click.
    await user.click(reset)
    expect(
      screen.getByTestId("insider-reset-confirm-dialog"),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("insider-reset-confirm-cta"),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("insider-reset-cancel-cta"),
    ).toBeInTheDocument()
  })

  it("initial-lobby (current_round=0) still hides RESET (no rounds played yet)", async () => {
    // Issue #27 — RoomSetupPanel now renders in BOTH initial lobby and
    // between-rounds, so the pack-chip-* selectors are visible at
    // current_round=0. The RESET GAME button still requires
    // isBetweenRounds (current_round >= 1) — see LobbyView. Coverage of
    // category chips in the initial lobby itself lives in
    // lobby-initial-setup.test.tsx.
    state.mockRoom = {
      ...state.mockRoom,
      current_round: 0,
      rounds_locked: false,
    }
    render(<Lobby code="INS24Z" packs={PACKS} />)

    await waitFor(() => {
      expect(screen.getByTestId("insider-player-list")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("insider-reset-game-cta")).not.toBeInTheDocument()
  })
})
