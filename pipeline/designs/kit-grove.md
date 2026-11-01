# Grove kit: Fenna, the Grove Warden

## Role (2026-10-30)
**Support**, 640 HP. Signature: *Regrowth*. Heals through the trade and roots.
- Q Bloom Lash: 54 damage (no self-heal).
- W Overgrowth: now `enemy` mode, range 9 (`cc`): vines grow up round the chosen enemy (zone radius 2 round where it stood), 45 damage and **root 1.2** at 0.75 s if it is still within 2 m; tick 10.
- E Verdant Ward: a TURRET (`summon`, ground mode, range 9, cd 12): one flowering vine (80 HP, 6 s, 12 per shot every 1.4 s, range 8). The three growing vines are the assembly; the unit has its own blossom look (`blossomLook` in the spell file).
- R World Blossom: a SELF-R (`cc`, range 0, radius 7 to 5): the flower closes over her, **heal 70** at the slam, 130 damage and **slow 2.0** to everything within 5 m.

**Signature shape: the spiral vine that blooms.** Thick green vines grow in **spirals** (a coiling stem with leaf
pairs along it), and at the end of every spiral a **giant flower bursts open** (5–7 broad petals in a cup, a bright
pollen core), then sheds petals and pollen. Growth is the motion: things grow out of the ground in seconds. Not
thorns (blood and the existing thornwood): soft, curling, leafy and flowering.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a forest warden with antler-like branches in her hair and a living staff; roots, binds, blooms.
  **Category:** `hero: grove`. **Parts file:** `src/effects/parts/grove.ts`. **Kit:** `src/kits/grove.ts` (`groveKit`).
- **Palette** (`GROVE` / `GROVE_CSS`): core `#fffbe0` (tiny) → hot `#ffe36a` (pollen) → body `#4caf50` (leaf green)
  → accent `#ff7ab8` (petal pink, 2–3 frames at hits) → dark `#14260f`; **foil** bark cream `#e8dcc0` (the inner face
  of petals, pale bark, the seed rings).
- **Material rules:** vines = a lit tube (dark green underside, body, a lighter top line) with leaf pairs as flat
  two-tone cards; petals = flat broad cards, cream inner face and pink rim, opening to ≤ 40° (a cup, art bible);
  pollen = few small soft gold motes, additive at low opacity.

## Shared parts (`grove.ts`)
- `GROVE`, `GROVE_CSS`.
- `SpiralVine`: a coiling vine growing along a path: `grow(base, dir, length, coils, width, seconds)`, leaf pairs every
  few segments, `wither(seconds)` (browns and sinks), `reset()`.
- `Bloom`: a giant flower: `open(pos, size, seconds)`, `shed(seconds)` (petals drift down), `close(seconds)`.
- `Petals`: instanced falling/spinning petals: `burst(pos, count, speed)`, short life.
- `Pollen`: soft gold motes: `puff(pos, count)`, `drift(center, radius, count)`.
- `RootRing`: a ground decal of roots spreading from a point: `spread(center, radius, seconds)`, `fade(seconds)`.

## Q · Thorned Tendril (`bloomLash.ts`, label `bloom lash`, `enemy`, range 10, cd 3, damage 50)
0–0.2: she sweeps the staff; a vine bursts from the ground at her feet. **0.5 hit**: the vine spirals across the
ground to the target and up around it (2 coils), and a flower bursts open on top (size 1.2); pink accent (2 frames),
petal burst, a small ground `ShockRefraction` (0.03). `ctx.hit(target, { damage: 50, knock: 1, color: GROVE_CSS.body })`.
0.9–1.5: the flower sheds, the vine withers and sinks. Clean by 1.6.

## W · Overgrowth (`overgrowth.ts`, label `overgrowth`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: roots spread from the point (radius 4). 0.3–0.7: 6–8 spiral vines grow up out of the roots, coiling around the
enemies inside and holding them (sink 0.1). **0.75 hit**: every vine bursts into a flower at once (a ring of blooms),
pollen puffs, shake 0.35, ground `ShockRefraction` (1 → 5, 0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4;
a tick at 1.3: `ctx.hit(e, { damage: 10, knock: 0 })`. 1.4–2.2: the flowers shed, the vines wither, the roots fade.
Clean by 2.3.

## E · Verdant Ward (`verdantWard.ts`, label `verdant ward`, `self`, radius 5, cd 9, 2 × 13)
0–0.3: three vines rise around her and spiral upward (radius 1.2), a flower opens on each. 0.3–2.6: the flowers turn
to face outward; at 1.0 and 2.0 each flower fires a jet of pollen and petals at every enemy within 5 (a short petal
stream that lands in a small puff): `ctx.hit(e, { damage: 13, knock: 1 })`. 2.6–3.0: the vines wither. Clean by 3.2.
Telegraph ends at the first pulse.

## R · World Blossom (`worldBlossom.ts`, label `world blossom`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **colossal flower** grows out of the zone, closes over it and bursts.
0–0.4: she plants the staff; the world darkens to a green dusk (`darken` 0.5, tint `#14260f`); roots spread over the
whole radius 7. 0.3–1.5: a thick trunk of braided spiral vines grows up from the point to ~6 high; a giant bud forms
on top and opens into a flower ~8 wide (petals in a cup, cream inside, pink rim); pollen falls; vines hold the enemies
(pull 0.5 toward the centre). 1.5–1.85: the flower closes its petals around the zone like a fist — **dead beat
1.85–2.0** (everything still, pollen hanging). **2.0–2.2**: the petals slam down onto the zone. **2.2 hit**: impact
frames `[1, 2]` at 0.04 s, a ring of smaller flowers bursts open across the radius, petals and pollen explode
outward, pink accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75.
`ctx.hit(e, { damage: 125, knock: 6, from: point })` within 7. 2.2–4.5: petals rain down and fade, the vines wither,
the roots fade, the darken lifts. Clean by 4.5.
