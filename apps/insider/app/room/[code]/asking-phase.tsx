"use client"

import { useEffect, useState } from "react"
import { getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-058 / Phase 5b.5a — Asymmetric privacy during the asking phase (D3, D4).
//
// Once `game_insider_round.phase` flips from 'preparing' → 'asking', the room
// shell (`lobby.tsx`) swaps the role-reveal screen for this asking-phase shell.
// The shell intentionally:
//   - Hides every role-specific badge (`insider-role-badge`, `master-role-badge`,
//     `common-role-badge`) so a phone glanced at during the question round can
//     not betray who the Insider is (D4 — anti-cheat parity).
//   - Hides the BIG NAME secret card from the Insider; only the Master keeps a
//     small Bebas 32px on-dark-soft "Secret: [WORD]" reminder because Master is
//     the one answering Yes/No/Unsure (D3).
//
// The full asking-phase UI (3 huge response buttons, response feed, timer,
// "ทายถูกแล้ว" CTA) lands in US-5b.5 / wireframes 6a/6b. This story only
// commits the asymmetric-privacy mechanism.

type InsiderRole = "master" | "insider" | "player"

interface AskingPhaseProps {
  roomId: string
  round: number
  mePlayerId: string
}

export function AskingPhase({ roomId, round, mePlayerId }: AskingPhaseProps) {
  const [role, setRole] = useState<InsiderRole | null>(null)
  const [masterSecret, setMasterSecret] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Read role to decide whether to fetch the master secret reminder. The role
  // row already exists by the time we render this screen (start_insider_round
  // inserts roles + round atomically; phase only flips to 'asking' after the
  // round was 'preparing', so the role rows are guaranteed present).
  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from("game_insider_roles")
        .select("role")
        .eq("room_id", roomId)
        .eq("round_number", round)
        .eq("player_id", mePlayerId)
        .maybeSingle()
      if (!active) return
      const r = (data?.role as InsiderRole | undefined) ?? "player"
      setRole(r)
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
          // Master secret fetch failed — render the shell without the reminder.
          // (UI parity invariant still holds: Insider/Common pages also have
          // no reminder, so an absent reminder doesn't leak role info.)
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

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-6 px-6 pt-8 pb-10">
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
        <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
          ASKING / ช่วงถาม
        </p>
      </header>

      {role === "master" && masterSecret ? (
        <p
          data-testid="master-asking-secret-reminder"
          className="text-center font-hero text-[32px] uppercase leading-none tracking-[1px] text-on-dark-soft"
        >
          Secret: {masterSecret.toUpperCase()}
        </p>
      ) : null}

      <section
        data-testid="asking-phase-shell"
        className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
      >
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
