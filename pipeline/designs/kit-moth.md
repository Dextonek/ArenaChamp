---
title: Vela, the Dream Moth (new hero 2 of 20)
tags: [design, heroes, kits, moth]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Vela, the Dream Moth

New hero 2 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A luna-moth priestess whose wing dust carries sleep. |
| **Shape** | The luna moth: two pale wings with long tails and two eye spots. |
| **Colours** | Accent luna green `#bfe8a0`, foil powder ivory `#efe6d8`. Nearest colours: Mr. Ledger (27), Ostrel (28) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `moth` |
| **Role** | Support, ranged |
| **Faction** | The Greenwood Moot (lore: The moth priestess who lays the Walking Wood to sleep each dusk and hangs paper lanterns so travellers sleep safe.) |
| **The new thing** | Sleep: a sleeping hero cannot act until damage wakes them, and the hit that wakes them lands harder. Nobody puts heroes to sleep today, so she has to choose: let them sleep, or wake them with something big. |
| **The question** | "Will you stay in my dust?" Three dust stacks in four seconds and you sleep. |
| **The weakness** | Her own damage wakes you. She is frail, dust is slow to build, and after a sleep you cannot be made drowsy for 5 s. |
| **The second decision** | Wake the sleeper with a big hit, or let them sleep to walk away, set up her lanterns, or reach her light. |
| **How it looks** | A slender priestess with great pale green moth wings with long trailing tails and two ivory eye spots, a soft fur collar, a grey-lilac gown, feathered antennae as a circlet; a lantern staff in the left hand. |
| **Nearest heroes** | Fenna (deep green and pink, the same faction), Grandma Ironknit (support) |

**Changed from the card shown on 2026-11-14:** Sleep lasts 1.5 s at most (the lock rule) and leaves 5 s without stacks. The ultimate is a 4.5 m circle at a point, not a 7 m ring round her: from its middle a 7 m ring needs 2 s to leave and warned 1.2 s.

## Gate 3: the kit on paper

Vela. Theme `moth`. Support, ranged. **600 HP**, 4.0 m/s, basic attack 10 per 1.0 s at 6.5 m (a puff of wing dust). Accent `#bfe8a0`, foil `#efe6d8`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Powdered Wings** | PASSIVE | - | - | - | - | The first hit on her every 6 s is softened 30%, and a melee attacker who lands it gets a Drowsy stack. Drowsy: three stacks within 4 s and the enemy sleeps up to 1.5 s (no moving, no casting); any damage wakes them, and the waking hit deals 25% more (30 at most). After a sleep, no stacks for 5 s. |
| Q | **Dream Dust** | CONE | 3 | 5.5 m | 60 degrees | 30 and 1 Drowsy | A 0.4 s wind-up, then a soft cone of mint powder in front of her. |
| W | **Moonlit Lantern** | GROUND | 12 (2 charges) | 9 m | light 3 m | - (heals her 3 a second, 15 at most) | A paper lantern on a post: 60 HP, 8 s. Enemy bolts that pass within 3 m of it bend into it and go out (it takes them as hits). In its light she heals 3 a second, 15 at most per lantern. |
| E | **Flutter** | DASH | 9 | a lantern within 9 m, else 5 m | - | - | Wings open: she flies to one of her lanterns within 9 m, or 5 m the way she aims; 0.35 s in the air. |
| R | **Lullaby of Wings** | ZONE | 22 | 11 m | radius 4.5 m | 40 and 2 Drowsy | A giant moth's shadow spreads over a point; after 1.4 s the dust falls: 40 and two Drowsy stacks to everyone inside, and every lantern puffs one Drowsy stack onto enemies within 3 m of it. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Powdered Wings.** Do not stand in her dust; when asleep, the first hit wakes you, so a sleep never lasts past her next attack.
- **Q Dream Dust.** Stand beyond 5.5 m or outside its 60 degrees: inside, it lands. To a sleeper it is the waking hit. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.4 s after the cast)*
- **W Moonlit Lantern.** Break it first (60 HP), or shoot on a line that passes more than 3 m from it; fight her away from its light.
- **E Flutter.** Break the lantern and the long flight is gone.
- **R Lullaby of Wings.** Walk out: from the middle 0.25 + 4.5/4 = 1.38 s; it warns 1.4 s. *(circle 4.5 m: 0.25 + 4.5/4 = 1.38 s needed, warned 1.4 s OK; first hit 1.4 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Will you stay in my dust?" Three dust stacks in four seconds and you sleep.
- **Weakness:** Her own damage wakes you. She is frail, dust is slow to build, and after a sleep you cannot be made drowsy for 5 s.
- **Second decision:** Wake the sleeper with a big hit, or let them sleep to walk away, set up her lanterns, or reach her light.

### Budget

Support, 600 HP. Her damage is low (Q 30, R 40) because sleep is control; her heal is 15 at most per lantern, inside the rule of 15 a spell. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** Two new pieces: a sleep status (a stun that any damage ends, and that marks the waking hit +25%), and bolts that bend into a point (her lanterns). Build order: 13 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P Powdered Wings | New status `sleep` in `src/effects/status.ts`: a stun ended by damage, with the waking hit raised. | The victim's screen (it owns its hero's statuses and its hits). |
| Q Dream Dust | A cone, as Bo's crook. | The victim's screen. |
| W Moonlit Lantern | A placed thing (as `crystalPillar.ts`) and a new bolt rule in `projectile.ts`: a bolt within 3 m of a lantern turns toward it. Both screens fly bolts from the same lantern list, so they bend alike. | Bolt hits: the screen of the hero the bolt was aimed at. The heal: her own client. |
| E Flutter | `ctx.moveCaster`. | Her client. |
| R Lullaby of Wings | A zone that re-checks positions at 1.4 s. | The victim's screen. |

### What the CPU does

**As Vela** (`aiHold`, `aiGoal`):

- Q when the enemy is within 5.5 m.
- While the enemy sleeps: wait 0.8 s, then wake them with the biggest hit she has ready.
- W near herself, between her and a ranged enemy.
- E to the lantern farthest from the enemy (escape).
- R when the enemy has a Drowsy stack and is within 11 m.

**Against Vela** (`enemyGoal`):

- Breaks a lantern within 5 m before shooting.
- Keeps beyond 5.5 m.
- Leaves the R circle outward.

### The effects, part by part

In the hero's palette: accent luna green with a pale powder ivory foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Powdered Wings:** Pale mint powder puffs off her wings. Drowsy pips: small moth shapes over the head. Asleep: the head bows, slow dust motes drift, a pale green moth circles once.
- **Q Dream Dust:** A cone of glittering mint powder that hangs 0.5 s and drifts down.
- **W Moonlit Lantern:** A pale green paper lantern on a dark post with a warm ivory glow; bolts curve into it and go out in a puff of dust.
- **E Flutter:** Wings opened wide, a trail of drifting pale scales.
- **R Lullaby of Wings:** A giant moth silhouette, dark green with two ivory eye spots, spreads over the circle; dust falls like snow.

### Names and files (checked free on 2026-11-14)

Labels: 'dream dust', 'moonlit lantern', 'flutter', 'lullaby of wings'. Files: `src/spells/targeted/dreamDust.ts`, `src/spells/targeted/moonlitLantern.ts`, `src/spells/targeted/flutter.ts`, `src/spells/targeted/lullabyOfWings.ts`; `src/effects/parts/moth.ts`, `src/kits/moth.ts`, `src/traits/moth.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
