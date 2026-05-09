"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import Link from "next/link"
import {
  EmptySlot,
  LoadingSkeleton,
  NetworkErrorBanner,
  PhaseTransitionOverlay,
  PlayerChip,
  RoomCodeDisplay,
} from "@social-hub/ui"
import {
  useRoomRealtime,
  type RoomRealtimeStatus,
} from "@social-hub/core"
import { joinInsiderRoomAction } from "@/app/actions/join-insider-room"
import { startInsiderRoundAction } from "@/app/actions/start-insider-round"
import { getOrCreatePlayerId, readPlayerId } from "@/lib/player-id"
import { displayNameSchema } from "@/lib/schemas"
import { supabase } from "@/lib/supabase"
import { AskingPhase } from "./asking-phase"
import { Reveal } from "./reveal"
import { RoleReveal } from "./role-reveal"
import { Voting } from "./voting"

interface InsiderPlayer {
  id: string
  player_id: string
  display_name: string
  join_order: number
}

interface InsiderRoom {
  id: string
  code: string
  status: string
  host_player_id: string | null
  current_round: number | null
}

const MAX_PLAYERS = 8
const MIN_PLAYERS_TO_START = 3

export function Lobby({ code }: { code: string }) {
  const [room, setRoom] = useState<InsiderRoom | null>(null)
  const [players, setPlayers] = useState<InsiderPlayer[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Per-round phase state (US-058 / Phase 5b.5a) — subscribed once room.status
  // flips to PLAYING. Drives the room-shell phase routing below: 'preparing'
  // (or null while loading) → role-reveal; 'asking' → asymmetric privacy shell.
  const [roundPhase, setRoundPhase] = useState<string | null>(null)
  // US-079 / Phase 5d.5 — Realtime connection status. Drives the
  // <NetworkErrorBanner/> visibility (slides down when DISCONNECTED).
  const [connectionStatus, setConnectionStatus] =
    useState<RoomRealtimeStatus>("CONNECTING")

  // ─── Initial fetch + me detection ───────────────────────────────────────
  useEffect(() => {
    let active = true
    async function load() {
      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("id, code, status, host_player_id, current_round")
        .eq("code", code)
        .maybeSingle()
      if (!active) return
      if (roomErr || !roomRow) {
        setLoadError("ห้องไม่พบ")
        return
      }
      setRoom(roomRow as InsiderRoom)

      const { data: playerRows } = await supabase
        .from("players")
        .select("id, player_id, display_name, join_order")
        .eq("room_id", roomRow.id)
        .order("join_order", { ascending: true })
      if (!active) return
      setPlayers((playerRows ?? []) as InsiderPlayer[])
      setMeId(readPlayerId())
    }
    load()
    return () => {
      active = false
    }
  }, [code])

  // ─── Realtime: rooms + players + round (once PLAYING) ───────────────────
  // game_insider_round is published with phase but NOT secret_value (column-
  // list publication in migration 0017) so the phase update broadcast is safe
  // for anon subscribers.
  const tables = useMemo(
    () =>
      room
        ? [
            { table: "rooms", filter: `id=eq.${room.id}` },
            { table: "players", filter: `room_id=eq.${room.id}` },
            { table: "game_insider_round", filter: `room_id=eq.${room.id}` },
          ]
        : [],
    [room],
  )

  const handleChange = useCallback(
    async (table: string, payload: { eventType: string; new: unknown }) => {
      if (!room) return
      if (table === "rooms") {
        if (payload.eventType === "DELETE") return
        setRoom(payload.new as InsiderRoom)
        return
      }
      if (table === "players") {
        const { data: refreshed } = await supabase
          .from("players")
          .select("id, player_id, display_name, join_order")
          .eq("room_id", room.id)
          .order("join_order", { ascending: true })
        if (refreshed) setPlayers(refreshed as InsiderPlayer[])
        return
      }
      if (table === "game_insider_round") {
        if (payload.eventType === "DELETE") return
        const next = payload.new as { phase?: string } | null
        if (next?.phase) setRoundPhase(next.phase)
      }
    },
    [room],
  )

  useRoomRealtime({
    supabase,
    roomId: room?.id ?? null,
    tables,
    onChange: handleChange,
    onStatusChange: setConnectionStatus,
  })

  // Initial round-phase fetch: covers (a) the gap between subscribing and the
  // first realtime payload landing, and (b) a player who reloads mid-round and
  // missed the original 'preparing' INSERT. Fired only once room is PLAYING.
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || !room.current_round) return
    const roomId = room.id
    const roundNumber = room.current_round
    let active = true
    void (async () => {
      const { data } = await supabase
        .from("game_insider_round")
        .select("phase")
        .eq("room_id", roomId)
        .eq("round_number", roundNumber)
        .maybeSingle()
      if (!active) return
      if (data?.phase) setRoundPhase(data.phase as string)
    })()
    return () => {
      active = false
    }
  }, [room])

  if (loadError) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="font-display text-[40px] uppercase tracking-[0.5px] text-on-dark">
          ห้องไม่พบ
        </h1>
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 text-[15px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-surface"
        >
          กลับหน้าหลัก
        </Link>
      </main>
    )
  }

  if (!room) {
    return <LoadingSkeleton phaseLabel="LOBBY" />
  }

  const me = meId ? players.find((p) => p.player_id === meId) : null

  // US-079 / Phase 5d.5 — Wraps every visible sub-screen so the network-error
  // banner and the phase-transition overlay span the full route. Both are
  // outside the per-screen <main> so they survive sub-component remounts when
  // roundPhase flips (without this, the overlay couldn't track lobby ↔ asking
  // ↔ voting transitions because each sub-screen lives in a separate <main>).
  const screenKey = deriveScreenKey({ status: room.status, roundPhase, hasMe: Boolean(me) })
  const labels = SCREEN_LABELS[screenKey] ?? { en: screenKey.toUpperCase() }
  const shell = (children: React.ReactNode) => (
    <>
      <NetworkErrorBanner visible={connectionStatus === "DISCONNECTED"} />
      <PhaseTransitionOverlay
        phaseKey={screenKey}
        labelEn={labels.en}
        labelTh={labels.th}
      />
      {children}
    </>
  )

  if (!me) {
    return shell(
      <JoinView
        code={code}
        onJoined={(playerId) => setMeId(playerId)}
      />,
    )
  }

  // Once the host advances LOBBY → PLAYING, render the per-phase screen.
  // The Realtime subscription on `rooms` flips room.status here for every
  // player simultaneously (including the host); a separate subscription on
  // `game_insider_round` (added in US-058) drives the per-phase routing below.
  if (room.status === "PLAYING") {
    const round = room.current_round ?? 1
    if (roundPhase === "asking") {
      return shell(
        <AskingPhase
          roomId={room.id}
          round={round}
          mePlayerId={me.player_id}
        />,
      )
    }
    if (roundPhase === "guessed" || roundPhase === "voting") {
      return shell(
        <Voting
          roomId={room.id}
          round={round}
          mePlayerId={me.player_id}
          initialPhase={roundPhase}
        />,
      )
    }
    if (roundPhase === "reveal" || roundPhase === "result_failed") {
      return shell(
        <Reveal
          roomId={room.id}
          round={round}
          mePlayerId={me.player_id}
          phase={roundPhase}
        />,
      )
    }
    return shell(
      <RoleReveal
        roomId={room.id}
        round={round}
        mePlayerId={me.player_id}
      />,
    )
  }

  return shell(
    <LobbyView
      code={code}
      room={room}
      players={players}
      mePlayerId={me.player_id}
    />,
  )
}

