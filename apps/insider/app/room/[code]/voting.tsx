"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { GameRpcError } from "@social-hub/core"
import { VoteTargetCard } from "@social-hub/ui"
import { advanceToVoting, castVote } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-061 / Phase 5b.6 — Voting phase screen (Screen 7 + D6).
//
// The room reaches this screen with phase ∈ {'guessed', 'voting'}.
//   - 'guessed': brief 2s celebration UI, then any client triggers
//     advance_to_voting → phase='voting'. Per T-3.B "anyone can advance" the
//     RPC is idempotent (WHERE phase='guessed') so concurrent fires by all
//     clients collapse safely to one DB write.
//   - 'voting': full Screen 7 — 4 vote-target-cards, 60s deadline countdown,
//     "X / 4 voted" group progress, NO per-player tallies (D6 anti-herding).
//     Tap a card to call cast_vote; cast_vote auto-flips phase → 'reveal'
//     when the final eligible voter has cast.
//
// Vote selection is local-state-driven (selectedTargetId) so the visual
// "ring + ✓" reflects what THIS player most recently tapped — independent of
// what the DB row says (the DB is consulted only on mount to restore state
// after a reload). Tap-toggle-deselect uses a sentinel "self" voted_player_id
// (the voter's own player_id) since cast_vote requires a non-null target.
// To keep the UX clean, we treat re-tapping the same card as "switch to a
// noop self-vote" so the audit trail is correct (last intent wins) and the
// UI shows nothing as selected.
//
// Realtime: subscribe to `game_insider_round` (phase) + `game_insider_votes`
// (group progress count). Reveal-phase routing is handled by `lobby.tsx` so
// when phase flips to 'reveal' this component unmounts.

type VotingPhase = "guessed" | "voting"

interface VotingProps {
  roomId: string
  round: number
  mePlayerId: string
  initialPhase: VotingPhase
}

interface PlayerRow {
  id: string
  player_id: string
  display_name: string
  join_order: number
}

const GUESSED_CELEBRATION_MS = 2000

