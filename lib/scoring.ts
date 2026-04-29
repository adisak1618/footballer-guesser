export function calculateGuessScore(position: number, scorePositions: number): number {
  if (!Number.isInteger(position) || position < 1) return 0
  if (!Number.isInteger(scorePositions) || scorePositions < 1) return 0
  if (position > scorePositions) return 0
  return scorePositions - position + 1
}
