/**
 * Tailwind preset documentation for `@social-hub/ui`.
 *
 * The workspace uses Tailwind v4, where the legacy JS `tailwind.config.{js,ts}`
 * file is replaced by CSS-first configuration via `@theme inline { ... }` blocks
 * inside the consuming app's globals.css. There is no JS preset to import.
 *
 * Instead, this file documents what every app must wire up so the shadcn
 * primitives in this package render correctly with Stadium Energy tokens.
 *
 * ─── Required app setup ──────────────────────────────────────────────────────
 *
 * 1. PostCSS config (workspace root or per-app):
 *
 *      // postcss.config.mjs
 *      export default { plugins: { "@tailwindcss/postcss": {} } }
 *
 * 2. Each app's globals.css must:
 *
 *      @import "tailwindcss";
 *      @import "tw-animate-css";
 *      @import "shadcn/tailwind.css";
 *
 *      // Discover utility usage in the workspace ui package so its classes
 *      // are emitted into the app bundle. Tailwind v4 only auto-discovers
 *      // sources colocated with the consuming app — workspace packages must
 *      // be registered explicitly:
 *      @source "../../../packages/ui/src";
 *
 *      // Stadium Energy tokens — see ./src/tokens.css for the canonical
 *      // documentation. Inline them into a `@theme inline { ... }` block so
 *      // Tailwind generates utilities like `bg-goal`, `text-on-dark`,
 *      // `font-hero`, `animate-hb-flash`, etc.
 *
 * 3. Each app must provide the Next.js font CSS variables that Stadium Energy
 *    typography references (`--font-bebas`, `--font-anton`, `--font-plex-thai`).
 *    See apps/headball/app/layout.tsx for the canonical wiring.
 *
 * ─── Required runtime peer deps ──────────────────────────────────────────────
 *
 * Consuming apps must install (or have hoisted via Bun workspaces):
 *   - react, react-dom (>=19)
 *   - @base-ui/react (>=1.4)
 *   - lucide-react (for icons used by Dialog close button)
 *   - class-variance-authority, clsx, tailwind-merge (utility deps)
 *
 * ─── Why no JS export? ───────────────────────────────────────────────────────
 *
 * Tailwind v4 dropped JS-based presets in favor of CSS @theme. Exporting an
 * empty config object would be misleading. When Tailwind v5 (or a v4 minor
 * release) supports `@import` of `@theme` blocks across packages, this file
 * will become a real preset that consumers can `@import "@social-hub/ui/tokens"`.
 * Until then, treat this file as the contract between packages/ui and apps.
 */

export const TAILWIND_PRESET_CONTRACT = "tailwind-v4-css-first" as const

export type TailwindPresetContract = typeof TAILWIND_PRESET_CONTRACT
