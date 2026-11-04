---
title: Madame Cleaver, the Arena Chef (kit)
tags: [design, heroes, kits, chef]
updated: 2026-11-04
---

# v5 (2026-11-04)

Theme `chef`. Support, ranged. 640 HP, 3.9 m/s, basic attack 5.5 m, 9 per 0.8 s (0.2 s wind-up, bolt 20 m/s). Accent `#f2efe6`, foil `#d84a3a`.
Numbers from [new-heroes-kits.md](new-heroes-kits.md) section 7; the constants live in `src/traits/chef.ts`. Modules: `thrownCleaver`, `hotSoup`,
`burntOffering`, `dinnerIsServed` (labels `thrown cleaver`, `hot soup`, `burnt offering`, `dinner is served`, category `hero: chef`).

| Key | Spell | CD | Rule | Built as |
|---|---|---:|---|---|
| P | Today's Special | | Her spells leave dishes (3 at most, 8 s). Whoever walks over one eats it. Fresh: +15% speed 3 s. From 3 s it is good: also heals 30 (her only). Burnt: 60 and a 0.8 s stun to the enemy, nothing on her | `chefBooks` records, `marks` / `markLook` (fresh, good, burnt), `tick` (hers), `victimTick` (the enemy's) |
| Q | Thrown Cleaver | 3.5 | 9 m, 20 m/s, 0.25 s wind-up, bolt radius 0.3: 50. The cleaver sticks where its line ends and a fresh dish plops out | Skillshot with a pure `bankPath` line; hit or miss the dish is at the end of the line |
| W | Hot Soup | 9 | A pot at a spot (8 m), tips at 1.0 s, 2.5 m: 40 and slowed 1.5 s; a fresh dish at the centre at 1.3 s | Ground circle telegraph, live-position hit at the tip |
| E | Burnt Offering | 12 | A burnt dish lobbed to a spot (2-8 m), lands at 0.55 s. It does nothing when it lands | Ground spell, footprint telegraph, writes a burnt dish on both screens |
| R | Dinner Is Served | 24 | An 8 m table rises 3.5 m ahead of her across her aim in 0.6 s, stands 5 s, 150 HP, three dishes on it. Standing within 1.8 m for 1 s eats them: her 50 HP and +25% damage 5 s; the enemy +25% damage 5 s | Self spell, line telegraph, `ctx.addObstacle` (1.2 m thick) and three shared-HP turret units |

## How the dishes work on two screens

- A dish is added by the spell effect the moment it lands, on both screens, with a small integer id (0-15, counted in landing order). The 4th evicts the oldest.
- Her own client decides what she eats (`tick`): a buff and a heal are hers. It tells the other screen with `show('ate', n)` (`ownChanged` removes the dish).
- The screen that decides the enemy decides what the enemy eats (`victimTick`): `hitEnemy` carries the effect (haste goes through its `debuff`; a burnt dish is 60 and a stun), and `noteOwner('ate', id)` removes it on her screen.
- If both step on one dish in one instant either may win; it is gone on both. A dish does not feed whoever stood on it as it landed until they step off and back on (so Hot Soup's slow cannot be cancelled by the dish under the slowed enemy).
- The table: a `TableRec`. Both screens write it on cast. Eating it is a 1 s stand, decided on each eater's own deciding screen (`show('feast')` / `noteOwner('feast')`). A table broken where the units live is told to her client with `noteOwner('table')`.

## Counterplay (checked with the numbers in kits-v5.md)

Q: 0.25 + 6 / 20 = 0.55 s to 6 m; a sidestep needs 0.25 + 0.8 / 4 = 0.45 s: dodgeable. W: delay 1.0 s, a walker needs 0.25 + 2.5 / 4 = 0.875 s: leavable. E: only a trap; the dish
is black and smoking and stands 8 s: walk round it. R: break the table (150 HP) or get there first: the enemy eats the same plates. Weakness: you can eat her food; without it she is plain.

## What the CPU does

- Q: fired whenever the enemy is in range and in sight (no hold). W: held when the enemy is closer than 2.5 m. E: held while two or more dishes are already out, or the enemy is closer than 3 m. R: held while a table stands or the enemy is farther than 7.5 m.
- `aiGoal`: when the table stands and is not eaten, it walks to 1.25 m off the table's line and stays; else, below 75% HP, it walks to a good dish within 5 m.
- `enemyGoal` (the CPU fighting her): walks to a good dish within 4 m; steps 2.6 m away from a burnt dish it is within 1.5 m of.

## Not built as written

The enemy cannot be healed by a good dish: nothing in the shared code heals the other hero (a negative `hitEnemy` is not capped at max HP and is sent to the server as damage online). The enemy's dish and
table give the speed and the +25% damage only. Needed: a `heal` field on `HitOptions` (or `TraitView.healEnemy`) that the victim's screen applies with the max-HP cap.
