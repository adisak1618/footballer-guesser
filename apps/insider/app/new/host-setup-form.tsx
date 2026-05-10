"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { EnabledPack } from "@social-hub/content"
import { PackChip } from "@social-hub/ui"
import { createInsiderRoomAction } from "@/app/actions/create-insider-room"
import { getOrCreatePlayerId } from "@/lib/player-id"
import { displayNameSchema } from "@/lib/schemas"

const TIME_OPTIONS: ReadonlyArray<{ value: 180 | 300 | 420; label: string }> = [
  { value: 180, label: "3 MIN" },
  { value: 300, label: "5 MIN" },
  { value: 420, label: "7 MIN" },
]

// Issue #17 — match length is 3-10 rounds, default 5. The lower bound matches
// the new game_insider_room_config.round_count CHECK constraint added in
// migration 0035; create_insider_room rejects values outside this range with
// PGAME20.
const ROUND_MIN = 3
const ROUND_MAX = 10
const ROUND_DEFAULT = 5
const TIME_DEFAULT: 180 | 300 | 420 = 300
const DISPLAY_NAME_MAX = 20

interface Props {
  packs: EnabledPack[]
}

export function HostSetupForm({ packs }: Props) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [packSlug, setPackSlug] = useState<string>(() => packs[0]?.slug ?? "")
  const [timeLimitS, setTimeLimitS] = useState<180 | 300 | 420>(TIME_DEFAULT)
  const [roundCount, setRoundCount] = useState<number>(ROUND_DEFAULT)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const packIndexBySlug = useMemo(() => {
    const map = new Map<string, number>()
    packs.forEach((pack, idx) => {
      map.set(pack.slug, idx)
    })
    return map
  }, [packs])

  function decRound() {
    setRoundCount((value) => Math.max(ROUND_MIN, value - 1))
  }

  function incRound() {
    setRoundCount((value) => Math.min(ROUND_MAX, value + 1))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const parsedName = displayNameSchema.safeParse(name)
    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "ชื่อไม่ถูกต้อง")
      nameInputRef.current?.focus()
      return
    }
    if (!packSlug) {
      setError("เลือกคลังคำก่อนนะ")
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
      const result = await createInsiderRoomAction({
        displayName: parsedName.data,
        playerId,
        packSlug,
        timeLimitS,
        roundCount,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/room/${result.code}`)
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative flex flex-col gap-8"
      aria-busy={isPending}
    >
      {/* Display name */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs uppercase tracking-[2px] text-on-dark-soft">
          ── ชื่อโฮสต์ / HOST NAME ──
        </h2>
        <input
          ref={nameInputRef}
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
          disabled={isPending}
          className="min-h-12 w-full rounded-lg border border-hairline bg-surface-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
        />
      </section>

      {/* Pack chips */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs uppercase tracking-[2px] text-on-dark-soft">
          ── คลังคำ / WORD PACK ──
        </h2>
        <div
          role="radiogroup"
          aria-label="Word pack"
          className="grid grid-cols-2 gap-3"
        >
          {packs.map((pack) => {
            const isSelected = packSlug === pack.slug
            const tagIdx = packIndexBySlug.get(pack.slug) ?? 0
            const showSubLabel = Boolean(
              pack.displayNameTh &&
                pack.displayName !== pack.displayNameTh,
            )
            return (
              <PackChip
                key={pack.slug}
                joinIndex={tagIdx}
                label={pack.displayNameTh ?? pack.displayName}
                subLabel={showSubLabel ? pack.displayName : undefined}
                selected={isSelected}
                disabled={isPending}
                onTap={() => setPackSlug(pack.slug)}
                testId={`pack-chip-${pack.slug}`}
              />
            )
          })}
        </div>
      </section>

      {/* Time chips */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs uppercase tracking-[2px] text-on-dark-soft">
          ── เวลาต่อรอบ / TIMER ──
        </h2>
        <div
          role="radiogroup"
          aria-label="Time per round"
          className="grid grid-cols-3 gap-2 rounded-xl bg-surface-elevated p-1"
        >
          {TIME_OPTIONS.map((opt) => {
            const isSelected = timeLimitS === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isPending}
                onClick={() => setTimeLimitS(opt.value)}
                data-testid={`time-chip-${opt.value}`}
                className={`min-h-12 rounded-lg font-hero text-xl tracking-[1px] transition-colors ${
                  isSelected
                    ? "bg-goal text-on-dark shadow"
                    : "text-on-dark-soft active:bg-surface"
                } disabled:opacity-60`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Round count stepper */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs uppercase tracking-[2px] text-on-dark-soft">
          ── จำนวนรอบ / ROUNDS ──
        </h2>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={decRound}
            disabled={isPending || roundCount <= ROUND_MIN}
            aria-label="Decrease rounds"
            data-testid="round-stepper-dec"
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-hairline bg-surface-elevated text-3xl text-on-dark transition-colors active:bg-surface disabled:opacity-40"
          >
            −
          </button>
          <output
            aria-live="polite"
            data-testid="round-count-value"
            className="flex h-14 min-w-[120px] items-center justify-center rounded-xl bg-surface-elevated font-hero text-4xl tracking-[2px] text-on-dark"
          >
            {roundCount}
          </output>
          <button
            type="button"
            onClick={incRound}
            disabled={isPending || roundCount >= ROUND_MAX}
            aria-label="Increase rounds"
            data-testid="round-stepper-inc"
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-hairline bg-surface-elevated text-3xl text-on-dark transition-colors active:bg-surface disabled:opacity-40"
          >
            +
          </button>
        </div>
      </section>

      {/* Error + CTA */}
      <div className="flex flex-col gap-3 pt-2">
        {error ? (
          <p
            id="create-insider-error"
            role="alert"
            className="text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isPending || packs.length === 0}
          data-testid="create-insider-room-cta"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-[17px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {isPending ? "กำลังสร้าง..." : "สร้างห้อง / CREATE ROOM →"}
        </button>
      </div>
    </form>
  )
}
