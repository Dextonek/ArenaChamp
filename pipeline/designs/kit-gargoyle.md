---
title: Corbel, the Stonewing (new hero 16 of 20)
tags: [design, heroes, kits, gargoyle]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Corbel, the Stonewing

New hero 16 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A temple guard turned to stone, who wakes at dusk with wings and watches from the eaves. |
| **Shape** | A winged figure crouched on a ledge, wings folded. |
| **Colours** | Accent petrol `#1c8c8c`, foil limestone `#d8d6cc`. Nearest colours: Morwen (26), Itzel (27) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `gargoyle` |
| **Role** | Assassin, melee |
| **Faction** | The Court of Dusk (lore: A Night Temple guard who met Lithea's eyes, turned to stone, and woke at dusk with wings.) |
| **The new thing** | Standing on top of cover. He perches on the arena's pillars and walls and on anything placed (Gerald, trees, doors, statues, bells, mirrors): up there no blade and no basic attack reaches him, and he sees over the cover he sits on. |
| **The question** | "Where is he going to land?" |
| **The weakness** | Perched he cannot walk, and every bolt and spell still finds him; a perch lasts 6 s, so a melee hero waits beneath, outside the drop's 2 m, and meets him when he comes down; on open ground with no cover he is a short-lived assassin. |
| **The second decision** | Stay on the perch (safe from blades, open to bolts) or drop on the enemy (the big hit, and back on the ground). |
| **How it looks** | A lean, noble figure of weathered grey limestone with petrol-dark veins, in the remains of a temple guard's armour and a faded wine sash, great stone wings folded like a cloak, a calm carved face with glowing petrol eyes; a guard's short glaive turned to stone in the right hand. |
| **Nearest heroes** | Bram (limestone; his friend), Lithea (who made him), Nyx (the Court's other blade) |

## Gate 3: the kit on paper

Corbel. Theme `gargoyle`. Assassin, melee. **640 HP**, 4.3 m/s, basic attack 14 per 1.1 s at 2.6 m (the stone glaive). Accent `#1c8c8c`, foil `#d8d6cc`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Eave-Watcher** | PASSIVE | - | - | - | - | Perched, no melee spell and no basic attack reaches him, he takes 20% less from bolts, and his spells ignore the cover he stands on. He cannot walk while perched: he leaves by Drop, or steps off (a 2 m hop, 0.3 s). A perch is any cover or placed thing at least 1 m wide; he stays up to 6 s. |
| Q | **Talon Rake** | QUICK | 3 | 2.8 m | 100 degrees | 46 (from a perch: Stone Spit, 40) | 0.25 s wind-up, a rake toward the nearest enemy in reach. From a perch it is Stone Spit: a bolt, 8 m, 0.3 s wind-up, 18 m/s, 40. |
| W | **Take Perch** | LEAP | 8 | cover within 7 m | - | - | He leaps onto cover within 7 m (0.5 s) and perches, up to 6 s. |
| E | **Drop** | LEAP | 9 | 6 m from a perch | radius 2 m | 60 and knock-up 0.4 s | From a perch: a circle shows for 0.75 s where he will land; he lands: 60 and a 0.4 s knock-up within 2 m. From the ground: a 3 m hop, no damage. |
| R | **Stone Wings** | LINE | 22 | 10 m (14 from a perch) | path 2 m wide; landing 2.5 m | 60 under the path; 60 and stun 0.6 s at the landing | He spreads his wings for 1.2 s while the line shows, then glides along it in 0.5 s, over cover: 60 to anyone under his path, and where he lands, 60 and a 0.6 s stun within 2.5 m. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Eave-Watcher.** Shoot him; melee heroes wait below, out of the drop's reach, or go where there is no cover.
- **Q Talon Rake.** Beyond 2.8 m of him on the ground. The spit reaches 6 m at 0.3 + 6/18 = 0.63 s: sidestep. *(spacing: stand outside its reach (no reaction can beat a blow up close); bolt: 0.3 + 6/18 = 0.63 s to 6 m (at least 0.5) OK; first hit 0.25 s after the cast)*
- **W Take Perch.** Watch which cover he can reach; hit him once he lands.
- **E Drop.** Leave the circle: 0.25 + 2/4 = 0.75 s against 0.75 s. *(circle 2 m: 0.25 + 2/4 = 0.75 s needed, warned 0.75 s OK; first hit 0.75 s after the cast)*
- **R Stone Wings.** Off the path: 0.25 + 1/4 = 0.5 s against 1.2 s. Off the landing: 0.25 + 2.5/4 = 0.88 s against 1.7 s. *(lane 2 m wide: 0.25 + 1/4 = 0.50 s needed, warned 1.2 s OK; circle 2.5 m: 0.25 + 2.5/4 = 0.88 s needed, warned 1.7 s OK; first hit 1.2 s after the cast, last 1.7 s)*

### The question, the weakness, the second decision

- **Question:** "Where is he going to land?"
- **Weakness:** Perched he cannot walk, and every bolt and spell still finds him; a perch lasts 6 s, so a melee hero waits beneath, outside the drop's 2 m, and meets him when he comes down; on open ground with no cover he is a short-lived assassin.
- **Second decision:** Stay on the perch (safe from blades, open to bolts) or drop on the enemy (the big hit, and back on the ground).

### Budget

Assassin, 640 HP, 4.3 m/s. Q 46 (a 40 bolt from a perch); the drop 60 with a 0.4 s knock-up; the ultimate 120 in two parts. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: large.** Perching is new from end to end: a hero standing on top of an obstacle (walking forbids it today), a state in which melee and basic-attack checks skip him, his movement held on the perch, and a CPU taught to use it and answer it. His client decides where he stands and tells the other; the victim's screen skips melee hits on a perched hero. Build order: 17 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Eave-Watcher | The perch state (new, large). | His client (position); the victim's screen skips melee hits. |
| Q Talon Rake | A quick cone, or a bolt when perched. | The victim's screen. |
| W Take Perch | `ctx.moveCaster` onto an obstacle (new). | His client. |
| E Drop | A leap with a circle at the landing. | The victim's screen. |
| R Stone Wings | A dash with a line and a circle. | The victim's screen. |

### What the CPU does

**As Corbel** (`aiHold`, `aiGoal`):

- W onto cover within 5 m of the enemy.
- From the perch: Q (the spit) while the enemy is in sight.
- E when the enemy is within 6 m of the perch and under 60%, or stunned.
- R from a perch when the enemy is in line within 14 m.

**Against Corbel** (`enemyGoal`):

- Shoots him while he perches; stays away from cover he can reach.
- Leaves the drop's circle.

### The effects, part by part

In the hero's palette: accent petrol with a pale limestone foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Eave-Watcher:** He crouches on the cover's top, wings folded, eyes glowing petrol.
- **Q Talon Rake:** A stone-claw arc with grey dust; the spit a gob of grey stone that cracks on the hit.
- **W Take Perch:** Wings beat once; stone dust falls from the ledge as he lands.
- **E Drop:** A dark circle on the floor with a petrol rim, then a stone slam and a ring of grit.
- **R Stone Wings:** Great stone wings spread; a shadow lane on the floor; a gliding grey figure; a slam of rubble at the end.

### Names and files (checked free on 2026-11-14)

Labels: 'talon rake', 'take perch', 'drop', 'stone wings'. Files: `src/heroes/gargoyle/spells/talonRake.ts`, `src/heroes/gargoyle/spells/takePerch.ts`, `src/heroes/gargoyle/spells/drop.ts`, `src/heroes/gargoyle/spells/stoneWings.ts`; in `src/heroes/gargoyle/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
