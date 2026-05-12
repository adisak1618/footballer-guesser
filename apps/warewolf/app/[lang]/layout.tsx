import type { ReactNode } from "react"

// Minimal stub; US-011 replaces this with the locale-aware layout
// (next-intl provider, segment-vs-query precedence, html lang attribute).
export default function LangLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
