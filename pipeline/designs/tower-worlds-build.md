---
title: The Tower's floors as worlds, the build plan
tags: [tower, build, plan]
updated: 2026-11-13
---

# Floors as worlds: the build plan

The design the user agreed: [tower-worlds.md](tower-worlds.md). This file is how it gets built, stage by stage; each
stage's builder fills in what it found and what it built, so the next one starts from here.

## Where and how

- **Its own checkout:** `C:\VFXTool-worlds`, branch `tower-worlds` (a git worktree of `C:\VFXTool`). Dev server:
  `npx vite --port 5194 --strictPort` there (tool page `/`, game `/game`). The main checkout belongs to a performance
  session that is the one writer on the engine files (`src/heroMode.ts`, `src/arena.ts`, `src/duel.ts`, `src/main.ts`,
  `src/runtime.ts`) and is measuring frame times: keep this build's browser load short, and never touch `C:\VFXTool`.
- **New files only, under `src/tower/world/`** (and data per floor under `src/tower/world/floors/`), as the first
  Tower was built without changing the Raid. What the engine lacks is done from the Tower's side and marked
  `TOWER-HOOK` with a row in this file (what is needed, what is done instead). The one engine file that must change is
  `src/game/main.ts` (a menu entry and a screen): keep that edit small and in one place, and say so in the report.
- **The weekly Tower of today stays working and untouched:** its own save keys (`tower.save`, `tower.best`) and its
  weekly board are not written. The worlds use their own keys (`tower.world.*`).
- **Rules:** `CLAUDE.md`. Stage by explicit path, commit on `tower-worlds`, never push, never deploy. No helper agents
  of your own. Every wait ends within 10 minutes; never kill a process by name; stop the dev server you started.

## The shape (the advisor's and the plan's, to be confirmed by stage 0)

- **A floor is one walking fight for the zone** (as Noonfall's hall and a Tower landing are fights with no boss), and
  **each set piece is a fight of its own behind a door:** the ruler, the trial room, the rival's duel, the
  gatekeeper's duel. Leaving a set piece rebuilds the zone from the run object.
- **The run object keeps everything:** the floor, which packs are cleared, quest steps, caches found, waystones
  touched, lives, shards, boons, the rival's outcome. Saved in the browser.
- **Floors are data.** A closed list of quest verbs and law pieces, built once; floors 2 to 5 are tables on it. What a
  floor in the design asks for that the list does not have is reworded to fit, and the design file is corrected.
- **A route bot** plays a floor from its data (every quest step, door, ruler and gate) so a floor can be checked
  without a person; pictures and a clip of each part go to the user.

## Stages

| # | Stage | State |
|---|---|---|
| 0 | **Spike:** one walking-only zone of about 50 m radius with packs that appear near the hero. Measure frame time, path finding and the edge of the ring at that size. Answer the open questions below. Close the vocabulary | not started |
| 1 | **The world system and floor 1,** the whole loop, with the route bot, pictures and a clip | not started |
| 2 | **Floors 2 to 5** as data | not started |
| 3 | **All five checked,** docs (`docs/architecture/tower-worlds.md`), News, merge into `feat/particle-editor` | not started |

## Open questions for stage 0

1. Does a zone of 50 m radius hold its frame rate with the harbour's look, and what does it cost against an arena?
   If it does not: a floor becomes five or six arena-sized places joined by doors, and this plan says so.
2. How does the arena clamp a hero at its edge, find paths, and place cover at that size (see how the 40-player hall
   and Noonfall's hall set their size)?
3. Can a fall be handled inside the zone's fight without ending it (the weekly Tower restarts the floor's fight)?
4. Do the Tower's boons (`TowerBoons`, a `RunUpgrades`) apply in a real CPU duel (`Duel.start`), which the
   gatekeeper and the rival are, or only on the boss path?
5. Can a unit of the summon system stand still until the hero is near, then wake its pack, and go home when the
   hero leaves? What must be added from the Tower's side?
6. Can a hero's ally (the rival, after being beaten) be a summoned unit on the hero's side in the ruler's fight?

## The vocabulary (stage 0 closes it; these are the candidates)

- **Quest verbs:** `reach` a place; `fell` a pack or a number of a kind; `carry` a thing from A to B (the hero walks
  slower, drops it on a hit); `light` N things by standing at each; `hold` a place for T seconds while waves come;
  `fell-named`; `open` a door.
- **Law pieces:** a timed hazard over marked ground (`tide`: flood the low ground; `storm`: a wall that crosses, with
  shelter behind cover); `dark` (the Lightless twist, and lights that push it back); `paths` (cover that rises to
  close one way and sinks to open another on a clock); `sides` (which kinds are hostile).
- **Ruler moves:** the Tower's and the Raid's: `stones`, `sweep`, `spokes`, `halves`, `tide`, `stand`, `volley`, `call`,
  `cleave`, `lunge`, `fan`, a still boss with a clock and sentries (the crystal), wards that fall with keepers.

## What each stage found and built

(filled in by the builders)
