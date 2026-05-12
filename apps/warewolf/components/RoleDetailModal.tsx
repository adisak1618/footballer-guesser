"use client"

/**
 * <RoleDetailModal> — tapping a role on /setup/customize opens this. Shows
 * the full card art (lg), name in current language, team/balance/category
 * badges, the role's mechanic description, and two action buttons:
 * Replace (opens <AddRoleSheet> pre-filtered to the swapped role's tab per
 * Pass 7) and Delete (removes the role from the setup).
 *
 * Layout per design doc lines 511–516. Per Pass 6:
 *   - Mobile: bottom-sheet modal (slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)).
 *   - Desktop ≥1024px: sticky right-column panel (caller positions; this
 *     component renders the same body either way; the wrapper uses a CSS
 *     media query to switch from `position: fixed` bottom-sheet to a static
 *     in-flow card).
 *
 * Escape closes (handler on `window` while mounted). Focus traps inside the
 * dialog by initial-focusing the Replace button; restoring focus on close is
 * the caller's responsibility (they own the trigger element). Reduced motion
 * is handled globally by the `prefers-reduced-motion: reduce` rule in
 * app/globals.css zeroing out `--motion-slide`.
 *
 * Reused by /setup/customize (US-021). Standalone component — does NOT
 * coordinate with <AddRoleSheet> directly; the parent route owns the
 * Replace flow.
 */

import { useEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { ROLES, type RoleId } from "@social-hub/content"
import { CardArt } from "./CardArt"

export interface RoleDetailModalProps {
  roleId: RoleId
  slotIndex: number
  onReplace: (slotIndex: number) => void
  onDelete: (slotIndex: number) => void
  onClose: () => void
  /** Resolved by caller via next-intl. Defaults to 'en'. */
  lang?: "en" | "th"
}

const TEAM_LABEL: Record<"village" | "werewolf" | "neutral", { en: string; th: string }> = {
  village: { en: "Village", th: "ชาวบ้าน" },
  werewolf: { en: "Wolf", th: "หมาป่า" },
  neutral: { en: "Neutral", th: "เป็นกลาง" },
}

const CATEGORY_LABEL: Record<string, { en: string; th: string }> = {
  info: { en: "Info", th: "ข้อมูล" },
  protection: { en: "Protection", th: "ป้องกัน" },
  kill: { en: "Kill", th: "ฆ่า" },
  vote: { en: "Vote", th: "โหวต" },
  chaos: { en: "Chaos", th: "ป่วน" },
  vanilla: { en: "Vanilla", th: "พื้นฐาน" },
  neutral: { en: "Neutral", th: "เป็นกลาง" },
}

function teamBadgeStyle(team: "village" | "werewolf" | "neutral"): CSSProperties {
  if (team === "werewolf") {
    return { background: "var(--color-ink)", color: "var(--color-cream)", borderColor: "var(--color-ink)" }
  }
  if (team === "neutral") {
    return { background: "var(--color-ink-soft)", color: "var(--color-cream)", borderColor: "var(--color-ink-soft)" }
  }
  return { background: "var(--color-cream)", color: "var(--color-ink)", borderColor: "var(--color-ink)" }
}

const BADGE_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "var(--b)",
  padding: "4px 8px",
  fontStyle: "italic",
  fontWeight: 600,
  fontSize: "var(--t-body-sm)",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
}

export function RoleDetailModal({
  roleId,
  slotIndex,
  onReplace,
  onDelete,
  onClose,
  lang = "en",
}: RoleDetailModalProps) {
  const role = ROLES[roleId]
  const dialogRef = useRef<HTMLDivElement>(null)
  const replaceBtnRef = useRef<HTMLButtonElement>(null)

  // Escape closes; focus initial Replace button on mount.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "Tab") {
        // Lightweight focus trap: cycle Tab/Shift+Tab within dialog buttons.
        const root = dialogRef.current
        if (!root) return
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    replaceBtnRef.current?.focus()
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const signedBalance = role.balance > 0 ? `+${role.balance}` : String(role.balance)
  const teamLabel = TEAM_LABEL[role.team][lang]
  const categoryLabel = CATEGORY_LABEL[role.category]?.[lang] ?? role.category
  const replaceLabel = "Replace · เปลี่ยน"
  const deleteLabel = "Delete · ลบ"

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-detail-name"
      data-testid="role-detail-modal"
      data-slot-index={slotIndex}
      style={{
        background: "var(--color-parchment)",
        border: "var(--b)",
        padding: "var(--s-4)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-serif)",
        transform: "translateY(0)",
        transition: "transform var(--motion-slide, 280ms) cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: 480,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--s-3)",
          alignItems: "flex-start",
          marginBottom: "var(--s-3)",
        }}
      >
        <div style={{ flexShrink: 0, width: 160 }}>
          <CardArt roleId={roleId} size="lg" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            id="role-detail-name"
            data-testid="role-detail-name"
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: "var(--t-h2, 22px)",
              lineHeight: 1.15,
              marginBottom: 6,
            }}
          >
            {role.i18n[lang].name}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: "var(--s-2)",
            }}
          >
            <span
              data-testid="role-detail-badge-team"
              style={{ ...BADGE_BASE, ...teamBadgeStyle(role.team) }}
            >
              {teamLabel}
            </span>
            <span
              data-testid="role-detail-badge-balance"
              style={{
                ...BADGE_BASE,
                background:
                  role.balance > 0
                    ? "var(--color-green, #2e7d2e)"
                    : role.balance < 0
                      ? "var(--color-blood)"
                      : "var(--color-ink-soft)",
                color: "var(--color-cream)",
                borderColor: "transparent",
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              {signedBalance}
            </span>
            <span
              data-testid="role-detail-badge-category"
              style={{
                ...BADGE_BASE,
                background: "var(--color-cream)",
                color: "var(--color-ink)",
                borderColor: "var(--color-ink-soft)",
              }}
            >
              {categoryLabel}
            </span>
          </div>
        </div>
      </div>

      <p
        data-testid="role-detail-description"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--t-body, 14px)",
          lineHeight: 1.45,
          color: "var(--color-ink)",
          marginBottom: "var(--s-4)",
        }}
      >
        {role.i18n[lang].description}
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--s-2)",
          flexDirection: "row",
        }}
      >
        <button
          ref={replaceBtnRef}
          type="button"
          data-testid="role-detail-replace"
          onClick={() => onReplace(slotIndex)}
          style={{
            flex: 1,
            minHeight: 44,
            padding: "10px 14px",
            border: "var(--b)",
            background: "var(--color-cream)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-body)",
            cursor: "pointer",
          }}
        >
          {replaceLabel}
        </button>
        <button
          type="button"
          data-testid="role-detail-delete"
          onClick={() => onDelete(slotIndex)}
          style={{
            flex: 1,
            minHeight: 44,
            padding: "10px 14px",
            border: "1.5px solid var(--color-blood)",
            background: "var(--color-blood)",
            color: "var(--color-cream)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "var(--t-body)",
            cursor: "pointer",
          }}
        >
          {deleteLabel}
        </button>
      </div>
    </div>
  )
}
