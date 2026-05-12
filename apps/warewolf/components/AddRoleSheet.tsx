"use client"

/**
 * <AddRoleSheet> — bottom-sheet (mobile) / sidebar (desktop ≥1024px) for
 * adding roles to the customize-page setup. 6 category tabs (Wolves / Info /
 * Power / Vanilla / Social / Neutral) derived by `mapCategoryToTab` from
 * US-008 (Eng Review decision #6). Each candidate card shows role art, name
 * (current lang), team/balance/category, and a balance delta if added to
 * the current setup.
 *
 * Multi-add discipline (per Pass 6): tapping a candidate fires `onAdd` and
 * keeps the sheet open. Dismissal is explicit — X button or Escape.
 *
 * Pre-selected initial tab (per Pass 7 "Replace button filter"): the
 * Replace flow opens this sheet with the swapped role's tab already active.
 *
 * Slide-up animation 280ms cubic-bezier(0.16, 1, 0.3, 1); reduced-motion is
 * handled globally by the `prefers-reduced-motion: reduce` rule in
 * app/globals.css zeroing out `--motion-slide`.
 *
 * Standalone — does NOT coordinate with <RoleDetailModal>; the parent route
 * owns the Replace ↔ Sheet handoff.
 */

import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { ROLES, type RoleId } from "@social-hub/content"
import { TABS, type TabKey, mapCategoryToTab } from "../lib/category-tabs"
import { CardArt } from "./CardArt"

export interface AddRoleSheetProps {
  initialTab: TabKey
  existingSetup: RoleId[]
  onAdd: (roleId: RoleId) => void
  onClose: () => void
  /** Resolved by caller via next-intl. Defaults to 'en'. */
  lang?: "en" | "th"
}

const TAB_LABEL: Record<TabKey, { en: string; th: string }> = {
  wolves: { en: "Wolves", th: "หมาป่า" },
  info: { en: "Info", th: "ข้อมูล" },
  power: { en: "Power", th: "พลัง" },
  vanilla: { en: "Vanilla", th: "พื้นฐาน" },
  social: { en: "Social", th: "สังคม" },
  neutral: { en: "Neutral", th: "เป็นกลาง" },
}

function teamChipStyle(team: "village" | "werewolf" | "neutral"): CSSProperties {
  if (team === "werewolf") {
    return { background: "var(--color-ink)", color: "var(--color-cream)", borderColor: "var(--color-ink)" }
  }
  if (team === "neutral") {
    return { background: "var(--color-ink-soft)", color: "var(--color-cream)", borderColor: "var(--color-ink-soft)" }
  }
  return { background: "var(--color-cream)", color: "var(--color-ink)", borderColor: "var(--color-ink)" }
}

function currentBalance(setup: RoleId[]): number {
  let sum = 0
  for (const id of setup) {
    const r = ROLES[id]
    if (r) sum += r.balance
  }
  return sum
}

export function AddRoleSheet({
  initialTab,
  existingSetup,
  onAdd,
  onClose,
  lang = "en",
}: AddRoleSheetProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  const baseBalance = useMemo(() => currentBalance(existingSetup), [existingSetup])

  const candidates = useMemo(
    () => Object.values(ROLES).filter((r) => mapCategoryToTab(r) === activeTab),
    [activeTab],
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === "th" ? "เพิ่มบทบาท" : "Add role"}
      data-testid="add-role-sheet"
      style={{
        background: "var(--color-parchment)",
        border: "var(--b)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-serif)",
        transform: "translateY(0)",
        transition: "transform var(--motion-slide, 280ms) cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: 560,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--s-3)",
          borderBottom: "var(--b)",
        }}
      >
        <div
          style={{
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-h3, 18px)",
          }}
        >
          {lang === "th" ? "เพิ่มบทบาท" : "Add Role"}
        </div>
        <button
          type="button"
          data-testid="add-role-close"
          aria-label={lang === "th" ? "ปิด" : "Close"}
          onClick={onClose}
          style={{
            minWidth: 44,
            minHeight: 44,
            background: "transparent",
            border: "none",
            color: "var(--color-ink)",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </header>

      <div
        role="tablist"
        aria-label={lang === "th" ? "หมวดหมู่บทบาท" : "Role categories"}
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          padding: "8px 12px",
          borderBottom: "var(--b)",
          background: "var(--color-cream)",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              data-testid={`add-role-tab-${tab}`}
              data-tab={tab}
              aria-selected={active}
              aria-controls="add-role-candidates"
              onClick={() => setActiveTab(tab)}
              style={{
                minHeight: 44,
                padding: "8px 12px",
                border: active
                  ? "1.5px solid var(--color-blood)"
                  : "1.5px solid var(--color-ink)",
                background: active ? "var(--color-blood)" : "var(--color-cream)",
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
              {TAB_LABEL[tab][lang]}
            </button>
          )
        })}
      </div>

      <div
        id="add-role-candidates"
        role="tabpanel"
        data-testid="add-role-candidates"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "var(--s-2)",
          padding: "var(--s-3)",
          overflowY: "auto",
        }}
      >
        {candidates.map((role) => {
          const delta = role.balance
          const signedDelta = delta > 0 ? `+${delta}` : String(delta)
          void baseBalance
          return (
            <button
              key={role.id}
              type="button"
              data-testid={`add-role-candidate-${role.id}`}
              onClick={() => onAdd(role.id)}
              style={{
                minHeight: 44,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 6,
                padding: "var(--s-2)",
                background: "var(--color-cream)",
                border: "var(--b)",
                color: "var(--color-ink)",
                font: "inherit",
                cursor: "pointer",
                textAlign: "left",
                transition: "transform var(--motion-fast), opacity var(--motion-fast)",
              }}
            >
              <div style={{ aspectRatio: "2 / 3", overflow: "hidden" }}>
                <CardArt roleId={role.id} size="md" />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: "var(--t-body-sm, 13px)",
                  lineHeight: 1.15,
                }}
              >
                {role.i18n[lang].name}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    border: "1px solid",
                    padding: "1px 5px",
                    fontStyle: "italic",
                    fontWeight: 600,
                    fontSize: 10,
                    lineHeight: 1.2,
                    ...teamChipStyle(role.team),
                  }}
                >
                  {role.team === "werewolf"
                    ? lang === "th"
                      ? "หมาป่า"
                      : "Wolf"
                    : role.team === "neutral"
                      ? lang === "th"
                        ? "เป็นกลาง"
                        : "Neutral"
                      : lang === "th"
                        ? "ชาวบ้าน"
                        : "Village"}
                </span>
                <span
                  data-testid={`add-role-delta-${role.id}`}
                  style={{
                    fontStyle: "italic",
                    fontWeight: 700,
                    fontSize: 12,
                    color:
                      delta > 0
                        ? "var(--color-green, #2e7d2e)"
                        : delta < 0
                          ? "var(--color-blood)"
                          : "var(--color-ink-soft)",
                    fontFeatureSettings: "'tnum' 1",
                  }}
                >
                  {signedDelta}
                </span>
              </div>
            </button>
          )
        })}
        {candidates.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "var(--s-4)",
              textAlign: "center",
              fontStyle: "italic",
              color: "var(--color-ink-soft)",
            }}
          >
            {lang === "th" ? "ไม่มีบทบาทในหมวดนี้" : "No roles in this category"}
          </div>
        )}
      </div>
    </div>
  )
}
