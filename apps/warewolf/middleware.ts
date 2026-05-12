import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./i18n/routing"
import { resolveLocalePrecedence } from "./lib/locale-precedence"

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  const decision = resolveLocalePrecedence(request.nextUrl)
  if (decision.kind === "redirect") {
    // Eng Review decision #5: segment is canonical. When `?lang=` disagrees,
    // 301 to the query's locale (path-preserving), and strip the redundant
    // param. Permanent so search engines + share-link consumers settle on
    // the canonical segment form.
    const url = new URL(decision.target, request.nextUrl.origin)
    return NextResponse.redirect(url, 301)
  }
  return intlMiddleware(request)
}

export const config = {
  // Match everything except Next internals, API routes, and static assets.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
