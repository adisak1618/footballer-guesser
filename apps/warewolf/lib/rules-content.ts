/**
 * Rules page content (US-022).
 *
 * Source: `apps/warewolf/source/game-rule/getting-started.md` (chapters I–VI).
 * Role compendium (chapter VII) is derived from `@social-hub/content` ROLES
 * at render time — keeps role mechanics in one place.
 *
 * Structure: each chapter is a flat list of blocks. The page renders only
 * the active locale's blocks per the reconciliation pass decision to ship
 * one language at a time (the lang toggle in the topbar switches segments).
 *
 * Roman-numeral chapter ids match `approved.json` chapter_structure and the
 * wireframe's TOC. Section anchors are `#ch-1`..`#ch-6` and `#ch-7` for the
 * compendium so IntersectionObserver scrollspy can key off them.
 */

export type RulesBlock =
  | { kind: "p"; en: string; th: string; dropcap?: boolean }
  | { kind: "quote"; en: string; th: string }
  | { kind: "role"; roleId: "seer" | "werewolf" }

export interface RulesChapter {
  /** DOM id used by anchors + scrollspy. */
  id: string
  /** Roman numeral display token (I..VII). */
  roman: string
  titleEn: string
  titleTh: string
  blocks: RulesBlock[]
}

/**
 * Chapters I–VI. Chapter VII (Role Compendium) is rendered separately by the
 * page because it needs the live ROLES catalogue + tabbed pagination by team.
 */
