---
title: Lithea, the Stone Gaze (new hero 1 of 20)
tags: [design, heroes, kits, gorgon]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Lithea, the Stone Gaze

New hero 1 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A veiled gorgon priestess whose look turns whoever meets it to marble. |
| **Shape** | The eye with a slit pupil, between two serpent coils. |
| **Colours** | Accent verdigris `#3fbf9a`, foil marble `#efeae0`. Nearest colours: Mortis (10), Itzel (13) (Lab distance; under 12 reads as the same).  Colour clash: the card's accent `#3fbf9a` is 10 from Mortis's colour (under 12 reads as the same). A nearby colour that keeps apart: `#2cb28b`. Or keep it and let the figure tell them apart; to decide at the look. |
| **Theme word** | `gorgon` |
| **Role** | Controller, ranged |
| **Faction** | The Dune Throne (lore: The last veiled priestess of the tombs of the Sands; a guard who looked at her too long became Corbel the gargoyle.) |
| **The new thing** | The gaze: her spells care which way you face. Facing her when they land turns you to stone a little; facing away, they barely touch you. No hero uses facing today. |
| **The question** | "Can you fight me without looking at me?" Walking at her means facing her; backing off means turning your back. |
| **The weakness** | Facing away is always an answer, and it is free. Her spells are strong only on a face, and her veil makes her softer while it is up. |
| **The second decision** | Her veil lifts for 2.5 s after every spell: the gaze counts, and she takes 15% more. She chooses when to cast, and so when to be bare. |
| **How it looks** | Tall, a sheer verdigris veil over the face, bronze serpent coils as a crown, a marble-white gown with bronze edges, a short bronze staff with a serpent eye in the left hand. |
| **Nearest heroes** | Sefu (gold sand, the same faction), Isolde (stone-pale frost), Silvane (her sworn enemy; a mirror, not a gaze) |

**Changed from the card shown on 2026-11-14:** The veil lifts by itself for 2.5 s after each spell (the card had her switch it; there is no fifth key). Q is a serpent that seeks a clicked enemy, not a line: as a line her four shapes were Silvane's (line, terrain, dash, self). W raises two statues, not three (the budget).

## Gate 3: the kit on paper

