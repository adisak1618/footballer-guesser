"use client"

/**
 * `/[lang]/setup/customize` — Pattern D v2 (locked design review).
 *
 * Hydration source = URL (?p=, ?roles=, ?lang=) per Eng Review decision #4.
 * Mutations write back via `router.replace()` so the URL stays canonical.
 *
 * URL → state:
 *   - Out-of-range `?p` → clamped + toast (`SetupList.playerCountAdjusted`).
 *   - Unknown role IDs → silently substituted with `villager` by `decodeSetup`
 *     per Eng Review decision #3.
 *   - Truly malformed URLs (Zod throw) → fall back to default setup
 *     (p=8, 8× villager) + "imported invalid" banner per design doc 472–477.
 *
 * Layout:
 *   - Sticky top: <BalanceScale> + <PlayableBanner> (both wrap with
 *     aria-live='polite' internally; outer wrapper duplicates so SRs
 *     announce together).
 *   - Mobile (<1024px): single column card grid + bottom-sheet modals.
 *   - Desktop (≥1024px): 2-column grid; <RoleDetailModal> renders as the
 *     right-column panel instead of an overlay (per Pass 6).
 *
 * Save CTA copies the encoded share URL via navigator.clipboard.writeText,
 * with a <textarea> + execCommand('copy') fallback for insecure contexts
 * (per Eng Review failure-mode mitigation #1).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import type { CSSProperties } from "react"

import { AddRoleSheet } from "@/components/AddRoleSheet"
import { BalanceScale } from "@/components/BalanceScale"
import { CardArt } from "@/components/CardArt"
import { Container } from "@/components/Container"
import { PlayableBanner, type PlayableBannerState } from "@/components/PlayableBanner"
import { RoleDetailModal } from "@/components/RoleDetailModal"
import { decodeSetup, encodeSetup } from "@/lib/share-url"
import { useWarewolfStore } from "@/lib/store"
import { validate, type BlockerCode } from "@/lib/validator"
import { mapCategoryToTab, type TabKey } from "@/lib/category-tabs"
import { ROLES, type RoleId } from "@social-hub/content"

export default function CustomizePage() {
  return (
    <Suspense fallback={null}>
      <CustomizePageInner />
    </Suspense>
  )
}

interface RoleGroup {
  id: RoleId
  count: number
  firstIndex: number
}

function groupRoles(setup: RoleId[]): RoleGroup[] {
  const groups: RoleGroup[] = []
  for (let i = 0; i < setup.length; i++) {
    const id = setup[i]
    const existing = groups.find((g) => g.id === id)
    if (existing) existing.count++
    else groups.push({ id, count: 1, firstIndex: i })
  }
  return groups
}

function CustomizePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = useLocale() as "en" | "th"
  const t = useTranslations("Customize")
  const tList = useTranslations("SetupList")

  const playerCount = useWarewolfStore((s) => s.playerCount)
  const currentSetup = useWarewolfStore((s) => s.currentSetup)
  const setPlayerCount = useWarewolfStore((s) => s.setPlayerCount)
  const setCurrentSetup = useWarewolfStore((s) => s.setCurrentSetup)
  const setLang = useWarewolfStore((s) => s.setLang)

  const [hydrated, setHydrated] = useState(false)
  const [clampToast, setClampToast] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [importedInvalid, setImportedInvalid] = useState(false)

  // Modal / sheet state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetInitialTab, setSheetInitialTab] = useState<TabKey>("info")
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null)

  // Hydrate from URL on mount.
  useEffect(() => {
    try {
      const decoded = decodeSetup(searchParams.toString())
      setPlayerCount(decoded.playerCount)
      setCurrentSetup(decoded.roles)
      setLang(decoded.lang)
      if (decoded.clampedP) {
        setClampToast(tList("playerCountAdjusted", { N: decoded.playerCount }))
        setTimeout(() => setClampToast(null), 3500)
      }
    } catch {
      // Zod threw — default setup + banner.
      setPlayerCount(8)
      setCurrentSetup(Array(8).fill("villager") as RoleId[])
      setImportedInvalid(true)
    }
    setHydrated(true)
    // Intentionally only on mount — URL drives initial state once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push state back to URL on every mutation after hydration.
  useEffect(() => {
    if (!hydrated) return
    const params = encodeSetup({
      playerCount,
      roles: currentSetup,
      lang,
    })
    router.replace(`/${lang}/setup/customize?${params.toString()}`, {
      scroll: false,
    })
  }, [hydrated, playerCount, currentSetup, lang, router])

  // Escape closes any open modal/sheet (per Pass 6).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (sheetOpen) {
        setSheetOpen(false)
        setReplacingIndex(null)
      } else if (selectedIndex !== null) {
        setSelectedIndex(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sheetOpen, selectedIndex])

  // Memoized validation — avoids recomputing on unrelated re-renders.
  const result = useMemo(
    () => validate(currentSetup, playerCount),
    [currentSetup, playerCount],
  )

  const bannerState: PlayableBannerState = useMemo(() => {
    if (!result.ok) return "not-playable"
    if (result.balance > 2 || result.balance < -2) return "warn"
    return "playable"
  }, [result])

  const reasonText = useMemo(
    () => computeReason(result.blockers, result, playerCount, currentSetup.length, t),
    [result, playerCount, currentSetup.length, t],
  )

  const handleAddRole = useCallback(
    (id: RoleId) => {
      if (replacingIndex !== null) {
        const next = [...currentSetup]
        next[replacingIndex] = id
        setCurrentSetup(next)
        setReplacingIndex(null)
        setSheetOpen(false)
        setSelectedIndex(null)
      } else {
        if (currentSetup.length >= playerCount) {
          // Shouldn't really happen since Add Role tile is gated, but be safe.
          return
        }
        setCurrentSetup([...currentSetup, id])
      }
    },
    [currentSetup, playerCount, replacingIndex, setCurrentSetup],
  )

  const handleDelete = useCallback(
    (idx: number) => {
      const next = currentSetup.filter((_, i) => i !== idx)
      setCurrentSetup(next)
      setSelectedIndex(null)
    },
    [currentSetup, setCurrentSetup],
  )

  const handleReplace = useCallback(
    (idx: number) => {
      const role = ROLES[currentSetup[idx]]
      if (role) setSheetInitialTab(mapCategoryToTab(role))
      setReplacingIndex(idx)
      setSheetOpen(true)
    },
    [currentSetup],
  )

  const handleOpenAddSheet = useCallback(() => {
    setReplacingIndex(null)
    setSheetInitialTab("info")
    setSheetOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!result.ok) return
    const params = encodeSetup({ playerCount, roles: currentSetup, lang })
    const fullUrl = `${window.location.origin}/${lang}/setup/customize?${params.toString()}`
    let fallback = false
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard api")
      await navigator.clipboard.writeText(fullUrl)
    } catch {
      fallback = true
      copyViaTextarea(fullUrl)
    }
    setSaveToast(fallback ? "Link copied (fallback)" : "Link copied · คัดลอกลิงก์แล้ว")
    setTimeout(() => setSaveToast(null), 3000)
  }, [result.ok, playerCount, currentSetup, lang])

  const groups = useMemo(() => groupRoles(currentSetup), [currentSetup])
  const emptySlots = Math.max(0, playerCount - currentSetup.length)
  const otherLang = lang === "th" ? "en" : "th"
  const otherLangLabel = otherLang === "th" ? "ไทย" : "EN"

  return (
    <main
      data-testid="customize-page"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--color-parchment)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-serif)",
      }}
    >
      <header
        style={{
          borderBottom: "var(--b)",
          background: "var(--color-parchment)",
        }}
      >
      <Container
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--s-3) var(--s-4)",
        }}
      >
        <Link
          href={`/${lang}/setup`}
          data-testid="customize-back"
          aria-label={tList("backAria")}
          style={{
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 14,
            color: "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          <span style={{ color: "var(--color-blood)", paddingRight: 4 }}>◂</span>
          {t("backToSetups")}
        </Link>
        <div
          data-testid="customize-title"
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          {t("title")}
        </div>
        <Link
          href={`/${otherLang}/setup/customize?${toggleParamsFor(searchParams, otherLang)}`}
          data-testid="customize-lang-toggle"
          style={{
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          {otherLangLabel}
        </Link>
      </Container>
      </header>

      {importedInvalid ? (
        <div
          style={{
            background: "var(--color-blood-bg)",
            borderBottom: "2px solid var(--color-blood)",
          }}
        >
          <Container
            testId="customize-imported-invalid"
            style={{
              padding: "10px 14px",
              color: "#5a1818",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {t("importedInvalid")}
          </Container>
        </div>
      ) : null}

      {/* Sticky top — balance + banner. Both components already set
          aria-live='polite' internally; the outer wrapper groups them. */}
      <div
        data-testid="customize-balance-block"
        aria-live="polite"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "var(--color-cream)",
          borderBottom: "var(--b)",
        }}
      >
        <Container>
          <BalanceScale
            wolfSum={result.wolfSum}
            villageSum={result.villageSum}
            balance={result.balance}
            hasBlocker={!result.ok}
          />
          <div style={{ padding: "0 var(--s-4) var(--s-3)" }}>
            <PlayableBanner state={bannerState} reason={reasonText} />
          </div>
        </Container>
      </div>

      {/* Body: card grid (LEFT on desktop ≥1024px, full-width on mobile) +
          detail panel (RIGHT on desktop, overlay on mobile).
          Grid-template-columns lives in globals.css `.customize-body` so the
          media query can switch it; inline style cannot host media queries. */}
      <Container
        className="customize-body"
        style={{
          flex: 1,
          padding: "var(--s-3) var(--s-4) calc(var(--s-5) + 56px)",
          display: "grid",
          gap: "var(--s-4)",
        }}
        testId="customize-body"
      >
        {/* Card grid column */}
        <section
          data-testid="customize-card-grid"
          aria-label={t("title")}
          style={{ minWidth: 0 }}
        >
          {/* Section header — N of M */}
          <div
            data-testid="customize-grid-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "0 2px var(--s-2)",
            }}
          >
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 12,
                color: "var(--color-blood)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              {t("title")}
            </span>
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: 12,
                color: "var(--color-ink-muted)",
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              {currentSetup.length} / {playerCount}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
            }}
          >
            {groups.map((g) => (
              <RoomCardButton
                key={`${g.id}-${g.firstIndex}`}
                roleId={g.id}
                count={g.count}
                onTap={() => setSelectedIndex(g.firstIndex)}
                lang={lang}
              />
            ))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                data-testid="customize-empty-slot"
                onClick={handleOpenAddSheet}
                aria-label={t("emptySlot")}
                style={emptyTileStyle}
              >
                <span style={emptyGlyphStyle}>?</span>
                <span style={emptyLabelStyle}>{t("emptySlot")}</span>
              </button>
            ))}

            {/* Add Role tile always at end of grid */}
            <button
              type="button"
              data-testid="customize-add-tile"
              onClick={handleOpenAddSheet}
              disabled={currentSetup.length >= playerCount}
              aria-label={t("addRole")}
              style={{
                ...emptyTileStyle,
                opacity: currentSetup.length >= playerCount ? 0.55 : 1,
                cursor: currentSetup.length >= playerCount ? "not-allowed" : "pointer",
              }}
            >
              <span style={emptyGlyphStyle}>+</span>
              <span style={emptyLabelStyle}>{t("addRole")}</span>
            </button>
          </div>
        </section>

        {/* Detail column — desktop only. RoleDetailModal in side-panel mode. */}
        <aside
          data-testid="customize-detail-panel"
          className="customize-detail-panel"
          aria-label={t("title")}
          style={{ minWidth: 0 }}
        >
          {selectedIndex !== null && currentSetup[selectedIndex] ? (
            <RoleDetailModal
              roleId={currentSetup[selectedIndex]}
              slotIndex={selectedIndex}
              onReplace={handleReplace}
              onDelete={handleDelete}
              onClose={() => setSelectedIndex(null)}
              lang={lang}
            />
          ) : (
            <div
              style={{
                padding: "var(--s-4)",
                border: "var(--b)",
                background: "var(--color-cream)",
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--color-ink-muted)",
                textAlign: "center",
              }}
            >
              {t("tapCardHint")}
            </div>
          )}
        </aside>
      </Container>

      {/* Sticky bottom Save CTA */}
      <footer
        data-testid="customize-cta-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          borderTop: "var(--b)",
          background: "var(--color-cream)",
          zIndex: 3,
        }}
      >
      <Container
        style={{
          padding: "8px 14px",
          display: "flex",
          gap: 6,
        }}
      >
        <button
          type="button"
          data-testid="customize-save-btn"
          onClick={handleSave}
          disabled={!result.ok}
          aria-disabled={!result.ok}
          style={{
            flex: 1,
            minHeight: 44,
            padding: 10,
            border: result.ok
              ? "1px solid var(--color-blood)"
              : "1px solid var(--color-ink-soft)",
            background: result.ok ? "var(--color-blood)" : "var(--color-cream-2)",
            color: result.ok ? "var(--color-cream)" : "var(--color-ink-faint)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 15,
            cursor: result.ok ? "pointer" : "not-allowed",
          }}
        >
          {t("saveSetup")}
        </button>
      </Container>
      </footer>

      {/* Mobile overlay: RoleDetailModal */}
      {selectedIndex !== null && currentSetup[selectedIndex] ? (
        <div
          className="customize-detail-overlay"
          data-testid="customize-detail-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIndex(null)
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,22,18,.55)",
            zIndex: 10,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <RoleDetailModal
            roleId={currentSetup[selectedIndex]}
            slotIndex={selectedIndex}
            onReplace={handleReplace}
            onDelete={handleDelete}
            onClose={() => setSelectedIndex(null)}
            lang={lang}
          />
        </div>
      ) : null}

      {/* AddRoleSheet (mobile bottom-sheet / desktop side per Pass 6).
          Standalone — caller owns Replace ↔ Sheet wiring. */}
      {sheetOpen ? (
        <div
          data-testid="customize-sheet-scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSheetOpen(false)
              setReplacingIndex(null)
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,22,18,.55)",
            zIndex: 11,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <AddRoleSheet
            initialTab={sheetInitialTab}
            existingSetup={currentSetup}
            onAdd={handleAddRole}
            onClose={() => {
              setSheetOpen(false)
              setReplacingIndex(null)
            }}
            lang={lang}
          />
        </div>
      ) : null}

      {clampToast !== null ? (
        <div
          data-testid="customize-clamp-toast"
          role="status"
          aria-live="polite"
          style={toastStyle}
        >
          {clampToast}
        </div>
      ) : null}

      {saveToast !== null ? (
        <div
          data-testid="customize-save-toast"
          role="status"
          aria-live="polite"
          style={toastStyle}
        >
          {saveToast}
        </div>
      ) : null}

    </main>
  )
}

