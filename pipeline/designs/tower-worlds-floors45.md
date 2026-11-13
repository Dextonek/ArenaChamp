---
title: The Tower's floors as worlds, stage 2b: floors 4 and 5
tags: [tower, build, floors]
updated: 2026-11-13
---

# Stage 2b: The Lightless Deep (4) and The Field of Banners (5)

Built on `tower-worlds` in `C:\VFXTool-worlds`, as data on floor 1's template. Floors 2 and 3 (laws `paths`, `storm`) are built on another
branch; this file is separate from `tower-worlds-build.md`, `tower-worlds-pieces.md` and `docs/architecture/tower-worlds.md` so the merge is
by hand there. Pictures: `docs/tower/worlds/f4-*.jpg`, `f5-*.jpg`, `g2-*.jpg`. Tools: `pipeline/tools/world-shots.py` (a headless browser that
saves pictures of the whole page, HUD and dark layer included; `--profile` keeps localStorage between two runs for the reload test).

## What each floor is made of

New files only, all under `src/tower/world/`:

| File | What |
|---|---|
| `floors/deep.ts`, `floors/banners.ts` | The two `FloorDef`s (people, quests, packs, enemies, caches, waystones, lore, doors, rival, par, shop) |
| `f45/deep-zone.ts`, `f45/banners-zone.ts` | The zones, 48 m radius, in Crystal Cavern's and the Fallen Battlefield's look (slate flagstones and a mine track, pit timber, stalagmites, amethyst; trodden earth, paved rounds, shield sills, wagons, catapults, a palisade, rain). Each exports its places, cover and `SPOTS`, so picture and data cannot drift |
| `f45/zonekit.ts` | `Kit` (dressing merged per material and per 24 m square), cover pieces, a scatter of filler that keeps off paths and places |
| `f45/laws.ts` | `dark` and `sides` in full (see below) |
| `f45/looks.ts` | Enemy looks drawn in code: mite, lurker, golem, Lantern Thief, Pale One; footman, bowman, knight (each crimson and azure), ashen soldier, Banner Bearer, Deserter Knight |
| `f45/carry.ts` | What a carried great shard and a white cloth look like |

