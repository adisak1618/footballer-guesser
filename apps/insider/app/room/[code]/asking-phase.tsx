"use client"

import { useEffect, useState } from "react"
import { LoadingSkeleton } from "@social-hub/ui"
import { getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"
import { AskingMaster } from "./asking-master"
import { AskingOther } from "./asking-other"

// US-058 / Phase 5b.5a — Asking-phase router.
// Issue #16 — Insider now receives the secret too (parity with Master) so it
// can be shown inline in the compact header. Common still receives null.

type InsiderRole = "master" | "insider" | "player"

interface AskingPhaseProps {
  roomId: string
  round: number
  mePlayerId: string
}

export function AskingPhase({ roomId, round, mePlayerId }: AskingPhaseProps) {
  const [role, setRole] = useState<InsiderRole | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [timeLimitS, setTimeLimitS] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: roleRow }, { data: roundRow }] = await Promise.all([
        supabase
          .from("game_insider_roles")
          .select("role")
          .eq("room_id", roomId)
          .eq("round_number", round)
          .eq("player_id", mePlayerId)
          .maybeSingle(),
        supabase
          .from("game_insider_round")
          .select("started_at, time_limit_s")
          .eq("room_id", roomId)
          .eq("round_number", round)
          .maybeSingle(),
      ])
      if (!active) return
      const r = (roleRow?.role as InsiderRole | undefined) ?? "player"
      setRole(r)
      setStartedAt((roundRow?.started_at as string | null) ?? null)
      setTimeLimitS((roundRow?.time_limit_s as number | null) ?? null)
      // get_my_insider_secret returns the secret for master+insider, NULL
      // for commons (column-level RLS in migration 0021). Calling it for
      // every role keeps a single load path; the result is gated below.
      try {
        const s = await getMyInsiderSecret(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
        })
        if (!active) return
        setSecret((s as string | null) ?? null)
      } catch {
        // Secret fetch failed — still render the shell. Master's CTA still
        // works without the visible secret reminder.
      }
      setLoaded(true)
    }
    load()
    return () => {
      active = false
    }
  }, [roomId, round, mePlayerId])

  if (!loaded) {
    return (
      <LoadingSkeleton
        phaseLabel="ASKING"
        caption="กำลังเริ่มถาม..."
        testId="asking-phase-loading"
      />
    )
  }

  if (role === "master" && secret && timeLimitS !== null) {
    return (
      <AskingMaster
        roomId={roomId}
        round={round}
        mePlayerId={mePlayerId}
        secret={secret}
        startedAt={startedAt}
        timeLimitS={timeLimitS}
      />
    )
  }

  // Insider + Common share AskingOther; Insider receives the secret inline,
  // Common always passes null (RPC returns NULL for commons regardless).
  const otherRole: "insider" | "player" = role === "insider" ? "insider" : "player"
  return (
    <AskingOther
      roomId={roomId}
      round={round}
      role={otherRole}
      startedAt={startedAt}
      timeLimitS={timeLimitS ?? 0}
      secret={otherRole === "insider" ? secret : null}
    />
  )
}
