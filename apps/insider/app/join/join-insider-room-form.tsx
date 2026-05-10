"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { joinInsiderRoomAction } from "@/app/actions/join-insider-room"
import { displayNameSchema, roomCodeSchema } from "@/lib/schemas"
import { getOrCreatePlayerId } from "@/lib/player-id"

const DISPLAY_NAME_MAX = 20
const ROOM_CODE_LENGTH = 6

type FieldErrors = {
  code?: string
  name?: string
  form?: string
}

export function JoinInsiderRoomForm() {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    queueMicrotask(() => codeRef.current?.focus())
  }, [])

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev
      const next = { ...prev }
      delete next[field]
      delete next.form
      return next
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const codeParsed = roomCodeSchema.safeParse(code)
    const nameParsed = displayNameSchema.safeParse(name)

    if (!codeParsed.success || !nameParsed.success) {
      const next: FieldErrors = {}
      if (!codeParsed.success) {
        next.code = codeParsed.error.issues[0]?.message ?? "รหัสห้องไม่ถูกต้อง"
      }
      if (!nameParsed.success) {
        next.name = nameParsed.error.issues[0]?.message ?? "ชื่อไม่ถูกต้อง"
      }
      setErrors(next)
      if (next.code) codeRef.current?.focus()
      else nameRef.current?.focus()
      return
    }
    setErrors({})

    let playerId: string
    try {
      playerId = getOrCreatePlayerId()
    } catch {
      setErrors({ form: "เปิดเบราว์เซอร์อีกครั้งแล้วลองใหม่" })
      return
    }

    startTransition(async () => {
      const result = await joinInsiderRoomAction({
        code: codeParsed.data,
        displayName: nameParsed.data,
        playerId,
      })
      if (!result.ok) {
        setErrors({ form: result.error })
        return
      }
      router.push(`/room/${result.code}`)
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative flex w-full flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="join-code"
          className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted"
        >
          รหัสห้อง
        </label>
        <input
          ref={codeRef}
          id="join-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="WFTGKM"
          value={code}
          onChange={(event) => {
            const next = event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, ROOM_CODE_LENGTH)
            setCode(next)
            clearError("code")
          }}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? "join-code-error" : "join-code-hint"}
          disabled={isPending}
          className="min-h-14 w-full rounded-xl border border-hairline bg-surface-elevated px-4 text-center font-hero text-[32px] tracking-[8px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
        />
        {errors.code ? (
          <span
            id="join-code-error"
            role="alert"
            className="text-xs text-error"
          >
            {errors.code}
          </span>
        ) : (
          <span id="join-code-hint" className="text-xs text-on-dark-muted">
            ตัวอักษร 6 ตัว (A-Z, 0-9)
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="join-name"
          className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted"
        >
          ชื่อของคุณ
        </label>
        <input
          ref={nameRef}
          id="join-name"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={DISPLAY_NAME_MAX}
          placeholder="ชื่อเล่น"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            clearError("name")
          }}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "join-name-error" : undefined}
          disabled={isPending}
          className="min-h-12 w-full rounded-lg border border-hairline bg-surface-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between text-xs text-on-dark-muted">
          <span>
            {errors.name ? (
              <span id="join-name-error" role="alert" className="text-error">
                {errors.name}
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

      {errors.form && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {errors.form}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 text-[17px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {isPending ? "กำลังเข้าห้อง..." : "เข้าห้อง"}
        </button>
      </div>
    </form>
  )
}
