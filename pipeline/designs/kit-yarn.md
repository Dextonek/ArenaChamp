---
title: Yarn kit (Grandma Ironknit)
tags: [design, heroes, kits, yarn]
updated: 2026-11-04
---

# v5 (2026-11-04)

Grandma Ironknit, theme `yarn`. Support, ranged. 620 HP, 3.8 m/s, attack 5.5 m, 9 per 0.9 s (`dart`). Accent `#e86a9a`, foil `#c8c0a8`. Designed in
[new-heroes-kits.md](new-heroes-kits.md) section 18; code in `src/kits/yarn.ts`, `src/traits/yarn.ts`, `src/effects/parts/yarn.ts`, `src/spells/targeted/{knittingNeedle,castOn,sweater,mrBiscuit}.ts`.

| Key | Spell (label) | CD | Numbers |
|---|---|---:|---|
| P | Keep Warm | | Up to 3 yarn lines. Crossing one: root 0.4 s, then slow 1 s (two `hitEnemy` calls: root 0.4, slow 1.4). A line stays until cut; one hit cuts it. Per-line guard 1.5 s. She crosses her own freely. Oldest goes at a fourth |
| Q | Knitting Needle (`knitting needle`) | 3.5 | Bolt 9 m, 22 m/s, radius 0.3, 0.3 s wind-up, 50. Reaches 6 m at 0.57 s |
| W | Cast On (`cast on`) | 0.6 gap, 2 charges, 6 s each | Line from 0.6 m ahead of her to the first cover in the aimed direction, up to 9 m from her; tied at 0.4 s. No cover: ends 9 m out, tied to nothing, drawn with a ball of wool on the floor |
| E | Sweater (`sweater`) | 11 | Click, 7 m. A 1 m circle follows the enemy's feet, lands 0.5 s, needs sight (a click spell: no sidestep). Slow 2 s, shrinks at 2.5 s after the cast: 40 |
| R | Mr. Biscuit (`mr biscuit`) | 24 | Cat at her feet at 0.4 s: 200 HP, 6 s, 4.5 m/s, melee 25 per 1 s with a 1 s slow on each hit. Stops 1 s for a line cut within 4 m |

## How it works

- **Lines** are `yarnBooks` records (a WeakMap keyed by her figure), written by Cast On's effect on both screens and drawn with `marks`
  (`yarn`, `yarnLoose`, `snip` in `markLook`). A line is not an obstacle. It has a 1 HP hidden `turret` unit at the spot nearest the enemy
  (spells and basic attacks hit it) and a bolt wall on the same segment (a bolt anywhere along it cuts it), as `traits/mime.ts` does for its walls.
  Cuts are told between screens with `noteOwner('cut')` / `show('cut')`. Lines never expire; a new round clears them (first frame of a round, `mem`).
- **Crossing** runs in `victimTick` (the screen that decides hits): the enemy's last position to this one against each line.
- **Words** over the enemy come from `enemyLabel`: TANGLED (1.4 s), KEEP WARM (2 s of the sweater), "ooh, it suits you" (1.1 s from the shrink).
- **Mr. Biscuit** slows with `dealt` (his hits are slot 3 hits with damage). His `goal` sends him to the loose end of a line cut near him, and his look
  sits and bats at it (`CatState.playing`).
- Units: 3 lines + the cat = 4 of the 6 allowed per side.

## The CPU

W only with the enemy 3 to 9 m away and fewer than 3 lines standing; R only with the enemy within 9 m (it is flagged `summon`); Q and E whenever in reach.

## Counterplay

Q: step off the line (0.57 s to 6 m). W: cut the line (any hit), or fight in the open. E: reach cover within the 0.5 s or leave the 1 m circle; or take 40.
R: shoot the cat, or cut a line near him and he plays for 1 s.
