# Sand kit: Sefu, the Dune Sovereign

## Role (2026-10-30)
**Controller**, 600 HP. Signature: *Shackles and teeth*.
- Q Sand Lash: **root 0.8** (`cc`), 53 damage.
- W Quicksand: a LINGER (`cc`): the sand turns for 2 s, three ticks (6 each) **slow 1.2** whoever is inside radius 4, then at 2.6 s the pillars close: 40 damage and **root 1.0**. The telegraph is armed at the first tick (0.8 s) and drawn until the pillars close.
- E Dune Ward: **shield 45** (4 s) at the cast; the two sand rings (13) **slow 1.0**.
- R Tomb of Kings: **stun 1.0** at the implosion (`cc`), 130 damage.

**Signature shape: sand that flows like a ribbon and sets like stone.** Sand pours in thick, grainy **ribbons**
(a warm ochre band with a darker shadow edge and fine grains streaming off its trailing edge), and wherever it stops
it **hardens into carved sandstone** with glyphs cut into it (pale stone with dark incised lines). Every spell moves
sand, then sets it, then crumbles it back to dust. Not a sandstorm cloud (that is the existing djinn): ribbons and
carved stone.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a desert king in layered linen and a gold headdress with a crook of sandstone; controls ground and space.
  **Category:** `hero: sand`. **Parts file:** `src/effects/parts/sand.ts`. **Kit:** `src/kits/sand.ts` (`sandKit`).
- **Palette** (`SAND` / `SAND_CSS`): core `#fff6dc` (tiny) → hot `#ffd27a` (sunlit sand) → body `#c8913f` (ochre) →
  accent `#3fd4c8` (turquoise inlay glint, 2–3 frames at hits) → dark `#2a1a0c`; **foil** sandstone `#e8d8b4` (the
  carved stone, the glyph tablets).
- **Material rules:** sand ribbons = a lit band (hot on top, body in the middle, dark edge underneath) with a grain
  texture scrolling along it and grains (tiny points, few) shedding from the trailing edge; sandstone = flat-shaded
  pale stone with dark incised glyph lines (a canvas texture), never glowing; dust = small toon puffs in the body colour.

## Shared parts (`sand.ts`)
- `SAND`, `SAND_CSS`.
- `SandRibbon`: a thick flowing band along a curve: `setPath(points)` or `setFunction(fn)`, `width`, `head`/`tail`
  reveal, grain shedding, `reset()`.
- `SandstoneBlocks`: instanced carved stone blocks/pillars/shards with glyphs: `raise(base, size, seconds, delay)`,
  `crumble(perBlock, life)` into `Dust`.
- `GlyphRing`: a sandstone ground ring with carved glyphs (canvas): `set(center, radius)`, `reveal`, `opacity`, an
  option to hide its centre.
- `Dust`: small toon dust puffs and falling grains: `puff(pos, size)`, `fall(center, radius, count)` (cap ~10 puffs).
- `SandPool`: a ground decal of loose sand that swirls inward (a quicksand vortex): `spread(center, radius, s)`,
  `swirl` (0..1), `settle(seconds)`.

## Q · Sand Lash (`sandLash.ts`, label `sand lash`, `enemy`, range 10, cd 3, damage 50)
0–0.2: he sweeps the crook; a sand ribbon pours out of the ground at his side. **0.5 hit**: the ribbon lashes
across to the target like a whip (a fast arc, width 0.35), wraps once around its legs and sets into a sandstone shackle
(a ring of 4 carved stone shards) for 0.4 s; turquoise accent glint (2 frames), dust puff, a small ground
`ShockRefraction` (0.03). `ctx.hit(target, { damage: 50, knock: 1, color: SAND_CSS.body })`. 0.9: the shackle
crumbles to dust. Clean by 1.6.

## W · Quicksand (`quicksand.ts`, label `quicksand`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a glyph ring (radius 4) carves itself into the floor at the point. 0.3–0.7: a sand pool spreads inside it and
starts to swirl inward; enemies inside sink 0.15 (`ctx.displace`) and are pulled 0.4 toward the centre. **0.75 hit**:
the swirl snaps tight and 5–7 sandstone pillars punch up around the edge, leaning inward like closing teeth; dust,
shake 0.4, ground `ShockRefraction` (1 → 5, 0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3:
`ctx.hit(e, { damage: 10, knock: 0 })`. 1.4–2.2: the pillars crumble, the sand settles and fades. Clean by 2.3.

## E · Dune Ward (`duneWard.ts`, label `dune ward`, `self`, radius 5, cd 9, 2 × 13)
0–0.35: three sand ribbons rise from the floor and wind around him (a slow spiral at radius 1.2–1.8, waist to head
height) and a small glyph ring forms under him. 0.35–2.6: the ribbons keep circling; at 1.0 and 2.0 they flare out to
radius 5 as a flat sand shockwave ring along the floor (a ribbon ring expanding, dust at its edge), hitting every enemy
inside: `ctx.hit(e, { damage: 13, knock: 2 })`. 2.6–3.0: the ribbons set into sandstone and crumble. Clean by 3.2.
Telegraph ends at the first pulse.

## R · Tomb of Kings (`tombOfKings.ts`, label `tomb of kings`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **sandstone pyramid** rises out of a sand vortex and **collapses onto the zone**.
0–0.4: he plants the crook; the world darkens warm (`darken` 0.55, tint `#2a1a0c`); a big glyph ring (radius 7) carves
itself at the point. 0.3–1.6: the floor inside turns to swirling sand; sand ribbons spiral up from the ring's edge and
build a **stepped pyramid** of carved sandstone blocks over the point (base ~7 wide, ~6 tall; it rises layer by
layer), enemies are pulled 0.6 toward the centre. 1.6–1.85: a glyph on the pyramid's face lights turquoise — **dead
beat 1.85–2.0** (the sand freezes). **2.0–2.2**: the pyramid implodes downward into the vortex. **2.2 hit**: impact
frames `[1, 2]` at 0.04 s, a ring of sandstone shards bursts outward across the radius, a sand shockwave ribbon, dust,
ground `ShockRefraction` (1 → 12, 0.07), turquoise accent at the centre, shake 0.75.
`ctx.hit(e, { damage: 125, knock: 6, from: point })` within 7. 2.2–4.5: the shards crumble to dust, the sand settles,
the glyph ring fades, the darken lifts. Clean by 4.5.
