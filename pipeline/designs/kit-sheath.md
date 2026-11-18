---
title: Kit sheet, Kagen
tags: [kit, design, draft, sheath]
updated: 2026-11-18
status: gate 1 and gate 2 agreed (2026-11-18); gate 3 written, waiting on the user's yes; nothing of the kit is built
---

# Kagen, the Scarlet Sheath

The new swordsman the user asked for on 2026-11-18 ("make it like move set so that someone is actually fighting and make it
more real"; then "Playable hero kit", "A new swordsman"). The card: `docs/heroes/new/sheath-card.html`. Lore: LORE.md and
`docs/lore/codex/heroes/kagen.md`.

## Gate 1: the card

Agreed 2026-11-18 ("Yes, go ahead").

| | |
|---|---|
| **Sentence** | A swordsman whose cuts only open when he sheathes the blade. |
| **Signature shape** | The scarlet sheath with two paper seals; the cut line that opens like a burning almond. |
| **Colours** | Accent cinnabar `#cf4a1c` (warmer and more orange than Vesper's crimson and the enemy's red), foil rice paper `#ebe8e2`, on black lacquer with gold. |
| **Theme word** | `sheath` |
| **Role** | Assassin, melee. Low health, damage that comes late. |
| **Faction** | Loners (docs/lore/LORE.md) |
| **The new thing** | Delayed cuts: his hits leave cut marks on the enemy that open only when he sheathes (W) or with World Sever (R). **Corrected at gate 3:** the card said no hero stores damage on the enemy and spends it later. Mr. Ledger's tab does (his On Your Tab, and Call It In cashes it). What is new in Kagen is how the marks behave, see "Not Mr. Ledger" below. |
| **The question** | "How many cuts will you carry in my reach before I click?" |
| **The weakness** | His damage comes late: step out of his ring at the click, or out of his reach while you carry marks, and they fade unspent. 640 HP, no shield, no heal. |
| **The second decision** | When to click: now, for the marks he has, or later for more, while they may fade or the enemy steps out. And which to spend them on: the click (W, close) or World Sever (R, anywhere, worth more). |
| **How it looks** | Agreed at gate 2: a Northerner of about 38, black coat over grey, cinnabar sash, red-sun crests, one lacquer plate on the left shoulder, the scarlet sheath at the left hip, the katana in the right hand, straw sandals. |
| **Nearest heroes** | Zephyr (a sword, but wind and dashes that bank Gusts), Sir Whiskers (a duelist, comic), Shiori (ink and paper; his paper is only the seals), Vesper (crimson; his accent is cinnabar), Mr. Ledger (stored damage, see below). |

## Gate 2: the look

Agreed 2026-11-18 ("Yes, the look is right"). Model `blender/heroes/real/sheath.py` -> `public/models/heroes/sheath_v4.glb`
(535 KB, 28,845 triangles). Pictures: `docs/heroes/new/sheath-gate2-*.jpg`.

## Gate 3: the kit on paper

Written 2026-11-18. Waiting on the user's yes; nothing of it is built.

**The idea in one line:** he fights close with the sword, and every blow that lands leaves a thin cinnabar cut on the enemy.
The cuts do nothing until he puts the blade home. Then they all open at once.

Kagen. Theme `sheath`. Assassin, melee. **640 HP**, 4.4 m/s. Basic attack: melee, 2.6 m, **9 per 0.85 s**, wind-up 0.25 s,
the pack's sword blow (`sweep` look); **each attack that lands leaves a cut mark.** Accent `#cf4a1c`, foil `#ebe8e2`.

| Key | Spell | Shape | CD (s) | Reach | Size | Damage | Rule | Answer, checked (rule 4) |
|---|---|---|---:|---|---|---|---|---|
| P | **Scarlet Sheath** | PASSIVE | - | - | - | 24 a mark | **Cut marks.** Each of his hits that lands (attack, Issen, each wave of Senbon) leaves one cut mark on the enemy: a thin cinnabar line across the body, drawn for both players. **4 at most.** They never open by themselves: they **fade 5 s after his latest cut**. They open only with Noto (W) or Sekai-giri (R): each deals 24 then. Opening all four at once also slows 30% for 1 s. | Count the lines on yourself. With marks on you, keep out of his ring (3.5 m) or wait 5 s without being cut, and they are gone. |
| Q | **Issen** (One Flash) | DASH | 6 | 6 m | lane 1.2 m wide | 32 + 1 mark | A thin white line shows down the aim for **0.45 s**, then he crosses it in 0.15 s and stands at its end. Everyone the cut passes takes 32 and a mark. His way in, or out. | Step off the line: 0.6 m to its edge takes 0.25 + 0.6 / 4 = 0.40 s; it warns 0.45 s. |
| W | **Noto** (The Click) | SELF | 7 | - | ring 3.5 m round him | 24 a mark | No aim. He slides the blade home: a ring of 3.5 m shows round him for **0.5 s**, then the click. Every mark on an enemy inside the ring opens (24 each, at most 96). **The parry:** for 0.4 s after the click, the next attack or spell that hits him deals nothing, and gives the attacker a mark. | Step out of the ring: from his reach (2.6 m) to its edge is 0.9 m, 0.25 + 0.9 / 4 = 0.48 s; it shows 0.5 s. Do not hit him in the 0.4 s after the click. |
| E | **Senbon** (Thousand Swords) | GROUND | 11 | 8 m | circle 3 m | 10 + 1 mark a wave, 3 waves | A cinnabar ring is painted at the spot for **1.0 s**, then katanas rain into it in three waves (at 1.0, 1.4 and 1.8 s). Each wave that finds the enemy inside: 10 and a mark. | Walk out: from the very middle 3 m takes 0.25 + 3 / 4 = 1.0 s; it warns 1.0 s. Caught at the edge, you leave before the second wave. |
| R | **Sekai-giri** (World Sever) | LINE | 26 | 12 m | line 2.4 m wide | 110, and marks at 36 | He draws one cut along a 12 m line; the line is drawn on the floor and he stands still for **1.3 s** (the world goes grey round the line: only a look, nobody else is held). Then it tears open: 110 to everyone on the line. **And every mark on the enemy opens, wherever they stand, at 36 each** (+50%). | Leave the line: 1.2 m takes 0.25 + 1.2 / 4 = 0.55 s; it shows 1.3 s. His marks still open: carry few into his ultimate. He stands still 1.3 s: hit him. |

**The question:** how many cuts will you carry in his reach before he clicks? **Weakness:** all of his damage that is not
paid at once can be walked away from: out of the ring at the click, out of his reach for 5 s, or never cut. He has 640 HP
and no way to block but the parry. **Second decision:** click now for what he has, or fight on for the fourth mark (and
the slow), while the enemy may step out; and spend the marks close with the click or keep them for World Sever.

### Not Mr. Ledger (why the marks are new)

Mr. Ledger also puts damage on the enemy and spends it later. The rules are different where it matters:

| | Mr. Ledger, On Your Tab | Kagen, Scarlet Sheath |
|---|---|---|
| Does it land by itself? | Yes: 3 s after the last charge, at +40%. It always lands. | Never. Unopened marks fade 5 s after his latest cut. |
| What it is | A sum of spell damage, a number over the head (`$72`). | A count of cuts, 4 at most, each worth the same: the most a click can open is 96, and both players can see it coming. |
| Can it be stopped? | No: Call It In works from anywhere. You pay it down by hitting him. | Yes: the click reaches only 3.5 m and shows for 0.5 s. Step out and it opens nothing. Hitting him at the click is punished (the parry). |
| Where it comes from | Two ranged spells. | Mostly his sword, in close: the marks are what close fighting costs you. |

His four kinds of spell (dash, self, ground zone, line) are Oblivion's four in another order (Oblivion: Q self slam, W zone,
E dash, R line); no hero has dash, self, ground, line on Q, W, E, R.

