"use client"

import type { Player } from "@/lib/types"

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

interface RoundScoreboardProps {
  currentRound: number
  maxRounds: number
  players: Player[]
  activeRemaining: number
  myPlayerId: string
}

export function RoundScoreboard({
  currentRound,
  maxRounds,
  players,
  activeRemaining,
  myPlayerId,
}: RoundScoreboardProps) {
  const allDone = activeRemaining === 0
  const ranked = [...players].sort(
    (a, b) => (b.total_score ?? 0) - (a.total_score ?? 0),
  )

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 bg-ink px-6 pt-8 pb-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.5px] text-on-dark-muted">
          Round {currentRound}/{maxRounds}
        </p>
        <h2 className="font-display text-[40px] uppercase leading-none tracking-[2px] text-on-dark">
          Scoreboard
        </h2>
        <p
          aria-live="polite"
          className="text-sm text-on-dark-soft"
        >
          {allDone
            ? "กำลังเริ่มรอบต่อไป..."
            : `รอผู้เล่นคนอื่น... (เหลือ ${activeRemaining} คน)`}
        </p>
      </header>

      <ol
        aria-live="polite"
        className="flex flex-1 flex-col gap-2"
      >
        {ranked.map((p, i) => {
          const bg = TAG_BG[p.join_order] ?? "bg-tag-red"
          const text = TAG_TEXT[p.join_order] ?? "text-on-dark"
          const isMe = p.player_id === myPlayerId
          const score = p.total_score ?? 0
          return (
            <li
              key={p.id}
              aria-label={`อันดับ ${i + 1} ${p.display_name}${isMe ? " (คุณ)" : ""} ${score} คะแนน`}
              className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${bg} ${text}`}
            >
              <span
                aria-hidden
                className="inline-flex w-8 justify-center font-hero text-[24px] leading-none tabular-nums opacity-80"
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate text-base font-semibold tracking-[0.2px]">
                {p.display_name}
                {isMe ? (
                  <span className="ml-2 text-xs font-medium uppercase tracking-[0.3px] opacity-80">
                    (คุณ)
                  </span>
                ) : null}
              </span>
              <span className="font-hero text-[32px] leading-none tabular-nums">
                {score}
              </span>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
