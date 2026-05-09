import type { GuessResultMode } from "@/components/guess-result"

export function selectGuessResultMode(
  isCorrect: boolean | null | undefined,
  scoreThisRound: number | null | undefined,
): GuessResultMode {
  if (isCorrect === true) {
    return (scoreThisRound ?? 0) > 0 ? "correct" : "correct_zero"
  }
  return "foul"
}
