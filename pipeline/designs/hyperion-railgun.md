# Hyperion Railgun (hero tier, short cutscene)

- **Label:** `hyperion railgun` · **File:** `src/spells/targeted/hyperionRailgun.ts` · **Module:** `hyperionRailgunModule`
- **Targeting:** `enemies`, `maxTargets: 12` (the shot is a straight line from the caster through the primary target,
  `ctx.targets[0]`; it pierces only those of `ctx.targets` within 1.4 of that line and in front of the caster, out
  to 40 units: filter them in `cast()`)
- **Palette (core → hot → body → accent → dark):** white core `#ffffff` (tiny only) → plasma violet-blue `#8a7bff` →
  coil copper `#d7803a` → warning yellow `#ffd23a` → gunmetal `#14171d`
- **The shape that makes it ours:** a huge rail cannon assembles itself from hard drawn panels behind the caster. It
  charges with heat shimmer over glowing copper coils, then fires a hypersonic slug. A **refraction tunnel** (air
  torn along the shot line) and a camera-facing muzzle shock bend the whole arena. There is no fat laser: the shot is
  a thin, near-instant line, and the power reads from the world bending, sparks and the pierced enemies.
- **Recipes:** search `pipeline/library` for "railgun", "sniper", "charge", "muzzle", "hitscan", "tracer".
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects below the bloom
  threshold, no white blobs, short impact frames, small dark smoke, few damage ticks).

## Drawn assets / model
- **Cannon:** two long parallel rails (boxes with bevelled chamfers made from ExtrudeGeometry of a drawn rail
  profile), gunmetal with yellow-black hazard stripe decals (a canvas texture) and panel lines. 6 copper coil rings
  along the rails (TorusGeometry, copper standard material with an emissive that ramps during the charge but stays
  below the bloom threshold until the last 0.3 s). A rear capacitor block with vent slats. A small HUD reticle (drawn
  ring texture, yellow) floats at the target.
- **Assembly:** the parts fly in from outside the frame and lock into place in 3 beats (rails → coils → capacitor),
  each with a tiny spark burst and a camera shake of 0.05.
- **Slug:** not visible as an object (too fast). Show only the tracer: a thin, very bright line (width 0.06) that
  lives for 2 frames, then a fading violet ionised trail (width 0.4 → 0, 0.8 s), plus a spiral of thin smoke rings
  along the line.

## Distortion
- `HeatHaze` over the coils during the charge, strength ramping 0 → 0.02.
- **Muzzle shock:** a camera-facing `ShockRefraction` at the muzzle, radius 0.5 → 6 in 0.35 s, strength 0.06 → 0.
- **Refraction tunnel:** along the shot line, place 6–8 camera-facing `ShockRefraction` rings spaced along the line
  (or one stretched quad if you prefer to write the ring along a line) that fire in sequence from the muzzle outward
  over 0.12 s. Each ring: radius 0.4 → 2.5, strength 0.04 → 0 over 0.4 s.
- Every pierced enemy gets a small ground ring (strength 0.03).

## Camera (cinematic, like `genesisCollapse.ts` and `colossusDrop.ts`)
`readonly cinematic = createCinematic()`, keys built in `cast()`, hard cuts, letterbox, `clearCinematic` in reset and
at the end. Keep subjects in frame (compute everything from the caster and target positions).

## Timeline (~8.5 s)
1. **0–2.0 Assembly.** Gameplay camera. The cannon assembles behind and above the caster's shoulder and aims at the
   target; the HUD reticle locks on with 3 tightening rings.
2. **2.0–4.6 Charge.** **Cut** to a low side shot along the rails; the coils light up one by one from back to front
   (copper → yellow → violet), with arcs jumping between the rails (LightningArc), haze growing and violet particles
   sucked into the muzzle. **Cut** to a close shot over the rails toward the target (it should look scary). Then a
   dead beat: everything holds still for 0.4 s and the coils flicker.
3. **4.6 Fire.** **Cut** back to gameplay framing (behind the caster). The tracer goes from the muzzle to 40 units out
   in a single frame; the muzzle shock, the refraction tunnel, impact frames (2 frames), a whiteout of only 0.03, and
   a recoil (the cannon slides back 1.5 and returns). Every pierced enemy: `ctx.hit(e, { damage: 95, knock: 12, from:
   caster })`, a spark spray out of its back along the line, a tiny dark smoke puff.
4. **4.6–6.5 Aftermath.** The ionised trail fades; smoke rings drift and widen; the coils glow down through copper to
   dark; steam vents puff from the capacitor; letterbox out.
5. **6.5–8.5 Disassembly.** The parts unlock and fly away in reverse order.

## Telegraphs
A line from the caster through the target, width 2.8, length 40: start 2.0, impact 4.6.

## Exaggerate
The bend of the world along the line, the dead beat before the shot, the recoil.
