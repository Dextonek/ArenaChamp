# Leviathan Breach (hero tier, short cutscene)

- **Label:** `leviathan breach` · **File:** `src/spells/targeted/leviathanBreach.ts` · **Module:** `leviathanBreachModule`
- **Targeting:** `ground`, radius 5 (`ctx.point` is the impact point)
- **Palette (core → hot → body → accent → dark):** foam `#eafcff` → sea glow `#4fe0d0` → scale teal `#1d6a74` → gold
  eye/fin edge `#ffcf5a` → abyss `#03141c`
- **The shape that makes it ours:** a sea serpent. Its long scaled body (a tube along an animated curve, with a
  drawn scale texture) erupts from a whirlpool portal in the ground. It arcs high over the arena in one big C-shape
  and crashes down on the target in a crown splash. The camera cuts make it feel huge.
- **Recipes:** search `pipeline/library` for "water", "splash", "serpent", "dragon", "breach" (for example the
  Jade Dragon's body-along-curve technique in `src/spells/targeted/jadeDragonAscension.ts` is the reference for
  the body, and `dragonHeadTexture()` is the reference for drawn heads).
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects below the bloom
  threshold, no white blobs, short impact frames, small dark smoke, few damage ticks).

## Drawn assets
- **Scales:** a canvas texture, overlapping crescent scales in teal with dark outlines, a lighter belly band and a
  gold dorsal stripe. It repeats along the tube's length. Use MeshStandardMaterial (roughness ~0.35, a small
  metalness) so the rim light catches it; keep it below the bloom threshold.
- **Head:** built from shapes, not a sphere: a long wedge skull (ExtrudeGeometry from a drawn side profile), a lower
  jaw that opens, two swept-back horn fins, gold eyes with black slit pupils (the only bright spot), and a frill of
  fin spines down the neck. It must read as a sea dragon at thumbnail size.
- **Fins:** 3–4 dorsal fin plates along the body (thin ExtrudeGeometry, teal with gold edge lines).
- **Whirlpool:** a drawn spiral decal on the ground (dark abyss centre, teal foam arms with black outlines). It spins.

## Distortion
- Sustained `HeatHaze` (here it reads as water refraction) over the whirlpool and up the water column during the
  breach, strength 0.012–0.018, scale 3.
- On the crash: a ground `ShockRefraction` that expands with the splash ring (strength 0.045 → 0 over 0.5 s), and a
  second, smaller one 0.25 s later for the backwash.

## Camera (cinematic, like `genesisCollapse.ts` and `colossusDrop.ts`)
`readonly cinematic = createCinematic()`, keys built in `cast()` relative to the caster and the point. Use hard cuts
plus letterbox in/out, and `clearCinematic` in reset and at the end. Every shot must keep the subject in frame:
compute the camera targets from the body's actual curve positions.

## Timeline (~11 s)
1. **0–1.5 Call.** Gameplay camera. The caster thrusts a hand down; the ground at the point darkens and the
   whirlpool spins up; foam rings; water droplets bead upward; haze on. Letterbox eases in at the end.
2. **1.5–3.5 Breach.** **Cut** to low angle beside the whirlpool, looking up. The head bursts out first inside a
   water column (a tall cylinder of toon foam shells and spray), the body follows, pouring up and out. The column
   collapses into falling sheets of water.
3. **3.5–6.0 Arc.** **Cut** to a wide side shot: the serpent arcs over the arena in one huge C, at a height of about 14,
   the body trailing water ribbons and droplets. At the apex, **cut** to a close shot of the head turning toward the
   target, jaw opening, eyes flaring (hold 0.6 s, a slight slow-motion feel by easing the motion).
4. **6.0–7.2 Crash.** **Cut** back to a three-quarter view behind the caster (gameplay-like framing). The head dives
   onto the point: impact frames (2 frames), a crown splash (a ring of tall teal-foam spikes thrown up and out,
   toon), a ground refraction ring, spray, a wet dark ring on the ground. `ctx.hit(e, { damage: 80, knock: 9 })` for
   enemies within 5. Shake 0.8.
5. **7.2–9.0 Dive.** The rest of the body pours down into the impact point and vanishes into the ground (the
   whirlpool reopens under the point for the tail to slip in, the tail fin flicks last). Backwash ring and a second,
   smaller hit (damage 20, knock 3).
6. **9.0–11 Calm.** Letterbox out, gameplay camera; puddle decal and foam fade, mist drifts low.

## Telegraphs
A circle at the point (radius 5): start 0, impact 6.0.

## Exaggerate
The size of the arc against the arena, the head close-up and the crown splash.
