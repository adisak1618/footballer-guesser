// Frozen V1 role catalog for the Warewolf balance & setup recommender.
// Shared across apps (apps/warewolf today; multiplayer game later).
// Source of truth for: solver (apps/warewolf/lib/solver.ts), validator
// (apps/warewolf/lib/validator.ts), customize-page tab mapping
// (apps/warewolf/lib/category-tabs.ts), and the Sharp card-art pipeline.
//
// 22 V1 roles per design doc Premise #8 (lines 286–293):
//   Wolf-team (5)        | werewolf, wolf-cub, alpha-wolf, minion, sorceress
//   Village info (4)     | seer, apprentice-seer, aura-seer, paranormal-investigator
//   Village power (8)    | witch, bodyguard, hunter, tough-guy, prince, priest, mayor, drunk
//   Village vanilla (4)  | villager, mason, spellcaster, old-hag
//   Neutral (4)          | tanner, lone-wolf, hoodlum, cult-leader
//
// Balance values: apps/warewolf/source/game-rule/role-balance.md (machine block).
// Mechanic descriptions: apps/warewolf/source/game-rule/ultimate-roles.md.
// Thai strings: AI placeholder (Pass 7 blocker #3 owns the native-voice rewrite).

export type Team = "village" | "werewolf" | "neutral"

// Fine-grained category. The customize-page 6-tab mapping
// (lib/category-tabs.ts, locked by Eng Review decision #6) derives:
//   wolves  = team === 'werewolf'
//   info    = category === 'info'
//   power   = category ∈ {protection, kill, vote}
//   social  = category === 'chaos' || roleId ∈ {mason, spellcaster, old-hag}
//   neutral = team === 'neutral'
export type Category =
  | "info"
  | "protection"
  | "kill"
  | "vote"
  | "chaos"
  | "vanilla"
  | "neutral"

export interface RoleI18nEntry {
  name: string
  short: string
  description: string
}

export interface Role {
  id: RoleId
  team: Team
  category: Category
  /** Signed int. Positive favours village; negative favours wolves. */
  balance: number
  i18n: {
    en: RoleI18nEntry
    th: RoleI18nEntry
  }
  /** Resolved at runtime by apps/warewolf/components/CardArt. File exists post-US-012. */
  cardArtPath: string
}

// Literal-union RoleId — used by the solver and validator for exhaustive checks.
export type RoleId =
  | "werewolf"
  | "wolf-cub"
  | "alpha-wolf"
  | "minion"
  | "sorceress"
  | "seer"
  | "apprentice-seer"
  | "aura-seer"
  | "paranormal-investigator"
  | "witch"
  | "bodyguard"
  | "hunter"
  | "tough-guy"
  | "prince"
  | "priest"
  | "mayor"
  | "drunk"
  | "villager"
  | "mason"
  | "spellcaster"
  | "old-hag"
  | "tanner"
  | "lone-wolf"
  | "hoodlum"
  | "cult-leader"

const cardArt = (id: RoleId): string => `packages/content/card-art/${id}.webp`

