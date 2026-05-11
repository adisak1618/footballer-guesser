"use client"

import { useState, useTransition } from "react"
import { RoomSetupPanel } from "@social-hub/ui"
import { updateRoomSettingsAction } from "@/app/actions/update-room-settings"

// Categories grouped for <optgroup>. Slugs must match data/seed/categories.json
// AND ALLOWED_CATEGORIES in app/actions/update-room-settings.ts.
//
// We declare the flat (slug → Thai label) table first as `as const` so the
// CategoryValue union narrows precisely, then declare the visual grouping
// separately referencing those slugs.
const CATEGORY_LABELS = {
  "worldwide-stars":      "ดาวดังระดับโลก",
  "premier-league":       "พรีเมียร์ลีก",
  "la-liga":              "ลาลีกา",
  "serie-a":              "กัลโช่ เซเรียอา",
  "bundesliga":           "บุนเดสลีกา",
  "ligue-1":              "ลีกเอิง",
  "liverpool":            "ลิเวอร์พูล",
  "man-united":           "แมนเชสเตอร์ ยูไนเต็ด",
  "arsenal":              "อาร์เซนอล",
  "chelsea":              "เชลซี",
  "man-city":             "แมนเชสเตอร์ ซิตี้",
  "tottenham":            "ท็อตแนม",
  "real-madrid":          "เรอัล มาดริด",
  "barcelona":            "บาร์เซโลน่า",
  "atletico":             "แอตเลติโก้ มาดริด",
  "juventus":             "ยูเวนตุส",
  "ac-milan":             "เอซี มิลาน",
  "inter":                "อินเตอร์ มิลาน",
  "bayern":               "บาเยิร์น มิวนิค",
  "dortmund":             "ดอร์ทมุนด์",
  "psg":                  "ปารีส แซงต์-แชร์กแมง",
  "real-and-barca":       "เรอัล + บาร์ซ่า",
  "milan-and-inter":      "มิลาน + อินเตอร์",
  "arsenal-and-tottenham":"อาร์เซนอล + ท็อตแนม",
  "united-and-city":      "แมนยู + แมนซิตี้",
  "real-and-atletico":    "เรอัล + แอตเลติโก้",
  "real-and-chelsea":     "เรอัล + เชลซี",
  "english":              "อังกฤษ",
  "brazilian":            "บราซิล",
  "argentinian":          "อาร์เจนตินา",
  "french":               "ฝรั่งเศส",
  "german":               "เยอรมัน",
  "spanish":              "สเปน",
  "italian":              "อิตาลี",
  "goalkeepers":          "ผู้รักษาประตู",
  "legends":              "ตำนาน",
} as const

type CategoryValue = keyof typeof CATEGORY_LABELS

function isCategoryValue(value: string): value is CategoryValue {
  return value in CATEGORY_LABELS
}

type CategoryGroup = {
  label: string
  values: readonly CategoryValue[]
}

const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  { label: "แนะนำ",                values: ["worldwide-stars"] },
  { label: "ลีก",                  values: ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"] },
  { label: "สโมสร",                values: ["liverpool", "man-united", "arsenal", "chelsea", "man-city", "tottenham", "real-madrid", "barcelona", "atletico", "juventus", "ac-milan", "inter", "bayern", "dortmund", "psg"] },
  { label: "เคยเล่นให้ทั้งสองทีม",   values: ["real-and-barca", "milan-and-inter", "arsenal-and-tottenham", "united-and-city", "real-and-atletico", "real-and-chelsea"] },
  { label: "ทีมชาติ",               values: ["english", "brazilian", "argentinian", "french", "german", "spanish", "italian"] },
  { label: "พิเศษ",                 values: ["goalkeepers", "legends"] },
]

const DIFFICULTY_OPTIONS = [
  { value: "easy",   label: "ง่าย",   hint: "Top 50 ที่คนรู้จักดี" },
  { value: "medium", label: "กลาง",   hint: "Top 100 รวม" },
  { value: "hard",   label: "ยาก",    hint: "ลึกขึ้น (อันดับ 101+)" },
] as const

type DifficultyValue = (typeof DIFFICULTY_OPTIONS)[number]["value"]

function isDifficultyValue(value: string): value is DifficultyValue {
  return DIFFICULTY_OPTIONS.some((opt) => opt.value === value)
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
  difficulty: string
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
  difficulty,
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
  const [draftDifficulty, setDraftDifficulty] = useState(difficulty)
  const [lastSyncedDifficulty, setLastSyncedDifficulty] = useState(difficulty)
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
  if (lastSyncedDifficulty !== difficulty) {
    setLastSyncedDifficulty(difficulty)
    setDraftDifficulty(difficulty)
  }

  const dirty =
    draftRounds !== maxRounds ||
    draftTopN !== scorePositions ||
    draftCategory !== category ||
    draftDifficulty !== difficulty

  function handleSave() {
    if (!hostPlayerId) return
    if (!isCategoryValue(draftCategory)) {
      setError("หมวดหมู่ไม่ถูกต้อง")
      return
    }
    if (!isDifficultyValue(draftDifficulty)) {
      setError("ระดับความยากไม่ถูกต้อง")
      return
    }
    setError(null)
    setSavedTick(false)
    const safeCategory = draftCategory
    const safeDifficulty = draftDifficulty
    startTransition(async () => {
      const result = await updateRoomSettingsAction({
        roomId,
        hostPlayerId,
        maxRounds: draftRounds,
        scorePositions: draftTopN,
        category: safeCategory,
        difficulty: safeDifficulty,
      })
      if (!result.ok) {
        setError(result.error)
        setDraftRounds(maxRounds)
        setDraftTopN(Math.min(scorePositions, maxTopN))
        setDraftCategory(category)
        setDraftDifficulty(difficulty)
        return
      }
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 1500)
    })
  }

  const stepperBase =
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface text-on-dark transition-colors active:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <RoomSetupPanel
      isHost={isHost}
      lockState={{ category: categoryLocked }}
      categorySlot={
        <>
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
          className="h-10 min-w-[200px] max-w-[260px] rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-on-dark outline-none focus:border-on-dark-soft disabled:opacity-60"
        >
          {CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.values.map((slug) => (
                <option key={slug} value={slug}>
                  {CATEGORY_LABELS[slug]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {categoryLocked ? (
        <p className="text-xs text-on-dark-muted">
          หมวดหมู่ถูกล็อกหลังเริ่มเกมรอบแรก
        </p>
      ) : null}

      <div
        className="flex flex-col gap-2"
        data-testid="lobby-settings-difficulty"
      >
        <span className="text-sm font-semibold tracking-[0.2px] text-on-dark">
          ระดับความยาก
        </span>
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => {
            const active = draftDifficulty === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                disabled={!isHost || isPending}
                onClick={() => setDraftDifficulty(opt.value)}
                className={
                  active
                    ? "flex-1 rounded-lg border border-goal bg-goal/20 px-3 py-2 text-sm font-semibold text-on-dark transition-colors disabled:opacity-60"
                    : "flex-1 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-on-dark-muted transition-colors active:bg-surface-elevated disabled:opacity-40"
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-on-dark-muted">
          {DIFFICULTY_OPTIONS.find((o) => o.value === draftDifficulty)?.hint}
        </p>
      </div>

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
        </>
      }
    />
  )
}
