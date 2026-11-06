# Duel arenas

Every duel (the AI duel and the network duel) is fought in one of five arenas, picked at random each round. An
arena is a cover layout, a set of meshes and a stage (sky, fog, lights) around the same ring. The design sheet with
each arena's look and layout is [pipeline/designs/arenas.md](../../pipeline/designs/arenas.md).

![The five arenas, overview and close](../arenas/arenas-five_sheet.jpg)

From the two gameplay cameras (a network player on side 1 looks from the other end):

![The five arenas from the gameplay cameras](../arenas/arenas-gameplay_sheet.jpg)

| Id | Name | Cover | Look |
|---|---|---|---|
| `temple` | Night Temple | a low sun altar in the middle, four angled screen walls round it, six side columns (`TEMPLE_OBSTACLES`) | moonlit temple court: engraved floor with a sun-wheel, stepped gold-lined curb, four braziers, sculpted fluted columns, carved screen walls and the altar (props from `blender/arenas/temple_props.py`); sculpted, painted backdrop from `blender/arenas/temple_backdrop.py` (`temple_backdrop.glb`): two grand ruined gates on stepped platforms (one pylon snapped, broken lintel with a gold sun disc, ruined side walls), colonnade arcs of whole and broken columns with architraves, hooded guardian statues on the sides, obelisks and banner poles flanking the gates, stair fragments, fallen drums and rubble heaps (placements merged per material, the rubble instanced; every vertex checked against the camera rule); one instanced banner cloth rippling in the wind, pale moon sprite, incense motes |
| `frost` | Frostfall Lake | a low frozen boulder in the middle, two long snow drifts guarding the starts, two short drifts in the far corners, four ice spires (two flanking the middle, two taller on the wings) (`FROST_OBSTACLES`) | two-layer frozen lake (cracks, bubbles, frozen fish), sculpted chiselled rock, wind-carved drifts with rocks and ice shards, faceted ice-crystal spires (props from `blender/arenas/frost_props.py`), a backdrop of broken shore ice plates and pressure ridges, snow-capped boulders and rocks, scrub pines, frozen dead trees, a snow-laden pine forest and far chiselled peaks (`blender/arenas/frost_backdrop.py`, tall props only beyond 26 m or at \|x\| > 12, checked per vertex), a dimmed sculpted snowfield, a mountain silhouette, faint aurora, snow and ground mist |
| `caldera` | Ember Caldera | an open middle (the lava vent), two low obsidian ridges flanking the middle lane, two tall basalt column clusters and two low clusters of snapped stumps off the z axis, two tall bladed obsidian ridges on the wings (`CALDERA_OBSTACLES`) | hex basalt with glowing cracks and cooled lava flows, glossy faceted obsidian ridges and chiselled hexagonal basalt columns with joints and worn tops, on cooled lava crust with small glowing cracks (props from `blender/arenas/caldera_props.py`); outside: a sculpted jagged obsidian lip round the ring, basalt prism clusters, cooled-lava boulders and small vents on the apron, lava-crusted spires in the lava lake (with bubbles), big vents under the smoke columns, a chiselled crater wall of basalt segments with thin lava falls (props from `blender/arenas/caldera_backdrop.py`), embers and ash |
| `glade` | Verdant Glade | a great fallen log across the middle (low), two broken giant stumps off its ends, two carved rune stones off the starts, two giant mushroom clusters beside the middle, two fallen trunks with upturned root plates on the wings (`GLADE_OBSTACLES`) | moss floor with grass, flowers and small mushrooms; sculpted, painted cover (grooved bark with roots and splintered breaks, chiselled stones with faint carved runes, moss draped on top surfaces) and backdrop (mossy rim stones, ferns, rocks, bushes, tall trees and dead snags) from `blender/arenas/glade_props.py` (`glade_props.glb`, `glade_backdrop.glb`, merged into one mesh per material); far forest wall and canopy, god rays, fireflies and falling leaves |
| `skyruins` | Sky Ruins | two low broken drum stacks flanking the middle on the cross axis, two low balustrade fragments off the starts, two tall intact columns and two tall broken columns off the z axis, two broken arch bases on the wings (`SKYRUINS_OBSTACLES`) | floating slate-marble platform with a gold compass-rose inlay and worn tiles; sculpted, painted cover (fluted marble drums with chipped rims, capitals with volutes, pale fresh-marble breaks with shards, gold neckings and imposts, ivy vines with leaves spiralling up the shafts) and backdrop (broken edge balustrade, slate edge blocks, two toppled columns, rocks hanging under the edge, floating rocky islands with a ring of columns, a temple and a great broken column, the big broken arch on its islet, loose floating rocks) from `blender/arenas/skyruins_props.py` (`skyruins_props.glb`, `skyruins_backdrop.glb`; unique placements merged into one mesh per material, the edge pieces instanced); sea of clouds, cloud puffs, birds |

