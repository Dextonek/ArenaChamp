# Duel arenas (five, picked at random)

Every duel (AI duel and network duel) is played in one of five arenas. The registry is `src/arenas/index.ts`
(`ARENAS`, `pickArena`); each arena is one file `src/arenas/<id>.ts` exporting `<id>Arena: ArenaDef`
(`src/arenas/types.ts`). The Night Temple (`src/arenas/temple.ts`) is the original ring and the reference.
Shared helpers are in `src/arenas/common.ts`: `RING`, `shadowed`, `flatRing`, `floorDisc`, `canvasTexture`,
`seeded`, `disposeTree`, and `pillar` / `wall` from `src/obstacles.ts`.

## Fixed for every arena
- The ring: centre (0, 7), radius 12. Heroes start at (0, 13) and (0, 1). The AI, the camera, the network position
  stream and `arena.bounds` all assume it, so it never changes.
- Collision is the `obstacles` list only (capsules: `pillar(x, z, r)` and `wall(ax, az, bx, bz)`), the meshes are
  looks. Every obstacle mesh must cover its capsule (a hero must never stop in front of empty air or walk into a
  visible rock): a pillar mesh about as wide as `2r`, a wall mesh along the whole segment, about `2 × 0.35` thick.

## Layout rules
- **Point-symmetric about (0, 7)**: every obstacle at (x, z) has a twin at (-x, 14 - z) (or sits on the centre).
- The two starts stay clear for 3 m. Nothing closer than 1.5 m to the rim. Gaps between obstacles ≥ 2 m.
- No pockets or dead ends (the AI steers round one obstacle at a time). Pillar r ≤ 1.0, walls are `wall()` (r 0.35).

## Look rules (all arenas)
- **One luminance band.** Every floor stays as dark as the temple disc (`0x15131a`, roughness ~0.85): every
  ultimate darkens the world to 0.55 and the hero kits' dark layers need a dark floor. Style comes from texture,
  hue and props, not brightness. Emissive details (lava, runes, crystals) stay under the bloom threshold: emissive
  intensity ≤ 0.8 on mid colours, small areas.
- The ring edge must read: a clear rim line or border at radius 12 in the arena's own style.
- An apron round the ring (radius 12 → ~30) in the arena's style so the slab floor does not show at the edge of
  the frame (the fog takes over beyond ~40).
- Props outside the ring for atmosphere (no collision): keep them low near the ring (< 2 m within 16 m of the
  centre) so they never hide a hero from the gameplay camera (16 back, 8 up).
- Ambient animation in `update(dt, time)`: light and cheap (one `Points` or instanced mesh, ≤ 400 particles).
- `dispose()` frees everything (`disposeTree(group)`), since an arena is rebuilt each time it is picked.
- Meshes cast and receive shadows (`shadowed`), except flat decals and particles.
- Performance: ≤ ~60 draw calls per arena (merge or instance repeated props), no extra real-time lights.

## The four new arenas

### 1. Frostfall Lake (`frost.ts`, id `frost`, name `Frostfall Lake`)
A frozen lake at twilight. **Floor:** dark blue-black ice (`0x141e2a`-ish, slightly glossy, roughness ~0.4) with a
canvas crack texture (thin pale cracks, a few deep blue streaks) and faint frost swirls; the rim is a band of
packed snow. **Apron:** snowfield with drifts and a few dead pines and rocks beyond radius 16. **Cover:**
- `pillar(0, 7, 1.0)`: the frozen spire, a cluster of 4-6 faceted ice crystals (pale cyan, flat-shaded, low
  emissive) about 4 m tall, with snow at the base.
- `pillar(6.5, 6)` and `pillar(-6.5, 8)`: smaller crystal clusters (~3 m).
- `wall(-7, 3, -3.5, 3)` and `wall(7, 11, 3.5, 11)`: snow-drift ridges (~1.6 m high, rounded, a few ice shards).
**Ambient:** gentle falling snow. **Stage:** zenith `0x0a1a2e`, horizon `0x3a5a78`, glow `0x8fc8e8`, stars 0.3,
fog `0x2a4058` 30 → 120, hemi `0xbfe0ff` / `0x1a2a3a` 0.65, sun `0xe8f4ff` 1.3, rim `0x9fd8ff` 1.0,
background `0x1a2a3a`.

### 2. Ember Caldera (`caldera.ts`, id `caldera`, name `Ember Caldera`)
The floor of a volcano. **Floor:** dark basalt (`0x17110f`), rough, with a canvas texture of hexagonal basalt
columns and thin glowing lava cracks (orange `0xff6a1a`, emissive, thin, a few). The rim is a ring of cooled
obsidian with a thin lava seam. **Apron:** cracked basalt sloping into a lava lake beyond radius 20 (an emissive,
slowly scrolling lava disc, dim) and jagged rock spires far out. **Cover:**
- `wall(-6, 9, -2, 5)` and `wall(6, 5, 2, 9)`: two long obsidian ridges (glossy black, ~2.4 m, lava seam along
  the base), forming a diagonal lane through the middle.
