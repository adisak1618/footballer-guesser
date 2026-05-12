/**
 * VILLAGE_SEEDS — hardcoded village + neutrals identity per archetype.
 *
 * The solver only varies the wolf composition; the village character stays
 * curated so each variation has a consistent vibe and balance. Three
 * variations per archetype (variationIdx 0 | 1 | 2) ported verbatim from the
 * prototype `finalized.html` `VILLAGE_SEEDS` block (lines ~722–763).
 *
 * Source of truth: `~/.gstack/projects/board-game/designs/warewolf-full-app-20260512/finalized.html`
 * Data-model contract: design doc lines 391–397.
 *
 * The audit test in US-023 verifies every seed produces a balanced setup
 * across the archetype's full `[minPlayers, maxPlayers]` range.
 */

import type { RoleId } from "@social-hub/content"

import type { ArchetypeId } from "./wolf-pools"

export interface VillageSeedVibe {
  en: string
  th: string
}

export interface VillageSeed {
  village: RoleId[]
  neutrals?: RoleId[]
  vibe: VillageSeedVibe
}

export const VILLAGE_SEEDS: Record<ArchetypeId, [VillageSeed, VillageSeed, VillageSeed]> = {
  "classic-detective": [
    {
      village: ["seer", "bodyguard", "hunter"],
      vibe: {
        en: "A Seer and Bodyguard hold the line.",
        th: "ผู้หยั่งรู้และบอดี้การ์ดยืนหยัด",
      },
    },
    {
      village: ["seer", "witch", "bodyguard"],
      vibe: {
        en: "The Seer is supported by a Witch's nightly hand.",
        th: "ผู้หยั่งรู้มีแม่มดช่วยทุกคืน",
      },
    },
    {
      village: ["seer", "apprentice-seer", "bodyguard"],
      vibe: {
        en: "Two seers, double-checking each other.",
        th: "ผู้หยั่งรู้สองคน ตรวจสอบกันเอง",
      },
    },
  ],
  "wolf-chaos": [
    {
      village: ["seer", "hunter"],
      vibe: {
        en: "A revenge double-kill threat looms.",
        th: "การฆ่าซ้ำแก้แค้นรออยู่",
      },
    },
    {
      village: ["seer", "bodyguard"],
      vibe: {
        en: "Extra wolf hunting the lone Seer. Defend her.",
        th: "หมาป่ามากกว่าปกติ ล่าผู้หยั่งรู้ ต้องป้องกัน",
      },
    },
    {
      village: ["seer", "witch"],
      vibe: {
        en: "The Witch's save is your only safety net.",
        th: "พลังช่วยของแม่มดคือเครื่องป้องกันเดียว",
      },
    },
  ],
  "info-heavy": [
    {
      village: ["seer", "apprentice-seer", "aura-seer"],
      vibe: {
        en: "Three info roles. Deduction city.",
        th: "สามผู้หยั่งรู้ เมืองนักสืบ",
      },
    },
    {
      village: ["seer", "aura-seer", "paranormal-investigator"],
      vibe: {
        en: "Seer, Aura, and the P.I. all hunt.",
        th: "ผู้หยั่งรู้สามแบบล่าหมาป่าพร้อมกัน",
      },
    },
    {
      village: ["seer", "apprentice-seer", "paranormal-investigator"],
      vibe: {
        en: "Seer lineage with a one-shot P.I.",
        th: "ผู้หยั่งรู้สายเลือดเชื่อมกับนักสืบ",
      },
    },
  ],
  beginner: [
    {
      village: ["seer"],
      vibe: {
        en: "Pure roles, easy to teach.",
        th: "บทบาทพื้นฐาน สอนง่าย",
      },
    },
    {
      village: ["seer", "bodyguard"],
      vibe: {
        en: "Add a Bodyguard for first protection.",
        th: "เพิ่มบอดี้การ์ดเริ่มต้น",
      },
    },
    {
      village: ["seer", "hunter"],
      vibe: {
        en: "Hunter retaliation makes elimination scary.",
        th: "นักล่าทำให้การฆ่าน่ากลัว",
      },
    },
  ],
  "power-roles": [
    {
      village: ["seer", "witch", "prince"],
      vibe: {
        en: "Big abilities. Big swings.",
        th: "พลังพิเศษเยอะ พลิกผันได้",
      },
    },
    {
      village: ["witch", "bodyguard", "priest", "tough-guy"],
      vibe: {
        en: "Defensive village vs. converting Alpha.",
        th: "ชาวบ้านสายป้องกันเจอกับอัลฟ่า",
      },
    },
    {
      village: ["seer", "witch", "tough-guy", "prince"],
      vibe: {
        en: "Stack the village with survival tools.",
        th: "ทีมชาวบ้านเต็มไปด้วยเครื่องมือเอาตัวรอด",
      },
    },
  ],
  "social-bluff": [
    {
      village: ["mayor", "spellcaster", "mason", "mason"],
      vibe: {
        en: "No info. Just talk. Mayor breaks ties.",
        th: "ไม่มีข้อมูล พูดล้วน นายกฯ ตัดสินเสมอ",
      },
    },
    {
      // Note: prototype shipped this as ["mason","mason","spellcaster","old-hag"]
      // (village sum 6) which made `(social-bluff, players=10, variation=1)`
      // unachievable — wolf pool minimum 3-wolf sum is -15 vs target -9, so the
      // cell rendered |balance|=6 and tripped the US-023 audit. Swapping
      // `spellcaster` (+1) → `prince` (+3) lifts the village sum to 8 so the
      // solver can reach |balance| <= 5 across the whole 5–13 player span while
      // preserving the "no info, deduction by talk alone" social-bluff identity.
      village: ["mason", "mason", "prince", "old-hag"],
      vibe: {
        en: "Old Hag mutes the loud, Prince outvotes them all.",
        th: "แม่มดแก่ทำคนพูดเก่งเงียบ เจ้าชายชนะโหวต",
      },
    },
    {
      village: ["mayor", "mason", "mason", "old-hag"],
      vibe: {
        en: "Twin masons trust each other. No one else does.",
        th: "สมาคมลับไว้ใจกัน แต่ไม่มีใครเชื่อใคร",
      },
    },
  ],
  "neutral-mayhem": [
    {
      village: ["seer", "bodyguard"],
      neutrals: ["tanner", "hoodlum"],
      vibe: {
        en: "Tanner wants to die. Hoodlum plays hidden chess.",
        th: "คนฟอกหนังอยากตาย นักเลงเล่นหมากรุกแอบๆ",
      },
    },
    {
      village: ["seer", "witch", "bodyguard"],
      neutrals: ["tanner", "hoodlum"],
      vibe: {
        en: "Hoodlum plays hidden chess.",
        th: "นักเลงเล่นหมากรุกแอบๆ",
      },
    },
    {
      village: ["seer", "witch"],
      neutrals: ["tanner", "cult-leader"],
      vibe: {
        en: "Cult Leader recruits in the dark.",
        th: "หัวหน้าลัทธิเชิญคนเข้าลัทธิในความมืด",
      },
    },
  ],
  "balanced-power": [
    {
      village: ["seer", "witch", "bodyguard"],
      neutrals: ["tanner"],
      vibe: {
        en: "Strong info + power, Tanner wildcard.",
        th: "ข้อมูลกับพลังแข็ง คนฟอกหนังเป็นไวลด์การ์ด",
      },
    },
    {
      village: ["seer", "witch", "hunter"],
      neutrals: ["hoodlum"],
      vibe: {
        en: "Each side has its trump card.",
        th: "ทั้งสองฝ่ายมีไม้ตายของตัวเอง",
      },
    },
    {
      village: ["seer", "priest", "prince"],
      neutrals: ["cult-leader"],
      vibe: {
        en: "Defensive village vs. growing cult.",
        th: "ชาวบ้านสายป้องกันเจอกับลัทธิที่ขยายตัว",
      },
    },
  ],
}
