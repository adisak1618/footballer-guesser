import type { SupabaseClient } from "@supabase/supabase-js"
import { GameRpcError, dispatch, parsePgErrCode } from "@social-hub/core"

export interface PackItem {
  itemId: string
  displayValue: string
  metadata: Record<string, unknown>
}

export interface EnabledPack {
  slug: string
  displayName: string
  displayNameTh?: string
  handler: string
}

interface RawPackItem {
  item_id: string
  display_value: string
  metadata: Record<string, unknown> | null
}

interface RawContentPack {
  slug: string
  display_name: string
  display_name_th: string | null
  handler: string
}

export async function getRandomPackItem(
  supabase: SupabaseClient,
  packSlug: string,
): Promise<PackItem> {
  const row = await dispatch<{ p_slug: string }, RawPackItem>(
    supabase,
    "get_random_pack_item",
    { p_slug: packSlug },
  )

  return {
    itemId: row.item_id,
    displayValue: row.display_value,
    metadata: row.metadata ?? {},
  }
}

export async function listEnabledPacks(
  supabase: SupabaseClient,
): Promise<EnabledPack[]> {
  const { data, error } = await supabase
    .from("content_packs")
    .select("slug, display_name, display_name_th, handler")
    .eq("enabled", true)
    .order("display_name", { ascending: true })

  if (error) {
    const code = parsePgErrCode(error)
    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "content_packs select failed"
    throw new GameRpcError(code, message, {
      rpc: "content_packs.select",
      args: { enabled: true },
    })
  }

  const rows = (data ?? []) as RawContentPack[]
  return rows.map((r) => {
    const pack: EnabledPack = {
      slug: r.slug,
      displayName: r.display_name,
      handler: r.handler,
    }
    if (r.display_name_th !== null && r.display_name_th !== undefined) {
      pack.displayNameTh = r.display_name_th
    }
    return pack
  })
}
