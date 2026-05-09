"use server"

import { z } from "zod"
import { displayNameSchema, roomCodeSchema } from "@/lib/schemas"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const inputSchema = z.object({
  code: roomCodeSchema,
  displayName: displayNameSchema,
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type JoinInsiderRoomActionInput = z.input<typeof inputSchema>

export type JoinInsiderRoomActionResult =
  | { ok: true; code: string; playerId: string }
  | { ok: false; error: string }

type PgError = { code?: string; message?: string }

function mapPgError(error: PgError | null | undefined): string {
  switch (error?.code) {
    case "P0002":
      return "ห้องไม่พบ"
    case "P0003":
      return "เกมเริ่มแล้ว"
    case "P0004":
      return "ห้องเต็ม"
    case "P0001":
      return "ชื่อไม่ถูกต้อง"
    default:
      return "เข้าห้องไม่สำเร็จ ลองใหม่"
  }
}

export async function joinInsiderRoomAction(
  input: JoinInsiderRoomActionInput,
): Promise<JoinInsiderRoomActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc("join_room", {
    p_code: parsed.data.code,
    p_player_id: parsed.data.playerId,
    p_display_name: parsed.data.displayName,
  })

  if (error) {
    return { ok: false, error: mapPgError(error) }
  }
  const row = data?.[0]
  if (!row) {
    return { ok: false, error: "เข้าห้องไม่สำเร็จ ลองใหม่" }
  }
  return { ok: true, code: parsed.data.code, playerId: row.player_id }
}
