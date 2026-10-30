# Alchemy kit: Vex, the Plague Alchemist

## Role (2026-10-30)
**Mage (poison), 560 HP.** Signature: lingering poison. See hero-roles.md.
- Q Volatile Flask: ground LOB, radius 1.6, range 10, cd 3: splash 49 on whoever stands in the circle, one burn tick 12 at 1.2 s.
- W Caustic Pool: LINGER. The pool stays 4 s (drain at 3.8 s): initial hit 30, then four ticks of 7 at 1.2, 2.0, 2.8, 3.6 s, every hit slows 1.0. All hits inside 4.2 s. cd 7.
- E Mutagen: BUFF. She drinks and heals 45; no flasks, no damage, no telegraph. cd 9.
- R Grand Transmutation: LINGER. The gold field (burst at 2.0 s) stands 1.8 s (shorter than the 3 s asked: the 2 s build plus the 4.2 s limit), slows 2.0 on the gold hit (75) and on two ticks (5, at 2.8 and 3.4 s), then shatters at 3.8 s (50). cd 20, clean by 5.0 s.

**Signature shape: glass and reaction.** Thin-walled glass flasks (pale green-white glass with a dark liquid inside)
that **shatter** into sharp glass shards, releasing a **bubbling caustic liquid** (acid green, big round bubbles
that swell and pop into rings) and rising **fume curls**. The ultimate's twist: **transmutation to gold** (enemies
flash to gold statues for a beat, then crack).

Read `kit-common.md` first (files, timing, look lessons).

- **Hero:** a masked alchemist in a coat of vials; damage over time, zones, a gamble of an ultimate.
  **Category:** `hero: alchemy`. **Parts file:** `src/effects/parts/alchemy.ts`. **Kit:** `src/kits/alchemy.ts`.
- **Palette** (`ALCHEMY` / `ALCHEMY_CSS`): core `#f4ffe0` (tiny) → hot `#c8ff4a` → body `#4fbf2a` → accent `#ff5ad8`
  (magenta reaction spark, 2–3 frames) → dark `#0c1606`; **foil** glass `#dcefe6` (glass walls, shard edges, the
  alchemical circle ink); **gold** `#e8b84a` only for the transmutation.
- **Material rules:** acid = the kit's liquid shader (smooth, dark-green rim, one thin hot-green rim line, pinpoint
  specular), bubbles are separate small spheres of the same look that swell and pop into thin rings; glass =
  low-opacity pale glass with a bright rim (fresnel) so it reads as glass, shards are flat glass triangles with an
  edge line; fumes = dark green toon smoke curls (normal-blended, dark with a hot-green rim), small and few.

## Shared parts (`alchemy.ts`)
- `ALCHEMY`, `ALCHEMY_CSS`.
- `Flask`: builds a flask mesh (round body, neck, cork) with glass + liquid inside: `flask(scale)`; a helper to
  move it along a lob arc (`lob(from, to, height, seconds)`).
- `GlassShards`: instanced flat glass triangles with gravity and spin: `burst(pos, count, speed)`, short life.
- `AcidPool`: a ground decal of bubbling acid: `spread(center, radius, seconds)`, internal bubbles that swell and
  pop (rings), `drain(seconds)` (shrinks and darkens to a stain, then fades).
- `Bubbles`: instanced liquid bubbles that rise/swell and pop into a ring: `emit(pos, size)`.
- `Fumes`: dark toon fume curls that rise and twist: `puff(pos, size)`, cap ~10.
- `TransmuteCircle`: a glass-ink alchemical circle (a canvas ring with a triangle-in-circle, element glyphs, one
  script band): `set(center, radius)`, `reveal`, `opacity`, option to hide its centre.

## Q · Volatile Flask (`volatileFlask.ts`, label `volatile flask`, `enemy`, range 10)
0–0.2: she plucks a flask from her coat (a `Flask` appears in her hand, liquid sloshing). 0.2–0.55: lobbed in a high
arc to the target, spinning, a thin fume trail. **0.55 hit**: it shatters on the target: `GlassShards` burst, an acid
splash (a small `AcidPool`, radius 1.4) with 4–5 bubbles, a magenta reaction spark (2 frames), a fume puff.
`ctx.hit(target, {damage: 40, knock: 1})`, and one burn tick at 1.2: `ctx.hit(target, {damage: 12, knock: 0})`.
The pool drains by 1.8. Clean by 1.9.

## W · Caustic Pool (`causticPool.ts`, label `caustic pool`, `ground`, radius 4, range 10)
0–0.2: she throws two flasks at once (one high, one low). 0.4 and 0.5: they shatter at the point (glass shards, two
splashes). **0.6 hit**: a `TransmuteCircle` flashes on and an `AcidPool` spreads to radius 3.8, bubbling hard (big
bubbles near the enemies, rising fumes), enemies sink 0.08. `ctx.hit(e, {damage: 30, knock: 0})` at 0.6, ticks at
1.2 and 1.8: `ctx.hit(e, {damage: 12, knock: 0})` for enemies within 4. 1.9–2.5: the pool drains to a stain,
circle fades. Clean by 2.6. (This W is the slow burner of the four kits.)

## E · Mutagen (`mutagen.ts`, label `mutagen`, `self`, radius 4)
0–0.4: she drinks a flask (a flask at her head tilts up, then shatters in her hand: shards); her body takes a pulsing
green rim tint; a ring of 4 orbiting flasks appears around her at radius 1.6 (spinning, liquid sloshing). 0.4–2.6:
fumes curl up around her; at 1.1 and 2.1 the orbiting flasks flare and spit acid droplets at every enemy within 4
(a small arc of 3 drops to each, landing in a tiny splash), `ctx.hit(e, {damage: 12, knock: 0})`. 2.6–3.0: the
flasks shatter outward, fumes fade. Clean by 3.2. Loopable section 0.4–2.6.

## R · Grand Transmutation (`grandTransmutation.ts`, label `grand transmutation`, `ground`, radius 7, range 13)
The ultimate: a **giant alchemical circle** turns the whole zone and everything in it **to gold**, then breaks it.
0–0.4: she smashes a big flask on the floor at her feet; the world darkens (`darken` 0.6, tint `#0c1606`); a
`TransmuteCircle` (radius 7) draws on at the point, glass-ink lines. 0.4–1.5: a column of acid rises out of the
circle's centre to ~6 high (the kit's liquid, bubbling, with bubbles rising off it) and the circle's glyphs light
up one by one in hot green; fumes pour outward along the floor; the enemies are pulled 0.5 toward the centre.
1.5–1.85: the column coils into a sphere over the centre — **dead beat 1.85–2.0** (bubbles freeze mid-rise).
**2.0 hit**: the sphere bursts: impact frame (silhouettes on a pale glass card), a wave of gold races outward over
the circle, and every enemy inside turns **gold** (a gold tint/material flash on the arena enemy — use a gold
`MeshBasic` overlay shell or `ctx.hit` colour gold), magenta accent at the centre, ground `ShockRefraction`
(1 → 12, 0.07), shake 0.7. `ctx.hit(e, {damage: 80, knock: 0, color: gold})`. 2.0–2.6: the gold statues hold,
cracks run over them. **2.6**: they shatter into gold flakes and glass shards (`ctx.hit(e, {damage: 50, knock: 6,
from: point})`), the gold on the floor crumbles. 2.6–4.5: everything drains and fades. Clean by 4.5.
