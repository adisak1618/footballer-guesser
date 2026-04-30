import { PREMIER_LEAGUE_NAMES } from "@/data/premier-league"

export const PLAYER_NAMES: readonly string[] = PREMIER_LEAGUE_NAMES

// Word-prefix match: any whitespace-delimited word in the name whose
// lowercase form starts with the (also lowercased + trimmed) input.
// "ger" → "Steven Gerrard"; "stev g" → "Steven Gerrard" (full string also
// matches the start of the full name, so both forms work).
export function findPrefixMatches(input: string, max = 3): string[] {
  const needle = input.trim().toLowerCase()
  if (needle.length === 0 || max <= 0) return []

  const out: string[] = []
  for (const name of PLAYER_NAMES) {
    const lower = name.toLowerCase()
    if (lower.startsWith(needle)) {
      out.push(name)
    } else if (lower.split(/\s+/).some((word) => word.startsWith(needle))) {
      out.push(name)
    }
    if (out.length >= max) break
  }
  return out
}
