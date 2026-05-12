import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { RoleId } from "@social-hub/content"
import type { ArchetypeId } from "./archetypes"

type Lang = "en" | "th"

export interface WarewolfState {
  playerCount: number
  activeFilters: Set<ArchetypeId>
  currentSetup: RoleId[]
  dirty: boolean
  lang: Lang
  setPlayerCount: (n: number) => void
  toggleArchetypeFilter: (id: ArchetypeId) => void
  setCurrentSetup: (roles: RoleId[]) => void
  markDirty: () => void
  setLang: (lang: Lang) => void
  reset: () => void
}

const initialState = {
  playerCount: 8,
  activeFilters: new Set<ArchetypeId>(),
  currentSetup: [] as RoleId[],
  dirty: false,
  lang: "en" as Lang,
}

export const useWarewolfStore = create<WarewolfState>()(
  persist(
    (set) => ({
      ...initialState,
      setPlayerCount: (n) => set({ playerCount: n }),
      toggleArchetypeFilter: (id) =>
        set((s) => {
          const next = new Set(s.activeFilters)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { activeFilters: next }
        }),
      setCurrentSetup: (roles) => set({ currentSetup: roles, dirty: false }),
      markDirty: () => set({ dirty: true }),
      setLang: (lang) => set({ lang }),
      reset: () => set({ ...initialState, activeFilters: new Set() }),
    }),
    {
      name: "warewolf-store",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: typeof window === "undefined",
      partialize: (s) => ({ lang: s.lang }),
    },
  ),
)
