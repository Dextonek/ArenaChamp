# Astral kit: Lyra, the Star Archer

**Signature shape: constellations.** Bright star points (four-point stars, varied sizes) joined by thin, crisp gold
lines that **draw themselves** from star to star, forming a figure (a net, a bow, a stag), then **snap**: the lines
break and the stars fall as small shooting stars. Second shape: arrows of light with a long, thin gold tail.

Read `kit-common.md` first (files, timing, look lessons).

- **Hero:** a ranged archer who reads the sky; precise, elegant, multi-target. **Category:** `hero: astral`.
  **Parts file:** `src/effects/parts/astral.ts`. **Kit:** `src/kits/astral.ts`.
- **Palette** (`ASTRAL` / `ASTRAL_CSS`): core `#fffbe8` (star cores only) → hot `#ffe08a` (lines) → body
  `#5a3fc0` (the night-violet field behind stars) → accent `#7ff3ff` (cyan, 2–3 frames at hits) → dark `#070414`;
  **foil** pale star-chart parchment `#e8e0c8` (the drawn chart rings and the zodiac glyphs on the ground).
- **Material rules:** lines are crisp ribbons with a soft halo under them (not fat glows), width ~0.06–0.1 with a
  0.3 halo at low opacity; stars are four-point hard shapes with a tiny white core, sizes varied; the violet body is a
  dark translucent "night" disc or ribbon behind the gold so the gold reads (the dark layer); the chart foil is a
  canvas ring with tick marks and zodiac glyphs, not glowing.

## Shared parts (`astral.ts`)
- `ASTRAL`, `ASTRAL_CSS`.
- `StarPoints`: instanced four-point stars: `add(pos, size)`, `twinkle`, `fall(i, vel)` (a star drops as a
  shooting star with a short tail), `reset()`.
- `ConstellationLines`: crisp gold line segments with a halo: `connect(a, b, seconds, delay)` (draws from a to b),
  `snap(seconds)` (lines break into short falling segments and fade).
- `StarArrow`: a light arrow with a long tapered gold tail: `fly(from, to, seconds)`, `onArrive`.
- `StarChart`: a parchment-coloured ground ring with ticks and zodiac glyphs (canvas): `set(center, radius)`,
  `reveal`, `opacity`, an option to hide its centre.
- `NightVeil`: a dark violet translucent disc/dome patch with sparse tiny stars, used as the dark layer behind
  constellations: `set(center, radius, height)`, `opacity`.

## Q · Starshot (`starshot.ts`, label `starshot`, `enemies`, maxTargets 3, range 12)
0–0.25: she draws a bow of light (a gold crescent with a string line). **0.35**: a `StarArrow` flies to the first
target; on hit it splits and chains to the 2nd and 3rd nearest (0.08 s per hop). At each target a star point
pops (hit star, cyan accent 2 frames) and a gold `ConstellationLines` segment remains, joining the targets in
order: the shot leaves a small constellation. `ctx.hit(e, {damage: 45, knock: 2})` per target at its arrival.
0.9: the lines snap, the stars fall as tiny shooting stars. Clean by 1.6. Telegraph: a line to the first target.

## W · Constellation Snare (`constellationSnare.ts`, label `constellation snare`, `ground`, radius 4, range 11)
0–0.2: she fires an arrow up. 0.2–0.6: a `StarChart` ring (radius 4) draws on at the point; 7–9 stars fall onto
points around and across the circle (on and near the enemies), each landing with a small pop. 0.6–0.8:
constellation lines draw between them fast, forming a net (a triangulated pattern, varied lengths) over a dark
`NightVeil` disc. **0.8 hit**: the net snaps tight toward the centre (lines shorten, stars pull in 1.0), enemies
inside are pulled 0.8 toward the centre (`ctx.displace`), cyan accent, ground `ShockRefraction` (1 → 5, 0.04).
`ctx.hit(e, {damage: 50, knock: 0})`. 1.4: the net snaps apart, stars fall, chart fades. Clean by 2.1.

## E · Orbit Veil (`orbitVeil.ts`, label `orbit veil`, `self`, radius 5)
0–0.3: a small `StarChart` ring under her (radius 2) and a `NightVeil` dome around her. 0.3–2.8: 7 star points orbit
her on two tilted rings (radius 1.4 and 2.0), linked by constellation lines into a turning figure; at 1.0 and 2.0
the figure flares and fires a thin gold line from the nearest star to every enemy within 5 (a star-strike: the line
draws to the enemy in 0.08 s, a star pops on the enemy, cyan 2 frames), `ctx.hit(e, {damage: 12, knock: 1})`.
2.8–3.2: the orbit breaks, stars fall, veil fades. Clean by 3.3. Loopable section 0.3–2.8.

## R · Celestial Hunt (`celestialHunt.ts`, label `celestial hunt`, `ground`, radius 7, range 14)
The ultimate: a **giant constellation stag** is drawn in the sky and charges through the zone.
0–0.4: she aims her bow at the sky; the world darkens to night (`darken` 0.7, tint `#070414`); a big `StarChart`
ring (radius 7) draws on around the point. 0.3–1.6: behind the zone, 6–9 above the ground, ~20 stars appear one
after another and constellation lines draw between them into the outline of a **stag** (antlers, head, back,
legs; side-on to the camera, ~12 wide), over a dark `NightVeil` patch so the gold reads. 1.6–1.9: the stag lowers
its head (its stars shift) — **dead beat 1.8–1.95**. **1.95–2.35**: the stag charges down through the zone toward
the caster side (the whole figure moves and tilts down), leaving a trail of falling star segments. **2.35 hit**
(it passes the centre): impact frame (the stag as a black silhouette on a parchment card), a wave of star points
bursting up from the ground across the radius, cyan accent at the centre, ground `ShockRefraction` (1 → 12, 0.07),
shake 0.7. `ctx.hit(e, {damage: 125, knock: 7, from: point})` within 7. 2.35–4.5: the stag dissolves into a rain of
small shooting stars over the zone; the chart and night fade. Clean by 4.5.
