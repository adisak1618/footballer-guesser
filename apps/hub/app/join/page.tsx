"use client"

import * as React from "react"
import { SlotInput } from "@social-hub/ui"
import { ROOM_CODE_LENGTH } from "@social-hub/core"
import { lookupRoom, type GameType } from "../actions/lookup-room"

const GAME_URLS: Record<GameType, string> = {
  headball:
    process.env.NEXT_PUBLIC_HEADBALL_URL ?? "http://localhost:3000",
  insider:
    process.env.NEXT_PUBLIC_INSIDER_URL ?? "http://localhost:3002",
}

export default function JoinPage() {
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const isReady = code.length === ROOM_CODE_LENGTH

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isReady || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await lookupRoom(code)
      const target = GAME_URLS[result.gameType]
      window.location.assign(`${target}/room/${result.code}`)
    } catch (err) {
      // Class identity (`instanceof GameRpcError`) is lost across the RSC
      // server-action boundary, so match on the message text the action sets.
      // Fallback covers redacted production errors and unexpected failures.
      const raw = err instanceof Error ? err.message : ""
      const message = raw.includes("Room not found")
        ? "ห้องไม่พบ / Room not found"
        : raw.includes("Invalid room code") ||
            raw.includes("รหัสห้องไม่ถูกต้อง")
          ? "รหัสห้องไม่ถูกต้อง / Invalid room code"
          : "เกิดข้อผิดพลาด / Something went wrong"
      setError(message)
      setSubmitting(false)
    }
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
         * (lookup-room: room not found / invalid code / unknown error). */}
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
          disabled={!isReady || submitting}
          aria-busy={submitting}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-goal px-6 font-display text-[18px] font-semibold leading-none tracking-[1px] text-on-dark uppercase transition-colors duration-150 hover:bg-goal-active active:translate-y-[1px] disabled:cursor-not-allowed disabled:bg-goal-disabled disabled:opacity-80"
        >
          {submitting ? "LOADING…" : "JOIN GAME →"}
        </button>
      </form>
    </main>
  )
}
