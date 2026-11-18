---
title: Sahar, the Mirage (new hero 12 of 20)
tags: [design, heroes, kits, mirage]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Sahar, the Mirage

New hero 12 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A desert archer who shoots from shade that is not there. |
| **Shape** | A palm and a wall drawn in a broken outline over heat lines. |
| **Colours** | Accent heat lilac `#a674b2`, foil sun linen `#f2e8d6`. Nearest colours: Silvane violet (25), Thessa (26) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `mirage` |
| **Role** | Marksman, ranged |
| **Faction** | The Dune Throne (lore: The Throne's archer from the Glass Flats, who builds walls nobody can trust.) |
| **The new thing** | False cover. His mirages look like the arena's walls and palms but stop nothing: not feet, not bolts, not sight. Every hero hides behind cover; his cover lies. |
| **The question** | "Is that wall real?" |
| **The weakness** | A mirage casts no shadow and its foot shimmers; walking into one breaks it for both players. Without mirages he is a plain archer with 540 HP. |
| **The second decision** | Raise a mirage where the enemy will want to hide, or in front of himself, where his arrows pass through it stronger. |
| **How it looks** | Slim and sun-dark, in pale linen wrapped against the heat, a heat-lilac scarf across the face, a quiver of glass-tipped arrows; a recurve bow of horn and gold in the right hand. |
| **Nearest heroes** | Lyra (archer, his rival), Mum (walls nobody can see, his rival), Thessa (orchid; hers is pinker and on night blue) |

## Gate 3: the kit on paper

Sahar. Theme `mirage`. Marksman, ranged. **540 HP**, 4.0 m/s, basic attack 11 per 1.0 s at 7 m (an arrow). Accent `#a674b2`, foil `#f2e8d6`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Heat Haze** | PASSIVE | - | - | - | +30% through a mirage | His arrows that pass through a mirage come out 30% stronger. A mirage looks like cover but stops nothing; it casts no shadow and its foot shimmers. Anyone who walks into one breaks it for both players. |
| Q | **Glass Arrow** | LINE | 3 | 11 m | radius 0.3 | 50 (65 through a mirage) | 0.3 s wind-up, 24 m/s. |
| W | **Mirage** | TERRAIN | 10 (2 charges) | 10 m | a 3 m wall or a palm | - | A false wall or palm rises at a point and stands 8 s. It stops nothing. |
| E | **Shimmer Step** | BLINK | 11 | 5 m | - | - | He blinks 5 m and leaves a mirage of himself where he stood for 2 s. |
| R | **The Glass Flats** | LINE | 22 | 12 m | 12 x 6 m | 90 and blind 1 s | The sand of a 6 m wide, 12 m long strip flashes to glass after 1.2 s: 90 and blind 1 s to the enemy in it, and every mirage in the strip becomes real for 3 s: a wall that stops feet and bolts. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Heat Haze.** Look for the shadow; walk into a doubtful wall; do not hide behind cover that was not there a moment ago.
- **Q Glass Arrow.** Sidestep: it reaches 6 m at 0.3 + 6/24 = 0.55 s. *(bolt: 0.3 + 6/24 = 0.55 s to 6 m (at least 0.5) OK; first hit 0.35 s after the cast)*
- **W Mirage.** See the passive: no shadow, a shimmering foot; walk into it to break it.
- **E Shimmer Step.** The real one moved; the one standing still is the lie.
- **R The Glass Flats.** Leave the strip: half of 6 m, 0.25 + 3/4 = 1.0 s against 1.2 s. Mind the mirages in it: they turn solid. *(lane 6 m wide: 0.25 + 3/4 = 1.00 s needed, warned 1.2 s OK; first hit 1.2 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Is that wall real?"
- **Weakness:** A mirage casts no shadow and its foot shimmers; walking into one breaks it for both players. Without mirages he is a plain archer with 540 HP.
- **Second decision:** Raise a mirage where the enemy will want to hide, or in front of himself, where his arrows pass through it stronger.

### Budget

Marksman, 540 HP. Q 50 every 3 s (65 through a mirage); the ultimate 90 with a blind, and it turns his lies into walls. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: none.** A mirage is a mark with the look of cover and no obstacle; walking into one is read in `victimTick`; the ultimate makes mirages real with `ctx.addObstacle`. The CPU must be told of mirages as cover (`enemyGoal`) so it is fooled as a person would be. Build order: 5 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Heat Haze | Marks with a cover look. | The victim's screen (who walks into it). |
| Q Glass Arrow | A bolt. | The victim's screen. |
| W Mirage | A mark. | Both (a look); its breaking on the screen of the hero who walks in. |
| E Shimmer Step | `ctx.moveCaster`; the image is a look. | His client. |
| R The Glass Flats | A strip hit; `ctx.addObstacle` for each mirage in it. | The victim's screen. |

### What the CPU does

**As Sahar** (`aiHold`, `aiGoal`):

- W beside the enemy, on the far side from him, where they would take cover.
- Q through a mirage when one lies between them.
- E to get away (escape).
- R when the enemy is within 12 m in a line with a mirage.

**Against Sahar** (`enemyGoal`):

- Treats his mirages as cover some of the time (more often at the easier levels).
- Walks into a mirage within 3 m to test it.

### The effects, part by part

In the hero's palette: accent heat lilac with a pale sun linen foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Heat Haze:** The mirage: the arena's own sandstone wall or palm, with a faint heat shimmer at the foot and no shadow; broken, it ripples into heat lines and is gone.
- **Q Glass Arrow:** A glass-tipped arrow with a heat-lilac streak that flares as it leaves a mirage.
- **W Mirage:** Heat lines rising off the ground and settling into the shape of a wall or a palm.
- **E Shimmer Step:** He flickers like air over sand; his image stays and wavers.
- **R The Glass Flats:** Sand flashing into a bright glass sheet, lilac and white glare, mirages hardening into stone with a ring.

### Names and files (checked free on 2026-11-14)

Labels: 'glass arrow', 'mirage', 'shimmer step', 'the glass flats'. Files: `src/heroes/mirage/spells/glassArrow.ts`, `src/heroes/mirage/spells/mirage.ts`, `src/heroes/mirage/spells/shimmerStep.ts`, `src/heroes/mirage/spells/theGlassFlats.ts`; in `src/heroes/mirage/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
