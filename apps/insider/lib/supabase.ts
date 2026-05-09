import { createSupabaseBrowserClient as createCoreBrowserClient } from "@social-hub/core"
import type { Database } from "@social-hub/types"

export function createSupabaseBrowserClient() {
  return createCoreBrowserClient<Database>()
}

export const supabase = createSupabaseBrowserClient()
