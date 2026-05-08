"use client"

import * as React from "react"
import { SlotInput } from "@social-hub/ui"
import { ROOM_CODE_LENGTH } from "@social-hub/core"

const HEADBALL_URL =
  process.env.NEXT_PUBLIC_HEADBALL_URL ?? "http://localhost:3000"

export default function JoinPage() {
  const [code, setCode] = React.useState("")
  const [error] = React.useState<string | null>(null)
  const isReady = code.length === ROOM_CODE_LENGTH

  // US-034 hardcodes the Headball redirect target. US-035 replaces this with
  // the lookup-room server action that queries `rooms.game_type` and routes
  // to the correct subdomain (or surfaces a "room not found" banner-error).
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isReady) return
    window.location.assign(`${HEADBALL_URL}/room/${code}`)
  }

  return (
    <main className="flex flex-1 flex-col items-center px-5 pb-12 pt-12">
      <header className="text-center">
        <h1 className="font-display text-[56px] leading-none tracking-[0.5px] text-on-dark uppercase">
          JOIN ROOM
        </h1>
        <p className="mt-3 font-body text-[15px] leading-[1.5] text-on-dark-soft">
          เข้าร่วมห้อง · Enter your 6-character room code
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full flex-col items-center"
      >
        <SlotInput value={code} onChange={setCode} autoFocus />

        {/* 24px reserved error banner space (DESIGN.md banner-error pattern):
         * always rendered so layout doesn't shift when an error appears
         * (US-035 will populate via lookup-room: room not found / room full). */}
        <div
          data-slot="join-error"
          role="status"
          aria-live="polite"
          className="mt-4 flex h-6 w-full items-center justify-center"
        >
          {error ? (
            <p className="font-body text-[14px] leading-[1.4] tracking-[0.3px] text-tag-red">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!isReady}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-goal px-6 font-display text-[18px] font-semibold leading-none tracking-[1px] text-on-dark uppercase transition-colors duration-150 hover:bg-goal-active active:translate-y-[1px] disabled:cursor-not-allowed disabled:bg-goal-disabled disabled:opacity-80"
        >
          JOIN GAME →
        </button>
      </form>
    </main>
  )
}
