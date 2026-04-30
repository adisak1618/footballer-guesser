// Pure guard for the host-only "round is over → call next_round" trigger in
// `app/room/[code]/playing.tsx`. Lives in its own file so the rules are
// unit-testable without React render machinery.
//
// `roundStateLoaded` is the critical bit: it must remain false until a fresh
// refetch lands in THIS Playing mount. Without that gate the host's first
// render after a rematch can inherit stale round_state from the prior game,
// see roundOver=true on a round nobody played yet, and burn the
// triggeredRound ref on a no-op next_round call. The real round-1-end trigger
// is then suppressed because triggeredRound already equals currentRound.

export interface ShouldTriggerNextRoundInput {
  roundStateLoaded: boolean
  roundOver: boolean
  isHost: boolean
  triggeredRound: number | null
  currentRound: number
}

export function shouldTriggerNextRound({
  roundStateLoaded,
  roundOver,
  isHost,
  triggeredRound,
  currentRound,
}: ShouldTriggerNextRoundInput): boolean {
  if (!roundStateLoaded) return false
  if (!roundOver) return false
  if (!isHost) return false
  if (triggeredRound === currentRound) return false
  return true
}
