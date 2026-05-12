"use client"

/**
 * `/[lang]/setup` — merged picker + variations page.
 *
 * Behavior locked by US-020 + design-doc reconciliation:
 *   - One scrollable list of every (archetype × variation) for the current
 *     player count, sorted by |balance| ASC (lib/solver.ts `computeSetupList`).
 *   - Archetype chips filter the list. Empty filter = show all in-range.
 *   - Tap any setup card → /[lang]/setup/customize?p=&roles=.
 *   - URL `?p=` is canonical for shareability. Out-of-range values clamp
 *     to [5,20] and surface a toast (Pass 2). In-range URL `?p=` syncs into
 *     the Zustand store so the stepper, chips, and list all agree.
 *   - No "Re-roll" / "Open Selected" buttons — removed per reconciliation.
 */

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { ArchetypeChipStrip } from "@/components/ArchetypeChipStrip"
import { Container } from "@/components/Container"
import { SetupCard } from "@/components/SetupCard"
import { SolverErrorRow } from "@/components/SolverErrorRow"
import { computeSetupList, isSolverError, type Setup } from "@/lib/solver"
import { encodeSetup } from "@/lib/share-url"
import { useWarewolfStore } from "@/lib/store"

const MIN_PLAYERS = 5
const MAX_PLAYERS = 20

function clampPlayerCount(raw: number): number {
  if (!Number.isFinite(raw)) return 8
  if (raw < MIN_PLAYERS) return MIN_PLAYERS
  if (raw > MAX_PLAYERS) return MAX_PLAYERS
  return Math.trunc(raw)
}

export default function SetupListPage() {
  return (
    <Suspense fallback={null}>
      <SetupListPageInner />
    </Suspense>
  )
}

function SetupListPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = useLocale() as "en" | "th"
  const t = useTranslations("SetupList")

  const playerCount = useWarewolfStore((s) => s.playerCount)
  const activeFilters = useWarewolfStore((s) => s.activeFilters)
  const setPlayerCount = useWarewolfStore((s) => s.setPlayerCount)
  const toggleArchetypeFilter = useWarewolfStore(
    (s) => s.toggleArchetypeFilter,
  )

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedP = useRef<string | null>(null)

  // Sync URL ?p= into the store on mount + whenever the URL changes.
  // Clamp out-of-range values and surface a toast per Pass 2.
  useEffect(() => {
    const pRaw = searchParams.get("p")
    if (pRaw === lastSyncedP.current) return
    lastSyncedP.current = pRaw
    if (pRaw === null) return

    const asNum = Number(pRaw)
    const clamped = clampPlayerCount(asNum)
    const outOfRange =
      !Number.isInteger(asNum) || asNum < MIN_PLAYERS || asNum > MAX_PLAYERS

    if (clamped !== playerCount) setPlayerCount(clamped)

    if (outOfRange) {
      setToast(t("playerCountAdjusted", { N: clamped }))
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(null), 4000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, t])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const setupList = useMemo(
    () => computeSetupList(playerCount, activeFilters),
    [playerCount, activeFilters],
  )

  function decrement() {
    if (playerCount > MIN_PLAYERS) setPlayerCount(playerCount - 1)
  }
  function increment() {
    if (playerCount < MAX_PLAYERS) setPlayerCount(playerCount + 1)
  }

  function onTapSetup(setup: Setup) {
    const params = encodeSetup({
      playerCount,
      roles: setup.roles,
      lang,
    })
    router.push(`/${lang}/setup/customize?${params.toString()}`)
  }

  const otherLang = lang === "en" ? "th" : "en"
  const selectedLangLabel = lang === "en" ? "EN" : "ไทย"
  const atMin = playerCount <= MIN_PLAYERS
  const atMax = playerCount >= MAX_PLAYERS

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-parchment)",
        color: "var(--color-ink)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-serif)",
      }}
    >
      <header
        style={{
          borderBottom: "var(--b)",
          background: "var(--color-cream)",
          flexShrink: 0,
        }}
      >
        <Container
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-4)",
          }}
        >
        <Link
          href={`/${lang}`}
          data-testid="setup-back-home"
          aria-label={t("backAria")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
            color: "var(--color-ink)",
            textDecoration: "none",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-body)",
          }}
        >
          ‹
        </Link>
        <h1
          data-testid="setup-page-title"
          style={{
            flex: 1,
            margin: 0,
            textAlign: "center",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "var(--t-h)",
            letterSpacing: ".01em",
          }}
        >
          {t("pageTitle")}
        </h1>
        <Link
          href={`/${otherLang}/setup`}
          data-testid="setup-lang-toggle"
          hrefLang={otherLang}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
            padding: "0 var(--s-2)",
            border: "var(--b)",
            background: "var(--color-cream)",
            color: "var(--color-ink)",
            textDecoration: "none",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-body-sm)",
          }}
        >
          {selectedLangLabel}
        </Link>
        </Container>
      </header>

      <section
        style={{
          borderBottom: "var(--b)",
          background: "var(--color-parchment)",
        }}
      >
        <Container style={{ padding: "var(--s-4) var(--s-4) var(--s-3)" }}>
        <p
          data-testid="setup-subhead"
          style={{
            margin: 0,
            fontStyle: "italic",
            fontSize: "var(--t-body-sm)",
            color: "var(--color-ink-soft)",
            lineHeight: 1.4,
          }}
        >
          {t("pickerSubhead", { N: playerCount })}
        </p>

        <div
          data-testid="player-count-stepper"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--s-3)",
            marginTop: "var(--s-3)",
          }}
        >
          <button
            type="button"
            onClick={decrement}
            disabled={atMin}
            aria-label={t("decreaseAria")}
            data-testid="stepper-decrease"
            style={{
              minWidth: 44,
              minHeight: 44,
              border: "var(--b)",
              background: atMin ? "var(--color-cream-2)" : "var(--color-cream)",
              color: atMin ? "var(--color-ink-faint)" : "var(--color-ink)",
              cursor: atMin ? "not-allowed" : "pointer",
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              fontSize: "var(--t-h)",
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            −
          </button>
          <div
            data-testid="player-count-display"
            aria-live="polite"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 88,
            }}
          >
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "var(--t-display-sm)",
                fontFeatureSettings: "'tnum' 1",
                lineHeight: 1,
              }}
            >
              {playerCount}
            </span>
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: "var(--t-micro)",
                color: "var(--color-ink-muted)",
                letterSpacing: ".04em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {t("stepperLabel")}
            </span>
          </div>
          <button
            type="button"
            onClick={increment}
            disabled={atMax}
            aria-label={t("increaseAria")}
            data-testid="stepper-increase"
            style={{
              minWidth: 44,
              minHeight: 44,
              border: "var(--b)",
              background: atMax ? "var(--color-cream-2)" : "var(--color-cream)",
              color: atMax ? "var(--color-ink-faint)" : "var(--color-ink)",
              cursor: atMax ? "not-allowed" : "pointer",
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              fontSize: "var(--t-h)",
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            +
          </button>
        </div>
        </Container>
      </section>

      <div
        style={{
          borderBottom: "var(--b)",
          background: "var(--color-parchment)",
          flexShrink: 0,
        }}
      >
        <Container>
          <ArchetypeChipStrip
            playerCount={playerCount}
            activeFilters={activeFilters}
            onChange={(next) => {
              // Diff and toggle each changed id; the store owns the set.
              const current = activeFilters
              for (const id of next) if (!current.has(id)) toggleArchetypeFilter(id)
              for (const id of current) if (!next.has(id)) toggleArchetypeFilter(id)
            }}
            lang={lang}
          />
        </Container>
      </div>

      <section
        data-testid="setup-list"
        style={{
          flex: 1,
          overflowY: "auto",
        }}
      >
        <Container style={{ padding: "var(--s-3) var(--s-4) var(--s-5)" }}>
        {setupList.length === 0 ? (
          <p
            data-testid="setup-list-empty"
            style={{
              fontStyle: "italic",
              color: "var(--color-ink-muted)",
              textAlign: "center",
              padding: "var(--s-5) 0",
            }}
          >
            —
          </p>
        ) : (
          setupList.map((item) => {
            if (isSolverError(item)) {
              return (
                <div
                  key={`err-${item.archetypeId}`}
                  style={{ marginBottom: "var(--s-3)" }}
                >
                  <SolverErrorRow
                    archetypeId={item.archetypeId}
                    playerCount={item.playerCount}
                  />
                </div>
              )
            }
            return (
              <SetupCard
                key={`${item.archetypeId}-${item.variationIdx}`}
                setup={item}
                onTap={onTapSetup}
                lang={lang}
              />
            )
          })
        )}
        </Container>
      </section>

      {toast !== null ? (
        <div
          data-testid="setup-toast"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "var(--s-5)",
            transform: "translateX(-50%)",
            padding: "var(--s-2) var(--s-4)",
            border: "var(--b)",
            background: "var(--color-ink)",
            color: "var(--color-cream)",
            fontStyle: "italic",
            fontSize: "var(--t-body-sm)",
            maxWidth: "90vw",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,.2)",
          }}
        >
          {toast}
        </div>
      ) : null}
    </main>
  )
}