export const RULES_CHAPTERS: readonly RulesChapter[] = [
  {
    id: "ch-1",
    roman: "I",
    titleEn: "Setting Up",
    titleTh: "ตั้งค่า",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "Ultimate Werewolf is a game of deduction for two teams — Villagers and Werewolves. The Villagers don't know who the Werewolves are; the Werewolves try to stay hidden while they pick off the village one body at a time. A Moderator (who isn't on either team) runs the game.",
        th: "หมาป่าคือเกมแห่งการสืบสวน สองทีมประลองกัน — ชาวบ้าน และ หมาป่า ชาวบ้านไม่รู้ว่าใครคือหมาป่า ส่วนหมาป่าก็พยายามซ่อนตัวพร้อมไล่ฆ่าชาวบ้านทีละคน ผู้ดำเนินเกม (ไม่ได้อยู่ฝ่ายใด) เป็นคนคุมจังหวะเกม",
      },
      {
        kind: "p",
        en: "For your first round, deal one Seer card, plus 1 Werewolf for 6–8 players, 2 for 9–11, or 3 for 12–15. The remaining players are Villagers. Sit in a circle, shuffle the cards, and deal one face-down to each player.",
        th: "สำหรับเกมแรก ใส่ผู้หยั่งรู้ 1 ใบ + หมาป่า 1 ตัวสำหรับ 6–8 คน, 2 ตัวสำหรับ 9–11 คน, หรือ 3 ตัวสำหรับ 12–15 คน ผู้เล่นที่เหลือเป็นชาวบ้าน นั่งเป็นวงกลม สลับไพ่ แล้วแจกคว่ำหน้าคนละใบ",
      },
      {
        kind: "quote",
        en: "Look at your card secretly. Do not reveal it to anyone. No talking until the first day.",
        th: "ดูไพ่ของตัวเองให้เรียบร้อย ห้ามให้ใครเห็น ห้ามคุยกันจนกว่าจะถึงวันแรก",
      },
    ],
  },
  {
    id: "ch-2",
    roman: "II",
    titleEn: "The First Night",
    titleTh: "คืนแรก",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "On the first night, the Moderator wakes the Werewolves so they may see each other, then wakes the Seer so she may learn one player's allegiance. Villagers are never woken at night.",
        th: "คืนแรก ผู้ดำเนินเกมปลุกหมาป่าให้รู้จักกัน ตามด้วยปลุกผู้หยั่งรู้เพื่อชี้ตัวผู้เล่นหนึ่งคน ชาวบ้านจะไม่ถูกปลุกตอนกลางคืน",
      },
      {
        kind: "quote",
        en: "Everyone in the village falls asleep. All players close your eyes.",
        th: "ทุกคนในหมู่บ้านหลับไป ผู้เล่นทุกคนปิดตา",
      },
      {
        kind: "p",
        en: "The Moderator signals the Seer silently — a V (index + thumb) for Villager, or a W (two thumbs together, fingers extended) for Werewolf. The Seer's knowledge is private; if she speaks too openly, the wolves will hunt her first.",
        th: "ผู้ดำเนินเกมส่งสัญญาณให้ผู้หยั่งรู้แบบเงียบ — เครื่องหมาย V สำหรับชาวบ้าน เครื่องหมาย W สำหรับหมาป่า ความรู้ของผู้หยั่งรู้เป็นความลับ ถ้าพูดเปิดเผยเกินไป หมาป่าจะล่าเธอเป็นคนแรก",
      },
      { kind: "role", roleId: "seer" },
    ],
  },
  {
    id: "ch-3",
    roman: "III",
    titleEn: "The First Day",
    titleTh: "วันแรก",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "When the village wakes, each player introduces themselves in turn — name, perhaps a trade or a quirk. The Werewolves and the Seer must lie about who they are, claiming to be ordinary Villagers.",
        th: "เมื่อหมู่บ้านตื่น ผู้เล่นทุกคนแนะนำตัวเองทีละคน — ชื่อ อาจมีอาชีพหรือนิสัยขำๆ หมาป่าและผู้หยั่งรู้ต้องโกหก อ้างว่าตัวเองเป็นชาวบ้านธรรมดา",
      },
      {
        kind: "p",
        en: "The first accusation begins debate. Another player must second the accusation before a vote begins. Strict majority (more than half) eliminates. The card is revealed; the eliminated player leaves the circle but stays to watch in silence.",
        th: "ข้อกล่าวหาแรกเริ่มต้นการถกเถียง ต้องมีอีกคนรับรองก่อนถึงจะโหวต ใช้เสียงข้างมากเด็ดขาด (เกินครึ่ง) ในการกำจัด เปิดไพ่ของคนที่ถูกกำจัด ผู้เล่นออกจากวงแต่อยู่ดูเงียบๆ ได้",
      },
    ],
  },
  {
    id: "ch-4",
    roman: "IV",
    titleEn: "Every Night",
    titleTh: "ทุกคืน",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "After the first night, the Moderator calls the Werewolves and has them point silently at a player to eliminate — they must all agree. Then the Seer is called and points at one player; the Moderator returns the V or W sign privately.",
        th: "หลังคืนแรก ผู้ดำเนินเกมปลุกหมาป่าให้ชี้ตัวผู้เล่นที่จะกำจัด ต้องตกลงกันให้ได้ทุกตัว จากนั้นปลุกผู้หยั่งรู้ให้ชี้หนึ่งคน ผู้ดำเนินเกมส่งสัญญาณ V หรือ W อย่างเงียบเชียบ",
      },
      { kind: "role", roleId: "werewolf" },
    ],
  },
  {
    id: "ch-5",
    roman: "V",
    titleEn: "Every Day & Voting",
    titleTh: "ทุกวันและการโหวต",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "Each day starts with the Moderator naming the player the wolves killed during the night and showing that player's card to all. Discussion then opens, accusations fly, and the cycle resumes.",
        th: "ทุกวันเริ่มด้วยผู้ดำเนินเกมประกาศชื่อผู้เล่นที่หมาป่าฆ่าในคืนที่ผ่านมา และเปิดไพ่ให้ทุกคนเห็น จากนั้นเปิดเวทีถกเถียง ข้อกล่าวหาเริ่มลอย และวัฏจักรเดินต่อ",
      },
      {
        kind: "quote",
        en: "Point at them and say 'I accuse Bob.' If another player seconds, Bob may defend himself. Then we vote — thumbs up to stay, thumbs down to be eliminated.",
        th: "ชี้ที่ผู้เล่นและพูดว่า 'ฉันกล่าวหาคนนี้' ถ้ามีอีกคนรับรอง ผู้ถูกกล่าวหาแก้ต่างได้ จากนั้นโหวต — โป้งขึ้นเพื่อให้อยู่ โป้งลงเพื่อกำจัด",
      },
      {
        kind: "p",
        en: "Set a soft timer of about ten minutes per day. If no one is eliminated when time is up, the village falls silent and night begins again.",
        th: "ตั้งเวลาคร่าวๆ ราวสิบนาทีต่อหนึ่งวัน ถ้าไม่มีใครถูกกำจัดในเวลานั้น หมู่บ้านจะเงียบลงและเข้าสู่กลางคืนต่อ",
      },
    ],
  },
  {
    id: "ch-6",
    roman: "VI",
    titleEn: "Ending the Game",
    titleTh: "จบเกม",
    blocks: [
      {
        kind: "p",
        dropcap: true,
        en: "If the Villagers eliminate every Werewolf, the village wins. If the Werewolves ever number as many as — or more than — the remaining Villagers, the wolves win. Players still alive reveal their cards; the rest of the evening is for retelling who fooled whom.",
        th: "ถ้าชาวบ้านฆ่าหมาป่าครบทุกตัว ชาวบ้านชนะ ถ้าหมาป่าเหลือเท่ากับหรือมากกว่าชาวบ้านเมื่อไหร่ หมาป่าชนะ ผู้เล่นที่ยังเหลือเปิดไพ่ของตัวเอง ที่เหลือของค่ำคืนคือการเล่าว่าใครหลอกใครได้บ้าง",
      },
    ],
  },
] as const
