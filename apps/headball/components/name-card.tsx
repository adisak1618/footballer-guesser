"use client"

import { useEffect, useState } from "react"
import type { Player, RoundState } from "@/lib/types"
import { TurnOverlay } from "@/components/turn-overlay"
import { GuessModal } from "@/components/guess-modal"

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

const FEEDBACK_DURATION_MS = 600

type FeedbackKind = "success" | "foul"

interface NameCardProps {
  me: Player
  roomId: string
  round: number
  maxRounds: number
  myRoundState: RoundState | null
}

export function NameCard({
  me,
  roomId,
  round,
  maxRounds,
  myRoundState,
}: NameCardProps) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [guessOpen, setGuessOpen] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackKind | null>(null)

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

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [feedback])

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
  // Hide the name once the player has tapped to act — both the turn overlay
  // (which uses a 95%-opacity backdrop, so the BIG NAME bleeds through) and
  // the guess popup must show ??? instead of the assigned name.
  const nameHidden = overlayOpen || guessOpen
  const heroDisplay = nameHidden ? "???" : upperName
  const heroAriaLabel = nameHidden
    ? "ชื่อของคุณถูกซ่อน — กำลังทาย"
    : "ชื่อของคุณซ่อนอยู่ — หันจอให้เพื่อนเห็นเพื่อเริ่มเล่น"

  function handleGuessTap() {
    setOverlayOpen(false)
    setGuessOpen(true)
  }

  function handleGuessResult({ correct }: { correct: boolean; score: number }) {
    setGuessOpen(false)
    setFeedback(correct ? "success" : "foul")
  }

  return (
    <>
      <main
        role="img"
        aria-label={heroAriaLabel}
        className={`relative flex min-h-[100dvh] w-full select-none flex-col items-center justify-center overflow-hidden px-6 text-center ${tagBg} ${tagText} ${
          feedback === "foul" ? "motion-safe:animate-hb-shake" : ""
        }`}
      >
        <p className="absolute left-4 top-4 text-xs font-semibold uppercase tracking-[0.5px] opacity-80">
          Round {round}/{maxRounds}
        </p>
        <span
          data-testid="hero-name"
          className="font-hero text-[96px] leading-[0.95] tracking-[2px] min-[375px]:text-[144px]"
        >
          {heroDisplay}
        </span>
        <p className="absolute inset-x-0 bottom-6 text-xs font-medium uppercase tracking-[0.5px] opacity-80">
          — tap to act —
        </p>
        <button
          type="button"
          aria-label="แตะเพื่อเปิดตัวเลือก"
          onClick={() => setOverlayOpen(true)}
          className="absolute inset-0 z-10 cursor-pointer focus:outline-none"
        />
      </main>
      {overlayOpen ? (
        <TurnOverlay
          onCancel={() => setOverlayOpen(false)}
          onGuess={handleGuessTap}
        />
      ) : null}
      {guessOpen ? (
        <GuessModal
          roomId={roomId}
          roundNumber={round}
          playerId={me.player_id}
          onResult={handleGuessResult}
        />
      ) : null}
      {feedback === "success" ? (
        <div
          role="status"
          aria-label="ทายถูก"
          className="pointer-events-none fixed inset-0 z-40 bg-success/70 motion-safe:animate-hb-flash motion-reduce:opacity-70"
        />
      ) : null}
      {feedback === "foul" ? (
        <div
          role="status"
          aria-label="Foul"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-error/85 motion-safe:animate-hb-flash motion-reduce:opacity-85"
        >
          <span className="font-display text-[64px] uppercase tracking-[6px] text-on-dark min-[375px]:text-[96px]">
            FOUL
          </span>
        </div>
      ) : null}
    </>
  )
}
