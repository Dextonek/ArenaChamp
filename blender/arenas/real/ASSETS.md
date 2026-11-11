# Sources of the realistic arenas

Every model and texture is from **Poly Haven** (https://polyhaven.com), licence **CC0** (public domain: no credit
needed, free for any use). The raw files are not in the repo (`pipeline/assets/polyhaven/` is git-ignored); fetch them
again with:

```
node pipeline/tools/polyhaven-get.mjs <id> [<id> ...]
```

The game ships only what the arena scripts export: props cut down to a few hundred or thousand triangles with
512 px textures in `public/models/arenas/<arena>.glb`, and ground textures in `public/textures/arenas/`.

## Drowned Harbour (`harbour.py`)

Models: `modular_wooden_pier wooden_barrels_01 wooden_crate_01 wooden_crate_02 wooden_bucket_01 wooden_lantern_01
cannon_01 dutch_ship_large_01 rock_moss_set_01 boulder_01`

Ground texture: none now. The first, photographic sample used `cobblestone_floor_08`
(`public/textures/arenas/harbour_floor_{diff,nor,rough}.jpg`, removed); the user found it too realistic, and the floor
is drawn in `src/arenas/harbour.ts`. `realGround` in `src/arenas/real.ts` still reads such a set if one is wanted.

Fetched and not used (yet): `rock_07 rock_09 rock_face_01 rock_face_02 stone_01 namaqualand_boulder_03
namaqualand_boulders_01 moon_rock_01 dark_wooden_planks coast_sand_rocks_02`. The two `rock_face` scans are open at
the back: they look torn from the game's high camera.
