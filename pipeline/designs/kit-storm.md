# Storm kit: Kaia, the Tempest Caller

## Role (2026-10-30)
**Mage (burst), 560 HP.** Signature: unavoidable lightning, the only instant hits. See hero-roles.md.
- Q Arc Lance: enemies mode, max 2 targets; the bolt chains to a second enemy (a unit) within 6 m for half damage (25). Range 11, cd 3, 50.
- W Downpour: three strikes inside the 4 m zone, the volley slows 1.0; hits re-check live positions. 40 + 15, cd 7.
- E Static Field: NOVA, `cc`. A ring expands from her to 5 m in 0.5 s (starts 0.9 s after the cast); it hits once, on the frame its front passes an enemy: 20 damage, stun 0.6. One hit instead of two pulses; cd 9.
- R Eye of the Storm: radius 7 -> 5, 150, cd 20 (storm wheel and cloud art unchanged).

**Signature shape: the lightning tree.** Thick, hard-edged lightning that **branches like a tree** (a trunk that
forks two or three times, getting thinner, with a dark outline) and **slanting rain sheets**: long thin pale streaks
at one shared angle, falling in a column. The storm shapes are grounded by dark rolling cloud above and puddle
ripples below. Not violet thunder sigils (that is the existing thunder set): this is blue-white lightning in rain.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a young storm caller with a hooked staff and a rain cloak; fast, harassing, lightning from above.
  **Category:** `hero: storm`. **Parts file:** `src/effects/parts/storm.ts`. **Kit:** `src/kits/storm.ts` (`stormKit`).
- **Palette** (`STORM` / `STORM_CSS`): core `#ffffff` (tiny) → hot `#d6f2ff` → body `#4aa8ff` → accent `#ffe36a`
  (yellow spark, 2–3 frames at hits) → dark `#0a1220`; **foil** rain grey `#c8d4de` (rain streaks, ripples, the cloud's
  lit underside).
- **Material rules:** lightning = an unlit ribbon with a white core line, a blue body and a dark outline drawn
  **under** it (the dark layer), flickering on/off in 2–3 frame steps, never a smooth fade; cloud = dark toon puffs with
  a pale lit underside, flat-bottomed; rain = thin normal-blended streaks at one angle, short, sparse.

## Shared parts (`storm.ts`)
- `STORM`, `STORM_CSS`.
- `LightningTree`: a branching bolt from a start to an end point: `strike(from, to, branches, width, seconds)`
  (forks 2–3 levels, re-randomised every few frames while it lives), `reset()`.
- `StormCloud`: a dark flat-bottomed cloud patch: `gather(center, radius, height, seconds)`, `disperse(seconds)`,
  a `flash` (0..1) that lights its underside.
- `RainSheet`: slanting rain in a column or disc: `fall(center, radius, seconds, density)`, `stop()`.
- `Puddles`: ground ripple rings and wet decals (cap ~10): `ripple(pos, size)`, `wet(center, radius)`, `dry(seconds)`.
- `Sparks`: short yellow-white crackle streaks: `burst(pos, count, speed)`.

## Q · Arc Lance (`arcLance.ts`, label `arc lance`, `enemy`, range 11, cd 3, damage 50)
0–0.2: she points the staff; sparks crackle along it. **0.45 hit**: a horizontal lightning tree jumps from the staff
tip to the target (trunk 0.2 wide, two forks at the target splitting into the ground), white core, dark outline; the
target flashes; a yellow accent spark (2 frames); a puddle ripple and 3 small ground forks at its feet; a small ground
`ShockRefraction` (0.03). One impact frame `[1]` at 0.03 s. `ctx.hit(target, { damage: 50, knock: 2, color: STORM_CSS.body })`.
0.6–1.4: the bolt flickers out in steps, sparks fade. Clean by 1.5.

## W · Downpour (`downpour.ts`, label `downpour`, `ground`, radius 4, range 10, cd 7, damage 40 + 15)
0–0.4: a dark storm cloud gathers 7 above the point (radius 4); rain sheets start falling inside the circle;
puddle ripples appear on the floor. **0.7 hit**: three lightning trees strike down from the cloud at once (into the
enemies inside, else random spots), cloud underside flashes, ground forks, ripples, shake 0.35.
`ctx.hit(e, { damage: 40, knock: 0 })` for enemies within 4. **1.3**: one more bolt into the centre:
`ctx.hit(e, { damage: 15, knock: 0 })`. 1.4–2.2: rain thins, cloud disperses, wet floor dries. Clean by 2.3.

## E · Static Field (`staticField.ts`, label `static field`, `self`, radius 5, cd 9, 2 × 14)
0–0.3: a small cloud forms over her head; the rain cloak crackles. 0.3–2.6: a ring of crackling arcs circles her at
radius 1.5 (short lightning segments hopping around the ring) and light rain falls around her. Pulses at 1.0 and 2.0:
the cloud flashes and a lightning tree jumps from her to every enemy within 5 (one bolt each),
`ctx.hit(e, { damage: 14, knock: 1 })`. 2.6–3.0: the cloud breaks up. Clean by 3.2. Telegraph ends at the first pulse.

## R · Eye of the Storm (`eyeOfTheStorm.ts`, label `eye of the storm`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **vast storm wheel** turns over the zone and drops one colossal lightning tree.
0–0.4: she raises the staff; the world darkens (`darken` 0.65, tint `#0a1220`); wind-blown rain starts across the
whole zone. 0.3–1.6: a ring of dark storm cloud (radius 7, height 7–8) forms and starts turning, with a clear eye in
the middle; lightning flickers inside the cloud wall (small trees, cloud flashes); rain sheets slant around the ring;
puddles everywhere. 1.6–1.9: the eye narrows, everything brightens inside the cloud — **dead beat 1.85–2.0** (rain
freezes mid-air). **2.0–2.2**: a colossal lightning tree (trunk 0.7 wide, many branches) slams down through the eye
onto the point and forks out across the floor to every enemy within 7. **2.2 hit**: impact frames `[1, 2]` at
0.04 s (silhouettes on a pale card), ground `ShockRefraction` (1 → 12, 0.07), yellow accent star at the centre, shake
0.8. `ctx.hit(e, { damage: 125, knock: 6, from: point })`. 2.2–4.5: the bolt flickers out, the cloud ring breaks up,
the rain stops, the floor dries. Clean by 4.5.
