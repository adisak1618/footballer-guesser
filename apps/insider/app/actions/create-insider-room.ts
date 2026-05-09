"use server"

import { z } from "zod"
import { RoomCodeCollisionError } from "@social-hub/core"
import { createInsiderRoom } from "@/lib/insider-rpc"
import {
  displayNameSchema,
  packSlugSchema,
  roundCountSchema,
  timeLimitSchema,
} from "@/lib/schemas"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const inputSchema = z.object({
  displayName: displayNameSchema,
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
  packSlug: packSlugSchema,
  timeLimitS: timeLimitSchema,
  roundCount: roundCountSchema,
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
      packSlug: parsed.data.packSlug,
      timeLimitS: parsed.data.timeLimitS,
      roundCount: parsed.data.roundCount,
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
