"use server"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const ALLOWED_CATEGORIES = ["premier-league"] as const

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  hostPlayerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
  maxRounds: z
    .number()
    .int("จำนวนรอบต้องเป็นตัวเลขเต็ม")
    .min(1, "จำนวนรอบต้อง ≥ 1")
    .max(20, "จำนวนรอบต้อง ≤ 20"),
  scorePositions: z
    .number()
    .int("Top-N ต้องเป็นตัวเลขเต็ม")
    .min(1, "Top-N ต้อง ≥ 1")
    .max(8, "Top-N ต้อง ≤ 8"),
  category: z.enum(ALLOWED_CATEGORIES, "หมวดหมู่ไม่ถูกต้อง"),
})

export type UpdateRoomSettingsActionInput = z.input<typeof inputSchema>

export type UpdateRoomSettingsActionResult =
  | { ok: true }
  | { ok: false; error: string }

type PgError = { code?: string; message?: string }

function mapPgError(error: PgError | null | undefined): string {
  switch (error?.code) {
    case "P0002":
      return "ห้องไม่พบ"
    case "P0003":
      return "เกมเริ่มแล้ว ไม่สามารถแก้ไขการตั้งค่าได้"
    case "P0005":
      return "เฉพาะ host เท่านั้นที่แก้ไขการตั้งค่าได้"
    case "P0010":
      return "ค่าการตั้งค่าไม่ถูกต้อง"
    case "P0011":
      return "หมวดหมู่ถูกล็อกหลังเริ่มเกมรอบแรก"
    case "P0012":
      return "Top-N เกินจำนวนผู้เล่นที่อนุญาต"
    default:
      return "บันทึกการตั้งค่าไม่สำเร็จ ลองใหม่"
  }
}

export async function updateRoomSettingsAction(
  input: UpdateRoomSettingsActionInput,
): Promise<UpdateRoomSettingsActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc("update_room_settings", {
    p_room_id: parsed.data.roomId,
    p_host_player_id: parsed.data.hostPlayerId,
    p_max_rounds: parsed.data.maxRounds,
    p_score_positions: parsed.data.scorePositions,
    p_category: parsed.data.category,
  })

  if (error) {
    return { ok: false, error: mapPgError(error) }
  }
  return { ok: true }
}
