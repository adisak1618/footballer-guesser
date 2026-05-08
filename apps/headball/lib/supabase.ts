import { createSupabaseBrowserClient as createCoreBrowserClient } from "@social-hub/core"
import type { Database } from "@/lib/database.types"

export function createSupabaseBrowserClient() {
  return createCoreBrowserClient<Database>()
}

export const supabase = createSupabaseBrowserClient()
