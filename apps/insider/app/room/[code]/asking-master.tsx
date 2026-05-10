"use client"

import { useState, useTransition } from "react"
import { GameRpcError } from "@social-hub/core"
import { markCorrectGuess } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"
import { AskingHeader } from "./asking-header"

// Issue #16 — Master view of the asking phase, simplified.
//
// Headball is a same-room offline social game — Y/N/Unsure answers are spoken
// aloud, not clicked. This screen now shows:
//   - The shared compact asking header (role badge + Thai how-to + timer)
//   - The Master's secret reminder (kept inline as the source-of-truth for
//     the player whose head it's on)
//   - A single primary action: ทายถูกแล้ว (mark_correct_guess RPC)
//
// Removed in #16: Y/N/Unsure response buttons, realtime feed accordion, and
// the master_respond Realtime subscription. The master_respond RPC remains in
// the database (migration 0024) marked for follow-up deprecation; see
// migration-0024-master-respond.test.ts (test.skip) for the regression net.

interface AskingMasterProps {
  roomId: string
  round: number
  roundTotal: number
  mePlayerId: string
  secret: string
  startedAt: string | null
  timeLimitS: number
}

export function AskingMaster({
  roomId,
  round,
  roundTotal,
  mePlayerId,
  secret,
  startedAt,
  timeLimitS,
}: AskingMasterProps) {
  const [guessError, setGuessError] = useState<string | null>(null)
  const [isGuessing, startGuessing] = useTransition()

  function handleGuess() {
    setGuessError(null)
    startGuessing(async () => {
      try {
        await markCorrectGuess(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
        })
      } catch (e) {
        setGuessError(
          e instanceof GameRpcError
            ? mapGuessError(e.code)
            : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
        )
      }
    })
  }

  return (
    <main
      data-testid="asking-phase-shell"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-4 px-6 pt-6 pb-8"
    >
      <AskingHeader
        role="master"
        round={round}
        roundTotal={roundTotal}
        startedAt={startedAt}
        timeLimitS={timeLimitS}
      />

      <p
        data-testid="master-asking-secret-reminder"
        className="text-center font-hero text-[32px] uppercase leading-none tracking-[1px] text-on-dark-soft"
      >
        Secret: {secret.toUpperCase()}
      </p>

      <div className="flex-1" />

      {guessError ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {guessError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleGuess}
        disabled={isGuessing}
        aria-busy={isGuessing}
        data-testid="master-mark-correct-cta"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
      >
        <span className="font-display text-[20px] uppercase tracking-[1px]">
          {isGuessing ? "กำลังบันทึก..." : "✓ ทายถูกแล้ว"}
        </span>
      </button>
    </main>
  )
}

function mapGuessError(code: string): string {
  switch (code) {
    case "PG002":
      return "หมดเวลาแล้ว"
    case "PG015":
      return "เฉพาะผู้ตัดสินเท่านั้น"
    case "PG016":
      return "ยังไม่ถึงรอบทาย"
    default:
      return "ไม่สามารถบันทึกได้"
  }
}
