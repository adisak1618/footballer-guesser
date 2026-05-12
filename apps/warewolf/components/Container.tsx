/**
 * <Container> — desktop-friendly max-width wrapper.
 *
 * Mobile-first: at viewport widths below the max, this is a no-op (the inner
 * content stretches to the available width minus the page's existing padding).
 * On wider viewports, the content centers in a 1100px column so reading
 * lengths stay comfortable and cards don't balloon edge-to-edge.
 *
 * Designed to wrap section CONTENT, not section CHROME — so borders and
 * sticky bars can still span full bleed. Place inside each top-level
 * <header>, <section>, <footer> rather than around the whole <main>.
 */
import type { CSSProperties, ReactNode } from "react"

interface ContainerProps {
  children: ReactNode
  /**
   * Override the default 1100px max-width. Use `narrow` for long-form text
   * (rules body) where ~80ch is the readable optimum.
   */
  variant?: "default" | "narrow"
  /**
   * Merge additional inline styles. Keeps the responsibility for layout
   * concerns local to each call site rather than introducing new props.
   */
  style?: CSSProperties
  className?: string
  /** Optional data-testid passthrough for QA. */
  testId?: string
}

const MAX_WIDTHS = {
  default: 1100,
  narrow: 760,
} as const

export function Container({
  children,
  variant = "default",
  style,
  className,
  testId,
}: ContainerProps) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        width: "100%",
        maxWidth: MAX_WIDTHS[variant],
        marginInline: "auto",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
