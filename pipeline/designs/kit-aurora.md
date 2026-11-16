---
title: Saga, the Northern Light (new hero 6 of 20)
tags: [design, heroes, kits, aurora]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Saga, the Northern Light

New hero 6 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A sky dancer of the far north who hangs the aurora's curtains across the battle. |
| **Shape** | Three curtains of light standing side by side over a horizon. |
| **Colours** | Accent aurora green `#6af2c0`, foil snow `#eef6ff`. Nearest colours: Mortis (13), Zephyr (14) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `aurora` |
| **Role** | Mage, ranged |
| **Faction** | The Hourkeepers (lore: She dances the aurora that tells the hour at Frostfall: Isolde's sister, Lyra's partner, Kaia's rival for the sky.) |
| **The new thing** | Lines that change whoever crosses them. Her curtains stop nobody. Walking through one gives its colour: green slows, violet silences, rose marks you for more damage. She gets speed from her own. |
| **The question** | "Will you cross the light, or walk around?" |
| **The weakness** | Curtains are lines: going round is always possible. She is frail. |
| **The second decision** | Her next curtain's colour comes in turn (green, violet, rose) and shows on her crown: cast now, or hold for the colour she needs. |
| **How it looks** | A tall dancer in deep night-blue with a white fur-trimmed mantle, silver embroidery like star charts, long pale braids, a crown of thin silver rays; a slim silver wand in the left hand. |
| **Nearest heroes** | Isolde (frost; her sister), Opaline (light), Lyra (night) |

**Changed from the card shown on 2026-11-14:** None to the idea. The ultimate swings each curtain 90 degrees in 2.5 s, and its fans show on the floor 1.0 s before.

## Gate 3: the kit on paper

Saga. Theme `aurora`. Mage, ranged. **560 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a streak of light). Accent `#6af2c0`, foil `#eef6ff`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Polar Light** | PASSIVE | - | - | - | - | Her curtains come in turn: green (slow 35% for 1.5 s), violet (silence 0.8 s), rose (exposed: 20% more damage taken for 3 s). The next colour shows as a jewel on her crown. An enemy who walks through a curtain takes its colour (once per curtain per 2 s). She, crossing her own, gains 25% speed for 1.5 s. At most three curtains stand. |
| Q | **Shimmer** | LINE | 3.5 | 10 m | radius 0.3 | 52 | 0.25 s wind-up, 22 m/s. Where it ends, in you or in the floor, a 3 m curtain of the next colour stands across its path for 4 s. |
| W | **Curtain** | LINE | 9 | 10 m | 10 m long, 1 m wide | 40 | A curtain of the next colour falls across the aimed point after 0.6 s: 40 to anyone standing on it; then it hangs 6 s. |
| E | **Skate** | DASH | 10 | 6 m | - | - | She glides 6 m in 0.4 s on rime; through her own curtain she gains its haste. |
| R | **The Sky Opens** | GLOBAL | 22 | every curtain; the new one 12 m | each curtain's sweep | 45 per curtain that sweeps you (3 at most); 40 under the new one | She raises her wand: a new 12 m curtain falls across her aim at 1.0 s (40 to anyone on it), and the fan each curtain will sweep shows on the floor. Then every curtain swings 90 degrees round its middle over 2.5 s; one that passes you gives its colour and 45. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Polar Light.** Walk round. Every curtain shows its colour, and the next one shows on her crown.
- **Q Shimmer.** Sidestep: it reaches 6 m at 0.25 + 6/22 = 0.52 s. *(bolt: 0.25 + 6/22 = 0.52 s to 6 m (at least 0.5) OK; first hit 0.3 s after the cast (a lasting mark after that))*
- **W Curtain.** Step off its line: 0.25 + 0.5/4 = 0.38 s against 0.6 s. Then go round its ends, or take its colour. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 0.6 s OK; first hit 0.6 s after the cast (a lasting mark after that))*
- **E Skate.** -
- **R The Sky Opens.** The fans show 1.0 s ahead: leave them. Or stand near a curtain's middle, where it moves slowest: the tip of a 10 m curtain moves 5 x 1.57 / 2.5 = 3.1 m/s, slower than walking. The new curtain: 0.25 + 0.5/4 = 0.38 s against 1.0 s. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 1 s OK; first hit 1 s after the cast, last 3.5 s)*

### The question, the weakness, the second decision

- **Question:** "Will you cross the light, or walk around?"
- **Weakness:** Curtains are lines: going round is always possible. She is frail.
- **Second decision:** Her next curtain's colour comes in turn (green, violet, rose) and shows on her crown: cast now, or hold for the colour she needs.

### Budget

Mage, 560 HP. Q 52, W 40, R up to 135 when all three curtains sweep you, about 90 as it usually lands. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: none.** Curtains are her marks; crossing one is read in `victimTick` from the hero's last and present position; slow, silence and "exposed" exist. Build order: 4 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Polar Light | Marks and a crossing test in `victimTick`. | The victim's screen. |
| Q Shimmer | A bolt; the curtain is laid where the bolt ended, told from the screen that decides its hit (the lesson of hero 40). | The victim's screen. |
| W Curtain | A line hit at 0.6 s, then a mark. | The victim's screen. |
| E Skate | `ctx.moveCaster`. | Her client. |
| R The Sky Opens | The marks' angle as a function of time from the cast, the same on both screens. | The victim's screen. |

### What the CPU does

**As Saga** (`aiHold`, `aiGoal`):

- Q in reach.
- W across the way of an enemy coming at her; it picks the colour by what shows (violet against a caster, green against a melee).
- E through her own curtain when getting away.
- R when the enemy stands within 6 m of a curtain.

**Against Saga** (`enemyGoal`):

- Walks round curtains rather than through them.
- During the ultimate's 1.0 s leaves the drawn fans.

### The effects, part by part

In the hero's palette: accent aurora green with a pale snow foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Polar Light:** Tall soft folds of light, bright at the hem, fading up into small stars, in aurora green, violet and rose; a snow-white hem line on the floor so the line reads from the camera.
- **Q Shimmer:** A thin luminous ribbon that folds upward into a small curtain where it stops.
- **W Curtain:** A curtain dropping from above like cloth, bright at the hem.
- **E Skate:** A white frost trail with sparkles.
- **R The Sky Opens:** The whole floor washed faintly in green and violet; pale arcs show the sweeps; the curtains turn like doors.

### Names and files (checked free on 2026-11-14)

Labels: 'shimmer', 'curtain', 'skate', 'the sky opens'. Files: `src/heroes/aurora/spells/shimmer.ts`, `src/heroes/aurora/spells/curtain.ts`, `src/heroes/aurora/spells/skate.ts`, `src/heroes/aurora/spells/theSkyOpens.ts`; in `src/heroes/aurora/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
