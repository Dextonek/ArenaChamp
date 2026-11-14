---
title: Tova, the Hallbreaker (new hero 19 of 20)
tags: [design, heroes, kits, sapper]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Tova, the Hallbreaker

New hero 19 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The Underforge's sapper, who turns walls into doors with powder. |
| **Shape** | A satchel charge with a burning fuse. |
| **Colours** | Accent fuchsia `#e83ad0`, foil powder white `#f0eef0`. Nearest colours: Cantor (25), Thessa (31) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `sapper` |
| **Role** | Engineer, ranged |
| **Faction** | The Underforge (lore: The Underforge's sapper: when a wall must stop being a wall, she is sent for.) |
| **The new thing** | Breaking the arena itself. Her charges destroy cover: the arena's own pillars and walls for the rest of the round, and anything placed. No hero changes the arena's own ground. |
| **The question** | "Is your cover still there?" |
| **The weakness** | Breaking cover takes her charges and her time, and open ground leaves her, a 580 HP caster, with nothing to hide behind either. |
| **The second decision** | Spend a charge on the enemy, or on the wall they stand behind. |
| **How it looks** | A short, broad sapper in soot-dark leathers and a leather cap with smoked goggles, a bandolier of charges glowing fuchsia at the seams, a coil of fuse at the hip; a long iron pry-bar in the right hand. |
| **Nearest heroes** | Mabel (digging; her friend), Ada (an engineer), Bram (who builds what she breaks) |

## Gate 3: the kit on paper

Tova. Theme `sapper`. Engineer, ranged. **580 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a spark cap). Accent `#e83ad0`, foil `#f0eef0`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Rubble** | PASSIVE | - | - | - | - | Her spells harm cover: the arena's pillars and walls have 150 against them (placed things their own HP). Broken cover is gone for the round and leaves rubble for 2 s (slow 30% across it). |
| Q | **Spark Cap** | LOB | 3 | 9 m | radius 1.2 m | 48 (30 to cover) | She lobs a cap over cover; its spark marks the floor where it will land, 0.6 s after the cast, and it pops in 1.2 m. |
| W | **Breaching Charge** | FUSE | 9 | 8 m | radius 3 m | 65 (150 to cover) | A satchel sticks where it lands, on the floor or on cover; its fuse burns 1.5 s; then it blasts 3 m: 65 to heroes, 150 to cover. |
| E | **Powder Leap** | DASH | 10 | 6 m | take-off 2 m | 25 and push 1.5 m at the take-off | A small charge under her feet throws her 6 m in 0.4 s; the take-off blast deals 25 and pushes 1.5 m within 2 m. |
| R | **Bring It Down** | TGT | 22 | 10 m | radius 4 m | 110; 40 more under falling stones | She plants a great charge on a piece of cover or on a point within 10 m; 1.4 s later it blows: 110 within 4 m, and cover there is gone. On cover, its stones fall in a 4 m strip behind it (away from her): 40 more there. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Rubble.** Fight her in the open, where her charges have nothing to break.
- **Q Spark Cap.** Step off the spark: 0.25 + 1.2/4 = 0.55 s against 0.6 s. *(circle 1.2 m: 0.25 + 1.2/4 = 0.55 s needed, warned 0.6 s OK; first hit 0.6 s after the cast)*
- **W Breaching Charge.** Leave the circle: 0.25 + 3/4 = 1.0 s against 1.5 s. *(circle 3 m: 0.25 + 3/4 = 1.00 s needed, warned 1.5 s OK; first hit 1.5 s after the cast)*
- **E Powder Leap.** Do not stand next to her when she leaves. *(spacing: stand outside its reach (no reaction can beat a blow up close))*
- **R Bring It Down.** Leave the circle: 0.25 + 4/4 = 1.25 s against 1.4 s, and not toward the strip behind the cover. *(circle 4 m: 0.25 + 4/4 = 1.25 s needed, warned 1.4 s OK; first hit 1.4 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Is your cover still there?"
- **Weakness:** Breaking cover takes her charges and her time, and open ground leaves her, a 580 HP caster, with nothing to hide behind either.
- **Second decision:** Spend a charge on the enemy, or on the wall they stand behind.

### Budget

Engineer, 580 HP. Q 48, the satchel 65, the ultimate 110 (40 more behind broken cover); her strength is taking the arena apart. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: large.** Breakable arena cover: the arena's obstacles get health against her spells, the path finder and the CPU's use of cover must notice a hole, and both screens must agree when a piece goes (decided on her own client and told with `show`); the arena puts its cover back each round. Build order: 19 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Rubble | Breakable arena cover (new, large). | Her client decides a break; `show` tells the other. |
| Q Spark Cap | A lobbed zone that also harms cover. | The victim's screen. |
| W Breaching Charge | A fuse zone. | The victim's screen; the cover on her client. |
| E Powder Leap | `ctx.moveCaster` and a small ring. | Her client; the hit on the victim's screen. |
| R Bring It Down | A zone and a break. | The victim's screen; the cover on her client. |

### What the CPU does

**As Tova** (`aiHold`, `aiGoal`):

- W on the cover the enemy hides behind, or at the enemy.
- Q in reach.
- E to get away (escape).
- R on cover within 4 m of the enemy, or on the enemy.

**Against Tova** (`enemyGoal`):

- Leaves the satchel's circle; does not rest behind cover she can reach; fights her in the open.

### The effects, part by part

In the hero's palette: accent fuchsia with a pale powder white foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Rubble:** Rubble: a low grey pile with fuchsia embers that fades.
- **Q Spark Cap:** A small dark cap tumbling in an arc with a fuchsia spark, a pop and a puff of soot.
- **W Breaching Charge:** A dark satchel with fuchsia seams; a fuchsia spark running down its fuse; a fuchsia-white flash, soot wisps and flying stones.
- **E Powder Leap:** A puff of soot and a high arc.
- **R Bring It Down:** A great charge strapped to the wall, a long fuchsia fuse spark, a collapse with stones falling in a strip.

### Names and files (checked free on 2026-11-14)

Labels: 'spark cap', 'breaching charge', 'powder leap', 'bring it down'. Files: `src/spells/targeted/sparkCap.ts`, `src/spells/targeted/breachingCharge.ts`, `src/spells/targeted/powderLeap.ts`, `src/spells/targeted/bringItDown.ts`; `src/effects/parts/sapper.ts`, `src/kits/sapper.ts`, `src/traits/sapper.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
