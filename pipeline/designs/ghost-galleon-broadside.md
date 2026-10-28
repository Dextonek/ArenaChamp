# Ghost Galleon Broadside (hero tier, fully cinematic)

- **Label:** `ghost galleon broadside` · **File:** `src/spells/targeted/ghostGalleonBroadside.ts` · **Module:** `ghostGalleonBroadsideModule`
- **Targeting:** `enemies`, `maxTargets: 8`
- **Palette (core → hot → body → accent → dark):** spirit white-green `#e8fff4` (tiny cores only) → ghost green
  `#5effc0` → hull wood `#3a2c24` → lantern amber `#ffb347` → abyss `#05080a`
- **The shape that makes it ours:** a spectral pirate galleon sails out of a fog bank **through the air** above the
  arena, turns broadside, and fires a full volley of ghost-fire cannonballs into the enemies. Then it sinks into the
  ground like into the sea. Its hull is dark wood with drawn planks, the sails are torn and translucent green, and its
  lanterns sway.
- **Craft rules:** `docs/ART_BIBLE.md`, especially the new do/don't lines on cameras, water and props. Only the
  cannon flashes, the lanterns' tiny cores and the ghost-fire cores may cross the bloom threshold.

## Model (built from shapes, drawn canvas textures)
- **Hull:** an ExtrudeGeometry from a drawn side profile (a raised stern castle, a curved keel, a pointed bow), about
  14 long and 5 tall. Canvas texture: dark planks with black seams, worn lighter edges, a row of 8 gun ports per side
  (dark squares with a green inner glow line), and a name-board scroll. MeshStandard, roughness 0.8.
- **Masts:** 3 masts (cylinders) with yards. Sails are curved planes (a slight belly) with a drawn texture: torn edges
  with holes (alpha), faint green glow at the tears, and a skull emblem on the main sail. Opacity about 0.75,
  double-sided, swaying gently.
- **Rigging:** thin dark lines from the masts to the hull. **Lanterns:** 4 amber lanterns at the stern and the bow,
  swinging.
- **Figurehead:** a drawn skeletal mermaid shape at the bow (a flat extrude with an outline).
- **Ghost wake:** a green misty trail behind the stern (soft additive sprites) plus drips of ghost water falling off
  the keel.

## Distortion
- `HeatHaze` along the keel as spectral shimmer (strength 0.012) while it sails.
- A camera-facing `ShockRefraction` at each gun port when it fires (radius 0.3 → 2.5, strength 0.04 → 0 over 0.3 s).
- A ground `ShockRefraction` on each cannonball impact (radius 0.5 → 4, strength 0.035).

## Camera (fully cinematic: every second is a placed shot)
Use `createCinematic`, keys built in `cast()` relative to the caster and the target centroid. **Place every shot
explicitly** (no auto-fit), clamp every camera to at most 24 from its look-at, and keep the subject in frame. Hard
cuts plus slow moves inside shots, letterbox from 0.3 s, `clearCinematic` in reset and at the end.

## Timeline (~24 s)
1. **0–3 Fog.** Wide, low, from behind the caster. The arena sky darkens to ghost green-black and a fog bank rolls in
   from the far side (big soft dark-green sprite wall). A ship's bell tolls three times: three faint ground rings.
2. **3–7 Emergence.** **Cut** to low, looking up at the fog wall: the bow and figurehead push out of the fog, then the
   hull. Slow push in. **Cut** to the side tracking shot: the galleon glides left to right about 9 above the ground;
   sails billow, lanterns swing, the wake trails.
3. **7–10 Turn.** **Cut** to a high three-quarter shot: the ship swings its broadside toward the enemies (rotates
   90°). The gun ports slide open one after another (the green glow brightens).
4. **10–11 Beat.** **Cut** to a close shot along the side of the hull: 8 cannon muzzles in a row receding into depth.
   Hold still 0.6 s.
5. **11–14 Broadside.** **Cut** to over the deck toward the enemies. The cannons fire in a ripple from bow to stern
   (0.12 s apart): muzzle flash (toon star, green, small), muzzle refraction, recoil, dark smoke puffs at each port.
   Ghost-fire cannonballs (green cores with a dark smoky trail) arc down onto the enemies. **Cut** to ground level
   among the enemies as the balls land: green fire bursts (toon), ground rings, debris, impact frames on the last
   one. Each target is hit once by its ball: `ctx.hit(e, { damage: 85, knock: 7 })`.
6. **14–17 Second volley.** **Cut** back to the side tracking shot, wider. A second ripple fires; all targets take
   `ctx.hit(e, { damage: 40, knock: 4 })`. The smoke drifts along the hull.
7. **17–22 Sinking.** **Cut** to wide from the caster's side: the ship tilts bow-down and sinks into the arena floor
   as if into water. A green ripple ring spreads on the ground where it enters, ghost water splashes up, and the
   masts go last. The fog withdraws.
8. **22–24 Calm.** Gameplay-like framing behind the caster; letterbox out; embers and green mist fade; scorched
   impact decals stay.

## Telegraphs
A circle (radius 2) at each target from 7 to 11.

## Exaggerate
The bow emerging out of the fog, the ripple of the broadside, and the ship sinking into stone like water.
