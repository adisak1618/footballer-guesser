/**
 * Share URL encode/decode helpers — URL is the canonical source of shareable
 * state per Eng Review decision #4.
 *
 * `decodeSetup` is the SOLE place that silently substitutes unknown role IDs
 * with `villager` per Eng Review decision #3. The validator stays strict.
 *
 * URL format (design doc lines 464–477):
 *   ?p=<int 5–20>&roles=<csv>&lang=<en|th>
 */

import { z } from "zod"

import { ROLES, type Role, type RoleId } from "@social-hub/content"

/**
 * Zod schema for share-URL params. Matches the exact shape locked in the
 * design doc Eng Review section.
 *
 * - `p`: coerces to int, clamps to [5,20] via `.catch(8)` fallback when
 *   out-of-range or non-integer.
 * - `roles`: csv → string[] → unknown ids substituted with `villager`
 *   (single-source-of-truth substitution per Eng Review decision #3).
 * - `lang`: defaults to `'en'` when missing; throws when invalid (callers
 *   pre-filter to `undefined` for graceful behavior).
 */
export const ShareUrlSchema = z.object({
  p: z.coerce.number().int().min(5).max(20).catch(8),
  roles: z
    .string()
    .transform((csv) => csv.split(","))
    .pipe(z.array(z.string()))
    .transform((ids) =>
      ids.map((id) =>
        (ROLES as Readonly<Record<string, Role | undefined>>)[id]
          ? id
          : "villager",
      ),
    ),
  lang: z.enum(["en", "th"]).default("en"),
})

export interface EncodeSetupInput {
  playerCount: number
  roles: readonly RoleId[]
  lang: "en" | "th"
}

export function encodeSetup(input: EncodeSetupInput): URLSearchParams {
  const params = new URLSearchParams()
  params.set("p", String(input.playerCount))
  params.set("roles", input.roles.join(","))
  params.set("lang", input.lang)
  return params
}

export interface DecodeSetupResult {
  playerCount: number
  roles: RoleId[]
  lang: "en" | "th"
  /** True when the URL `p` was out-of-range or non-integer (UI shows a toast). */
  clampedP: boolean
  /** Original unknown role ids that were silently replaced with `villager`. */
  substitutedIds: string[]
}

export function decodeSetup(
  input: URLSearchParams | string,
): DecodeSetupResult {
  const params =
    typeof input === "string" ? new URLSearchParams(input) : input

  const pRaw = params.get("p")
  const rolesRaw = params.get("roles")
  const langRaw = params.get("lang")

  // Detect clampedP: only true when p was provided AND out-of-range/invalid.
  // Missing p is "default", not "clamped".
  let clampedP = false
  if (pRaw !== null) {
    const n = Number(pRaw)
    if (!Number.isInteger(n) || n < 5 || n > 20) {
      clampedP = true
    }
  }

  // Detect substitutedIds before the schema collapses them.
  const substitutedIds: string[] = []
  if (rolesRaw !== null) {
    for (const id of rolesRaw.split(",")) {
      if (
        !(ROLES as Readonly<Record<string, Role | undefined>>)[id]
      ) {
        substitutedIds.push(id)
      }
    }
  }

  // Pre-filter lang so an invalid value (e.g. ?lang=fr) falls back to the
  // schema default instead of throwing.
  const langSafe = langRaw === "en" || langRaw === "th" ? langRaw : undefined

  const parsed = ShareUrlSchema.parse({
    p: pRaw ?? 8,
    roles: rolesRaw ?? "villager",
    lang: langSafe,
  })

  return {
    playerCount: parsed.p,
    roles: parsed.roles as RoleId[],
    lang: parsed.lang,
    clampedP,
    substitutedIds,
  }
}
