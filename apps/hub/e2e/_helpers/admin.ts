import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"

// Stable demo service-role JWT for `supabase start` local stacks.
// NOT a secret — local-only, identical across every developer machine.
const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

export async function insertRoom(opts: {
  code: string
  gameType: "headball" | "insider"
  status?: "LOBBY" | "PLAYING" | "ENDED"
}): Promise<void> {
  const sb = adminClient()
  const { error } = await sb.from("rooms").insert({
    code: opts.code,
    game_type: opts.gameType,
    status: opts.status ?? "LOBBY",
    max_rounds: 5,
    score_positions: 3,
    category: "premier-league",
  })
  if (error) throw new Error(`insertRoom(${opts.code}) failed: ${error.message}`)
}

export async function deleteRoomByCode(code: string): Promise<void> {
  const sb = adminClient()
  const { error } = await sb.from("rooms").delete().eq("code", code)
  if (error) throw new Error(`deleteRoomByCode(${code}) failed: ${error.message}`)
}
