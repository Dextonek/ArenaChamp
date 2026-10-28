# Caldera Awakening (hero tier, fully cinematic)

- **Label:** `caldera awakening` · **File:** `src/spells/targeted/calderaAwakening.ts` · **Module:** `calderaAwakeningModule`
- **Targeting:** `ground`, radius 8 (`ctx.point` is the vent)
- **Palette (core → hot → body → accent → dark):** white-yellow `#fff3c0` (tiny cores only) → lava orange `#ff7a1a`
  → magma red `#c2261a` → ash grey `#5a5560` → basalt black `#0e0b0d`
- **The shape that makes it ours:** the caster stamps, and a volcano **grows out of the arena floor**. Basalt slabs
  heave up into a cone, the crater glows, and it erupts: a lava fountain, lava bombs raining down on the enemies with
  smoking trails, a pyroclastic ash cloud rolling outward, and lava rivers in the cracks. Heat haze is everywhere: it
  is the hero distortion here.
- **Craft rules:** `docs/ART_BIBLE.md`. Lava is drawn, not a glow: dark crust plates with bright cracks between them
  (a canvas texture), so it reads as lava and not a white blob. The basalt and ash stay dark. Big smoke is allowed
  for once (the ash cloud), but it must stay below the action, never swallowing impacts, and it rolls in late.

## Model (drawn canvas textures)
- **Basalt slabs:** 20–30 hexagonal column pieces (CylinderGeometry with 6 segments) with a drawn basalt texture:
  dark rock with a lighter edge bevel and black cracks. They push up out of the floor around the point and tilt
  inward to form the cone (radius 5 at the base, about 6 tall). Small rocks fall off as they rise.
- **Crater:** at the top, a lava disc with an animated crust texture (scrolling dark plates over an orange-red glow,
  bright yellow only in thin cracks).
- **Ground cracks:** a drawn decal of radial cracks from the cone to radius 9. Lava flows along them over time (an
  animated reveal of a bright crack line under a dark crust).
- **Lava bombs:** 20–30 rocks (dodecahedra with the crust texture) launched in arcs, each with a dark smoke trail and
  a small orange core.
- **Lava fountain:** a column of toon lava blobs (orange-red with dark crust bits) shooting up 15 and falling back.
- **Ash cloud:** large dark grey toon smoke balls (SmokeBall part) rolling outward at ground level from 13 s; lit
  orange from below near the cone.

## Distortion (hero)
- `HeatHaze` over the crater (strength 0.02, wide), over each lava crack (smaller, 0.012), and over every bomb impact
  for 1.5 s.
- A ground `ShockRefraction` when the cone bursts (radius 1 → 14, strength 0.06 → 0), and a smaller one for each
  bomb impact (strength 0.03).
- During the eruption a camera-facing `ShockRefraction` pulse every 0.8 s at the crater (radius 2 → 7, strength
  0.03).

## Camera (fully cinematic: every second is a placed shot)
Use `createCinematic`, keys built in `cast()`. **Place every shot explicitly** (no auto-fit), clamp every camera to at
most 24 from its look-at, and keep the subject in frame. Hard cuts plus slow moves, letterbox from 0.3 s,
`clearCinematic` in reset and at the end. Use small camera shake inside shots (through `effect.shake`).

## Timeline (~22 s)
1. **0–2.5 Stamp.** Close on the caster's foot as it stamps: a dust ring and a crack running from the foot toward the
   point. **Cut** to the crack racing along the floor (a low tracking shot) into the point.
2. **2.5–7 Rising.** **Cut** to wide from the caster's side: the floor bulges, then basalt columns heave up in waves
   (shake 0.3) and lock into a cone. Enemies near the base are knocked back:
   `ctx.hit(e, { damage: 15, knock: 6 })` once each at 4.0. **Cut** to low near the cone: rocks tumble down the
   slope, and the crater rim glows through the cracks.
3. **7–8 Hold.** **Cut** to a high shot looking down into the crater: the lava crust heaves and cracks, haze strong.
   Dead beat 0.5 s: no sound, no shake.
4. **8–11 Eruption.** **Cut** to wide, low: the lava fountain bursts up (impact frames, the big ground refraction
   ring, shake 0.8). Lava bombs launch in all directions. **Cut** to a shot looking up from among the enemies:
   bombs arcing overhead, smoke trails crossing the sky.
5. **11–14 Bombardment.** **Cut** between two ground-level shots as bombs land around and on the enemies: crust
   bursts (toon), lava splats as decals, small dark smoke, haze over each. Each target is hit twice (at about 11.6
   and 12.8, by bombs aimed at it): `ctx.hit(e, { damage: 45, knock: 5 })`.
6. **14–18 Flow.** **Cut** to a high orbit: lava rivers flow down the cracks to radius 9; the ash cloud rolls
   outward low, lit orange from below. The fountain drops.
7. **18–22 Cooling.** **Cut** to gameplay-like framing behind the caster. The cone crumbles back into the ground
   (columns sink), the lava crusts over and darkens to black with faint red cracks, the haze fades, and the ash
   thins. Letterbox out.

## Telegraphs
A circle at the point, radius 8: start 2.5, impact 8.0.

## Exaggerate
The cone growing out of the floor, the dead beat before the eruption, and bombs crossing over the camera.
