---
title: Arden, the Huntmaster (new hero 15 of 20)
tags: [design, heroes, kits, hunt]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Arden, the Huntmaster

New hero 15 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The Huntmaster of the Moot, who reads every step you take. |
| **Shape** | Three footprints leading to an arrowhead. |
| **Colours** | Accent olive `#758c1c`, foil antler cream `#ece2c8`. Nearest colours: Fenna (30), Hank pine (33) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `hunt` |
| **Role** | Marksman, ranged |
| **Faction** | The Greenwood Moot (lore: Leader of the Moot's Hunt, who has tracked Nyx for ten years without finding a footprint.) |
| **The new thing** | Your own trail. The last 4 s of the enemy's path glows on the floor as footprints, and his spells run along it. No hero uses where the enemy has been. |
| **The question** | "Where have you just walked?" |
| **The weakness** | A hero who stands still or dashes leaves no trail (a dash leaves a gap), and without one he is a plain archer with 560 HP. |
| **The second decision** | Snare the trail now, where they have just been, or let it grow long for the Hunt, which runs its whole length. |
| **How it looks** | A tall, weathered hunter in olive and russet leathers, a dark green cloak with a russet lining, a hunting horn at the hip; an antler-tipped longbow in the right hand. |
| **Nearest heroes** | Lyra (archer), Hank and Fenna (green, the same faction) |

## Gate 3: the kit on paper

Arden. Theme `hunt`. Marksman, ranged. **560 HP**, 4.1 m/s, basic attack 11 per 1.0 s at 7 m (an arrow). Accent `#758c1c`, foil `#ece2c8`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **The Hunt's Eye** | PASSIVE | - | - | 16 prints | +25% along the trail | The last 4 s of the enemy's walking shows as olive footprints on the floor (a print each 0.25 s, both screens). Standing still adds none; a dash or a blink leaves a gap. His arrows that fly at least 3 m along the trail (within 1 m of it) deal 25% more. |
| Q | **Broadhead** | LINE | 3 | 11 m | radius 0.3 | 50 (62 along the trail) | 0.3 s wind-up, 24 m/s. |
| W | **Snare Line** | TRAP | 10 | the trail | the four newest prints | 30 and root 0.8 s | After 0.5 s snares close on the four newest prints for 4 s; an enemy who steps on one is rooted 0.8 s and takes 30 (one snare a cast). |
| E | **Run Them Down** | DASH | 9 | to the oldest print within 8 m | - | - (next attack +20) | He dashes to the oldest print within 8 m (0.35 s); his next attack within 3 s deals 20 more. |
| R | **The Hunt Rides** | TRAIL | 22 | the trail | leap 2 m | 120 and slow 40% for 1.5 s | He sounds the horn for 1.0 s; then hounds of mist run the trail from its oldest print at 12 m/s, following it as it grows. They bay 0.8 s before they leap at the newest print: 120 and a slow in 2 m. A gap in the trail (a dash, a blink) loses the scent, and if they have not bayed by 3.4 s after the cast they give up, so the leap lands by 4.2 s. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P The Hunt's Eye.** Walk in turns, stand, or dash: the trail is yours to shape.
- **Q Broadhead.** Sidestep: it reaches 6 m at 0.3 + 6/24 = 0.55 s. *(bolt: 0.3 + 6/24 = 0.55 s to 6 m (at least 0.5) OK; first hit 0.35 s after the cast)*
- **W Snare Line.** Do not walk back over where you just walked: the snares are your own last second of steps, drawn for both.
- **E Run Them Down.** Keep your trail away from him.
- **R The Hunt Rides.** Break the trail with a dash or a blink. Or step out when they bay: 0.25 + 2/4 = 0.75 s against 0.8 s. *(circle 2 m: 0.25 + 2/4 = 0.75 s needed, warned 0.8 s OK; first hit 1.8 s after the cast, last 4.2 s)*

### The question, the weakness, the second decision

- **Question:** "Where have you just walked?"
- **Weakness:** A hero who stands still or dashes leaves no trail (a dash leaves a gap), and without one he is a plain archer with 560 HP.
- **Second decision:** Snare the trail now, where they have just been, or let it grow long for the Hunt, which runs its whole length.

### Budget

Marksman, 560 HP. Q 50 (62 along the trail); the snare 30 and a 0.8 s root; the Hunt 120. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: small.** A trail recorder: both screens sample the enemy's synced position four times a second; the victim's screen, whose positions are the true ones, decides every hit. A dash or a blink (seen in `enemyCast`) cuts the trail. Build order: 7 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P The Hunt's Eye | The trail recorder (new, small). | The victim's screen. |
| Q Broadhead | A bolt. | The victim's screen. |
| W Snare Line | Marks on the trail; `victimTick`. | The victim's screen. |
| E Run Them Down | `ctx.moveCaster` to a print. | His client. |
| R The Hunt Rides | A hazard along the recorded trail, decided on the victim's screen. | The victim's screen. |

### What the CPU does

**As Arden** (`aiHold`, `aiGoal`):

- Q when the enemy is moving (along the trail).
- W when the enemy backs off.
- E to chase.
- R when the trail is longer than 8 m and the enemy has no dash ready.

**Against Arden** (`enemyGoal`):

- Walks on, not back over its own prints.
- When the hounds bay: dashes, or steps out of the 2 m.

### The effects, part by part

In the hero's palette: accent olive with a pale antler cream foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P The Hunt's Eye:** Olive footprints with a cream rim, fading from the oldest.
- **Q Broadhead:** An arrow with an antler-bone head and an olive streak that flares along the prints.
- **W Snare Line:** Snares of bent wood and cord, set on the prints, snapping shut with a cream flash.
- **E Run Them Down:** A russet blur along the prints.
- **R The Hunt Rides:** A horn blast ring; pale olive hounds of mist running along the prints; the leap with a cream flash.

### Names and files (checked free on 2026-11-14)

Labels: 'broadhead', 'snare line', 'run them down', 'the hunt rides'. Files: `src/heroes/hunt/spells/broadhead.ts`, `src/heroes/hunt/spells/snareLine.ts`, `src/heroes/hunt/spells/runThemDown.ts`, `src/heroes/hunt/spells/theHuntRides.ts`; in `src/heroes/hunt/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
