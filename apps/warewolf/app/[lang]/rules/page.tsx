"use client"

/**
 * `/[lang]/rules` — rules transcript (US-022, Lane F).
 *
 * Wireframe: ~/.gstack/projects/board-game/designs/warewolf-rules-20260512/wireframe.html
 *
 * Layout:
 *   - Sticky topbar: back → Home + active chapter indicator + lang toggle.
 *   - Page title (overline + bilingual headline).
 *   - Collapsible TOC (default collapsed on mobile, expanded on desktop).
 *   - Body: chapters I–VI rendered from RULES_CHAPTERS; chapter VII is the
 *     Role Compendium, paginated by team (3 tabs Wolves / Village / Neutral).
 *   - Sticky bottom CTA: secondary Home + primary Find a Setup.
 *
 * Scrollspy: IntersectionObserver on each section heading updates the
 * sticky chapter indicator in the topbar.
 *
 * Per reconciliation pass: the page shows ONLY the active locale (the lang
 * toggle in the topbar switches segments — no inline bilingual rendering).
 */

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { CardArt } from "@/components/CardArt"
import { ROLES, ROLE_IDS, type RoleId, type Team } from "@social-hub/content"
import { RULES_CHAPTERS, type RulesBlock } from "@/lib/rules-content"

type Lang = "en" | "th"
type CompendiumTeam = "werewolf" | "village" | "neutral"

const SECTION_IDS = [
  ...RULES_CHAPTERS.map((c) => c.id),
  "ch-7",
] as const

const COMPENDIUM_TEAMS: readonly CompendiumTeam[] = [
  "werewolf",
  "village",
  "neutral",
]

function isMobile(): boolean {
  if (typeof window === "undefined") return true
  return window.matchMedia("(max-width: 640px)").matches
}