Lithea. Theme `gorgon`. Controller, ranged. **610 HP**, 3.9 m/s, basic attack 10 per 1.0 s at 6.5 m (a green hiss). Accent `#3fbf9a`, foil `#efeae0`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Marble Grace** | PASSIVE | - | - | facing: within 70 degrees | - | A gaze hit (any of her spells) on an enemy who faces her (she is within 70 degrees of where they face) adds a Marble stack, 5 s; three stacks turn them to stone for 1.0 s, then 4 s without stacks. Facing away, her spells deal half and add nothing. Her veil is up for 2.5 s after each of her spells (the gaze counts; she takes 15% more) and down otherwise (no stacks; she takes 15% less). Both screens show the veil and the stacks. |
| Q | **Serpent Strike** | TGT | 4 | 9 m | a seeking serpent | 52 (26 facing away) | A bronze serpent lunges at a clicked enemy: 0.25 s wind-up, then 14 m/s, seeking. Needs sight at the cast; cover stops it. |
| W | **Garden of Statues** | TERRAIN | 12 | 10 m | two statues, 2 m apart | - (the rise pushes 1 m) | Two marble statues rise across the aim after 0.6 s: 80 HP each, 6 s; they block walking and bolts for both sides. Each statue gazes: an enemy within 3.5 m in front of one, facing it, gets a Marble stack (once per statue per 2 s). |
| E | **Coil** | DASH | 10 | 6 m | coil 6 x 1.2 m | - (slow 30%) | She slithers 6 m in 0.3 s and leaves a bronze coil on the floor for 3 s; enemies on it are slowed 30%. |
| R | **Unveiling** | SELF | 22 | 12 m | radius 12 m | 80 and stone 1.2 s facing her; 30 facing away | She lifts the veil: for 1.4 s a great eye opens on the floor round her and its 12 m ring shows. At the end every enemy within 12 m who faces her turns to stone for 1.2 s and takes 80; facing away, 30 and nothing else. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Marble Grace.** Face away when her spells land. Every stack shows on your legs, so the third is never a surprise.
- **Q Serpent Strike.** Put cover between you: from 6 m it lands at 0.25 + 6/14 = 0.68 s, and cover 1.5 m away is reached in 0.63 s. Or turn your back as it lands: half damage, no stack. *(bolt: 0.25 + 6/14 = 0.68 s to 6 m (at least 0.5) OK; first hit 0.5 s after the cast)*
- **W Garden of Statues.** They are cover for you too. Do not face them: pass with your back turned, or break one (80 HP: a spell and two attacks). The rise warns 0.6 s for a 0.8 m footprint: 0.25 + 0.8/4 = 0.45 s. *(circle 0.8 m: 0.25 + 0.8/4 = 0.45 s needed, warned 0.6 s OK; first hit 0.6 s after the cast (a lasting mark after that))*
- **E Coil.** Go round the coil or cross it: it is 1.2 m wide.
- **R Unveiling.** Turn your back: it takes one reaction (0.25 s) against 1.4 s. The cost is that you cannot walk at her or cast at her while turned, and she uses those 1.4 s. *(reaction: 0.25 + 0 = 0.25 s needed, given 1.4 s OK; first hit 1.4 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Can you fight me without looking at me?" Walking at her means facing her; backing off means turning your back.
- **Weakness:** Facing away is always an answer, and it is free. Her spells are strong only on a face, and her veil makes her softer while it is up.
- **Second decision:** Her veil lifts for 2.5 s after every spell: the gaze counts, and she takes 15% more. She chooses when to cast, and so when to be bare.

### Budget

Controller, 610 HP (600-620). Q 52 every 4 s is under a mage's 60 because it seeks its target; the stone is the payoff, and it is capped by the lock rule (1.5 s in a row at most). The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: small.** A facing test in `dealt` (the victim's own screen knows where its hero faces) and a marble look for the stun. Everything else is built the way existing kits are. Build order: 6 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Marble Grace | Facing test in `dealt` (new small helper); stacks with `t.addStacks`; stone is the stun status with a marble look; the veil is `t.show` from `afterCast`. | Hits and stacks: the victim's screen. The veil: her own client. |
| Q Serpent Strike | A seeking bolt, as Pip's hunting parcel follows its target. | The victim's screen. |
| W Garden of Statues | Placed things (an obstacle plus a turret unit with no damage, as `crystalPillar.ts`); the gaze is read in `victimTick` from her marks. | The victim's screen. |
| E Coil | `ctx.moveCaster` and a mark read in `victimTick`. | Her client moves her; the slow on the victim's screen. |
| R Unveiling | A self ring that re-checks positions and facing at 1.4 s. | The victim's screen. |

### What the CPU does

**As Lithea** (`aiHold`, `aiGoal`):

- Q whenever the enemy is in sight within 9 m.
- W between her and an enemy closer than 6 m, or behind a fleeing one to cut the way.
- E to get away when the enemy is within 3.5 m (escape).
- R when the enemy is within 10 m and either has a Marble stack or is casting (casting turns them to face her).

**Against Lithea** (`enemyGoal`):

- Keeps 7 m and comes in from her side, not her front.
- During Unveiling's wind-up walks away from her (walking away is facing away).
- Breaks a statue that stands within 4 m before fighting beside it.

### The effects, part by part

In the hero's palette: accent verdigris with a pale marble foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Marble Grace:** Marble creeps up the legs in white veined plates: shins, knees, waist for one, two, three. Stone: a full marble shell with one verdigris crack line, which flakes off as dust at the end.
- **Q Serpent Strike:** A bronze serpent ribbon with verdigris scales, mouth open; on the hit a puff of white stone dust.
- **W Garden of Statues:** The floor cracks and two robed marble figures rise, white with grey veins and verdigris trims; their eyes glint green when they gaze.
- **E Coil:** A scaled bronze S-curve drawn on the floor, glinting, fading from the tail.
- **R Unveiling:** A huge almond eye drawn on the floor in verdigris with a marble iris; its slit pupil narrows over 1.4 s; the veil lifts; a white flash on those facing her and the marble shell.

### Names and files (checked free on 2026-11-14)

Labels: 'serpent strike', 'garden of statues', 'coil', 'unveiling'. Files: `src/heroes/gorgon/spells/serpentStrike.ts`, `src/heroes/gorgon/spells/gardenOfStatues.ts`, `src/heroes/gorgon/spells/coil.ts`, `src/heroes/gorgon/spells/unveiling.ts`; in `src/heroes/gorgon/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