- `pillar(8, 7, 0.9)` and `pillar(-8, 7, 0.9)`: basalt column clusters (~3.5 m, hexagonal prisms).
- Decoration only (no collision): a small dim lava vent at the centre, flat (y < 0.05), radius ≤ 1.
**Ambient:** rising embers. **Stage:** zenith `0x120606`, horizon `0x3a1408`, glow `0xff5a1a`, stars 0, fog
`0x2a0e06` 40 → 130, hemi `0xffb080` / `0x200804` 0.5, sun `0xffc890` 1.4, rim `0xff6a2a` 0.8,
background `0x2a0e06`.

### 3. Verdant Glade (`glade.ts`, id `glade`, name `Verdant Glade`)
An old forest clearing at golden dusk. **Floor:** dark moss and earth (`0x141a12`) with a canvas texture of moss
patches, leaf litter and a few flat stepping stones; small grass tufts (instanced, low, ≤ 0.3 m) scattered but
not on the start spots. The rim is a ring of mossy stones. **Apron:** forest floor, a wall of tree trunks and
bushes from radius 18 out (tall trees only beyond 18, so they never hide the duel). **Cover:**
- `pillar(2.5, 7, 0.7)` and `pillar(-2.5, 7, 0.7)`: ancient tree trunks with roots flaring at the base, broken off
  at ~4 m (no canopy over the ring), moss on top.
- `pillar(5, 3, 0.7)` and `pillar(-5, 11, 0.7)`; `pillar(-6, 4, 0.7)` and `pillar(6, 10, 0.7)`: standing stones
  with carved spirals (~2.6 m), moss caps.
- `wall(8, 6, 9.5, 8)` and `wall(-8, 8, -9.5, 6)`: fallen mossy logs (~1 m high).
**Ambient:** drifting fireflies (warm, small, few). **Stage:** zenith `0x07120c`, horizon `0x24402a`, glow
`0xd8b860`, stars 0.4, fog `0x1a2e1e` 35 → 120, hemi `0xcfe8b0` / `0x1a140a` 0.65, sun `0xffe6b0` 1.5, rim
`0xa8ffc8` 0.7, background `0x1a2e1e`.

### 4. Sky Ruins (`skyruins.ts`, id `skyruins`, name `Sky Ruins`, `hideGround: true`)
A floating marble platform above a sea of clouds at dusk. **Floor:** a platform of dark slate marble
(`0x181a24`, roughness ~0.6) with a canvas texture of large tiles and thin gold inlay lines (a ring at radius 6, a
star of lines); radius 13 with a thick crumbling edge going down ~3 m (broken blocks, irregular). The rim at 12 is
a gold inlay ring. **Below and around:** a sea of soft clouds about 6 m below (a large disc with a cloud texture,
plus some cloud billboards), a few small floating rock islands with ruins far away (beyond 25 m). The slab
floor is hidden (`hideGround`), so the platform is the only floor. **Cover:**
- Six broken marble columns, `pillar(6 cos a, 7 + 6 sin a, 0.8)` for a = 0°, 60°, 120°, 180°, 240°, 300°
  (pale marble `0x8a8a96`, fluted, 2.5-4.5 m tall, broken tops of varied height, a gold band), a few fallen drums
  lying OUTSIDE the ring.
**Ambient:** slowly drifting clouds (rotate the cloud layer, move a few billboards). **Stage:** zenith `0x0b1030`,
horizon `0x5a6aa8`, glow `0xffb08a`, stars 0.6, fog `0x3a4470` 60 → 200, hemi `0xd0d8ff` / `0x2a2030` 0.7, sun
`0xfff0e0` 1.6, rim `0xb0c0ff` 1.0, background `0x3a4470`.

## Refinement round 1 (review of `docs/arenas/arenas-five_sheet.jpg`)
**Camera rule:** the gameplay camera sits ~16 m behind the player and 8 m up; a network player on side 1 looks from
-Z toward +Z, so the camera can be on either end of the z axis (z ≈ 29 or z ≈ -15). Anything taller than 2 m must be
more than 26 m from the centre, or off the z axis (|x| > 12); nothing tall within 26 m of the line x = 0.
Same rules as above (layout and collision unchanged; dark floors; emissive small; draw calls ≤ ~60, particles
≤ 400 per arena; props within 16 m of the centre lower than 2 m; no extra lights). Aim: each arena tells a small
story and has three depth layers: the ring floor (detail at your feet), the ring edge (a strong, specific border),
and the far backdrop (a silhouette that names the place at a glance).

