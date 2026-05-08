import { createSupabaseServerClient as createCoreServerClient } from "@social-hub/core"
import type { Database } from "@/lib/database.types"

export function createSupabaseServerClient() {
  return createCoreServerClient<Database>()
}
