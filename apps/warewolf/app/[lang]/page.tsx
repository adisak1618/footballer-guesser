import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { RoleId } from "@social-hub/content"
import { CardArt } from "@/components/CardArt"
import { routing } from "../../i18n/routing"
import styles from "./landing.module.css"

/**
 * Landing — `/[lang]/`.
 *
 * Server Component (static, ISR). No client JS beyond <CardArt> (which is
 * client-only because it needs onError → placeholder fallback per Eng Review
 * decision #2's failure-mode mitigation) and next-intl's locale plumbing.
 *
 * Layout mirrors the locked Card Fan v2 wireframe:
 *   ~/.gstack/projects/board-game/designs/warewolf-landing-20260512/wireframe-B-v2.html
 *
 * Per Pass 7: no idle animation V1; cards are static. Per reconciliation:
 * page renders in only the selected language (no bilingual side-by-side);
 * Thai subtitle/secondary lines render only on /th/.
 *
 * Locked card-fan composition (left → right): villager · witch · seer ·
 * werewolf · wolf-cub (matches approved.json hero_card_fan.card_order).
 */

// Curated 5-card fan from the approved wireframe. Order matters — the CSS
// applies the rotation per `:nth-child`, with the middle card raised.
const HERO_CARDS: readonly RoleId[] = [
  "villager",
  "witch",
  "seer",
  "werewolf",
  "wolf-cub",
] as const

type LangParams = { lang: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<LangParams>
}): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(routing.locales, lang)) return {}
  const t = await getTranslations({ locale: lang, namespace: "Landing" })
  const title = t("title")
  const description = t("ogDescription")
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: lang === "th" ? "th_TH" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function LandingPage({
  params,
}: {
  params: Promise<LangParams>
}) {
  const { lang } = await params
  if (!hasLocale(routing.locales, lang)) notFound()
  setRequestLocale(lang)

  const t = await getTranslations({ locale: lang, namespace: "Landing" })
  const otherLang = lang === "en" ? "th" : "en"
  // Per reconciliation: toggle shows only the SELECTED language label (no
  // bilingual side-by-side). Tapping navigates to /[other-lang]/.
  const selectedLangLabel = lang === "en" ? "EN" : "ไทย"
  const isTh = lang === "th"

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.wordmark} aria-label="Werewolf">
          <span className={styles.wordmarkGlyph} aria-hidden="true">
            𓁹
          </span>
          <span>Werewolf</span>
        </div>
        <Link
          href={`/${otherLang}`}
          className={styles.langToggle}
          aria-label={t("langSwitchAria")}
          hrefLang={otherLang}
        >
          {selectedLangLabel}
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroHead}>
          <div className={styles.overline}>{t("overline")}</div>
          <h1 className={styles.title}>
            {t("titleTop")}
            <span className={isTh ? styles.titleSubTh : styles.titleSub}>
              {t("titleSub")}
            </span>
          </h1>
        </div>

        <div className={styles.divider} aria-hidden="true">
          ❦ · · · ❦
        </div>

        <div className={styles.heroCards}>
          <div className={styles.cardFan}>
            {HERO_CARDS.map((roleId) => (
              <div key={roleId} className={styles.cardFanCard}>
                <CardArt roleId={roleId} size="md" priority />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.below}>
        <p className={isTh ? styles.pitchTh : styles.pitch}>
          {isTh ? (
            <>
              {t("pitchPart1")} <span className={styles.pitchRange}>{t("pitchRange")}</span>{" "}
              {t("pitchPart2")}
            </>
          ) : (
            <>
              {t("pitchPart1")} <span className={styles.pitchRange}>{t("pitchRange")}</span>{" "}
              {t("pitchPart2")}
            </>
          )}
        </p>

        <div className={styles.ctaRow}>
          <Link
            href={`/${lang}/setup`}
            className={`${styles.cta} ${styles.ctaPrimary}`}
            data-testid="cta-find-setup"
          >
            {t("ctaFind")}
          </Link>
          <Link
            href={`/${lang}/rules`}
            className={styles.cta}
            data-testid="cta-how-to-play"
          >
            {t("ctaHow")}
          </Link>
        </div>
      </section>
    </main>
  )
}
