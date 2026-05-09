"use client"

import { useState } from "react"
import { cn } from "./utils"

export interface RoomCodeDisplayProps {
  code: string
  copyable?: boolean
  className?: string
  testId?: string
}

export function RoomCodeDisplay({
  code,
  copyable = true,
  className,
  testId = "insider-room-code",
}: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  async function copyCode() {
    if (!copyable) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setCopyError(false)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 2000)
    }
  }

  const codeContent = (
    <span
      data-testid={testId}
      className="font-hero text-[48px] leading-none tracking-[8px] text-on-dark tabular-nums"
    >
      {code}
    </span>
  )

  return (
    <section
      className={cn("flex flex-col items-center gap-3 text-center", className)}
    >
      <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
        Room code
      </p>
      {copyable ? (
        <button
          type="button"
          onClick={copyCode}
          aria-label={`คัดลอกรหัสห้อง ${code}`}
          className="flex w-full items-center justify-center rounded-2xl border-2 border-hairline bg-surface-elevated px-6 py-5 transition-colors active:bg-surface"
        >
          {codeContent}
        </button>
      ) : (
        <div className="flex w-full items-center justify-center rounded-2xl border-2 border-hairline bg-surface-elevated px-6 py-5">
          {codeContent}
        </div>
      )}
      {copyable ? (
        <p
          aria-live="polite"
          className="text-xs font-medium tracking-[0.3px] text-on-dark-soft"
        >
          {copyError
            ? "คัดลอกไม่สำเร็จ"
            : copied
              ? "✓ คัดลอกแล้ว"
              : "📋 แตะเพื่อ copy"}
        </p>
      ) : null}
    </section>
  )
}
