import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test"

export interface MultiRoleSession {
  contexts: BrowserContext[]
  pages: Page[]
  dispose: () => Promise<void>
}

/**
 * Create N isolated browser contexts (one per simulated player) plus one page
 * per context. Each context has its own cookie jar + localStorage, which is
 * what same-room Insider/Headball flows need to model 4 phones at the table.
 *
 * Optional `contextOptions` is merged on top of the default 414x896 viewport
 * so callers can layer in things like `reducedMotion: "reduce"` (US-073) or
 * a different `colorScheme` without forking the helper. Caller MUST call
 * `dispose()` (or wrap in try/finally) so the contexts close before the test
 * exits. Playwright will leak processes otherwise.
 */
export async function createMultiRoleSession(
  browser: Browser,
  playerCount: number,
  contextOptions: BrowserContextOptions = {},
): Promise<MultiRoleSession> {
  if (playerCount < 1) {
    throw new Error(`playerCount must be >= 1, got ${playerCount}`)
  }

  const contexts: BrowserContext[] = []
  const pages: Page[] = []

  for (let i = 0; i < playerCount; i += 1) {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      ...contextOptions,
    })
    const page = await context.newPage()
    contexts.push(context)
    pages.push(page)
  }

  return {
    contexts,
    pages,
    dispose: async () => {
      await Promise.all(contexts.map(ctx => ctx.close()))
    },
  }
}