interface RoomCardButtonProps {
  roleId: RoleId
  count: number
  onTap: () => void
  lang: "en" | "th"
}

function RoomCardButton({ roleId, count, onTap, lang }: RoomCardButtonProps) {
  const role = ROLES[roleId]
  const isWolf = role.team === "werewolf"
  const isNeutral = role.team === "neutral"
  const signed = role.balance > 0 ? `+${role.balance}` : String(role.balance)

  return (
    <button
      type="button"
      data-testid="customize-card"
      data-role-id={roleId}
      onClick={onTap}
      aria-label={role.i18n[lang].name}
      style={{
        position: "relative",
        aspectRatio: "2 / 3",
        border: "1.5px solid var(--color-ink)",
        background: "var(--color-cream)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        padding: 0,
        fontFamily: "var(--font-serif)",
      }}
    >
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <CardArt roleId={roleId} size="md" />
      </div>
      <div
        style={{
          padding: "2px 3px",
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: 9,
          lineHeight: 1.1,
          textAlign: "center",
          color: "var(--color-ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          background: "var(--color-cream)",
          borderTop: "1px solid var(--color-ink)",
        }}
      >
        {role.i18n[lang].name}
      </div>
      <div
        data-testid="customize-card-balance"
        style={{
          position: "absolute",
          bottom: 16,
          right: 3,
          background: isWolf
            ? "var(--color-blood)"
            : isNeutral
              ? "var(--color-ink-soft)"
              : "var(--color-ink)",
          color: "var(--color-cream)",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 10,
          lineHeight: 1,
          padding: "2px 3px",
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {signed}
      </div>
      {count > 1 ? (
        <div
          data-testid="customize-card-count"
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            background: "var(--color-blood)",
            color: "var(--color-cream)",
            width: 20,
            height: 20,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 10,
            lineHeight: 1,
            border: "1.5px solid var(--color-ink)",
          }}
        >
          ×{count}
        </div>
      ) : null}
    </button>
  )
}

