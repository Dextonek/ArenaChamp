---
title: Lian, the Kite Master (new hero 4 of 20)
tags: [design, heroes, kits, kite]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Lian, the Kite Master

New hero 4 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A kite master whose paper dragon flies where she points and strikes from the sky. |
| **Shape** | A diamond kite with its string and two paper tails. |
| **Colours** | Accent saffron `#ffb21e`, foil pale indigo `#c9d2f0`. Nearest colours: Sirix (6), Auriel (12) (Lab distance; under 12 reads as the same).  Colour clash: the card's accent `#ffb21e` is 6 from Sirix's colour (under 12 reads as the same). A nearby colour that keeps apart: `#ffa119`. Or keep it and let the figure tell them apart; to decide at the look. |
| **Theme word** | `kite` |
| **Role** | Marksman, ranged |
| **Faction** | The Windward (lore: The best kite flier of the Spires; Shiori taught her to fold paper.) |
| **The new thing** | A second place to cast from. Her kite hangs where she flies it, up to 10 m away. Two of her spells start at the kite, not at her, and the string between them cuts whoever crosses it. |
| **The question** | "Where is the danger: the kite, or me?" |
| **The weakness** | The kite can be brought down (45 HP; 6 s to fly it again), and she walks slower while it is up. |
| **The second decision** | Fly the kite close to the enemy (strong, but its string is in reach) or keep it safe. |
| **How it looks** | A light, quick figure in a saffron silk coat with indigo cuffs, a wide sash, braided hair with paper ribbons; the reel in the left hand, the dragon kite flying above. |
| **Nearest heroes** | Lyra (marksman), Professor Puff (things in the air), Zephyr (her friend and her wind) |

**Changed from the card shown on 2026-11-14:** The kite is placed where she flies it, not steered: a thing that moves on its own drifts apart on the two screens (units do). W is Let Fly, with Reel In as its recast.

## Gate 3: the kit on paper

Lian. Theme `kite`. Marksman, ranged. **540 HP**, 4.0 m/s (3.7 while the kite is up), basic attack 10 per 1.0 s at 6.5 m, from her hand. Accent `#ffb21e`, foil `#c9d2f0`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Long String** | PASSIVE | - | - | - | 12 when the string is crossed | The kite (45 HP, a placed thing) hangs where she last flew it, up to 10 m from her; its string runs from her hand to it. An enemy who crosses the string is cut for 12 (once per 1.5 s). If she walks more than 12 m from the kite it flies home. Brought down, it is gone 6 s. |
| Q | **Paper Dart** | LINE | 3 | 9 m from the kite | radius 0.3 | 50 (40 from her hand) | Fired from the kite toward the aim: 0.3 s wind-up, 20 m/s. With no kite up, from her hand for 40. |
| W | **Let Fly / Reel In** | GROUND | 8 | 10 m | string 1 m wide | 55 and slow 30% for 1 s | Cast: the kite flies to the aimed point (12 m/s) and hangs there. Recast (from 1 s): the string glows for 0.5 s, then she reels the kite home in 0.4 s and the string sweeps: anyone within 0.5 m of its line when it starts takes 55. The cooldown starts when the kite is home or down. |
| E | **Firecracker** | ZONE | 9 | under the kite | radius 2.5 m | 2 x 25 | A string of crackers drops from the kite and pops 1.0 s later in a 2.5 m circle, twice. |
| R | **Dragon Dance** | LINE | 22 | 12 m | path 1.5 m wide | 40 a pass, 3 at most (120) | The kite becomes a long paper dragon. Its path shows on the floor for 1.0 s: an S from the kite to the aimed point and back. Then it flies the path in 3.0 s; whoever it passes through takes 40, once each 0.8 s. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Long String.** Walk round the string, or bring the kite down.
- **Q Paper Dart.** Sidestep: it reaches 6 m at 0.3 + 6/20 = 0.6 s. Watch the kite: the dart starts there. *(bolt: 0.3 + 6/20 = 0.60 s to 6 m (at least 0.5) OK; first hit 0.35 s after the cast)*
- **W Let Fly / Reel In.** When the string glows, step off it: 0.25 + 0.5/4 = 0.38 s against 0.5 s. Better: never stand between her and the kite. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 0.5 s OK; first hit 0.5 s after the cast)*
- **E Firecracker.** Leave the circle: 0.25 + 2.5/4 = 0.88 s against 1.0 s. *(circle 2.5 m: 0.25 + 2.5/4 = 0.88 s needed, warned 1 s OK; first hit 1 s after the cast)*
- **R Dragon Dance.** The path is on the floor before it flies: step off it, 0.25 + 0.75/4 = 0.44 s against 1.0 s, and stay off the S while it loops. *(lane 1.5 m wide: 0.25 + 0.75/4 = 0.44 s needed, warned 1 s OK; first hit 1 s after the cast, last 4 s)*

### The question, the weakness, the second decision

- **Question:** "Where is the danger: the kite, or me?"
- **Weakness:** The kite can be brought down (45 HP; 6 s to fly it again), and she walks slower while it is up.
- **Second decision:** Fly the kite close to the enemy (strong, but its string is in reach) or keep it safe.

### Budget

Marksman, 540 HP. Q 50 every 3 s from the kite; the ultimate is 120 spread over three passes. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: small.** A bolt that starts somewhere other than the caster (the kite), and the kite as a placed thing that is placed again when she flies it. Build order: 8 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Long String | A placed thing; the crossing read in `victimTick` from her synced position and the kite. | The victim's screen. |
| Q Paper Dart | `ctx.projectile` from the kite's point (new option if the engine has none). | The victim's screen. |
| W Let Fly / Reel In | A recast (`RecastSpec.arm` at 1 s) and a line hit along the string. | The victim's screen. |
| E Firecracker | A zone at the kite's point. | The victim's screen. |
| R Dragon Dance | A path worked out alike on both screens from the cast's two points. | The victim's screen. |

### What the CPU does

**As Lian** (`aiHold`, `aiGoal`):

- W: fly the kite 3 to 5 m to the side of the enemy.
- Q from the kite when the enemy is within 9 m of it.
- E when the enemy stands under the kite.
- W recast when the enemy stands between her and the kite.
- R when the enemy is within 10 m and away from cover.

**Against Lian** (`enemyGoal`):

- Hits the kite when within 4 m of it and Lian is out of reach.
- Does not stand between her and the kite.

### The effects, part by part

In the hero's palette: accent saffron with a pale pale indigo foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Long String:** A thin silk string that sags a little, humming and glinting pale indigo; the kite a saffron paper dragon head with indigo scales and streamers.
- **Q Paper Dart:** Saffron paper folding into a dart in the air, a crisp tear on the hit.
- **W Let Fly / Reel In:** The string glowing pale indigo, then whipping in with paper streamers.
- **E Firecracker:** Red-gold paper crackers on a string popping in a chain of small flashes and grey smoke.
- **R Dragon Dance:** A long paper dragon, saffron head, indigo scales, ribbons streaming; its path a dotted saffron S on the floor.

### Names and files (checked free on 2026-11-14)

Labels: 'paper dart', 'let fly / reel in', 'firecracker', 'dragon dance'. Files: `src/spells/targeted/paperDart.ts`, `src/spells/targeted/letFlyReelIn.ts`, `src/spells/targeted/firecracker.ts`, `src/spells/targeted/dragonDance.ts`; `src/effects/parts/kite.ts`, `src/kits/kite.ts`, `src/traits/kite.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
