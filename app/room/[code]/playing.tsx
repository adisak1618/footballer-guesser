"use client"

import { useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useGameStore } from "@/lib/game-store"
import type { RoundState } from "@/lib/types"
import { NameCard } from "@/components/name-card"
import { RoundScoreboard } from "@/components/round-scoreboard"
import { nextRoundAction } from "@/app/actions/next-round"

export function Playing() {
  const room = useGameStore((s) => s.room)
  const me = useGameStore((s) => s.me)
  const players = useGameStore((s) => s.players)
  const roundState = useGameStore((s) => s.roundState)
  const setRoundState = useGameStore((s) => s.setRoundState)

  const roomId = room?.id ?? null
  const triggeredRoundRef = useRef<number | null>(null)

  useEffect(() => {
    if (!roomId) return
    let active = true
    let channel: RealtimeChannel | null = null

    async function load() {
      const { data } = await supabase
        .from("round_state")
        .select("*")
        .eq("room_id", roomId!)
      if (!active) return
      setRoundState((data ?? []) as RoundState[])

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
          async () => {
            const { data: refreshed } = await supabase
              .from("round_state")
              .select("*")
              .eq("room_id", roomId!)
            if (!active) return
            setRoundState((refreshed ?? []) as RoundState[])
          },
        )
        .subscribe()
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
    if (!roundOver || !isHost) return
    if (triggeredRoundRef.current === currentRound) return
    triggeredRoundRef.current = currentRound
    void nextRoundAction({ roomId: room.id, hostPlayerId: me.player_id })
  }, [room, me, roundOver, isHost, currentRound])

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
    <RoundScoreboard
      currentRound={currentRound}
      maxRounds={maxRounds}
      players={players}
      activeRemaining={activeRemaining}
      myPlayerId={me.player_id}
    />
  )
}
