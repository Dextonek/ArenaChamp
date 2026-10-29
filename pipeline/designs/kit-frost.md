# Frost kit: Isolde, the Winter Warden

**Signature shape: frost ferns.** Rime creeps across the floor (and up the enemies) as feathery, branching fern
patterns that grow from a point outward, white-blue on dark stone, then **shatter** into angular ice shards. The
second shape: clear blue ice crystals with hard facets and a pale inner core line. Not lily petals, not hexagon
plates: branching ferns and long faceted crystals.

Read `kit-common.md` first (files, timing, look lessons).

- **Hero:** a calm warden in a long coat whose breath freezes the air; control and slow, then a crushing ultimate.
  **Category:** `hero: frost`. **Parts file:** `src/effects/parts/frost.ts`. **Kit:** `src/kits/frost.ts`.
- **Palette** (`FROST` / `FROST_CSS`): core `#f6fcff` (tiny) → hot `#c9efff` → body `#4fb4e8` → accent `#ff9ec4`
  (a warm pink glint, 2–3 frames at hits) → dark `#081626`; **foil** rime white `#e8f4fa` (the ferns themselves are
  the foil: keep them below the bloom threshold, they are frost, not light).
- **Material rules:** ice crystals: flat facets, the body blue darkening to the dark colour at the base, a thin pale
  core line along the long axis, a pinpoint glint only at the hit; ferns: a canvas-drawn branching texture revealed
  by a growth mask from the seed point outward (a distance field), never a uniform fade; snow: small soft flakes,
  few, normal-blended pale with a dark rim so they read on the floor.

## Shared parts (`frost.ts`)
- `FROST`, `FROST_CSS`.
- `FrostFerns`: a ground decal of branching rime: `grow(center, radius, seconds)` (grows outward along the branches),
  `shatter()` (hand-off to shards), `fade(seconds)`. Procedural canvas texture with branching ferns from the
  centre, varied branch lengths (no regular comb).
- `IceCrystals`: instanced faceted crystals: `spike(base, dir, length, width, grow, delay)`, `cluster(center, radius,
  count, height)`, `shatter(perCrystal, speed, life)` into `IceShards`.
- `IceShards`: instanced small angular shards with gravity and spin, short life.
- `Snow`: a small pool of drifting flakes: `swirl(center, radius, count)`, `stop()`.
- `FrostBreath`: a pale cone of toon mist puffs from a point along a direction: `blow(from, dir, length, seconds)`.

## Q · Rime Spear (`rimeSpear.ts`, label `rime spear`, `enemy`, range 11)
0–0.3: she breathes on her open hand (a small `FrostBreath` puff); a long ice javelin (one `IceCrystals.spike`,
3 long, 0.25 wide) grows in her hand. 0.3–0.5: thrown, a pale streak with a few snowflakes behind. **0.5 hit**: it
pierces the target; frost ferns grow out from the target's feet (radius 1.8) and climb up its body as a pale rime
tint; 6 small crystals burst out of the ground around it; a pink accent glint (2 frames), a small ground
`ShockRefraction` (0.03). `ctx.hit(target, {damage: 55, knock: 2})`. 0.8: the spear and crystals shatter into
shards; the ferns fade by 1.6. Clean by 1.7.

## W · Frostfern Field (`frostfernField.ts`, label `frostfern field`, `ground`, radius 4.5, range 10)
0–0.2: she sweeps her hand low: a `FrostBreath` cone toward the point. 0.2–0.75: frost ferns race across the floor
from the point to radius 4.5 (fast, branching), climbing the enemies inside (rime tint, enemies sink 0.05 as if
held); a few snowflakes swirl. **0.8 hit**: the field cracks: 20–26 ice crystals burst up through the ferns
(heights 0.6–2.2, chunky, tallest at the enemies, leaning outward), ground `ShockRefraction` (1 → 6, 0.04), shake
0.4. `ctx.hit(e, {damage: 50, knock: 0})` for enemies within 4.5. 0.8–1.5: hold; 1.5: shatter into shards
outward; the ferns fade by 2.2. Clean by 2.3.

## E · Glacial Mantle (`glacialMantle.ts`, label `glacial mantle`, `self`, radius 4)
0–0.35: frost ferns grow out from under her (radius 2.2) and up her coat; 6 long ice crystals grow around her
shoulders and hips like armour plates, pointing outward and down (a mantle). 0.35–2.8: a ring of snow swirls
around her at radius 2–3.5 (a blizzard band, not a cloud: flakes and 3–4 thin pale wind arcs); two pulses at 1.0
and 2.0: the crystals flare pale, a rime ring races out to radius 4, enemies inside get frost ferns at their feet
and `ctx.hit(e, {damage: 12, knock: 0})`. 2.8–3.2: the mantle shatters into shards, the ferns fade. Clean by 3.3.
Loopable section 0.35–2.8.

## R · Winter's Crown (`wintersCrown.ts`, label `winter's crown`, `ground`, radius 7, range 13)
The ultimate: a **colossal crown of ice** forms in the sky over the zone and drives down into it.
0–0.4: she lifts both hands; the world darkens cold (`darken` 0.6, tint `#081626`); frost ferns grow outward over
the whole radius 7 (the warning). 0.3–1.5: a ring of 10–12 huge ice crystals (5–7 long, points down) forms in a
circle 8 above the point, growing from the tips, like a crown upside down; heavy snow swirls into the ring; the
enemies are rimed (pale tint) and slowed (sink 0.1). 1.5–1.9: the crown turns slowly and tightens — **dead beat
1.85–2.0**: everything stops, the snow hangs. **2.0–2.3**: the crown drives down; **2.3 hit**: the crystals stab into
the ring and a forest of 40–50 crystals erupts across the zone, impact frame, a pink accent glint at the centre,
ground `ShockRefraction` (1 → 12, 0.07), shake 0.75. `ctx.hit(e, {damage: 125, knock: 4, from: point})` within 7.
2.3–3.3: hold, snow falls; 3.3–4.5: everything shatters from the centre outward, ferns fade, darken lifts. Clean by
4.5.
