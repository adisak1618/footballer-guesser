"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { startInsiderRoundAction } from "@/app/actions/start-insider-round"
import { resetInsiderGameAction } from "@/app/actions/reset-insider-game"
import { advanceToReveal } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// Issue #24 — game-end leaderboard. Replaces the standard Reveal screen when
// `phase ∈ {'reveal','result_failed'}` AND `current_round >= max_rounds`.
//
// Permissions: PLAY AGAIN and BACK TO LOBBY are host-only writes (the
// underlying reset_insider_game RPC + start_insider_round RPC reject non-hosts
// with PGAME12, but we also gate the buttons client-side so non-hosts see
// "รอโฮสต์..." copy instead of an error).
//
// Surface: dark navy bg + Bebas Neue header (Stadium Energy). 1st-place row
// uses the player's tag color background and a larger BIG NAME card; 2nd+
// rows reuse the standard Reveal score-tile treatment for visual continuity.

interface FinalScoreboardPlayer {
  id: string
  player_id: string
  display_name: string
  join_order: number
  total_score: number
}

interface FinalScoreboardProps {
  roomId: string
  round: number
  mePlayerId: string
  isHost: boolean
  // Phase is passed through to drive the same scoring fire-on-mount as Reveal
  // — without it a player who reloads on the final round's result_failed
  // wouldn't trigger advance_to_reveal idempotency. Both phases are valid.
  phase: "reveal" | "result_failed"
}

const TAG_BG_BY_INDEX = [
  "bg-tag-red",
  "bg-tag-blue",
  "bg-tag-yellow",
  "bg-tag-green",
  "bg-tag-purple",
  "bg-tag-orange",
  "bg-tag-pink",
  "bg-tag-cyan",
] as const

const TAG_TEXT_BY_INDEX = [
  "text-on-dark",
  "text-on-dark",
  "text-ink",
  "text-on-dark",
  "text-on-dark",
  "text-on-dark",
  "text-on-dark",
  "text-ink",
] as const

