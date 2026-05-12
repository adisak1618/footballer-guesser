// Pure URL transformation for Eng Review decision #5: the `/[lang]/` segment
// is the canonical locale source. A `?lang=` query is a one-time backward-compat
// hatch — when it disagrees with the segment, we 301-redirect to the query's
// locale. When it agrees, we keep things passthrough (Test contract: matches →
// 200; mismatches → 301).
//
// Kept pure (no Next.js types) so it can be unit-tested without booting the
// Next runtime. The real middleware in `../middleware.ts` calls this and
// translates a `redirect` decision into a `NextResponse.redirect(url, 301)`.

import { locales, type Locale } from "../i18n"

export type LocaleDecision =
  | { kind: "passthrough" }
  | { kind: "redirect"; target: string }

const SEGMENT_LANG_RE = /^\/(en|th)(\/|$)/

function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (locales as readonly string[]).includes(value)
}

/**
 * Decide whether a request URL should be passed through to next-intl's
 * middleware or redirected. The redirect target is a path+search string
 * (NOT a full URL) so the caller composes it against `request.nextUrl`.
 *
 * Rules:
 * - If the URL pathname does not start with `/[en|th]/`, passthrough.
 * - If there is no `?lang=` query, passthrough.
 * - If `?lang=` is not a known locale, passthrough (treat as garbage).
 * - If `?lang=` equals the segment, passthrough (no-op; downstream pages
 *   ignore the redundant param).
 * - Otherwise (`?lang=` is a known locale that disagrees with segment),
 *   redirect to `/queryLang/<rest-of-path>?<other-query-params>` (the
 *   `lang` param itself is stripped from the new query string).
 */
export function resolveLocalePrecedence(url: URL): LocaleDecision {
  const segMatch = url.pathname.match(SEGMENT_LANG_RE)
  if (!segMatch) return { kind: "passthrough" }

  const queryLang = url.searchParams.get("lang")
  if (!isLocale(queryLang)) return { kind: "passthrough" }

  const segLang = segMatch[1] as Locale
  if (queryLang === segLang) return { kind: "passthrough" }

  const newPath = url.pathname.replace(SEGMENT_LANG_RE, `/${queryLang}$2`)
  const params = new URLSearchParams(url.search)
  params.delete("lang")
  const remainingQuery = params.toString()
  const target = remainingQuery ? `${newPath}?${remainingQuery}` : newPath
  return { kind: "redirect", target }
}
