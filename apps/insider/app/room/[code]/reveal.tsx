"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  advanceToNextRound,
  advanceToReveal,
  getRevealedSecret,
} from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-062 / Phase 5b.7a — Reveal phase screen (Screen 8a — INSIDER CAUGHT).
//
// Mounts when room.status === 'PLAYING' AND game_insider_round.phase ===
// 'reveal'. Phase 5b.7a covers the CAUGHT variant only (light alt bg). The
// ESCAPED (8b) and TIME-EXPIRED (8c) variants land in US-063/US-064.
//
// Outcome detection: caught = (insider's player_id ∈ top-voted set). The
// component fetches per-round metadata (secret, roles, votes) and the
// players table (display names, total_score) on mount + via realtime so
// reloading mid-reveal restores correctly. Scoring itself is server-side
// (advance_to_reveal stamps scored_at + bumps players.total_score) — we just
// derive the "+2 / +0" badge from the caught/escaped outcome.
//
// NEXT ROUND CTA: any connected player (T-3.B) can click. advance_to_next_round
// flips rooms.status back to 'LOBBY' so the host can start the next round
// (start_insider_round is host-only by design — the LOBBY → PLAYING transition
// stays a single-coordinator action).

interface RevealProps {
  roomId: string
  round: number
  mePlayerId: string
}

interface PlayerRow {
  id: string
  player_id: string
  display_name: string
  join_order: number
  total_score: number
}

interface RoleRow {
  player_id: string
  role: string
}

interface VoteRow {
  voter_player_id: string
  voted_player_id: string
}

