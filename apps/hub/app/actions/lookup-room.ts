"use server"

import {
  GameRpcError,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  createSupabaseServerClient,
  parsePgErrCode,
} from "@social-hub/core"

export type GameType = "headball" | "insider"

export type LookupRoomResult = {
  gameType: GameType
  code: string
}

const ALPHABET_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`)

function validateCode(raw: string): string {
  const code = raw.toUpperCase()
  if (
    code.length !== ROOM_CODE_LENGTH ||
    !ALPHABET_RE.test(code)
  ) {
    throw new GameRpcError("INVALID_CODE", "รหัสห้องไม่ถูกต้อง", {
      rpc: "lookup_room",
      args: { code: raw },
    })
  }
  return code
}

export async function lookupRoom(rawCode: string): Promise<LookupRoomResult> {
  const code = validateCode(rawCode)

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("rooms")
    .select("game_type, status")
    .eq("code", code)
    .maybeSingle()

  if (error) {
    throw new GameRpcError(
      parsePgErrCode(error),
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "lookup_room failed",
      { rpc: "lookup_room", args: { code } },
    )
  }

  if (!data) {
    throw new GameRpcError("ROOM_NOT_FOUND", "ห้องไม่พบ / Room not found", {
      rpc: "lookup_room",
      args: { code },
    })
  }

  const row = data as { game_type: string; status: string }

  if (row.status === "ENDED") {
    throw new GameRpcError("ROOM_ENDED", "ห้องนี้จบแล้ว / This room ended", {
      rpc: "lookup_room",
      args: { code },
    })
  }

  return { gameType: row.game_type as GameType, code }
}
