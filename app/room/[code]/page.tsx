"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { readPlayerId, useGameStore } from "@/lib/game-store"
import type { Player, Room } from "@/lib/types"
import { Lobby } from "./lobby"
import { Playing } from "./playing"
import { Results } from "./results"

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()

  const room = useGameStore((s) => s.room)
  const setRoom = useGameStore((s) => s.setRoom)
  const setPlayers = useGameStore((s) => s.setPlayers)
  const setMe = useGameStore((s) => s.setMe)
  const setConnectionStatus = useGameStore((s) => s.setConnectionStatus)
  const reset = useGameStore((s) => s.reset)

  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let channel: RealtimeChannel | null = null

    async function load() {
      setConnectionStatus("CONNECTING")

      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle()

      if (!active) return
      if (roomErr || !roomRow) {
        setLoadError("ห้องไม่พบ")
        setConnectionStatus("DISCONNECTED")
        return
      }

      const roomId = roomRow.id
      setRoom(roomRow as Room)

      const { data: playerRows } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .order("join_order", { ascending: true })

      if (!active) return
      const ps = (playerRows ?? []) as Player[]
      setPlayers(ps)

      const localPlayerId = readPlayerId()
      const myRow = localPlayerId
        ? (ps.find((p) => p.player_id === localPlayerId) ?? null)
        : null
      setMe(myRow)

      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") return
            setRoom(payload.new as Room)
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
            filter: `room_id=eq.${roomId}`,
          },
          async () => {
            const { data: refreshed } = await supabase
              .from("players")
              .select("*")
              .eq("room_id", roomId)
              .order("join_order", { ascending: true })
            if (!active || !refreshed) return
            setPlayers(refreshed as Player[])
          },
        )
        .subscribe((status) => {
          if (!active) return
          if (status === "SUBSCRIBED") setConnectionStatus("SUBSCRIBED")
          else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          )
            setConnectionStatus("DISCONNECTED")
        })
    }

    load()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
      reset()
    }
  }, [code, setRoom, setPlayers, setMe, setConnectionStatus, reset])

  if (loadError) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="font-display text-[40px] uppercase tracking-[0.5px] text-on-dark">
          ห้องไม่พบ
        </h1>
        <p className="text-sm text-on-dark-soft">
          ลองตรวจสอบรหัสห้องอีกครั้ง
        </p>
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 text-[15px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-surface"
        >
          กลับหน้าหลัก
        </Link>
      </main>
    )
  }

  if (!room) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
      </main>
    )
  }

  if (room.status === "LOBBY") return <Lobby code={code} />

  if (room.status === "PLAYING") return <Playing />

  if (room.status === "ENDED") return <Results />

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
    </main>
  )
}
