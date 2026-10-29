# Dawn kit: Auriel, the Dawn Paladin

**Signature shape: hard-light geometry.** Light is solid: **flat gold panels with crisp edges** (hexagons, kite shields,
long blade shards) that click together into shapes (a shield wall, a halo of blades, a great sword), lit from inside
with a white core line and a darker amber rim. Things assemble panel by panel and shatter into panels. Not soft holy
glow and not stained glass (the existing sanctum): opaque, geometric, assembled light.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a young paladin in white and gold plate with a halo ring; protects and smites. **Category:** `hero: dawn`.
  **Parts file:** `src/effects/parts/dawn.ts`. **Kit:** `src/kits/dawn.ts` (`dawnKit`).
- **Palette** (`DAWN` / `DAWN_CSS`): core `#fffdf2` (tiny core lines) → hot `#ffe7a0` → body `#f2b83c` (gold) →
  accent `#7fd8ff` (sky blue, 2–3 frames at hits) → dark `#3a2408` (amber-brown rims and shadows); **foil** ivory
  `#efe6d2` (panel faces, the halo's inner band).
- **Material rules:** hard-light panels = unlit flat shapes, ivory/gold face with a thin white core line and a dark
  amber rim (the dark layer), only the core lines may bloom; never a soft glow sphere; light rays = thin crisp
  tapered wedges, low opacity, few.

## Shared parts (`dawn.ts`)
- `DAWN`, `DAWN_CSS`.
- `LightPanels`: instanced hard-light panels (hex, kite, shard shapes): `place(i, pos, quat, size, shape)`,
  `assemble(positions, seconds, stagger)` (fly in and click into place), `shatter(speed, life)`.
- `HaloRing`: a crisp gold ring with an ivory inner band and short ray ticks: `set(center, normal, radius)`, `spin`,
  `opacity`.
- `SunRays`: a few thin crisp tapered wedges fanning from a point: `fan(origin, dir, count, length, spread)`, `fade`.
- `Sigil`: a gold ground circle with a sun-wheel pattern (canvas): `set(center, radius)`, `reveal`, `opacity`, centre
  hide option.

## Q · Radiant Spear (`radiantSpear.ts`, label `radiant spear`, `enemy`, range 11, cd 3, damage 50)
0–0.2: a spear of hard-light shards assembles over her shoulder (6 shards clicking into a long blade, 2.6 long).
**0.45 hit**: it flies and pierces the target: the shards burst out of its back in a fan, a sky-blue accent (2
frames), a small sun-wheel sigil flashes under it, small ground `ShockRefraction` (0.03), one impact frame `[1]` at
0.03 s. `ctx.hit(target, { damage: 50, knock: 3, color: DAWN_CSS.body })`. 0.6–1.4: the shards fade out panel by
panel. Clean by 1.5.

## W · Aegis Wall (`aegisWall.ts`, label `aegis wall`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a sun-wheel sigil (radius 4) draws on at the point. 0.3–0.7: a ring of 10 kite-shield panels assembles around
the edge, standing upright, then tilts inward over the enemies like a closing dome. **0.75 hit**: the dome slams shut
(panels click together at the top), a flash of the core lines, shake 0.35, ground `ShockRefraction` (1 → 5, 0.04).
`ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3 as the dome pulses: `ctx.hit(e, { damage: 10, knock: 0 })`.
1.4–2.2: the dome shatters outward into panels that fade, the sigil fades. Clean by 2.3.

## E · Halo of Blades (`haloOfBlades.ts`, label `halo of blades`, `self`, radius 5, cd 9, 2 × 13)
0–0.3: a halo ring forms over her head and six blade shards assemble around her at waist height (radius 1.6). 0.3–2.6:
the blades orbit; at 1.0 and 2.0 each blade launches to the nearest enemy within 5 (a straight streak), strikes and
snaps back: `ctx.hit(e, { damage: 13, knock: 1 })`. 2.6–3.0: the blades and halo shatter into panels. Clean by 3.2.
Telegraph ends at the first pulse.

## R · Judgement of Dawn (`judgementOfDawn.ts`, label `judgement of dawn`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **colossal sword of hard light** assembles in the sky and is driven into the zone.
0–0.4: she raises her blade; the world darkens to a pre-dawn blue (`darken` 0.55, tint `#1a2238`); a big sun-wheel
sigil (radius 7) draws on. 0.3–1.6: above the point, ~4–9 up, a giant sword (~7 long, point down) assembles from
dozens of gold panels clicking in from the edges of the frame; a halo ring forms behind its hilt; sun rays fan from
it; enemies are held (pull 0.4). 1.6–1.85: the sword's core lines brighten to white — **dead beat 1.85–2.0**.
**2.0–2.2**: it drives straight down into the point. **2.2 hit**: impact frames `[1, 2]` at 0.04 s, a ring of panel
shards bursts outward across the radius, a sky-blue accent at the centre, sun rays from the impact, ground
`ShockRefraction` (1 → 12, 0.07), shake 0.75. `ctx.hit(e, { damage: 125, knock: 6, from: point })` within 7.
2.2–4.5: the sword stands a moment, then shatters into panels that fade, the sigil fades, the darken lifts. Clean by 4.5.
