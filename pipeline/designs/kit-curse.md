---
title: Asenet, the Uncrowned (new hero 20 of 20)
tags: [design, heroes, kits, curse]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Asenet, the Uncrowned

New hero 20 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | An exiled queen whose curse never stays on one head. |
| **Shape** | A thin circlet, tilted and cracked, with a dark spark. |
| **Colours** | Accent wine `#8c3167`, foil tarnished gold `#e2cf96` |
| **Theme word** | `curse` |
| **Role** | Juggernaut, melee |
| **Faction** | a loner (lore: Exiled queen of the Sands, who cursed the crown her brother took.) |
| **The new thing** | A curse passed back and forth. The Uncrowned Circlet sits on one hero; a spell that hits the other hero passes it to them; whoever holds it when its countdown ends takes the fall. No hero has a thing the two heroes hand to each other. |
| **The question** | "Who holds it when it falls?" |
| **The weakness** | She can be the one holding it: any spell you land on her hands it back. Her spells must land, and she is a melee hero. |
| **The second decision** | Pass it now (they have time to pass it back) or late (they may not). |
| **How it looks** | A tall exiled queen in faded royal linen of wine and tarnished gold, a torn cloak, dark hair bound without a crown; a thin circlet of tarnished gold floating over whoever holds the curse; a curved bronze blade in the right hand. |
| **Nearest heroes** | Sefu (her brother; gold and linen), Vesper (crimson: Asenet's wine is duller and goes with tarnished gold), Mr. Ledger (things that come due) |

## Gate 3: the kit on paper

Asenet. Theme `curse`. Juggernaut, melee. **720 HP**, 4.0 m/s, basic attack 14 per 1.2 s at 2.6 m (a curved bronze blade). Accent `#8c3167`, foil `#e2cf96`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **The Uncrowned** | PASSIVE | - | - | - | 90 and stun 0.5 s to the holder at the fall | The circlet starts each round on her, with a 10 s countdown shown over the holder. A spell hit by the holder on the other hero passes it (basic attacks do not). When the countdown ends, the holder takes 90 and is stunned 0.5 s, and it starts again where it is. She takes 10% less while she holds it. |
| Q | **Exile's Blade** | LINE | 3 | 4 m | 1 m wide | 46; passes the circlet | 0.4 s wind-up, a long thrust. |
| W | **Royal Decree** | TGT | 12 | 7 m | - | 40; the enemy cannot pass it for 3 s | 0.4 s, needs sight: a gold seal: 40, and for 3 s the enemy cannot pass the circlet. |
| E | **Usurp** | DASH | 10 | 5 m | - | 30 to an enemy she passes through | She dashes 5 m in 0.3 s; passing through the enemy (within 1 m) deals 30 and passes the circlet onto them if she holds it; if they hold it, its countdown loses 2 s. |
| R | **The Crown Falls** | SELF | 24 | the holder | - | 150 and stun 0.8 s to the holder | She raises her hand for 1.2 s; the countdown jumps to 1.5 s and the circlet grows heavy: when it falls, the holder takes 150 instead of 90 and is stunned 0.8 s. If that is her, it is her. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P The Uncrowned.** Hit her with a spell before it falls; keep one for the last seconds.
- **Q Exile's Blade.** Step aside: 0.25 + 0.5/4 = 0.38 s against 0.4 s, or stand beyond 4 m. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 0.4 s OK; first hit 0.4 s after the cast)*
- **W Royal Decree.** Pass it back before the seal lands, or keep out of 7 m. *(first hit 0.4 s after the cast)*
- **E Usurp.** Do not stand in her line.
- **R The Crown Falls.** Pass it to her before it falls: 2.7 s from her raised hand, and any spell of yours that hits her does it. *(reaction: 0.25 + 0.5 = 0.75 s needed, given 2.7 s OK; first hit 2.7 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Who holds it when it falls?"
- **Weakness:** She can be the one holding it: any spell you land on her hands it back. Her spells must land, and she is a melee hero.
- **Second decision:** Pass it now (they have time to pass it back) or late (they may not).

### Budget

Juggernaut, 720 HP. Q 46, W 40, E 30; the fall 90 (150 under her ultimate) lands on whoever holds it, which may be her. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** A token held by one hero that moves with hits. A hit is decided on the victim's screen, so a pass is decided there and told to the other; if the two heroes hit each other within a moment, passes are ordered by their casts' start times (the lesson of hero 40), so both screens settle on the same holder. The countdown is a time both screens know. Build order: 10 of 20 ([the kits page](../../docs/heroes/kits20/index.html)).

| Key | Needs | Decided on |
|---|---|---|
| P The Uncrowned | The token (new, medium). | The victim's screen decides a pass. |
| Q Exile's Blade | A short line. | The victim's screen. |
| W Royal Decree | A targeted hit and a status read by her trait. | The victim's screen. |
| E Usurp | `ctx.moveCaster` and a hit. | The victim's screen. |
| R The Crown Falls | The token's countdown changed by her cast. | The victim's screen. |

### What the CPU does

**As Asenet** (`aiHold`, `aiGoal`):

- Q or E to pass it when she holds it.
- With the enemy holding it and under 3 s left: stays out of their reach.
- W on an enemy who holds it with 3 s or more left.
- R when the enemy holds it and is sealed by W, or has no spell ready.

**Against Asenet** (`enemyGoal`):

- Holding it: casts at her at once (any spell that hits).
- Keeps a quick spell ready near the end of the countdown.

### The effects, part by part

In the hero's palette: accent wine with a pale tarnished gold foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P The Uncrowned:** A thin tarnished-gold circlet floating over the holder's head with a dark wine spark; the countdown a ring of glyphs closing round it; a pass flies it from head to head along an arc; the fall slams it down with a wine-dark crack and gold dust.
- **Q Exile's Blade:** A curved bronze thrust with a wine streak.
- **W Royal Decree:** A gold seal stamped in the air over their head.
- **E Usurp:** A wine-coloured blur.
- **R The Crown Falls:** Her raised hand; the circlet doubling in size; the glyph ring racing round; one impact frame at the fall.

### Names and files (checked free on 2026-11-14)

Labels: 'exile's blade', 'royal decree', 'usurp', 'the crown falls'. Files: `src/spells/targeted/exilesBlade.ts`, `src/spells/targeted/royalDecree.ts`, `src/spells/targeted/usurp.ts`, `src/spells/targeted/theCrownFalls.ts`; `src/effects/parts/curse.ts`, `src/kits/curse.ts`, `src/traits/curse.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
