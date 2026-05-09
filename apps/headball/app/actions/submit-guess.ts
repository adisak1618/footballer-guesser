"use server"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { guessTextSchema } from "@/lib/schemas"

const inputSchema = z.object({
  roomId: z.uuid("รหัสห้องไม่ถูกต้อง"),
  roundNumber: z.number().int().min(1, "ยังไม่ได้เริ่มรอบ"),
  playerId: z.uuid("รหัสผู้เล่นไม่ถูกต้อง"),
  guess: guessTextSchema,
})

export type SubmitGuessActionInput = z.input<typeof inputSchema>

export type SubmitGuessActionResult =
  | { ok: true; correct: boolean; position: number; score: number }
  | { ok: false; error: string; isNetwork?: boolean }

type PgError = { code?: string; message?: string }

function mapPgError(error: PgError | null | undefined): SubmitGuessActionResult {
  const code = error?.code
  // PostgREST/Supabase surfaces fetch failures with empty/network-y codes — treat
  // anything without a SQLSTATE as a transient network problem so the UI can offer retry.
  if (!code || code === "" || code.startsWith("PGRST") || code === "FetchError") {
    return { ok: false, error: "เครือข่ายขาด ลองอีกครั้ง", isNetwork: true }
  }
  return { ok: false, error: "ส่งคำตอบไม่สำเร็จ ลองใหม่" }
}

export async function submitGuessAction(
  input: SubmitGuessActionInput,
): Promise<SubmitGuessActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
    return { ok: false, error: message }
  }

  const supabase = createSupabaseServerClient()
  try {
    const { data, error } = await supabase.rpc("submit_guess", {
      p_room_id: parsed.data.roomId,
      p_round_number: parsed.data.roundNumber,
      p_player_id: parsed.data.playerId,
      p_guess: parsed.data.guess,
    })

    if (error) return mapPgError(error)

    const row = data?.[0]
    if (!row) {
      return { ok: false, error: "ส่งคำตอบไม่สำเร็จ ลองใหม่" }
    }
    return {
      ok: true,
      correct: row.correct,
      position: row.position ?? 0,
      score: row.score ?? 0,
    }
  } catch {
    return { ok: false, error: "เครือข่ายขาด ลองอีกครั้ง", isNetwork: true }
  }
}
