---
title: Kohaku, the Foxfire (new hero 8 of 20)
tags: [design, heroes, kits, fox]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Kohaku, the Foxfire

New hero 8 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A fox spirit who steals the name of a spell and calls it with her own fire. |
| **Shape** | A fox's tail of flame with a white tip. |
| **Colours** | Accent foxfire blue `#7fe6ff`, foil snow-fox white `#f2f6fa` |
| **Theme word** | `fox` |
| **Role** | Assassin, melee |
| **Faction** | The Court of Dusk (lore: A fox spirit of Gloaming who steals the names of spells; Sir Whiskers has chased her for years.) |
| **The new thing** | Stealing a spell. She takes the last spell you cast: that key is sealed for you for 4 s, and she gets one foxfire copy of its kind (a bolt, a dash, a ring or a shield). |
| **The question** | "What did you cast last?" Feed her a small spell and keep the big one safe. |
| **The weakness** | She has to get within 7 m; she is fragile, and the steal is wasted on a weak spell. |
| **The second decision** | Steal now, or wait for the enemy's big spell. |
| **How it looks** | A slim woman in a white and pale grey layered robe with a rust-red under-sash, a carved white fox mask pushed to the side of her head, a long white-tipped fox tail of fur; a fan in the left hand. |
| **Nearest heroes** | Sir Whiskers (feline, her rival), Kaia (blue-white), Nyx (her court's other blade) |

**Changed from the card shown on 2026-11-14:** The steal seals the key for 4 s rather than adding to its cooldown, so it works on Vesper, Brannoc and Cantor, who have no cooldowns. Nine tails became three lit tails (a round is too short for nine).

## Gate 3: the kit on paper

Kohaku. Theme `fox`. Assassin, melee. **620 HP**, 4.4 m/s, basic attack 13 per 1.1 s at 2.6 m (a swipe of foxfire). Accent `#7fe6ff`, foil `#f2f6fa`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Nine Tails** | PASSIVE | - | - | - | +40 on the empowered bite | Each stolen spell lights one of her tails (three at most, kept through the round, on her back for both players). With three lit, her next Foxfire Bite burns blue for 40 more and the tails go out. |
| Q | **Foxfire Bite** | DASH | 4 | 4 m | bite radius 1.5 m | 48 (88 with three tails) | 0.35 s wind-up, she leaps 4 m to the aimed point (0.3 s) and bites 1.5 m round where she lands. |
| W | **Glamour** | SELF | 12 | - | - | - | She leaves a fox of white smoke that runs on 5 m the way she faces (1.5 s), and she is unseen for 1.0 s: not drawn and not targetable; areas and cones still hit her. |
| E | **Borrowed Name** | TGT | 14 | 7 m | - | 20, then the copy | 0.3 s cast, needs sight: she takes the last spell the enemy cast in the last 4 s (else their Q). That key is sealed for them for 4 s whatever its cooldown. She gets one foxfire copy of its kind, cast with E again within 6 s: a bolt (55, 10 m, 0.25 s wind-up, 22 m/s), a dash (5 m), a ring (2.5 m round her, 50, warned 0.9 s) or a shield (60 for 2 s), by the stolen spell's shape. |
| R | **Wisp Hunt** | SELF | 22 | 10 m | nine wisps | 9 x 14 (126) | Nine wisps circle her for 1.0 s, then leave one every 0.25 s and hunt the enemy at 12 m/s, curving; cover stops them; 14 each. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Nine Tails.** Count her tails.
- **Q Foxfire Bite.** The landing is where she aims: leave 1.5 m from it, 0.25 + 1.5/4 = 0.63 s against 0.65 s. *(circle 1.5 m: 0.25 + 1.5/4 = 0.63 s needed, warned 0.65 s OK; first hit 0.65 s after the cast)*
- **W Glamour.** Hit the ground around where she was: areas still find her. The decoy runs straight; she rarely does.
- **E Borrowed Name.** Cast a small spell before you are within 7 m and keep the big one. The copy bolt reaches 6 m at 0.25 + 6/22 = 0.52 s; the ring needs 0.25 + 2.5/4 = 0.88 s to leave and warns 0.9 s. *(bolt: 0.25 + 6/22 = 0.52 s to 6 m (at least 0.5) OK; circle 2.5 m: 0.25 + 2.5/4 = 0.88 s needed, warned 0.9 s OK; first hit 0.3 s after the cast)*
- **R Wisp Hunt.** Get behind cover: the first wisp leaves at 1.0 s; cover 1.5 m away is reached in 0.25 + 1.5/4 = 0.63 s. The last wisp lands by 3.8 s. *(reaction: 0.25 + 0.38 = 0.63 s needed, given 1 s OK; first hit 1 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "What did you cast last?" Feed her a small spell and keep the big one safe.
- **Weakness:** She has to get within 7 m; she is fragile, and the steal is wasted on a weak spell.
- **Second decision:** Steal now, or wait for the enemy's big spell.

### Budget

Assassin, 620 HP (600-720), 4.4 m/s. Q 48 every 4 s; the copy is what the enemy gave her; the ultimate 126 in nine wisps that cover stops. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** A key sealed on the enemy by her (the victim's client refuses that key for 4 s: a new status with a key in it), and four small copy spells chosen by the stolen spell's kind. Build order: 12 of 20 ([the kits page](../../docs/heroes/kits20/index.html)).

| Key | Needs | Decided on |
|---|---|---|
| P Nine Tails | `t.show` and her look. | Her client. |
| Q Foxfire Bite | `ctx.moveCaster` and a circle at the landing. | The victim's screen. |
| W Glamour | `Trait.figureHidden` for 1.0 s; the decoy is a look. | Her client. |
| E Borrowed Name | `enemyCast` (both screens) records the last cast; a new keyed seal status on the enemy; four copy spells. | The steal: the victim's screen. The copy: her client. |
| R Wisp Hunt | Nine seeking bolts. | The victim's screen. |

### What the CPU does

**As Kohaku** (`aiHold`, `aiGoal`):

- Q to close in or to finish.
- W when the enemy aims a line at her, or below 40% HP.
- E when the enemy has cast their R or W in the last 4 s and is within 7 m; the copy at once.
- R within 8 m when no cover is near the enemy.

**Against Kohaku** (`enemyGoal`):

- When she is within 9 m with E ready, casts its cheapest spell first.
- Gets behind cover when the wisps circle.

### The effects, part by part

In the hero's palette: accent foxfire blue with a pale snow-fox white foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Nine Tails:** Tails of pale blue flame on her back; lit ones bright with white tips.
- **Q Foxfire Bite:** A blue-white fox head of flame snapping shut.
- **W Glamour:** A fox of white smoke that runs on and puffs out.
- **E Borrowed Name:** The stolen spell's icon drawn in blue fire, pulled from the enemy into her fan; a small blue seal hangs over their head for 4 s.
- **R Wisp Hunt:** Flickering blue flames with white hearts, streaking in curves.

### Names and files (checked free on 2026-11-14)

Labels: 'foxfire bite', 'glamour', 'borrowed name', 'wisp hunt'. Files: `src/spells/targeted/foxfireBite.ts`, `src/spells/targeted/glamour.ts`, `src/spells/targeted/borrowedName.ts`, `src/spells/targeted/wispHunt.ts`; `src/effects/parts/fox.ts`, `src/kits/fox.ts`, `src/traits/fox.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