function computeReason(
  blockers: BlockerCode[],
  result: ReturnType<typeof validate>,
  playerCount: number,
  setupSize: number,
  t: ReturnType<typeof useTranslations<"Customize">>,
): string {
  if (blockers.length > 0) {
    const b = blockers[0]
    if (b === "no-wolves") return t("reasonNoWolves")
    if (b === "wolves-gte-village")
      return t("reasonTooManyWolves", {
        W: result.wolfCount,
        V: result.villageCount,
      })
    if (b === "role-count-mismatch")
      return t("reasonRoleCount", { X: Math.abs(playerCount - setupSize) })
    if (b === "unknown-role") return t("reasonRoleCount", { X: 1 })
  }
  if (result.balance > 2) return t("reasonTiltVillage")
  if (result.balance < -2) return t("reasonTiltWolf")
  if (result.balance > 0) return t("reasonVillageEdge")
  if (result.balance < 0) return t("reasonWolfEdge")
  return t("reasonBalanced")
}

/**
 * Build the share-URL query string for the locale-toggle link. Preserves
 * setup state (p, roles) but overrides `lang` to match the new segment.
 * Without this, the inherited `?lang=` would disagree with the new segment
 * and trigger the locale-precedence middleware to 301-redirect back to the
 * original locale (per Eng Review decision #5).
 */
