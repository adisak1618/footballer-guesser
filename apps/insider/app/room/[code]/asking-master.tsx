"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { GameRpcError } from "@social-hub/core"
import { ResponseButton, type ResponseButtonVariant } from "@social-hub/ui"
import {
  markCorrectGuess,
  masterRespond,
  type MasterResponse,
} from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-059 / Phase 5b.5b — Master view of the asking phase, wireframe Screen 6a.
//
// Per design decision D1, the response buttons are the primary task and fill
// most of the viewport (each ≥96px tall, vertically stacked). The response
// feed is a collapsed accordion below them — Master mostly cares about the
// next answer, not history. The "ทายถูกแล้ว" CTA at the bottom is goal-red
// and visually distinct from the No/error button it shares a hue with by
// being smaller, padded, and below the feed accordion.
//
// Wraps:
//   - master_respond  (migration 0024) for Yes/No/Unsure taps
//   - mark_correct_guess (migration 0025) for the bottom CTA
//   - Realtime INSERT on game_insider_responses → keeps the feed live without
//     a polling loop (subscribes inside this component so the parent doesn't
//     need to know about the asking-phase wire format).

interface AskingMasterProps {
  roomId: string
  round: number
  mePlayerId: string
  secret: string
  startedAt: string | null
  timeLimitS: number
}

interface ResponseRow {
  id: number
  response: MasterResponse
  created_at: string
}

const RESPONSE_ICON: Record<MasterResponse, string> = {
  yes: "✓",
  no: "✗",
  unsure: "?",
}

const RESPONSE_VARIANT: Record<MasterResponse, ResponseButtonVariant> = {
  yes: "success",
  no: "error",
  unsure: "warning",
}

const RESPONSE_LABEL_TH: Record<MasterResponse, string> = {
  yes: "ใช่",
  no: "ไม่ใช่",
  unsure: "ไม่แน่ใจ",
}

const RESPONSE_LABEL_EN: Record<MasterResponse, string> = {
  yes: "YES",
  no: "NO",
  unsure: "UNSURE",
}

const TRAIL_LIMIT = 5

