"use server"

import { z } from "zod"
import { GameRpcError } from "@social-hub/core"
import { startInsiderRound } from "@/lib/insider-rpc"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type StartInsiderRoundActionInput = z.input<typeof inputSchema>

export type StartInsiderRoundActionResult =
  | { ok: true; roundNumber: number }
  | { ok: false; error: string }

function mapError(error: unknown): string {
  if (error instanceof GameRpcError) {
    switch (error.code) {
      case "PG004":
        return "ห้องไม่พบ"
      case "PG012":
        return "เฉพาะโฮสต์เริ่มเกมได้"
      case "PG013":
        return "เกมเริ่มไปแล้ว"
      case "PG014":
        return "ต้องมีผู้เล่นอย่างน้อย 3 คน"
      case "PG001":
        return "ไม่พบหมวดหมู่"
      default:
        return "เริ่มเกมไม่สำเร็จ ลองใหม่"
    }
  }
  return "เริ่มเกมไม่สำเร็จ ลองใหม่"
}

export async function startInsiderRoundAction(
  input: StartInsiderRoundActionInput,
): Promise<StartInsiderRoundActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()

  // Look up the per-room Insider config (pack_slug + time_limit_s) written
  // when the host called create_insider_room (migration 0029).
  const { data: config, error: configError } = await supabase
    .from("game_insider_room_config")
    .select("pack_slug, time_limit_s")
    .eq("room_id", parsed.data.roomId)
    .maybeSingle()
  if (configError || !config) {
    return { ok: false, error: "ไม่พบการตั้งค่าห้อง" }
  }

  try {
    const roundNumber = await startInsiderRound(supabase, {
      roomId: parsed.data.roomId,
      packSlug: config.pack_slug,
      timeLimitS: config.time_limit_s,
      playerId: parsed.data.playerId,
    })
    return { ok: true, roundNumber }
  } catch (error) {
    return { ok: false, error: mapError(error) }
  }
}
