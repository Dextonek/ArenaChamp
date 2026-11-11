---
title: The full Rust simulator (in the making)
tags: [pipeline, balance, tools, rust, port]
updated: 2026-11-11
status: started; three pieces of the core ported and tested; no fight loop yet
---

# The full Rust simulator

The user, 2026-11-11, on being shown the [rough Rust model](rust-model.md) and asked whether it was enough or the full
copy of the rules was still wanted: **"then lets make full functionality"**. This is that: the game's fight rules
written again in Rust (`pipeline/rustfull/`), so fights run without a browser and thousands of times faster.

**It is not finished and plays no fights yet.** Until it does and is graded, numbers come from the
[real simulator](simulator.md) and quick estimates from the rough model.

## What it has to copy

| Part of the game | Lines | State |
|---|---:|---|
| Cover, walking round it, sight, sweeps (`src/obstacles.ts`) | 269 | **ported** (`geom.rs`), tested |
| Status effects and buffs (`src/effects/status.ts`) | 219 | **ported** (`status.rs`), tested |
| The basic attack (`src/attacks/`) | 238 | **ported** (`attack.rs`), tested |
| The duel: the fight loop, both CPUs, how a hit is resolved (`src/duel.ts`) | 3,108 | to do |
| The player's hero: walking, casting, cooldowns, roots (`src/heroMode.ts`) | 1,553 | to do |
| The arena: figures, HP, shields, hits, sight (`src/arena.ts`) | 1,111 | to do |
| Bolts (`projectile.ts`), units (`summon.ts`), the passives' engine (`traits/runtime.ts`) | 1,456 | to do |
| 40 heroes: their passives (`src/traits/`, 10,600 lines) and the hit rules inside 160 spell files | | to do |
| Arenas: cover layouts first; events and closing stages later | | to do |

## How it is done

1. **A small graded slice first.** The core plus two or three of the six benchmark heroes (one melee, one ranged),
   one arena (the Night Temple), events off. Nothing else is started before that slice is graded.
2. **The grader before the engine.** Rust fights write the same record as the real simulator's `--keep` (winner,
   seconds, damage and hits by source, casts per slot), and one page shows Rust beside real. Graded first on what is
   tight and catches port bugs a win rate hides: casts per slot a second, hits per cast, damage per hit, fight length.
   Win rate comes last.
3. **The yardstick is recorded once.** `pipeline/rustfull/data/slice-six.json`: 600 real fights among the six
   benchmark heroes in the Night Temple (200 a hero), made with
   `python pipeline/sim/sim.py all --heroes Brannoc Kaia Isolde Sirix Cantor Oblivion --reps 20 --keep --arena temple`.
   Later work is graded against recorded files and does not need the browser simulator.
4. **The core is read in the fight loop's own order and ported as it is read.** Order of operations and caps decide
   whether two engines agree; the Rust code is the record, and each file says which game file it mirrors.
5. **Numbers and layouts come from the game's export, not from the Rust source** (`pipeline/rustsim/export.js`, to be
   extended with the traits' exported constants and each arena's cover). Numbers that only live inside a spell file
   are flagged in the port.
6. **A drift guard per hero:** a hash of its kit, trait and spell files is stored with its port; the simulator warns
   when they changed. Silent disagreement between two copies of a rule is the risk of this whole approach.
7. **Helpers (three at most) only after the slice passes** and the core's interface is frozen; then heroes in
   batches, each graded against recorded real fights.

## Found before a line of the fight loop was written: the two sides are not equal

The real duel has two computer players: the opponent's (`ai`, around line 1898 of `src/duel.ts`) and the autopilot
that plays the player's hero in a simulated fight (around line 2189). In 3,120 real fights, every pairing fought both
ways round:

| Hero | Wins as the player's side | Wins as the opponent's side |
|---|---:|---:|
| Auriel | 50% | 10% |
| Cantor | 40% | 5% |
| Hank | 64% | 90% |
| Bram | 49% | 71% |
| Grandma Ironknit | 60% | 78% |
| Nyx | 33% | 51% |
| Sefu | 41% | 58% |

Seven of 40 heroes differ by more than chance explains; over all fights the player's side wins 48.6%. So:

- **The port must carry both computer players**, not one.
- **It matters for the game itself.** Auriel and Cantor look like the weakest heroes of the roster, but most of that
  is the opponent's CPU not playing them: as the player's side they are near the middle. Anyone who picks "Duel the
  CPU" and meets Cantor meets a pushover. That is a CPU fix, not a hero fix. Not touched yet; it waits on the user.
- `python pipeline/sim/sim.py hero <Name>` measures the player's side only (as `kit-balance.js` always did). The
  40-60% target was set that way, so it stays, but a hero should also be looked at with `--sides both`.

## The fight loop's order, as read so far

One frame of a simulated fight (1/60 s), in the game's order. The port must keep it.

`runtime.ts` `step(dt)`:
1. the spell effects that are playing (`effect.update`): hits, moves and bolts are made in here
2. the danger zones' clock (`telegraphs.update`)
3. `arena.update(dt)`: figures, statuses, bolts, units
4. `heroMode.update(dt)`: the player's hero: walking, its cooldowns, its basic attack
5. `duel.update(dt)`, which is:
   1. the round clock; the opponent's basic attack (`oppAttack.update`)
   2. (arena events and stages: out for now)
   3. if the round is over: return
   4. the passives, when the fight is live: `heroRt.tick`, `oppRt.tick`, then `oppRt.victimTick`, then `heroRt.victimTick`
   5. the end: the opponent at 0 HP is a win, checked before the player's 0 HP, which is a loss
   6. the player's walk speed, smoothed over 0.2 s (the opponent's CPU aims ahead with it)
   7. the opponent's CPU (`ai`, line 1898), then the autopilot for the player's hero (`pilot`)

Still to read: `ai` and `pilot` in full, `heroMode.update` and its casting, `arena.update` and `arena.hit`,
`resolve` (how a hit passes through both passives; read once already, lines 1405 to 1445), bolts, the passives' engine.

## What is out, for now

Arena events and closing stages, Last stand, the Raid and bosses, and anything about two screens (the network). Units,
doors and cover made by spells arrive with the first hero that needs them. Anka is ported last: her kit may still move.

## The honest size

Unknown until the slice is done: the slice will give hours per hero, measured, and the total follows from that. The
user was told "several weeks" before choosing it. The rough model stays in use until the full one passes its grade.
