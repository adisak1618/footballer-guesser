"use client"

import { useEffect, useMemo, useState } from "react"
import { ResponseFeedEntry } from "@social-hub/ui"
import type { MasterResponse } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-060 / Phase 5b.5c — Non-Master asking-phase view (Screen 6b).
//
// Insider and Common share a single component so the rendered DOM is
// identical (D4 anti-cheat parity) — the structure, copy, ordering, and
// realtime behaviour are common to both. The ONE asymmetric piece is the
// Insider-only D2 hint: a subtle warning-yellow caption that fades in after
// 30s of group silence (or 30s after the most recent response). Common's
// rendered tree never includes the hint at all (testid count = 0), so the
// asymmetry is structural, not just a CSS opacity flip.

type InsiderRole = "master" | "insider" | "player"

interface AskingOtherProps {
  roomId: string
  round: number
  role: Exclude<InsiderRole, "master">
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

// Number of seconds of group silence before the Insider hint becomes visible
// (D2). Threshold begins at the round's started_at; if a response lands, it
// resets to that response's created_at.
const HINT_SILENCE_THRESHOLD_S = 30

export function AskingOther({
  roomId,
  round,
  role,
  startedAt,
  timeLimitS,
}: AskingOtherProps) {
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Initial fetch + Realtime subscription on game_insider_responses.
  // Mirrors the AskingMaster subscription so non-Master views stay live
  // independently of the Master's component lifecycle.
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
      .channel(`asking-other-${roomId}-${round}-${role}`)
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
  }, [roomId, round, role])

  // 1s timer tick drives both the countdown and the D2 silence threshold.
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

  const lastActivityMs = useMemo(() => {
    const last = responses[responses.length - 1]
    if (last) return new Date(last.created_at).getTime()
    if (startedAt) return new Date(startedAt).getTime()
    return null
  }, [responses, startedAt])

  const hintVisible = useMemo(() => {
    if (role !== "insider") return false
    if (lastActivityMs === null) return false
    return (nowMs - lastActivityMs) / 1000 >= HINT_SILENCE_THRESHOLD_S
  }, [role, lastActivityMs, nowMs])

  const reversed = useMemo(() => [...responses].reverse(), [responses])

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

      <section
        data-testid="asking-other-instruction"
        className="flex flex-col items-center gap-1 text-center"
      >
        <p className="font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark">
          ── ASK OUT LOUD ──
        </p>
        <p className="font-body text-[15px] leading-snug text-on-dark-soft">
          ถามดัง ๆ ในกลุ่ม
        </p>
      </section>

      {/* US-080 / Phase 5d.6 — aria-live="polite" so screen readers announce
       * new Realtime responses without stealing focus, and aria-label so the
       * landmark has a name independent of the visible "ASK OUT LOUD" copy
       * above it. */}
      <ul
        data-testid="asking-other-feed"
        aria-live="polite"
        aria-label="Master responses"
        className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-hairline bg-surface-elevated px-3 py-3"
      >
        {responses.length === 0 ? (
          <li className="flex flex-1 items-center justify-center text-center text-sm text-on-dark-soft">
            ยังไม่มีคำตอบ — Master จะกดปุ่มเมื่อมีคำถาม
          </li>
        ) : (
          reversed.map((r) => (
            <ResponseFeedEntry
              key={r.id}
              testId="asking-other-feed-row"
              timeTestId="asking-other-feed-time"
              timestamp={formatRelative(r.created_at, nowMs)}
              icon={RESPONSE_ICON[r.response]}
              labelEn={RESPONSE_LABEL_EN[r.response]}
              labelTh={RESPONSE_LABEL_TH[r.response]}
            />
          ))
        )}
      </ul>

      {role === "insider" ? (
        <p
          data-testid="asking-other-insider-hint"
          data-state={hintVisible ? "visible" : "hidden"}
          aria-hidden={!hintVisible}
          className={`text-center font-body text-[13px] italic tracking-[0.2px] text-warning transition-opacity duration-500 ${
            hintVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          💡 Drop a question they can use
        </p>
      ) : null}
    </main>
  )
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
