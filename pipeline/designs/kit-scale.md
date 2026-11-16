---
title: Nebet, the Heartweigher (new hero 11 of 20)
tags: [design, heroes, kits, scale]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Nebet, the Heartweigher

New hero 11 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The judge of the dead of the Sands, who weighs every heart against a feather. |
| **Shape** | A balance scale: a feather in one pan, a heart in the other. |
| **Colours** | Accent lapis `#3030f2`, foil papyrus `#efe2bc`. Nearest colours: Nyx (29), The Great Zambini (32) (Lab distance; under 12 reads as the same). The accent lapis is dark on the game's dark floor: its energy needs a lighter shade of it and the pale papyrus beside it (rule 6); settle it at the look.  |
| **Theme word** | `scale` |
| **Role** | Juggernaut, melee |
| **Faction** | The Dune Throne (lore: The Throne's judge of the dead, who weighs hearts against one of Anka's feathers.) |
| **The new thing** | The scale: she compares the two heroes. A scale over the fight tips toward whoever has more of their health left, and her spells grow with how far it tips against her. No hero compares the two health bars today. |
| **The question** | "Do you want to be ahead of me?" Pulling ahead makes her hits heavier. |
| **The weakness** | Ahead, she is a plain fighter who hits 10% softer, and her ultimate is weak when she is winning. Keeping the bars level takes her edge away. |
| **The second decision** | When to weigh: her ultimate pays most when she is far behind, so she can wait for it, or spend it early to stop the bleeding. |
| **How it looks** | Tall and still, in white linen with a lapis headcloth and a broad gold collar; a gold scale of two pans in the left hand, a hooked bronze blade in the right; a white feather at the shoulder. |
| **Nearest heroes** | Sefu (gold and linen; her king), Shiori (ink blue: Nebet's lapis is darker and sits on gold), Anka (feathers) |

## Gate 3: the kit on paper

Nebet. Theme `scale`. Juggernaut, melee. **720 HP**, 3.9 m/s, basic attack 14 per 1.2 s at 2.6 m (the hooked bronze blade). Accent `#3030f2`, foil `#efe2bc`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **The Feather and the Heart** | PASSIVE | - | - | - | her hits up to +25%, or -10% | A scale hangs over the fight for both players. It tips toward the hero with the larger share of their health left; the tip is the difference in points (0 to 100). While it tips against her (she is lighter), her hits deal 1% more per 2 points, 25% at most; while it tips for her, 10% less. |
| Q | **Verdict** | QUICK | 3 | 3 m | 100 degrees | 44 (by the scale) | 0.3 s wind-up, a hooked cut toward the nearest enemy in reach. |
| W | **Weight of the Dead** | ZONE | 9 | 9 m | radius 3.5 m | 50 and slow 40% for 1.5 s (by the scale); root 0.6 s if the enemy is ahead | A great gold pan's shadow covers a point; after 1.15 s it presses down: 50 and slowed 40% for 1.5 s; an enemy who is ahead on the scale is also rooted 0.6 s. |
| E | **Feather-Light** | SELF | 11 | - | - | - (a 40 shield when she is the lighter) | For 2 s she is light as the feather: 30% faster and free of slows; if she is the lighter on the scale, also a shield of 40. |
| R | **The Weighing** | SELF | 24 | 6 m | radius 6 m | 40 + 2 per point against her (140 at most); heals her a quarter (35 at most) | A great scale rises behind her and the 6 m ring shows for 1.8 s. At the end, if the enemy is inside: 40, plus 2 for every point the scale tips against her (140 at most), and she heals a quarter of it. If the scale tips for her: 40 and no heal. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P The Feather and the Heart.** Keep the bars level, or end the fight in one burst rather than slowly.
- **Q Verdict.** Stand beyond 3 m. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.3 s after the cast)*
- **W Weight of the Dead.** Leave the shadow: 0.25 + 3.5/4 = 1.13 s against 1.15 s. *(circle 3.5 m: 0.25 + 3.5/4 = 1.13 s needed, warned 1.15 s OK; first hit 1.15 s after the cast)*
- **E Feather-Light.** Do not chase her for those 2 s.
- **R The Weighing.** Leave the ring: 0.25 + 6/4 = 1.75 s against 1.8 s. Or be behind on the scale yourself. *(circle 6 m: 0.25 + 6/4 = 1.75 s needed, warned 1.8 s OK; first hit 1.8 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Do you want to be ahead of me?" Pulling ahead makes her hits heavier.
- **Weakness:** Ahead, she is a plain fighter who hits 10% softer, and her ultimate is weak when she is winning. Keeping the bars level takes her edge away.
- **Second decision:** When to weigh: her ultimate pays most when she is far behind, so she can wait for it, or spend it early to stop the bleeding.

### Budget

Juggernaut, 720 HP (620-780). Her spells sit a little under the budget (Q 44, W 50) and grow by up to 25% when she is behind; her ultimate is 40 to 140 by the scale, with a heal of a quarter, 35 at most (the rule: 50 on an R). The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: none.** Her rule reads both heroes' health where her hit is decided (the victim's screen has both: health is synced). The scale is drawn from numbers both screens have, with `Trait.meter` or a mark over the plates. Build order: 1 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P The Feather and the Heart | Both heroes' health in `dealt`. | The victim's screen. |
| Q Verdict | A quick cone. | The victim's screen. |
| W Weight of the Dead | A zone that re-checks positions at the impact. | The victim's screen. |
| E Feather-Light | A haste, a cleanse and `ctx.shieldSelf`. | Her client. |
| R The Weighing | A self ring; the damage from both heroes' health at the impact. | The victim's screen; her heal on her client. |

### What the CPU does

**As Nebet** (`aiHold`, `aiGoal`):

- Q in reach.
- W when the enemy is within 9 m, sooner when the enemy is ahead (the root).
- E to chase, or to get away when slowed.
- R when the enemy is within 5 m and the scale tips 20 points or more against her, or when she is under 30%.

**Against Nebet** (`enemyGoal`):

- Leaves the ring when the great scale rises.
- When she is 20 points behind, steps back out of her reach and pokes, rather than trading blows.

### The effects, part by part

In the hero's palette: accent lapis with a pale papyrus foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P The Feather and the Heart:** A small gold scale drawn over the two health plates, its beam tipping, a feather in one pan and a heart in the other; her blade's lapis edge brightens as she falls behind.
- **Q Verdict:** A hooked bronze arc with a lapis edge.
- **W Weight of the Dead:** A great gold pan pressing down, papyrus dust rising at its edge.
- **E Feather-Light:** A white feather drifting round her; her steps leave no dust.
- **R The Weighing:** A great gold scale with lapis inlay rising behind her, its beam swinging to the lighter side; a pale ring of glyphs on the floor; the impact frame when it settles.

### Names and files (checked free on 2026-11-14)

Labels: 'verdict', 'weight of the dead', 'feather-light', 'the weighing'. Files: `src/heroes/scale/spells/verdict.ts`, `src/heroes/scale/spells/weightOfTheDead.ts`, `src/heroes/scale/spells/featherLight.ts`, `src/heroes/scale/spells/theWeighing.ts`; in `src/heroes/scale/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
