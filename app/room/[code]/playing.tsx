"use client"

import { useEffect } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useGameStore } from "@/lib/game-store"
import type { RoundState } from "@/lib/types"
import { NameCard } from "@/components/name-card"

export function Playing() {
  const room = useGameStore((s) => s.room)
  const me = useGameStore((s) => s.me)
  const roundState = useGameStore((s) => s.roundState)
  const setRoundState = useGameStore((s) => s.setRoundState)

  const roomId = room?.id ?? null

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

  if (!room || !me) {
    return (
      <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
      </main>
    )
  }

  const currentRound = room.current_round ?? 0
  const maxRounds = room.max_rounds ?? 0
  const myRow =
    roundState.find(
      (r) =>
        r.player_id === me.player_id && r.round_number === currentRound,
    ) ?? null

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
