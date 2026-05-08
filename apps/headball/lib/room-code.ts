import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import type { CreateRoomArgs, CreateRoomResult } from "@/lib/types"

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const ROOM_CODE_LENGTH = 6

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length]
  }
  return out
}

const UNIQUE_VIOLATION_CODE = "23505"
export const ROOM_CODE_MAX_RETRIES = 5

export class RoomCodeCollisionError extends Error {
  constructor(message = "ไม่สามารถสร้างรหัสห้องได้ ลองอีกครั้ง") {
    super(message)
    this.name = "RoomCodeCollisionError"
  }
}

export async function createRoomWithRetry(
  supabase: SupabaseClient<Database>,
  args: CreateRoomArgs,
  maxRetries: number = ROOM_CODE_MAX_RETRIES,
): Promise<CreateRoomResult> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase.rpc("create_room", args)
    if (!error) {
      const row = data?.[0]
      if (!row) throw new Error("create_room returned no row")
      return row
    }
    lastError = error
    if (error.code !== UNIQUE_VIOLATION_CODE) {
      throw error
    }
  }
  throw new RoomCodeCollisionError(
    `create_room failed after ${maxRetries} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}