export function Voting({ roomId, round, mePlayerId, initialPhase }: VotingProps) {
  const [phase, setPhase] = useState<VotingPhase>(initialPhase)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [voteDeadline, setVoteDeadline] = useState<string | null>(null)
  const [eligibleIds, setEligibleIds] = useState<string[] | null>(null)
  const [voteCount, setVoteCount] = useState<number>(0)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [, startVoting] = useTransition()

  // ─── Initial fetch: round state + players + my prior vote (for reload) ──
  useEffect(() => {
    let active = true
    void (async () => {
      const [{ data: roundRow }, { data: playerRows }, { data: myVote }] =
        await Promise.all([
          supabase
            .from("game_insider_round")
            .select("phase, vote_deadline, eligible_voter_ids")
            .eq("room_id", roomId)
            .eq("round_number", round)
            .maybeSingle(),
          supabase
            .from("players")
            .select("id, player_id, display_name, join_order")
            .eq("room_id", roomId)
            .order("join_order", { ascending: true }),
          supabase
            .from("game_insider_votes")
            .select("voted_player_id")
            .eq("room_id", roomId)
            .eq("round_number", round)
            .eq("voter_player_id", mePlayerId)
            .maybeSingle(),
        ])
      if (!active) return
      if (roundRow) {
        setVoteDeadline((roundRow.vote_deadline as string | null) ?? null)
        setEligibleIds(
          (roundRow.eligible_voter_ids as string[] | null) ?? null,
        )
        const p = roundRow.phase as string
        if (p === "voting" || p === "guessed") setPhase(p)
      }
      if (playerRows) setPlayers(playerRows as PlayerRow[])
      if (myVote?.voted_player_id) {
        const target = myVote.voted_player_id as string
        // Treat self-vote sentinel as deselected; otherwise restore selection.
        setSelectedTarget(target === mePlayerId ? null : target)
      }
      const { count } = await supabase
        .from("game_insider_votes")
        .select("voter_player_id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("round_number", round)
      if (active && typeof count === "number") setVoteCount(count)
    })()
    return () => {
      active = false
    }
  }, [roomId, round, mePlayerId])

  // ─── Realtime: round phase + votes count ────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`voting-${roomId}-${round}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_insider_round",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return
          const row = payload.new as {
            round_number: number
            phase: string
            vote_deadline: string | null
            eligible_voter_ids: string[] | null
          }
          if (row.round_number !== round) return
          if (row.phase === "voting" || row.phase === "guessed") {
            setPhase(row.phase)
          }
          setVoteDeadline(row.vote_deadline ?? null)
          setEligibleIds(row.eligible_voter_ids ?? null)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_insider_votes",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { count } = await supabase
            .from("game_insider_votes")
            .select("voter_player_id", { count: "exact", head: true })
            .eq("room_id", roomId)
            .eq("round_number", round)
          if (typeof count === "number") setVoteCount(count)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, round])

  // ─── 1s timer tick ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ─── Guessed → voting auto-advance after celebration delay (T-3.B) ─────
  // Any client fires advance_to_voting; the RPC's WHERE phase='guessed'
  // filter makes concurrent fires idempotent so we don't gate on host.
  useEffect(() => {
    if (phase !== "guessed") return
    const id = setTimeout(() => {
      void (async () => {
        try {
          await advanceToVoting(supabase, {
            roomId,
            round,
            playerId: mePlayerId,
          })
        } catch {
          // No-op: another client may have advanced first; phase realtime
          // event will land regardless.
        }
      })()
    }, GUESSED_CELEBRATION_MS)
    return () => clearTimeout(id)
  }, [phase, roomId, round, mePlayerId])

  // ─── Vote-deadline countdown ───────────────────────────────────────────
  const remainingS = useMemo(() => {
    if (!voteDeadline) return 0
    const deadline = new Date(voteDeadline).getTime()
    return Math.max(0, Math.floor((deadline - nowMs) / 1000))
  }, [voteDeadline, nowMs])

  const isLowTime = remainingS <= 10
  const mm = Math.floor(remainingS / 60)
    .toString()
    .padStart(2, "0")
  const ss = (remainingS % 60).toString().padStart(2, "0")

  const eligibleCount = eligibleIds?.length ?? 0
  const isEligible = eligibleIds ? eligibleIds.includes(mePlayerId) : false

  // Eligible voters cap the displayed group-progress denominator. Vote count
  // is filtered server-side via cast_vote eligibility, so the displayed X
  // never exceeds the eligible count.
  const cappedCount = Math.min(voteCount, eligibleCount || voteCount)

  const handleTap = useCallback(
    (targetPlayerId: string) => {
      if (phase !== "voting" || !isEligible) return
      const isReTap = selectedTarget === targetPlayerId
      // Re-tap same target → record a self-vote sentinel so the UI shows
      // de-selected. cast_vote requires a non-null target so we encode
      // "deselected" as voting for self (caster's own player_id).
      const next = isReTap ? mePlayerId : targetPlayerId
      const optimistic = isReTap ? null : targetPlayerId
      const previous = selectedTarget
      setSelectedTarget(optimistic)
      setVoteError(null)
      startVoting(async () => {
        try {
          await castVote(supabase, {
            roomId,
            round,
            playerId: mePlayerId,
            votedPlayerId: next,
          })
        } catch (e) {
          setSelectedTarget(previous)
          setVoteError(
            e instanceof GameRpcError
              ? mapVoteError(e.code)
              : "ลงคะแนนไม่สำเร็จ ลองใหม่อีกครั้ง",
          )
        }
      })
    },
    [phase, isEligible, selectedTarget, roomId, round, mePlayerId],
  )

  // ─── Render ─────────────────────────────────────────────────────────────
  if (phase === "guessed") {
    return (
      <main
        data-testid="voting-celebration-shell"
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <p className="font-display text-[28px] uppercase leading-none tracking-[2px] text-on-dark-soft">
          ทายถูก!
        </p>
        <p className="font-hero text-[56px] uppercase leading-none tracking-[1px] text-on-dark">
          GROUP GUESSED
        </p>
        <p className="font-body text-sm text-on-dark-muted">
          กำลังเปิดโหวต...
        </p>
      </main>
    )
  }

  return (
    <main
      data-testid="voting-phase-shell"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-4 px-6 pt-6 pb-8"
    >
      <header className="flex items-center justify-between">
        <span
          data-testid="voting-phase-tag"
          className="rounded-md border border-hairline bg-surface-elevated px-3 py-1 font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark"
        >
          VOTING
        </span>
        <span
          data-testid="voting-deadline-timer"
          className={`font-hero text-[32px] leading-none tabular-nums ${
            isLowTime ? "text-error" : "text-on-dark"
          }`}
        >
          {mm}:{ss}
        </span>
      </header>

      <section className="flex flex-col items-center gap-1 text-center">
        <h1
          data-testid="voting-header"
          className="font-display text-[32px] uppercase leading-none tracking-[1px] text-on-dark"
        >
          WHO IS THE INSIDER?
        </h1>
        <p className="font-body text-[15px] leading-snug text-on-dark-soft">
          ใครคือคนวงใน?
        </p>
        <p className="font-body text-[13px] leading-snug text-on-dark-muted">
          แตะการ์ดผู้เล่น เปลี่ยนได้ก่อนหมดเวลา
        </p>
      </section>

      <section
        data-testid="voting-grid"
        className="grid flex-1 grid-cols-2 gap-3"
      >
        {players.map((p) => {
          const isMeRow = p.player_id === mePlayerId
          return (
            <VoteTargetCard
              key={p.id}
              testId={`vote-target-card-${p.player_id}`}
              joinOrder={p.join_order}
              displayName={p.display_name}
              selected={selectedTarget === p.player_id}
              disabled={!isEligible || isMeRow}
              onTap={() => handleTap(p.player_id)}
            />
          )
        })}
      </section>

      {voteError ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {voteError}
        </p>
      ) : null}

      <section className="flex flex-col items-center gap-1 text-center">
        <p className="font-display text-[12px] uppercase tracking-[2px] text-on-dark-muted">
          ── PROGRESS ──
        </p>
        <p
          data-testid="voting-progress"
          className="font-display text-[20px] uppercase tracking-[1px] text-on-dark"
        >
          {cappedCount} / {eligibleCount} voted
        </p>
        {!isEligible ? (
          <p className="font-body text-xs text-on-dark-muted">
            (คุณไม่ได้อยู่ในรายชื่อโหวตของรอบนี้)
          </p>
        ) : null}
      </section>
    </main>
  )
}

function mapVoteError(code: string): string {
  switch (code) {
    case "PG017":
      return "คุณไม่อยู่ในรายชื่อโหวต"
    case "PG018":
      return "ยังไม่ถึงรอบโหวต"
    case "PG019":
      return "หมดเวลาโหวตแล้ว"
    default:
      return "ลงคะแนนไม่สำเร็จ ลองใหม่อีกครั้ง"
  }
}
