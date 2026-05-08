import { createBrowserClient } from "@supabase/ssr"

export function createSupabaseBrowserClient<TDB = unknown>() {
  return createBrowserClient<TDB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
