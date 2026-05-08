import { afterAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

// Integration test (T-2.B). Requires `bunx supabase start` running locally.
// Verifies migration 0014 creates `word_packs` and `word_pack_items` with
// anon SELECT access — round-trip insert (via service role) → anon SELECT.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

// Stable demo service-role JWT for `supabase start` local stacks.
// NOT a secret — local-only, identical across every developer machine.
const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK

const TEST_PACK_SLUG = "test-word-pack-0014"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

afterAll(async () => {
  // Cleanup — cascades to word_pack_items via FK on delete cascade.
  await admin.from("word_packs").delete().eq("slug", TEST_PACK_SLUG)
})

describe("word_packs + word_pack_items (migration 0014)", () => {
  it("admin inserts a word_packs row + 5 word_pack_items, anon SELECT returns them", async () => {
    // Clean any leftover from previous runs.
    await admin.from("word_packs").delete().eq("slug", TEST_PACK_SLUG)

    const { error: packErr } = await admin.from("word_packs").insert({
      slug: TEST_PACK_SLUG,
      display_name: "Test Pack",
      display_name_th: "แพ็คทดสอบ",
    })
    expect(packErr).toBeNull()

    const items = ["alpha", "beta", "gamma", "delta", "epsilon"].map(
      (value) => ({
        pack_slug: TEST_PACK_SLUG,
        value,
        metadata: { tag: value.toUpperCase() },
      }),
    )
    const { error: itemsErr } = await admin
      .from("word_pack_items")
      .insert(items)
    expect(itemsErr).toBeNull()

    // Anon SELECT — must succeed (anon SELECT policy on both tables).
    const { data: packRow, error: packReadErr } = await anon
      .from("word_packs")
      .select("slug, display_name, display_name_th, enabled")
      .eq("slug", TEST_PACK_SLUG)
      .single()
    expect(packReadErr).toBeNull()
    expect(packRow).toMatchObject({
      slug: TEST_PACK_SLUG,
      display_name: "Test Pack",
      display_name_th: "แพ็คทดสอบ",
      enabled: true,
    })

    const { data: itemRows, error: itemsReadErr } = await anon
      .from("word_pack_items")
      .select("pack_slug, value, metadata")
      .eq("pack_slug", TEST_PACK_SLUG)
      .order("value", { ascending: true })
    expect(itemsReadErr).toBeNull()
    expect(itemRows).toHaveLength(5)
    expect(itemRows?.map((r) => r.value)).toEqual([
      "alpha",
      "beta",
      "delta",
      "epsilon",
      "gamma",
    ])
    expect(itemRows?.[0]?.metadata).toEqual({ tag: "ALPHA" })
  })
})
