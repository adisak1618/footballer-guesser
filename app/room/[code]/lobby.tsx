"use client"

import { useState } from "react"
import Link from "next/link"
import { useGameStore } from "@/lib/game-store"

const TAG_BG: Record<number, string> = {
  1: "bg-tag-red",
  2: "bg-tag-blue",
  3: "bg-tag-yellow",
  4: "bg-tag-green",
  5: "bg-tag-purple",
  6: "bg-tag-orange",
  7: "bg-tag-pink",
  8: "bg-tag-cyan",
}

const TAG_TEXT: Record<number, string> = {
  1: "text-on-dark",
  2: "text-on-dark",
  3: "text-on-light",
  4: "text-on-dark",
  5: "text-on-dark",
  6: "text-on-dark",
  7: "text-on-dark",
  8: "text-on-dark",
}

const MAX_PLAYERS = 8

export function Lobby({ code }: { code: string }) {
  const room = useGameStore((s) => s.room)
  const players = useGameStore((s) => s.players)
  const me = useGameStore((s) => s.me)

  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  if (!room) return null

  const isHost = me ? me.player_id === room.host_player_id : false

  async function copyCode() {
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

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-6 pb-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium tracking-[0.3px] text-on-dark-muted underline-offset-4 hover:underline"
        >
          ← ออกจากห้อง
        </Link>
      </header>

      <section className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
          Room code
        </p>
        <button
          type="button"
          onClick={copyCode}
          aria-label={`คัดลอกรหัสห้อง ${code}`}
          className="flex w-full items-center justify-center rounded-2xl border-2 border-hairline bg-surface-elevated px-6 py-5 transition-colors active:bg-surface"
        >
          <span className="font-hero text-[48px] leading-none tracking-[8px] text-on-dark tabular-nums">
            {code}
          </span>
        </button>
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
      </section>

      <section className="flex flex-1 flex-col gap-3">
        <h2 className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Players ({players.length}/{MAX_PLAYERS})
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((p) => {
            const bg = TAG_BG[p.join_order] ?? "bg-tag-red"
            const text = TAG_TEXT[p.join_order] ?? "text-on-dark"
            const isMe = me?.id === p.id
            return (
              <li
                key={p.id}
                aria-label={`Player ${p.display_name}${isMe ? " (คุณ)" : ""}, join order ${p.join_order}`}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${bg} ${text}`}
              >
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-base font-semibold tabular-nums text-on-dark"
                >
                  {p.join_order}
                </span>
                <span className="text-base font-semibold tracking-[0.2px]">
                  {p.display_name}
                  {isMe ? (
                    <span className="ml-2 text-xs font-medium uppercase tracking-[0.3px] opacity-80">
                      (คุณ)
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
          {players.length === 0 && (
            <li className="rounded-2xl border border-hairline bg-surface px-4 py-6 text-center text-sm text-on-dark-soft">
              ยังไม่มีผู้เล่น
            </li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-on-dark-soft">
          เกมจะเริ่มเมื่อทุกคนพร้อม
        </p>
        {isHost ? (
          <button
            type="button"
            disabled
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
            title="จะเปิดใช้งานในรอบถัดไป"
          >
            <span aria-hidden className="text-xl leading-none">⚽</span>
            <span className="font-display text-[20px] uppercase tracking-[1px]">
              Start Game
            </span>
          </button>
        ) : (
          <p className="flex min-h-14 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 text-center text-[15px] font-semibold tracking-[0.3px] text-on-dark-soft">
            รอ host เริ่มเกม
          </p>
        )}
      </section>
    </main>
  )
}
