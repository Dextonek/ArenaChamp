---
title: The Tower's floors as worlds, stage 3: the five floors joined
tags: [tower, build, floors]
updated: 2026-11-13
---

# Stage 3: five floors in one registry, climbed

Floors 2 and 3 ([tower-worlds-floors23.md](tower-worlds-floors23.md)) were built on `tower-worlds-pieces` beside floors 4 and 5
([tower-worlds-floors45.md](tower-worlds-floors45.md)) on `tower-worlds`, and merged (commit `57a0e7e`); then the main project's
performance work was merged in (`b00a04b`). How it works now: [docs/architecture/tower-worlds.md](../../docs/architecture/tower-worlds.md).

## What the merge decided

- `floors/index.ts`: `FLOORS` holds 1 to 5.
- A carried thing is drawn by its `item` first (`f45/carry.ts`), then by the step's `look` (jar, bundle), else as the key; the winch is
  drawn only for the key (`item === 'key'` and not `plain`).
- A rival's duel is fought once on every floor (won or lost, the arch is quiet after it).
- `buildLaw` asks floors 4 and 5's full laws first and registers every law in `lawOf`.
- An enemy's look: `EXTRA_LOOKS` (floors 4 and 5), then `LOOKS` (floor 1), then `wildLook` (floors 2 and 3), else the docker.
- `src/game/main.ts`: the menu's "the canvas is covered" flag (the performance work) is cleared while a climb is on.

## Floors 2 and 3 through the real ruler, trial, rival and gate (route bot, game seconds)

| Floor | Hero | Run 1 | Run 2 |
|---|---|---|---|
| 2 | Lyra | 649 s, 0 falls | 566 s, 0 falls |
| 2 | Bram | 644 s, 1 fall (the gate) | 671 s, 0 falls |
| 3 | Lyra | 966 s, 0 falls | 958 s, 0 falls |
| 3 | Bram | 1071 s, 1 fall (the gate) | 1009 s, 0 falls |

All eight cleared and won the rival's duel. Floor 3 misses the fourth star (par 900 s). After the merge, Lyra once each: floor 1 698 s,
floor 4 548 s, floor 5 644 s with one fall at the gate.

## Win rates of the pieces (`_pieceRun`, Lyra and Bram, 8 to 12 fights: small samples)

| Floor | Ruler | Gate |
|---|---|---|
| 2 | 8 of 8, then 6 of 12 with the Elder Root at 4000 health (was 3200): Lyra 6 of 6, Bram runs out of time | 2 of 8 against Fenna at CPU level 4; 12 of 12 at level 3. Left at 4: there is no step between |
| 3 | 4 of 8 | 6 of 8 |
| 4 | 6 of 8 | 7 of 8 |
| 5 | 4 of 8 | 4 of 8 |

## The game page

- **The lock:** `tower.world.floor` is the highest floor a climb may begin on; floor 1 is open, floor N+1 opens when floor N's gate is
  won. Fixed: clearing a lower floor again wrote a lower number and locked the floors above (`Math.max` now). The tools start any floor.
- **The chain:** on a fresh profile only tile 1 was open; each floor was started from the Climb tab and forced cleared in the page (the
  run's `won` given `ruler` and `gate`, then `floorCleared()`), and the card's button "Climb to floor N+1" started the right floor four
  times. Floor 5's card says "The way up is still being built".
- **Reload:** floors 2 and 3 started from the Climb tab, a quest taken and a waystone touched, the page reloaded: "Continue floor N"
  brought back the floor, the quest and the waystone.
- **After the performance work:** every floor's camp draws on the game page (`j-five-camps.jpg`), no console error.

## Checks

`_worldCheck` on all five (every spot reachable, both states of floor 2's paths), `_worldVerbs` (all verbs; its `dark` and `sides` cases
play the scratch laws, not floors 4 and 5's), `npx tsc --noEmit -p .`, `npm run build`, `npm run test:server`, the weekly Tower
(`_tower(['Lyra'], 1, { upTo: 2 })`). `_worldCheck` counts up to 9 units near one point on floor 4 and 13 on floor 5: that is the sum of
the packs whose homes are near, not what is alive at once (the route runs held hero side at most 5, foe side at most 6).

## Pictures

`docs/tower/worlds/`: `j-*.jpg` (the Climb tab with five tiles, floor 2's result card, the carried jar and spade, the reloads, the five
camps), `jf2-*`, `jf3-*` (rulers, gates and doors of floors 2 and 3 with the real pieces), `five-floors.mp4` (27 s, a headless screen
capture of scripted spots on all five, the autopilot fighting; floor 4 in a lit hall).

## Not done

Nobody has played it. Fairness as above. Looks first pass. A phone not measured. Friends, the account and the board: the design's step 4.
