"use client"

/**
 * <CardArt> — renders a role's card art via next/image, with a Grimoire-styled
 * placeholder fallback on 404 / load failure.
 *
 * Card art source: packages/content/card-art/<roleId>.webp (built by US-012's
 * Sharp pipeline) → exposed at /cards/<roleId>.webp per the public-symlink
 * strategy. Per Eng Review decision #2's failure-mode mitigation, a 404 must
 * never surface the browser's broken-image icon — <CardArtPlaceholder> is the
 * real fallback that ships visual identity.
 *
 * Reused by: SetupCard (US-016), RoleDetailModal (US-017), landing card-fan
 * (US-019), customize grid (US-021).
 */

import Image from "next/image"
import { useState } from "react"
import { ROLES, cardArtPath, type RoleId } from "@social-hub/content"

export type CardArtSize = "sm" | "md" | "lg"

/**
 * Pixel dimensions per size token. Aspect ratio is locked to 2:3 to match the
 * prototype's `.card{ aspect-ratio:2/3 }` (finalized.html:164). The actual
 * rendered size on screen is layout-driven; these values feed next/image's
 * sizing hints and the placeholder's intrinsic box.
 */
const SIZE_PX: Record<CardArtSize, { w: number; h: number }> = {
  sm: { w: 60, h: 90 },
  md: { w: 84, h: 126 },
  lg: { w: 240, h: 360 },
}

export interface CardArtProps {
  roleId: RoleId
  size?: CardArtSize
  /** Pass true for above-the-fold cards (e.g. landing card-fan in US-019). */
  priority?: boolean
}

export function CardArt({ roleId, size = "md", priority = false }: CardArtProps) {
  const [errored, setErrored] = useState(false)
  const dims = SIZE_PX[size]
  const role = ROLES[roleId]

  if (errored) {
    return <CardArtPlaceholder roleId={roleId} size={size} />
  }

  return (
    <Image
      src={cardArtPath(roleId)}
      alt={role.i18n.en.name}
      width={dims.w}
      height={dims.h}
      priority={priority}
      onError={() => setErrored(true)}
      data-testid="card-art-image"
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
    />
  )
}

export interface CardArtPlaceholderProps {
  roleId: RoleId
  size?: CardArtSize
}

export function CardArtPlaceholder({ roleId, size = "md" }: CardArtPlaceholderProps) {
  const role = ROLES[roleId]
  const dims = SIZE_PX[size]
  const sealColor =
    role.team === "werewolf"
      ? "var(--color-blood)"
      : role.team === "neutral"
        ? "var(--color-ink-soft)"
        : "var(--color-blood-dim)"
  const badgeBg =
    role.team === "werewolf"
      ? "var(--color-blood)"
      : role.team === "neutral"
        ? "var(--color-ink-soft)"
        : "var(--color-ink)"
  const balanceLabel = role.balance > 0 ? `+${role.balance}` : String(role.balance)

  return (
    <div
      role="img"
      aria-label={`${role.i18n.en.name} (placeholder)`}
      data-testid="card-art-placeholder"
      style={{
        width: dims.w,
        height: dims.h,
        background: "var(--color-cream)",
        border: "1.5px solid var(--color-ink)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-serif)",
        color: "var(--color-ink)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        data-role="seal"
        style={{
          width: "44%",
          aspectRatio: "1 / 1",
          background: sealColor,
          borderRadius: "50%",
          opacity: 0.78,
          boxShadow: "inset 0 0 0 2px var(--color-cream), 0 1px 2px rgba(26,22,18,.3)",
          marginBottom: 6,
        }}
      />
      <div
        style={{
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: 12,
          textAlign: "center",
          padding: "0 4px",
          lineHeight: 1.1,
          maxWidth: "92%",
        }}
      >
        {role.i18n.en.name}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          background: badgeBg,
          color: "var(--color-cream)",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 11,
          padding: "2px 5px",
          border: "1px solid var(--color-cream)",
          lineHeight: 1,
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {balanceLabel}
      </div>
    </div>
  )
}
