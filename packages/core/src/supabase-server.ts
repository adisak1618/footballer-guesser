import { createClient } from "@supabase/supabase-js"

export function createSupabaseServerClient<TDB = unknown>() {
  return createClient<TDB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