// US-079 / Phase 5d.5 — Map (room.status, roundPhase, hasMe) to a stable
// screen key the phase-transition overlay can flash on. Keys must be stable
// across re-renders so the overlay only fires once per real screen change.
function deriveScreenKey({
  status,
  roundPhase,
  hasMe,
}: {
  status: string
  roundPhase: string | null
  hasMe: boolean
}): string {
  if (status !== "PLAYING") return hasMe ? "lobby" : "join"
  if (roundPhase === "asking") return "asking"
  if (roundPhase === "guessed") return "guessed"
  if (roundPhase === "voting") return "voting"
  if (roundPhase === "reveal") return "reveal"
  if (roundPhase === "result_failed") return "reveal-time-up"
  return "role-reveal"
}

const SCREEN_LABELS: Record<string, { en: string; th?: string }> = {
  join: { en: "JOIN", th: "เข้าห้อง" },
  lobby: { en: "LOBBY", th: "ห้องรอ" },
  "role-reveal": { en: "ROLE REVEAL", th: "บทบาท" },
  asking: { en: "ASKING", th: "ถาม" },
  guessed: { en: "GUESSED", th: "ทายถูก" },
  voting: { en: "VOTING", th: "โหวต" },
  reveal: { en: "REVEAL", th: "เฉลย" },
  "reveal-time-up": { en: "TIME UP", th: "หมดเวลา" },
}

