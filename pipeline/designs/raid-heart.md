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

## The fight (to build once the look is agreed)

The room: the Sunken Heart, round, radius 12, a floor of cooled gold crust with molten rivers in its cracks. Its gate stands south
of the hall's wheel, between the two others. A run becomes Warden, Ash and Ember, then the Heart; beat it and the tier is cleared.

| Phase | Its moves | What players do |
|---|---|---|
| Embers Wake (100 to 66 %) | Blade Sweep (an arc in front), Blade Fall (two lines on a hero), Solar Flare (rings of fire running out from it, each with a gap to walk through) | Walk through the gaps |
| The Rings Turn (66 to 33 %) | The three rings come down as beams that turn over the floor | **Lock a ring:** three gold spots on the rim; hold one 2 s and that ring stops for 8 s; +40 on the gauge |
| Noon Falls (33 to 0 %) | All of them, and Heartbeat: every 20 s a pulse over the whole floor | **Shade the heart:** crust plates fall as gold spots; hold one 3 s and it stands up as cover; only cover between you and the heart saves you from Heartbeat |

Every mechanic works alone and for two. The rules of `docs/architecture/raid.md` hold: a move never reads a hero's position, each
step is its own cast, each screen decides the hits on its own hero.
