"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRoomRealtime } from "@social-hub/core"
import { supabase } from "@/lib/supabase"
import { readPlayerId, useGameStore } from "@/lib/game-store"
import type { Player, Room } from "@/lib/types"
import { ConnectionStatus } from "@/components/connection-status"
import { RoomJoinPrompt } from "@/components/room-join-prompt"
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
  const me = useGameStore((s) => s.me)
  const setRoom = useGameStore((s) => s.setRoom)
  const setPlayers = useGameStore((s) => s.setPlayers)
  const setMe = useGameStore((s) => s.setMe)
  const setConnectionStatus = useGameStore((s) => s.setConnectionStatus)
  const reset = useGameStore((s) => s.reset)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setConnectionStatus("CONNECTING")

    async function load() {
      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle()

      if (!active) return
      if (roomErr || !roomRow) {
        setLoadError("ห้องไม่พบ")
        setConnectionStatus("DISCONNECTED")
        setBootstrapped(true)
        return
      }

      setRoom(roomRow as Room)
      setRoomId(roomRow.id)

      const { data: playerRows } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomRow.id)
        .order("join_order", { ascending: true })

      if (!active) return
      const ps = (playerRows ?? []) as Player[]
      setPlayers(ps)

      const localPlayerId = readPlayerId()
      const myRow = localPlayerId
        ? (ps.find((p) => p.player_id === localPlayerId) ?? null)
        : null
      setMe(myRow)
      setBootstrapped(true)
    }

    load()

    return () => {
      active = false
      setRoomId(null)
      reset()
    }
  }, [code, setRoom, setPlayers, setMe, setConnectionStatus, reset])

  const refetchAll = useCallback(async () => {
    if (!roomId) return
    const { data: roomRow } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle()
    if (roomRow) setRoom(roomRow as Room)

    const { data: playerRows } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("join_order", { ascending: true })
    if (!playerRows) return
    const ps = playerRows as Player[]
    setPlayers(ps)

    const localPlayerId = readPlayerId()
    const myRow = localPlayerId
      ? (ps.find((p) => p.player_id === localPlayerId) ?? null)
      : null
    setMe(myRow)
  }, [roomId, setRoom, setPlayers, setMe])

  const tables = useMemo(
    () =>
      roomId
        ? [
            { table: "rooms", filter: `id=eq.${roomId}` },
            { table: "players", filter: `room_id=eq.${roomId}` },
          ]
        : [],
    [roomId],
  )

  const handleChange = useCallback(
    async (table: string, payload: { eventType: string; new: unknown }) => {
      if (!roomId) return
      if (table === "rooms") {
        if (payload.eventType === "DELETE") return
        setRoom(payload.new as Room)
        return
      }
      if (table === "players") {
        const { data: refreshed } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomId)
          .order("join_order", { ascending: true })
        if (!refreshed) return
        const ps = refreshed as Player[]
        setPlayers(ps)
        // If we're a returning member who isn't yet pinned in `me`, try to
        // resolve from the freshly-refreshed roster.
        if (!useGameStore.getState().me) {
          const localPlayerId = readPlayerId()
          const myRow = localPlayerId
            ? (ps.find((p) => p.player_id === localPlayerId) ?? null)
            : null
          if (myRow) setMe(myRow)
        }
      }
    },
    [roomId, setRoom, setPlayers, setMe],
  )

  useRoomRealtime({
    supabase,
    roomId,
    tables,
    onChange: handleChange,
    onReconnect: refetchAll,
    onStatusChange: setConnectionStatus,
  })

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

  if (!bootstrapped || !room) {
    return (
      <>
        <ConnectionStatus />
        <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
        </main>
      </>
    )
  }

  // Direct-link visitor who hasn't joined this room yet.
  if (!me) {
    if (room.status === "PLAYING" || room.status === "ENDED") {
      const message =
        room.status === "PLAYING" ? "เกมเริ่มไปแล้ว" : "เกมจบไปแล้ว"
      return (
        <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="font-display text-[40px] uppercase tracking-[0.5px] text-on-dark">
            {message}
          </h1>
          <p className="text-sm text-on-dark-soft">
            เข้าร่วมเกมไม่ได้ ลองเริ่มห้องใหม่
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
    return (
      <>
        <ConnectionStatus />
        <RoomJoinPrompt code={code} onJoined={() => void refetchAll()} />
      </>
    )
  }

  return (
    <>
      <ConnectionStatus />
      {room.status === "LOBBY" ? (
        <Lobby code={code} />
      ) : room.status === "PLAYING" ? (
        <Playing />
      ) : room.status === "ENDED" ? (
        <Results />
      ) : (
        <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-on-dark-soft">กำลังโหลด...</p>
        </main>
      )}
    </>
  )
}