**Floor 4:** camp (lamps, fire, two lean-tos, the shard cradle), cart yard (middle), three halls each with a dark great crystal at the back of a
horseshoe of stalagmites, the glow pools, a rock fall across the north with the Prism Mother's door. People: Mabel (keeper), Isolde (giver),
Mr. Ledger (trader), Tempo (race). Enemies: mite (swarm, 34 hp), lurker (75 to 65 hp, fast, hits hard), golem (slow, a bolt), Lantern Thief (elite
of the pools), Pale One (named, patrols). Main quest (7 steps): `carry` a great shard camp to crystal 1, `light` it (stand 2 s), the next shard lies in the
hall just woken, again for crystals 2 and 3, `open` the rock fall. Side: Isolde's lantern (`reach` the shaft, `fell` the thief's pack), the survey lamp
(`hold` 18 s, two mites every 8 s); Mabel's bounty (`fell-named`). 3 caches, 3 waystones, 1 lore stone, doors: lair, trial (west), gate (east).
Rival: a race to the echo well (26 m, 15 m clear of the lurkers' packs).

**Floor 5:** camp with two banner stands, west and east ridges (a standard each), the hill (a drum), the north works (a standard, catapults),
the burned wagons, the siege line (palisade, fallen tower) with the Marshal's gate. People: Cantor (keeper), Sir Whiskers (giver), Madame Cleaver
(trader), Brannoc (a `giver` with no quests, by his door). Each of four pack sites has a crimson (`-r`) and an azure (`-b`) pack of 3. Neutral: the
siege guard (3 ashen soldiers and the Banner Bearer as elite) and the Deserter Knight (named, patrols). Main quest (6 steps): `reach` three
standards, `hold` the hill 60 s (3 ashen every 15 s), `fell` the siege guard, `open` the gate. Side: the white cloth (`carry` wagons to camp),
braziers (`light` two); Cantor's bounty. Rival: Brannoc's duel through a `rival` door.

## The laws and their numbers

**dark** (`laws.ts`): a canvas at 1/4 size under the HUD, dark all over, with soft holes cut in at the screen place of ground circles (an ellipse as
the camera sees it). Holes: the hero 8 m (x1.3 soft edge), 10.8 m while a shard is carried (+35 %); the camp's three lamps, 9 m each; a touched
waystone 5 m; a woken crystal 18 m x 1.15 (a hall, for good, with a faint floor glow and a sprite); a glimmer 2.6 m at a sleeping crystal; a beacon 3.6 m
over the place the main quest asks for (the edge arrow shows only when that place is off the screen). Lurkers: an asleep lurker pack wakes from 15 m
(9 m for any other pack) when the hero stands outside every light. In metres, so a phone and a desktop see the same ground. Measured in a Bram
route: clear radius 8 to 10.8, 4 lurker wake-ups in the dark, 3 halls lit at 250 s.

**sides** (`laws.ts`): a card at the start (and at a stand, if closed) with two buttons; the route bot takes `window.__worldBanner` (0 crimson, 1 azure).
The choice is `run.banner` (kept in the saved run). Taken: that army's four packs are gone; the other army's four hunt (leash 30 m); before the
choice every army pack sleeps. A squad of 4 (3 footmen, a knight: 150 hp, 22 damage every 1.4 s, 3.9 m/s; the knight 1.5 x hp and 1.3 x damage) are
hero-side units: they follow the hero in formation and chase what is awake within 16 m of it; a fallen one is replaced after 18 s; the host musters
again when a zone is rebuilt (door, reload). Cap: hero side at most 5 (cap 6), foe side at most 6, both held in every run (`facts.maxHeroSide`,
`maxFoeSide`). Places: both armies' pennants over their camps until the choice; after it the other army's fly over its packs and turn to the hero's
colour as each is cleared; the standards turn to the hero's colour when taken; the camp stands show the choice.

## The route bot (the stand-in for a person; the final tree)

Heroes: Bram (melee), Lyra and Vesper (ranged), Sefu (staff); two runs each, game time, the autopilot at the balance level, a rival race won by the sprint.
"Falls" counts lives lost (zone, ruler and gate); the gate is a CPU duel the autopilot loses about one time in three or four.

| Floor | Bram | Lyra | Vesper | Sefu |
|---|---|---|---|---|
| 4 | 10:42, 2 falls, gate 3 tries / 9:03, 0 | 8:49, 0 / 10:11, 0 and a floor restart | 11:56, 3 falls, 3 restarts / 15:53, 4 falls, 3 restarts | not cleared in 30 min (3 falls, 2 restarts) / 13:39, 1 fall |
| 5 crimson | 10:09, 0 / 12:24, 2 | 9:45, 1 / 11:45, 3 | not cleared (trial lost twice, ends at 2 % health) x2 | 10:37, 1 / 10:13, 0 |
| 5 azure | 10:56, 1 / 10:32, 1 | 8:56, 0 / 8:48, 0 | not cleared x2 | 13:07, 2 / 9:58, 1 |

Floor 1 on the same tree: Lyra 12:55, 2 falls (both at the gate), four stars minus one. Stars on 4 and 5 are mostly 3 (cleared, no life lost or under the par,
quests); the par is 15 min on 4 and 16 min on 5 (15 and 16 are what the result card says). Where falls happen on 5: all at the gate (Oblivion, level 4): the
zone and the ruler cost the four heroes no life. On 4 they happen in the zone for Vesper and Sefu (the pools' thief with a hold's mites, the lurkers in the dark).
Vesper is the kit the autopilot plays badly (as on floor 1).

## What was tuned

- Floor 4 (twice): mite share 0.017 to 0.013, lurker 0.045 to 0.03 and hp 80 to 65, golem 0.05 to 0.04, thief 0.055 to 0.045, Pale One 0.07 to 0.055 and hp
  650 to 560, the survey lamp's wave from 3 mites to 2, and the survey lamp moved out of the Pale One's patrol. Before this Sefu fell 16 times and Vesper restarted
  12 times.
- Tempo's race: the first goal was in the middle of the lurkers' ground: the dark woke them and the bot lost every race. Now 26 m, 15 m clear, pace 0.45 (a
  straight walk from the card is 9.4 s, the runner 14.5 s).
- Placement faults found by the bot: a cache behind the siege wall (floor 5), a standard that could not be reached within 3 m (reach radius 3.8 now, one rock
  removed), the ruler's door standing behind its own wall (it stands 2.6 m in front now, so the `open` step can be reached).
- Floor 5's gate (Oblivion, level 4) was not touched: it is the stage 1B piece.

## Frame cost (tool page, 1280 x 720, headless, median of three runs of 180 frames; shared machine)

| | step | render | whole | draw calls | triangles |
|---|---|---|---|---|---|
| Floor 1 zone, market pack awake, people | 0.7 to 0.8 ms | 10.4 to 13.4 | 11.3 to 14.1 | 313 | 252,000 |
| Floor 4, hall pack awake, dark layer, people | 0.7 to 0.8 | 9.1 to 10.9 | 10.0 to 11.6 | 275 | 130,000 |
| Floor 5, ridge pack awake, host of 4, rain | 0.7 to 0.8 | 10.2 to 10.7 | 11.1 to 11.6 | 373 to 467 | 148,000 |

The dark layer is a 1/4-size canvas repainted each frame (not measured alone). Not measured on a phone.

## Checks that were run

- `npx tsc --noEmit -p .` and `npm run build` pass (build run at the end). Floor 1 clears (`_worldRoute`, Lyra); `_tower(['Lyra'], 1, { upTo: 2 })` clears floors 1 and 2.
- The game page: the Climb tab shows five tiles (2 and 3 "Still being built"), floor 4 starts from the tile and the Start button. A reload mid-floor 5 continues
  it with the banner kept and the host mustered again. Floor 5's result card shows "The way up is still being built" (off); floor 4's shows "Climb to floor 5".
- Console: no error through any route or picture run (the favicon aside).
- Pictures at 375 x 812 with touch: `f4-375-*`, `f5-375-*` (the page in a narrow window, not a phone).

## Edits to files that existed before this stage

| File | Lines | Why |
|---|---|---|
| `src/tower/world/law.ts` | an import and 3 lines at the top of `buildLaw` | Ask `buildLaw45` (new file) first: floors 4 and 5 get the full `dark` and `sides`; the scratch ones below stay for `_worldVerbs` |
| `src/tower/world/looks.ts` | an import and `lookOf` | Look first in `EXTRA_LOOKS` by the spec's `look` string (the data casts its strings to the closed union) |
| `src/tower/world/floors/index.ts` | 2 lines | Registers floors 4 and 5 |
| `src/tower/world/quests.ts` | `keyMesh(item)`, `keyAt(at, item)` and their calls | A carried thing is drawn by its item (`f45/carry.ts`), else the key; marked TOWER-HOOK |
| `src/tower/world/scenery.ts` | the winch loop (`item === 'key'`) and `ready()` | The winch is drawn only for the key; a won rival door is not enterable again |
| `src/tower/world/world.ts` | the stats label | Shows the carried item's name, not "key" |
| `pipeline/tools/world-tool.js` | 2 lines in `decide` | The bot goes to a rival's door before the ruler; it skips a trial door that has closed |

## TOWER-HOOKs

Carry look (above). The enemy look registry is the same idea (a spec should carry its look). Hero-side allies that follow the hero are walked from the law
(the system walks a unit only toward a victim, and a ranged unit has no `goal`, so the squad is melee only).

## Not done, not verified, or poor

- Nobody has played either floor by hand. The ruler and gate are tuned with the autopilot; Vesper clears floor 4 only after restarts and not floor 5 (the gate is
  never reached with health), Sefu fell 16 times on floor 4 before tuning and 1 to 3 after.
- The enemy looks are first-pass primitives, small from the camera; the lurker is near black and reads in the lit places only. The lean-tos, wagons and
  catapults are boxes. The hall's blue floor glow is strong. Allies' spears are long and cross over the hero. The zones are drawn once for either banner.
- The race runner is seen only while it is in a lit place; the duel's own red damage vignette shows at the screen edges in some pictures.
- A lurker's leap is a fast approach (5.4 m/s) and a pose, the golem's bolt is its shot, the knight's charge is its speed: approximations, no new mechanic.
- The dark's numbers (8 m, 15 m wake) were not tried with a person on a phone. The dark layer is a page canvas (not in the 3D scene), so it does not show in a clip
  filmed from the canvas alone.
- Not measured: frame cost on a phone, floors 4 and 5 in a party, the sigils across floors, the route through a reload inside a piece.
- A trial lost twice closes its door; the bot now skips it (a person sees the door close).