## Code

- [src/arenas/types.ts](../../src/arenas/types.ts): `ArenaDef` (`id`, `name`, `obstacles`, `stage`, `hideGround?`,
  `build()`), `ArenaScene` (`group`, `update?`, `dispose?`) and `ArenaStage` (sky dome colours and stars, fog
  colour and range, hemisphere, sun and rim light colours and intensities).
- [src/arenas/index.ts](../../src/arenas/index.ts): `ARENAS` (fixed order), `arenaById`, `pickArena(seed?)`.
- One file per arena (`temple.ts`, `frost.ts`, `caldera.ts`, `glade.ts`, `skyruins.ts`); shared helpers in
  [common.ts](../../src/arenas/common.ts) (`RING`, `DEFAULT_STAGE`, `flatRing`, `floorDisc`, `canvasTexture`,
  `seeded`, `shadowed`, `disposeTree`). Collision capsules use `pillar` / `wall` from
  [obstacles.ts](../../src/obstacles.ts).

## How a duel uses it

- `Duel.start()` (AI duel) picks `arenaById(duel.arenaChoice)`, or a random arena when `arenaChoice` is `'random'`
  (the default), and shows the arena's name as a banner in play mode.
- `Duel.startNet()` takes `arena` (the match id from `match_start`, passed by [match.ts](../../src/game/match.ts))
  and picks with `pickArena(seed)`: a hash of the id, so both players get the same arena with no server change.
  The arena name shows in the "Waiting for opponent" banner.
- `Duel.setup()` calls `useArena(def)`: it builds the arena's meshes (freeing the previous arena's), sets
  `arena.obstacles = def.obstacles`, calls `host.setStage(def.stage)` and hides the slab floor for `hideGround`
  arenas (`arena.showGround`). `Duel.update` drives `ArenaScene.update` (snow, embers, fireflies, clouds).
  `Duel.stop()` puts back the default stage and the floor.
- runtime.ts `setStage` changes the sky dome uniforms, `scene.background`, the fog colour and range and the three
  lights in place (the cinematic camera toggles the same objects by reference).

The ring itself never changes: centre (0, 7), radius 12, starts at (0, 13) and (0, 1). `arena.bounds`, the AI,
the hero-mode camera focus and the network position stream all assume it.

## Arenas that change (stages)

As a round runs long the arena gets worse in steps (`ArenaDef.shift`, [src/arenas/shifts/](../../src/arenas/shifts/base.ts),
the table in `shifts/tables.ts`). A stage is announced by a banner and shows its zones for 3 s before they count. Its
zones stay until the next stage's land, and hazards keep running on top.

| Stage | Starts at (fight clock) | Share of max HP per 0.8 s in a zone |
|---|---|---|
| 1 | 35 s | 1.5 % |
| 2 | 60 s | 2 % |
| 3 | 85 s | 3 % |
| Last stand | 105 s | the whole floor: 3 %, then 1 % more each 5 s, at most 7 % |

| Arena | Banner | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|---|
| Night Temple | The temple falls | (cover) | (cover) | Sunfire outside 6 m |
| Frostfall Lake | The ice breaks | Two water channels: slow, no damage | Also freezing water outside 9 m, slow | The water outside 6.5 m |
| Ember Caldera | The lava rises | Lava outside 10 m | Outside 8 m and over the vent to 2 m | Outside 6.5 m and over the vent to 2.5 m |
| Verdant Glade | The forest closes in | (cover) | Thorns outside 9 m, slow | Thorns outside 6.5 m |
| Sky Ruins | The platform breaks up | Outside 10 m | Outside 8 m | Outside 6.5 m |