### Night Temple (`temple.ts`)
Bare today. Make it an old moonlit temple court:
- Floor: engraved stone, a large faint carved mandala/sun-wheel in the disc (canvas texture, low contrast), worn
  slab joints, a few cracks; keep the disc dark.
- Edge: a low stepped stone curb at the rim (≤ 0.3 m) with the gold line on top; four short braziers OUTSIDE the
  rim at the diagonals (radius ~13.5) with small flickering flames (sprites/points, warm, small, under bloom).
- Cover: give the pillars and walls their own temple look in `temple.ts` (do not edit `obstacles.ts`): fluted
  columns with carved capitals and a base, walls as carved balustrades or a ruined screen wall with a gold frieze.
  Same collision as `DUEL_OBSTACLES`.
- Backdrop: silhouettes of a ruined temple gate, broken colonnades and a few hanging banners (dark violet with
  gold) between 18 m and 35 m; a large pale moon low in the sky via a sprite far away.
- Ambient: drifting incense motes or a few fireflies of light (gold), very few.

### Frostfall Lake (`frost.ts`)
- The snow outside the ring is flat white blobs: replace with a continuous snowfield that has soft height
  (a displaced/noise-shaped apron mesh or several overlapping low mounds), wind-blown ridges and darker patches of
  exposed rock; no pure white (keep snow ≤ `0x7a8898`).
- Snow drifts on the ring are smooth domes: make them wind-sculpted (asymmetric, a sharp windward crest, layered
  with a few ice shards poking out), still covering their capsules.
- Ice floor: more depth: two layers (a darker under-layer texture with trapped bubbles and deep cracks, a faint
  frosted top), a frozen fish or two and a sunken branch visible "under" the ice (decal), plus frost rime toward the
  rim.
- Crystals: vary the clusters (tall spire with satellites, a toppled shard, broken stumps), keep them muted.
- Edge: a ring of broken ice plates pushed up at the shoreline (low, < 0.6 m).
- Backdrop: denser pine forest silhouettes beyond 20 m, distant snowy mountain ridges (flat silhouette meshes),
  a faint aurora band in the sky (a large transparent ribbon, slow wave, low opacity, behind everything).
- Ambient: keep snow, add occasional ground mist wisps near the rim.

### Ember Caldera (`caldera.ts`)
- The basalt column clusters read as brown planks: make them dark grey hexagonal basalt prisms (`0x2a2522`-ish,
  flat-shaded), varied heights, some broken, with ash on top.
- Obsidian ridges: vary block sizes and angles more, add a few glowing fissures inside them, rubble at their feet.
- Floor: add ash drifts, scattered small rocks and a few cooled lava flow ribbons (raised slightly, darker), keep the
  glowing cracks.
- Edge: the black rim band is flat; make it a low jagged obsidian lip with molten seams.
- Backdrop: a big volcanic crater wall silhouette around the far edge, two or three smoke columns rising (soft
  sprites, dark, slow), a faint red glow under them; lava falls on the far crater wall (emissive strips, dim).
- Ambient: keep embers, add slow falling ash flakes (grey) and an occasional lava bubble pop in the lake.

### Verdant Glade (`glade.ts`)
- Ground: bigger grass clumps (still ≤ 0.35 m, more of them, varied green), small flowers (white and yellow),
  mushrooms in clusters at the tree roots and logs, ferns at the ring edge.
- Standing stones: weathered shapes (not boxes): tapered, chipped corners, lichen patches, a carved glowing rune
  (very dim teal) instead of the bright spiral decal.
- Trunks: more root flare and bark texture, a few hanging vines from the broken tops.
- Edge: the stone ring is good; add moss on the stones and a few ferns between them.
- Backdrop: keep the forest wall; add volumetric-looking god rays (soft, dim, additive, few) and a distant
  canopy silhouette.
- Ambient: fireflies plus a few falling leaves.

### Sky Ruins (`skyruins.ts`)
- The floor star reads as a pentagram: replace with a compass-rose / eight-pointed sun inlay (gold, thin lines) and
  a circle of constellation dots; never a 5-pointed star.
- Floor: add worn tiles, a few missing tiles showing a darker under-layer, small cracks.
- Columns: add bases with mouldings, capitals on the intact ones, ivy or gold ornament bands, and a few toppled
  column drums with fragments on the floor OUTSIDE the ring.
- Edge: a low broken balustrade along part of the platform edge (outside radius 12.5, low, gaps).
- Backdrop: floating islands should be rocky masses (irregular, layered strata, hanging roots), not cones; one far
  island carries a ruined arch or temple; a broken arch stands off to one side of the platform (|x| > 14).
- Ambient: drifting clouds plus a few birds (simple V shapes) circling far away.
