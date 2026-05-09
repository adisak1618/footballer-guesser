"use server"

import { z } from "zod"
import { createRoomWithRetry, RoomCodeCollisionError } from "@social-hub/core"
import type { CreateRoomArgs, CreateRoomResult } from "@/lib/types"
import { displayNameSchema } from "@/lib/schemas"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const DEFAULT_MAX_ROUNDS = 5
const DEFAULT_SCORE_POSITIONS = 3

const inputSchema = z.object({
  displayName: displayNameSchema,
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
})

export type CreateRoomActionInput = z.input<typeof inputSchema>

export type CreateRoomActionResult =
  | { ok: true; code: string; playerId: string }
  | { ok: false; error: string }

export async function createRoomAction(
  input: CreateRoomActionInput,
): Promise<CreateRoomActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await createRoomWithRetry<CreateRoomArgs, CreateRoomResult>(
      supabase,
      {
        p_max_rounds: DEFAULT_MAX_ROUNDS,
        p_score_positions: DEFAULT_SCORE_POSITIONS,
        p_host_name: parsed.data.displayName,
        p_host_player_id: parsed.data.playerId,
      },
    )
    return { ok: true, code: result.code, playerId: result.player_id }
  } catch (error) {
    if (error instanceof RoomCodeCollisionError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: "สร้างห้องไม่สำเร็จ ลองใหม่" }
  }
}