**The one alternative, if the marks feel too close to Mr. Ledger:** cuts in the air. His blade leaves thin cinnabar lines on
the floor where it passed (not on the enemy); the click opens every line, and whoever stands on one then is hit. It is
nearer Shiori's ink strokes, which also lie on the floor and erupt with her ultimate. The sheet above keeps the agreed card.

### Checked with the numbers (rule 4)

- A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least `0.25 + radius / 4`; a bolt reaches 6 m no sooner than
  0.5 s.
- Q: half-width 0.6 m needs 0.40 s; it warns 0.45 s. OK.
- W: 0.9 m from his reach to the ring's edge needs 0.48 s; the ring shows 0.5 s. OK, with little to spare: that is the
  click's tension.
- E: 3 m needs 1.0 s; the first wave lands at 1.0 s. OK, from the very middle.
- R: half-width 1.2 m needs 0.55 s; it shows 1.3 s. OK. The ultimate never lands when cast.
- Marks: an attack every 0.85 s, so four marks take about 2.6 s of close fighting (or Issen plus two attacks, or one
  Senbon caught in full plus one hit). They fade 5 s after the latest cut; Noto is ready every 7 s.

### Budget (pipeline/designs/kit-common.md)

Assassins have 600-720 HP; Kagen 640, between Zephyr (620) and Nyx and Mabel (680), because his damage can be walked away
from. Damage now: attacks 9 (Zephyr 7, Nyx 11), Issen 32, Senbon 30 caught in full. Damage that waits: a mark 24, so a full
click 96 (Sir Whiskers' Scratch 64 every 3 s, Mabel's Claw 68). Ultimate: 110 on the line, near Mabel's 115; with four marks
it opens 144 more, **254 at most**, which is 55% of the lowest HP in the game (Anka, 460), and only if she is cut four times
in the 5 s before and stands on the line. The simulator sets the real numbers at gate 5 (40-60%).

