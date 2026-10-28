# Colossus Drop (cutscene ultimate)

- **Label:** `colossus drop` · **File:** `src/spells/targeted/colossusDrop.ts` · **Module:** `colossusDropModule`
- **Targeting:** `enemies`, `maxTargets: 8`
- **Palette (core → hot → body → accent → dark):** white `#ffffff` → thruster cyan `#7ff0ff` → hull steel `#6a7a8a` → warning orange `#ff8a2a` → hull dark `#0e1218`
- **The shape that makes it ours:** a **cinematic mecha drop** (~45 s) with the scripted camera: a giant mech (built from boxes/cylinders: armoured torso, shoulder pauldrons, a head visor, arms, legs; steel and orange stripes) **drops from orbit** on retro-thrusters, lands in the arena, **charges a chest cannon** and fires a sweeping beam across the enemies, then rises away.
- **Recipes:** `a-ow-doomfist-meteor-strike` (a landing marked from above), `a-val-brimstone-orbital-strike` (a strike called from orbit), `g-castorice-dragon-breath-crater` (a breath beam that leaves a crater), `a-lol-lux-final-spark` (a long charge, short release beam)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Camera
Use the cinematic camera exactly like `src/spells/targeted/genesisCollapse.ts` (reviewed): `readonly cinematic = createCinematic()`, keys built in `cast()`, hard cuts, letterbox in/out, `clearCinematic` in reset and at the end. Do not move the real arena caster (hide/restore like genesis does if needed).

## Timeline (~45 s, acts)
1. **0-5 Call.** Letterbox in. Close shot on the caster raising a signal flare (orange); cut to the sky: a red targeting ring appears on the ground in the arena.
2. **5-14 Drop.** Cut high up: the mech falls from the upper atmosphere, a heat-shield glow (orange toon band on its underside, not a white blob), clouds whip past; follow shot from beside it falling; cut to ground level looking up as it grows.
3. **14-18 Landing.** Retro-thrusters fire (cyan jet cones, toon), it slams down: dust walls, impact frames (short), ground cracks; enemies get a small hit (damage 10, knock 4).
4. **18-28 Reveal.** Slow low-angle push-in on the standing mech (held 4 s), visor lights up, steam vents; then over-the-shoulder shot from behind the mech toward the enemies.
5. **28-36 Charge.** The chest cannon opens (panels slide), energy gathers (cyan particles pulled in, rings), escalate in 2 stages; close-up on the cannon; dead beat 0.6 s.
6. **36-39 Fire.** A thick beam (dark under-beam, cyan core) sweeps across all targets left to right; each target is hit as the beam crosses it: `ctx.hit(e, { damage: 90, knock: 8 })` once each; explosions follow the sweep (orange, toon, small black smoke).
7. **39-45 Exit.** Wide shot: the mech's thrusters fire and it rises out of frame; letterbox out; calm wide of the scorched sweep line.

Set `duration` (~45, a setting) and `telegraphs` (a `line`/circle under the sweep from 28 s until the beam crosses).
