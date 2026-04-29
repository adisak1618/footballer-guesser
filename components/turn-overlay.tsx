"use client"

import { useEffect, useState } from "react"

const AUTO_DISMISS_MS = 10000

interface TurnOverlayProps {
  onCancel: () => void
  onGuess: () => void
  onScores: () => void
}

export function TurnOverlay({ onCancel, onGuess, onScores }: TurnOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_DISMISS_MS / 1000))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, Math.ceil((AUTO_DISMISS_MS - elapsed) / 1000))
      setSecondsLeft(remaining)
      if (elapsed >= AUTO_DISMISS_MS) {
        clearInterval(tick)
        onCancel()
      }
    }, 250)
    return () => clearInterval(tick)
  }, [onCancel])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ตัวเลือกของผู้เล่น"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-6 motion-safe:transition-opacity motion-safe:duration-100 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="ยกเลิก"
        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-on-dark-soft hover:text-on-dark"
      >
        <span aria-hidden="true">✕</span>
        cancel
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h2 className="font-display text-[28px] uppercase tracking-[2px] text-on-dark">
            YOUR TURN
          </h2>
          <p className="text-sm text-on-dark-soft">เลือก action</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onGuess}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-goal px-6 text-base font-semibold text-on-dark active:bg-goal-active"
          >
            <span aria-hidden="true">⚽</span>
            ทายชื่อ
          </button>
          <button
            type="button"
            onClick={onScores}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface-elevated px-6 text-sm font-medium text-on-dark"
          >
            <span aria-hidden="true">🏆</span>
            ดูคะแนน
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-warning">
            <span aria-hidden="true">⚠️ </span>
            ทายผิด = Foul
          </p>
          <p className="text-xs text-on-dark-soft">(ออกจากรอบ)</p>
        </div>

        <p
          aria-live="polite"
          className="text-xs uppercase tracking-[0.5px] text-on-dark-muted tabular-nums"
        >
          <span aria-hidden="true">⏱ </span>
          {secondsLeft}s → return
        </p>
      </div>
    </div>
  )
}
