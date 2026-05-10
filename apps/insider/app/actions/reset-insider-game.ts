"use server"

import { z } from "zod"
import { GameRpcError } from "@social-hub/core"
import { resetInsiderGame } from "@/lib/insider-rpc"
import { createSupabaseServerClient } from "@/lib/supabase-server"

// Issue #24 — server action wrapping reset_insider_game RPC (migration 0037).
// Called by the host's RESET GAME button between rounds and the
// PLAY AGAIN / BACK TO LOBBY CTAs on the FinalScoreboard.

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type ResetInsiderGameActionInput = z.input<typeof inputSchema>

export type ResetInsiderGameActionResult =
  | { ok: true }
  | { ok: false; error: string }

function mapError(error: unknown): string {
  if (error instanceof GameRpcError) {
    switch (error.code) {
      case "PG004":
        return "ห้องไม่พบ"
      case "PG012":
        return "เฉพาะโฮสต์รีเซ็ตเกมได้"
      case "PG013":
        return "รีเซ็ตเกมได้เฉพาะระหว่างรอบหรือจบเกม"
      default:
        return "รีเซ็ตเกมไม่สำเร็จ ลองใหม่"
    }
  }
  return "รีเซ็ตเกมไม่สำเร็จ ลองใหม่"
}

export async function resetInsiderGameAction(
  input: ResetInsiderGameActionInput,
): Promise<ResetInsiderGameActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  try {
    await resetInsiderGame(supabase, parsed.data)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: mapError(error) }
  }
}