export function AskingMaster({
  roomId,
  round,
  mePlayerId,
  secret,
  startedAt,
  timeLimitS,
}: AskingMasterProps) {
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [feedExpanded, setFeedExpanded] = useState(false)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [guessError, setGuessError] = useState<string | null>(null)
  const [isResponding, startResponding] = useTransition()
  const [isGuessing, startGuessing] = useTransition()
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Initial fetch + Realtime subscription on game_insider_responses.
  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from("game_insider_responses")
        .select("id, response, created_at")
        .eq("room_id", roomId)
        .eq("round_number", round)
        .order("id", { ascending: true })
      if (!active) return
      setResponses((data ?? []) as ResponseRow[])
    })()

    const channel = supabase
      .channel(`asking-master-${roomId}-${round}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_insider_responses",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as ResponseRow & { round_number: number }
          if (row.round_number !== round) return
          setResponses((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                response: row.response,
                created_at: row.created_at,
              },
            ]
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [roomId, round])

  // 1s timer tick. Only re-renders the timer + relative-time labels — the
  // response buttons / feed are React-stable across re-renders.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remainingS = useMemo(() => {
    if (!startedAt) return timeLimitS
    const elapsed = (nowMs - new Date(startedAt).getTime()) / 1000
    return Math.max(0, Math.floor(timeLimitS - elapsed))
  }, [startedAt, timeLimitS, nowMs])

  const isLowTime = remainingS < 30
  const mm = Math.floor(remainingS / 60)
    .toString()
    .padStart(2, "0")
  const ss = (remainingS % 60).toString().padStart(2, "0")

  const trail = useMemo(() => {
    if (responses.length === 0) return "—"
    const recent = responses.slice(-TRAIL_LIMIT)
    return recent.map((r) => RESPONSE_ICON[r.response]).join(" • ")
  }, [responses])

  function handleRespond(response: MasterResponse) {
    setRespondError(null)
    startResponding(async () => {
      try {
        await masterRespond(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
          response,
        })
      } catch (e) {
        setRespondError(
          e instanceof GameRpcError
            ? mapRespondError(e.code)
            : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
        )
      }
    })
  }

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
      <header className="flex items-center justify-between">
        <span
          data-testid="asking-phase-tag"
          className="rounded-md border border-hairline bg-surface-elevated px-3 py-1 font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark"
        >
          ASKING
        </span>
        <span
          data-testid="asking-timer"
          className={`font-hero text-[32px] leading-none tabular-nums ${
            isLowTime ? "text-error" : "text-on-dark"
          }`}
        >
          {mm}:{ss}
        </span>
      </header>

      <p
        data-testid="master-asking-secret-reminder"
        className="text-center font-hero text-[32px] uppercase leading-none tracking-[1px] text-on-dark-soft"
      >
        Secret: {secret.toUpperCase()}
      </p>

      <p className="text-center font-display text-[20px] uppercase leading-none tracking-[1px] text-on-dark-muted">
        ── TAP TO ANSWER ──
      </p>

      <section
        data-testid="master-response-buttons"
        className="flex flex-1 flex-col gap-3"
      >
        {(["yes", "no", "unsure"] as const).map((r) => (
          <ResponseButton
            key={r}
            variant={RESPONSE_VARIANT[r]}
            icon={RESPONSE_ICON[r]}
            labelTh={RESPONSE_LABEL_TH[r]}
            labelEn={RESPONSE_LABEL_EN[r]}
            disabled={isResponding || isGuessing || remainingS <= 0}
            onClick={() => handleRespond(r)}
            testId={`master-respond-${r}`}
          />
        ))}
      </section>

      {respondError ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {respondError}
        </p>
      ) : null}

      {/* US-080 / Phase 5d.6 — Response feed lives in <aside> so the asking
       * phase exposes the ARIA-landmark trio (main/header/aside). The list
       * itself is aria-live="polite" so screen readers announce new responses
       * as they land via Realtime. */}
      <aside aria-label="Master responses" className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setFeedExpanded((v) => !v)}
          data-testid="master-feed-accordion-toggle"
          aria-expanded={feedExpanded}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left"
        >
          <span className="font-body text-[13px] uppercase tracking-[0.3px] text-on-dark-soft">
            ตอบล่าสุด
          </span>
          <span
            data-testid="master-feed-trail"
            className="font-display text-[18px] tracking-[1px] text-on-dark"
          >
            {trail}
          </span>
        </button>
        {feedExpanded ? (
          <ul
            data-testid="master-feed-list"
            aria-live="polite"
            className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-elevated px-4 py-3 text-sm text-on-dark"
          >
            {responses.length === 0 ? (
              <li className="text-center text-on-dark-soft">ยังไม่มีคำตอบ</li>
            ) : (
              [...responses].reverse().map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    {RESPONSE_ICON[r.response]} {RESPONSE_LABEL_TH[r.response]}
                  </span>
                  <span className="text-xs tabular-nums text-on-dark-soft">
                    {formatRelative(r.created_at, nowMs)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </aside>

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
        disabled={isGuessing || isResponding}
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

function mapRespondError(code: string): string {
  switch (code) {
    case "PG002":
      return "หมดเวลาแล้ว"
    case "PG015":
      return "เฉพาะผู้ตัดสินเท่านั้น"
    case "PG016":
      return "ยังไม่ถึงรอบตอบ"
    default:
      return "ไม่สามารถตอบได้"
  }
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

function formatRelative(iso: string, nowMsLocal: number): string {
  const ago = Math.max(
    0,
    Math.floor((nowMsLocal - new Date(iso).getTime()) / 1000),
  )
  if (ago < 60) return `${ago}s ago`
  const minutes = Math.floor(ago / 60)
  return `${minutes}m ago`
}
