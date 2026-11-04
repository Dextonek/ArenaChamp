---
title: Kit mason (Bram and Gerald)
tags: [design, heroes, kits, mason]
updated: 2026-11-04
---

# v5 (2026-11-04): Bram, the Pillar Mason

Numbers from [new-heroes-kits.md](new-heroes-kits.md) section 1. Bruiser, melee, 760 HP, 3.8 m/s, attack 2.5 m, 15 per 1.2 s (`look: 'smash'`). Accent `#c9b48a`, foil `#6d6a66`. Model `models/heroes/mason_v2.glb`.
Files: `src/kits/mason.ts` (`masonKit`), `src/traits/mason.ts` (`masonTrait`, Gerald's record), `src/effects/parts/mason.ts` (`MASON`, `MASON_CSS`, Gerald and the pooled parts), `src/spells/targeted/{raiseGerald,theShove,aGoodLean,geraldNo}.ts`.

| Key | Spell | CD | What it does |
|---|---|---:|---|
| P | Best Friends | | One Gerald: a real pillar (obstacle, radius 0.85, 3.5 m tall) with 220 HP in a hidden `turret` unit. Bram within 3 m of him takes 15% less (`taken`). A faint chalk ring round Gerald shows the 3 m (a mark, since `ring` sits at Bram's feet). Broken: rubble, SORRY GERALD |
| Q | Raise Gerald | 6 | Ground, 9 m. Circle 1.5 m, impact 0.7 s: 50 and a 0.5 s knock-up on live positions. `cc`. An older Gerald crumbles (no word) |
| W | The Shove | 7 | `aim: 'line'`. Needs Gerald within 3 m ("Too far from Gerald"). 0.3 s wind-up, then he slides up to 8 m along the aim at 8 m/s (stopped by walls, pillars, the ring). Touch within 1.3 m, once: 60, carried; stopped on a surface with them: stun 0.9 s. Line `boltWidth(1.0)` from Gerald's spot |
| E | A Good Lean | 11 | Needs Gerald within 8 m. Dash (0.25 s) to 1.5 m short of him, shield 60 for 2 s (`afterCast`). `dash`. Word HUG; Gerald goes alarmed |
| R | Gerald, No! | 24 | `aim: 'line'`. Needs Gerald. Shadow 10 m x 1.6 m for 1.0 s as he tips, then 150 inside it (telegraph's own test). He breaks, rubble along the line 3 s slows (`victimTick`, `hitEnemy` damage 0). Word GERALD, NO! Bram has no pillar after. One impact frame |

## How Gerald works

- State: `geraldOf(bramFigure)` in `src/traits/mason.ts`: `{ x, z, hp, obstacle, unit, mood, alive }` plus bookkeeping (`epoch`, `moving`, `toppling`, `sorry`, rubble lists). Effects write it on both screens, the trait's `marks` draw it, so no later cast can cut him off.
- Look: `Trait.marks` with kinds `gerald`, `gerald-alarmed`, `gerald-angry` (one pooled face each), `geraldAura`, `rubble`, `dust`. Faces are carved on both sides, so either player's camera sees one. Mood: bored by default, alarmed on arrival, in a shove and in a hug, furious for 1.2 s after a hit or after hitting a wall.
- Obstacle and unit: made at Q's burst (unit first, then obstacle), as `crystalPillar.ts` does, but with no timer. The unit is pinned to his spot every frame (`marks`, both screens), so hits cannot knock it out of the pillar. Breaking by damage (`onDeath`, `slain`) removes the obstacle and leaves a heap; removing him on purpose (a new Q, R) expires the unit with `left = 0` so `slain` stays false and no word comes.
- The shove does not move a live obstacle (the list is rebuilt on add or remove): the obstacle is removed at 0.3 s and a new one stands at the end. The unit is kept (the same 220 HP, held on him), not replaced.
- A new round clears obstacles and units without a callback: the trait forgets Gerald on the first frame of a round (`mem` is cleared).
- CPU (`aiHold`): with no Gerald it holds W, E and R, so Q raises him first. W only with Gerald within 3 m of Bram and the enemy within 9 m of Gerald; E only with Gerald 2.5 to 8 m off; R only with Gerald within 4 m and the enemy within 9 m of him.

## Known limits

- Without `ctx.summon` (a network duel) Gerald has no HP and cannot be broken.
- A mood from a hit is read from the unit's HP, so it shows only where the unit lives.