export const ROLES: Readonly<Record<RoleId, Role>> = Object.freeze({
  // ---------- Wolf-team (5) ----------
  werewolf: {
    id: "werewolf",
    team: "werewolf",
    category: "kill",
    balance: -6,
    cardArtPath: cardArt("werewolf"),
    i18n: {
      en: {
        name: "Werewolf",
        short: "Core wolf",
        description:
          "Wakes with the pack each night to choose a villager to eliminate. The core wolf role.",
      },
      th: {
        name: "หมาป่า",
        short: "หมาป่าหลัก",
        description:
          "ตื่นกับฝูงในแต่ละคืน เลือกฆ่าชาวบ้านหนึ่งคน เป็นบทบาทหมาป่าหลัก",
      },
    },
  },
  "wolf-cub": {
    id: "wolf-cub",
    team: "werewolf",
    category: "kill",
    balance: -8,
    cardArtPath: cardArt("wolf-cub"),
    i18n: {
      en: {
        name: "Wolf Cub",
        short: "Death → 2 kills next night",
        description:
          "Wakes with the wolves. If killed, the wolves get to eliminate TWO players the next night.",
      },
      th: {
        name: "ลูกหมาป่า",
        short: "ตาย → ฆ่า 2 คนคืนถัดไป",
        description: "ตื่นกับฝูง ถ้าตาย หมาป่าจะฆ่าได้ 2 คนในคืนถัดไป",
      },
    },
  },
  "alpha-wolf": {
    id: "alpha-wolf",
    team: "werewolf",
    category: "kill",
    balance: -9,
    cardArtPath: cardArt("alpha-wolf"),
    i18n: {
      en: {
        name: "Alpha Wolf",
        short: "Convert once per game",
        description:
          "Once per game, may convert a villager target into a new wolf instead of killing them.",
      },
      th: {
        name: "จ่าฝูง",
        short: "เปลี่ยนเป็นหมาป่า 1 ครั้ง",
        description:
          "หนึ่งครั้งต่อเกม สามารถเปลี่ยนเป้าหมายให้เป็นหมาป่าแทนที่จะฆ่า",
      },
    },
  },
  minion: {
    id: "minion",
    team: "werewolf",
    category: "vanilla",
    balance: -6,
    cardArtPath: cardArt("minion"),
    i18n: {
      en: {
        name: "Minion",
        short: "Knows the wolves",
        description:
          "Knows who the wolves are but does not wake with them. The Seer sees the Minion as a Villager.",
      },
      th: {
        name: "ลูกน้อง",
        short: "รู้ตัวหมาป่า",
        description:
          "รู้ว่าใครเป็นหมาป่า แต่ไม่ตื่นกับฝูง ผู้หยั่งรู้เห็นเป็นชาวบ้าน",
      },
    },
  },
  sorceress: {
    id: "sorceress",
    team: "werewolf",
    category: "info",
    balance: -3,
    cardArtPath: cardArt("sorceress"),
    i18n: {
      en: {
        name: "Sorceress",
        short: "Hunts the Seer",
        description:
          "Each night points at a player. The Moderator confirms only if the target is the Seer. Does not know the wolves.",
      },
      th: {
        name: "แม่มดดำ",
        short: "ตามล่าผู้หยั่งรู้",
        description:
          "แต่ละคืนชี้เป้าหมาย ผู้ดำเนินเกมยืนยันเฉพาะถ้าเป้าหมายคือผู้หยั่งรู้",
      },
    },
  },

  // ---------- Village info (4) ----------
  seer: {
    id: "seer",
    team: "village",
    category: "info",
    balance: 7,
    cardArtPath: cardArt("seer"),
    i18n: {
      en: {
        name: "Seer",
        short: "Sees one role per night",
        description:
          "Each night points at one player. The Moderator silently signals Villager (V) or Werewolf (W). Core info role.",
      },
      th: {
        name: "ผู้หยั่งรู้",
        short: "ดูบทบาทคืนละหนึ่งคน",
        description:
          "แต่ละคืนชี้ผู้เล่นหนึ่งคน ผู้ดำเนินเกมจะส่งสัญญาณเงียบว่าเป็นชาวบ้านหรือหมาป่า",
      },
    },
  },
  "apprentice-seer": {
    id: "apprentice-seer",
    team: "village",
    category: "info",
    balance: 4,
    cardArtPath: cardArt("apprentice-seer"),
    i18n: {
      en: {
        name: "Apprentice Seer",
        short: "Inherits the Seer",
        description:
          "Becomes the Seer when the Seer dies. Silent handoff via shoulder-tap from the Moderator.",
      },
      th: {
        name: "ลูกศิษย์ผู้หยั่งรู้",
        short: "สืบทอดจากผู้หยั่งรู้",
        description: "กลายเป็นผู้หยั่งรู้เมื่อผู้หยั่งรู้คนเดิมตาย",
      },
    },
  },
  "aura-seer": {
    id: "aura-seer",
    team: "village",
    category: "info",
    balance: 3,
    cardArtPath: cardArt("aura-seer"),
    i18n: {
      en: {
        name: "Aura Seer",
        short: "Detects special roles",
        description:
          "Each night points at a player. The Moderator confirms only if the target has a special (non-vanilla) role.",
      },
      th: {
        name: "ผู้เห็นออร่า",
        short: "ตรวจหาบทบาทพิเศษ",
        description:
          "แต่ละคืนชี้ผู้เล่น ผู้ดำเนินเกมยืนยันเฉพาะถ้าเป้าหมายมีบทบาทพิเศษ",
      },
    },
  },
  "paranormal-investigator": {
    id: "paranormal-investigator",
    team: "village",
    category: "info",
    balance: 3,
    cardArtPath: cardArt("paranormal-investigator"),
    i18n: {
      en: {
        name: "P.I.",
        short: "One-time 3-player check",
        description:
          "One night during the game, points at one player. Moderator confirms whether at least one of (target, left-neighbor, right-neighbor) is a Werewolf.",
      },
      th: {
        name: "นักสืบเหนือธรรมชาติ",
        short: "ตรวจครั้งเดียว 3 คน",
        description:
          "หนึ่งคืนต่อเกม ตรวจสอบว่าเป้าหมายหรือคนข้างๆ มีใครเป็นหมาป่าหรือไม่",
      },
    },
  },

  // ---------- Village power (8) ----------
  witch: {
    id: "witch",
    team: "village",
    category: "kill",
    balance: 4,
    cardArtPath: cardArt("witch"),
    i18n: {
      en: {
        name: "Witch",
        short: "Save + kill, once each",
        description:
          "Has two one-shot powers: save a player who was eliminated at night, OR eliminate a player of her choice. Both can be used on the same night.",
      },
      th: {
        name: "แม่มด",
        short: "ช่วย + ฆ่า อย่างละครั้ง",
        description:
          "มีพลังพิเศษสองอย่างใช้ได้คนละครั้ง ช่วยคนที่ถูกฆ่ากลางคืนหรือฆ่าคนที่เลือก",
      },
    },
  },
  bodyguard: {
    id: "bodyguard",
    team: "village",
    category: "protection",
    balance: 3,
    cardArtPath: cardArt("bodyguard"),
    i18n: {
      en: {
        name: "Bodyguard",
        short: "Per-night protection",
        description:
          "Each night picks a different player to protect. That player cannot be eliminated that night. May not protect himself or repeat targets.",
      },
      th: {
        name: "บอดี้การ์ด",
        short: "ป้องกันคืนละคน",
        description:
          "แต่ละคืนเลือกคนเดียวที่แตกต่างกันเพื่อป้องกัน ป้องกันตัวเองไม่ได้ ห้ามซ้ำคน",
      },
    },
  },
  hunter: {
    id: "hunter",
    team: "village",
    category: "kill",
    balance: 3,
    cardArtPath: cardArt("hunter"),
    i18n: {
      en: {
        name: "Hunter",
        short: "Revenge shot on death",
        description:
          "When eliminated (day or night), immediately fires his weapon at any player, eliminating them. May also choose to shoot the sky.",
      },
      th: {
        name: "นักล่า",
        short: "ยิงสวนตอนตาย",
        description:
          "เมื่อตาย (กลางวันหรือกลางคืน) ยิงผู้เล่นคนใดก็ได้ให้ตายตามไปด้วย",
      },
    },
  },
  "tough-guy": {
    id: "tough-guy",
    team: "village",
    category: "protection",
    balance: 3,
    cardArtPath: cardArt("tough-guy"),
    i18n: {
      en: {
        name: "Tough Guy",
        short: "Survives first hit",
        description:
          "If targeted by Werewolves, is eliminated the FOLLOWING night instead. No one dies the night he is hit; the next night may produce multiple eliminations.",
      },
      th: {
        name: "นักสู้แกร่ง",
        short: "รอดครั้งแรก",
        description:
          "ถ้าหมาป่าฆ่า จะตายในคืนถัดไปแทน คืนที่โดนจะไม่มีใครตาย",
      },
    },
  },
  prince: {
    id: "prince",
    team: "village",
    category: "protection",
    balance: 3,
    cardArtPath: cardArt("prince"),
    i18n: {
      en: {
        name: "Prince",
        short: "Survives one day-vote",
        description:
          "If voted to be eliminated during the day, he reveals as Prince and survives. The village falls asleep immediately as if elimination had succeeded.",
      },
      th: {
        name: "เจ้าชาย",
        short: "รอดโหวต 1 ครั้ง",
        description:
          "ถ้าโดนโหวตให้ตายตอนกลางวัน เปิดไพ่ Prince และรอด หมู่บ้านหลับทันที",
      },
    },
  },
  priest: {
    id: "priest",
    team: "village",
    category: "protection",
    balance: 3,
    cardArtPath: cardArt("priest"),
    i18n: {
      en: {
        name: "Priest",
        short: "One-time blessing",
        description:
          "Once per game, may bless a player at night. The next elimination attempt on that player fails. Blessing persists even after the Priest dies.",
      },
      th: {
        name: "นักบวช",
        short: "ให้พร 1 ครั้ง",
        description:
          "หนึ่งครั้งต่อเกม สามารถปกป้องคนหนึ่งคน การฆ่าครั้งถัดไปต่อคนนั้นจะล้มเหลว",
      },
    },
  },
  mayor: {
    id: "mayor",
    team: "village",
    category: "vote",
    balance: 2,
    cardArtPath: cardArt("mayor"),
    i18n: {
      en: {
        name: "Mayor",
        short: "Double vote",
        description:
          "The Mayor's day vote counts twice. The Moderator silently double-counts it. Often dealt as a card or elected by the village on day one.",
      },
      th: {
        name: "นายกเทศมนตรี",
        short: "โหวตนับสองเสียง",
        description:
          "เสียงโหวตของนายกฯ นับเป็นสองเสียง ผู้ดำเนินเกมนับเงียบๆ",
      },
    },
  },
  drunk: {
    id: "drunk",
    team: "village",
    category: "vote",
    balance: 4,
    cardArtPath: cardArt("drunk"),
    i18n: {
      en: {
        name: "Drunk",
        short: "Real role revealed N3",
        description:
          "Thinks he is a plain Villager for the first two days. On the third night, the Moderator reveals his real role (drawn from a special pool).",
      },
      th: {
        name: "คนเมา",
        short: "เปิดบทบาทจริงคืนที่ 3",
        description:
          "คิดว่าเป็นชาวบ้านธรรมดาสองวันแรก คืนที่สามผู้ดำเนินเกมจะเปิดเผยบทบาทจริง",
      },
    },
  },

  // ---------- Village vanilla / social (4) ----------
  villager: {
    id: "villager",
    team: "village",
    category: "vanilla",
    balance: 1,
    cardArtPath: cardArt("villager"),
    i18n: {
      en: {
        name: "Villager",
        short: "No ability",
        description:
          "No special ability. Find and eliminate the Werewolves through deduction, observation, and discussion.",
      },
      th: {
        name: "ชาวบ้าน",
        short: "ไม่มีพลังพิเศษ",
        description:
          "ไม่มีพลังพิเศษ หาและกำจัดหมาป่าด้วยการพูดคุย สังเกต และวิเคราะห์",
      },
    },
  },
  mason: {
    id: "mason",
    team: "village",
    category: "vanilla",
    balance: 2,
    cardArtPath: cardArt("mason"),
    i18n: {
      en: {
        name: "Mason",
        short: "Knows other Masons",
        description:
          "On the first night the Masons open their eyes and identify each other. No one in the village may discuss Masons directly or indirectly.",
      },
      th: {
        name: "สมาคมลับ",
        short: "รู้จักสมาคมลับด้วยกัน",
        description:
          "คืนแรก สมาคมลับลืมตาเห็นกัน ห้ามใครพูดถึงสมาคมลับโดยตรงหรืออ้อม",
      },
    },
  },
  spellcaster: {
    id: "spellcaster",
    team: "village",
    category: "vanilla",
    balance: 1,
    cardArtPath: cardArt("spellcaster"),
    i18n: {
      en: {
        name: "Spellcaster",
        short: "Mutes one per night",
        description:
          "Each night may choose one player to be muted for the following day. The muted player may not speak but may communicate any other way.",
      },
      th: {
        name: "หมอสะกด",
        short: "ใบ้คำคืนละคน",
        description: "แต่ละคืนสามารถใบ้คำพูดคนหนึ่งคนสำหรับวันถัดไป",
      },
    },
  },
  "old-hag": {
    id: "old-hag",
    team: "village",
    category: "vanilla",
    balance: 1,
    cardArtPath: cardArt("old-hag"),
    i18n: {
      en: {
        name: "Old Hag",
        short: "Daily pox",
        description:
          "Each night places a 'pox' on a player. The poxed player must leave the game area for one day — no discussion, no voting.",
      },
      th: {
        name: "แม่มดแก่",
        short: "สาปออกจากเกม 1 วัน",
        description:
          "แต่ละคืนสาปคนหนึ่งคน คนถูกสาปต้องออกจากเกมหนึ่งวัน ห้ามคุยห้ามโหวต",
      },
    },
  },

  // ---------- Neutral (4) ----------
  tanner: {
    id: "tanner",
    team: "neutral",
    category: "neutral",
    balance: -2,
    cardArtPath: cardArt("tanner"),
    i18n: {
      en: {
        name: "Tanner",
        short: "Wins by being killed",
        description:
          "Wins ONLY if he is eliminated. Other teams' win conditions still apply; the game continues after the Tanner wins.",
      },
      th: {
        name: "คนฟอกหนัง",
        short: "ชนะถ้าตาย",
        description:
          "ชนะเฉพาะถ้าตัวเองตายเท่านั้น ทีมอื่นยังเล่นต่อหลังคนฟอกหนังชนะ",
      },
    },
  },
  "lone-wolf": {
    id: "lone-wolf",
    team: "neutral",
    category: "neutral",
    balance: -5,
    cardArtPath: cardArt("lone-wolf"),
    i18n: {
      en: {
        name: "Lone Wolf",
        short: "Solo werewolf win",
        description:
          "Wins ONLY if he is the last player standing, or one of the last two with one non-Werewolf remaining. Wakes with the pack to choose targets.",
      },
      th: {
        name: "หมาป่าโดดเดี่ยว",
        short: "ชนะคนเดียว",
        description:
          "ชนะเฉพาะถ้าเป็นคนสุดท้ายที่รอด ตื่นกับหมาป่าตอนกลางคืน",
      },
    },
  },
  hoodlum: {
    id: "hoodlum",
    team: "neutral",
    category: "neutral",
    balance: 0,
    cardArtPath: cardArt("hoodlum"),
    i18n: {
      en: {
        name: "Hoodlum",
        short: "Two-target hit list",
        description:
          "On the first night indicates two players. Wins only if BOTH of those players are eliminated and the Hoodlum is still alive.",
      },
      th: {
        name: "นักเลง",
        short: "ฆ่า 2 เป้าหมาย",
        description: "คืนแรกเลือกสองคน ชนะถ้าทั้งสองตายและตัวเองยังอยู่",
      },
    },
  },
  "cult-leader": {
    id: "cult-leader",
    team: "neutral",
    category: "neutral",
    balance: 1,
    cardArtPath: cardArt("cult-leader"),
    i18n: {
      en: {
        name: "Cult Leader",
        short: "Recruit the village",
        description:
          "Each night picks a player to add to the cult. Wins if every remaining player in the game is in his cult.",
      },
      th: {
        name: "หัวหน้าลัทธิ",
        short: "ชวนเข้าลัทธิทั้งหมู่บ้าน",
        description:
          "แต่ละคืนชวนคนเข้าลัทธิ ชนะถ้าทุกคนในเกมเข้าลัทธิหมด",
      },
    },
  },
})

/** All 22 V1 role IDs as a frozen array, useful for iteration. */
export const ROLE_IDS: readonly RoleId[] = Object.freeze(
  Object.keys(ROLES) as RoleId[],
)
