---
title: The Tower, a new game mode
tags: [tower, mode, design]
updated: 2026-11-12
---

# The Tower

## What the user asked (2026-11-12)

> "i want to make like tower idea waht do you think ?"
> "but do new like gameplay like new gamedoed tower letf raid untoch"

A new game mode beside duels and the Raid, with gameplay of its own. **The Raid stays untouched.** Shown as a page
(`pipeline/designs/tower.html`) and agreed: "Yes, build it"; **alone first** (one player, offline, no account needed; friends
later); **the same Tower each week** for everyone (a new one every Monday), so highest floors compare fairly.

## The mode

- **A run:** floor, boon, floor, boon... Each floor is one short room, 30 to 90 seconds. Clear it and the stairs open; walk onto
  them. Every 10th floor is a guardian. How high can you climb?
- **Health carries over.** It does not refill between floors (the Raid refills at each fight). Three lives a run: a fall costs one
  and puts you back at that floor's start with some health.
- **Six kinds of floor:**

| Kind | What you do |
|---|---|
| Gauntlet | No enemy. Cross a room of sweeping fire and falling stones to reach the stairs |
| Horde | Waves of small enemies pour in from the doors. Clear them all |
| Duel | A hero of the roster guards the stairs, played by the computer, with one twist (twice as big, or two of them) |
| Break it | A crystal seals the stairs. Break it before the timer ends while turrets shoot at you |
| Hold out | The stairs open in 45 seconds. Stay alive while the room turns against you |
| Guardian (every 10th) | A giant version of a hero with boss health and new attacks. Beating it saves your progress |

- **Boons, not raid upgrades:** after each floor one of three: a heal, a new power, or a relic that changes a spell. The Tower has
  its own set.
- **It gets stranger as you climb:** from floor 11 floors mix two kinds, and rooms get twists.
- **One number:** your highest floor this week, on a board (in this browser first; a shared board comes with the accounts work).
- **The week's Tower:** the floors, their order and the boons offered come from the week's seed (the ISO week), the same for everyone.

## How it is built (first version)

All new code in `src/tower/` and its own rooms; the Raid's files are not changed (the Tower may import the Raid's engine: a floor is
a fight on the duel's boss path, `Duel.startBoss`, as the Raid's hall is). No server work in the first version.
