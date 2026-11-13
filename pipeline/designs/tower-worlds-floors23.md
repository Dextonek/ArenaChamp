---
title: The Tower's floors as worlds, stage 2a: floors 2 and 3
tags: [tower, build, floors]
updated: 2026-11-13
---

# Floors 2 and 3 (The Walking Wood, The Storm Canyon)

Built in `C:\VFXTool-worlds-b` (branch `tower-worlds-pieces`) as data on floor 1's template. Plan: [tower-worlds-build.md](tower-worlds-build.md).
Pictures: `docs/tower/worlds/f2-*.jpg`, `f3-*.jpg` (the game's own camera and HUD, headless Edge; `*-375-*` at 375 px with touch).

## What each floor is made of

| Part | Floor 2, The Walking Wood | Floor 3, The Storm Canyon |
|---|---|---|
| Files | `floors/wood.ts`, `zoneWood.ts` | `floors/canyon.ts`, `zoneCanyon.ts` |
| Look | Glade: dark moss, golden dusk, fireflies, amber lanterns | Canyon: warm stone and sand, turquoise cloth and tile, brass |
| Zone | 48 m ring, 7 places, 11 corridors, tree masses everywhere else; 111 pieces of cover | 48 m ring, a wide wadi with 25 rocks, 9 places and bays, cliffs; 77 pieces |
| People | Bo (keeper), Mortis (side), Silvane (trader), Nyx (rival) | Pip (keeper), Kaia (side), Wick (trader), Vesper (rival) |
| Enemies | hound (fast, 4 a pack), thorn sprite (shoots), moss giant (slow), Stag-Crowned (elite), Hollow Oak (named, patrols), feeding root (does not move, shoots) | raider (strikes), slinger (shoots), dust wraith (only in the storm), Raider Chief (elite), Dune Mother (named, patrols) |
| Main quest | `lead` three wisps to the heart; `fell` the three roots; `open` the Elder Root's door | `carry` water to three wells (three steps); `lead` the caravan; `fell` the gate's guards; `open` the gate |
| Side quests | Spore lamps (`light` x2); the lost spade (`carry`); bounty: Hollow Oak (`fell-named`) | Watch fires (`light` x2); the watchtower (`reach`, `hold` 16 s with waves); bounty: Dune Mother |
| Secrets | 3 caches (in dead-end nooks), 3 waystones, lore stone (2 lines) | the same |
| Doors | lair (chained roots), trial, gate, rival (duel, `piece: 'rival'`) | the same |
| Law | `paths` | `storm` |

Rewordings: the roots are three packs of one (a `named` pack with a one-point patrol divides by zero), taken by one `fell` step; three wisps are three `lead` steps; three wells three `carry` steps.

**How a zone is drawn** (`zoneGen.ts`, shared): the open ground (places as circles, corridors as capsules) is listed; everything else is filled with a few fat pillars ("masses": hex lattice, then a widest-first fill, then plugs for channels deep in the forest), each as big as it can be without touching open ground. Trees and bastions are drawn on them. This keeps the navigator's piece count at 77 to 111 instead of hundreds. Looks are first-pass code drawing for the artist to direct; the arenas' sculpted props are not reused.

## The laws

**Paths (floor 2).** Every 120 s three of six root barriers sink and three rise; warned 8 s before (banner naming the ways, amber pulsing ring and trembling at every barrier that changes); a way that is open shows a green pillar and two green lights, a closed one is a root hedge with thorns. First change at 120 s. Barriers are sealed into the masses (ends 7.6 m out).
- Nobody walled in: when a barrier rises, the hero and every unit within 1.4 m of it are set down 2.0 m beside it (hero) / about 3 m (units). Tried: the hero standing on each of the 6 barriers, in the line and 0.8 m off it: 12 of 12 set down clear, the navigator then had a way to the camp. 4 units placed on one barrier: all moved off (pushed counter 15).
- Static proof (`_worldCheck`, 0.4 m grid, body 0.47): in both states all 40 spots of the floor's data (people, pack homes, patrol points, quest places, lead roads, caches, stones, doors) are reachable; each barrier that is up cuts its corridor (the way round is 58 to 130 m, not a squeeze).
- Navigator rebuild on a change: 1.6 to 9 ms for the swap and one route (33 ms once with four browsers running); the first plan after a change across the 111 pieces costs a median 3 ms, worst 94 ms (once, then kept until the next change).
- Cap: most live units within one pack's show radius: 5.

**Storm (floor 3).** Every 90 s a band 20 m deep crosses from the north rim to the south, 40 s long (2.9 m/s), warned 8 s before (banner, a sand wall seen on the north rim). Inside it a sand layer closes in to about 5 steps of clear view and the hero loses 4 % of max health a second (21 of 520), unless a piece of cover stands within 7 m to its north (the wind blows south): the lee. 2 dust wraiths come out of the band every 4 s while it is over the hero (at most 4); they dissolve when it has passed.
- Measured (`storm.js`, Lyra): in the open 7.0 s in the band, 147 hp lost (28 %), 257 (49 %) with wraiths on it; in the lee of a rock 0 lost over the same 7.0 s (414 burn ticks, all sheltered). Warning text from 8 s before.
- The status line never sets `active` (that lights the HUD's blue flood tint, the tide's).

## The route bot

`_worldRoute`, game seconds, all with the stub starter for the pieces. All four stars, no falls, no error, in every run:

| Floor | Hero | Seconds | Health left | Falls |
|---|---|---|---|---|
| 2 | Lyra (ranged) | 381 | 89 % | 0 |
| 2 | Bram (melee) | 398 | 87 % | 0 |
| 2 | Isolde (staff) | 560 | 95 % | 0 (one 45 s "still" while she shot the roots from range) |
| 2 | Lyra, paths pinned in state 0 / state 1 | 438 / 431 | 92 % / 89 % | 0 |
| 3 | Lyra | 758 | 97 % | 0 |
| 3 | Bram | 774 | 67 % | 0 |
| 3 | Isolde | 757 | 63 % | 0 |

An earlier tree had Isolde lose all three lives on floor 3 (the waystones stood by enemies and the hero stood up beside them); the waystones were moved at least 11 m from every pack. Reload mid-floor: floor 2 stopped at 150 s, floor 3 at 330 s, page reloaded, `_worldRoute({resume:true})` continued from the save (quests, caches, waystones, shards, cleared packs kept) and cleared both; only `tower.world.*` keys written. Floor 1 still plays (Lyra 603 s, Bram 442 s, four stars); the weekly Tower starts (`_tower(['Lyra'],1,{upTo:2})`, no error); `_worldVerbs`: all verbs and laws pass. No console error through any route (the favicon 404 aside).

Real pieces (`_pieceRun`, Lyra, one try each, from this checkout): floor 2 ruler won (22 % left), gate lost, trial won, rival won; floor 3 ruler lost, gate won, trial won, rival won. All ran, no error.

## Frame cost (tool page in the Browser pane, median of three runs of 240 frames, the machine shared)

| Zone | ms (step + render) | Calls | Triangles |
|---|---|---|---|
| Floor 1 | 10.6 | 220 | 250 000 |
| Floor 2 | 11.1 | 230 | 160 000 |
| Floor 3 | 10.1 | 190 | 189 000 |

Differences are inside the noise (a first run reads 2 ms lower). Not measured on a phone.

## New optional fields and general pieces (and why)

- `EnemySpec.look` is a string now (looks are registered in `looksWild.ts`; `looks.ts` falls back to it).
- `Step 'lead'`: `look` (`wisp`, `cart`), `speed`. `Step 'carry'`: `look` (`key`, `jar`, `bundle`), `plain` (no winch drawn at `to`).
- `LawDef 'paths'`: `warn`, `first`, wall `name`. `LawDef 'storm'`: `shelter`, `sight`, `wraiths`.
- `law.ts`: `storm` and `paths` rewritten (band from the rim, lee test, sight layer, wraiths; warning, look, push-out); `lawOf` registry.
- `people.ts`: a duel rival has no Race button, glyph, lines; people are hidden until their model loads. `scenery.ts`: a rival arch is quiet after the duel; no winch for `plain`. `quests.ts`: the jar and bundle looks.
- `zone.ts`: `Kit` exported. `world-tool.js`: `_worldCheck`, `pin`, the storm lee and duel-rival branches of the bot.

## TOWER-HOOKs

No new `TOWER-HOOK` in code. Carried: the HUD's stat line says "key" for any carried thing (`world.ts`, not edited); the escort and the carried thing count against the hero-side and carry rules unchanged.

## Not done, not verified, looks poor

- The caravan is not sheltered by any rule (it walks while the hero is within 11 m and is burned like the hero's units); no route lost it, but a storm on a slow hero was not tried on purpose.
- Doors call the stub starter: the real ruler, gate, rival were fought only by `_pieceRun`, not through the doors.
- Both floors are easy for the bot; nothing tuned. Floor 2 takes 6 to 9 minutes, floor 3 12 to 13 (par 14 / 15).
- Looks: tree masses and cliff stacks are plain blobs; the sprite and wisp are small; wraiths are hard to see until close (the haze is their colour); people marks show through the storm layer; the Stag-Crowned and the Raider Chief were seen only asleep.
- Pictures are taken with software GL; the 375 px shots are a narrow headless window with touch, not a phone. The Hollow Oak and Dune Mother patrol through hedges and cliffs' open ground only by design (set by clock, not walking).
- At rim places (the bridge, the west well) a cliff mass in front of the camera can hide the hero.
- A first plan across floor 2 can cost up to 94 ms (a hitch, once per change of the paths).
