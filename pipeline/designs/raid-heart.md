---
title: The Heart of Noon, the Raid's third boss
tags: [raid, boss, design]
updated: 2026-11-11
---

# The Heart of Noon

Asked for (user, 2026-11-11, "evolve the raid", option C of `pipeline/designs/raid-next.html`): a third boss, so a tier ends in a
place of its own instead of only looping. **The look is shown first and waits for the user's nod** (the lesson of the arenas):
`docs/bosses/heart_sheet.jpg`, built by `build_heart()` in `blender/bosses/boss_bodies.py`.

## What it is

The fallen sun itself, under the hall. The Warden keeps the court above it, Ash and Ember the pit beside it; the Heart is what both
of them guard. A molten heart in a cracked crust of basalt plates, a calm gold face set in the front of it (looking a little up, to
the camera), a broken armillary of three gold rings round it, a crown of rays behind it (most of them snapped), and two great sun
blades floating beside it for hands. About 6.4 m high; 8,846 triangles.

| Part | What the game does with it |
|---|---|
| `core` | The heart and its crust. Seams brighten each phase; plates fall away in the last |
| `mask` | The face. Its eyes flare before its gaze; it tilts to whom it looks at |
| `ringA`, `ringB`, `ringC` | Turn slowly round it; in the second phase they come down as beams over the floor |
| `crown` | Turns a little; flares with Solar Flare |
| `bladeL`, `bladeR` | Its hands: they sweep and fall, as the Warden's fists do |
| `shards` | Float round its foot |

## The fight (as designed; built 2026-11-11, below)

The room: the Sunken Heart, round, radius 12, a floor of cooled gold crust with molten rivers in its cracks. Its gate stands at the
north centre of the hall, behind the broken ray, between the two others (the hall's west and east edges stay free for side doors). A
run becomes Warden, Ash and Ember, then the Heart; beat it and the tier is cleared.

| Phase | Its moves | What players do |
|---|---|---|
| Embers Wake (100 to 66 %) | Blade Sweep (an arc in front), Blade Fall (two lines on a hero), Solar Flare (rings of fire running out from it, each with a gap to walk through) | Walk through the gaps |
| The Rings Turn (66 to 33 %) | The three rings come down as beams that turn over the floor | **Lock a ring:** three gold spots on the rim; hold one 2 s and that ring stops for 8 s; +40 on the gauge |
| Noon Falls (33 to 0 %) | All of them, and Heartbeat: every 20 s a pulse over the whole floor | **Shade the heart:** crust plates fall as gold spots; hold one 3 s and it stands up as cover; only cover between you and the heart saves you from Heartbeat |

Every mechanic works alone and for two. The rules of `docs/architecture/raid.md` hold: a move never reads a hero's position, each
step is its own cast, each screen decides the hits on its own hero.

## What was built (2026-11-11)

The look was agreed; the fight is in. How it works now: [docs/architecture/raid.md](../../docs/architecture/raid.md), "The Heart of
Noon". Pictures from the game's camera: `docs/bosses/heart-fight-room.jpg`, `-flare`, `-rings`, `-plates`, `-blades`, `-phone`, and the
hall's new gate `docs/bosses/heart-hall-gate.jpg`.

| Piece | Where |
|---|---|
| The boss: numbers, phases, moves | `src/raid/heart.ts`; numbers the hub keeps in `RAID_BOSSES.heart`, its reward in `RAID_REWARDS.heart` (`server/protocol.mjs`) |
| Its body, posed in code | `src/raid/bodies/heart.ts` (`heartLook`, `HEART_LIVE`) on `public/models/bosses/heart.glb` |
| Its room | `src/arenas/sunkenHeart.ts` |
| The run, the hall's gate | `RAID_RUN = ['sun', 'ash', 'heart']`, `PROTOCOL` 7; `HALL_GATES.heart` (`src/arenas/noonfall.ts`), the hall draws a gate for each boss of the run |
| Its check | `_raidHeart()` in `pipeline/tools/raid-check.js`: 38 rows |

**Numbers.** Alone 3,300 HP, for two 7,100; phases at 66 % and 33 %; gauge 100, kneel 6 s; enrage 2:45. Blade Sweep 18 % (6.8 m,
130°, within 8.5 m), Blade Fall 15 % a line, Solar Flare 12 % a ring, a beam 10 % a second, the Heartbeat 40 % every 20 s, the Crown of
Rays 15 %. Tier extras: the Crown of Rays, then the rings, then the Heartbeat, from the first phase on.

**Changed from the design while building:**
- **Solar Flare's gaps.** Each gap somewhere else could not be reached: from the far side half the room lies between you and it before
  the first ring arrives. Now each ring has two gold gaps opposite each other, the first 20 to 45° to one side of the hero it aims at
  (the brain's aim), each pair 12 to 20° on from the last: two lanes that drift.
- **A fourth move, the Crown of Rays,** for the last phase and the tiers: four rays, then the four between them.
- **A lock puts its beam out** for 8 s and warns 0.8 s before it burns again, rather than holding the beam still: two screens hear
  the lock a moment apart, and a beam's angle stays a pure function of the time since its cast.
- **The plates fall as part of the Heartbeat's look,** not off the model: the crust is one mesh. A raised plate is cover on both
  screens (`addStone`) until the same moment after the cast.
- **The gold of the face, crown, rings and blades is less polished in the game** (roughness 0.58, set in code): under the game's sun the
  face, tilted up to the camera, bloomed white. Its glow is kept low as the other bosses' are. The Blender file is unchanged.
- **Its room's gates stand out in the lava** (`BossDef.gates.r`, 16.2 m): at the edge of so small a floor the way in stood over the
  bottom of the screen.

**Measured** (the autopilot alone, tier 1, `pipeline/tools/raid-tool.js`, the same ten heroes, 4 fights each, 2026-11-11): the Heart
14 of 40 (35 %, 98 s a fight on average), Ash and Ember 11 of 40 (28 %). An earlier run of 2 each: the Warden 10 of 20, Ash and Ember
4 of 20. Inside the noise of 40 fights, so the HP was left at Ash and Ember's. What hit the autopilot most at the Heart: the beams (114
hits in 40 fights), Solar Flare (85), Blade Sweep (36); what killed it: the Heartbeat (9), the beams (8), Blade Sweep (5). The
autopilot finds a flare's lane but drifts out of its edge as it goes back to fighting, so Solar Flare costs it more than it should
cost a person. No errors.

**Not done:** a raid for two in two tabs (`_raidHeart()` checks a partner's lock and plate on this screen); a person playing it; a real
phone. The artist has not yet directed the room (first pass, drawn in code).

