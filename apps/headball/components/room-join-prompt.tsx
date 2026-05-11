"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { joinRoomAction } from "@/app/actions/join-room"
import { displayNameSchema } from "@/lib/schemas"
import { getOrCreatePlayerId } from "@/lib/game-store"

const DISPLAY_NAME_MAX = 20

export function RoomJoinPrompt({
  code,
  onJoined,
}: {
  code: string
  onJoined: (playerId: string) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => nameInputRef.current?.focus())
  }, [])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const parsed = displayNameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ชื่อไม่ถูกต้อง")
      nameInputRef.current?.focus()
      return
    }
    setError(null)

    let playerId: string
    try {
      playerId = getOrCreatePlayerId()
    } catch {
      setError("เปิดเบราว์เซอร์อีกครั้งแล้วลองใหม่")
      return
    }

    startTransition(async () => {
      const result = await joinRoomAction({
        code,
        displayName: parsed.data,
        playerId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onJoined(result.playerId)
    })
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-10 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-goal/20 via-goal/5 to-transparent"
      />

      <header className="relative flex flex-col gap-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
          เข้าห้อง / JOIN ROOM
        </p>
        <h1 className="font-hero text-[44px] leading-none tracking-[8px] text-on-dark tabular-nums">
          {code}
        </h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="relative flex w-full flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="room-join-name"
            className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted"
          >
            ชื่อของคุณ
          </label>
          <input
            id="room-join-name"
            ref={nameInputRef}
            data-testid="room-join-name-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={DISPLAY_NAME_MAX}
            placeholder="ชื่อเล่น"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "room-join-name-error" : undefined}
            disabled={isPending}
            className="min-h-12 w-full rounded-lg border border-hairline bg-surface-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between text-xs text-on-dark-muted">
            <span>
              {error ? (
                <span
                  id="room-join-name-error"
                  role="alert"
                  className="text-error"
                >
                  {error}
                </span>
              ) : (
                "1–20 ตัวอักษร"
              )}
            </span>
            <span className="tabular-nums">
              {name.length}/{DISPLAY_NAME_MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <button
            type="submit"
            disabled={isPending}
            data-testid="room-join-cta"
            className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 text-[17px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
          >
            {isPending ? "กำลังเข้าห้อง..." : "เข้าห้อง"}
          </button>
        </div>
      </form>
    </main>
  )
}