- **Last stand** makes a long round end: without heals a full hero falls about 20 s after it begins. It adds no timer, draw or limit screen.
- **Clock and seed:** `Duel.hazardClock`, the same clock as the arena's events. Frost's channels come from the seed, so both screens match.
- **Hits:** like a hazard's. Each screen decides the hits on what it lists; online the hero's damage goes out as `hazard`. A hit is a share of the target's max HP, so a big hero pays as much of its bar as a small one, capped at the hub's 60. `Duel.hazardHit` lets one through per 0.32 s online, because the hub would drop a second one and the screens would disagree.
- **A person may stand in a zone and pay.** The AI does not: it walks out with nothing rolled (`hazardStep`), drops a trait's goal inside one (`reachableGoal`), plans round them (`Arena.aiRoute`, its own `Navigator`, fed by `ArenaShift.aiCover` and `aiBounds`) and stops at the edge when the other hero is inside (`offZones`). In Last stand it just fights.
- **Switches:** `duel.shiftsOn`. `duel.shiftsInRuns` is off, so balance runs stay comparable. `duel.shiftOffset` is added to the clock the stages read: set it on both screens before the fight to test a stage.

## Arena events (hazards)

Every arena has its own timed event (`ArenaDef.hazard`, [src/arenas/hazards/](../../src/arenas/hazards/base.ts)). The
first comes 8 s into the fight, then one 9-13 s after the last ended. It shows pale zones in its own colour (never the
spells' red) for at least 1.2 s, then hits both heroes and their units alike.

| Arena | Banner | What happens | Hit |
|---|---|---|---|
| Night Temple | The altar wakes | The sun altar fires two opposite rays that sweep a 110° wedge each. Stay out of the wedges, or behind cover: walls and columns stop a ray | 45 |
| Frostfall Lake | The ice splits | Two parallel rifts open, then a wave of ice spikes runs down each from opposite ends | 45, slow 1.5 s |
| Ember Caldera | The vent erupts | The vent in the open middle blows, then throws eight lava bombs in point-symmetric pairs | 45 |
| Verdant Glade | Spores rise | Six pods swell and burst into clouds that hurt while they last (one hit per 0.8 s at most) | 35, slow 1.5 s |
| Sky Ruins | The storm strikes | Two zigzag lines of lightning march across the platform from opposite edges | 45 |

- **Fair:** point-symmetric or centred on (0, 7). No hazard stuns; none hits within the first 8 s.
- **Not spells:** no trait hooks and no credit. A shield soaks a hazard's hit; a passive such as an ice block does not stop it.
- **Clock and seed:** `Duel.hazardClock` runs only while heroes can act (not in the countdown, not after the round).
  Every random choice comes from the seed: the match id and round online, so both screens run the same events. Sparks
  and flicker use `Math.random`, because they only look.
- **Hits:** each screen decides the hits on what it lists in `HazardWorld.targets`: its own hero, the units on that
  screen and, offline, the opponent. Online the hero's damage goes out as `hazard` (see
  [multiplayer.md](multiplayer.md#messages)).
- **AI:** both the CPU and the autopilot walk out (`Duel.hazardStep`, `ArenaHazard.danger`); `CpuLevel.hazardDodge` is the
  chance per event.
- **Switches:** `duel.hazardsOn` (the tool's View → arena hazards). `duel.hazardsInRuns` is off, so AI-vs-AI balance
  runs (`_tourney`, `_ladder`) stay comparable with the numbers in the kit designs.
- **New hazard:** extend `ArenaHazard`, fill `threats` in `begin` (from `rng` only), draw in `tick`, and use `fx.ts`
  (`GlowBeam`, `Sparks`, `FloorGlows`). Anything on the floor needs `renderOrder` ≥ 1: see lessons.md.

## Rules for a new arena

- Point-symmetric cover about (0, 7); starts clear for 3 m; nothing within 1.5 m of the rim; gaps ≥ 2 m; no
  pockets; pillar r ≤ 1.0. Every obstacle mesh covers its capsule.
- Floors in the luminance band of the temple disc (`0x15131a`): ultimates darken the world to 0.55 and the kits'
  dark layers need a dark floor. Emissive details small and under bloom.
- Camera rule: anything taller than 2 m is more than 26 m from the centre or off the z axis (|x| > 12); the
  gameplay camera can sit at either end of the z axis.
- ≤ ~60 draw calls, ≤ 400 particles, no extra lights; `dispose()` frees everything.
- Tools: `vfx.duel.arenaChoice = '<id>'` pins the arena for AI duels and `_tourney` runs; see the sheet render in
  the arena section of `docs/STATUS.md` for the review camera positions.

## Limits

- Both players must run the same client: the arena choice and the hazard schedule need no server, so an old client
  would see different cover and events. The `hazard` message does need the current server.
