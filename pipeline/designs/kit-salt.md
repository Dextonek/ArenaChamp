---
title: Morwen, the Saltwarden (new hero 3 of 20)
tags: [design, heroes, kits, salt]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Morwen, the Saltwarden

New hero 3 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A hedge witch who draws circles of salt that no spell can cross. |
| **Shape** | A dashed circle of salt with an iron nail inside it. |
| **Colours** | Accent cold iron `#7d9bb0`, foil salt white `#f4f1ea`. Nearest colours: Gus foil (21), Isolde (23) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `salt` |
| **Role** | Controller, ranged |
| **Faction** | The Truce of the Ring (lore: The hedge witch who salts the Ring's edge every dawn so that no spell reaches the crowd.) |
| **The new thing** | Lines that stop spells but not feet. Walls stop everything. Her salt lines let anyone walk across but no spell, from either side. To trade spells with her you have to come in. |
| **The question** | "Will you step inside my circle?" |
| **The weakness** | Up close she is soft, and her circle shelters the enemy from her own spells too. |
| **The second decision** | Draw the circle round herself (a shelter) or round the enemy (a cage for their spells). |
| **How it looks** | A hooded hedge witch in grey-blue wool and a pale linen apron, iron keys and herb bundles at the belt, a pouch of salt pouring from the left hand, a black iron staff with a candle cage. |
| **Nearest heroes** | Mum (walls), Referee Whistler (no spells), both in or near her faction |

**Changed from the card shown on 2026-11-14:** None to the idea. The numbers are new: circle 4 m for 5 s, the Boundary a wall for 2 s and a salt line for 6 s more.

## Gate 3: the kit on paper

Morwen. Theme `salt`. Controller, ranged. **620 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a flicked iron nail). Accent `#7d9bb0`, foil `#f4f1ea`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Hearthward** | PASSIVE | - | - | - | - | Inside her own salt circle she heals 3 a second, 15 at most a circle. |
| Q | **Iron Nail** | LINE | 3.5 | 10 m | radius 0.3 | 52 and slow 30% for 1 s | 0.25 s wind-up, 20 m/s. It stops at cover and at salt lines. |
| W | **Salt Circle** | ZONE | 13 | 10 m | radius 4 m | - | She pours a circle of salt round a point, closed after 0.6 s, standing 5 s. No spell crosses its line from either side: bolts stop on it, a targeted spell aimed across it fails (its cooldown is spent), an area spell does not reach past it. Feet cross freely. |
| E | **Hex Bundle** | TGT | 11 | 8 m | - | 25 | A bundle of herbs hangs over the enemy for 4 s (0.3 s to cast, needs sight): their next dash fizzles: they stay where they are and the dash's cooldown is spent. |
| R | **The Boundary** | WALL | 22 | 10 m | 12 m line, 1.2 m wide | 60, pushed 1.5 m out | A wall of blowing salt and iron filings rises across the aim after 1.0 s: for 2 s nothing crosses it, feet or spells; then it settles into a salt line that stops spells for 6 s more. Whoever stands on the line as it rises takes 60 and is pushed to the near side. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Hearthward.** Walk in after her, or make her leave it.
- **Q Iron Nail.** Sidestep: it reaches 6 m at 0.25 + 6/20 = 0.55 s. *(bolt: 0.25 + 6/20 = 0.55 s to 6 m (at least 0.5) OK; first hit 0.3 s after the cast)*
- **W Salt Circle.** Walk in or out: 4 m is a second. Or wait 5 s. It shelters you from her spells as much as hers from yours.
- **E Hex Bundle.** It needs sight at the cast: fight round cover and she cannot hex you. Hexed, do not dash for 4 s, or spend it on your smallest dash. *(first hit 0.3 s after the cast)*
- **R The Boundary.** Step off the line: half its width is 0.6 m, 0.25 + 0.6/4 = 0.4 s against 1.0 s. Then go round its ends. *(lane 1.2 m wide: 0.25 + 0.6/4 = 0.40 s needed, warned 1 s OK; first hit 1 s after the cast (a lasting mark after that))*

### The question, the weakness, the second decision

- **Question:** "Will you step inside my circle?"
- **Weakness:** Up close she is soft, and her circle shelters the enemy from her own spells too.
- **Second decision:** Draw the circle round herself (a shelter) or round the enemy (a cage for their spells).

### Budget

Controller, 620 HP. Q 52 with a slow is her rhythm; her strength is denying spells, so her ultimate deals only 60. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** Lines that stop spells: bolts stop on them as on cover, a targeted spell aimed across one fails, an area spell does not reach past one. New in `projectile.ts` and in the cast checks. Build order: 16 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Hearthward | `ctx.healSelf` from `tick`. | Her client. |
| Q Iron Nail | A bolt. | The victim's screen. |
| W Salt Circle | The new spell-stopping line (see above), kept as her marks. | Bolts: the screen of the hero they fly at. A failed targeted cast: the caster's own client, from the marks both screens keep. |
| E Hex Bundle | The `grounded` debuff the engine has, removed after one dash. | The victim's own client (it refuses its own dash). |
| R The Boundary | `ctx.addObstacle` for 2 s, then the spell line as a mark. | The hit: the victim's screen. |

### What the CPU does

**As Morwen** (`aiHold`, `aiGoal`):

- Q in reach.
- W round herself when the enemy is a ranged caster beyond 6 m; round the enemy when they stand still (a turret, a channel).
- E when the enemy has a dash ready and is within 8 m.
- R across the way of a melee enemy closing within 6 m, or to cut a retreat.

**Against Morwen** (`enemyGoal`):

- A melee enemy walks into her circle; a ranged one steps out of it or waits.
- Does not dash while hexed.

### The effects, part by part

In the hero's palette: accent cold iron with a pale salt white foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Hearthward:** Candle-small flames along the arc of the line nearest her.
- **Q Iron Nail:** A black iron nail with a cold blue-white glint, rust flakes on the hit.
- **W Salt Circle:** A pouring line of white salt with crystals that catch the light; spells break on it in white sparks and a puff of salt.
- **E Hex Bundle:** A bundle of grey-green herbs tied with dark crimson thread smoulders over their head; a grey puff when it takes the dash.
- **R The Boundary:** A wall of white salt and steel-grey filings blowing upward, settling into a white line.

### Names and files (checked free on 2026-11-14)

Labels: 'iron nail', 'salt circle', 'hex bundle', 'the boundary'. Files: `src/heroes/salt/spells/ironNail.ts`, `src/heroes/salt/spells/saltCircle.ts`, `src/heroes/salt/spells/hexBundle.ts`, `src/heroes/salt/spells/theBoundary.ts`; in `src/heroes/salt/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
