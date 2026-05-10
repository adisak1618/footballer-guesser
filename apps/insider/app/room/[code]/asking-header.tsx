"use client"

import { useEffect, useMemo, useState } from "react"
import { RoleBadge } from "@social-hub/ui"

// Issue #16 — Compact in-game header used by all three asking-phase screens
// (Master, Common, Insider). Renders:
//   - ASKING phase tag + countdown timer (existing testids preserved)
//   - Role badge (reused from role-reveal via the shared RoleBadge primitive,
//     with smaller padding for the in-game compact variant)
//   - Thai role-specific how-to-play copy
//   - Optional inline secret word (Insider parity with Master's
//     master-asking-secret-reminder)
//
// The Master's existing master-asking-secret-reminder lives in asking-master
// itself — it sits below this header so the tap-zone for ทายถูกแล้ว stays
// dominant. This header is intentionally chrome-light per design review.

export type AskingHeaderRole = "master" | "insider" | "common"

interface AskingHeaderProps {
  role: AskingHeaderRole
  round: number
  roundTotal: number
  startedAt: string | null
  timeLimitS: number
  // Insider-only inline secret. Master shows the secret in a dedicated
  // master-asking-secret-reminder element rendered by asking-master.tsx.
  insiderSecret?: string | null
}

interface RoleConfig {
  variant: "info" | "warning" | "neutral"
  caption: string
  label: string
  howTo: string
  badgeTestId: string
  howToTestId: string
}

const ROLE_CONFIG: Record<AskingHeaderRole, RoleConfig> = {
  master: {
    variant: "info",
    caption: "👁 ผู้ตัดสิน",
    label: "THE MASTER",
    howTo: "รู้คำลับ ตอบคำถามด้วยปาก กดปุ่มเมื่อมีคนทายถูก",
    badgeTestId: "asking-master-role-badge",
    howToTestId: "asking-master-howto",
  },
  insider: {
    variant: "warning",
    caption: "⚠ คนวงใน ⚠",
    label: "THE INSIDER",
    howTo: "รู้คำลับ ช่วยให้กลุ่มทายถูกอย่างเนียน ๆ อย่าให้โดนจับ",
    badgeTestId: "asking-insider-role-badge",
    howToTestId: "asking-insider-howto",
  },
  common: {
    variant: "neutral",
    caption: "ผู้เล่น",
    label: "PLAYER",
    howTo: "ไม่รู้คำลับ ถามคำถามให้กลุ่มหาคำให้เจอ และจับ Insider ให้ได้",
    badgeTestId: "asking-common-role-badge",
    howToTestId: "asking-common-howto",
  },
}

export function AskingHeader({
  role,
  round,
  roundTotal,
  startedAt,
  timeLimitS,
  insiderSecret,
}: AskingHeaderProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remainingS = useMemo(() => {
    if (!startedAt) return timeLimitS
    const elapsed = (nowMs - new Date(startedAt).getTime()) / 1000
    return Math.max(0, Math.floor(timeLimitS - elapsed))
  }, [startedAt, timeLimitS, nowMs])

  const isLowTime = remainingS < 30
  const mm = Math.floor(remainingS / 60)
    .toString()
    .padStart(2, "0")
  const ss = (remainingS % 60).toString().padStart(2, "0")
  const cfg = ROLE_CONFIG[role]

  return (
    <div data-testid="asking-header" className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            data-testid="asking-phase-tag"
            className="rounded-md border border-hairline bg-surface-elevated px-3 py-1 font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark"
          >
            ASKING
          </span>
          <span
            data-testid="asking-round-counter"
            className="font-display text-[14px] uppercase leading-none tracking-[2px] text-on-dark-soft tabular-nums"
          >
            ROUND {round} / {roundTotal}
          </span>
        </div>
        <span
          data-testid="asking-timer"
          className={`font-hero text-[32px] leading-none tabular-nums ${
            isLowTime ? "text-error" : "text-on-dark"
          }`}
        >
          {mm}:{ss}
        </span>
      </header>

      <RoleBadge
        variant={cfg.variant}
        caption={cfg.caption}
        label={cfg.label}
        testId={cfg.badgeTestId}
        className="px-3 py-2"
      />

      <p
        data-testid={cfg.howToTestId}
        className="text-center font-body text-[14px] leading-snug text-on-dark-soft"
      >
        {cfg.howTo}
      </p>

      {role === "insider" && insiderSecret ? (
        <p
          data-testid="asking-insider-secret"
          className="text-center font-hero text-[32px] uppercase leading-none tracking-[1px] text-on-dark-soft"
        >
          Secret: {insiderSecret.toUpperCase()}
        </p>
      ) : null}
    </div>
  )
}
