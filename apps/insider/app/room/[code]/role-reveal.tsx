"use client"

import { useEffect, useState, useTransition } from "react"
import { GameRpcError } from "@social-hub/core"
import { LoadingSkeleton, RoleBadge } from "@social-hub/ui"
import { advanceToAsking, getMyInsiderSecret } from "@/lib/insider-rpc"
import { supabase } from "@/lib/supabase"

// US-055 / Phase 5b.4a — Role reveal: INSIDER view (the asymmetric drama).
// US-056 / Phase 5b.4b — Role reveal: MASTER view (the judge).
// US-057 / Phase 5b.4c — Role reveal: COMMON view (mystery placeholder).
//
// This component is rendered by the room shell once `rooms.status` flips to
// 'PLAYING' (i.e. start_insider_round committed; phase='preparing'). It reads
// the local player's role from `game_insider_roles` (anon-readable per A1.C
// shape (1)) and calls the SECURITY DEFINER `get_my_insider_secret` RPC for
// every role — master/insider receive the secret (column-level RLS keeps anon
// SELECT on `secret_value` denied; see migration 0021 / pattern note 30) and
// commons receive NULL by design.

type InsiderRole = "master" | "insider" | "player"

interface RoleRevealProps {
  roomId: string
  round: number
  mePlayerId: string
}

export function RoleReveal({ roomId, round, mePlayerId }: RoleRevealProps) {
  const [role, setRole] = useState<InsiderRole | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [secretLoaded, setSecretLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load role + secret via RPC. The role row is inserted in the same
  // transaction as `rooms.status='PLAYING'`, so by the time we render we
  // expect the role row to exist. A short retry guards against any
  // realtime-vs-SELECT eventual-consistency hiccups.
  //
  // The secret RPC is called for every role: master/insider get the secret,
  // commons get NULL (per migration 0021). Calling it for commons too keeps
  // a single load path and matches the US-057 acceptance criterion.
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
      try {
        const s = await getMyInsiderSecret(supabase, {
          roomId,
          round,
          playerId: mePlayerId,
        })
        if (!active) return
        // RPC returns NULL for commons — coerce to null and continue.
        setSecret((s as string | null) ?? null)
        setSecretLoaded(true)
      } catch {
        if (!active) return
        setLoadError("โหลดคำลับไม่สำเร็จ")
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

  if (!role || !secretLoaded) {
    return (
      <LoadingSkeleton
        phaseLabel={`ROUND ${round}`}
        caption="กำลังเตรียมเกม..."
        testId="role-reveal-loading"
      />
    )
  }

  if (role === "insider" && secret) {
    return (
      <InsiderView roomId={roomId} round={round} mePlayerId={mePlayerId} secret={secret} />
    )
  }

  if (role === "master" && secret) {
    return (
      <MasterView roomId={roomId} round={round} mePlayerId={mePlayerId} secret={secret} />
    )
  }

  return (
    <CommonView roomId={roomId} round={round} mePlayerId={mePlayerId} />
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
        <RoleBadge
          variant="warning"
          caption="⚠ คนวงใน ⚠"
          label="THE INSIDER"
          testId="insider-role-badge"
        />

        <div className="flex flex-col gap-3">
          <p className="text-center text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
            YOUR SECRET WORD
          </p>
          <div
            data-testid="insider-secret-card"
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-tag-pink px-6 py-10 text-center"
          >
            {/* US-080 / Phase 5d.6 — sr-only screen-reader announcement.
             * Visual span is aria-hidden so a screen reader doesn't read the
             * BIG NAME twice; the sr-only span carries the spoken contract. */}
            <span className="sr-only">Your secret word: {secret}</span>
            <span
              aria-hidden="true"
              className="font-hero text-[clamp(72px,18vw,144px)] uppercase leading-none tracking-[2px] text-on-dark"
            >
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
// MasterView — wireframe 5b
// ───────────────────────────────────────────────────────────────────────────

function MasterView({
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
      <header className="flex flex-col gap-2 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <RoleBadge
          variant="info"
          caption="👁 ผู้ตัดสิน"
          label="THE MASTER"
          testId="master-role-badge"
        />

        <div className="flex flex-col gap-3">
          <p className="text-center text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
            THE SECRET WORD
          </p>
          <div
            data-testid="master-secret-card"
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-tag-pink px-6 py-10 text-center"
          >
            <span className="sr-only">Your secret word: {secret}</span>
            <span
              aria-hidden="true"
              className="font-hero text-[clamp(72px,18vw,144px)] uppercase leading-none tracking-[2px] text-on-dark"
            >
              {secret.toUpperCase()}
            </span>
          </div>
        </div>

        <div
          data-testid="master-instruction-text"
          className="flex flex-col gap-2 text-center"
        >
          <p className="font-body text-[18px] leading-snug text-on-dark">
            คุณคือผู้ตัดสิน
            <br />
            ตอบคำถามได้เพียง
            <br />
            ใช่ / ไม่ใช่ / ไม่แน่ใจ
          </p>
          <p className="font-body text-[13px] uppercase tracking-[0.3px] text-on-dark-soft">
            YOU ARE THE JUDGE.
            <br />
            ANSWER YES / NO / UNSURE.
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
// CommonView — wireframe 5c (US-057). Mystery placeholder + warning hint.
// ───────────────────────────────────────────────────────────────────────────

function CommonView({
  roomId,
  round,
  mePlayerId,
}: {
  roomId: string
  round: number
  mePlayerId: string
}) {
  const { handleReady, isPending, error } = useAdvanceToAsking({
    roomId,
    round,
    mePlayerId,
  })

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-8 pb-10">
      <header className="flex flex-col gap-2 text-center">
        <p className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Round {round}
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <RoleBadge
          variant="neutral"
          caption="ผู้เล่น"
          label="PLAYER"
          testId="common-role-badge"
        />

        <div className="flex flex-col gap-3">
          <p className="text-center text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
            THE SECRET WORD
          </p>
          <div
            data-testid="common-mystery-card"
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-surface-elevated px-6 py-10 text-center"
          >
            <span className="font-hero text-[clamp(72px,18vw,144px)] uppercase leading-none tracking-[2px] text-on-dark-muted">
              ???
            </span>
          </div>
        </div>

        <div
          data-testid="common-instruction-text"
          className="flex flex-col gap-2 text-center"
        >
          <p className="font-body text-[18px] leading-snug text-on-dark">
            ถามคำถามใช่/ไม่ใช่
            <br />
            เพื่อหาคำลับ
          </p>
          <p className="font-body text-[13px] uppercase tracking-[0.3px] text-on-dark-soft">
            ASK YES/NO QUESTIONS
            <br />
            TO FIND THE SECRET.
          </p>
        </div>

        {/* US-080 / Phase 5d.6 — wrap the warning hint in <aside> so the
         * Common screen exposes the ARIA-landmark trio (main/header/aside).
         * Insider/Master views use aside for the asking-phase response feed
         * instead. */}
        <aside
          aria-label="Insider warning"
          data-testid="common-warning-hint"
          className="text-center font-body text-[14px] tracking-[0.3px] text-warning"
        >
          ⚠ มีคนวงในซ่อนอยู่ในกลุ่ม
        </aside>
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
