# The Climb's beasts as models

The user, 2026-11-19: "lets make more models even for the tower", then, shown the bark hound: "Yes, do them all".

The Climb's people, enemy fighters and rulers were already models (docs/tower/models/README.md). Its beasts, spirits and the ones a
quest leads were still drawn in code from a few cones and cylinders. Now each is a model of its own:

| Key | Who | Where | Builder | Pose |
|---|---|---|---|---|
| `hound` | Bark hound | the Walking Wood | `blender/tower/beasts/hound.py` | `src/tower/world/beasts/hound.ts` |
| `crab` | Brine crab | the Drowned Coast | `crab.py` | `crab.ts` |
| `mite` | Shard mite | the Lightless Deep | `mite.py` | `mite.ts` |
| `golem` | Crystal golem | the Lightless Deep | `golem.py` | `golem.ts` |
| `root` | Feeding root | the Walking Wood | `root.py` | `root.ts` |
| `stag` | The Stag-Crowned | the Walking Wood | `stag.py` | `stag.ts` |
| `wraith` | Dust wraith | the Sands | `wraith.py` | `wraith.ts` |
| `wisp` | Wisp (led) | the Walking Wood | `wisp.py` | `wisp.ts` |
| `cart` | Caravan cart (led) | the Sands | `cart.py` | `cart.ts` |

## How they are made

- **The model**: built by script with the Raid bosses' toolkit (`blender/bosses/boss_bodies.py` and the wyrm's helpers in
  `boss_wyrm.py`): rigid parts in a named hierarchy, no skeleton, every part's origin the point it turns about, flat facets, a few
  materials. Built at the code look's size (the game draws it at the unit's scale).
  `blender --background --factory-startup --python blender/tower/beasts/run.py -- <key>` builds it, exports
  `public/models/tower/beasts/<key>.glb` and renders it from four sides beside Sefu (`docs/tower/beasts/<key>_sheet.jpg`, the four
  renders put on one sheet).
- **In the game** (`src/tower/world/beasts/`): `beastLook` makes a `MinionLook` from a model and a pose, so the packs, the tactics and
  the other players' copies are unchanged. The code look is built in any case (it draws on the game's random numbers, which the perf
  scenes and the route bot replay) and stands in until the file lands. Each unit clones the model with materials of its own; the hit
  flash follows the arena's palette. `all.ts` lists them by look (`BEASTS`), `lookOf` (looks.ts) and `escortModelLook` (quests.ts)
  pick them, `prewarm.ts` loads a floor's files when its fight begins. `globalThis.__codeFoes = true` before a floor draws them in
  code again (the A/B).
- **The pose**: one file a beast, through the bosses' `BodyParts` (`src/raid/bodies/look.ts`): every part starts each frame at rest;
  the pose turns and moves parts from the unit's walk (`gait`, `stride`: the legs keep pace with how fast it goes), its blow
  (`pose.swing`, through `blow`) and its shot (`pose.shot`, `sinceShot`).
- **The check**: `pipeline/tools/beast-sheet.js` (run headless with `page-shots.py`) shows each in the game's own code beside Sefu,
  from the game's camera and the side: the code look it replaces, idle, walk, the blow or the shot, with the model's lowest point each
  frame (it must not go under the ground).
