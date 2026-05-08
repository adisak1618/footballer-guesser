// Single source of truth for category slugs across the app.
// Mirrors data/seed/categories.json. The unit test in
// lib/__tests__/categories.test.ts asserts these stay in sync.
//
// This file deliberately avoids "use server" so we can export non-async
// values (Next.js disallows non-function exports from server-action modules).

export const ALLOWED_CATEGORIES = [
  // Default
  "worldwide-stars",
  // Leagues
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  // Famous clubs
  "liverpool",
  "man-united",
  "arsenal",
  "chelsea",
  "man-city",
  "tottenham",
  "real-madrid",
  "barcelona",
  "atletico",
  "juventus",
  "ac-milan",
  "inter",
  "bayern",
  "dortmund",
  "psg",
  // Played for BOTH rival clubs
  "real-and-barca",
  "milan-and-inter",
  "arsenal-and-tottenham",
  "united-and-city",
  "real-and-atletico",
  "real-and-chelsea",
  // Nationalities
  "english",
  "brazilian",
  "argentinian",
  "french",
  "german",
  "spanish",
  "italian",
  // Position / special
  "goalkeepers",
  "legends",
] as const;

export type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

export const ALLOWED_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type AllowedDifficulty = (typeof ALLOWED_DIFFICULTIES)[number];
