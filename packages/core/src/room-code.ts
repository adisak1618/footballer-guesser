import type { SupabaseClient } from "@supabase/supabase-js"

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const ROOM_CODE_LENGTH = 6
export const ROOM_CODE_MAX_RETRIES = 5

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

export class RoomCodeCollisionError extends Error {
  constructor(message = "ไม่สามารถสร้างรหัสห้องได้ ลองอีกครั้ง") {
    super(message)
    this.name = "RoomCodeCollisionError"
  }
}

export interface CreateRoomWithRetryOptions {
  rpcName?: string
  maxRetries?: number
}

export async function createRoomWithRetry<TArgs = unknown, TResult = unknown>(
  supabase: SupabaseClient,
  args: TArgs,
  optionsOrMaxRetries: CreateRoomWithRetryOptions | number = {},
): Promise<TResult> {
  const options: CreateRoomWithRetryOptions =
    typeof optionsOrMaxRetries === "number"
      ? { maxRetries: optionsOrMaxRetries }
      : optionsOrMaxRetries
  const rpcName = options.rpcName ?? "create_room"
  const maxRetries = options.maxRetries ?? ROOM_CODE_MAX_RETRIES

  let lastError: unknown = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase.rpc(
      rpcName,
      args as Record<string, unknown>,
    )
    if (!error) {
      const row = (data as TResult[] | null)?.[0]
      if (!row) throw new Error(`${rpcName} returned no row`)
      return row
    }
    lastError = error
    if (error.code !== UNIQUE_VIOLATION_CODE) {
      throw error
    }
  }
  throw new RoomCodeCollisionError(
    `${rpcName} failed after ${maxRetries} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}