export default function RulesPage() {
  const lang = useLocale() as Lang
  const t = useTranslations("Rules")
  const otherLang: Lang = lang === "en" ? "th" : "en"
  const langLabel = lang === "en" ? "EN" : "ไทย"

  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS[0])
  const [tocOpen, setTocOpen] = useState<boolean>(true)
  const tocInitialised = useRef(false)

  // Default collapsed on mobile, expanded on desktop (per approved.json).
  useEffect(() => {
    if (tocInitialised.current) return
    tocInitialised.current = true
    setTocOpen(!isMobile())
  }, [])

  // Scrollspy: track which chapter is in view.
  useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section; fallback to last passed if none.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          )
        if (visible.length > 0 && visible[0].target.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    )

    for (const el of els) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const activeChapter = useMemo(() => {
    if (activeSection === "ch-7") {
      return { roman: "VII", title: t("compendiumTitle") }
    }
    const c = RULES_CHAPTERS.find((ch) => ch.id === activeSection)
    if (!c) return null
    return { roman: c.roman, title: lang === "en" ? c.titleEn : c.titleTh }
  }, [activeSection, lang, t])

  const chapterTag =
    activeChapter !== null
      ? t("chapterTag", {
          roman: activeChapter.roman,
          title: activeChapter.title,
        })
      : ""

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-parchment)",
        backgroundImage: "var(--texture-grain)",
        backgroundSize: "3px 3px",
        color: "var(--color-ink)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-serif)",
      }}
    >
      {/* Sticky topbar */}
      <header
        data-testid="rules-topbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-2)",
          padding: "var(--s-2) var(--s-4)",
          borderBottom: "var(--b)",
          background: "var(--color-parchment)",
        }}
      >
        <Link
          href={`/${lang}`}
          data-testid="rules-back-home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            color: "var(--color-ink)",
            textDecoration: "none",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: "var(--t-body-sm)",
          }}
        >
          <span style={{ color: "var(--color-blood)", paddingRight: 4 }}>
            ◂
          </span>
          {t("homeCta")}
        </Link>
        <div
          data-testid="rules-chapter-tag"
          aria-live="polite"
          style={{
            flex: 1,
            textAlign: "center",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: "var(--t-micro)",
            color: "var(--color-blood)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "0 var(--s-2)",
          }}
        >
          {chapterTag}
        </div>
        <Link
          href={`/${otherLang}/rules`}
          data-testid="rules-lang-toggle"
          hrefLang={otherLang}
          aria-label={t("langToggleAria")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 var(--s-2)",
            color: "var(--color-ink)",
            textDecoration: "none",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: "var(--t-body-sm)",
          }}
        >
          {langLabel}
        </Link>
      </header>

      {/* Page title */}
      <section
        style={{
          textAlign: "center",
          padding: "var(--s-4) var(--s-4) var(--s-2)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: "var(--t-micro)",
            color: "var(--color-blood)",
            letterSpacing: ".32em",
            textTransform: "uppercase",
          }}
        >
          {t("overline")}
        </div>
        <h1
          data-testid="rules-page-title"
          style={{
            margin: "var(--s-2) 0 0",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "var(--t-display)",
            lineHeight: 1.1,
          }}
        >
          {t("title")}
        </h1>
      </section>

      {/* Collapsible TOC */}
      <nav
        data-testid="rules-toc"
        data-open={tocOpen ? "true" : "false"}
        style={{
          margin: "var(--s-2) var(--s-4)",
          border: "var(--b)",
          background: "var(--color-cream)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: "var(--t-body-sm)",
        }}
      >
        <button
          type="button"
          data-testid="rules-toc-toggle"
          aria-expanded={tocOpen}
          aria-controls="rules-toc-list"
          aria-label={tocOpen ? t("tocCloseAria") : t("tocOpenAria")}
          onClick={() => setTocOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--s-2) var(--s-3)",
            border: "none",
            borderBottom: tocOpen ? "var(--b-soft)" : "none",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
            color: "var(--color-ink)",
            minHeight: 44,
          }}
        >
          <span
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "var(--t-micro)",
              color: "var(--color-blood)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            {t("toc")}
          </span>
          <span
            aria-hidden="true"
            style={{ color: "var(--color-blood)", fontSize: "var(--t-body)" }}
          >
            {tocOpen ? "▾" : "▸"}
          </span>
        </button>
        {tocOpen ? (
          <ol
            id="rules-toc-list"
            style={{
              listStyle: "none",
              margin: 0,
              padding: "var(--s-2) var(--s-3) var(--s-3)",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--s-1) var(--s-2)",
            }}
          >
            {RULES_CHAPTERS.map((ch) => {
              const isCurrent = activeSection === ch.id
              return (
                <RulesTocItem
                  key={ch.id}
                  href={`#${ch.id}`}
                  roman={ch.roman}
                  title={lang === "en" ? ch.titleEn : ch.titleTh}
                  current={isCurrent}
                />
              )
            })}
            <RulesTocItem
              href="#ch-7"
              roman="VII"
              title={t("compendiumTitle")}
              current={activeSection === "ch-7"}
            />
          </ol>
        ) : null}
      </nav>

      {/* Body — chapters I-VI then chapter VII compendium */}
      <article
        style={{
          flex: 1,
          padding: "var(--s-3) var(--s-4) var(--s-6)",
        }}
      >
        {RULES_CHAPTERS.map((ch) => (
          <section
            key={ch.id}
            id={ch.id}
            data-testid={`rules-chapter-${ch.id}`}
            style={{ scrollMarginTop: 80, marginTop: "var(--s-5)" }}
          >
            <ChapterHeading
              roman={ch.roman}
              title={lang === "en" ? ch.titleEn : ch.titleTh}
              chapterLabel={t("chapter")}
            />
            {ch.blocks.map((b, idx) => (
              <RulesBlockView
                key={`${ch.id}-${idx}`}
                block={b}
                lang={lang}
                t={(k, v) => t(k, v)}
              />
            ))}
          </section>
        ))}

        {/* Chapter VII — Role Compendium (paginated by team) */}
        <section
          id="ch-7"
          data-testid="rules-chapter-ch-7"
          style={{ scrollMarginTop: 80, marginTop: "var(--s-5)" }}
        >
          <ChapterHeading
            roman="VII"
            title={t("compendiumTitle")}
            chapterLabel={t("chapter")}
          />
          <RoleCompendium lang={lang} />
        </section>
      </article>

      {/* Sticky bottom CTA */}
      <div
        data-testid="rules-bottom-cta"
        style={{
          position: "sticky",
          bottom: 0,
          flexShrink: 0,
          display: "flex",
          gap: "var(--s-2)",
          padding: "var(--s-2) var(--s-4)",
          borderTop: "var(--b)",
          background: "var(--color-parchment)",
        }}
      >
        <Link
          href={`/${lang}`}
          data-testid="rules-cta-home"
          style={{
            flex: 1,
            textAlign: "center",
            padding: "var(--s-3)",
            border: "var(--b-thick)",
            background: "var(--color-cream)",
            color: "var(--color-ink)",
            textDecoration: "none",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "var(--t-body-sm)",
            minHeight: 44,
          }}
        >
          {t("homeCta")}
        </Link>
        <Link
          href={`/${lang}/setup`}
          data-testid="rules-cta-setup"
          style={{
            flex: 1,
            textAlign: "center",
            padding: "var(--s-3)",
            border: "1.5px solid var(--color-blood)",
            background: "var(--color-blood)",
            color: "var(--color-cream)",
            textDecoration: "none",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "var(--t-body-sm)",
            minHeight: 44,
          }}
        >
          {t("backToSetup")}
        </Link>
      </div>
    </main>
  )
}

