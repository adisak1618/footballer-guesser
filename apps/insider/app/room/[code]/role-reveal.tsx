"use client"

import { useEffect, useState, useTransition } from "react"
import { GameRpcError } from "@social-hub/core"
import { advanceToAsking, getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-055 / Phase 5b.4a — Role reveal: INSIDER view (the asymmetric drama).
//
// This component is rendered by the room shell once `rooms.status` flips to
// 'PLAYING' (i.e. start_insider_round committed; phase='preparing'). It reads
// the local player's role from `game_insider_roles` (anon-readable per A1.C
// shape (1)) and, for master/insider, fetches the secret via the SECURITY
// DEFINER `get_my_insider_secret` RPC (column-level RLS keeps anon SELECT on
// `secret_value` denied — see migration 0021 / pattern note 30).
//
// Story-scope: ONLY the Insider variant is implemented here (per US-055
// acceptance criteria). Master (US-056) and Common (US-057) variants land
// next. Until then, non-insider players see a minimal placeholder — they're
// not blocked, they just don't see the wireframe-5b/5c treatment yet.

type InsiderRole = "master" | "insider" | "player"

interface RoleRevealProps {
  roomId: string
  round: number
  mePlayerId: string
}

export function RoleReveal({ roomId, round, mePlayerId }: RoleRevealProps) {
  const [role, setRole] = useState<InsiderRole | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load role + (if applicable) secret. The role row is inserted in the same
  // transaction as `rooms.status='PLAYING'`, so by the time we render we
  // expect the role row to exist. A short retry guards against any
  // realtime-vs-SELECT eventual-consistency hiccups.
  useEffect(() => {
    let active = true
    let attempts = 0
    async function tick() {
      const { data, error } = await supabase
        .from("game_insider_roles")
        .select("role")
        .eq("room_id", roomId)
        .eq("round_number", round)
        .eq("player_id", mePlayerId)
        .maybeSingle()
      if (!active) return
      if (error) {
        setLoadError("โหลดบทบาทไม่สำเร็จ")
        return
      }
      const r = data?.role as InsiderRole | undefined
      if (!r) {
        attempts += 1
        if (attempts > 10) {
          setLoadError("ไม่พบบทบาทของคุณ")
          return
        }
        setTimeout(tick, 300)
        return
      }
      setRole(r)
      if (r === "master" || r === "insider") {
        try {
          const s = await getMyInsiderSecret(supabase, {
            roomId,
            round,
            playerId: mePlayerId,
          })
          if (!active) return
          setSecret(s)
        } catch {
          if (!active) return
          setLoadError("โหลดคำลับไม่สำเร็จ")
        }
      }
    }
    tick()
    return () => {
      active = false
    }
  }, [roomId, round, mePlayerId])

  if (loadError) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert" className="text-sm text-error">
          {loadError}
        </p>
      </main>
    )
  }

  if (!role || (role !== "player" && !secret)) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-on-dark-soft">กำลังเตรียมเกม...</p>
      </main>
    )
  }

  if (role === "insider" && secret) {
    return (
      <InsiderView roomId={roomId} round={round} mePlayerId={mePlayerId} secret={secret} />
    )
  }

  // Master/Common placeholder until US-056/US-057 land. Still includes the
  // ฉันพร้อมแล้ว CTA (T-3.B) so non-Insider players aren't stuck.
  return (
    <PlaceholderView
      roomId={roomId}
      round={round}
      mePlayerId={mePlayerId}
      role={role}
    />
  )
}

// ───────────────────────────────────────────────────────────────────────────
// InsiderView — wireframe 5a
// ───────────────────────────────────────────────────────────────────────────

