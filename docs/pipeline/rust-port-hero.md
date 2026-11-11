---
title: Porting one hero into the Rust simulator
tags: [pipeline, rust, port, checklist]
updated: 2026-11-11
---

# Porting one hero into the Rust simulator

The checklist for bringing one hero into `pipeline/rustfull` (the game's fight rules written again in Rust). What the
simulator is and how close it is: [rust-sim.md](rust-sim.md). Two heroes are the worked examples: Brannoc
(`src/hero/forge.rs`) and Isolde (`src/hero/frost.rs`).

**The aim is to agree with the game as it is, odd habits included.** Never tidy a rule, never guess one: read it.

## 1. Read the hero in the game

- Its kit `src/kits/<theme>.ts`, its passive `src/traits/<theme>.ts`, its four spells in `src/spells/targeted/`
  (the labels are in `pipeline/rustfull/data/game.json`; `python pipeline/rustfull/guard.py` knows how to find the six
  files).
- A spell file is mostly drawing. The rules are: `targeting`, `telegraphs`, what `cast()` decides, and in `update()`
  every `ctx.hit`, `ctx.projectile`, `ctx.moveCaster`, `ctx.shieldSelf`, `ctx.healSelf`, `ctx.addObstacle`,
  `ctx.carry`, `ctx.displace`, `ctx.confine`, `ctx.summon` with the moment it happens.
- What the hero's computer player does differently: `aiHold`, `aiGoal`, `enemyGoal`, `canCast`, and the kit's flags.

## 2. Write `pipeline/rustfull/src/hero/<theme>.rs`

- `pub const HERO: Hero = Hero { name: "...", state: new_state, spell, <its hooks>, ..PLAIN };` and add one line to
  `mod` and one to `HEROES` in `src/hero/mod.rs`, and one to `PORTED` in `guard.py`. `Hero` lists every hook with the
  name of the game's hook it stands for.
- **State** the passive and the spells share (the game's `mem`, `WeakMap`s per figure): one `State` struct, read with
  `hero::state` / `hero::state_mut`. What the passive shows (`t.show`, `t.own`) and its stacks on the enemy
  (`addStacks`, `stacks`, `clearStacks`) are in `w.rt[s.i()]`.
- **A spell** is a struct with `impl Spell`: `cast` takes the context and starts from 0; `zones` gives the danger
  zones exactly as `telegraphs` does (start, impact, until; a bolt line's width is `bolt_width(radius)`); `update` is
  the game's own steps: `self.time += dt; if !self.done && self.time >= T { ... }`, in the game's order, including the
  early `return` when the effect's duration is over.
- **Numbers.** A spell's own settings (`default<Name>()`) come from the export: `w.kits[side].spells[slot].num("damage")`.
  Constants inside a trait or spell file are mirrored by hand at the top of the Rust file, under a comment naming the
  file they are from.
- **A hit** is `w.spell_hit(&ctx, Hit { damage, knock: Some(k), from: Some(p), projectile: true, .. })`. Carry over
  every option the game passes (`knock`, `from`, `pull`, `status`, `debuff`, `projectile`). A hit with no `knock` given
  is `knock: None`: the two sides read that differently. Without `projectile: true` the hit lands only inside the
  cast's zones.
- **A bolt** is `w.fire(&ctx, BoltSpec { .. })`; its hits come back through the same path.
- **Two clocks.** `t.time` in a trait is `w.time` (the round, seconds). `performance.now()` anywhere is `w.now_ms`
  (the page, milliseconds). Keep whichever the game uses in each place: they do not round alike (see rust-sim.md).
- **Random numbers** come from `w.rng.f()` only.

What the engine offers a passive or a spell (`src/fight.rs`, "what a passive or a spell may do"): `pos`, `hp`,
`max_hp`, `status`, `los`, `enemy_distance`, `heal`, `shield`, `clear_shield`, `shield_amount`, `pay_hp`,
`set_cooldown`, `cooldown_left`, `move_to`, `dashing`, `carry_by`, `apply_status`, `apply_buff`, `hold`,
`release_root`, `still`, `add_obstacle`, `remove_obstacle`, `trait_hit`, `spell_hit`, `fire`, `can_recast`.

## 3. When the engine lacks something

Add it to the engine, small and faithful, from the game's own code (`src/duel.ts`, `src/arena.ts`,
`src/effects/projectile.ts`, `src/heroMode.ts`), with a test. If it is too big for this hero's turn, make it stop the
program with a message. **Never leave a rule out silently**: a missing rule that passes unnoticed is the one failure
this tool cannot afford. Known gaps today: curving, banking, bouncing and splitting bolts, walls of wind, doors;
summoned units; confine rings; `displace`; the CPU's aim for spells that dash or flee (`dashAim`, `fleeAim`); ammo
charges; breakable walls.

## 4. Grade it

The yardstick is recorded real fights: `pipeline/rustfull/data/yard-<hero>.json`, 800 fights (the hero against Brannoc
and against Isolde, each way round, Frost arena, events off), made with
`python pipeline/sim/sim.py hero <Hero> --foes Brannoc Isolde --sides both --fights 200 --arena frost --keep --out yard-<hero>`.

```
cargo build --release --manifest-path pipeline/rustfull/Cargo.toml
pipeline\rustfull\target\release\rustfull.exe duel <Hero> Brannoc Isolde --fights 5000 --page-fights 100 --out pipeline\rustfull\data\rust-yard-<hero>.json
python pipeline/rustfull/grade.py pipeline/rustfull/data/yard-<hero>.json pipeline/rustfull/data/rust-yard-<hero>.json
```

- Look first at the hero's casts in 10 s, hits for each cast and damage of a hit: they barely swing, so a wrong rule
  shows there. Win rates come last.
- **It counts as ported** when all its win rates are inside the noise and its finer numbers are within about 5%
  (a number from fewer than about 200 real casts or hits swings more; say so instead of chasing it).
- Brannoc's and Isolde's own rows must still agree too: if they moved, the engine changed under them.

## 5. When a number is off

Do not guess. Lay the game beside Rust:

1. Every cast and hit: copy `pipeline/rustfull/probe.js`, set its `PROBE` line to the pair, run it with the MAIN
   checkout's runner (it needs `node_modules`):
   `python C:\Users\erich\ArenaChamp\pipeline\tools\page-shots.py <your probe.js> <out folder> --json probe.json --timeout 540`,
   then `rustfull duel A B --fights 300 --trace --out rust-probe.json` and
   `python pipeline/rustfull/trace-compare.py probe.json rust-probe.json`.
2. Every frame: the same with `probe-frames.js`, `rustfull frames A B --fights 40 --out rust-frames.json` and
   `python pipeline/rustfull/frames-compare.py frames.json rust-frames.json <real fight number>`. It shows the first
   frame where a real fight and the closest Rust fight part. A parting that is not a dice roll (a strafe flipping, a
   dodge) is a rule.

## 6. Finish

`cargo test --release` passes; `python pipeline/rustfull/guard.py --stamp`; commit the hero's file, the list lines,
any engine change with its test, and the yardstick. Say in the commit what was graded and what did not agree.
