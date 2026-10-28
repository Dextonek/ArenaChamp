# Genesis Collapse (cutscene ultimate)

- **Label:** `genesis collapse` · **File:** `src/spells/targeted/genesisCollapse.ts` · **Module:** `genesisCollapseModule`
- **Targeting:** `enemies`, `maxTargets: 8`
- **Palette (value ladder core → hot → body → accent → dark):** white `#ffffff` → star gold `#ffe08a` → plasma orange `#ff7a2a` → cosmic violet/teal `#8a5aff` / `#3ad8c8` → space black `#030308`
- **The shape that makes it ours:** a **cinematic ultimate** (~60 s) with a scripted camera: the caster ascends out of the atmosphere, the camera pulls out to orbit, the caster **forges a star** from orbiting matter, **hurls it down** at the arena, and the camera watches the impact from orbit, then cuts back down to the scorched arena.
- **Recipes:** `g-castorice-dragon-rise-cutscene` (shot grammar, held reveal), `g-castorice-wing-nova-finisher` (finisher pacing), `b-lost-ark-sorceress-doomsday` (a falling celestial body at huge scale), plus `docs/VFX_PRINCIPLES.md` §10 (charge in a void, hit in the world; close → wide → ground → reveal; transitions are VFX)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Camera
Use the new cinematic camera (`src/effects/parts/cinematic.ts`): put `readonly cinematic = createCinematic()` on the effect, set `cinematic.active = true` during the cutscene, drive it with `sampleShots(keys, t, this.cinematic)` from a key list built in `cast()` from the context (caster position, target centroid), set `cinematic.letterbox` 0 → 1 at the start and 1 → 0 at the end, and `clearCinematic` in reset and at the end. Hard cuts use `cut: true`. Keep each held shot 2-6 s, lead-in shots 0.3-1 s.

## Timeline (~60 s, acts)
1. **0-6 s, Resolve.** Letterbox in. Close-up on the caster (low angle, fov 30), wind lines; gold motes rise around the caster; the world darkens. Cut to a wide shot: the caster alone in the arena with enemies around, sky darkening.
2. **6-14 s, Ascension.** The caster rises (move the caster group up via `ctx.caster.group.position` and restore at the end, or draw a stand-in glowing figure; prefer a stand-in so the arena caster is untouched) in a column of light; camera follows from below (roll a little), then a hard cut to a high shot looking down as the arena shrinks. Clouds (big soft disks, normal blend) whip past the camera.
3. **14-22 s, Orbit.** Transition with a 0.4 s diagonal speed smear (screen chroma + white streak quads). The scene becomes space: build a huge planet curve below (a large sphere, dark blue with a thin bright atmosphere rim, the arena as a tiny lit spot), stars (points). The caster figure floats; held wide shot with a slow 10% push-in.
4. **22-36 s, Forge.** Matter spirals in around the caster: rings of rock and gas (instanced debris, colour bands), accretion disk (flat ring with scrolling bands), lightning between chunks; escalate in three colour stages (teal → violet → gold) each marked by one inverted frame. Close-ups alternate with wide shots every 2-4 s. The proto-star grows at the centre (hard star flare + small core, not a glow ball over shapes) to a blazing sun; the camera is pushed back by its light (exposure ramp).
5. **36-42 s, Throw.** Dead beat: total stillness for 0.6 s. The caster throws: hard cut to behind the star as it falls toward the planet, trail of plasma, atmosphere entry flames (the planet rim flares). Cut to the arena from ground level: the sky turns orange, enemies look up (small), the falling star grows in the sky.
6. **42-50 s, Impact.** From orbit (wide): a bright flash dot on the planet, then a ring of light spreading across the surface; cut to ground level: whiteout ramp, impact frames (short), shock dome, every enemy: `ctx.hit(e, { damage: 120, knock: 10 })` once at the impact time. Dust walls rush past the camera.
7. **50-60 s, Aftermath.** Cut to a calm wide shot of the arena: scorched crater, glowing cracks cooling, embers falling, the caster (back at the original position) standing with motes drifting down. Letterbox out over the last 1.5 s, `cinematic.active = false` at the end.

Telegraph: a big `circle` (radius 7) at the target centroid from 36 s until the impact. Keep the duration tunable (`settings.duration`, default 60; scale the act times with it if easy).

## Exaggerate
Scale jumps (caster → planet → star); hold shots long enough to read; silence (dead beats) before each big moment.
