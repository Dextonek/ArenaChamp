---
title: Thessa, the Sky-Stitcher (new hero 18 of 20)
tags: [design, heroes, kits, stitch]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Thessa, the Sky-Stitcher

New hero 18 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A seamstress of the sky who sews two places together, so that what lands at one lands at the other. |
| **Shape** | A great needle drawing a gold thread between two pins. |
| **Colours** | Accent orchid `#b86cd8`, foil silver thread `#eceef4`. Nearest colours: Sahar (26), Lyra (29) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `stitch` |
| **Role** | Support, ranged |
| **Faction** | The Hourkeepers (lore: She sews places together, and means to sew the Tear above the Tower shut.) |
| **The new thing** | Two places stitched into one. A hero within 2 m of one pin of her seam also counts as standing at the other pin, for every spell and attack, from either side. Wick's doors move people; her seam moves where a hit can find you. |
| **The question** | "Which end of the seam are you standing at?" |
| **The weakness** | A seam is two pins anyone can see; stepping 2 m off a pin ends it for you; and it works for the enemy too: standing at a pin, she can be hit at the other. |
| **The second decision** | Where to put the far pin: under the enemy, so her spells cast near herself reach them; or under herself, to be in two places at once (and hit in two). |
| **How it looks** | Slim and grave, in a night-blue coat stitched with silver seams and orchid thread, hair bound with a silver needle, a gold thimble; a silver needle as long as her arm, trailing a gold thread, in the left hand. |
| **Nearest heroes** | Grandma Ironknit (thread; her teacher), Wick (her friend), Sahar (lilac: hers is pinker and on night blue) |

## Gate 3: the kit on paper

Thessa. Theme `stitch`. Support, ranged. **620 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a thrown pin). Accent `#b86cd8`, foil `#eceef4`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Seamwork** | PASSIVE | - | - | pins 2 m | - | A seam has two pins and lasts 6 s. A hero within 2 m of one pin also counts as standing at the other, for every spell and attack from either side (a hit that would land there lands on them; one hit counts once). One seam at a time (two during her ultimate). |
| Q | **Needle** | LINE | 3.5 | 10 m | radius 0.3 | 50 | 0.25 s wind-up, 22 m/s. If it hits while a seam stands, the far pin moves to the enemy's feet. |
| W | **Stitch** | LINK | 10 | 10 m | two pins, 2 m each | - | She pins the aimed point (10 m) and her own feet together: a seam for 6 s. |
| E | **Darn** | SELF | 12 | - | - | - (a 45 shield) | She darns herself: a shield of 45 for 3 s. Cast while she stands at a pin, she may cut the seam (the recast within 1 s). |
| R | **Close the Seam** | ZONE | 22 | 11 m | radius 3 m | 110 and root 1.0 s | A ring of stitches closes on a point for 1.3 s: 110 and a 1.0 s root within 3 m. For the cast a second seam may stand, so the ring can reach someone standing at a pin far away. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Seamwork.** Step 2 m off a pin and you are only where you stand. She is exposed the same way.
- **Q Needle.** Sidestep: it reaches 6 m at 0.25 + 6/22 = 0.52 s; then step off the pin it leaves. *(bolt: 0.25 + 6/22 = 0.52 s to 6 m (at least 0.5) OK; first hit 0.3 s after the cast)*
- **W Stitch.** Step 2 m off the pin under you.
- **E Darn.** -
- **R Close the Seam.** Leave the ring: 0.25 + 3/4 = 1.0 s against 1.3 s, and step off any pin. *(circle 3 m: 0.25 + 3/4 = 1.00 s needed, warned 1.3 s OK; first hit 1.3 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Which end of the seam are you standing at?"
- **Weakness:** A seam is two pins anyone can see; stepping 2 m off a pin ends it for you; and it works for the enemy too: standing at a pin, she can be hit at the other.
- **Second decision:** Where to put the far pin: under the enemy, so her spells cast near herself reach them; or under herself, to be in two places at once (and hit in two).

### Budget

Support, 620 HP. Q 50, a shield of 45, the ultimate 110 with a 1.0 s root; the seam is the rest. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: large.** Two places counted as one in every hit test: a hero within 2 m of one pin is also tested as if standing at the other. Spells test hits in many ways (`eachInside`, bolts, cones), so it needs one shared hit test that every spell goes through: a change across the engine. Build order: 20 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Seamwork | The shared hit test (new, large). | The victim's screen. |
| Q Needle | A bolt; the pin moved by the screen that decides the hit, told to hers. | The victim's screen. |
| W Stitch | Two marks. | Both (marks from the cast). |
| E Darn | `ctx.shieldSelf`; a recast. | Her client. |
| R Close the Seam | A zone through the shared hit test. | The victim's screen. |

### What the CPU does

**As Thessa** (`aiHold`, `aiGoal`):

- W with the far pin under the enemy and the near pin where her own spells land easily (by her).
- Q in reach; a hit moves the far pin to the enemy.
- E when she is hit below 60%.
- R on the near pin when the enemy stands at the far one, or straight at the enemy.

**Against Thessa** (`enemyGoal`):

- Steps 2 m off a pin.
- Hits her through the pins when she stands at one.

### The effects, part by part

In the hero's palette: accent orchid with a pale silver thread foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Seamwork:** Two silver pins in the floor with a gold thread arching between them; a ring of orchid stitches 2 m round each; a hit at one end sends a flicker along the thread.
- **Q Needle:** A silver needle with an orchid thread trailing.
- **W Stitch:** The needle diving into the floor at both points, the gold thread drawn tight between them.
- **E Darn:** Silver stitches drawn round her in a quick spiral.
- **R Close the Seam:** A ring of orchid and gold stitches drawn tight like a drawstring; one impact frame.

### Names and files (checked free on 2026-11-14)

Labels: 'needle', 'stitch', 'darn', 'close the seam'. Files: `src/spells/targeted/needle.ts`, `src/spells/targeted/stitch.ts`, `src/spells/targeted/darn.ts`, `src/spells/targeted/closeTheSeam.ts`; `src/effects/parts/stitch.ts`, `src/kits/stitch.ts`, `src/traits/stitch.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
