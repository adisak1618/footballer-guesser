"use client"

import { useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useGameStore } from "@/lib/game-store"
import type { RoundState } from "@/lib/types"
import { NameCard } from "@/components/name-card"
import { RoundScoreboard } from "@/components/round-scoreboard"
import {
  GuessResult,
  guessResultSeenStorageKey,
} from "@/components/guess-result"
import { selectGuessResultMode } from "@/lib/guess-result-mode"
import { nextRoundAction } from "@/app/actions/next-round"
import { shouldTriggerNextRound } from "@/lib/round-trigger"

interface InactiveBranchProps {
  myRow: RoundState
  totalScore: number
  round: number
  maxRounds: number
  activeRemaining: number
  myPlayerId: string
  // Scoreboard needs the full players list.
  scoreboard: React.ReactNode
}

function readSeenFlag(roundStateId: string, playerId: string): boolean {
  if (typeof window === "undefined") return false
  return !!window.localStorage.getItem(
    guessResultSeenStorageKey(roundStateId, playerId),
  )
}

// Rendered when the current player is INACTIVE for this round. Mounted with
// `key={myRow.id}` so each new round-state row gets a fresh result-vs-scoreboard
// decision (no setState-in-effect needed to reset).
function InactiveBranch({
  myRow,
  totalScore,
  round,
  maxRounds,
  scoreboard,
}: InactiveBranchProps) {
  const [skipped, setSkipped] = useState(() =>
    readSeenFlag(myRow.id, myRow.player_id),
  )

  if (skipped) return <>{scoreboard}</>

  const mode = selectGuessResultMode(
    myRow.is_correct,
    myRow.score_this_round,
  )
  return (
    <GuessResult
      mode={mode}
      assignedName={myRow.assigned_name}
      scoreThisRound={myRow.score_this_round ?? 0}
      totalScore={totalScore}
      round={round}
      maxRounds={maxRounds}
      onSkip={() => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            guessResultSeenStorageKey(myRow.id, myRow.player_id),
            "1",
          )
        }
        setSkipped(true)
      }}
    />
  )
}

export function Playing() {
  const room = useGameStore((s) => s.room)
  const me = useGameStore((s) => s.me)
  const players = useGameStore((s) => s.players)
  const roundState = useGameStore((s) => s.roundState)
  const setRoundState = useGameStore((s) => s.setRoundState)

  const roomId = room?.id ?? null
  const triggeredRoundRef = useRef<number | null>(null)
  // Gate the next-round trigger on a fresh refetch within THIS mount. Without
  // this, the host's first render in game 2 inherits stale round_state from
  // game 1 (still in the Zustand store because no subscription was active
  // during ENDED/LOBBY), which makes round 1 of game 2 look "already over"
  // and burns triggeredRoundRef on a no-op next_round call. The legitimate
  // round-1-end trigger is then suppressed by the ref guard, stalling game 2
  // on the round-1 scoreboard. (issue #7)
  const [roundStateLoaded, setRoundStateLoaded] = useState(false)

  useEffect(() => {
    if (!roomId) return
    let active = true
    let channel: RealtimeChannel | null = null
    let prevSubStatus: string | null = null

    async function refetch() {
      const { data: refreshed } = await supabase
        .from("round_state")
        .select("*")
        .eq("room_id", roomId!)
      if (!active) return
      setRoundState((refreshed ?? []) as RoundState[])
      setRoundStateLoaded(true)
    }

    async function load() {
      await refetch()
      if (!active) return

      channel = supabase
        .channel(`room:${roomId}:round_state`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "round_state",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            void refetch()
          },
        )
        .subscribe((status) => {
          if (!active) return
          if (status === "SUBSCRIBED") {
            if (prevSubStatus && prevSubStatus !== "SUBSCRIBED") {
              void refetch()
            }
            prevSubStatus = "SUBSCRIBED"
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            prevSubStatus = "DISCONNECTED"
          }
        })
    }

    void load()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [roomId, setRoundState])

  const currentRound = room?.current_round ?? 0
  const maxRounds = room?.max_rounds ?? 0
  const currentRows = roundState.filter((r) => r.round_number === currentRound)
  const myRow =
    me ? currentRows.find((r) => r.player_id === me.player_id) ?? null : null
  const activeRemaining = currentRows.filter((r) => r.is_active).length
  const roundOver = currentRows.length > 0 && activeRemaining === 0
  const isHost = !!(me && room && me.player_id === room.host_player_id)

  useEffect(() => {
    if (!room || !me) return
    if (
      !shouldTriggerNextRound({
        roundStateLoaded,
        roundOver,
        isHost,
        triggeredRound: triggeredRoundRef.current,
        currentRound,
      })
    ) {
      return
    }
    triggeredRoundRef.current = currentRound
    void nextRoundAction({ roomId: room.id, hostPlayerId: me.player_id })
  }, [room, me, roundStateLoaded, roundOver, isHost, currentRound])

  if (!room || !me) {
    return (
      <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
      </main>
    )
  }

  if (!myRow || myRow.is_active) {
    return (
      <NameCard
        me={me}
        roomId={room.id}
        round={currentRound}
        maxRounds={maxRounds}
        myRoundState={myRow}
      />
    )
  }

  return (
    <InactiveBranch
      key={myRow.id}
      myRow={myRow}
      totalScore={me.total_score ?? 0}
      round={currentRound}
      maxRounds={maxRounds}
      activeRemaining={activeRemaining}
      myPlayerId={me.player_id}
      scoreboard={
        <RoundScoreboard
          currentRound={currentRound}
          maxRounds={maxRounds}
          players={players}
          activeRemaining={activeRemaining}
          myPlayerId={me.player_id}
        />
      }
    />
  )
}