export function FinalScoreboard({
  roomId,
  round,
  mePlayerId,
  isHost,
  phase,
}: FinalScoreboardProps) {
  const [players, setPlayers] = useState<FinalScoreboardPlayer[]>([])
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startAction] = useTransition()
  const [pendingAction, setPendingAction] = useState<
    "play-again" | "back-to-lobby" | null
  >(null)

  // Same advance_to_reveal idempotency seal as the standard Reveal screen.
  // Reload on the final round must still drive scoring; the RPC short-circuits
  // on already-scored rounds via scored_at.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await advanceToReveal(supabase, { roomId, round })
        if (!cancelled) setScoreError(null)
      } catch {
        if (!cancelled) {
          setScoreError(
            "บันทึกผลรอบนี้ไม่สำเร็จ ลองใหม่อีกครั้งหรือเช็คการเชื่อมต่อ",
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId, round, phase])

  // Initial fetch + realtime: re-pull players when total_score changes (e.g.
  // the host hits PLAY AGAIN — though by then we'll have routed away).
  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from("players")
        .select("id, player_id, display_name, join_order, total_score")
        .eq("room_id", roomId)
        .order("join_order", { ascending: true })
      if (!active) return
      setPlayers((data ?? []) as FinalScoreboardPlayer[])
    })()
    return () => {
      active = false
    }
  }, [roomId])

  useEffect(() => {
    const channel = supabase
      .channel(`final-scoreboard-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("players")
            .select("id, player_id, display_name, join_order, total_score")
            .eq("room_id", roomId)
            .order("join_order", { ascending: true })
          if (data) setPlayers(data as FinalScoreboardPlayer[])
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId])

  const sortedPlayers = useMemo(() => {
    // Sort desc by total_score, then by join_order asc as a stable tie-break
    // (so refreshes don't reorder players who happen to have equal scores).
    return [...players].sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score
      return a.join_order - b.join_order
    })
  }, [players])

  const winner = sortedPlayers[0] ?? null
  const winnerTagIndex = winner ? (winner.join_order - 1) % 8 : 0
  const winnerTagBg = TAG_BG_BY_INDEX[winnerTagIndex] ?? "bg-tag-red"
  const winnerTagText = TAG_TEXT_BY_INDEX[winnerTagIndex] ?? "text-on-dark"

  const handlePlayAgain = useCallback(() => {
    if (!isHost) return
    setActionError(null)
    setPendingAction("play-again")
    startAction(async () => {
      const reset = await resetInsiderGameAction({ roomId, playerId: mePlayerId })
      if (!reset.ok) {
        setActionError(reset.error)
        setPendingAction(null)
        return
      }
      const start = await startInsiderRoundAction({ roomId, playerId: mePlayerId })
      if (!start.ok) {
        setActionError(start.error)
        setPendingAction(null)
        return
      }
      // On success, the realtime subscription on rooms in lobby.tsx flips
      // status → PLAYING + current_round → 1 and the screen re-routes to
      // RoleReveal. No explicit navigation needed.
    })
  }, [isHost, roomId, mePlayerId])

  const handleBackToLobby = useCallback(() => {
    if (!isHost) return
    setActionError(null)
    setPendingAction("back-to-lobby")
    startAction(async () => {
      const reset = await resetInsiderGameAction({ roomId, playerId: mePlayerId })
      if (!reset.ok) {
        setActionError(reset.error)
        setPendingAction(null)
        return
      }
      // After reset the rooms subscription flips status → LOBBY +
      // current_round → 0. lobby.tsx re-routes to LobbyView (initial variant
      // because current_round < 1).
    })
  }, [isHost, roomId, mePlayerId])

  return (
    <main
      data-testid="insider-final-scoreboard"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 bg-ink px-6 pt-8 pb-10 text-on-dark"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <h1
          data-testid="insider-final-header"
          className="font-display text-[56px] uppercase leading-none tracking-[1px] text-on-dark"
        >
          GAME OVER
        </h1>
        <p className="font-body text-[14px] text-on-dark-soft">จบเกมแล้ว</p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Final leaderboard">
        <p className="text-center font-display text-[12px] uppercase tracking-[2px] text-on-dark-soft">
          ── FINAL SCORES ──
        </p>
        <ol
          data-testid="insider-final-leaderboard"
          className="flex flex-col gap-2"
        >
          {sortedPlayers.map((p, idx) => {
            const isFirst = idx === 0
            const rank = idx + 1
            if (isFirst) {
              return (
                <li
                  key={p.id}
                  data-testid={`insider-final-row-${p.player_id}`}
                  data-rank={rank}
                  className={`flex flex-col items-center gap-1 rounded-2xl ${winnerTagBg} ${winnerTagText} px-4 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.25)]`}
                >
                  <span className="font-display text-[12px] uppercase tracking-[2px] opacity-80">
                    1ST PLACE
                  </span>
                  <span
                    data-testid="insider-final-winner-name"
                    className="font-hero text-[64px] leading-[0.95] tracking-[1px]"
                  >
                    {p.display_name.toUpperCase()}
                  </span>
                  <span
                    data-testid="insider-final-winner-score"
                    className="font-display text-[28px] tabular-nums"
                  >
                    {p.total_score} pts
                  </span>
                </li>
              )
            }
            return (
              <li
                key={p.id}
                data-testid={`insider-final-row-${p.player_id}`}
                data-rank={rank}
                className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3 text-on-dark"
              >
                <span className="flex items-center gap-3">
                  <span className="font-display text-[14px] tabular-nums text-on-dark-soft">
                    {rank}
                  </span>
                  <span className="font-body text-[14px] font-medium">
                    {p.display_name}
                  </span>
                </span>
                <span className="font-display text-[18px] tabular-nums">
                  {p.total_score} pts
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      {scoreError ? (
        <p
          role="alert"
          data-testid="insider-final-score-error"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {scoreError}
        </p>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          data-testid="insider-final-action-error"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {actionError}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          data-testid="insider-final-play-again-cta"
          onClick={handlePlayAgain}
          disabled={!isHost || isPending}
          aria-busy={isPending && pendingAction === "play-again"}
          aria-disabled={!isHost || isPending}
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 font-display text-[20px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {pendingAction === "play-again"
            ? "กำลังเริ่ม..."
            : isHost
              ? "PLAY AGAIN →"
              : "รอโฮสต์เริ่มเกมใหม่"}
        </button>
        <button
          type="button"
          data-testid="insider-final-back-to-lobby-cta"
          onClick={handleBackToLobby}
          disabled={!isHost || isPending}
          aria-busy={isPending && pendingAction === "back-to-lobby"}
          aria-disabled={!isHost || isPending}
          className="flex min-h-14 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 font-display text-[16px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-surface disabled:opacity-60"
        >
          {pendingAction === "back-to-lobby"
            ? "กำลังกลับ..."
            : "BACK TO LOBBY"}
        </button>
      </div>
    </main>
  )
}
