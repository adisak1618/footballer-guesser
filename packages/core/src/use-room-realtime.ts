"use client"

import { useEffect, useRef } from "react"
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js"

export type RoomRealtimeStatus =
  | "CONNECTING"
  | "SUBSCRIBED"
  | "DISCONNECTED"

export type RoomRealtimeTable = {
  table: string
  filter?: string
}

export type RoomRealtimePayload = RealtimePostgresChangesPayload<
  Record<string, unknown>
>

export type UseRoomRealtimeOptions = {
  supabase: SupabaseClient
  roomId: string | null
  tables: RoomRealtimeTable[]
  onChange: (table: string, payload: RoomRealtimePayload) => void
  onReconnect?: () => void
  onStatusChange?: (status: RoomRealtimeStatus) => void
}

export function useRoomRealtime({
  supabase,
  roomId,
  tables,
  onChange,
  onReconnect,
  onStatusChange,
}: UseRoomRealtimeOptions): void {
  const onChangeRef = useRef(onChange)
  const onReconnectRef = useRef(onReconnect)
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onReconnectRef.current = onReconnect
  }, [onReconnect])
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const tablesKey = tables
    .map((t) => `${t.table}:${t.filter ?? ""}`)
    .join("|")

  useEffect(() => {
    if (!roomId) return
    let active = true
    let prevSubStatus: string | null = null

    onStatusChangeRef.current?.("CONNECTING")

    let chan = supabase.channel(`room:${roomId}`)
    for (const t of tables) {
      chan = chan.on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: t.table,
          ...(t.filter ? { filter: t.filter } : {}),
        },
        (payload: RoomRealtimePayload) => {
          if (!active) return
          onChangeRef.current(t.table, payload)
        },
      )
    }

    const channel = chan.subscribe((status) => {
      if (!active) return
      if (status === "SUBSCRIBED") {
        onStatusChangeRef.current?.("SUBSCRIBED")
        if (prevSubStatus && prevSubStatus !== "SUBSCRIBED") {
          onReconnectRef.current?.()
        }
        prevSubStatus = "SUBSCRIBED"
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onStatusChangeRef.current?.("DISCONNECTED")
        prevSubStatus = "DISCONNECTED"
      }
    })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, roomId, tablesKey])
}
