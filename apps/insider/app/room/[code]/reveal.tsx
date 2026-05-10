"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  advanceToNextRound,
  advanceToReveal,
  getRevealedSecret,
} from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"
import { Scoreboard, type ScoreboardPlayer } from "./scoreboard"

// US-062 / US-063 / US-064 — Reveal phase screen (Screens 8a + 8b + 8c).
//
// Mounts when room.status === 'PLAYING' AND game_insider_round.phase ∈
// {'reveal', 'result_failed'}. Three variants share one component:
//   - 8c TIME-EXPIRED (US-064, Phase 5b.7c) — dark bg #0a0e1a + error-red top
//                      accent. Triggered by phase='result_failed' (asking timer
//                      ran out before Master tapped ทายถูกแล้ว). No voting,
//                      no scoring; everyone stays at 0. Branched FIRST so the
//                      caught-vs-escaped derivation below never executes for
//                      the no-votes case.
//   - 8a CAUGHT       (US-062, Phase 5b.7a) — light alt bg #fafbfc, pink
//                      secret card, "INSIDER WAS X — CAUGHT!" + voted-by
//                      breakdown. Master + each Common +2; Insider 0.
//   - 8b ESCAPED      (US-063, Phase 5b.7b) — dark mode bg #0a0e1a,
//                      warning-yellow accents, "👁  X — ESCAPED!" + this-player
//                      ballot summary. Insider +3; Master + each Common 0.
//
// Outcome detection: caught = (insider's player_id ∈ top-voted set). The
// component fetches per-round metadata (secret, roles, votes) and the
// players table (display names, total_score) on mount + via realtime so
// reloading mid-reveal restores correctly. Scoring itself is server-side
// (advance_to_reveal stamps scored_at + bumps players.total_score) — we just
// derive the "+pts" badges from the caught/escaped outcome.
//
// NEXT ROUND CTA: any connected player (T-3.B) can click. advance_to_next_round
// flips rooms.status back to 'LOBBY' so the host can start the next round
// (start_insider_round is host-only by design — the LOBBY → PLAYING transition
// stays a single-coordinator action).

interface RevealProps {
  roomId: string
  round: number
  mePlayerId: string
  phase: "reveal" | "result_failed"
  // Issue #17 — scoreboard gate. Only the host advances the round, and the
  // final round flips the bottom CTA into a final-results no-advance state.
  isHost: boolean
  maxRounds: number
}

type PlayerRow = ScoreboardPlayer

interface RoleRow {
  player_id: string
  role: string
}

interface VoteRow {
  voter_player_id: string
  voted_player_id: string
}

