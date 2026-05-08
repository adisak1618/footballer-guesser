"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createRoomAction } from "@/app/actions/create-room"
import { displayNameSchema } from "@/lib/schemas"
import { getOrCreatePlayerId } from "@/lib/game-store"

const DISPLAY_NAME_MAX = 20

export function CreateRoomButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) closeDialog()
    }
    window.addEventListener("keydown", handleKey)
    queueMicrotask(() => inputRef.current?.focus())
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, isPending])

  function closeDialog() {
    setOpen(false)
    setError(null)
    setName("")
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const parsed = displayNameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ชื่อไม่ถูกต้อง")
      inputRef.current?.focus()
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
      const result = await createRoomAction({
        displayName: parsed.data,
        playerId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/room/${result.code}`)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-goal px-8 text-on-dark transition-colors active:bg-goal-active"
      >
        <span aria-hidden className="text-2xl leading-none">+</span>
        <span className="text-[17px] font-semibold tracking-[0.3px]">
          สร้างห้อง
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-room-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-16 sm:items-center sm:pb-16"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPending) closeDialog()
          }}
        >
          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-[420px] flex-col gap-4 rounded-2xl border border-hairline bg-surface p-6 shadow-2xl"
          >
            <div className="flex flex-col gap-1">
              <h2
                id="create-room-title"
                className="font-display text-2xl uppercase tracking-[0.4px] text-on-dark"
              >
                ใส่ชื่อของคุณ
              </h2>
              <p className="text-sm leading-relaxed text-on-dark-soft">
                ชื่อนี้จะแสดงให้ผู้เล่นคนอื่นเห็น
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={inputRef}
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
                aria-describedby={error ? "create-room-error" : undefined}
                disabled={isPending}
                className="min-h-12 w-full rounded-lg border border-hairline bg-surface-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
              />
              <div className="flex items-center justify-between text-xs text-on-dark-muted">
                <span aria-live="polite">
                  {error ? (
                    <span id="create-room-error" className="text-error">
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

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 text-[17px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
              >
                {isPending ? "กำลังสร้าง..." : "สร้างห้อง"}
              </button>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 text-[15px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-surface disabled:opacity-60"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
