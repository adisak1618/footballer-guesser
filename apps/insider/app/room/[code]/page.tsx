import { listEnabledPacks } from "@social-hub/content"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { Lobby } from "./lobby"

export const dynamic = "force-dynamic"

export default async function InsiderRoomPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const supabase = createSupabaseServerClient()
  const packs = await listEnabledPacks(supabase)
  return <Lobby code={code} packs={packs} />
}