export function Reveal({
  roomId,
  round,
  mePlayerId,
  phase,
  isHost,
  maxRounds,
}: RevealProps) {
  const [secret, setSecret] = useState<string | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [votes, setVotes] = useState<VoteRow[]>([])
  // Issue #17 — outcome stamp. Null until advance_to_reveal lands; the host's
  // ต่อไป button is disabled while null so we don't advance past an
  // unscored round and so retry can keep firing on transient failure.
  const [outcome, setOutcome] = useState<string | null>(null)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [isAdvancing, startAdvancing] = useTransition()

  const isFinalRound = round >= maxRounds

  // ─── Drive scoring on mount. advance_to_reveal is idempotent via
  //     scored_at, so concurrent fires by all clients collapse safely.
  //     Issue #17: surface RPC failures (rare — usually a network blip) so
  //     the host's ต่อไป button stays disabled until a retry succeeds.
  //
  //     The effect body and the retry handler hold the same logic. They are
  //     duplicated rather than extracted into a useCallback called from the
  //     effect because react-hooks/set-state-in-effect flags an effect that
  //     invokes a setState-bearing useCallback (see apps/headball/scripts/
  //     ralph/progress.txt notes on this rule). Putting all setState calls
  //     after awaits inside the effect satisfies the rule.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await advanceToReveal(supabase, { roomId, round })
        // outcome is NOT in the realtime publication (intentional, see
        // migration 0035 commentary), so we re-pull the row here. The select
        // is column-restricted at the DB level — anon can read these
        // columns but not secret_value.
        const { data } = await supabase
          .from("game_insider_round")
          .select("outcome, scored_at")
          .eq("room_id", roomId)
          .eq("round_number", round)
          .maybeSingle()
        if (cancelled) return
        if (data?.outcome) setOutcome(data.outcome as string)
        setScoreError(null)
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
  }, [roomId, round])

  const retryAdvanceToReveal = useCallback(async () => {
    try {
      await advanceToReveal(supabase, { roomId, round })
      const { data } = await supabase
        .from("game_insider_round")
        .select("outcome, scored_at")
        .eq("room_id", roomId)
        .eq("round_number", round)
        .maybeSingle()
      if (data?.outcome) setOutcome(data.outcome as string)
      setScoreError(null)
    } catch {
      setScoreError(
        "บันทึกผลรอบนี้ไม่สำเร็จ ลองใหม่อีกครั้งหรือเช็คการเชื่อมต่อ",
      )
    }
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

  // Voted-by display names for the Insider (caught variant copy).
  const insiderVoters = useMemo(() => {
    if (!insiderRole) return []
    return votes
      .filter((v) => v.voted_player_id === insiderRole.player_id)
      .map((v) => players.find((p) => p.player_id === v.voter_player_id))
      .filter((p): p is PlayerRow => Boolean(p))
  }, [votes, insiderRole, players])

  // This player's own ballot (escaped variant copy: "You voted: X (N vote)").
  // Resolves to null when the caster either skipped or selected the self-vote
  // sentinel (voting.tsx encodes "deselected" as voting for themselves).
  const myVote = useMemo(() => {
    const row = votes.find((v) => v.voter_player_id === mePlayerId)
    if (!row || row.voted_player_id === mePlayerId) return null
    const target = players.find((p) => p.player_id === row.voted_player_id)
    if (!target) return null
    const tally_n = tally.counts.get(target.player_id) ?? 0
    return { name: target.display_name, votes: tally_n }
  }, [votes, players, mePlayerId, tally])

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

  // Issue #17 — host-only gate (rubric: "advances only when the host taps").
  // Scoring must have stamped before we advance so total_score reflects the
  // round we're leaving; a transient score error keeps the button live so the
  // host can retry the underlying advance_to_reveal RPC.
  const isScoreLanded = outcome !== null
  const ctaDisabled =
    !isHost ||
    isAdvancing ||
    isFinalRound ||
    (!isScoreLanded && !scoreError)

  const handleNextRound = useCallback(() => {
    if (isFinalRound) return
    if (scoreError) {
      // Retry path: re-fire advance_to_reveal so the score lands; user taps
      // ต่อไป again once it succeeds.
      void retryAdvanceToReveal()
      return
    }
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
  }, [roomId, round, mePlayerId, isFinalRound, scoreError, retryAdvanceToReveal])

  const ctaLabel = useMemo(() => {
    if (isFinalRound) return "MATCH OVER / จบเกม"
    if (isAdvancing) return "กำลังไป..."
    if (scoreError) return "ลองใหม่อีกครั้ง"
    if (!isScoreLanded) return "กำลังคิดคะแนน..."
    if (!isHost) return "รอโฮสต์กดต่อไป"
    return "ต่อไป / NEXT →"
  }, [isFinalRound, isAdvancing, scoreError, isScoreLanded, isHost])

  // ─── Render ────────────────────────────────────────────────────────────
  // TIME-EXPIRED (8c): dark bg + error-red top accent, secret revealed,
  //                    no voting / scoreboard / leaderboard.
  // CAUGHT (8a): light alt bg, pink secret card, tag-color badge.
  // ESCAPED (8b): dark bg, ink-on-yellow secret card, warning-yellow accents.

  if (phase === "result_failed") {
    // Variant 8c — TIME EXPIRED. Asking timer ran out; secret revealed but
    // no voting happened and no scoring is awarded (advance_to_reveal still
    // stamps scored_at as the idempotency seal — see migration 0028).
    return (
      <main
        data-testid="reveal-time-expired-shell"
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 border-t-4 border-error bg-ink px-6 pt-8 pb-10 text-on-dark"
      >
        <header className="flex flex-col items-center gap-2 text-center">
          <p
            data-testid="reveal-time-expired-round-label"
            className="font-display text-[20px] uppercase leading-none tracking-[2px] text-on-dark-soft"
          >
            ROUND {round} / {maxRounds} RESULT
          </p>
          <h1
            data-testid="reveal-time-expired-header"
            className="flex flex-col items-center gap-1 font-display text-[56px] uppercase leading-none tracking-[1px] text-error"
          >
            <span>TIME UP</span>
            <span className="font-body text-[16px] font-medium tracking-normal text-on-dark-soft">
              ทายไม่ทันเวลา
            </span>
          </h1>
        </header>

        <section className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-[12px] uppercase tracking-[2px] text-on-dark-soft">
            ── THE SECRET WAS ──
          </p>
          <div className="flex w-full flex-col items-center justify-center rounded-2xl bg-warning px-4 py-8 shadow-[0_8px_24px_rgba(251,191,36,0.25)]">
            <p
              data-testid="reveal-secret-name"
              className="font-hero text-[64px] leading-[0.95] tracking-[1px] text-on-light"
            >
              {(secret ?? "").toUpperCase()}
            </p>
          </div>
        </section>

        <section
          data-testid="reveal-no-voting-copy"
          className="flex flex-col items-center gap-1 text-center"
        >
          <p className="font-body text-[14px] leading-snug text-on-dark/90">
            No voting this round.
          </p>
          <p className="font-body text-[14px] leading-snug text-on-dark/90">
            No points awarded.
          </p>
        </section>

        <Scoreboard
          players={players}
          variant={isFinalRound ? "final" : "round-end"}
          surface="dark"
        />

        {scoreError ? (
          <p
            role="alert"
            data-testid="reveal-score-error"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
          >
            {scoreError}
          </p>
        ) : null}

        {advanceError ? (
          <p
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
          >
            {advanceError}
          </p>
        ) : null}

        {isFinalRound ? (
          <Link
            href="/"
            data-testid="reveal-final-home-link"
            className="mt-auto flex min-h-14 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 font-display text-[16px] uppercase tracking-[1px] text-on-dark active:bg-surface"
          >
            ← กลับหน้าหลัก / HOME
          </Link>
        ) : null}

        <button
          type="button"
          data-testid="reveal-next-round-cta"
          onClick={handleNextRound}
          disabled={ctaDisabled}
          aria-busy={isAdvancing}
          aria-disabled={ctaDisabled}
          hidden={isFinalRound}
          className="mt-auto flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 font-display text-[20px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {ctaLabel}
        </button>
      </main>
    )
  }

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

  if (!caught) {
    // Variant 8b — INSIDER ESCAPED. Dark mode, warning-yellow accents.
    return (
      <main
        data-testid="reveal-escaped-shell"
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 bg-ink px-6 pt-8 pb-10 text-on-dark"
      >
        <header className="flex flex-col items-center gap-2 text-center">
          <h1
            data-testid="reveal-round-header"
            className="font-display text-[40px] uppercase leading-none tracking-[1px] text-on-dark"
          >
            ROUND {round} / {maxRounds} RESULT
          </h1>
        </header>

        <section className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-[12px] uppercase tracking-[2px] text-on-dark-soft">
            ── THE SECRET WAS ──
          </p>
          <div className="flex w-full flex-col items-center justify-center rounded-2xl bg-warning px-4 py-8 shadow-[0_8px_24px_rgba(251,191,36,0.25)]">
            <p
              data-testid="reveal-secret-name"
              className="font-hero text-[64px] leading-[0.95] tracking-[1px] text-on-light"
            >
              {(secret ?? "").toUpperCase()}
            </p>
          </div>
        </section>

        <section className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-[12px] uppercase tracking-[2px] text-on-dark-soft">
            ── THE INSIDER WAS ──
          </p>
          <div
            data-testid="reveal-insider-badge"
            className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-warning ${insiderTagBg} px-4 py-5 text-on-dark`}
          >
            <p className="font-display text-[24px] uppercase leading-none tracking-[1px]">
              👁 {insiderPlayer?.display_name ?? "—"} — ESCAPED!
            </p>
            {myVote ? (
              <p
                data-testid="reveal-your-vote"
                className="font-body text-[14px] leading-snug text-on-dark/90"
              >
                You voted: {myVote.name} ({myVote.votes}{" "}
                {myVote.votes === 1 ? "vote" : "votes"})
              </p>
            ) : (
              <p
                data-testid="reveal-your-vote"
                className="font-body text-[14px] leading-snug text-on-dark/90"
              >
                You did not vote.
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <p className="font-display text-[12px] uppercase tracking-[2px] text-center text-on-dark-soft">
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
                    ? `${p.display_name} (Insider, escaped)`
                    : p.display_name
              const isInsiderRow = role === "insider"
              return (
                <li
                  key={p.id}
                  data-testid={`reveal-score-tile-${p.player_id}`}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                    isInsiderRow
                      ? "border-warning/60 bg-warning/10 text-on-dark"
                      : "border-hairline bg-surface text-on-dark"
                  }`}
                >
                  <span className="font-body text-[14px] font-medium">
                    {label}
                  </span>
                  <span
                    className={`font-display text-[18px] tabular-nums ${
                      isInsiderRow ? "text-warning" : "text-on-dark"
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : "0"} pts
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* US-080 — Scoreboard <aside> with BIG NAME hero card pattern. */}
        <aside aria-label="Leaderboard">
          <Scoreboard
            players={players}
            variant={isFinalRound ? "final" : "round-end"}
            surface="dark"
          />
        </aside>

        {scoreError ? (
          <p
            role="alert"
            data-testid="reveal-score-error"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
          >
            {scoreError}
          </p>
        ) : null}

        {advanceError ? (
          <p
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
          >
            {advanceError}
          </p>
        ) : null}

        {isFinalRound ? (
          <Link
            href="/"
            data-testid="reveal-final-home-link"
            className="flex min-h-14 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 font-display text-[16px] uppercase tracking-[1px] text-on-dark active:bg-surface"
          >
            ← กลับหน้าหลัก / HOME
          </Link>
        ) : null}

        <button
          type="button"
          data-testid="reveal-next-round-cta"
          onClick={handleNextRound}
          disabled={ctaDisabled}
          aria-busy={isAdvancing}
          aria-disabled={ctaDisabled}
          hidden={isFinalRound}
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 font-display text-[20px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {ctaLabel}
        </button>
      </main>
    )
  }

  // Variant 8a — INSIDER CAUGHT. Light alt mode.
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
          ROUND {round} / {maxRounds} RESULT
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
                  ? `${p.display_name} (Insider, caught)`
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

      {/* US-080 — Scoreboard <aside> with BIG NAME hero card pattern. */}
      <aside aria-label="Leaderboard">
        <Scoreboard
          players={players}
          variant={isFinalRound ? "final" : "round-end"}
          surface="light"
        />
      </aside>

      {scoreError ? (
        <p
          role="alert"
          data-testid="reveal-score-error"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {scoreError}
        </p>
      ) : null}

      {advanceError ? (
        <p
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-center text-sm font-medium text-error"
        >
          {advanceError}
        </p>
      ) : null}

      {isFinalRound ? (
        <Link
          href="/"
          data-testid="reveal-final-home-link"
          className="flex min-h-14 w-full items-center justify-center rounded-xl border border-on-light/20 bg-surface-card px-6 font-display text-[16px] uppercase tracking-[1px] text-on-light active:bg-surface-elevated"
        >
          ← กลับหน้าหลัก / HOME
        </Link>
      ) : null}

      <button
        type="button"
        data-testid="reveal-next-round-cta"
        onClick={handleNextRound}
        disabled={ctaDisabled}
        aria-busy={isAdvancing}
        aria-disabled={ctaDisabled}
        hidden={isFinalRound}
        className="flex min-h-14 w-full items-center justify-center rounded-xl bg-goal px-6 font-display text-[20px] uppercase tracking-[1px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
      >
        {ctaLabel}
      </button>
    </main>
  )
}
