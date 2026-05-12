// Re-exports for convenience — the canonical config lives in `./i18n/routing.ts`.
// This file exists so consumers (and the US-011 acceptance criterion) have a
// single `apps/warewolf/i18n.ts` entry to look at when asking "what are the
// locales?".
export { routing } from "./i18n/routing"

export const locales = ["en", "th"] as const
export const defaultLocale = "en" as const
export type Locale = (typeof locales)[number]