// ───────────────────────────────────────────────────────────────────────────
// JoinView: arriving player not yet in the room — collect display name + join.
// ───────────────────────────────────────────────────────────────────────────

function JoinView({
  code,
  onJoined,
}: {
  code: string
  onJoined: (playerId: string) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const parsed = displayNameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ชื่อไม่ถูกต้อง")
      nameInputRef.current?.focus()
      return
    }
    setError(null)

    let playerId: string
    try {
      playerId = getOrCreatePlayerId()
    } catch {
      setError("เปิดเบราว์เซอร์อีกครั้งแล้วลองใหม่")
      return
    }

    startTransition(async () => {
      const result = await joinInsiderRoomAction({
        code,
        displayName: parsed.data,
        playerId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onJoined(result.playerId)
    })
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pt-10 pb-10">
      <header className="flex flex-col gap-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3px] text-on-dark-muted">
          เข้าห้อง / JOIN ROOM
        </p>
        <h1 className="font-hero text-[44px] leading-none tracking-[8px] text-on-dark tabular-nums">
          {code}
        </h1>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label
          htmlFor="insider-join-name"
          className="font-display text-xs uppercase tracking-[2px] text-on-dark-soft"
        >
          ── ชื่อเล่น / DISPLAY NAME ──
        </label>
        <input
          id="insider-join-name"
          ref={nameInputRef}
          data-testid="insider-join-name-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={20}
          placeholder="ชื่อเล่น"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
          disabled={isPending}
          className="min-h-12 w-full rounded-lg border border-hairline bg-surface-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
        />
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          data-testid="insider-join-cta"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-[17px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          {isPending ? "กำลังเข้า..." : "เข้าห้อง / JOIN →"}
        </button>
      </form>
    </main>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// LobbyView: in-room view — player chips + START GAME (T-3.B any-player UI).
// ───────────────────────────────────────────────────────────────────────────

function LobbyView({
  code,
  room,
  players,
  mePlayerId,
}: {
  code: string
  room: InsiderRoom
  players: InsiderPlayer[]
  mePlayerId: string
}) {
  const [startError, setStartError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canStart = players.length >= MIN_PLAYERS_TO_START

  function handleStart() {
    setStartError(null)
    startTransition(async () => {
      const result = await startInsiderRoundAction({
        roomId: room.id,
        playerId: mePlayerId,
      })
      if (!result.ok) {
        setStartError(result.error)
      }
    })
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

      <RoomCodeDisplay code={code} />

      <section className="flex flex-1 flex-col gap-3">
        <h2 className="font-display text-[28px] uppercase leading-none tracking-[0.3px] text-on-dark">
          Players ({players.length}/{MAX_PLAYERS})
        </h2>
        <ul
          data-testid="insider-player-list"
          className="flex flex-col gap-2"
        >
          {players.map((p) => (
            <PlayerChip
              key={p.id}
              joinOrder={p.join_order}
              displayName={p.display_name}
              isMe={p.player_id === mePlayerId}
            />
          ))}
          {/* US-079 / Phase 5d.5 — Dashed empty slots up to MIN_PLAYERS_TO_START
             so the room visually communicates the minimum capacity. The first
             empty slot also carries the min-player hint copy. */}
          {Array.from({
            length: Math.max(0, MIN_PLAYERS_TO_START - players.length),
          }).map((_, offset) => {
            const slotIndex = players.length + offset + 1
            const isFirstEmpty = offset === 0
            return (
              <EmptySlot
                key={`empty-${slotIndex}`}
                index={slotIndex}
                hint={
                  isFirstEmpty
                    ? `ต้องการอย่างน้อย ${MIN_PLAYERS_TO_START} คน`
                    : "เปิดรับผู้เล่น"
                }
              />
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-on-dark-soft">
          {canStart
            ? "เกมจะเริ่มเมื่อทุกคนพร้อม"
            : `ต้องมีผู้เล่นอย่างน้อย ${MIN_PLAYERS_TO_START} คน`}
        </p>
        {startError ? (
          <p
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-center text-sm font-medium text-error"
          >
            {startError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart || isPending}
          aria-busy={isPending}
          data-testid="insider-start-game-cta"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-on-dark transition-colors active:bg-goal-active disabled:bg-goal-disabled disabled:text-on-dark/70"
        >
          <span className="font-display text-[20px] uppercase tracking-[1px]">
            {isPending ? "กำลังเริ่ม..." : "Start Game →"}
          </span>
        </button>
      </section>
    </main>
  )
}
