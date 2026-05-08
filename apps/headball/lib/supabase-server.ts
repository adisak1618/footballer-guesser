import { createSupabaseServerClient as createCoreServerClient } from "@social-hub/core"
import type { Database } from "@social-hub/types"

export function createSupabaseServerClient() {
  return createCoreServerClient<Database>()
}
