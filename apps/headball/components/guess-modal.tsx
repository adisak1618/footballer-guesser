"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"
import { guessTextSchema } from "@/lib/schemas"
import { findPrefixMatches } from "@/lib/player-names"
import {
  submitGuessAction,
  type SubmitGuessActionResult,
} from "@/app/actions/submit-guess"

const SPINNER_MIN_MS = 200
const CHIPS_MIN_LENGTH = 2
const CHIPS_MAX = 5

function subscribeReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getReducedMotionServerSnapshot(): boolean {
  return false
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  )
}

interface GuessModalProps {
  roomId: string
  roundNumber: number
  playerId: string
  onResult: (result: { correct: boolean; score: number }) => void
}

const GUESS_MODAL_HISTORY_FLAG = "headballGuessModalOpen"

export function GuessModal({
  roomId,
  roundNumber,
  playerId,
  onResult,
}: GuessModalProps) {
  const [text, setText] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [showSpinner, setShowSpinner] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const chipSuggestions = useMemo(() => {
    if (reducedMotion) return []
    if (text.trim().length < CHIPS_MIN_LENGTH) return []
    return findPrefixMatches(text, CHIPS_MAX)
  }, [text, reducedMotion])

  useEffect(() => {
    queueMicrotask(() => inputRef.current?.focus())
  }, [])

  // Lock dismissal: ESC + browser-back are both blocked while the modal is
  // mounted. The modal can only be closed by submitting a guess (which calls
  // onResult and unmounts us). Backdrop click and the ยกเลิก button were
  // removed entirely from the render tree.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    // Capture phase so we beat any document-level handler.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    // Push a sentinel state so the next browser-back lands on us instead of
    // navigating away. On popstate, immediately re-push so we stay locked.
    window.history.pushState({ [GUESS_MODAL_HISTORY_FLAG]: true }, "")
    function onPopState() {
      window.history.pushState({ [GUESS_MODAL_HISTORY_FLAG]: true }, "")
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
      // Clean up: if our sentinel is still on top of the stack (modal closed
      // via submit, not via back), pop it so the user's history isn't padded.
      const state = window.history.state as Record<string, unknown> | null
      if (state && state[GUESS_MODAL_HISTORY_FLAG]) {
        window.history.back()
      }
    }
  }, [])

  function dispatchSubmit(value: string) {
    setNetworkError(null)
    const startedAt = Date.now()
    setShowSpinner(false)
    const spinnerTimer = window.setTimeout(() => setShowSpinner(true), SPINNER_MIN_MS)

    startTransition(async () => {
      let result: SubmitGuessActionResult
      try {
        result = await submitGuessAction({
          roomId,
          roundNumber,
          playerId,
          guess: value,
        })
      } catch {
        result = { ok: false, error: "เครือข่ายขาด ลองอีกครั้ง", isNetwork: true }
      }

      const elapsed = Date.now() - startedAt
      const remaining = SPINNER_MIN_MS - elapsed
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining))
      }

      window.clearTimeout(spinnerTimer)
      setShowSpinner(false)

      if (result.ok) {
        onResult({ correct: result.correct, score: result.score })
        return
      }

      if (result.isNetwork) {
        setNetworkError(result.error)
        return
      }

      setFieldError(result.error)
      inputRef.current?.focus()
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const parsed = guessTextSchema.safeParse(text)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "พิมพ์ชื่อก่อนนะ")
      inputRef.current?.focus()
      return
    }
    setFieldError(null)
    dispatchSubmit(parsed.data)
  }

  function onRetry() {
    if (isPending) return
    const parsed = guessTextSchema.safeParse(text)
    if (!parsed.success) return
    dispatchSubmit(parsed.data)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ทายชื่อนักเตะของคุณ"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-10 sm:items-center"
    >
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-hairline bg-surface p-6 text-on-dark"
      >
        <div className="space-y-1">
          <h2 className="font-display text-[24px] uppercase tracking-[1.5px]">
            ทายชื่อนักเตะของคุณ
          </h2>
          <p className="text-xs text-on-dark-soft">
            พิมพ์ตามที่เห็นบนหัวเพื่อนๆ
          </p>
        </div>

        <div className="space-y-1.5">
          <input
            ref={inputRef}
            id="guess-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              if (fieldError) setFieldError(null)
            }}
            disabled={isPending}
            aria-invalid={fieldError ? "true" : undefined}
            aria-describedby={fieldError ? "guess-error" : undefined}
            placeholder="เช่น Steven Gerrard"
            className="h-12 w-full rounded-xl border border-hairline bg-surface-elevated px-4 text-base text-on-dark placeholder:text-on-dark-muted focus:border-goal focus:outline-none disabled:opacity-60"
          />
          {fieldError ? (
            <p id="guess-error" role="alert" className="text-sm text-error">
              {fieldError}
            </p>
          ) : null}
          {chipSuggestions.length > 0 ? (
            <ul
              aria-live="polite"
              aria-label="คำแนะนำชื่อ"
              className="flex flex-wrap gap-1.5 pt-1"
            >
              {chipSuggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setText(name)
                      if (fieldError) setFieldError(null)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-hairline bg-surface-elevated px-3 py-1 font-body text-[13px] text-on-dark hover:border-goal disabled:opacity-60"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="text-xs text-warning">
          <span aria-hidden="true">⚠️ </span>
          ทายผิด = Foul, ออกจากรอบทันที
        </p>

        {networkError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error"
          >
            <span>{networkError}</span>
            <button
              type="button"
              onClick={onRetry}
              disabled={isPending}
              className="self-start rounded-lg border border-error/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.5px] text-error hover:bg-error/15 disabled:opacity-60"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-goal px-6 text-sm font-semibold text-on-dark active:bg-goal-active disabled:opacity-60 sm:w-auto"
          >
            {showSpinner ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-on-dark/40 border-t-on-dark"
              />
            ) : null}
            <span>{isPending ? "กำลังส่ง..." : "ส่งคำตอบ"}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
