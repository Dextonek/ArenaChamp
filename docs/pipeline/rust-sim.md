---
title: The full Rust simulator (in the making)
tags: [pipeline, balance, tools, rust, port]
updated: 2026-11-11
status: plays whole fights; two of 40 heroes ported (Brannoc, Isolde) and graded against the real game; one arena family (no breakable walls, no events)
---

# The full Rust simulator

The user, 2026-11-11, on being shown the [rough Rust model](rust-model.md) and asked whether it was enough or the full
copy of the rules was still wanted: **"then lets make full functionality"**, and later **"make that simulation tool
first"**. This is that: the game's fight rules written again in Rust (`pipeline/rustfull/`), so fights run without a
browser.

**It plays whole fights now, for two heroes.** Brannoc against Isolde in the Frost arena agrees with the real game
number by number (below). Every other hero still needs the [real simulator](simulator.md); quick estimates still come
from the rough model.

## Use it

```
cargo build --release --manifest-path pipeline/rustfull/Cargo.toml
pipeline\rustfull\target\release\rustfull.exe duel Brannoc Isolde --fights 10000 --arena frost --page-fights 225 --out pipeline\rustfull\data\rust-pair-frost.json
python pipeline/rustfull/grade.py pipeline/rustfull/data/pair-frost-big.json pipeline/rustfull/data/rust-pair-frost.json --notes pipeline/rustfull/notes-slice.json --page docs/balance/rust-slice-2026-11-11.html
```

- `duel A B` plays `--fights` fights each way round (the two sides are played by two different computer players) and
  writes them in the record the real simulator keeps with `--keep`. `--trace` writes every cast and hit instead.
  `--threads N` (default: half the processor's threads); `--page-fights N` (default 250; see the icicle below).
- `grade.py` lays a Rust file beside a real one and makes the page. `python pipeline/rustfull/guard.py` says whether
  the game changed under a ported hero.
- It stops with a message, never with a wrong answer, on anything not ported: a hero that is not ported, an arena with
  breakable walls, a spell that dashes, flees, summons or banks.
- Speed: about 300 fights a second on eight threads (the real simulator on eight browsers: 3 to 4).

## How close it is (2026-11-11)

Brannoc against Isolde, Frost arena, events off: 1,800 real fights (`data/pair-frost-big.json`), 20,000 Rust fights.

| | real | Rust |
|---|---:|---:|
| Brannoc as the opponent wins | 84.7% (±2.4) | 85.8% |
| Brannoc as the player's hero wins | 32.1% (±3.1) | 32.5% |
| Isolde as the opponent wins | 67.9% (±3.1) | 67.5% |
| Isolde as the player's hero wins | 15.3% (±2.4) | 14.2% |
| Fight length | 27.8 s, 29.5 s | 27.7 s, 29.5 s |

All four win rates are inside the real run's own noise, and every finer number (for each spell and the basic attack:
casts in 10 s, hits for each cast, damage of a hit, damage a second) is within 3%. Laid frame over frame, a real and a
Rust fight are the same to the centimetre for the first 4 to 9 seconds, until the dice differ. Page:
`docs/balance/rust-slice-2026-11-11.html`.

## What had to be found to get there

The first Rust fights were off by 15 points of win rate on one side. Three things the game does, none of them written
down anywhere, were behind it. The port keeps all three, because the aim is to agree with the game as it is:

