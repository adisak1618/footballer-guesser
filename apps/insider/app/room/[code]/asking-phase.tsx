"use client"

import { useEffect, useState } from "react"
import { LoadingSkeleton } from "@social-hub/ui"
import { getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"
import { AskingMaster } from "./asking-master"
import { AskingOther } from "./asking-other"

// US-058 / Phase 5b.5a — Asymmetric privacy during the asking phase (D3, D4).
// US-059 / Phase 5b.5b — Master view (Screen 6a + D1) delegated to AskingMaster.
// US-060 / Phase 5b.5c — Non-Master view (Screen 6b + D2) delegated to
//                        AskingOther; Insider+Common share the same component.
//
// Once `game_insider_round.phase` flips from 'preparing' → 'asking', the room
// shell (`lobby.tsx`) swaps the role-reveal screen for this asking-phase
// shell. The shell is the role router for the asking phase:
//   - master → render <AskingMaster/> (Screen 6a wireframe + D1 — buttons,
//     feed, ทายถูกแล้ว CTA). Receives the secret and round timer params.
//   - insider / common → render <AskingOther/> (Screen 6b wireframe + D2 —
//     phase tag/timer, ASK OUT LOUD instruction, full-height response feed,
//     plus an Insider-only D2 hint). The component renders an identical DOM
//     for Insider and Common except for the hint testid, which only Insider
//     receives — so a phone glanced at during asking can not betray who the
//     Insider is.

type InsiderRole = "master" | "insider" | "player"

interface AskingPhaseProps {
  roomId: string
  round: number
  mePlayerId: string
}

export function AskingPhase({ roomId, round, mePlayerId }: AskingPhaseProps) {
  const [role, setRole] = useState<InsiderRole | null>(null)
  const [masterSecret, setMasterSecret] = useState<string | null>(null)
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
      if (r === "master") {
        try {
          const s = await getMyInsiderSecret(supabase, {
            roomId,
            round,
            playerId: mePlayerId,
          })
          if (!active) return
          setMasterSecret(s)
        } catch {
          // Master secret fetch failed — still render the shell. UI parity
          // invariant holds: Insider/Common shells also have no secret.
        }
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

  if (role === "master" && masterSecret && timeLimitS !== null) {
    return (
      <AskingMaster
        roomId={roomId}
        round={round}
        mePlayerId={mePlayerId}
        secret={masterSecret}
        startedAt={startedAt}
        timeLimitS={timeLimitS}
      />
    )
  }

  // Non-master view (US-060) — Insider and Common share AskingOther so the
  // DOM is identical apart from the Insider-only D2 hint testid.
  const otherRole: "insider" | "player" = role === "insider" ? "insider" : "player"
  return (
    <AskingOther
      roomId={roomId}
      round={round}
      role={otherRole}
      startedAt={startedAt}
      timeLimitS={timeLimitS ?? 0}
    />
  )
}
