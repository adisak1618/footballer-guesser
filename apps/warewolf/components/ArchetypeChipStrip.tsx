"use client"

/**
 * <ArchetypeChipStrip> — multi-select filter strip above the /setup list.
 *
 * Renders one chip per archetype in ARCHETYPES whose [minPlayers, maxPlayers]
 * window includes the current `playerCount`; archetypes outside the window
 * do NOT render (per US-015 AC + design doc Reconciliation pass).
 *
 * Empty `activeFilters` set means "show all" — consumed by `computeSetupList`
 * (lib/solver.ts) which treats an empty Set as a no-op filter.
 *
 * Caller wires `lang` from next-intl's `useLocale()` (per reconciliation:
 * only the selected language renders inside the chip — no en+th bilingual
 * stacking like BalanceScale/PlayableBanner). Default 'en' keeps the
 * component testable without an `<IntlProvider>` wrapper.
 *
 * Tap target ≥ 44px per Pass 6 (visual chip can be smaller via inner
 * padding; the <button> itself is the tap target). Focus ring is inherited
 * from the global `:focus-visible` rule in apps/warewolf/app/globals.css
 * (2px blood-red @ 2px offset).
 */

import type { KeyboardEvent } from "react"
import { useRef } from "react"
import { ARCHETYPES, type ArchetypeId } from "../lib/archetypes"

export interface ArchetypeChipStripProps {
  playerCount: number
  activeFilters: Set<ArchetypeId>
  onChange: (next: Set<ArchetypeId>) => void
  /** Resolved by the caller via next-intl. Defaults to 'en'. */
  lang?: "en" | "th"
}

export function ArchetypeChipStrip({
  playerCount,
  activeFilters,
  onChange,
  lang = "en",
}: ArchetypeChipStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)

  const visible = Object.values(ARCHETYPES).filter(
    (a) => playerCount >= a.minPlayers && playerCount <= a.maxPlayers,
  )

  function toggle(id: ArchetypeId) {
    const next = new Set(activeFilters)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const buttons = stripRef.current?.querySelectorAll<HTMLButtonElement>(
      "button[data-chip]",
    )
    if (!buttons || buttons.length === 0) return
    const delta = e.key === "ArrowLeft" ? -1 : 1
    const target = buttons[(idx + delta + buttons.length) % buttons.length]
    target?.focus()
  }

  return (
    <div
      ref={stripRef}
      data-testid="archetype-chip-strip"
      role="toolbar"
      aria-label="Archetype filters"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        padding: "8px 16px 10px",
        borderBottom: "var(--b)",
        background: "var(--color-parchment)",
        flexShrink: 0,
        scrollbarWidth: "thin",
      }}
    >
      {visible.map((arch, i) => {
        const active = activeFilters.has(arch.id)
        return (
          <button
            key={arch.id}
            type="button"
            data-chip={arch.id}
            data-active={active}
            aria-pressed={active}
            onClick={() => toggle(arch.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 12px",
              minHeight: 44,
              minWidth: 44,
              border: active
                ? "1.5px solid var(--color-blood)"
                : "1.5px solid var(--color-ink)",
              background: active
                ? "var(--color-blood)"
                : "var(--color-cream)",
              color: active ? "var(--color-cream)" : "var(--color-ink)",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: active ? 700 : 500,
              fontSize: "var(--t-body-sm)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition:
                "background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast)",
            }}
          >
            <span data-testid={`chip-glyph-${arch.id}`} aria-hidden="true" style={{ fontSize: 14 }}>
              {arch.seal}
            </span>
            <span data-testid={`chip-name-${arch.id}`}>{arch.i18n[lang].name}</span>
          </button>
        )
      })}
    </div>
  )
}
