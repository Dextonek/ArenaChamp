---
title: Campana, the Bellwright (new hero 9 of 20)
tags: [design, heroes, kits, bell]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Campana, the Bellwright

New hero 9 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A temple bell-founder whose bronze bells ring each other into a chorus. |
| **Shape** | A bronze bell with its clapper and two sound arcs. |
| **Colours** | Accent bronze `#d29a4a`, foil pale patina `#cfe8dc`. Nearest colours: Sefu (4), Kessa (9) (Lab distance; under 12 reads as the same).  Colour clash: the card's accent `#d29a4a` is 4 from Sefu's colour (under 12 reads as the same). A nearby colour that keeps apart: `#b2962c`. Or keep it and let the figure tell them apart; to decide at the look. |
| **Theme word** | `bell` |
| **Role** | Tank, melee |
| **Faction** | The Noonsworn (lore: She cast every bell of Aubade, the bells that ring the thin sun up each morning.) |
| **The new thing** | Chain reactions between her things. Strike one of her bells and its ring spreads out; a ring reaching another bell rings that one too. One blow can set off the whole floor. |
| **The question** | "Inside the ring, or past it?" Only a ring's edge hurts, and it is born at the bell's lip: next to the bell is safe. |
| **The weakness** | Without bells she is a slow tank; bells can be broken (90 HP). |
| **The second decision** | Where to set each bell, so that the chain runs through the enemy. |
| **How it looks** | A strong founder in a heavy leather apron over temple robes of deep plum, bronze bracers, a small bell on a cord at the hip; a bronze hammer in the right hand. |
| **Nearest heroes** | Big Yoko (tank, rings), Cantor (sound; her friend) |

**Changed from the card shown on 2026-11-14:** Rings are born at the bell's lip (1.5 m), so the safe places are next to a bell or past 5 m. Bells have 90 HP rather than "two hits".

## Gate 3: the kit on paper

Campana. Theme `bell`. Tank, melee. **840 HP**, 3.7 m/s, basic attack 14 per 1.3 s at 2.6 m (the bronze hammer). Accent `#d29a4a`, foil `#cfe8dc`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Resonance** | PASSIVE | - | - | ring 1.5 to 5 m | 30 and stun 0.4 s at the edge | A struck bell rings: a sound ring is born at its lip (1.5 m) and grows to 5 m at 8 m/s (0.44 s). Only its edge hurts: 30 and a 0.4 s stun to whoever it sweeps (once a ring). A ring that reaches another bell rings it (each bell once a chain). Bells: 90 HP, 10 s, two at most; they block walking and bolts. |
| Q | **Clapper** | QUICK | 3 | 3 m | 90 degrees | 42 | 0.4 s wind-up, a heavy blow; it also strikes the nearest bell within 6 m, whose ring starts 0.2 s later. |
| W | **Cast a Bell** | TERRAIN | 10 (2 charges) | 9 m | bell 1.2 m | 40 under it | A shadow for 0.7 s, then a bronze bell drops: 40 to anyone under it; it lands ringing. |
| E | **Toll** | DASH | 9 | a bell within 8 m | - | 25 and knock 1 m to whoever she passes within 1 m | She charges to a bell (0.3 s) and rings it on arrival. Needs a bell. |
| R | **The Great Bell** | TGT | 22 | 9 m | 2 m | 70, shut in 1.5 s, then the rings | A great bell's shadow (2 m) falls where the enemy stood at the cast; 1.0 s later the bell drops: whoever is under it is shut inside for 1.5 s (no moving, no spells), takes 70, and then it rings: its ring and every bell in a chain. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Resonance.** Within 1.5 m of the bell you are inside the ring already; past 5 m you are beyond it. A ring starts only when she strikes a bell.
- **Q Clapper.** Beyond 3 m of her. Near a bell, 3 m from it: the edge reaches you 0.79 s after the cast; stepping in to 1.5 m takes 0.25 + 1.5/4 = 0.63 s, out to 5 m 0.25 + 2/4 = 0.75 s. *(spacing: stand outside its reach (no reaction can beat a blow up close); reaction: 0.25 + 0.5 = 0.75 s needed, given 0.79 s OK; first hit 0.4 s after the cast)*
- **W Cast a Bell.** Leave the shadow: 0.25 + 1.2/4 = 0.55 s against 0.7 s; then the landing ring, as the passive. *(circle 1.2 m: 0.25 + 1.2/4 = 0.55 s needed, warned 0.7 s OK; first hit 0.7 s after the cast (a lasting mark after that))*
- **E Toll.** Do not stand on the line between her and a bell; then the ring.
- **R The Great Bell.** Leave the shadow: 0.25 + 2/4 = 0.75 s against 1.0 s. *(circle 2 m: 0.25 + 2/4 = 0.75 s needed, warned 1 s OK; first hit 1 s after the cast, last 2.95 s)*

### The question, the weakness, the second decision

- **Question:** "Inside the ring, or past it?" Only a ring's edge hurts, and it is born at the bell's lip: next to the bell is safe.
- **Weakness:** Without bells she is a slow tank; bells can be broken (90 HP).
- **Second decision:** Where to set each bell, so that the chain runs through the enemy.

### Budget

Tank, 840 HP, 3.7 m/s. Q 42, a ring's edge 30 with a 0.4 s stun; the Great Bell 70 and a 1.5 s lock. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: none.** Rings are marks that grow with time, the same on both screens; their edges are read in `victimTick`. Bells are placed things; the Great Bell is a root and a silence. Build order: 2 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Resonance | Rings as marks with a birth time; the edge test in `victimTick`. | The victim's screen. |
| Q Clapper | A quick cone. | The victim's screen. |
| W Cast a Bell | A placed thing. | The victim's screen. |
| E Toll | `ctx.moveCaster`. | Her client; the hit on the victim's screen. |
| R The Great Bell | Root and silence (`sealed`), then a ring. | The victim's screen. |

### What the CPU does

**As Campana** (`aiHold`, `aiGoal`):

- W first: a bell 2 to 3 m beyond the enemy.
- Q within 3 m, best with a bell within 6 m of the enemy.
- E to the bell nearest the enemy.
- R when the enemy is within 9 m and a bell stands near them.

**Against Campana** (`enemyGoal`):

- Near her, keeps either within 1.5 m of a bell or past 5 m.
- Breaks bells from range.
- Leaves the Great Bell's shadow.

### The effects, part by part

In the hero's palette: accent bronze with a pale pale patina foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Resonance:** Thin bronze rings on the floor with a pale patina edge and a shiver in the air.
- **Q Clapper:** A bronze hammer arc and a deep shiver in the air.
- **W Cast a Bell:** A bell dropping from above, landing with dust and a hum.
- **E Toll:** A bronze streak, the bell swinging.
- **R The Great Bell:** A huge bronze bell falling with a deep boom, the rings racing bell to bell.

### Names and files (checked free on 2026-11-14)

Labels: 'clapper', 'cast a bell', 'toll', 'the great bell'. Files: `src/spells/targeted/clapper.ts`, `src/spells/targeted/castABell.ts`, `src/spells/targeted/toll.ts`, `src/spells/targeted/theGreatBell.ts`; `src/effects/parts/bell.ts`, `src/kits/bell.ts`, `src/traits/bell.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
