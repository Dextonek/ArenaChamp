---
title: Itzel, the Obsidian Herald (new hero 7 of 20)
tags: [design, heroes, kits, obsidian]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Itzel, the Obsidian Herald

New hero 7 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A herald with a black glass blade who splits the ground, and only she can cross what she splits. |
| **Shape** | A black glass blade crossing a split in the ground. |
| **Colours** | Accent turquoise `#30d0c0`, foil obsidian sheen `#d8dce8` |
| **Theme word** | `obsidian` |
| **Role** | Bruiser, melee |
| **Faction** | The Underforge (lore: Herald of the Underforge, speaking for the fallen sun's fire where it cools into black glass.) |
| **The new thing** | Ground that only she can cross. Her strikes split the floor: for 3 s each crack is a chasm to the enemy (go round, or dash over) and a road to her (she walks across, and runs along it). No hero makes terrain that blocks only one side. |
| **The question** | "Which side of the crack do you want to be on?" |
| **The weakness** | Every crack is straight, at most 9 m, shows as a bright line and closes in 3 s; any dash jumps it. Without cracks she is an ordinary fighter. |
| **The second decision** | Cut the enemy off from cover and keep them near her, or cut a road away for herself. |
| **How it looks** | A lean warrior in black lacquered armour inlaid with turquoise, a feathered mantle in deep jade and white, a gold collar; a broad black glass blade in the right hand. |
| **Nearest heroes** | Bram (ground bursts), Mabel (holes), Shiori (strokes on the floor) |

**Changed from the card shown on 2026-11-14:** Her new thing changed. The card made the danger where two cracks cross; that is Shiori's ink, whose strokes already burst where they cross (rule 2). Now her cracks are ground only she can cross. Glass Edge is renamed Obsidian Edge (glass edge is taken).

## Gate 3: the kit on paper

Itzel. Theme `obsidian`. Bruiser, melee. **740 HP**, 4.0 m/s, basic attack 14 per 1.2 s at 2.6 m (the obsidian blade). Accent `#30d0c0`, foil `#d8dce8`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Fault Lines** | PASSIVE | - | - | - | - | Her cracks are chasms to the enemy for 3 s (they cannot walk across; a dash crosses), then harmless scars for 3 s. She walks across them freely. At most four; a fifth closes the oldest. |
| Q | **Obsidian Edge** | CONE | 3 | 3.2 m | 100 degrees | 44 | 0.3 s wind-up, a sweep; it leaves a 6 m crack along its middle line, from her outward. |
| W | **Rift** | LINE | 8 | 9 m | 9 m x 1 m | 50, pushed off to the nearer side | A straight crack runs from her feet 9 m along the aim, opening over 0.5 s (a glint runs ahead of it): 50 to anyone on it, pushed off to the side they stood nearer. Then it is a chasm for 3 s. |
| E | **Shatterstep** | DASH | 9 | 6 m (10 m along a crack) | - | 30 to an enemy she passes within 1 m | She runs 6 m in 0.4 s, cracking the floor behind her (a scar, not a chasm). Started on a crack and aimed along it, she runs 10 m. |
| R | **Black Sun** | NOVA | 22 | 7 m | eight cracks, 7 m x 1.2 m | 100 and knock-up 0.4 s | A disc of black glass rises behind her for 1.2 s while eight cracks are drawn outward from her, a star fixed to her aim. At 1.2 s they open: 100 and a 0.4 s knock-up to anyone on one; then they stand as chasms for 3 s and cut the ground round her into eight wedges. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Fault Lines.** Go round, wait three seconds, or dash over.
- **Q Obsidian Edge.** Stand beyond 3.2 m. The crack it leaves points where she faced. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.3 s after the cast (a lasting mark after that))*
- **W Rift.** Step off its line: 0.25 + 0.5/4 = 0.38 s against 0.5 s. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 0.5 s OK; first hit 0.5 s after the cast (a lasting mark after that))*
- **E Shatterstep.** Do not stand on a crack's far end.
- **R Black Sun.** Step off a crack: 0.25 + 0.6/4 = 0.4 s against 1.2 s. Then your wedge is shut on two sides: leave by its open end, or dash. *(lane 1.2 m wide: 0.25 + 0.6/4 = 0.40 s needed, warned 1.2 s OK; first hit 1.2 s after the cast (a lasting mark after that))*

### The question, the weakness, the second decision

- **Question:** "Which side of the crack do you want to be on?"
- **Weakness:** Every crack is straight, at most 9 m, shows as a bright line and closes in 3 s; any dash jumps it. Without cracks she is an ordinary fighter.
- **Second decision:** Cut the enemy off from cover and keep them near her, or cut a road away for herself.

### Budget

Bruiser, 740 HP (720-800). Q 44 every 3 s, W 50, R 100 with a knock-up; the terrain is her control. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** Terrain that blocks one side only: an obstacle that knows whom it stops. The enemy's own client moves its hero and reads her marks; the CPU's path finder must see them too. Build order: 14 of 20 ([the kits page](../../docs/heroes/kits20/index.html)).

| Key | Needs | Decided on |
|---|---|---|
| P Fault Lines | One-sided terrain (new). | The enemy's own client (it moves its hero). |
| Q Obsidian Edge | A cone and a mark. | The victim's screen. |
| W Rift | A line hit, then a mark. | The victim's screen. |
| E Shatterstep | `ctx.moveCaster`. | Her client; the hit on the victim's screen. |
| R Black Sun | Eight line hits, then eight marks. | The victim's screen. |

### What the CPU does

**As Itzel** (`aiHold`, `aiGoal`):

- Q in melee reach.
- W along the line between the enemy and their nearest cover, or across their way out.
- E along a crack to catch the enemy, or away along one.
- R when the enemy is within 4 m.

**Against Itzel** (`enemyGoal`):

- Walks round cracks (the path finder treats them as walls for 3 s).
- Dashes across when a wedge has shut it in with her.
- Keeps out of her front.

### The effects, part by part

In the hero's palette: accent turquoise with a pale obsidian sheen foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Fault Lines:** The ground split in a straight line, black glass at its lips and turquoise deep inside: bright while it is a chasm, dim as a scar.
- **Q Obsidian Edge:** An obsidian arc with a turquoise inner edge, the crack running out from its middle.
- **W Rift:** A turquoise glint running ahead, the ground splitting behind it, black glass flakes.
- **E Shatterstep:** Glass shards kicked up at each step.
- **R Black Sun:** A disc of black glass with a turquoise rim rises behind her; the floor bursts along eight lines in black glass spikes.

### Names and files (checked free on 2026-11-14)

Labels: 'obsidian edge', 'rift', 'shatterstep', 'black sun'. Files: `src/spells/targeted/obsidianEdge.ts`, `src/spells/targeted/rift.ts`, `src/spells/targeted/shatterstep.ts`, `src/spells/targeted/blackSun.ts`; `src/effects/parts/obsidian.ts`, `src/kits/obsidian.ts`, `src/traits/obsidian.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