/* ---------- helpers ---------- */

function RulesTocItem({
  href,
  roman,
  title,
  current,
}: {
  href: string
  roman: string
  title: string
  current: boolean
}) {
  return (
    <>
      <span
        style={{
          color: "var(--color-blood)",
          fontStyle: "italic",
          fontWeight: 700,
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {roman}
      </span>
      <Link
        href={href}
        data-testid={`rules-toc-${roman.toLowerCase()}`}
        data-current={current ? "true" : "false"}
        style={{
          fontStyle: "italic",
          fontWeight: current ? 700 : 500,
          color: current ? "var(--color-blood)" : "var(--color-ink)",
          textDecoration: "none",
          fontSize: "var(--t-body-sm)",
        }}
      >
        {title}
      </Link>
    </>
  )
}

function ChapterHeading({
  roman,
  title,
  chapterLabel,
}: {
  roman: string
  title: string
  chapterLabel: string
}) {
  return (
    <header
      style={{
        textAlign: "center",
        margin: "var(--s-4) 0 var(--s-2)",
      }}
    >
      <div
        style={{
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "var(--t-micro)",
          color: "var(--color-blood)",
          letterSpacing: ".2em",
          textTransform: "uppercase",
        }}
      >
        {chapterLabel} {roman}
      </div>
      <h2
        style={{
          margin: "var(--s-1) 0 0",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "var(--t-display-sm)",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--s-2)",
          margin: "var(--s-2) 0 var(--s-3)",
          color: "var(--color-blood)",
          fontSize: "var(--t-micro)",
          letterSpacing: ".3em",
        }}
      >
        <span
          style={{
            flex: 1,
            height: 1,
            background: "var(--color-ink)",
            opacity: 0.3,
            maxWidth: 80,
          }}
        />
        ❦ · · · ❦
        <span
          style={{
            flex: 1,
            height: 1,
            background: "var(--color-ink)",
            opacity: 0.3,
            maxWidth: 80,
          }}
        />
      </div>
    </header>
  )
}

function RulesBlockView({
  block,
  lang,
  t,
}: {
  block: RulesBlock
  lang: Lang
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  if (block.kind === "p") {
    const text = lang === "en" ? block.en : block.th
    const fontFam =
      lang === "th"
        ? "var(--font-serif-th)"
        : "var(--font-serif)"
    return (
      <p
        style={{
          margin: "0 0 var(--s-3)",
          fontFamily: fontFam,
          fontSize: "var(--t-body-sm)",
          lineHeight: 1.6,
          color: "var(--color-ink)",
        }}
      >
        {block.dropcap === true && lang === "en" ? (
          <span
            style={{
              float: "left",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 38,
              lineHeight: 0.85,
              color: "var(--color-blood)",
              padding: "4px 8px 0 0",
              fontFamily: "var(--font-serif)",
            }}
          >
            {text.charAt(0)}
          </span>
        ) : null}
        {block.dropcap === true && lang === "en" ? text.slice(1) : text}
      </p>
    )
  }

  if (block.kind === "quote") {
    const text = lang === "en" ? block.en : block.th
    const fontFam =
      lang === "th" ? "var(--font-serif-th)" : "var(--font-serif)"
    return (
      <blockquote
        style={{
          margin: "var(--s-3) 0",
          padding: "var(--s-1) var(--s-3)",
          borderLeft: "3px solid var(--color-blood)",
          fontStyle: lang === "en" ? "italic" : "normal",
          fontWeight: 500,
          fontFamily: fontFam,
          fontSize: "var(--t-body-sm)",
          lineHeight: 1.5,
          color: "var(--color-ink-soft)",
        }}
      >
        {`“${text}”`}
      </blockquote>
    )
  }

  // role block
  return <RoleDetailBlock roleId={block.roleId} lang={lang} t={t} />
}

function RoleDetailBlock({
  roleId,
  lang,
  t,
}: {
  roleId: RoleId
  lang: Lang
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const role = ROLES[roleId]
  const i18n = role.i18n[lang]
  const teamLabel =
    role.team === "werewolf"
      ? t("teamWolf")
      : role.team === "village"
        ? t("teamVillage")
        : t("teamNeutral")
  const signed = role.balance > 0 ? `+${role.balance}` : `${role.balance}`
  const fontFam =
    lang === "th" ? "var(--font-serif-th)" : "var(--font-serif)"

  return (
    <div
      data-testid={`rules-role-block-${roleId}`}
      style={{
        display: "flex",
        gap: "var(--s-3)",
        padding: "var(--s-3)",
        border: "var(--b)",
        background: "var(--color-cream)",
        margin: "var(--s-3) 0",
        position: "relative",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <CardArt roleId={roleId} size="sm" />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-1)",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "var(--t-h)",
            fontFamily: fontFam,
            lineHeight: 1.1,
          }}
        >
          {i18n.name}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <Badge label={teamLabel} />
          <Badge label={t("balanceLabel", { N: signed })} />
          <Badge label={i18n.short} />
        </div>
        <p
          style={{
            margin: "var(--s-1) 0 0",
            fontStyle: lang === "en" ? "italic" : "normal",
            fontSize: "var(--t-micro)",
            lineHeight: 1.5,
            fontFamily: fontFam,
            color: "var(--color-ink)",
          }}
        >
          {i18n.description}
        </p>
      </div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontStyle: "italic",
        fontWeight: 600,
        fontSize: 10,
        padding: "2px 6px",
        border: "var(--b)",
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        letterSpacing: ".04em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

/* ---------- Chapter VII — Role Compendium ---------- */

function RoleCompendium({ lang }: { lang: Lang }) {
  const t = useTranslations("Rules")
  const [team, setTeam] = useState<CompendiumTeam>("werewolf")

  const rolesByTeam = useMemo(() => {
    const grouped: Record<CompendiumTeam, RoleId[]> = {
      werewolf: [],
      village: [],
      neutral: [],
    }
    for (const id of ROLE_IDS) {
      const t = ROLES[id].team as Team
      if (t === "werewolf") grouped.werewolf.push(id)
      else if (t === "village") grouped.village.push(id)
      else grouped.neutral.push(id)
    }
    return grouped
  }, [])

  const tabLabel = (k: CompendiumTeam): string => {
    if (k === "werewolf") return t("compendiumTabWolves")
    if (k === "village") return t("compendiumTabVillage")
    return t("compendiumTabNeutral")
  }

  return (
    <div data-testid="rules-compendium">
      <div
        role="tablist"
        aria-label={t("compendiumTitle")}
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "var(--b)",
          marginBottom: "var(--s-3)",
        }}
      >
        {COMPENDIUM_TEAMS.map((k) => {
          const active = team === k
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`rules-compendium-tab-${k}`}
              data-active={active ? "true" : "false"}
              onClick={() => setTeam(k)}
              style={{
                flex: 1,
                padding: "var(--s-2) var(--s-3)",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--color-blood)"
                  : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                font: "inherit",
                fontStyle: "italic",
                fontWeight: active ? 700 : 500,
                fontSize: "var(--t-body-sm)",
                color: active ? "var(--color-blood)" : "var(--color-ink)",
                minHeight: 44,
              }}
            >
              {tabLabel(k)}
            </button>
          )
        })}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rolesByTeam[team].map((id) => (
          <li key={id}>
            <RoleDetailBlock
              roleId={id}
              lang={lang}
              t={(k, v) => t(k, v)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
