# Sanguine Eclipse (blood kit R: the MOBA ultimate)

- **Label:** `sanguine eclipse` · **File:** `src/spells/targeted/sanguineEclipse.ts` · **Module:** `sanguineEclipseModule`
- **Category:** `'hero: blood'` · **Targeting:** `ground`, radius 7 (`ctx.point` is the centre)
- **Kit:** read `pipeline/designs/blood-kit.md` first, and use the shared parts in `src/effects/parts/blood.ts`
  (look at `src/spells/targeted/hemolance.ts` for how they are used).
- **MOBA ultimate (user, 2026-10-29):** the biggest and most dramatic of the four spells, but a gameplay ability,
  not a cutscene. There is **no cinematic camera and no letterbox**: it plays under the normal gameplay camera
  (behind and above the caster, looking at the point), and is over in about 4.5 s. Drama comes from darkening the
  world, scale, one dead beat and one impact-frame moment.
- **The shape that makes it ours:** the caster throws her three blood beads into the sky. A **pale bone moon**
  appears above the zone and **bleeds** (red runs down it from the top). Blood is ripped out of every enemy into
  **one suspended sphere of blood** over the point. She clenches her fist, the world stops, and the sphere
  **freezes into a crystal thorn-star** that slams down and impales the whole zone.

## Model (drawn canvas textures, shared parts)
- **Moon:** a disc (radius 3.5) about 9 above the point and a little beyond it (away from the caster), tilted ~55°
  toward the caster (see the art bible line on sky sigils) so the gameplay camera sees it as a full disc, not an
  ellipse. Drawn bone texture: pale `#e9dcc6` with soft grey maria, a sharp outer line and transparent margins.
  A second layer is the blood: a red mask that reveals downward with dripping fingers (animate a threshold over a
  drawn drip gradient). The red covers about 60% at most: the moon stays the pale foil behind the dark sphere.
- **Blood sphere:** radius 1.6, about 4.5 above the point. It uses the kit's liquid look on an icosphere with smooth
  normals and a slow vertex wobble (surface tension). It is fed by one `BloodTendril` stream per enemy, width about
  0.18, rising and curving in.
- **Thorn-star:** the sphere is replaced by 14–18 large `BloodThorns` spikes pointing out from one centre (lengths
  2–3.5), faceted crystal, with the hot edge lines.

## Distortion (hero)
- A camera-facing `ShockRefraction` lens around the sphere with a slow pulse (strength 0.03) while it grows.
- At the freeze: one camera-facing ring at the sphere (radius 1 → 6, strength 0.06 → 0).
- At the landing: a ground ring (radius 1 → 12, strength 0.07 → 0), and `HeatHaze` (0.012) over the zone for 1 s.

## Timeline (~4.5 s)
1. **0–0.4 Spend.** Three blood beads orbit the caster's shoulders and shoot up one after another (thin trails).
   The world darkens hard (`darken` 0.7, tint `#140306`). A big bone `BloodSigil` (radius 7) starts drawing on
   around the point.
2. **0.3–1.2 Moon.** The beads arrive at the top of the moon as it fades in above the zone, and the red starts to
   run down it.
3. **0.6–1.8 Harvest.** From every enemy in the radius, a tendril stream tears up into the forming sphere, shedding
   drops; the sphere grows from 0.3 to full size. Enemies are lifted 0.4 (`ctx.displace`).
   `ctx.hit(e, { damage: 15, knock: 0, color: BLOOD_CSS.body })` at 1.0.
4. **1.8–2.0 The fist (dead beat).** The streams snap off, everything stops: no wobble, no shake, the drops hang
   in the air. A small bone sigil flares at the caster's raised fist.
5. **2.0 Freeze.** In 2 frames the sphere becomes the thorn-star. `impactFrameAt(t, 2.0, [1, 2], 0.04)` (black
   silhouettes on a bone card). The camera-facing ring.
6. **2.0–2.4 Slam.** The thorn-star falls (accelerating) onto the point, bottom spikes first.
7. **2.4 Landing.** The ground ring, `BloodThorns.erupt` over the whole radius 7 (60–80 thorns in a fast outward
   ring, the tallest under the enemies), a pale cyan `StarBurst` (3 frames) at the centre, a `BloodPool` splash
   (radius 3), shake 0.7. `ctx.hit(e, { damage: 120, knock: 6, from: point, color: BLOOD_CSS.body })` for every
   enemy within 7. Enemies drop back down onto the thorns.
8. **2.4–3.4 Hold and drain.** The impaled zone holds; drops arc from the enemies to the caster's chest (the drain);
   the moon fades back to pale and starts to fade out.
9. **3.4–4.5 Release.** Everything shatters from the centre outward into dark crystal flakes, the pool dries and
   fades, the sigil and the moon fade, the darken lifts. Clean by 4.5.

## Telegraphs
A circle at the point, radius 7: start 0, impact 2.4.

## Exaggerate
The bleeding moon above the zone, the dead beat before the freeze, and the slam of the thorn-star.
