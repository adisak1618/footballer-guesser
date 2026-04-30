import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import {
  GuessResult,
  guessResultSeenStorageKey,
} from "@/components/guess-result"

describe("GuessResult", () => {
  const baseProps = {
    assignedName: "Steven Gerrard",
    round: 2,
    maxRounds: 5,
    onSkip: () => {},
  }

  describe("correct mode", () => {
    it("renders Thai correct copy with positive score and total", () => {
      render(
        <GuessResult
          {...baseProps}
          mode="correct"
          scoreThisRound={3}
          totalScore={7}
        />,
      )
      expect(screen.getByText("ทายถูก!")).toBeInTheDocument()
      expect(screen.getByText("Steven Gerrard")).toBeInTheDocument()
      expect(screen.getByText("รอผู้เล่นคนอื่น...")).toBeInTheDocument()
      expect(screen.getByText("คะแนนรวม: 7 pts")).toBeInTheDocument()
      expect(screen.getByLabelText("คะแนนรอบนี้ +3 pts")).toBeInTheDocument()
    })

    it("does NOT render the foul total-score pill in correct mode", () => {
      render(
        <GuessResult
          {...baseProps}
          mode="correct"
          scoreThisRound={3}
          totalScore={7}
        />,
      )
      expect(screen.queryByLabelText(/คะแนนรวมของคุณ/)).toBeNull()
    })

    it("invokes onSkip when the user taps to skip", () => {
      const onSkip = vi.fn()
      render(
        <GuessResult
          {...baseProps}
          mode="correct"
          scoreThisRound={3}
          totalScore={7}
          onSkip={onSkip}
        />,
      )
      fireEvent.click(screen.getByLabelText("ข้ามไปสกอร์บอร์ด"))
      expect(onSkip).toHaveBeenCalledTimes(1)
    })

    it("auto-advances after the configured delay", () => {
      vi.useFakeTimers()
      const onSkip = vi.fn()
      render(
        <GuessResult
          {...baseProps}
          mode="correct"
          scoreThisRound={3}
          totalScore={7}
          autoAdvanceMs={8000}
          onSkip={onSkip}
        />,
      )
      expect(onSkip).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(8000)
      })
      expect(onSkip).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe("foul mode", () => {
    it("renders Thai foul copy with zero score and reveals the assigned name", () => {
      render(
        <GuessResult
          {...baseProps}
          mode="foul"
          scoreThisRound={0}
          totalScore={4}
        />,
      )
      expect(screen.getByText("ทายผิด")).toBeInTheDocument()
      expect(screen.getByText("Steven Gerrard")).toBeInTheDocument()
      expect(screen.getByText("รอเล่นใหม่ในรอบหน้า")).toBeInTheDocument()
      expect(screen.getByText("ผู้เล่นคนอื่นยังเล่นต่ออยู่")).toBeInTheDocument()
      expect(screen.getByLabelText("คะแนนรอบนี้ 0 pts")).toBeInTheDocument()
    })

    it("renders the total-score pill in the top-right slot (no rank)", () => {
      render(
        <GuessResult
          {...baseProps}
          mode="foul"
          scoreThisRound={0}
          totalScore={4}
        />,
      )
      const pill = screen.getByLabelText(/คะแนนรวมของคุณ 4 pts/)
      expect(pill).toBeInTheDocument()
      expect(pill).toHaveTextContent("4 pts")
    })

    it("invokes onSkip when the user taps to skip", () => {
      const onSkip = vi.fn()
      render(
        <GuessResult
          {...baseProps}
          mode="foul"
          scoreThisRound={0}
          totalScore={4}
          onSkip={onSkip}
        />,
      )
      fireEvent.click(screen.getByLabelText("ข้ามไปสกอร์บอร์ด"))
      expect(onSkip).toHaveBeenCalledTimes(1)
    })

    it("auto-advances after the configured delay", () => {
      vi.useFakeTimers()
      const onSkip = vi.fn()
      render(
        <GuessResult
          {...baseProps}
          mode="foul"
          scoreThisRound={0}
          totalScore={4}
          autoAdvanceMs={8000}
          onSkip={onSkip}
        />,
      )
      act(() => {
        vi.advanceTimersByTime(7999)
      })
      expect(onSkip).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onSkip).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe("storage key helper", () => {
    it("derives a stable per-round, per-player key", () => {
      const key = guessResultSeenStorageKey("round-state-uuid", "player-uuid")
      expect(key).toBe(
        "headball_last_result_seen_round-state-uuid_player-uuid",
      )
    })
  })
})
