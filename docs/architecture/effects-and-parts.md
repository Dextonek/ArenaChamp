---
title: Effects and shared parts
tags: [architecture, effects, parts, kits, weapons]
updated: 2026-10-29
---

# Effects and shared parts

The contract every effect implements (`Effect` / `EffectModule` in [types.ts](../../src/effects/types.ts)) and a catalogue of the reusable building blocks: the core parts in `src/effects/parts/`, the hero-kit parts files, the shared helpers in [common.ts](../../src/effects/common.ts) and the weapons kit in `src/effects/weapons/`. Read it before writing a spell so you reuse a part instead of re-inventing it.

## The `Effect` contract

An `Effect` is one timed set piece that [main.ts](../../src/main.ts) plays, steps and renders.

| Member | Meaning |
|---|---|
| `group: THREE.Group` | everything the effect draws; main adds it to the scene and toggles `visible` |
| `emitters: Emitter[]` | particle emitters inside `group`; main keeps their point-size scale in sync with the viewport (add every emitter, including a part's, e.g. `SmokeBall.emitter`) |
| `shake: number` | camera shake for this frame in world units, read every frame (0 = none) |
| `screen?: ScreenFx` | optional full-screen feedback (see [core parts](#core-parts-srceffectspartsts)) |
| `cinematic?: Cinematic` | optional scripted camera with letterbox |
| `playing: boolean` | true while the timeline runs; hero mode relies on it to keep an effect alive as a lingering cast |
| `play()` | restart from the beginning (main wraps it, see [overview](overview.md#effect-slots-lazy-build-setmode-active)) |
| `update(dt)` | advance; must keep emitters updating even when not playing |
| `cast?(ctx: CastContext)` | targeted effects only; called right before each `play()`. Read positions from the context, never from `ENEMY_POS` / `CASTER_POS` |

Optionally an effect exposes `duration` (seconds); main reads it (untyped) for the hotbar progress bar.

## The `EffectModule` registry entry

| Field | Meaning |
|---|---|
| `label` | name in the mode dropdown and the key for `vfx.selectMode` and hero-kit spells |
| `category?` | dropdown group (default `'set pieces'`) |
| `create()` | builds the `Effect` (called lazily on first selection) |
| `bloom` | `BloomSettings` applied when the mode is selected |
| `frameCamera(camera, controls, effect)` | puts the camera where the whole effect is visible; helpers `frameArena` ([common.ts](../../src/effects/common.ts)) and `frameCast` ([targeting.ts](../../src/effects/targeting.ts)) |
| `buildGui(folder, effect)` | adds the effect's controls (main adds `play` and `frame camera`) |
| `telegraphs?(effect)` | danger zones read on each play, see [targeting-and-arena.md](targeting-and-arena.md#telegraphs-telegraphts) |
| `targeting?: TargetingSpec` | marks a targeted effect: main shows the shared arena and calls `cast()` before each play; the effect must not create its own caster or enemies |

Registries and categories are described in the [overview](overview.md#registries-and-categories).

## Core parts (`src/effects/parts/*.ts`)

[parts/index.ts](../../src/effects/parts/index.ts) re-exports the core parts and the blood kit. The forge, frost, astral, alchemy, grove, dawn, tide, sky, bone, clockwork, prism, hive and bard files are **not** re-exported there; import them from their own file (e.g. `../../effects/parts/forge`).

| Part | File | What it is | Main methods / fields |
|---|---|---|---|
| `ScreenFx` (+ `createScreenFx`, `clearScreenFx`) | [screen.ts](../../src/effects/parts/screen.ts) | state object for full-screen feedback: `darken` + `tint`, `impact` frames 0-4 (dark / light / X-ray / outline cards) with `silhouettes`, `speedLines` at `focus`, `exposure`, `whiteout`, `chroma` + `edgeTint`, `desaturate` + `keepHue`, `crack`, `shatter` | `createScreenFx()`, `clearScreenFx(fx)` (call in `reset()`) |
| `impactFrameAt`, `flashBeat`, `chromaPulse` | [screen.ts](../../src/effects/parts/screen.ts) | timeline helpers for the above | `impactFrameAt(t, start, pattern, frameTime)` returns the impact mode at `t`; `flashBeat(t, flash, hold, fade, antiDepth)` returns `{ exposure, whiteout }` (anti-flash then whiteout); `chromaPulse(t, hit, peak, decay)` |
| `StarBurst` | [starBurst.ts](../../src/effects/parts/starBurst.ts) | hard-edged spiky camera-facing star (impact pop, glint); coloured outer star plus rotated white core | `mesh`, `set(pos, size, opacity, spin)`, static `pop(age, hold, shrink)` (scale-in, hold, shrink curve) |
| `CrescentArc` | [crescentArc.ts](../../src/effects/parts/crescentArc.ts) | crescent / wind / slash stroke along a circular arc in the mesh's local XY plane, soft or toon style, with erosion | `mesh`; setters `head` (0..1 sweep), `length`, `erosion`, `opacity`, `time`; colours `edgeColor`, `midColor`, `outerColor` |
| `LightningArc` | [lightningArc.ts](../../src/effects/parts/lightningArc.ts) | thick camera-facing jagged bolt with forks and flicker, world-unit width | `mesh`, `opacity`, `setEnds(a, b)`, `reroll()`, `update(dt)` |
| `SmokeBall` | [smokeBall.ts](../../src/effects/parts/smokeBall.ts) | toon black smoke balls (normal-blended) that bulge then break into flakes; pool of `maxBalls` | `mesh`, `emitter` (add to `emitters`), `trigger(pos, size, life)`, `clear()`, `update(dt)` |
| `Cinematic` (+ `createCinematic`, `clearCinematic`, `sampleShots`, `ShotKey`) | [cinematic.ts](../../src/effects/parts/cinematic.ts) | scripted camera state (`active`, `position`, `target`, `fov`, `roll`, `letterbox`) and a keyed shot sampler with cuts and easing (`linear`, `in`, `out`, `inOut`) | `sampleShots(keys, t, out)` |
| `HeatHaze` | [distortion.ts](../../src/effects/parts/distortion.ts) | rising heat shimmer in a camera-facing quad, drawn only into the distortion buffer | `mesh`, `set(pos, strength, time, scale)` (strength in screen UV; good range 0.008-0.02; 0 hides) |
| `ShockRefraction` | [distortion.ts](../../src/effects/parts/distortion.ts) | expanding refraction ring (shockwave bend), `facing` `'ground'` or `'camera'` | `mesh`, `set(center, radius, strength)` (0.015-0.04 at impact, decaying) |
| `DISTORT_LAYER` | [distortion.ts](../../src/effects/parts/distortion.ts) | the layer index (6) the distortion buffer renders | constant |

## Hero-kit parts

Each kit is a pooled, toon-shaded set of parts with a palette export (`BLOOD` / `FORGE` / `FROST` / `ASTRAL` / `ALCHEMY` / `GROVE` / `DAWN` / `TIDE` / `SKY` / `BONE` / `CLOCKWORK` / `PRISM` / `HIVE` / `BARD` numbers for `THREE.Color`, plus a `*_CSS` string version). Materials stay below the bloom threshold (about 0.85) except a few tiny dots. Almost everything takes world-space positions, has `reset()` and (when animated) `update(dt)`, and exposes a `mesh` to add to the effect group. Designs live in `pipeline/designs/` (`blood-kit.md`, `kit-forge.md`, `kit-frost.md`, `kit-astral.md`, `kit-alchemy.md`, `kit-grove.md`, `kit-dawn.md`, `kit-tide.md`, `kit-sky.md`, `kit-bone.md`, `kit-clockwork.md`, `kit-prism.md`, `kit-hive.md`, `kit-bard.md`).

### Blood: [blood.ts](../../src/effects/parts/blood.ts)

Liquid blood that hardens to crystal; bone sigil as the pale foil.

| Part | What it is | Main methods |
|---|---|---|
| `BloodTendril` | tapered viscous rope with a bead at the tip | `setPoints(points)` or `setFunction(fn)`, `reveal(head, tail)`, `update(t)` |
| `BloodSplats` | pool of wet ground splats (instanced decals) | `add(pos, size)`, `fadeOutAll(s)` |
| `BloodPool` | big dark wet pool with a lumpy edge | `place(center)`, `spread(radius, s)`, `dry(dryTime, fadeTime)` |
| `BloodDrops` | pooled teardrops with gravity; leave splats | `emit`, `spray(pos, dir, count, speed, spread)`, `drain(...)` (drops arc home to a moving target, `onArrive`) |
| `BloodThorns` | instanced crystal spikes | `spike(base, dir, length, width, grow, delay)` returns a handle, `place(handle, ...)`, `erupt(...)` ring or disc, `shatter(...)`; `glint` / `glintAt` |
| `BloodSigil` | canvas-drawn bone crest | `set(center, normal, radius, spin)`, `reveal`, `opacity` |

### Forge: [forge.ts](../../src/effects/parts/forge.ts)

Molten slag that cools, heavy iron with hot edges, sparks, steam and ash (pale foil).

| Part | What it is | Main methods |
|---|---|---|
| `SlagPool` | molten ground decal; crust grows in as it cools; web mode for the ultimate | `place`, `spread(radius, s)`, `cool(s, delay)`, `fade(s, delay)` |
| `SlagBlobs` | thrown molten blobs that become small cooling splats on landing (cap about 10) | `throw(pos, vel, size)` |
| `SlagStreams` | continuous molten ropes along a per-frame path | `set(i, fn, head, tail, radius, cool, time)`, `hide(i)` |
| `Sparks` | streak sparks, life about 0.4 s | `burst(pos, dir, count, speed, spread)` |
| `ForgeIron` | builders for heavy meshes (hammer, anvil, rivet) with heat-driven edge lines | `make(geo, scale)`, `heat(mesh, h)` |
| `IronChunks` | broken iron that bounces, cools and sinks | `burst(center, count, speed, size, heat, life, spreadXZ)` |
| `ChainRing` | loop of heavy chain links around a vertical axis | `place(center, radius, y, spin, heat, wobble)` (every frame), `linkPos(...)` |
| `QuenchSteam` | toon steam wisps (ash foil, optional cold accent) | `puff(pos, size, accent)` |
| `AshFlakes` | falling ash | `fall(center, radius, count, height, life)` |
| `HotStreak` | short fat comet trail | `set(head, tail, width, alpha)` |
| `ForgeSigil` | canvas-drawn ground ring with runes | `set(center, radius, spin)`, `reveal`, `opacity`, `glow` |
| `PulseRing` | expanding ground ring of heat | `set(center, radius, opacity, thickness)` |

### Frost: [frost.ts](../../src/effects/parts/frost.ts)

Rime ferns, clear faceted ice, snow and breath mist.

| Part | What it is | Main methods |
|---|---|---|
| `IceShards` | small angular shards with gravity and spin | `emit`, `burst(pos, count, speed, life, size)` |
| `IceCrystals` | instanced hexagonal ice prisms with a pale core line | `spike(base, dir, length, width, grow, delay, fromTip)`, `place`, `cluster(...)`, `shatter(...)`, `flare` |
| `FrostFerns` | ground decal of branching rime | `grow(center, radius, s, delay)`, `shatter(fadeSeconds)`, `fade(s)` |
| `RimeSleeves` | rime climbing up figures | `set(i, feet, height, radius, grow, opacity)`, `clear()` |
| `RimeRing` | rime ring racing across the floor | `set(center, radius, width, opacity)` |
| `IceStreak` | tapered pale streak (javelin wake) | `set(head, tail, width, opacity)` |
| `Snow` | snowflake pool | `swirl(...)`, `fall(...)`, `scatter(...)`, `stop()`; `frozen`, `size` |
| `FrostBreath` | cone of toon mist puffs | `blow(from, dir, length, seconds)` |

### Astral: [astral.ts](../../src/effects/parts/astral.ts)

Constellations: four-point stars, gold lines, light arrows, parchment chart (pale foil), night veil (dark layer).

| Part | What it is | Main methods |
|---|---|---|
| `StarPoints` | instanced four-point stars | `add(pos, size, delay)` returns a handle, `drop(...)`, `place`, `position`, `setSize`, `remove`, `fall(i, vel, life)`, `fallAll`; `twinkle` |
| `ConstellationLines` | gold segments that draw themselves | `connect(a, b, seconds, delay)` returns a handle, `move(i, a, b)`, `snap(s)`, `fadeOut(s)` |
| `StarArrow` | bright head with a long tapered gold tail | `fly(from, to, seconds)`; `onArrive` callback |
| `StarChart` | parchment star-chart ring on the ground | `set(center, radius)`, `reveal`, `opacity`, `hole`, `spin` |
| `NightVeil` | translucent dark-violet night, ground disc or dome | `set(center, radius, height)`, `setPlane(center, normal, rx, ry)`, `opacity` |

### Alchemy: [alchemy.ts](../../src/effects/parts/alchemy.ts)

Glass flasks, bubbling acid, fumes, a glass-ink circle (pale foil), transmutation gold.

| Part | What it is | Main methods |
|---|---|---|
| `Flask` | thin-walled round flask with sloshing acid | `scale`, `slosh(t, amount)`, `lob(from, to, height, u)` |
| `GlassShards` | instanced flat glass shards (or gold flakes) | `burst(pos, count, speed, opts)` |
| `Bubbles` | acid bubbles that rise, swell and pop into rings | `emit(pos, size, opts)`, `splash(pos, size)` |
| `AcidPool` | bubbling acid ground decal | `spread(center, radius, s)`, `drain(s)`, `bubbleAt(x, z, size, life)`; `boil` |
| `Fumes` | dark toon fume wisps (default cap 8) | `puff(pos, size, drift, rise)` |
| `Droplets` | acid droplets flying an arc | `fire(from, to, seconds, size, delay)`; `onLand` callback |
| `TransmuteCircle` | glass-ink alchemical circle | `set(center, radius)`, `reveal`, `opacity`, `lit` (0..6), `hole` |
| `AcidColumn` | acid blob that morphs from column to sphere | `configure(base, height, radius, sphereCentre, sphereRadius)`, `update(time, morph, wobble)` |
| `FigureShell` | slightly larger copy of an arena figure's silhouette; `'gold'` statue with `crack` / `flash`, or `'rim'` green fresnel | `follow(source, grow)`, `reset()` |

### Grove: [grove.ts](../../src/effects/parts/grove.ts)

Spiral vines that end in giant flowers, petals and pollen (bark cream as the pale foil).

| Part | What it is | Main methods |
|---|---|---|
| `SpiralVine` | coiling vine with leaf pairs | `grow(base, dir, length, coils, width, seconds, opts)`, `growAlong(fn, width, seconds, delay)`, `wither(seconds, delay)`, `pointAt(u, out)` |
| `Bloom` | giant flower of broad petals around a pollen core | `open(pos, size, seconds)`, `shed(seconds)`, `close(seconds)`, `aim(yaw, lean)`, `hide()` |
| `Petals` | instanced falling and spinning petals | `burst(pos, count, speed)`, `rain(center, radius, count, height, life)`, `stream(from, to, count, seconds)` |
| `Pollen` | soft gold motes | `puff(pos, count)`, `drift(center, radius, count, height, life)` |
| `RootRing` | ground decal of roots spreading from a point | `spread(center, radius, seconds)`, `fade(seconds, delay)` |

### Dawn: [dawn.ts](../../src/effects/parts/dawn.ts)

Hard-light panels that click together into shields, blades and a great sword (ivory as the pale foil). Also exports the helpers `dawnFacing`, `dawnForward`, `dawnView`, `dawnOrient`, `dawnPanelNormal` and the easing curves `dawnEaseOut`, `dawnEaseOutBack`.

| Part | What it is | Main methods |
|---|---|---|
| `LightPanels` | instanced hex / shield / shard panels | `assemble(seconds, stagger, scatter, origin)`, `fadeOut(seconds, stagger)`, `fling(i, vel, life, spin)`, `shatter(speed, life, center)`, `hide(i)` |
| `HaloRing` | crisp gold ring with an ivory inner band and ray ticks | `set(center, normal, radius)`, `spin(dt)`, `opacity` |
| `SunRays` | a few thin tapered wedges fanning from a point | `fan(origin, dir, count, length, spread, grow, width)`, `fade(k)`, `face(aim)` |
| `Sigil` | gold ground circle with a sun-wheel pattern | `set(center, radius)` |

### Tide: [tide.ts](../../src/effects/parts/tide.ts)

Smooth water ribbons with a foam crest, droplets and crown splashes (foam as the pale foil).

| Part | What it is | Main methods |
|---|---|---|
| `WaterRibbon` | thick smooth water band with a foam crest on the head | `setPath(points, width, head, tail, time)`, `setFunction(fn, width, head, tail, time)`, `hide()` |
| `Droplets` | instanced spinning teardrops with gravity | `spray(pos, dir, count, speed)`, `drop(pos, vel, life, size)` |
| `SplashCrown` | foam crown splash on the floor | `burst(pos, size, life)` |
| `WaterPool` | shallow ripple pool decal | `spread(center, radius, seconds)`, `ripple(pos)`, `drain(seconds)` |
| `SerpentHead` | serpent head of the ultimate (foam mane, eye glints) | `place(pos, dir, scale, open)`, `hide()` |

### Sky: [sky.ts](../../src/effects/parts/sky.ts)

Flat wind crescents, thin gust ribbons, speed lines and blown leaves (cloud as the pale foil). Exports `SKY` / `SKY_CSS` and the `SlashOptions` type.

| Part | What it is | Main methods |
|---|---|---|
| `WindCrescent` | pooled flat unlit sickles with a hot leading edge and needle tips | `slash(center, dir, radius, arcDeg, tilt, seconds, opts)`, `put(pos, yaw, tilt, radius, arcDeg, head, opacity, width, tone)` (immediate mode for swarms, call every frame after `update`); `frozen` holds time for a dead beat |
| `GustRibbon` | thin spiral gust band with a hot centre line | `spiral(center, radius, height, turns, seconds, width)`, `along(points, width, seconds)`, `setFunction(fn, width, head, tail, time, opacity)`, `hide()` |
| `SpeedLines` | pale streaks | `burst(pos, dir, count, length)`, `sweep(a, b, count, length, minLife)` |
| `Leaves` | tumbling two-tone leaves | `spawn(pos, vel, life, size)`, `blow(pos, dir, count, speed)` |

### Bone: [bone.ts](../../src/effects/parts/bone.ts)

Chunky ivory bone architecture with teal soulfire (bone ivory as the pale foil). Exports `BONE` / `BONE_CSS`, the shared `boneChunkGeometry` and `boneMaterial`, and `skeletonLook`.

| Part | What it is | Main methods |
|---|---|---|
| `BoneSpire` | stack of tapering bone segments, optionally skull-capped | `grow(pos, height, seconds, lean, leanAngle, delay)`, `crumble(seconds, delay)` |
| `SoulWisps` | small teal teardrop flames | `attach(pos, count, spread, size)`, `puff(pos, count, spread, size)`, `release()` |
| `BoneDust` | pale dust puffs | `burst(pos, count, speed, size)`, `ring(center, radius, count, size)` |
| `BoneShards` | flying bone chips | `shoot(pos, vel, life, size, g)`, `burst(pos, count, speed, up, size)`, `ring(center, count, radius, seconds, y, size)` |
| `GroundCracks` | cracked-floor decal with teal light | `spread(center, radius, seconds)`, `fade(seconds)` |
| `BoneLance` | the vertebra spear | `assemble(center, dir, k)`, `place(center, dir)`, `hide()` |
| `RibCage` | the ward's cage of curved ribs | `set(center, radius, height, grow, flex, crumble, spin)`, `pointAt(rib, s, flex, out)`, `hide()` |
| `BoneHand` | colossal skeletal hand of the ultimate | `place(base, wrist, face, pitch, curl, spread, time, scale)`, `hide()` |
| `skeletonLook` | a `MinionLook` ([mechanics](mechanics.md#the-look-pluggable-partsminionts)): a small skeleton about 0.9 high; `melee` carries a blade, `ranged` a bow, a `turret` falls back to the default look | pass as `look` in `SummonOptions` |

### Clockwork: [clockwork.ts](../../src/effects/parts/clockwork.ts)

Machined copper and brass gears, springs and chains with cyan sparks (steel as the pale foil). Exports `CLOCKWORK` / `CLOCKWORK_CSS`, `gearGeometry`, `teethFor` and `turretLook`.

| Part | What it is | Main methods |
|---|---|---|
| `Gear` | pooled flat toothed gears (`GearOptions`) | `place(pos, normal, radius, spin, opts)`, `assemble(seconds)`, `move(i, pos, normal)`, `setRate`, `setRadius`, `kick(i, angle)`, `hide(i)`, `fold(seconds)`, `scatter(speed, life, origin)` |
| `Spring` | coiled spring | `set(from, to, coils, radius)`, `stretch(k)`, `hide()` |
| `Sparks` | cyan sparks | `arc(a, b, life)`, `burst(pos, count)`, `ring(center, radius, count, y)` |
| `SteamPuffs` | pale steam | `puff(pos, dir, count)` |
| `Chain` | hanging chain between two points | `set(a, b)`, `hide()` |
| `Rivet` | the spinning copper rivet | `place(pos, dir, spin)`, `hide()` |
| `turretLook` | a `MinionLook` ([mechanics](mechanics.md#the-look-pluggable-partsminionts)): a brass tripod, a spinning gear body, a short barrel and a cyan lens; other unit kinds fall back to the default look | pass as `look` in `SummonOptions` |

### Prism: [prism.ts](../../src/effects/parts/prism.ts)

Faceted clear crystals and thin spectrum beams (clear glass as the pale foil). Exports `PRISM` / `PRISM_CSS`, `SPECTRUM` (red, gold, green, blue in beam order) and the `CrystalOptions` type.

| Part | What it is | Main methods |
|---|---|---|
| `Crystal` | pooled hexagonal crystal shards, flat-shaded with a lighter top face and a dark outline hull | `place(pos, dir, length, width, opts)`, `move`, `setSize`, `setScale`, `setRoll`, `setSpin`, `hide(i)`, `shatter(speed, life, origin)`; `frozen` holds time |
| `SpectrumBeam` | camera-facing beams with a white core and thin red / gold / green / blue bands (or one tint) | `set(a, b, width, opacity, tint, tailTaper, slot)`, `split(fanDeg, count, length, width, opacity, tints)`, `fan(origin, dir, axis, ...)`, `hide(slot)` |
| `Glitter` | small flat diamond facets that flash once and fall | `burst(pos, count, speed, size)` |
| `PrismRing` | a ring of small floating prisms | `set(center, radius, count, spin, size)`, `scale(k)`, `shatter(speed, life)`, `hide()` |

### Hive: [hive.ts](../../src/effects/parts/hive.ts)

Honeycomb cells, black chitin and swarms of small wasps (wax as the pale foil). Exports `HIVE` / `HIVE_CSS`, the `HoneyStyle` and `ClawOptions` types, and `waspLook`.

| Part | What it is | Main methods |
|---|---|---|
| `Swarm` | an instanced cloud of wasps (many modes) | `set(center, radius, count, spawner)`, `stream(from, to, seconds, trail)`, `dive(point, seconds)`, `scatter(seconds, flat, speed)`, `form(fn, count, stiffness)`; `size`, `frozen` |
| `Honeycomb` | hexagonal cells that grow in and crumble (styles `'wax'`, `'chitin'`) | `grow(center, radius, seconds, inner, cell)`, `wall(center, radius, height, seconds, cell, thick)`, `dome(center, radius, height, seconds, count, cell)`, `setCenter(c)`, `crumble(seconds)` |
| `HoneySplash` | amber blobs that land as flat puddles | `burst(pos, count, speed, size, up)` |
| `ClawSlash` | pooled serrated claw crescents with an amber rim | `slash(center, dir, radius, arcDeg, tilt, seconds, opts)`; `frozen` holds time |
| `QueenBody` | the solid core of the swarm-queen of the ultimate: striped abdomen, thorax, head, stinger and four translucent wings (about 5.5 long) | `set(center, axis, wing, normal, fold, flap, k)`, `hide()` |
| `waspLook` | a `MinionLook` ([mechanics](mechanics.md#the-look-pluggable-partsminionts)): a giant hovering wasp about 0.9 m long with green eyes, mandibles and flickering wings; every unit kind gets the same wasp | pass as `look` in `SummonOptions` |

### Bard: [bard.ts](../../src/effects/parts/bard.ts)

Five-line staves, ink note glyphs, sound rings and a golden lyre (parchment as the pale foil). Exports `BARD` / `BARD_CSS`, the `GLYPH` atlas indices (`quarter`, `eighth`, `beamed`, `clef`, `rest`) and the `NoteOptions`, `RideOptions` and `RingOptions` types.

| Part | What it is | Main methods |
|---|---|---|
| `Stave` | a five-line music stave along a path, gently waving | `setPath(points, width, head, tail)`, `setRange(head, tail)`, `wave(amplitude)`, `at(u, out)`; `alpha` |
| `Notes` | pooled note glyphs in dark ink with a rose rim (gold for heals), one instanced mesh | `emit(pos, vel, count, life, opts)`, `ride(stave, u, glyph, opts)`, `hold(pos, glyph, size, gold)`, `move`, `resize`, `kill`, `fall(gravity, life)`, `scatter(origin, speed, life, gravity)`; `frozen` holds time |
| `SoundRings` | quick thin sound rings, a white leading edge and a rose body | `pulse(center, radius, seconds, normal, opts)` |
| `Lyre` | the golden lyre (about 1 m tall at scale 1, seven strings) | `show(pos, scale, yaw)`, `place`, `strum(strength)`, `pull(k)`, `shimmer(rate)`, `hide()` |

## Shared helpers: [common.ts](../../src/effects/common.ts)

| Export | What it is |
|---|---|
| `Enemy` (+ `FigureOptions`) | the hooded, horned figure used for targets, the caster and the dodge dummy; `group`, `material` (robe), `trim`; `setHome(p)`, `reset()`, `setFlash(v, tint?)`, `setCrush(v)` (0 standing .. 1 flattened). The arena's HP/flash logic owns these on arena figures |
| `createCaster(color)` | the golden caster (`facing` pi so it looks toward -Z) |
| `createGround(radius = 60)` | slate-slab ground disc named `ground` (play mode hides an effect's own `ground` child and uses the arena's) |
| `ENEMY_POS`, `CASTER_POS` | authoring positions for non-targeted set pieces: enemy at the origin, caster at `(0, 0, 14)` facing -Z |
| `frameArena(camera, controls, center, radius, heightBias)` | standard side-view framing from +X |
| `GlowSphere` | fresnel-rim additive energy sphere; `mesh`, `opacity`, `color` |
| `LightPillar` | vertical open-cylinder beam; `set(x, z, bottom, top, opacity)` |
| `createRing(color, inner, outer, segments)` | flat additive ring for shockwaves, rune circles and auras |
| `softDotTexture()` | soft round sprite texture |
| `createSwordGeometry`, `createSpearGeometry`, `createHammerGeometry`, `createShieldGeometry` | unit prop geometries (tip at origin pointing -Y for the sword and spear) |
| `mergeParts(parts)`, `smoothstep(x)` | geometry merge helper, easing |

## Weapons kit (`src/effects/weapons/`)

Technique: [WEAPON_VFX_GUIDE.md](../WEAPON_VFX_GUIDE.md); briefs: [WEAPON_AURA_BRIEF.md](../WEAPON_AURA_BRIEF.md). Models: [models.md](models.md).

| File | Exports | Purpose |
|---|---|---|
| [kit.ts](../../src/effects/weapons/kit.ts) | `WeaponModel`, `FlowRibbon`, `StarFlare`, `LilyBurst`, `PetalSwarm`, `PolylineSpawner`, `BladeTrail`, `alongPolyline`, `petalTexture`, `wave`, `TAU` | the aura building blocks. `WeaponModel`: GLB loaded once, cloned per effect, darkened, with an additive fresnel rim (the effect works before it loads; `rim` is the rim opacity). `FlowRibbon`: scrolling, eroding flame/silk ribbon, `update(loopT, period, cycles)`. `StarFlare`: halo + four-point glint + horizontal lens streak. `LilyBurst`: spider-lily filament burst. `PetalSwarm`: instanced petals, `emit(at, n, speed, up)`. `PolylineSpawner`: feeds a rate-0 emitter along a polyline. `BladeTrail`: swept ribbon, `push(base, tip)` while active. Everything loops on a period P |
| [aura.ts](../../src/effects/weapons/aura.ts) | `WeaponAura` (abstract), `weaponModule(label, id, create, opts)` | idle "enchant" aura: weapon at the origin of `rig` (grip at 0, head up +Y, face +Z), ignites over `activation` seconds then loops with `period`; `loopT` must drive everything periodic, hide parts with `visible = false`, never zero scale. `weaponModule` builds the registry entry (category `weapons`) |
| [sockets.ts](../../src/effects/weapons/sockets.ts) | `SOCKETS`, `WeaponId`, `fanPoint(deg, r, z)` | attach points per weapon in the weapon's own space (orb, tip, pommel, blade base, spine points, fan leaves...), taken from the Blender build scripts. Use these, never the loaded geometry (effects are created before models load) |
| [strike.ts](../../src/effects/weapons/strike.ts) | `WeaponStrike` (abstract), `strikeModule(label, create, opts)`, `Pose`, `samplePose`, `IDLE` | weapon attack: the rigged `Hero` replaces the arena caster, holds the weapon with its aura reparented into the hand (`hero.grip`), dashes to the target, strikes, walks back. Subclasses give `poses`, `duration`, `impact` and `animate()`. The capsule caster is hidden while shown and restored when main hides the effect (the group's `visible` setter is overridden). Category `weapon attacks` |
| [hero.ts](../../src/effects/weapons/hero.ts) | `Hero`, `HeroOptions`, `HERO_SCALE`, `BoneName` | the rigged wielder, see [models.md](models.md#runtime-srceffectsweaponsherots) |

## See also

- [Architecture overview](overview.md)
- [Targeting and arena](targeting-and-arena.md)
- [Hero mode](hero-mode.md)
- [Models pipeline](models.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md), [VFX principles](../VFX_PRINCIPLES.md)
