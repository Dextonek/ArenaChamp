---
title: Ostrel, the Ferryman (new hero 10 of 20)
tags: [design, heroes, kits, ferry]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Ostrel, the Ferryman

New hero 10 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The ferryman of the dead, who lays rivers of pale light and rides them. |
| **Shape** | A ferry boat on two lines of water, with a lantern on a pole. |
| **Colours** | Accent lantern green-gold `#d8e86a`, foil fog grey `#cfc6b8`. Nearest colours: Barry foil (14), Tempo (20) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `ferry` |
| **Role** | Skirmisher, ranged |
| **Faction** | a loner (lore: Ferryman of the dead, who serves no faction because every faction's dead ride with him.) |
| **The new thing** | Ground that carries you. His rivers are strips that move whoever stands on them along their flow, enemy or him. Downstream is quick, upstream a crawl. |
| **The question** | "Will you cross the river, or be carried?" |
| **The weakness** | The rivers are narrow (2.5 m): a step across is always there. Away from water he is ordinary. |
| **The second decision** | Which way each river flows: toward him (to bring them close) or away (to carry himself out). |
| **How it looks** | A tall gaunt figure in a long fog-grey hooded coat with a deep blue lining, a pale calm face, coins sewn on the hem; a long ferry pole with a hanging lantern in the left hand. |
| **Nearest heroes** | Marin (tide; his friend), Gus (wet floor) |

**Changed from the card shown on 2026-11-14:** The way a river flows is chosen by a recast (away from him on the cast, toward him on the recast). The ultimate's whirl lasts 2.2 s and carries 4 m at most, inside the pull cap.

## Gate 3: the kit on paper

Ostrel. Theme `ferry`. Skirmisher, ranged. **620 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a flick of lantern light). Accent `#d8e86a`, foil `#cfc6b8`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Ferry Toll** | PASSIVE | - | - | rivers 12 x 2.5 m | - | On his own river his cooldowns run 50% faster. A river carries whoever stands on it along its flow at 3 m/s (downstream 7 m/s, upstream 1 m/s), for 6 s. Two at most. |
| Q | **Pole Sweep** | CONE | 3.5 | 4 m | 100 degrees | 48 and a push of 2.5 m | 0.35 s wind-up, the long pole sweeps. |
| W | **River of Souls** | LINE | 10 | 12 m | 12 x 2.5 m | - | A strip of pale water from his feet along the aim, flowing away from him, for 6 s. Recast within 2 s flips its flow toward him. |
| E | **Toll Mark** | TGT | 12 | 8 m | - | 6 per metre carried (60 at most) | 0.3 s, needs sight: a coin spins over the enemy for 5 s; every metre a river carries them costs 6. |
| R | **The Last Crossing** | ZONE | 22 | 10 m | river 16 x 5 m; whirl radius 5 m | 30 a second in the eye (1.5 m), about 90 | A wide river appears across the aim in 0.8 s and curls into a whirl round its middle over 1.0 s; for 2.2 s more the whirl carries everyone within 5 m toward its eye at 2.5 m/s (4 m at most), and the eye deals 30 a second within 1.5 m. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Ferry Toll.** Cross a river, do not walk along it against the flow.
- **Q Pole Sweep.** Stand beyond 4 m. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.35 s after the cast)*
- **W River of Souls.** Step off: half of 2.5 m, 0.25 + 1.25/4 = 0.56 s. Cross it rather than walk along it.
- **E Toll Mark.** Step off the river: a second on it costs 18 at most. *(first hit 0.3 s after the cast (a lasting mark after that))*
- **R The Last Crossing.** Leave before it curls: 1.8 s to be out of 5 m, and from the middle that takes 0.25 + 5/4 = 1.5 s. Inside the whirl you still walk out at 1.5 m/s. *(circle 5 m: 0.25 + 5/4 = 1.50 s needed, warned 1.8 s OK; first hit 1.8 s after the cast, last 4 s)*

### The question, the weakness, the second decision

- **Question:** "Will you cross the river, or be carried?"
- **Weakness:** The rivers are narrow (2.5 m): a step across is always there. Away from water he is ordinary.
- **Second decision:** Which way each river flows: toward him (to bring them close) or away (to carry himself out).

### Budget

Skirmisher, 620 HP. Q 48 with a push; his damage is the toll (up to 60) and the whirl's eye (about 90). The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: none.** Rivers are marks; carrying the enemy is `t.carryEnemy` in `victimTick` and himself `t.carrySelf`, both there today; faster cooldowns on his river in the `cooldown` hook. Build order: 3 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Ferry Toll | `cooldown` hook. | His client. |
| Q Pole Sweep | A cone with knockback. | The victim's screen. |
| W River of Souls | A mark; carrying in `victimTick` and `tick`. | The victim's screen for the enemy, his client for him. |
| E Toll Mark | A mark and `victimTick`. | The victim's screen. |
| R The Last Crossing | A mark with a carry toward its eye, capped at 4 m. | The victim's screen. |

### What the CPU does

**As Ostrel** (`aiHold`, `aiGoal`):

- W from himself toward safety when the enemy is within 4 m (it carries him off); recast to flip it toward him to drag a fleeing enemy.
- Q to push the enemy onto a river.
- E when the enemy stands on a river.
- R when the enemy is within 8 m.

**Against Ostrel** (`enemyGoal`):

- Steps off rivers across them, not along them.
- Leaves the ultimate before it curls.

### The effects, part by part

In the hero's palette: accent lantern green-gold with a pale fog grey foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Ferry Toll:** His lantern burns brighter on the water.
- **Q Pole Sweep:** A long pole arc with a spray of pale water.
- **W River of Souls:** Pale blue water with drifting lantern lights and faint faces in the current; small chevrons show the flow.
- **E Toll Mark:** A green-gold coin floating over the head, spinning.
- **R The Last Crossing:** A wide pale river curling into a whirlpool, lanterns spinning in.

### Names and files (checked free on 2026-11-14)

Labels: 'pole sweep', 'river of souls', 'toll mark', 'the last crossing'. Files: `src/spells/targeted/poleSweep.ts`, `src/spells/targeted/riverOfSouls.ts`, `src/spells/targeted/tollMark.ts`, `src/spells/targeted/theLastCrossing.ts`; `src/effects/parts/ferry.ts`, `src/kits/ferry.ts`, `src/traits/ferry.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