### Blocks or new code (`src/heroes/framework/blocks.ts`)

- **Q Issen:** the `lane` block (6 x 1.2 m) with a `move` at the release to `'end'` in 0.15 s, as Firebird. Block.
- **W Noto:** the `zone` block: a circle of 3.5 m round him (`area` made at the cast), `windup` 0.5, its hit `none` (no damage
  of its own). The marks open in the trait's `dealt` for slot 1: damage = marks x 24, then `clearStacks`. The parry: `taken`
  on his own client swallows the next hit in the 0.4 s after the click, and tells the other screen with a counter
  (`show('parry', n)`), which adds the mark there in `victimTick`: the path Mr. Ledger's `paid` uses.
- **E Senbon:** the `circle` block for the first wave; waves 2 and 3 are new code (the spell's `on.frame` hook judging the
  same circle at 1.4 and 1.8 s, each a hit inside the cast's telegraph). To be proven at gate 4; if the engine allows one
  hit per cast only, the fallback is one hit at 1.0 s for 10 and 2 marks.
- **R Sekai-giri:** the `lane` block (12 x 2.4 m), `windup` 1.3, the front sweeping in 0.15 s. Its hit is 110; the marks open
  from the trait wherever the enemy is: `afterCast` counts the cast (`show('sever', n)`), and `victimTick` on the enemy's
  screen opens them at the tear (1.3 s later) with `hitEnemy`, as Call It In does. The grey world is the look only.
- **Marks:** `addStacks('cut', 1, 5, 4)` in `dealt` on the screen that decides the hit (each new mark refreshes the 5 s, which
  is what the engine's stacks do: one timer for all). Drawn as thin lines on the enemy's body for both players
  (`hiddenStacks` and a mark look, or the stack pips drawn as cuts). The fourth opened mark's slow is part of the opening hit.

### What the CPU does

- **As Kagen:** walks in to 2 m and fights with attacks. Issen to close when the enemy is 3 to 6 m away, or to leave when
  he is under 30% HP. Noto held (`aiHold`) until the enemy is within 3 m with 3 or 4 marks, or with any mark when they would
  fade within 1 s; not flagged `parry` (that flag would fire it only at incoming hits). Senbon at the enemy's spot within
  8 m, more often when the enemy is rooted, slowed or cornered. Sekai-giri when the enemy is on the line within 11 m and
  carries 2 marks or more, or is under 254 HP.
- **Against Kagen (`enemyGoal`):** with 2 marks or more on it, keep 4 m from him until they fade; step out of Noto's ring
  when it shows; do not attack him in the 0.4 s after the click.

### Names and files (checked free on 2026-11-18)

Labels `issen`, `noto`, `senbon`, `sekai giri`; files `src/heroes/sheath/spells/issen.ts`, `noto.ts`, `senbon.ts`,
`sekaiGiri.ts`. Not his: the tool page's `thousand swords` (`src/spells/targeted/thousandSwords.ts`) and `world sever`
(`worldSever.ts`); his E and R borrow their looks, sized for a duel, under his own labels.
