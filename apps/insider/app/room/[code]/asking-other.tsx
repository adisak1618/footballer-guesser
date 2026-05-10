"use client"

import { AskingHeader } from "./asking-header"

// Issue #16 — Non-Master asking-phase view (Insider + Common).
//
// Compact in-game header replaces the previous full-height response feed
// and Insider-only D2 hint. Both the response feed and hint mechanic were
// driven by the master_respond RPC; #16 removes them along with the
// Y/N/Unsure response buttons because Headball is a same-room offline
// social game — answers are spoken aloud, not clicked.
//
// Insider/Common asymmetry now lives in the header itself: Insider sees the
// secret word inline (parity with Master's master-asking-secret-reminder),
// Common does not. The role-reveal-phase D4 anti-cheat parity (identical
// DOM Insider≡Common) is intentionally relaxed for this in-game header —
// once asking begins, the secret is spoken aloud anyway.

type InsiderRole = "master" | "insider" | "player"

interface AskingOtherProps {
  roomId: string
  round: number
  role: Exclude<InsiderRole, "master">
  startedAt: string | null
  timeLimitS: number
  // Only the Insider receives a non-null secret. Common always passes null.
  secret: string | null
}

export function AskingOther({ role, startedAt, timeLimitS, secret }: AskingOtherProps) {
  const headerRole = role === "insider" ? "insider" : "common"

  return (
    <main
      data-testid="asking-phase-shell"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-4 px-6 pt-6 pb-8"
    >
      <AskingHeader
        role={headerRole}
        startedAt={startedAt}
        timeLimitS={timeLimitS}
        insiderSecret={role === "insider" ? secret : null}
      />

      <section
        data-testid="asking-other-instruction"
        className="flex flex-col items-center gap-1 text-center"
      >
        <p className="font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark">
          ── ASK OUT LOUD ──
        </p>
        <p className="font-body text-[15px] leading-snug text-on-dark-soft">
          ถามดัง ๆ ในกลุ่ม
        </p>
      </section>
    </main>
  )
}
