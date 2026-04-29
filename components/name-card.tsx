"use client"

import { useEffect } from "react"
import type { Player, RoundState } from "@/lib/types"

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

interface NameCardProps {
  me: Player
  round: number
  maxRounds: number
  myRoundState: RoundState | null
}

export function NameCard({ me, round, maxRounds, myRoundState }: NameCardProps) {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function request() {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return
      try {
        const lock = await navigator.wakeLock.request("screen")
        if (cancelled) {
          await lock.release().catch(() => {})
          return
        }
        sentinel = lock
      } catch {
        // wake lock unavailable / permission denied — fail silently
      }
    }

    void request()

    return () => {
      cancelled = true
      if (sentinel) {
        sentinel.release().catch(() => {})
        sentinel = null
      }
    }
  }, [])

  if (!myRoundState) {
    return (
      <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="text-sm text-on-dark-soft">รอชื่อนักเตะ...</p>
      </main>
    )
  }

  const tagBg = TAG_BG[me.join_order] ?? "bg-tag-red"
  const tagText = TAG_TEXT[me.join_order] ?? "text-on-dark"
  const upperName = myRoundState.assigned_name.toUpperCase()

  if (!myRoundState.is_active) {
    return (
      <main
        role="img"
        aria-label="คุณออกจากรอบนี้แล้ว"
        className="relative flex min-h-[100dvh] w-full select-none flex-col items-center justify-center overflow-hidden bg-surface px-6 text-center"
      >
        <p className="absolute left-4 top-4 text-xs font-semibold uppercase tracking-[0.5px] text-on-dark-muted">
          Round {round}/{maxRounds}
        </p>
        <span className="font-hero text-[96px] leading-[0.95] tracking-[2px] text-on-dark-muted opacity-60 line-through min-[375px]:text-[144px]">
          {upperName}
        </span>
        <span className="mt-8 inline-flex items-center justify-center rounded-2xl border border-error/40 bg-error/15 px-8 py-3 font-display text-[28px] uppercase tracking-[2px] text-error">
          OUT
        </span>
      </main>
    )
  }

  return (
    <main
      role="img"
      aria-label="ชื่อของคุณซ่อนอยู่ — หันจอให้เพื่อนเห็นเพื่อเริ่มเล่น"
      className={`relative flex min-h-[100dvh] w-full select-none flex-col items-center justify-center overflow-hidden px-6 text-center ${tagBg} ${tagText}`}
    >
      <p className="absolute left-4 top-4 text-xs font-semibold uppercase tracking-[0.5px] opacity-80">
        Round {round}/{maxRounds}
      </p>
      <span className="font-hero text-[96px] leading-[0.95] tracking-[2px] min-[375px]:text-[144px]">
        {upperName}
      </span>
      <p className="absolute inset-x-0 bottom-6 text-xs font-medium uppercase tracking-[0.5px] opacity-80">
        — tap to act —
      </p>
    </main>
  )
}
