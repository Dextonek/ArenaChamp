# For the Blender round

The model review (2026-11-16) did not run Blender. These need a rebuild; each with the model, the fault, its picture and the change.

1. **The Tide Judge's glaive** (Climb ruler `sea_judge`, `blender/tower/sea/judge.py` lines 89-90): at rest the haft runs back through
   the gown behind his right hip (0.6 of its length behind the hand). Change `o - d * 0.6 * s` to `o - d * 0.3 * s` (the haft) and
   `o - d * 0.61 * s` to `o - d * 0.31 * s` (the pommel); rebuild with
   `blender --background --factory-startup --python blender/tower/build.py -- sea.judge --out public/models/tower`.
   Picture: [rulers/long-weapons-at-rest.jpg](rulers/long-weapons-at-rest.jpg) (the first two).
2. **Ash's great anvil in the Twin Forge** (`blender/arenas/real/twinforge.py` line 302): it reaches 1.27 m past its round cover on
   the east (a hero walks into the horn) and stops 0.54 m short of it north and south. Change to
   `A.put("great_anvil", HOLD[0][0] - 0.6, Z(-HN + 4.2), yaw=0.0, scale=0.9)`; rebuild the arena and check with
   `pipeline/tools/arena-fit.js` (twinforge cover0 `over` under 0.35). The cover stays (gameplay).
3. **The harbour's two cannons** (`blender/arenas/real/harbour.py`, `cannons()`): a 3.2 m gun on a 2.7 m wall, 0.65 m past it at one
   end. `scale=S * 0.9` instead of `S * 1.05` (or move it 0.3 m along the wall toward its short end); check covers 5 and 6.
4. **Only if the user wants it (taste):** the cream of seven of the Climb's people (`R.mat("cream", "#e2d6b8", ...)` in
   `blender/tower/sands/seer.py`, `counter.py`, `silk.py`, `glass.py`, `beacon.py` and `blender/tower/war/camp.py`; `"#e2d8c0"` in
   `herald.py`) to about 15 % darker (`#cdbf9c`): they
   bloom white in the Sands' and the War's light. Picture: [people/bloom.jpg](people/bloom.jpg).
