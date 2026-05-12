import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Warewolf — Balance & Setup Recommender",
  description:
    "Find a balanced Werewolf setup for 5–20 souls. Pick a vibe, get fresh role combinations, share by link.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
