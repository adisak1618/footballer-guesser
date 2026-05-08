import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOrCreatePlayerId, readPlayerId } from "../player-id"

const memoryStore = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memoryStore.set(k, v)
  },
  removeItem: (k: string) => {
    memoryStore.delete(k)
  },
  clear: () => {
    memoryStore.clear()
  },
}

beforeEach(() => {
  memoryStore.clear()
  vi.stubGlobal("window", { localStorage: localStorageMock })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("getOrCreatePlayerId", () => {
  it("generates and persists a UUID under <namespace>_player_id when missing", () => {
    expect(localStorageMock.getItem("headball_player_id")).toBeNull()
    const id = getOrCreatePlayerId("headball")
    expect(id).toMatch(UUID_V4_RE)
    expect(localStorageMock.getItem("headball_player_id")).toBe(id)
  })

  it("returns the existing value on subsequent reads", () => {
    const first = getOrCreatePlayerId("headball")
    const second = getOrCreatePlayerId("headball")
    expect(second).toBe(first)
  })

  it("namespaces by game — different namespaces produce independent ids", () => {
    const headballId = getOrCreatePlayerId("headball")
    const insiderId = getOrCreatePlayerId("insider")
    expect(headballId).not.toBe(insiderId)
    expect(localStorageMock.getItem("headball_player_id")).toBe(headballId)
    expect(localStorageMock.getItem("insider_player_id")).toBe(insiderId)
  })

  it("throws when called outside a browser context (no window)", () => {
    vi.stubGlobal("window", undefined)
    expect(() => getOrCreatePlayerId("headball")).toThrow(
      /must be called on the client/,
    )
  })
})

describe("readPlayerId", () => {
  it("returns null when nothing is stored for the namespace", () => {
    expect(readPlayerId("headball")).toBeNull()
  })

  it("returns the stored id without writing", () => {
    const id = getOrCreatePlayerId("headball")
    expect(readPlayerId("headball")).toBe(id)
  })

  it("returns null for an unrelated namespace", () => {
    getOrCreatePlayerId("headball")
    expect(readPlayerId("insider")).toBeNull()
  })

  it("returns null when called outside a browser context (no window)", () => {
    vi.stubGlobal("window", undefined)
    expect(readPlayerId("headball")).toBeNull()
  })
})