1. **Isolde's icicle is timed by two clocks.** `aiHold` (hold the Shatter back while the icicle stands) reads
   `performance.now()`; the recast window reads the round's clock. At the frame both run out they round differently,
   so the hold either lets go one frame early or not. When it does, the CPU casts a Shatter that hits nothing and
   roots her for half a second, after every icicle thrown over open ground. Which way it falls is not chance: it
   follows the size of the page's clock, flipping at each power of two of its milliseconds (never from 2.2 to 4.4
   minutes after the page opened, always from 4.4 to 8.7, never to 17.5, always to 35, ...). So **the real game's
   Isolde plays differently in different stretches of a session**, and the real simulator's numbers for her depend on
   how long a run is. Rust keeps a page clock that runs on from fight to fight (`Carry`); `--page-fights` says how
   many fights a page plays before a fresh one starts (a real run's fights over its browsers). A fix in the game
   would be one line (compare the same clock); it waits on the user.
2. **The opponent flickers.** A pushed opponent stands at `home + offset`. `moveFoe` calls `setHome`, which puts the
   figure at `home` alone until the arena's next frame. So on every frame the opponent walks, whatever looks at it
   afterwards (the autopilot, the player's hits and bolts) sees it without what pushes have added.
3. **The computer players' walking state is never reset** between fights (`opponentAi`, `playerAi`: strafe side and
   timer, closing, the kept route), and the player's side starts the page's first fight strafing the other way.

Also checked and fine: the simulator page already feeds `performance.now()` from the fight's clock, so the recorded
fights do not depend on how fast the computer is.

## How a hero is ported and graded

1. **Export** the game's own numbers: `python pipeline/tools/page-shots.py pipeline/rustfull/export.js pipeline/rustfull/data --json game.json`
   (kits, what a passive fixes without code, each arena's cover). Nothing in the Rust source is typed from a kit.
   Constants that live inside a trait or spell file are mirrored by hand in the hero's Rust file and listed at its top.
2. **Write the hero**: its passive's hooks and its four spells as small timelines (`src/hero/<theme>.rs`), and add it
   to `src/hero/mod.rs`. A spell is the same `time += dt; if !done && t >= T` steps as in the game, stepped first in
   the frame.
3. **Record the yardstick** once: `python pipeline/sim/sim.py duel A B --fights 200 --arena frost --keep --out <name>`,
   copied to `pipeline/rustfull/data/`.
4. **Grade** with `grade.py`. Look first at casts in 10 s, hits for each cast and damage of a hit: they barely swing,
   so a wrong rule shows there long before it shows in a win rate.
5. **When a number is off**, find the rule with the two probes: `probe.js` and `duel --trace` (every cast and hit;
   `trace-compare.py`), then `probe-frames.js` and `frames` (every frame; `frames-compare.py` shows the first frame
   where a real and a Rust fight part). A parting that is not a dice roll is a rule.
6. **Stamp** the game files the port was written from: `python pipeline/rustfull/guard.py --stamp`.

## What is ported

| Part of the game | Where | State |
|---|---|---|
| Cover, walking round it, sight, sweeps (`src/obstacles.ts`) | `geom.rs` | ported, tested |
| Status effects and buffs (`src/effects/status.ts`) | `status.rs` | ported, tested |
| The basic attack and its homing bolt (`src/attacks/`) | `attack.rs`, `fight.rs` | ported, tested |
| Danger zones; a hit lands only inside what was drawn | `zone.rs`, `fight.rs` | ported, tested |
| The computer players' shared rules (`pickSpell`, `steer`, `reachableGoal`, `dodgeBolt`, `guards`) | `ai.rs` | ported, tested |
| The two fighters: walking, the ring, pushes, shields, dashes, taking a hit | `figure.rs` | ported, tested |
| The way round cover (`src/nav.ts`) | `nav.rs` | ported, tested |
| Skillshot bolts: the plain path and piercing (`src/effects/projectile.ts`) | `bolt.rs` | ported, tested; curve, bank, bounce, split, wind walls, doors stop the program |
| The frame's order, each CPU's own part (`ai`, `pilot`, `castSpell`, `castNow`), `resolve`, the passives' engine | `fight.rs` | ported, graded |
| Brannoc (`src/traits/forge.ts`, four spells) | `hero/forge.rs` | ported, graded |
| Isolde (`src/traits/frost.ts`, four spells) | `hero/frost.rs` | ported, graded |
| 38 more heroes (Anka last: her kit may still move) | | to do |
| Summoned units (`summon.ts`), spells that dash, flee, summon; charges; hold-to-charge; resources | | to do, each with the first hero that needs it |
| Breakable walls (the Night Temple) | | to do: 60 lines in `duel.ts` (`blastWalls`) |
| Arena events and closing stages, Last stand, the Raid, two screens | | out for now |

## The fight loop's order

One frame of a simulated fight (1/60 s), in the game's order (`step` in `src/runtime.ts`); `World::step` keeps it:

1. the page's clock moves on (`performance.now()`), then:
2. the spell effects that are playing: hits, moves and bolts are made in here
3. `arena.update`: bolts (each one's hits delivered before the next flies), then the player's hero (statuses, dash,
   shield), then the opponent (dash, push, statuses, shield)
4. `heroMode.update`: the player's hero: cooldowns, its root, its basic attack and its attack bolts
5. `duel.update`: the round clock; the opponent's basic attack; the passives (`heroRt.tick`, `oppRt.tick`,
   `oppRt.victimTick`, `heroRt.victimTick`); the end (the opponent at 0 HP is a win, checked before the player's 0
   HP); then the opponent's CPU (`ai`), then the autopilot (`pilot`)

### What each computer player does on its own

| | The opponent (`ai`) | The autopilot (`pilot`) |
|---|---|---|
| Cooldowns | its own list, counted down in `ai`; the level's factor on each cast | the hero's own (`heroMode.ready`) |
| After a cast | rooted for the latest zone's impact, 2.5 s at most; 0.5 s when the cast drew nothing | the same, but 0.4 s when it drew nothing; and the cast drops a basic attack that was winding up |
| Where a ground spell is aimed | at the hero's feet | at the opponent's feet |
| A targeted spell | no sight check of its own (the pick needs sight) | needs sight at the cast |
| Walking | `moveFoe`: its home walks, pushes ride on top (and see "flickers" above) | `arena.walk` |
| A push | a speed that dies away; 4 when the hit names none | at once, 0.18 m per unit; none when the hit names none |
| A cast of the other side | nothing | folds the opponent's push into where it stands (`arena.context`) |
| Order in a frame | first | second, after the opponent has moved and cast |
| A hit on it is judged | `opponentHit`: inside the zones of that cast, for 4.5 s | `hitPlayer`: inside the zones of that cast |
| Strafe at the page's first fight | starts one way | starts the other way |

## The two sides are not equal (found before the fight loop was written)

In 3,120 real fights, every pairing fought both ways round, seven of 40 heroes differ by side by more than chance
explains (Auriel 50% as the player's side against 10% as the opponent's; Cantor 40 against 5; Hank 64 against 90).
Brannoc and Isolde show it too: Brannoc wins 85% as the opponent and 34% as the player's hero against the same Isolde.
So the port carries both computer players, and a hero should be looked at with both sides. Fixing the opponent CPU's
play of Auriel and Cantor waits on the user.

## The honest size

Measured on the first two heroes: a hero's passive and four spells are 200 to 300 lines of Rust and about an hour to
write once the engine has what the hero needs; finding the three engine quirks above took longer than both heroes.

What the other 38 need, counted from the game's export (`data/game.json`):

| The hero needs | Heroes |
|---|---:|
| nothing the engine lacks by its kit's flags (Kaia, Auriel, Sirix, Cantor, Bram, Professor Puff, Mr. Ledger, Referee Whistler, Madame Cleaver, Barry Cloudsley, The Great Zambini, Anka) | 12 |
| a spell that dashes | 15 |
| summoned units | 7 |
| ammo charges | 7 |
| a spell that flees | 4 |
| a parry | 2 |
| a bank shot | 2 |

The 12 are the next batch; their spells may still ask the engine for something new (a wall a spell raises, a shield,
a heal, a drag), and each new part will bring its own quirks to find. Three helpers at once can port heroes in batches
now that the interface (`hero/mod.rs`) stands; each batch is graded against recorded real fights before it counts.
