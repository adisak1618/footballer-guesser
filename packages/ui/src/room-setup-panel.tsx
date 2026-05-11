"use client"

import type { ReactNode } from "react"

import { cn } from "./utils"

// Shared pre-game setup panel used by Headball + Insider lobbies. Slot-based
// (no game-specific branching): each game injects its category picker (and
// optionally extra options like Insider's max_rounds stepper). Non-host view
// is read-only — slot consumers are responsible for honoring `isHost`.

export interface RoomSetupPanelLockState {
  category: boolean
  options?: boolean
}

export interface RoomSetupPanelProps {
  categorySlot: ReactNode
  optionsSlot?: ReactNode
  lockState: RoomSetupPanelLockState
  isHost: boolean
  /** Optional label override; defaults to "Game Settings" / "Read only". */
  headingLabel?: string
  className?: string
}

export function RoomSetupPanel({
  categorySlot,
  optionsSlot,
  lockState,
  isHost,
  headingLabel = "Game Settings",
  className,
}: RoomSetupPanelProps) {
  return (
    <section
      aria-label="ตั้งค่าเกม"
      data-testid="room-setup-panel"
      data-host={isHost ? "true" : "false"}
      data-category-locked={lockState.category ? "true" : "false"}
      data-options-locked={lockState.options ? "true" : "false"}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-hairline bg-surface-elevated p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[20px] uppercase leading-none tracking-[0.3px] text-on-dark">
          {headingLabel}
        </h2>
        {!isHost ? (
          <span
            data-testid="room-setup-panel-readonly-badge"
            className="text-[10px] font-medium uppercase tracking-[0.5px] text-on-dark-muted"
          >
            Read only
          </span>
        ) : null}
      </div>

      <div
        data-testid="room-setup-panel-category-slot"
        className="flex flex-col gap-3"
      >
        {categorySlot}
      </div>

      {optionsSlot ? (
        <div
          data-testid="room-setup-panel-options-slot"
          className="flex flex-col gap-3"
        >
          {optionsSlot}
        </div>
      ) : null}
    </section>
  )
}
