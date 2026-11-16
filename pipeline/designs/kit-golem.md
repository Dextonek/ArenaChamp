---
title: Hesk, the Golemwright (new hero 17 of 20)
tags: [design, heroes, kits, golem]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Hesk, the Golemwright

New hero 17 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A golem-maker whose golems obey whoever wrote the last word on their brow. |
| **Shape** | A golem's head with a glowing word on its brow. |
| **Colours** | Accent word green `#30f291`, foil fired clay `#d8b89a`. Nearest colours: Saga (28), Fenna (29) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `golem` |
| **Role** | Summoner, ranged |
| **Faction** | The Underforge (lore: Golem-maker of the Underforge, taught his script by Shiori; Kohaku once stole his golem's word.) |
| **The new thing** | A summon that can change sides. His golem obeys the last word written on it: three hits from the enemy rewrite it, and for 4 s it is theirs. |
| **The question** | "Will you take my golem from me?" |
| **The weakness** | His golem can be turned on him; without it he is a slow, soft caster (600 HP, 3.9 m/s). |
| **The second decision** | Rewrite his golem (W again, close to it) or erase it (E on a turned golem crumbles it). |
| **How it looks** | A heavy, careful man in a clay-stained leather smock over Underforge brown, sleeves rolled, a stylus behind the ear, a satchel of clay tablets; a long bronze stylus-staff with a glowing green tip in the left hand. |
| **Nearest heroes** | Bram (a stone friend; his rival), Mortis and Bo (summoners), Saga (green: his is a brighter spring green on clay) |

## Gate 3: the kit on paper

Hesk. Theme `golem`. Summoner, ranged. **600 HP**, 3.9 m/s, basic attack 10 per 1.0 s at 6.5 m (a clay pellet). Accent `#30f291`, foil `#d8b89a`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **The Last Word** | PASSIVE | - | - | one golem | 12 per 1.2 s | His golem (one at a time): 140 HP, 9 s, walks 3 m/s, strikes 12 every 1.2 s at 2 m. Three hits from the enemy (spells or attacks) rewrite its word: for 4 s it is theirs and strikes him; then it stands idle until he rewrites it. Its brow shows the word and three notches for both players. |
| Q | **Clay Shot** | LINE | 3 | 10 m | radius 0.3 | 50 (60 and slow 1 s through his golem) | 0.3 s wind-up, 20 m/s. Passing through his golem it hardens: 20% more and a 1 s slow. |
| W | **Write the Word** | SUMMON | 14 | 6 m | rise 1.2 m | 20 and a 1 m push on the spot | The golem rises at a point after 0.8 s. Recast within 4 m of his golem: he rewrites it: it is his again, its notches clear, and it mends 40. |
| E | **Command** | TGT | 9 | his golem, charging 6 m | 1.2 m wide | 35 and knock 2 m | His golem charges 6 m toward the aimed point (0.3 s wind-up, 12 m/s): 35 and a 2 m knock to whoever it meets. On a turned golem, E erases it instead: it crumbles. |
| R | **The Great Word** | ZONE | 24 | 10 m | radius 5 m | 70 and silence 0.8 s | He writes a great word on the floor (5 m) for 1.6 s; at the end enemies inside take 70 and are silenced 0.8 s, and his golem, wherever it stands, grows into a colossus for 5 s: it cannot be turned, gains 100 HP and hits twice as hard. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P The Last Word.** Turn it when it stands near him; otherwise ignore it and hit him.
- **Q Clay Shot.** Sidestep: it reaches 6 m at 0.3 + 6/20 = 0.6 s. *(bolt: 0.3 + 6/20 = 0.60 s to 6 m (at least 0.5) OK; first hit 0.35 s after the cast)*
- **W Write the Word.** Off the spot: 0.25 + 1.2/4 = 0.55 s against 0.8 s. *(circle 1.2 m: 0.25 + 1.2/4 = 0.55 s needed, warned 0.8 s OK; first hit 0.8 s after the cast)*
- **E Command.** Step out of its line: 0.25 + 0.6/4 = 0.4 s; the golem reaches 1.5 m in 0.3 + 1.5/12 = 0.43 s. *(lane 1.2 m wide: 0.25 + 0.6/4 = 0.40 s needed, warned 0.43 s OK; first hit 0.43 s after the cast)*
- **R The Great Word.** Leave the circle: 0.25 + 5/4 = 1.5 s against 1.6 s. Then keep away from the colossus or kill Hesk. *(circle 5 m: 0.25 + 5/4 = 1.50 s needed, warned 1.6 s OK; first hit 1.6 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Will you take my golem from me?"
- **Weakness:** His golem can be turned on him; without it he is a slow, soft caster (600 HP, 3.9 m/s).
- **Second decision:** Rewrite his golem (W again, close to it) or erase it (E on a turned golem crumbles it).

### Budget

Summoner, 600 HP. One golem in place of the usual two units (140 HP, 12 per 1.2 s for 9 s), Q 50, the ultimate 70 and a silence; the golem is the rest of his damage. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: large.** A unit that changes sides. Each screen runs its own copy of the units, so the count of enemy hits must be kept on one screen (the enemy's, where their hits on units are decided) and told to his with `noteOwner`; then both screens flip the golem's side and target. New in `src/effects/summon.ts` and the duel. Build order: 18 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

| Key | Needs | Decided on |
|---|---|---|
| P The Last Word | The side-changing unit (new, large). | The enemy's screen counts the hits; both flip. |
| Q Clay Shot | A bolt. | The victim's screen. |
| W Write the Word | `ctx.summon`. | His client. |
| E Command | A unit move order and a line hit. | The victim's screen. |
| R The Great Word | A zone; the unit's size and damage raised. | The victim's screen. |

### What the CPU does

**As Hesk** (`aiHold`, `aiGoal`):

- W first: the golem between him and the enemy.
- Q through the golem.
- E when the golem is within 6 m of the enemy and lined up; erase it when it is turned and near him.
- W again when it has two notches.
- R when the enemy is within 10 m.

**Against Hesk** (`enemyGoal`):

- Hits the golem three times when it stands within 4 m of Hesk; otherwise hits Hesk.
- Leaves the great word's circle.

### The effects, part by part

In the hero's palette: accent word green with a pale fired clay foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P The Last Word:** Rough red-brown clay with iron bands, a smooth brow with a glowing green word and three notches that fill; turned, the word goes pale clay-white with a stroke through it.
- **Q Clay Shot:** A clay pellet with a green streak; through the golem it turns to fired red clay.
- **W Write the Word:** The golem rising out of the floor, clay shedding off it; the stylus writing in green light.
- **E Command:** A heavy charge with clay dust and a green streak on the brow.
- **R The Great Word:** A great green word written in light on the floor; the golem swelling to twice its size with cracks glowing green.

### Names and files (checked free on 2026-11-14)

Labels: 'clay shot', 'write the word', 'command', 'the great word'. Files: `src/heroes/golem/spells/clayShot.ts`, `src/heroes/golem/spells/writeTheWord.ts`, `src/heroes/golem/spells/command.ts`, `src/heroes/golem/spells/theGreatWord.ts`; in `src/heroes/golem/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
