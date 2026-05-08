import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import {
  GuessResult,
  guessResultSeenStorageKey,
} from "@/components/guess-result"
import { selectGuessResultMode } from "@/lib/guess-result-mode"

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

  describe("correct_zero mode (correct guess but did not make Top-N)", () => {
    it("renders the +0 pts variant with the 'too slow' headline and Correct layout", () => {
      render(
        <GuessResult
          {...baseProps}
          mode="correct_zero"
          scoreThisRound={0}
          totalScore={4}
        />,
      )
      expect(screen.getByText("ทายถูก แต่ช้าไป")).toBeInTheDocument()
      // Did NOT see the wrong-guess headline.
      expect(screen.queryByText("ทายผิด")).toBeNull()
      // Same Correct rank/layout: green '+' prefix on the 0, no Foul total-score pill.
      expect(screen.getByLabelText("คะแนนรอบนี้ +0 pts")).toBeInTheDocument()
      expect(screen.queryByLabelText(/คะแนนรวมของคุณ/)).toBeNull()
      // Reuses the Correct waiting copy, not the Foul one.
      expect(screen.getByText("รอผู้เล่นคนอื่น...")).toBeInTheDocument()
      expect(screen.getByText("คะแนนรวม: 4 pts")).toBeInTheDocument()
    })

    it("auto-advances after 8s like the other modes", () => {
      vi.useFakeTimers()
      const onSkip = vi.fn()
      render(
        <GuessResult
          {...baseProps}
          mode="correct_zero"
          scoreThisRound={0}
          totalScore={4}
          autoAdvanceMs={8000}
          onSkip={onSkip}
        />,
      )
      act(() => {
        vi.advanceTimersByTime(8000)
      })
      expect(onSkip).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe("selectGuessResultMode (regression guard for issue #8)", () => {
    it("returns 'correct' when is_correct=true AND points>0", () => {
      expect(selectGuessResultMode(true, 1)).toBe("correct")
      expect(selectGuessResultMode(true, 3)).toBe("correct")
    })

    it("returns 'correct_zero' when is_correct=true AND points=0 (the bug)", () => {
      // This is the exact scenario from issue #8: 2-player room, Top-N=1,
      // Player B guesses correctly but late → score=0. Must NOT be Foul.
      expect(selectGuessResultMode(true, 0)).toBe("correct_zero")
    })

    it("returns 'foul' on a wrong guess regardless of score", () => {
      expect(selectGuessResultMode(false, 0)).toBe("foul")
    })

    it("does NOT key off score alone (the regression)", () => {
      // Score=0 with is_correct=true must NOT collapse to Foul. This is the
      // assertion that locks in the fix from the old `score_this_round > 0`
      // selector, which would have returned 'foul' here.
      expect(selectGuessResultMode(true, 0)).not.toBe("foul")
    })

    it("falls back to 'foul' on null/undefined is_correct (defensive)", () => {
      expect(selectGuessResultMode(null, 0)).toBe("foul")
      expect(selectGuessResultMode(undefined, 0)).toBe("foul")
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
