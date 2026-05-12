// Canonical archetype catalog. 8 entries with player-count caps + i18n strings.
//
// Caps source: design doc lines 574–582 (Reconciliation pass) and prototype
// `ARCHETYPES` at `finalized.html:510–518`. Display names and vibe copy are
// pinned from the prototype; Thai copy may need a native-speaker pass before
// launch (Pass 7 blocker #3).
//
// `seal` glyphs are Unicode placeholders for V1; bespoke SVG seals are
// deferred per Pass 4 blocker #1.
//
// `ArchetypeId` is declared in `./wolf-pools.ts` (Lane A self-containment) and
// re-exported here so this module is the public catalog entry point.

import type { ArchetypeId } from "./wolf-pools"

export type { ArchetypeId }

export interface ArchetypeI18nStrings {
  name: string
  vibe: string
}

export interface Archetype {
  id: ArchetypeId
  seal: string
  minPlayers: number
  maxPlayers: number
  wolfDelta: 0 | 1
  i18n: {
    en: ArchetypeI18nStrings
    th: ArchetypeI18nStrings
  }
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  "classic-detective": {
    id: "classic-detective",
    seal: "𓁹",
    minPlayers: 6,
    maxPlayers: 20,
    wolfDelta: 0,
    i18n: {
      en: { name: "Classic Detective", vibe: "Strong info team, beginner-friendly." },
      th: { name: "นักสืบคลาสสิก", vibe: "ทีมข้อมูลแข็ง เหมาะมือใหม่" },
    },
  },
  "wolf-chaos": {
    id: "wolf-chaos",
    seal: "⚷",
    minPlayers: 5,
    maxPlayers: 9,
    wolfDelta: 1,
    i18n: {
      en: { name: "Wolf Chaos", vibe: "Extra wolf. Fast nights, panic mode." },
      th: { name: "หมาป่าเดือด", vibe: "หมาป่าเยอะ คืนสั้น เร่งร้อน" },
    },
  },
  "info-heavy": {
    id: "info-heavy",
    seal: "✥",
    minPlayers: 7,
    maxPlayers: 20,
    wolfDelta: 0,
    i18n: {
      en: { name: "Info Heavy", vibe: "Multiple seers. Deduction-focused." },
      th: { name: "สืบสวนเต็ม", vibe: "ผู้หยั่งรู้หลายคน เน้นใช้สมอง" },
    },
  },
  beginner: {
    id: "beginner",
    seal: "✿",
    minPlayers: 6,
    maxPlayers: 13,
    wolfDelta: 0,
    i18n: {
      en: { name: "Beginner", vibe: "Pure roles only. Easy to teach." },
      th: { name: "มือใหม่", vibe: "บทบาทพื้นฐาน สอนง่าย" },
    },
  },
  "power-roles": {
    id: "power-roles",
    seal: "✶",
    minPlayers: 6,
    maxPlayers: 20,
    wolfDelta: 0,
    i18n: {
      en: { name: "Power Roles", vibe: "Big abilities, big swings." },
      th: { name: "โหดโคตร", vibe: "พลังพิเศษเยอะ พลิกผันได้" },
    },
  },
  "social-bluff": {
    id: "social-bluff",
    seal: "?",
    minPlayers: 5,
    maxPlayers: 13,
    wolfDelta: 0,
    i18n: {
      en: { name: "Social Bluff", vibe: "No info. Deduction by talk alone." },
      th: { name: "ฝีมือพูดล้วน", vibe: "ไม่มีข้อมูล ใช้คำพูดล้วน" },
    },
  },
  "neutral-mayhem": {
    id: "neutral-mayhem",
    seal: "☾",
    minPlayers: 7,
    maxPlayers: 13,
    wolfDelta: 0,
    i18n: {
      en: { name: "Neutral Mayhem", vibe: "Tanner & Hoodlum chaos." },
      th: { name: "กลางมันส์", vibe: "คนฟอกหนัง นักเลง โกลาหล" },
    },
  },
  "balanced-power": {
    id: "balanced-power",
    seal: "♕",
    minPlayers: 7,
    maxPlayers: 20,
    wolfDelta: 0,
    i18n: {
      en: { name: "Balanced Power", vibe: "Strong both sides. Even fight." },
      th: { name: "สมดุล + แรง", vibe: "แข็งทั้งสองฝ่าย ต่อสู้สูสี" },
    },
  },
}
