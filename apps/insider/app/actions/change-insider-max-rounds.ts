"use server"

import { z } from "zod"
import { GameRpcError } from "@social-hub/core"
import { changeInsiderMaxRounds } from "@/lib/insider-rpc"
import { createSupabaseServerClient } from "@/lib/supabase-server"

// Issue #27 — server action wrapping change_insider_max_rounds RPC
// (migration 0038). Called by the host's max_rounds stepper on the lobby.

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
  maxRounds: z.number().int().min(1).max(10),
})

export type ChangeInsiderMaxRoundsActionInput = z.input<typeof inputSchema>

export type ChangeInsiderMaxRoundsActionResult =
  | { ok: true }
  | { ok: false; error: string }

function mapError(error: unknown): string {
  if (error instanceof GameRpcError) {
    switch (error.code) {
      case "PG004":
        return "ห้องไม่พบ"
      case "PG012":
        return "เฉพาะโฮสต์เปลี่ยนจำนวนรอบได้"
      case "PG013":
        return "จำนวนรอบถูกล็อกแล้ว"
      case "PG020":
        return "จำนวนรอบไม่ถูกต้อง"
      default:
        return "เปลี่ยนจำนวนรอบไม่สำเร็จ ลองใหม่"
    }
  }
  return "เปลี่ยนจำนวนรอบไม่สำเร็จ ลองใหม่"
}

export async function changeInsiderMaxRoundsAction(
  input: ChangeInsiderMaxRoundsActionInput,
): Promise<ChangeInsiderMaxRoundsActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  try {
    await changeInsiderMaxRounds(supabase, parsed.data)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: mapError(error) }
  }
}
