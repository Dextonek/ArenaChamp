# The arenas' landmarks

The user, 2026-11-19: "lets make more models for the arenas too and make them special", then, shown the first: "Yes, do the rest".
Each duel arena gets one great living thing of its own, far out past the ring, tied to its realm in the lore. It is only for the eye:
no hit, no cover, nothing the fight reads, so it runs on each screen's own clock.

| Arena | Realm | Landmark | Key |
|---|---|---|---|
| Drowned Harbour | the Drowned Coast | the Harbour Serpent coiled in the bay; its neck rises every 40 s to watch the duel | `serpent` |
| Sandstone Canyon | the Sands | a stone colossus carved in the cliff whose head turns to follow the fight | `colossus` |
| Crystal Cavern | the Deep | a giant geode in the wall that pulses with the sun's last light | `geode` |
| Fallen Battlefield | the Field of Banners | a siege engine far off that winds and hurls stones | `trebuchet` |
| Night Temple | Gloaming | a great bell swinging in its tower | `bell` |
| Frostfall Lake | Frostfall | the Hourkeepers' orrery turning on the shore | `orrery` |
| Ember Caldera | the Deep (the Underforge) | a forge automaton striking sparks from an anvil | `automaton` |
| Verdant Glade | the Walking Wood | a walking tree-giant striding past | `treegiant` |
| Sky Ruins | the Spires | a sky whale gliding round the ruins | `skywhale` |

## How one is made

- **The model**: `blender/arenas/landmarks/<key>.py` with the bosses' toolkit (`blender/bosses/boss_bodies.py`, the helpers in
  `boss_wyrm.py`), rigid parts in a named hierarchy with their pivots at the joints, `B.smooth = True` (the arenas' rule of smooth
  forms; edges over 40 degrees stay sharp). Built and rendered beside Sefu by
  `blender --background --factory-startup --python blender/arenas/landmarks/run.py -- <key>` (to
  `public/models/arenas/landmarks/<key>.glb` and `docs/arenas/landmarks/<key>-*.png`, put on one sheet `<key>_sheet.jpg`).
  `serpent.py` is the example.
- **The look** follows `blender/arenas/real/STYLE.md`: clean turned or boxed forms, one flat colour a part, the heroes' palette plus
  the arena's own colour, a thin gold line on the edges, one small light at most. Mythic, never cartoon. Under 8,000 triangles,
  about 15 parts at most.
- **In the game**: `src/arenas/landmarks/<key>.ts` exports its pose (a `LandmarkPose`: slow, loops of 20 to 60 s with `cycle`, nothing
  that flashes or draws the eye from the fight), and the arena's file places it with `landmark(key, { x, y, z, face, scale }, pose)`
  (`src/arenas/landmarks/index.ts`: loaded with the arena, dimmed like the props, no shadows) and calls its `update(time)`.
- **Where**: outside the ring and its floor, OFF the line through the ring's middle along z (x near 0): in an online duel each player's
  camera looks along it from one side, and nothing tall may stand there. Near enough (about 17 to 28 m from the ring's middle,
  RING = (0, 7)) that the duel's own camera catches it when the fight comes to its side; never hidden behind the arena's backdrop.
- **The check**: `pipeline/tools/landmark-shot.js` through `page-shots.py`: the game camera, an overview, a low view, the landmark as a
  duel sees it near its side and from the floor toward it. Every other check of the arena stays as it was (its cover, its events).
