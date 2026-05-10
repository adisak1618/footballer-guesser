"use server"

import { z } from "zod"
import { GameRpcError } from "@social-hub/core"
import { changeInsiderPack } from "@/lib/insider-rpc"
import { createSupabaseServerClient } from "@/lib/supabase-server"

// Issue #24 — server action wrapping change_insider_pack RPC (migration 0036).
// Called by the host's between-rounds pack chips on the Insider lobby.

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
  packSlug: z.string().min(1, "เลือกคลังคำก่อนนะ"),
})

export type ChangeInsiderPackActionInput = z.input<typeof inputSchema>

export type ChangeInsiderPackActionResult =
  | { ok: true }
  | { ok: false; error: string }

function mapError(error: unknown): string {
  if (error instanceof GameRpcError) {
    switch (error.code) {
      case "PG004":
        return "ห้องไม่พบ"
      case "PG012":
        return "เฉพาะโฮสต์เปลี่ยนคลังคำได้"
      case "PG013":
        return "เปลี่ยนคลังคำได้เฉพาะระหว่างรอบ"
      case "PG020":
        return "ไม่พบคลังคำ"
      default:
        return "เปลี่ยนคลังคำไม่สำเร็จ ลองใหม่"
    }
  }
  return "เปลี่ยนคลังคำไม่สำเร็จ ลองใหม่"
}

export async function changeInsiderPackAction(
  input: ChangeInsiderPackActionInput,
): Promise<ChangeInsiderPackActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  try {
    await changeInsiderPack(supabase, parsed.data)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: mapError(error) }
  }
}
