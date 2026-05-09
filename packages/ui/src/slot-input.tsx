"use client"

import * as React from "react"
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@social-hub/core"

import { cn } from "./utils"

export interface SlotInputProps {
  value: string
  onChange: (next: string) => void
  length?: number
  alphabet?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  cellClassName?: string
  "aria-label"?: string
}

function SlotInput({
  value,
  onChange,
  length = ROOM_CODE_LENGTH,
  alphabet = ROOM_CODE_ALPHABET,
  disabled,
  autoFocus,
  className,
  cellClassName,
  "aria-label": ariaLabel = "Room code",
}: SlotInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([])

  const allowed = React.useMemo(() => new Set(alphabet.split("")), [alphabet])

  const normalize = React.useCallback(
    (raw: string) => {
      const upper = raw.toUpperCase()
      let out = ""
      for (const c of upper) {
        if (allowed.has(c)) {
          out += c
          if (out.length >= length) break
        }
      }
      return out
    },
    [allowed, length],
  )

  const cells = React.useMemo(() => {
    const arr: string[] = []
    for (let i = 0; i < length; i++) arr.push(value[i] ?? "")
    return arr
  }, [value, length])

  const focusCell = (i: number) => {
    const target = refs.current[i]
    if (target) target.focus()
  }

  const handleChange = (i: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      // multi-char input lands when the user types into a cell whose
      // selection is not collapsed (e.g. autofill or paste-into-cell).
      if (raw.length > 1) {
        const next = normalize(raw)
        onChange(next)
        focusCell(Math.min(next.length, length - 1))
        return
      }
      const ch = normalize(raw)
      const arr = cells.slice()
      arr[i] = ch
      // Drop trailing empties so onChange yields a contiguous prefix.
      let end = arr.length
      while (end > 0 && arr[end - 1] === "") end--
      onChange(arr.slice(0, end).join(""))
      if (ch && i < length - 1) {
        focusCell(i + 1)
      }
    }

  const handleKeyDown = (i: number) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (cells[i]) {
          // default delete handles this cell
          return
        }
        if (i > 0) {
          e.preventDefault()
          const arr = cells.slice()
          arr[i - 1] = ""
          let end = arr.length
          while (end > 0 && arr[end - 1] === "") end--
          onChange(arr.slice(0, end).join(""))
          focusCell(i - 1)
        }
        return
      }
      if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault()
        focusCell(i - 1)
      } else if (e.key === "ArrowRight" && i < length - 1) {
        e.preventDefault()
        focusCell(i + 1)
      }
    }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    const next = normalize(text)
    onChange(next)
    focusCell(Math.min(next.length, length - 1))
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-2", className)}
      data-slot="slot-input"
    >
      {cells.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={1}
          value={ch}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`${ariaLabel} character ${i + 1}`}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          data-slot="slot-input-cell"
          className={cn(
            "h-16 w-12 rounded-lg border border-hairline bg-surface-elevated text-center text-on-dark-strong",
            "font-hero text-[48px] uppercase",
            "outline-none transition-colors",
            "focus-visible:border-goal focus-visible:ring-2 focus-visible:ring-goal/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            cellClassName,
          )}
          style={{ letterSpacing: "8px", fontFeatureSettings: "'tnum'" }}
        />
      ))}
    </div>
  )
}

export { SlotInput }
