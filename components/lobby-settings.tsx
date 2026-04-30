"use client"

import { useState, useTransition } from "react"
import { updateRoomSettingsAction } from "@/app/actions/update-room-settings"

const CATEGORY_OPTIONS = [
  { value: "premier-league", label: "Premier League" },
] as const

type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"]

function isCategoryValue(value: string): value is CategoryValue {
  return CATEGORY_OPTIONS.some((opt) => opt.value === value)
}

const MIN_ROUNDS = 1
const MAX_ROUNDS = 20

interface LobbySettingsProps {
  roomId: string
  hostPlayerId: string | null
  isHost: boolean
  playerCount: number
  maxRounds: number
  scorePositions: number
  category: string
  categoryLocked: boolean
}

export function LobbySettings({
  roomId,
  hostPlayerId,
  isHost,
  playerCount,
  maxRounds,
  scorePositions,
  category,
  categoryLocked,
}: LobbySettingsProps) {
  const maxTopN = Math.max(playerCount - 1, 1)

  const [draftRounds, setDraftRounds] = useState(maxRounds)
  const [lastSyncedRounds, setLastSyncedRounds] = useState(maxRounds)
  const [draftTopN, setDraftTopN] = useState(() =>
    Math.min(scorePositions, maxTopN),
  )
  const [lastSyncedTopN, setLastSyncedTopN] = useState(scorePositions)
  const [lastMaxTopN, setLastMaxTopN] = useState(maxTopN)
  const [draftCategory, setDraftCategory] = useState(category)
  const [lastSyncedCategory, setLastSyncedCategory] = useState(category)
  const [error, setError] = useState<string | null>(null)
  const [savedTick, setSavedTick] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync local draft when authoritative server values change (Realtime push).
  // React's "store previous prop in state" pattern — conditional setState
  // during render, no useEffect cascade.
  if (lastSyncedRounds !== maxRounds) {
    setLastSyncedRounds(maxRounds)
    setDraftRounds(maxRounds)
  }
  if (lastSyncedCategory !== category) {
    setLastSyncedCategory(category)
    setDraftCategory(category)
  }
  if (lastSyncedTopN !== scorePositions || lastMaxTopN !== maxTopN) {
    setLastSyncedTopN(scorePositions)
    setLastMaxTopN(maxTopN)
    setDraftTopN(Math.min(scorePositions, maxTopN))
  }

  const dirty =
    draftRounds !== maxRounds ||
    draftTopN !== scorePositions ||
    draftCategory !== category

  function handleSave() {
    if (!hostPlayerId) return
    if (!isCategoryValue(draftCategory)) {
      setError("หมวดหมู่ไม่ถูกต้อง")
      return
    }
    setError(null)
    setSavedTick(false)
    const safeCategory = draftCategory
    startTransition(async () => {
      const result = await updateRoomSettingsAction({
        roomId,
        hostPlayerId,
        maxRounds: draftRounds,
        scorePositions: draftTopN,
        category: safeCategory,
      })
      if (!result.ok) {
        setError(result.error)
        setDraftRounds(maxRounds)
        setDraftTopN(scorePositions)
        setDraftCategory(category)
        return
      }
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 1500)
    })
  }

  const stepperBase =
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface text-on-dark transition-colors active:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <section
      aria-label="ตั้งค่าเกม"
      className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface-elevated p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[20px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Game Settings
        </h2>
        {!isHost ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-on-dark-muted">
            Read only
          </span>
        ) : null}
      </div>

      <div
        className="flex items-center justify-between gap-3"
        data-testid="lobby-settings-rounds"
      >
        <label
          htmlFor="lobby-rounds"
          className="text-sm font-semibold tracking-[0.2px] text-on-dark"
        >
          Rounds
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="ลดจำนวนรอบ"
            disabled={!isHost || draftRounds <= MIN_ROUNDS || isPending}
            onClick={() =>
              setDraftRounds((r) => Math.max(r - 1, MIN_ROUNDS))
            }
            className={stepperBase}
          >
            −
          </button>
          <input
            id="lobby-rounds"
            type="number"
            inputMode="numeric"
            min={MIN_ROUNDS}
            max={MAX_ROUNDS}
            disabled={!isHost || isPending}
            value={draftRounds}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              if (Number.isNaN(n)) return
              setDraftRounds(Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, n)))
            }}
            className="h-10 w-14 rounded-lg border border-hairline bg-surface px-2 text-center text-base font-semibold tabular-nums text-on-dark outline-none focus:border-on-dark-soft disabled:opacity-60"
          />
          <button
            type="button"
            aria-label="เพิ่มจำนวนรอบ"
            disabled={!isHost || draftRounds >= MAX_ROUNDS || isPending}
            onClick={() =>
              setDraftRounds((r) => Math.min(r + 1, MAX_ROUNDS))
            }
            className={stepperBase}
          >
            +
          </button>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3"
        data-testid="lobby-settings-topn"
      >
        <label
          htmlFor="lobby-topn"
          className="text-sm font-semibold tracking-[0.2px] text-on-dark"
        >
          Top-N scoring
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="ลด Top-N"
            disabled={!isHost || draftTopN <= 1 || isPending}
            onClick={() => setDraftTopN((n) => Math.max(n - 1, 1))}
            className={stepperBase}
          >
            −
          </button>
          <input
            id="lobby-topn"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxTopN}
            disabled={!isHost || isPending}
            value={draftTopN}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              if (Number.isNaN(n)) return
              setDraftTopN(Math.max(1, Math.min(maxTopN, n)))
            }}
            className="h-10 w-14 rounded-lg border border-hairline bg-surface px-2 text-center text-base font-semibold tabular-nums text-on-dark outline-none focus:border-on-dark-soft disabled:opacity-60"
          />
          <button
            type="button"
            aria-label="เพิ่ม Top-N"
            disabled={!isHost || draftTopN >= maxTopN || isPending}
            onClick={() => setDraftTopN((n) => Math.min(n + 1, maxTopN))}
            className={stepperBase}
          >
            +
          </button>
        </div>
      </div>
      <p className="text-xs text-on-dark-muted">
        สูงสุดที่ได้คะแนนคือ {maxTopN} (ผู้เล่น {playerCount} − 1)
      </p>

      <div
        className="flex items-center justify-between gap-3"
        data-testid="lobby-settings-category"
      >
        <label
          htmlFor="lobby-category"
          className="text-sm font-semibold tracking-[0.2px] text-on-dark"
        >
          Category
        </label>
        <select
          id="lobby-category"
          disabled={!isHost || categoryLocked || isPending}
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
          className="h-10 min-w-[180px] rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-on-dark outline-none focus:border-on-dark-soft disabled:opacity-60"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {categoryLocked ? (
        <p className="text-xs text-on-dark-muted">
          หมวดหมู่ถูกล็อกหลังเริ่มเกมรอบแรก
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      {isHost ? (
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isPending || !hostPlayerId}
          aria-busy={isPending}
          data-testid="lobby-settings-save"
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-goal px-4 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          <span className="font-display text-[16px] uppercase tracking-[1px]">
            {isPending
              ? "กำลังบันทึก..."
              : savedTick
                ? "✓ บันทึกแล้ว"
                : "Save settings"}
          </span>
        </button>
      ) : null}
    </section>
  )
}
