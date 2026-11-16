# The arenas' props and backdrops, and the weapons

Checked 2026-11-16.

## The arenas in the heroes' style (7 files)

The duel arenas harbour, battlefield, canyon, cavern and the Raid's rooms sunburst (the Heart of Noon), sunhall (the Sun Warden's
hall), twinforge (Ash and Ember): every prop laid against the obstacle it stands for (`pipeline/tools/arena-fit.js`; the layout's
own rules are `pipeline/tools/arena-check.mjs`, which "cannot see the meshes"). A hero is kept 0.5 m from an obstacle's capsule
(`pushOut`), so a mesh that reaches up to about 0.3 m past it is never touched; past 0.5 m a hero stands in it. All props stand on the
floor (lowest points 0 to -0.56 m: bases sunk on purpose).

| Arena | Props | Fits | Found |
|---|---|---|---|
| Harbour | 9 | 7 | the two cannons reach 0.65 m past their walls at one end (a hero's feet go into the gun's end) |
| Battlefield | 9 | 9 | |
| Canyon | 9 | 9 | |
| Cavern | 9 | 9 | |
| Sunburst (the Heart's room) | 8 (39 fixed walls drawn by the room) | 4 | four low walls 0.41 m past their ends: touched, not entered |
| Sunhall (the Warden's hall) | 93 (45 fixed walls drawn by the hall) | 67 | pillar bases 0.4 to 0.48 m past their radius (touched); short walls stop a hero 0.4 to 0.5 m before their ends (the capsule's round end) |
| Twinforge (Ash and Ember's forge) | 2 (12 fixed walls drawn by the room) | 1 | **Ash's great anvil reaches 1.27 m past its round cover on the east and stops 0.54 m short of it north and south**: a hero walks into the anvil's horn, and is stopped a metre from its long side |

The older duel arenas (temple, frost, caldera, glade, skyruins) build their props onto the obstacles in code (`*_props.glb`
instanced per obstacle), so they fit by construction; their backdrops stand outside the ring.

## For the Blender round (the obstacles are gameplay and stay; the meshes move)

- **Twinforge, the great anvil** (`blender/arenas/real/twinforge.py`, line 302): `A.put("great_anvil", HOLD[0][0] - 0.6, Z(-HN + 4.2),
  yaw=0.0, scale=0.9)`: centred on its 1.75 m cover and a little smaller, the horn and heel then reach about 0.3 m past it on both
  ends. Then rebuild and check with `pipeline/tools/arena-fit.js` (cover0 `over` under 0.35).
- **Harbour, the two cannons** (`blender/arenas/real/harbour.py`, `cannons()`): the gun is 3.2 m long on a 2.7 m wall; at
  `scale=S * 0.9` instead of `S * 1.05` it fits (or move it 0.3 m along the wall toward its short end). Rebuild, check cover5 and cover6.

## The weapons (5 files)

`public/models/weapons/` (the dragon sword, the ice sword, the guandao, the thunder hammer, the phoenix fan) are used only by the
VFX tool's weapon effects (`src/spells/weapons/`, the attach points in `src/effects/weapons/sockets.ts`); no hero in the game holds one
(the heroes' weapons are part of their own models). Not reviewed in the game for that reason.