export function Reveal({ roomId, round, mePlayerId }: RevealProps) {
  const [secret, setSecret] = useState<string | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [votes, setVotes] = useState<VoteRow[]>([])
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [isAdvancing, startAdvancing] = useTransition()

  // ─── Drive scoring on mount (T-3.B "anyone advances"). advance_to_reveal
  //     is idempotent via scored_at, so concurrent fires by all 4 clients
  //     collapse safely. cast_vote already flipped phase → 'reveal' but does
  //     NOT apply scoring; this is the canonical "compute the scoreboard"
  //     entry point per migration 0028. Players row + total_score realtime
  //     subscription below picks up the score deltas.
  useEffect(() => {
    void advanceToReveal(supabase, { roomId, round }).catch(() => {
      // No-op: another client may have advanced first; phase column already
      // reflects 'reveal' regardless and players realtime will sync scores.
    })
  }, [roomId, round])

  // ─── Initial fetch ─────────────────────────────────────────────────────
  // The secret is column-RLS-protected on game_insider_round (anon SELECT
  // on secret_value is denied — migration 0017). On the reveal phase it's
  // exposed to all in-room players via get_revealed_secret (migration 0033)
  // which gates on phase ∈ {'reveal','result_failed'}.
  useEffect(() => {
    let active = true
    void (async () => {
      const [secretValue, { data: playerRows }, { data: roleRows }, { data: voteRows }] =
        await Promise.all([
          getRevealedSecret(supabase, {
            roomId,
            round,
            playerId: mePlayerId,
          }).catch(() => null),
          supabase
            .from("players")
            .select("id, player_id, display_name, join_order, total_score")
            .eq("room_id", roomId)
            .order("join_order", { ascending: true }),
          supabase
            .from("game_insider_roles")
            .select("player_id, role")
            .eq("room_id", roomId)
            .eq("round_number", round),
          supabase
            .from("game_insider_votes")
            .select("voter_player_id, voted_player_id")
            .eq("room_id", roomId)
            .eq("round_number", round),
        ])
      if (!active) return
      setSecret(secretValue ?? null)
      setPlayers((playerRows ?? []) as PlayerRow[])
      setRoles((roleRows ?? []) as RoleRow[])
      setVotes((voteRows ?? []) as VoteRow[])
    })()
    return () => {
      active = false
    }
  }, [roomId, round, mePlayerId])

  // ─── Realtime: re-pull players (total_score) when scoring lands ────────
  useEffect(() => {
    const channel = supabase
      .channel(`reveal-${roomId}-${round}`)
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
          if (data) setPlayers(data as PlayerRow[])
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, round])

  // ─── Derived state ─────────────────────────────────────────────────────
  const insiderRole = roles.find((r) => r.role === "insider")
  const insiderPlayer = useMemo(
    () => players.find((p) => p.player_id === insiderRole?.player_id) ?? null,
    [players, insiderRole],
  )

  // Tally votes, find top-voted set (ties all share max — D2).
  const tally = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of votes) {
      counts.set(v.voted_player_id, (counts.get(v.voted_player_id) ?? 0) + 1)
    }
    let top = 0
    for (const c of counts.values()) if (c > top) top = c
    const topSet = new Set<string>()
    for (const [pid, c] of counts.entries()) if (c === top) topSet.add(pid)
    return { counts, topSet, top }
  }, [votes])

  const caught = insiderRole ? tally.topSet.has(insiderRole.player_id) : false

  // Voted-by display names for the Insider.
  const insiderVoters = useMemo(() => {
    if (!insiderRole) return []
    return votes
      .filter((v) => v.voted_player_id === insiderRole.player_id)
      .map((v) => players.find((p) => p.player_id === v.voter_player_id))
      .filter((p): p is PlayerRow => Boolean(p))
  }, [votes, insiderRole, players])

  // Per-player round score deltas (caught variant).
  const roundDelta = useCallback(
    (player: PlayerRow): number => {
      const role = roles.find((r) => r.player_id === player.player_id)?.role
      if (!role) return 0
      if (caught) {
        return role === "insider" ? 0 : 2
      }
      // Escaped path (US-063 will own the visual; just compute correctly).
      return role === "insider" ? 3 : 0
    },
    [roles, caught],
  )

  // Leaderboard sorted desc by total_score.
  const leaderboard = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score),
    [players],
  )

  const handleNextRound = useCallback(() => {
    setAdvanceError(null)
    startAdvancing(async () => {
      try {
        await advanceToNextRound(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
        })
      } catch {
        setAdvanceError("ไปต่อรอบถัดไปไม่สำเร็จ ลองใหม่อีกครั้ง")
      }
    })
  }, [roomId, round, mePlayerId])

  // ─── Render ────────────────────────────────────────────────────────────
  // Phase 5b.7a covers the CAUGHT variant only. ESCAPED + TIME-EXPIRED come
  // in US-063 / US-064. Until then a non-caught reveal still renders the
  // same shell so happy-path multi-round flow doesn't get stuck on a blank
  // screen, but the badge text + bg are scoped to caught semantics.
  const insiderTagColorIndex = insiderPlayer
    ? ((insiderPlayer.join_order - 1) % 8) + 1
    : 1
  const insiderTagBg = `bg-tag-${
    [
      "red",
      "blue",
      "yellow",
      "green",
      "purple",
      "orange",
      "pink",
      "cyan",
    ][insiderTagColorIndex - 1]
  }`

  return (
    <main
      data-testid="reveal-caught-shell"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 bg-canvas px-6 pt-8 pb-10 text-on-light"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <h1
          data-testid="reveal-round-header"
          className="font-display text-[40px] uppercase leading-none tracking-[1px] text-on-light"
        >
          ROUND {round} RESULT
        </h1>
      </header>

      <section className="flex flex-col items-center gap-3 text-center">
        <p className="font-display text-[12px] uppercase tracking-[2px] text-on-light-soft">
          ── THE SECRET WAS ──
        </p>
        <div
          className="flex w-full flex-col items-center justify-center rounded-2xl bg-tag-pink px-4 py-8 shadow-[0_8px_24px_rgba(236,72,153,0.25)]"
        >
          <p
            data-testid="reveal-secret-name"
            className="font-hero text-[64px] leading-[0.95] tracking-[1px] text-on-dark"
          >
            {(secret ?? "").toUpperCase()}
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center gap-3 text-center">
        <p className="font-display text-[12px] uppercase tracking-[2px] text-on-light-soft">
          ── THE INSIDER WAS ──
        </p>
        <div
          data-testid="reveal-insider-badge"
          className={`flex w-full flex-col items-center gap-2 rounded-2xl ${insiderTagBg} px-4 py-5 text-on-dark`}
        >
          <p className="font-display text-[24px] uppercase leading-none tracking-[1px]">
            ⚠ {insiderPlayer?.display_name ?? "—"} — CAUGHT!
          </p>
          {insiderVoters.length > 0 ? (
            <p
              data-testid="reveal-voted-by"
              className="font-body text-[14px] leading-snug text-on-dark/90"
            >
              Voted by: {insiderVoters.map((v) => v.display_name).join(", ")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-display text-[12px] uppercase tracking-[2px] text-center text-on-light-soft">
          ── ROUND SCORES ──
        </p>
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => {
            const role = roles.find((r) => r.player_id === p.player_id)?.role
            const delta = roundDelta(p)
            const label =
              role === "master"
                ? `${p.display_name} (Master)`
                : role === "insider"
                  ? `${p.display_name} (Insider, ${caught ? "caught" : "escaped"})`
                  : p.display_name
            return (
              <li
                key={p.id}
                data-testid={`reveal-score-tile-${p.player_id}`}
                className="flex items-center justify-between rounded-lg border border-on-light/10 bg-surface-card px-4 py-2.5 text-on-light"
              >
                <span className="font-body text-[14px] font-medium">
                  {label}
                </span>
                <span className="font-display text-[18px] tabular-nums text-on-light">
                  {delta > 0 ? `+${delta}` : "0"} pts
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-display text-[12px] uppercase tracking-[2px] text-center text-on-light-soft">
          ── LEADERBOARD ──
        </p>
        <ul className="flex flex-col gap-1.5">
          {leaderboard.map((p, idx) => (
            <li
              key={p.id}
              data-testid={`reveal-leader-row-${p.player_id}`}
              className="flex items-center justify-between rounded-lg border border-on-light/10 bg-surface-card px-4 py-2.5 text-on-light"
            >
              <span className="font-body text-[14px] font-medium">
                {idx + 1}. {p.display_name}
              </span>
              <span className="font-display text-[18px] tabular-nums text-on-light">
                {p.total_score} pts
              </span>
            </li>
          ))}
        </ul>
      </section>

      {advanceError ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {advanceError}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="reveal-next-round-cta"
        onClick={handleNextRound}
        disabled={isAdvancing}
        aria-busy={isAdvancing}
        className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 font-display text-[20px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
      >
        {isAdvancing ? "กำลังไป..." : "NEXT ROUND →"}
      </button>
    </main>
  )
}
