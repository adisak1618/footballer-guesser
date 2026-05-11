"use server"

import { z } from "zod"
import { RoomCodeCollisionError } from "@social-hub/core"
import { createInsiderRoom } from "@/lib/insider-rpc"
import { displayNameSchema } from "@/lib/schemas"
import { createSupabaseServerClient } from "@/lib/supabase-server"

// Issue #27 — the /new host-setup screen is deleted; the landing now creates
// a room with default category + default max_rounds and redirects to the
// lobby, where the host edits both via the shared RoomSetupPanel.
//
// Defaults mirror the previous /new form defaults so existing E2E specs that
// seed `football-premier-league` + max_rounds=5 + timeLimit=300 keep working.
const DEFAULT_PACK_SLUG = "football-premier-league"
const DEFAULT_TIME_LIMIT_S = 300 as const
const DEFAULT_ROUND_COUNT = 5

const inputSchema = z.object({
  displayName: displayNameSchema,
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type CreateInsiderRoomActionInput = z.input<typeof inputSchema>

export type CreateInsiderRoomActionResult =
  | { ok: true; code: string; playerId: string }
  | { ok: false; error: string }

export async function createInsiderRoomAction(
  input: CreateInsiderRoomActionInput,
): Promise<CreateInsiderRoomActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await createInsiderRoom(supabase, {
      packSlug: DEFAULT_PACK_SLUG,
      timeLimitS: DEFAULT_TIME_LIMIT_S,
      roundCount: DEFAULT_ROUND_COUNT,
      hostName: parsed.data.displayName,
      hostPlayerId: parsed.data.playerId,
    })
    return { ok: true, code: result.code, playerId: result.playerId }
  } catch (error) {
    if (error instanceof RoomCodeCollisionError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: "สร้างห้องไม่สำเร็จ ลองใหม่" }
  }
}
