# Ultimate Werewolf — Getting Started (Rulebook Transcript)

Source: 4-page rulebook insert from *Ultimate Werewolf* (Bézier Games, 2015), designed by Ted Alspach.
Original scans: `apps/warewolf/source/raw/getting-started-rule/Page-{1..4}.JPG`.

This is the **base/simplest** version of Ultimate Werewolf — 3 roles only: Werewolf, Seer, Villager. Expanded roles (Bodyguard, Hunter, Witch, etc.) come from later Bézier sets and carry the +/− balance values we're adopting separately.

---

## Page 1 — Intro & Setup

**ULTIMATE WEREWOLF — GETTING STARTED**

*Ultimate Werewolf* is an interactive game of deduction for two teams: Villagers and Werewolves. The Villagers don't know who the Werewolves are, and the Werewolves are trying to remain undiscovered while they slowly eliminate the Villagers one at a time. A Moderator (who isn't on a team) runs the game.

*Ultimate Werewolf* takes place over a series of game days and nights. Each day, the players discuss who among them is a Werewolf, and vote out a player. Each night, the Werewolves choose a player to eliminate, while the Seer learns if one player is a Werewolf or not. The game is over when either all the Villagers or all the Werewolves are eliminated.

### SETUP

For your first game, use the following cards:

- **1 Seer card**
- **Werewolf cards**: 1 for 6–8 players, 2 for 9–11, or 3 for 12–15
- **1 Villager card** for each of the remaining players

Determine who will be the Moderator for the game. All the other players sit in a circle. The Moderator shuffles the cards and deals one face down to each player. Each player should look at his card secretly, being careful not to reveal it to anyone.

At this time there should be no talking from anyone except the Moderator until the following game day.

---

## Page 2 — The First Night & The First Day

### THE FIRST NIGHT

On the first game night, the Moderator will call out the roles of Werewolves and then the Seer separately, so he knows which players are in those roles, and so the Werewolves can see who the other Werewolves are. The Villagers are never woken up at night.

The night phase works by the Moderator saying the following:

> "Everyone in the village falls asleep. All players should close their eyes."

The Moderator checks to be sure that all players have their eyes closed.

> "Werewolves, open your eyes and look for other Werewolves."

The Werewolves open their eyes and see who else is a Werewolf (quietly, so no one can hear them). The Moderator takes note of who those Werewolves are.

> "Werewolves, close your eyes." (Pause)
> "Seer, open your eyes and indicate a player."

The Werewolves close their eyes, then the Seer opens her eyes and silently points to a player. The Moderator shows a **"V"** with his index finger and thumb if the target is a Villager, or a **"W"** by placing two thumbs together with index fingers extended up and out to the sides.

> "Seer, close your eyes." (Pause) "Everyone wakes up to find that Werewolves have overrun your once-peaceful village. It is up to you to find and eliminate those Werewolves."

All players open their eyes.

### THE FIRST DAY

The first day should be used for introducing each of the players by going around the circle and having each player say something about themselves. This can be as simple as *"My name is Bob, and I'm a Villager,"* to something more elaborate such as *"I'm Bob, the village donut maker, and as everyone knows, Werewolves don't like donuts."* Players should not claim to be a Werewolf or the Seer; players with those roles should lie about their true identity, claiming to be a simple Villager.

Players may say anything they like, but they may never show their card to anyone.

---

## Page 3 — Accusation, Every Night, Every Day

After the players introduce themselves, the Moderator describes how to accuse someone of being a werewolf and how to vote.

> "To accuse someone of being a Werewolf, point at them and say 'I accuse Bob.' If another player seconds the accusation, Bob may defend himself, and then we'll vote: Thumbs up to stay, thumbs down to be eliminated. If you eliminate a player, his role will be revealed and the village will fall asleep immediately. If not, continue discussions until the next accusation."

If *more than half* of the players vote down on a player, he is eliminated, and his role card is revealed. That player may not speak at all once his card is revealed, and should leave his place in the circle (but should stick around to silently watch the rest of the game).

The Moderator should set a predetermined time limit on the length of the first day (such as **10 minutes**), and if no one has been eliminated by then, the village falls asleep immediately. Be sure to inform the village when time is almost up.

### EVERY NIGHT

Every night after the first night, the Moderator should call the Werewolves and have them point to the player they'd like to be eliminated. The Werewolves must all agree on their target.

The Moderator should also call the Seer each night and have her point to a player, giving her the "V" for Villager or "W" for Werewolf sign based on who she is pointing at.

### EVERY DAY

At the start of every day, the Moderator should announce the player who was eliminated by the Werewolves and show that player's card to all the players.

---

## Page 4 — Ending, Discussion, Credits

That player may not speak at all once her card is revealed, and should leave her place in the circle (but should stick around to silently watch the rest of the game).

### ENDING THE GAME

If the Villagers manage to eliminate all the Werewolves, the game is over and the Villagers win. If there are the same number or more Werewolves as players in the village team, the Werewolves win. The Moderator should announce when the game is over, and all players still in the game should now show everyone their cards.

### GAME DISCUSSION

A great deal of the fun of *Ultimate Werewolf* is the discussion that takes place immediately following the end of the game, and a great time to set up a follow up game.

### CREDITS

- **Designer:** Ted Alspach (Bézier Games)
- **Character art:** Sanjana Baijnath (Auckland, NZ) — sanjanasart.com
- **Diagrams & card backgrounds:** Jade Holt (Manchester, UK) — jddevictoriaportfolio.weebly.com
- **Publisher:** Bézier Games — beziergames.com
- © 2015 Bézier Games, Inc. and Ted Alspach. All Rights Reserved.

---

## Design notes — what this tells us for our app

1. **Wolf-count scaling is explicit** and matches our recommendation:
   - 6–8 players → 1 wolf
   - 9–11 players → 2 wolves
   - 12–15 players → 3 wolves

2. **The moderator runs a strict state machine** — every step is scripted, including hand signals (V / W). This is exactly what our moderator-less UX needs to automate.

3. **Night phase structure:**
   - First Night: *Werewolves wake → see each other → close. Seer wakes → points → gets V/W signal → closes.*
   - Every Night after: *Werewolves wake → agree on kill target → close. Seer wakes → points → gets V/W → closes.*

4. **First Day has 3 sub-phases:** intros → accusation/discussion → vote. Vote threshold = **strict majority (>50%)**, not plurality.

5. **First Day has a soft timer** (~10 min) — if no elimination, day ends silently.

6. **Win conditions:**
   - Village: all wolves eliminated.
   - Wolves: wolves ≥ villagers (parity, not majority).

7. **Information visibility rules** — eliminated players reveal their card, must stay silent, but watch. The Seer's reads are PRIVATE (only she sees the V/W signal). Werewolves know each other from Night 1.

These are the building blocks for the moderator-less state machine our app will implement.
