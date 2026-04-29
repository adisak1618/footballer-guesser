"use server"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  hostPlayerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type StartGameActionInput = z.input<typeof inputSchema>

export type StartGameActionResult =
  | { ok: true }
  | { ok: false; error: string }

type PgError = { code?: string; message?: string }

function mapPgError(error: PgError | null | undefined): string {
  switch (error?.code) {
    case "P0002":
      return "ห้องไม่พบ"
    case "P0003":
      return "เกมเริ่มแล้ว"
    case "P0005":
      return "เฉพาะ host เท่านั้นที่เริ่มเกมได้"
    case "P0006":
      return "ต้องมีผู้เล่นอย่างน้อย 2 คน"
    default:
      return "เริ่มเกมไม่สำเร็จ ลองใหม่"
  }
}

export async function startGameAction(
  input: StartGameActionInput,
): Promise<StartGameActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc("start_game", {
    p_room_id: parsed.data.roomId,
    p_host_player_id: parsed.data.hostPlayerId,
  })

  if (error) {
    return { ok: false, error: mapPgError(error) }
  }
  return { ok: true }
}
