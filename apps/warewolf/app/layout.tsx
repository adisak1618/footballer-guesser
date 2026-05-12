import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

// The real <html>/<body> chrome lives in `[lang]/layout.tsx` so the html lang
// attribute matches the active locale (next-intl pattern). This root layout
// is a passthrough — Next.js requires *a* root layout, but we don't render
// chrome here so we don't end up with two <html> trees.
export const metadata: Metadata = {
  title: "Warewolf — Balance & Setup Recommender",
  description:
    "Find a balanced Werewolf setup for 5–20 souls. Pick a vibe, get fresh role combinations, share by link.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
