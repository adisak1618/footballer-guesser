// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

// Node 25 ships a built-in localStorage that is non-functional without
// --localstorage-file=<path>; the broken one shadows jsdom's. Install an
// in-memory Storage shim before the store module is imported.
const memoryStorage = (() => {
  const store = new Map<string, string>()
  const api: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k)
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
  }
  return api
})()
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true })
Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true })

const { useWarewolfStore } = await import("./store")

const PERSIST_KEY = "warewolf-store"

function resetStore() {
  window.localStorage.clear()
  useWarewolfStore.setState({
    playerCount: 8,
    activeFilters: new Set(),
    currentSetup: [],
    dirty: false,
    lang: "en",
  })
}

describe("useWarewolfStore", () => {
  beforeEach(() => {
    resetStore()
  })

  it("default state matches spec", () => {
    const s = useWarewolfStore.getState()
    expect(s.playerCount).toBe(8)
    expect(s.activeFilters).toBeInstanceOf(Set)
    expect(s.activeFilters.size).toBe(0)
    expect(s.currentSetup).toEqual([])
    expect(s.dirty).toBe(false)
    expect(s.lang).toBe("en")
  })

  it("toggleArchetypeFilter adds then removes from the set", () => {
    useWarewolfStore.getState().toggleArchetypeFilter("classic-detective")
    expect(useWarewolfStore.getState().activeFilters.has("classic-detective")).toBe(true)
    useWarewolfStore.getState().toggleArchetypeFilter("classic-detective")
    expect(useWarewolfStore.getState().activeFilters.has("classic-detective")).toBe(false)
  })

  it("setCurrentSetup populates roles and clears dirty", () => {
    useWarewolfStore.getState().markDirty()
    expect(useWarewolfStore.getState().dirty).toBe(true)
    useWarewolfStore.getState().setCurrentSetup(["werewolf", "villager", "seer"])
    const s = useWarewolfStore.getState()
    expect(s.currentSetup).toEqual(["werewolf", "villager", "seer"])
    expect(s.dirty).toBe(false)
  })

  it("markDirty flips dirty to true", () => {
    expect(useWarewolfStore.getState().dirty).toBe(false)
    useWarewolfStore.getState().markDirty()
    expect(useWarewolfStore.getState().dirty).toBe(true)
  })

  it("setPlayerCount updates value", () => {
    useWarewolfStore.getState().setPlayerCount(12)
    expect(useWarewolfStore.getState().playerCount).toBe(12)
  })

  it("lang persists to localStorage across hydrations", async () => {
    useWarewolfStore.getState().setLang("th")
    // Flush any microtasks queued by persist middleware.
    await Promise.resolve()
    const raw = window.localStorage.getItem(PERSIST_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.state.lang).toBe("th")
    // Re-hydrate from storage; lang should be restored.
    await useWarewolfStore.persist.rehydrate()
    expect(useWarewolfStore.getState().lang).toBe("th")
  })

  it("partialize only persists lang (transient state stays in-memory)", async () => {
    useWarewolfStore.getState().setPlayerCount(15)
    useWarewolfStore.getState().toggleArchetypeFilter("classic-detective")
    useWarewolfStore.getState().setLang("th")
    await Promise.resolve()
    const raw = window.localStorage.getItem(PERSIST_KEY)
    const parsed = JSON.parse(raw as string)
    expect(parsed.state).toEqual({ lang: "th" })
  })

  it("reset returns to initial state", () => {
    useWarewolfStore.getState().setPlayerCount(11)
    useWarewolfStore.getState().toggleArchetypeFilter("classic-detective")
    useWarewolfStore.getState().markDirty()
    useWarewolfStore.getState().reset()
    const s = useWarewolfStore.getState()
    expect(s.playerCount).toBe(8)
    expect(s.activeFilters.size).toBe(0)
    expect(s.dirty).toBe(false)
  })
})
