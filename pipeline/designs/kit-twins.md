---
title: Twins kit, Pim and Pom
tags: [design, heroes, kits, twins]
updated: 2026-11-04
---

# Twins kit: Pim and Pom (fighter, melee or ranged)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "10. Pim and Pom, the twins". 620 HP in all (one real bar, `hpChunks: 2`), 4.2 m/s. Theme `twins`.
Two halves of one hero, one trait (`twinsTrait`, `src/traits/twins.ts`), one kit name ('Pim and Pom'): `twinsKit` (`src/kits/twins.ts`) is Pim,
`twinsKit.alt` is Pom; `HeroKit.alt`, `base`, `attack`, `TraitView.swapKit` do the swap. Palette `TWINS` / `TWINS_CSS` in `src/effects/parts/twins.ts`.
Question: who should be in right now? Weakness: the tag has a 0.5 s hold you can read. Second decision: the rested twin heals, and each has a spell the other wants.

| | Pim (`twinsKit`, melee, accent `#ffb04a`, foil `#6ac8ff`) | Pom (`twinsKit.alt`, ranged, accent `#6ac8ff`, foil `#ffb04a`) |
|---|---|---|
| Model | `models/heroes/pim_v2.glb` | `models/heroes/pom_v2.glb` |
| Basic attack | melee 2.4 m, 12 per 0.9 s, look 'sweep' | ranged 6 m, 9 per 0.9 s, speed 20, look 'dart' |
| Q, cd 3 | **Bonk** ('bonk'): 3 m cone, 100 degrees, 0.45 s wind-up, 50 | **Pebble** ('pebble'): 9 m bolt, 22 m/s, 0.3 s wind-up, radius 0.3, 45. Reaches 6 m at 0.57 s |
| W, cd 9 | **Charge** ('pim charge'): `dash`, up to 5 m, lane 1.6 m wide, 0.4 s dig-in then 0.2 s run, 40 and a shove on arrival | **Snare** ('snare'): `cc`, 7 m, 2 m circle, 1.0 s delay, 20 and root 1 s |
| E, cd 10 | **Shield Up** ('shield up'): 50 shield for 2 s (the trait's `t.shield`, plus a toy shield) | **Backflip** ('backflip'): `dash`, `escape`, hops 4 m in 0.3 s; a party popper left where she stood goes off after 0.65 s: 30 in 1.5 m |
| R, cd 8 | **Tag Out** ('tag out'), the same on both halves | |

- **Passive Tag Team.** Total HP is the real HP (620, the server's one number, untouched). The trait keeps `pim` and `pom` in `mem` on the own client (310 each)
  and holds `pim + pom == t.hp()` by watching the real HP in `tick`, not in `taken` (which sees a hit before a shield soaks it): a drop comes off the twin
  who is in (what is left past 0 comes off the other: the real bar lost it), a rise goes to the twin who rests (past 310 to the one in). The resting twin heals
  4 a second: `t.heal` in lumps of 2 or more, which raises the real bar. A twin at 0 is tagged out at once, with no hold, no cooldown and a "TAG!" word; with
  both at 0 the real bar is 0 and the hero is dead. A new round clears `mem`: both at 310, Pim in (the duel resets the kit to its first half).
- **Both shares are shown to both players** as pips over the hero (`ownLook`, shape 'gem'): `pimHp` orange and `pomHp` blue, one pip per 62 HP, at least one
  while a twin has any HP. (A ring at the feet would only have one colour; the pips read at once which twin is low.) The own HUD also shows the resting
  twin's HP as the passive badge.
- **Tag Out** (R): `canCast` refuses while a tag is running ("Tagging") and when the twin behind has under 15 HP ("Out cold"). `afterCast` holds him still 0.5 s
  (`t.hold`) and notes the time; in `tick`, 0.5 s later: `t.swapKit(next)`, `t.show('twin', 0 or 1)` (the other screen calls `swapKit` in `ownChanged`), and the
  cooldown of the next spell to be ready among Q, W and E is cut by 2 s (`setCooldown(slot, cooldownLeft - 2)`; the interpretation of "the next spell's
  cooldown" is mine; cooldowns stay per slot, the duel keeps them across the swap). The effect shows the twin behind popping out of the backpack, the high-five and a
  clear flash, TAG! at the start and MY TURN at the swap. Which twin comes out is read from `twinBooks` (kept fresh by `Trait.ring`, which is asked every frame on both screens).
- **The CPU.** `aiHold(3)`: Tag Out only when the twin in is under 35% of his share and the other has more, or the enemy is past 6 m and Pim is in, or the enemy is
  within 3 m and Pom is in; never while a tag runs or the twin behind has under 15 HP. `aiHold(2)`: Shield Up only with the enemy within 4.5 m while Pim is in.
  Snare (`cc`) goes first when the enemy is in 7 m; Charge (`dash`) when the enemy is between 3.5 m and 5 m; Backflip (`escape`) when the enemy is within 3.5 m,
  aimed away from the enemy by the engine; Bonk within 3 m; Pebble within 9 m. Tag Out is flagged `summon` so the engine's wait for an ultimate (enemy under
  55% or 20 s) and its self-spell reach do not hold it back; `aiHold` decides. `kit.melee` and `kit.spells` change with the swap; the duel reads them live.
- **Counterplay, checked.** Bonk: stay out of 3 m; the cone shows 0.45 s ahead, more than the 0.25 s reaction. Pebble: sidestep (0.57 s at 6 m, the line is `boltWidth`).
  Charge: the lane shows 0.6 s ahead, leaving 0.8 m of it takes 0.2 s, plus 0.25 s of reaction. Snare: 0.25 + 2/4 = 0.75 s, inside the 1.0 s delay. Popper: 0.25 + 1.5/4 =
  0.625 s, inside the 0.65 s fuse. Tag Out: the 0.5 s hold is the window.

### Not built as written
- **Backflip goes toward the aim, not away from it.** The engine's `escape` aim (`fleeAim`) already hands the CPU a point away from the enemy, and every dash
  in the game goes toward its aim, so "away from the aim" would flip the CPU into the enemy. The player clicks where to land.
- The popper's 30 and the hop's flight: her root lasts until the popper goes off (0.65 s, the telegraph's impact), so she stands 0.35 s after landing.
- Snare's damage (20), Charge's lane width (1.6 m) and the cone angle (100 degrees) are mine: the table gives only the reach.

## Files
`src/kits/twins.ts`, `src/traits/twins.ts`, `src/effects/parts/twins.ts`, and in `src/spells/targeted/`: `pimBonk.ts`, `pimCharge.ts`, `pimShieldUp.ts`,
`pomPebble.ts`, `pomSnare.ts`, `pomBackflip.ts`, `tagOut.ts` (category 'hero: twins').
