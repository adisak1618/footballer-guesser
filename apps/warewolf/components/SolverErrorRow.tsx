/**
 * <SolverErrorRow> — visible manifestation of Eng Review decision #2.
 *
 * `pickWolvesForBalance` throws on an empty filtered pool; `computeSetupList`
 * catches and emits a `SolverError` marker into the setup list. The setup-list
 * UI (US-016) substitutes this row for the would-be <SetupCard>.
 *
 * Parchment card style mirrors the setup list visually so the row sits in
 * the same vertical rhythm. `role='alert'` so assistive tech announces the
 * failure when a tab/archetype switch produces one.
 */

import { ARCHETYPES, type ArchetypeId } from "../lib/archetypes"

export interface SolverErrorRowProps {
  archetypeId: ArchetypeId
  playerCount: number
}

export function SolverErrorRow({ archetypeId, playerCount }: SolverErrorRowProps) {
  const archetype = ARCHETYPES[archetypeId]
  const name = archetype?.i18n.en.name ?? archetypeId

  return (
    <div
      data-testid="solver-error-row"
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-2)",
        padding: "var(--s-3)",
        border: "1.5px solid var(--color-blood)",
        background: "var(--color-blood-bg)",
        color: "var(--color-blood)",
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        fontSize: "var(--t-body-sm)",
        lineHeight: 1.3,
        minHeight: 44,
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
      >
        ⚠
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        Solver can&apos;t balance this — {name} @ {playerCount}p
      </span>
    </div>
  )
}