function InsiderView({
  roomId,
  round,
  mePlayerId,
  secret,
}: {
  roomId: string
  round: number
  mePlayerId: string
  secret: string
}) {
  const { handleReady, isPending, error } = useAdvanceToAsking({
    roomId,
    round,
    mePlayerId,
  })

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-8 pb-10">
      {/* Warning-yellow scanline at the top edge */}
      <div
        data-testid="insider-warning-scanline"
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-warning"
      />

      <header className="flex flex-col gap-2 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <div
          data-testid="insider-role-badge"
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-warning bg-surface/50 px-4 py-4 text-center"
        >
          <span className="font-body text-[18px] tracking-[0.3px] text-warning">
            ⚠ คนวงใน ⚠
          </span>
          <span className="font-display text-[32px] uppercase leading-none tracking-[1px] text-on-dark">
            THE INSIDER
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-center text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
            YOUR SECRET WORD
          </p>
          <div
            data-testid="insider-secret-card"
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-tag-pink px-6 py-10 text-center"
          >
            <span className="font-hero text-[clamp(72px,18vw,144px)] uppercase leading-none tracking-[2px] text-on-dark">
              {secret.toUpperCase()}
            </span>
          </div>
        </div>

        <div
          data-testid="insider-mission-text"
          className="flex flex-col gap-2 text-center"
        >
          <p className="font-body text-[18px] leading-snug text-on-dark">
            คุณรู้คำตอบแล้ว
            <br />
            ช่วยกลุ่มทายให้ถูก
            <br />
            โดยห้ามให้ใครจับได้
          </p>
          <p className="font-body text-[13px] uppercase tracking-[0.3px] text-on-dark-soft">
            YOU KNOW THE ANSWER.
            <br />
            HELP THEM GUESS — DON&apos;T GET CAUGHT.
          </p>
        </div>
      </section>

      <section className="mt-auto flex flex-col gap-3">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-center text-sm font-medium text-error"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleReady}
          disabled={isPending}
          aria-busy={isPending}
          data-testid="insider-ready-cta"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          <span className="font-display text-[20px] uppercase tracking-[1px]">
            {isPending ? "กำลังดำเนินต่อ..." : "ฉันพร้อมแล้ว →"}
          </span>
        </button>
      </section>
    </main>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Master/Common placeholder — picked up by US-056/US-057.
// ───────────────────────────────────────────────────────────────────────────

function PlaceholderView({
  roomId,
  round,
  mePlayerId,
  role,
}: {
  roomId: string
  round: number
  mePlayerId: string
  role: InsiderRole
}) {
  const { handleReady, isPending, error } = useAdvanceToAsking({
    roomId,
    round,
    mePlayerId,
  })
  const label =
    role === "master" ? "THE MASTER / ผู้ตัดสิน" : "PLAYER / ผู้เล่น"

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-8 pb-10">
      <header className="flex flex-col gap-2 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
        <p className="font-display text-[24px] uppercase leading-none tracking-[1px] text-on-dark">
          {label}
        </p>
      </header>

      <section className="mt-auto flex flex-col gap-3">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-center text-sm font-medium text-error"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleReady}
          disabled={isPending}
          aria-busy={isPending}
          data-testid="insider-ready-cta"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          <span className="font-display text-[20px] uppercase tracking-[1px]">
            {isPending ? "กำลังดำเนินต่อ..." : "ฉันพร้อมแล้ว →"}
          </span>
        </button>
      </section>
    </main>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Shared CTA hook — calls advance_to_asking (T-3.B: any player can fire).
// ───────────────────────────────────────────────────────────────────────────

function useAdvanceToAsking({
  roomId,
  round,
  mePlayerId,
}: {
  roomId: string
  round: number
  mePlayerId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleReady() {
    setError(null)
    startTransition(async () => {
      try {
        await advanceToAsking(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
        })
      } catch (e) {
        if (e instanceof GameRpcError) {
          setError(mapAdvanceError(e.code))
        } else {
          setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง")
        }
      }
    })
  }

  return { handleReady, isPending, error }
}

function mapAdvanceError(code: string): string {
  switch (code) {
    case "PG011":
      return "คุณไม่ได้อยู่ในห้องนี้"
    default:
      return "ไม่สามารถดำเนินต่อได้"
  }
}