function toggleParamsFor(
  searchParams: URLSearchParams,
  targetLang: "en" | "th",
): string {
  const next = new URLSearchParams(searchParams)
  next.set("lang", targetLang)
  return next.toString()
}

function copyViaTextarea(text: string) {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"
  ta.style.top = "0"
  ta.style.left = "0"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    document.execCommand("copy")
  } catch {
    // No reasonable recovery.
  }
  document.body.removeChild(ta)
}

const emptyTileStyle: CSSProperties = {
  position: "relative",
  aspectRatio: "2 / 3",
  border: "1.5px dashed var(--color-blood)",
  background:
    "repeating-linear-gradient(45deg, var(--color-cream), var(--color-cream) 4px, var(--color-parchment) 4px, var(--color-parchment) 8px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  cursor: "pointer",
  color: "var(--color-blood)",
  fontFamily: "var(--font-serif)",
  padding: 0,
}

const emptyGlyphStyle: CSSProperties = {
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: 24,
  lineHeight: 1,
}

const emptyLabelStyle: CSSProperties = {
  fontStyle: "italic",
  fontWeight: 500,
  fontSize: 9,
  color: "var(--color-ink)",
  textAlign: "center",
  lineHeight: 1.1,
  padding: "0 4px",
}

const toastStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 72,
  transform: "translateX(-50%)",
  padding: "var(--s-2) var(--s-4)",
  border: "var(--b)",
  background: "var(--color-ink)",
  color: "var(--color-cream)",
  fontStyle: "italic",
  fontSize: 13,
  maxWidth: "90vw",
  textAlign: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,.2)",
  zIndex: 20,
}
