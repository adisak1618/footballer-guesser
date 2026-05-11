# Werewolf Role Balance Values

Single source of truth for the **village impact number** printed in the lower-right corner of every Werewolf role card. Used to balance a room setup: pick a role mix whose values sum near **zero** for a balanced game. Positive values favour the village team; negative values favour the werewolf team.

Source: the 39 cropped role cards under `apps/warewolf/source/processed/warewolf-card-cropped/`. Each value below was read directly from the card art (not from the booklet text, where the number is cut off in our scans).

Card count: 39 unique roles. Card #0003 from the original photo set was missing (bad source photo).

---

## Village team

| Role | Balance | Notes |
|---|---:|---|
| Seer | **+7** | Core info role |
| Mystic Seer | **+9** | Learns target's **exact role** each night (extra card, not in Ultimate Roles booklet) |
| Mentalist | **+6** | Compares two players per night (extra card) |
| Apprentice Seer | **+4** | Becomes Seer when Seer dies |
| Witch | **+4** | Save + kill, once each per game |
| Drunk | **+4** | Real role revealed on night 3 |
| Revealer | **+4** | Night kill if target is a Werewolf, else self-eliminates (extra card) |
| Aura Seer | **+3** | Detects non-Villager/non-Werewolf "special" roles |
| Bodyguard | **+3** | Per-night protection (no repeat target) |
| Hunter | **+3** | Revenge shot on death |
| Huntress | **+3** | One-shot night kill (extra card) |
| Tough Guy | **+3** | Survives first werewolf hit, dies next night |
| Prince | **+3** | Day-vote immunity (once) |
| Priest | **+3** | One-time night protection (blessing persists) |
| Paranormal Investigator | **+3** | One-night check of target + neighbours |
| Diseased | **+3** | Killing him costs wolves their next-night kill |
| Mayor | **+2** | Double vote |
| Mason | **+2** | Wakes with other Masons night one |
| Village Idiot | **+2** | Always votes down |
| Villager | **+1** | Vanilla |
| Spellcaster | **+1** | Mutes one player per night |
| Old Hag | **+1** | Daily pox (target sits out one day) |
| Pacifist | **−1** | Always votes to keep |
| Lycan | **−1** | Villager who reads as Werewolf to Seer |
| Mad Bomber | **−2** | On death, neighbours die too (extra card) |
| Doppelgänger | **−2** | Copies eliminated target's role |
| Troublemaker | **−3** | Once-per-game double-elimination day |
| Cursed | (see below) | Counts on the village side until targeted |

> **Cursed** has no positive number printed in our scan — the card has a red wolf-side bar with **−3** in the corner. Treat it as a werewolf-aligned card for balance purposes; in play it starts village-aligned and flips when targeted.

## Werewolf team

| Role | Balance | Notes |
|---|---:|---|
| Werewolf | **−6** | Core wolf |
| Wolf Cub | **−8** | Death → wolves kill two next night |
| Alpha Wolf | **−9** | Once per game, convert a wolf target instead of killing (extra card) |
| Sorceress | **−3** | Hunts the Seer; doesn't know the wolves in base rule |
| Minion | **−6** | Knows wolves, doesn't wake with them |
| Cursed | **−3** | (Village-flagged role; counts wolf-side once flipped) |

## Neutral / independent

| Role | Balance | Notes |
|---|---:|---|
| Cult Leader | **+1** | Wins when every remaining player is in his cult |
| Ghost | **+2** | Killed night 1, sends a 10-letter message |
| Hoodlum | **0** | Wins if his two targets both die and he survives |
| Tanner | **−2** | Wins by being eliminated |
| Lone Wolf | **−5** | Solo werewolf; wins only as last player standing |
| Vampire | **−7** | Banked night-kill; immune to werewolf elimination |

---

## Setup rule (from the booklet, page 6 — "Tilting the Game")

> The higher the positive number, the more in favor the game will be for the Villagers. The greater the negative value, the more in favor the game will be for the Werewolves. The numbers are guidelines, but keeping the sum close to zero will result in the most balanced game possible.

**For our app's room-setup balance UI:**

1. Each selected card contributes its value to a running total.
2. Show the host the running sum and a target band (suggest **−2 ≤ sum ≤ +2** as "balanced").
3. Group-experience modifier (from the booklet, page 7):
   - Strangers favour the wolf team → bias the deck **+5** above zero.
   - Experienced group favours the village team → bias **−5** below zero (give the wolves extra power).
4. Werewolf count separately must keep a reasonable wolf:village ratio (booklet suggests roughly **1 wolf per 4 players**, scaling as group grows).

---

## Cross-check against our curated 15-role set

| Our role | Balance | Team |
|---|---:|---|
| Werewolf | −6 | Wolf |
| Wolf Cub | −8 | Wolf |
| Minion | −6 | Wolf |
| Sorcerer / Sorceress | −3 | Wolf |
| Seer | +7 | Village |
| Villager | +1 | Village |
| Cupid | −3 | Village (Sweetheart override) |
| Bodyguard | +3 | Village |
| Prince | +3 | Village |
| Mayor | +2 | Village |
| Hunter | +3 | Village |
| Tough Guy | +3 | Village |
| Old Hag | +1 | Village |
| Lycan | −1 | Village |
| Tanner | −2 | Neutral |

**Curated-set baseline sum** if all 15 are in play once: `−6 −8 −6 −3 +7 +1 −3 +3 +3 +2 +3 +3 +1 −1 −2 = −6`.

That's wolf-favoured — meaning a "all 15 roles once each" scenario needs additional plain Villagers (each +1) to drift back toward zero. Six extra Villagers brings the sum to zero, suggesting a baseline of ~21 players if you deal every curated role exactly once.

---

## Machine-readable export (for the app)

```json
{
  "village": {
    "seer": 7, "mystic-seer": 9, "mentalist": 6,
    "apprentice-seer": 4, "witch": 4, "drunk": 4, "revealer": 4,
    "aura-seer": 3, "bodyguard": 3, "hunter": 3, "huntress": 3,
    "tough-guy": 3, "prince": 3, "priest": 3,
    "paranormal-investigator": 3, "diseased": 3,
    "mayor": 2, "mason": 2, "village-idiot": 2,
    "villager": 1, "spellcaster": 1, "old-hag": 1,
    "pacifist": -1, "lycan": -1,
    "mad-bomber": -2, "doppelganger": -2,
    "troublemaker": -3
  },
  "werewolf": {
    "werewolf": -6, "wolf-cub": -8, "alpha-wolf": -9,
    "sorceress": -3, "minion": -6, "cursed": -3
  },
  "neutral": {
    "cult-leader": 1, "ghost": 2, "hoodlum": 0,
    "tanner": -2, "lone-wolf": -5, "vampire": -7
  }
}
```

Cupid's printed value is **−3** (read directly from the card art) — listed under village even though Sweetheart status can override the team alignment in play.

---

## Provenance

Every value above was read from the lower-right corner of the cropped card image at `apps/warewolf/source/processed/warewolf-card-cropped/<role>.jpg`. If you re-scan or re-crop the deck, re-verify the values here. The booklet text (`ultimate-roles.md`) describes the mechanics but the **numbers live on the cards themselves**.
