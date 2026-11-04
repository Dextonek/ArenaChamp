---
title: Sheep kit, Bo
tags: [design, heroes, kits, sheep]
updated: 2026-11-04
---

# Sheep kit: Bo, the angry shepherd (ranged summoner)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "9. Bo, the angry shepherd". 640 HP, 3.9 m/s, basic attack 6 m, 9 per 0.9 s (look 'sand', hay colour).
Accent `#f0ead6`, foil `#7a5a3a`. Question: herd them at you, or keep them as a wall? Weakness: sheep follow whoever is nearest, including you, and
you can shear them. Second decision: where he stands decides where the flock goes. Palette `SHEEP` / `SHEEP_CSS` in `src/effects/parts/sheep.ts`.
Model: not set (registered by the lead). The wool is mid-tone (`#b8b2a4`, about 0.7 of white) everywhere large, so the bloom never haloes it; the
cream accent is for words and the UI only.

- **Passive Wool Over Your Eyes** (`src/traits/sheep.ts`): sheep walk to the NEARER of Bo and the enemy hero (`SummonOptions.goal`, written by
  `spawnSheep`; `tick` keeps `book.foe` so a sheep can tell the hero from the enemy's units). A sheep still bumps whoever is in reach. A sheep's
  hit on the enemy hero adds 1 Wool in `dealt` (`addStacks('wool', 1, 8, 5)`: 8 s, 5 at most); Shear's ball adds 3, each Stampede hit 1. At 5 Wool
  `victimTick` (where the enemy's hits are decided) clears the Wool, puts the hidden `baa` stack on for 1 s (both screens read it) and sends a
  `silence` and a `slow` hit with `hitEnemy`. Then `enemyScale` gives 0.62, `enemyLabel` shows BAA, and `marks` puts a wool ring and a little sheep
  over the enemy. While they are a sheep, more Wool does not pile up. A sheep: 30 HP, blocks bolts as a unit does, bump 5 per 1.1 s, walks 3.4 m/s.
- Q **Crook Whack** (`crookWhack.ts`, 'crook whack'): SELF cone, 4 m, 100 degrees (the angle is mine), cd 3.5, wind-up 0.55 s. 58. A hit on the
  enemy hero leaves a sheep at their feet (a real summon, 6 s). Telegraph: the cone.
- W **Spare Sheep** (`spareSheep.ts`, 'spare sheep'): GROUND, 8 m, cd 8, `summon: true`. Three sheep are flung in arcs and land at 0.5 s: 30 HP, 6 s.
  Cap: the engine allows 6 units a side and makes only the room left (four alive: two come down; six: none). `canCast` refuses the cast at a full
  flock (the CPU never wastes it). No damage, so no telegraph; a ring shows where they land.
- E **Shear** (`shear.ts`, 'shear'): GROUND, `aim: 'line'`, 8 m, cd 11. Needs an unsheared sheep within 6 m (`canCast`). The nearest is sheared: it runs on
  naked and 1.5 x faster. The wool is thrown as a bolt from Bo: wind-up 0.25 s, 20 m/s, radius 0.3, so 6 m at 0.55 s. 50 and 3 Wool. Telegraph:
  the line, `boltWidth(0.3)` wide. The bolt starts at Bo, not at the sheep, so it keeps the 0.55 s budget wherever the sheep stands.
- R **Stampede** (`stampede.ts`, 'stampede'): GROUND (a line from Bo toward the aim), 12 m, cd 22. 0.8 s of gathering (the crook whirls), then eight
  drawn sheep run 12 m at 8 m/s in a strip 4 m wide, eight lanes 0.5 m apart in two ranks. 30 per sheep, a victim takes 3 at most (90), each
  hit 1 Wool. Hits are on live positions inside the strip within 0.75 m of a sheep. They are not summons: the cap does not count them. A pillar
  on the centre line ends the run there (`bankPath`); the telegraph shortens with it. One short impact frame at 0.8 s.
- Words: GET BACK HERE! (R), HOLD STILL! (E), COME ON, LASSES (W), SHOO! (Q, half the time) over Bo; BAA over the enemy; a little *baa* over every
  sheep that appears.

**The CPU** (`aiHold`): Q is not held, it casts it in its 4 m reach. W only with the enemy within 8 m (and the flock not full). E only with an
unsheared sheep within 6 m. R only with the enemy within 10 m.

**Network duels:** `ctx.summon` is undefined there, so Q and W make no real sheep online (the effects only draw the landing); the Stampede
and the Shear ball are not summons and work as written.

Shared things the lead should do: register `crookWhackModule`, `spareSheepModule`, `shearModule`, `stampedeModule`, `sheepKit` and `sheepTrait`;
add `wool: { color: '#efe6cc', shape: 'balloon' }` to `STACK_LOOK` in `traits/fx.ts` (a puffy pip; no shared change is needed for `baa`).
