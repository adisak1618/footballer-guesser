"use client"

import { useEffect, useState } from "react"
import { getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"
import { AskingMaster } from "./asking-master"

// US-058 / Phase 5b.5a — Asymmetric privacy during the asking phase (D3, D4).
// US-059 / Phase 5b.5b — Master view (Screen 6a + D1) delegated to AskingMaster.
//
// Once `game_insider_round.phase` flips from 'preparing' → 'asking', the room
// shell (`lobby.tsx`) swaps the role-reveal screen for this asking-phase
// shell. The shell is the role router for the asking phase:
//   - master → render <AskingMaster/> (Screen 6a wireframe + D1 — buttons,
//     feed, ทายถูกแล้ว CTA). Receives the secret and round timer params.
//   - insider / common → render the asymmetric-privacy minimal shell (US-058).
//     The Insider's role badge AND secret card are stripped (D4 anti-cheat
//     parity); the Common's mystery placeholder is also stripped. Both views
//     are visually identical so a phone glanced at during asking can not
//     betray who the Insider is. US-060 will replace this minimal shell with
//     the full Screen 6b (response feed, instruction, D2 hint).

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
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-on-dark-soft">กำลังเริ่มถาม...</p>
      </main>
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

  // Non-master shell — kept identical for Insider and Common (D4 parity).
  // US-060 (Phase 5b.5c) replaces this with the full Screen 6b.
  return (
    <main
      data-testid="asking-phase-shell"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 px-6 pt-8 pb-10"
    >
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
        <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
          ASKING / ช่วงถาม
        </p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="font-display text-[24px] uppercase leading-none tracking-[0.3px] text-on-dark">
          ถามดัง ๆ
        </p>
        <p className="text-[13px] uppercase tracking-[0.3px] text-on-dark-soft">
          ASK OUT LOUD
        </p>
        <p className="font-body text-[15px] leading-snug text-on-dark">
          ถามคำถามใช่ / ไม่ใช่ / ไม่แน่ใจ
          <br />
          เพื่อหาคำลับ
        </p>
      </section>
    </main>
  )
}
