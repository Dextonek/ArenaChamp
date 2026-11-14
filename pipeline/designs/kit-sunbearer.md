---
title: Orren, the Sunbearer (new hero 14 of 20)
tags: [design, heroes, kits, sunbearer]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Orren, the Sunbearer

New hero 14 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A knight who carries a piece of the old sun on his back, and lets anyone try to take it. |
| **Shape** | A lantern-shrine with a small sun inside it. |
| **Colours** | Accent noon yellow `#f6f028`, foil white gold `#fbf5e2` |
| **Theme word** | `sunbearer` |
| **Role** | Tank, melee |
| **Faction** | The Noonsworn (lore: The knight who carries the Ember of Aubade, the seed of a new sun, for the climb.) |
| **The new thing** | An object both heroes can carry. The Ember of Aubade is his power, and when he sets it down the enemy can pick it up: carrying it they deny it to him, and it burns them. |
| **The question** | "Will you take my sun?" |
| **The weakness** | Carrying it he is slow; set down it ties him to one place; and it can be taken and carried off. |
| **The second decision** | Carry it (armour, slow) or set it down (power in its light, but a thing the enemy can take). |
| **How it looks** | A broad knight in white and gold plate, bent a little under a brass lantern-shrine on his back with a small sun burning inside, a short white cape, a calm bearded face; a sun mace in the right hand. |
| **Nearest heroes** | Auriel (white and gold; his comrade), Brannoc (big and fiery; wants the Ember), Tempo (chartreuse: Orren's yellow is warmer and paler) |

## Gate 3: the kit on paper

Orren. Theme `sunbearer`. Tank, melee. **840 HP**, 3.6 m/s carrying the Ember, 4.2 without, basic attack 14 per 1.2 s at 2.6 m (the sun mace). Accent `#f6f028`, foil `#fbf5e2`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Bearer's Oath** | PASSIVE | - | - | light 5 m | +20% in the light | Carrying the Ember he walks 3.6 m/s and takes 15% less. Set down, it lights 5 m round it: in its light he deals 20% more, and enemies in it cannot fade or be unseen. An enemy who stands on it for 1.0 s picks it up: they carry it (25% slower, 6 damage a second) and drop it after 4 s, or when his mace hits them. He takes it up by touching it (0.3 s). |
| Q | **Sunmace** | QUICK | 3 | 3 m | 90 degrees | 46 | 0.35 s wind-up, a blow toward the nearest enemy in reach. It knocks the Ember loose from a carrier (it falls at their feet). |
| W | **Set Down** | CARRY | 6 | at his feet, or thrown 6 m | flare 1.5 m | 40 where it lands | He sets the Ember at his feet, or throws it up to 6 m: it lands after 0.7 s with a 1.5 m flare. Recast within 1.5 m of it: he takes it up. |
| E | **Dawnstride** | DASH | 10 | 5 m | - | - (a 50 shield in the light) | 5 m in 0.3 s; arriving in the Ember's light, a shield of 50 for 2 s. |
| R | **Zenith** | ZONE | 22 | the Ember | radius 4.5 m round the Ember | 110 and blind 1 s; 150 to a carrier, who drops it | The Ember blazes after 1.4 s, wherever it is: 110 and a 1 s blind to enemies within 4.5 m of it; an enemy carrying it takes 150 and drops it. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Bearer's Oath.** Take it and walk it away from him; or fight him far from its light.
- **Q Sunmace.** Stand beyond 3 m. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.35 s after the cast)*
- **W Set Down.** Leave the landing spot: 0.25 + 1.5/4 = 0.63 s against 0.7 s. *(circle 1.5 m: 0.25 + 1.5/4 = 0.63 s needed, warned 0.7 s OK; first hit 0.7 s after the cast (a lasting mark after that))*
- **E Dawnstride.** -
- **R Zenith.** Leave its light: 0.25 + 4.5/4 = 1.38 s against 1.4 s. Carrying it, drop it and walk. *(circle 4.5 m: 0.25 + 4.5/4 = 1.38 s needed, warned 1.4 s OK; first hit 1.4 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Will you take my sun?"
- **Weakness:** Carrying it he is slow; set down it ties him to one place; and it can be taken and carried off.
- **Second decision:** Carry it (armour, slow) or set it down (power in its light, but a thing the enemy can take).

### Budget

Tank, 840 HP. Q 46, the flare 40, the ultimate 110 (150 to a thief). His heals are none: his strength is the light and the armour. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** A carried object with three states (on him, on the ground, on the enemy), told between the screens: his client decides his pick-ups, the enemy's client decides theirs, and a rule settles the moment both reach it (his 0.3 s touch beats their 1.0 s stand; a claim is ordered by its start time). Build order: 15 of 20 ([the kits page](../../docs/heroes/kits20/index.html)).

| Key | Needs | Decided on |
|---|---|---|
| P Bearer's Oath | The carried object (new, above). | His client for his pick-ups; the enemy's for theirs. |
| Q Sunmace | A quick cone. | The victim's screen. |
| W Set Down | The object's state; a circle hit at the landing. | The victim's screen for the flare. |
| E Dawnstride | `ctx.moveCaster`, `ctx.shieldSelf`. | His client. |
| R Zenith | A ring round the object's position at the impact. | The victim's screen. |

### What the CPU does

**As Orren** (`aiHold`, `aiGoal`):

- Carries the Ember while walking to the enemy.
- Sets it down (W) when the enemy is within 5 m, near cover if there is any.
- Fights in its light; Q on any carrier.
- R when the enemy is within 4.5 m of the Ember, or carries it.

**Against Orren** (`enemyGoal`):

- When the Ember lies within 3 m and Orren is more than 4 m from it: takes it and carries it away from him.
- Leaves the light during the R; drops the Ember at once when it starts to blaze.

### The effects, part by part

In the hero's palette: accent noon yellow with a pale white gold foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Bearer's Oath:** The Ember: a brass lantern-shrine with a small white-gold sun inside, rays through its lattice. Set down: a 5 m pool of pale light with a crisp rim. Carried by the enemy: small yellow flames at their hands.
- **Q Sunmace:** A white-gold mace arc.
- **W Set Down:** The shrine flung in an arc, a ring of light where it lands.
- **E Dawnstride:** A white-gold streak.
- **R Zenith:** A hard disc of noon light with crisp rays, one impact frame, then fading.

### Names and files (checked free on 2026-11-14)

Labels: 'sunmace', 'set down', 'dawnstride', 'zenith'. Files: `src/spells/targeted/sunmace.ts`, `src/spells/targeted/setDown.ts`, `src/spells/targeted/dawnstride.ts`, `src/spells/targeted/zenith.ts`; `src/effects/parts/sunbearer.ts`, `src/kits/sunbearer.ts`, `src/traits/sunbearer.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
