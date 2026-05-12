"use client"

/**
 * <RoleCardThumb> — mini card-art thumbnail used in dense lists.
 *
 * Wraps <CardArt size="sm"> with a Grimoire-styled count badge (blood-red
 * wax-seal circle, top-right) and an optional bottom-fade name overlay so the
 * card stays self-labeled at glance. Used by <SetupCard> on /setup to replace
 * the previous text chip block; the same component is reusable for any future
 * dense role-list surface.
 *
 * Approved direction: ~/.gstack/projects/board-game/designs/
 *   warewolf-setup-list-cards-20260513/approved.json (variant A · Mini Card Strip).
 */

import { ROLES, type RoleId } from "@social-hub/content"
import { CardArt } from "./CardArt"

export interface RoleCardThumbProps {
  roleId: RoleId
  /** Render count badge when > 1. Defaults to 1 (no badge). */
  count?: number
  /** Selected language for alt + name overlay. Defaults to 'en'. */
  lang?: "en" | "th"
  /** Render the bottom-fade name overlay inside the card. Defaults to true. */
  showNameOverlay?: boolean
  /** Width in px. Defaults to 48 (mobile baseline). */
  width?: number
}

export function RoleCardThumb({
  roleId,
  count = 1,
  lang = "en",
  showNameOverlay = true,
  width = 48,
}: RoleCardThumbProps) {
  const role = ROLES[roleId]
  if (!role) return null
  const name = role.i18n[lang].name
  const ariaLabel = count > 1 ? `${name}, ${count} copies` : name

  return (
    <span
      data-testid={`role-card-thumb-${roleId}`}
      data-role={roleId}
      data-count={count}
      role="img"
      aria-label={ariaLabel}
      style={{
        position: "relative",
        display: "inline-block",
        width,
        aspectRatio: "2 / 3",
        border: "var(--b)",
        background: "var(--color-cream)",
        flex: `0 0 ${width}px`,
        overflow: "hidden",
        lineHeight: 0,
      }}
    >
      <CardArt roleId={roleId} size="sm" />
      {showNameOverlay ? (
        <span
          data-testid={`role-card-thumb-name-${roleId}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "auto 0 0 0",
            background:
              "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.55) 60%, transparent 100%)",
            color: "var(--color-cream)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 8,
            lineHeight: 1.1,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            textAlign: "center",
            padding: "6px 1px 2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
      ) : null}
      {count > 1 ? (
        <span
          data-testid={`role-card-thumb-badge-${roleId}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            width: 18,
            height: 18,
            background: "var(--color-blood)",
            color: "var(--color-cream)",
            border: "1px solid var(--color-ink)",
            borderRadius: "50%",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFeatureSettings: "'tnum' 1",
            zIndex: 1,
          }}
        >
          {count}
        </span>
      ) : null}
    </span>
  )
}
