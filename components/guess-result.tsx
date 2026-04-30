"use client"

import { useEffect, useState } from "react"

export type GuessResultMode = "correct" | "foul"

const AUTO_ADVANCE_MS = 8000

interface GuessResultProps {
  mode: GuessResultMode
  assignedName: string
  scoreThisRound: number
  totalScore: number
  round: number
  maxRounds: number
  onSkip: () => void
  /** Override auto-advance for tests. Defaults to 8000ms. */
  autoAdvanceMs?: number
}

export function GuessResult({
  mode,
  assignedName,
  scoreThisRound,
  totalScore,
  round,
  maxRounds,
  onSkip,
  autoAdvanceMs = AUTO_ADVANCE_MS,
}: GuessResultProps) {
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    if (skipped) return
    const timer = window.setTimeout(() => {
      setSkipped(true)
      onSkip()
    }, autoAdvanceMs)
    return () => window.clearTimeout(timer)
  }, [autoAdvanceMs, onSkip, skipped])

  function handleSkip() {
    if (skipped) return
    setSkipped(true)
    onSkip()
  }

  const isCorrect = mode === "correct"
  const accent = isCorrect ? "text-success" : "text-goal"
  const dividerBg = isCorrect ? "bg-success/50" : "bg-goal/50"
  const headline = isCorrect ? "ทายถูก!" : "ทายผิด"
  const icon = isCorrect ? "🎉" : "😩"
  const scoreLabel = "คะแนนรอบนี้"
  const waitHeadline = isCorrect ? "รอผู้เล่นคนอื่น..." : "รอเล่นใหม่ในรอบหน้า"
  const waitDetail = isCorrect
    ? `คะแนนรวม: ${totalScore} pts`
    : "ผู้เล่นคนอื่นยังเล่นต่ออยู่"

  const radialOverlayClass = isCorrect
    ? "h-[320px] bg-[radial-gradient(ellipse_100%_100%_at_center_top,rgba(22,163,74,0.45)_0%,transparent_70%)]"
    : "h-[280px] bg-[radial-gradient(ellipse_90%_100%_at_center_top,rgba(230,57,70,0.32)_0%,transparent_70%)]"

  return (
    <main
      role="status"
      aria-live="polite"
      aria-label={isCorrect ? "ทายถูก" : "ทายผิด"}
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-ink pt-9 text-on-dark"
    >
      <button
        type="button"
        aria-label="ข้ามไปสกอร์บอร์ด"
        onClick={handleSkip}
        className="absolute inset-0 z-30 cursor-pointer focus:outline-none"
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-9 ${radialOverlayClass}`}
      />

      <p className="absolute left-5 top-[50px] z-10 text-[11px] font-bold uppercase tracking-[1.5px] text-on-dark/40">
        R {round}/{maxRounds}
      </p>

      {!isCorrect ? (
        <span
          aria-label={`คะแนนรวมของคุณ ${totalScore} pts`}
          className="absolute right-5 top-[50px] z-10 inline-flex items-center justify-center rounded-full border border-goal bg-goal/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[1px] text-goal"
        >
          {totalScore} pts
        </span>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <div
          className={`text-[64px] leading-none ${
            isCorrect
              ? "motion-safe:animate-hb-pop"
              : ""
          }`}
        >
          {icon}
        </div>
        <div
          className={`font-display text-[88px] uppercase leading-[0.95] tracking-[1px] ${accent}`}
        >
          {headline}
        </div>
        <div className={`my-2 h-[2px] w-[60px] ${dividerBg}`} aria-hidden />
        <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-on-dark-soft">
          {scoreLabel}
        </div>
        <div
          aria-label={`คะแนนรอบนี้ ${
            isCorrect ? "+" : ""
          }${scoreThisRound} pts`}
          className="font-hero text-[96px] leading-none tracking-[2px] text-on-dark tabular-nums"
        >
          {isCorrect ? <span className={accent}>+</span> : null}
          {scoreThisRound}
          <span className="ml-1.5 text-[26px] text-on-dark-soft">pts</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 border-t border-hairline px-6 pt-4 pb-6 text-center">
        <p className="text-[13px] leading-[1.5] text-on-dark-soft">
          บนหัวของคุณคือ
          <b className="mt-1 block font-hero text-[22px] font-semibold tracking-[1px] text-on-dark">
            {assignedName}
          </b>
        </p>
        <div className="border-t border-hairline pt-3 text-[14px] leading-[1.5] text-on-dark-soft">
          <b className="mb-1 block text-base font-semibold text-on-dark">
            {waitHeadline}
          </b>
          {waitDetail}
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-2 z-10 text-center text-[10px] font-medium uppercase tracking-[0.5px] text-on-dark-muted">
        แตะเพื่อข้าม
      </p>
    </main>
  )
}

export const GUESS_RESULT_AUTO_ADVANCE_MS = AUTO_ADVANCE_MS

export function guessResultSeenStorageKey(
  roundStateId: string,
  playerId: string,
): string {
  return `headball_last_result_seen_${roundStateId}_${playerId}`
}
