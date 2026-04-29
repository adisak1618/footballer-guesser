"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import confetti from "canvas-confetti"
import { useGameStore } from "@/lib/game-store"
import { resetGameAction } from "@/app/actions/reset-game"

const TAG_BG: Record<number, string> = {
  1: "bg-tag-red",
  2: "bg-tag-blue",
  3: "bg-tag-yellow",
  4: "bg-tag-green",
  5: "bg-tag-purple",
  6: "bg-tag-orange",
  7: "bg-tag-pink",
  8: "bg-tag-cyan",
}

const TAG_TEXT: Record<number, string> = {
  1: "text-on-dark",
  2: "text-on-dark",
  3: "text-on-light",
  4: "text-on-dark",
  5: "text-on-dark",
  6: "text-on-dark",
  7: "text-on-dark",
  8: "text-on-dark",
}

export function Results() {
  const room = useGameStore((s) => s.room)
  const me = useGameStore((s) => s.me)
  const players = useGameStore((s) => s.players)

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ranked = [...players].sort(
    (a, b) => (b.total_score ?? 0) - (a.total_score ?? 0),
  )
  const topScore = ranked[0]?.total_score ?? 0
  const winners = ranked.filter((p) => (p.total_score ?? 0) === topScore && topScore > 0)
  const isHost = !!(me && room && me.player_id === room.host_player_id)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const fire = (particleRatio: number, opts: confetti.Options) => {
      void confetti({
        origin: { y: 0.7 },
        particleCount: Math.floor(220 * particleRatio),
        ...opts,
      })
    }

    fire(0.25, { spread: 26, startVelocity: 55 })
    fire(0.2, { spread: 60 })
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 })
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.1 })
    fire(0.1, { spread: 120, startVelocity: 45 })
  }, [])

  function handleReset() {
    if (!room || !me) return
    setError(null)
    const roomId = room.id
    const hostPlayerId = me.player_id
    startTransition(async () => {
      const result = await resetGameAction({ roomId, hostPlayerId })
      if (!result.ok) setError(result.error)
    })
  }

  if (!room || !me) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center bg-canvas px-6 text-center">
        <p className="text-sm text-on-light-soft">กำลังโหลด...</p>
      </main>
    )
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 bg-canvas px-6 pt-10 pb-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.5px] text-on-light-muted">
          จบเกม
        </p>
        <h1 className="font-display text-[56px] uppercase leading-none tracking-[0.5px] text-on-light">
          Final Score
        </h1>
      </header>

      <ol
        aria-label="ผลคะแนนรวม"
        className="flex flex-col gap-2"
      >
        {ranked.map((p, i) => {
          const bg = TAG_BG[p.join_order] ?? "bg-tag-red"
          const chipText = TAG_TEXT[p.join_order] ?? "text-on-dark"
          const isMe = p.player_id === me.player_id
          const score = p.total_score ?? 0
          return (
            <li
              key={p.id}
              aria-label={`อันดับ ${i + 1} ${p.display_name}${isMe ? " (คุณ)" : ""} ${score} คะแนน`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-surface-card bg-surface-soft px-3 py-2 text-on-light"
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-hero text-[24px] leading-none tabular-nums ${bg} ${chipText}`}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate text-base font-semibold tracking-[0.2px]">
                {p.display_name}
                {isMe ? (
                  <span className="ml-2 text-xs font-medium uppercase tracking-[0.3px] text-on-light-muted">
                    (คุณ)
                  </span>
                ) : null}
              </span>
              <span className="font-hero text-[32px] leading-none tabular-nums text-on-light">
                {score}
              </span>
            </li>
          )
        })}
      </ol>

      <section className="flex flex-col items-center gap-1 text-center">
        {winners.length > 0 ? (
          <p className="font-display text-[28px] uppercase leading-tight tracking-[0.3px] text-goal">
            🎉 {winners.map((w) => w.display_name).join(" และ ")} ชนะ!
          </p>
        ) : (
          <p className="font-display text-[28px] uppercase leading-tight tracking-[0.3px] text-on-light">
            🤝 เสมอ
          </p>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-3">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-center text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        {isHost ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            aria-busy={isPending}
            className="flex min-h-14 items-center justify-center rounded-xl bg-goal px-6 text-[15px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:cursor-not-allowed disabled:bg-goal-disabled"
          >
            {isPending ? "กำลังเริ่ม..." : "เล่นรอบใหม่"}
          </button>
        ) : (
          <p className="flex min-h-14 items-center justify-center rounded-xl border border-surface-card bg-surface-soft px-6 text-center text-sm text-on-light-soft">
            รอ host เริ่มเกมใหม่
          </p>
        )}
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-xl border border-surface-card bg-surface-soft px-6 text-[15px] font-semibold tracking-[0.3px] text-on-light transition-colors active:bg-surface-card"
        >
          ออกจากห้อง
        </Link>
      </div>
    </main>
  )
}
