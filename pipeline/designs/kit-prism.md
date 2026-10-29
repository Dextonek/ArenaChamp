# Prism kit: Opaline, the Lightbreaker (ranged mage)

**Signature shape: the refracting crystal.** Light is **caught in faceted clear crystals and split into a spectrum**:
sharp crystal shards (pale lavender glass with dark facet edges) and beams that enter as white and leave as **thin
parallel bands of rainbow colour**. Prisms rotate, catch the light, and burst into glittering facets. Not the frost
kit (ice, rime, cold blue), not the dawn kit (opaque gold panels) and not the astral kit (stars and violet night).

Read `kit-common.md` first (files, naming, timing, budgets including the **Mechanics budget**, look lessons) and
`docs/architecture/mechanics.md` (skillshots with split, statuses, shield). Opaline is a **ranged mage**: a
splitting skillshot, a blind, a shield.

- **Hero:** a cool-headed young mage in pale lavender and white with crystal epaulettes, a floating ring of small
  prisms behind her head and a crystal-tipped wand. **Category:** `hero: prism`. **Parts file:**
  `src/effects/parts/prism.ts`. **Kit:** `src/kits/prism.ts` (`prismKit`, name `Opaline`, title `the Lightbreaker`).
- **Palette** (`PRISM` / `PRISM_CSS`): core `#ffffff` → hot `#f2eeff` → body `#b8b0ff` (lavender glass) → accent
  spectrum `#ff5a6a` / `#ffd24a` / `#5aff9a` / `#5ab8ff` (only as thin bands at split edges and hits) → dark
  `#14102a` (facet edges, the dark layer); **foil** glass `#f0f4ff`.
- **Material rules:** crystals = unlit or toon faceted shards, lavender faces with a lighter top face and a dark
  `#14102a` outline on the edges (flat-shaded facets, never smooth spheres); beams = a white core with 3–4 thin
  parallel spectral bands (≥ 0.06 wide each), low opacity outside the core; glitter = small flat facets that flash
  once, few.

## Shared parts (`prism.ts`)
- `PRISM`, `PRISM_CSS`.
- `Crystal`: pooled faceted crystal shards (elongated octahedra): `place(pos, dir, length, width)`, `shatter(speed,
  life)`, `spin`.
- `SpectrumBeam`: a beam from A to B with a white core and spectral bands: `set(a, b, width, opacity)`, `split(fanDeg,
  count)` for the fan of coloured beams leaving a prism.
- `Glitter`: small flashing facets: `burst(pos, count, speed)`.
- `PrismRing`: a ring of small floating prisms that orbits a centre: `set(center, radius, count, spin)`.

## Q · Prism Bolt (`prismBolt.ts`, label `prism bolt`, `ground`, `aim: 'line'`, range 12, cd 3, damage 45 + split)
A splitting skillshot. 0–0.2: a crystal (0.8 long) forms at her wand tip. 0.2: `ctx.projectile({ from, dir, speed:
22, range: 12, radius: 0.45, hit: { damage: 45, knock: 2, color: PRISM_CSS.body }, split: { count: 3, spreadDeg: 25,
at: 'hit', hit: { damage: 15, knock: 1, color: PRISM_CSS.body }, range: 6 } })`. The crystal rides the bolt with a
short white trail; on the first hit it bursts into three thin spectral beams fanning out (one per child bolt: red,
gold, blue), glitter, a spectrum accent (2 frames). Clean by 1.5.

## W · Refraction Field (`refractionField.ts`, label `refraction field`, `ground`, radius 4, range 10, cd 7, damage 45 + blind)
0–0.3: a ring of 6 crystals rises at the zone edge (radius 4), facing inward. 0.3–0.7: each fires a white beam to a
prism forming over the centre (~2.5 high); the central prism spins faster and brightens. **0.75 hit**: the prism
bursts — spectral beams flash down across the zone, glitter, shake 0.3, ground `ShockRefraction` (1 → 5, 0.04):
every enemy inside `ctx.hit(e, { damage: 45, knock: 0, color: PRISM_CSS.body, status: { kind: 'blind', seconds: 1.5 }
})`. 1.0–2.0: the crystals shatter into glitter. Clean by 2.2.

## E · Mirror Shell (`mirrorShell.ts`, label `mirror shell`, `self`, radius 4, cd 9, shield 40 + 2 × 12)
0–0.3: six flat crystal mirrors assemble around her (radius 1.3, waist to head), turning slowly;
`ctx.shieldSelf(40, 3, PRISM_CSS.body)`. At 1.0 and 2.0 the mirrors flash and throw spectral beams outward to radius
4: every enemy inside `ctx.hit(e, { damage: 12, knock: 1 })`. 2.6–3.0: the mirrors shatter into glitter. Clean by
3.2. Telegraph ends at the first pulse.

## R · Spectrum Lance (`spectrumLance.ts`, label `spectrum lance`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **giant floating prism** over the zone catches a beam from the sky and splits it into a sweeping
fan of rainbow lances.
0–0.4: the world darkens to a deep violet-black (`darken` 0.55, tint `#14102a`); a ring of small crystals marks
radius 7. 0.3–1.6: a huge crystal prism (~4 tall, faceted, slowly turning) assembles from shards ~6 up over the
point; a ring of 8 smaller prisms orbits it; enemies are pulled 0.4 toward the centre. 1.6–1.85: a white beam
strikes the prism from above, the prism glows from inside — **dead beat 1.85–2.0**. **2.0–2.2**: the prism splits
the beam into 7 spectral lances that slam into the ground in a ring and sweep once around the zone. **2.2 hit**:
impact frames `[1, 2]` at 0.04 s, glitter bursts along the lances, a spectrum accent at the centre, ground
`ShockRefraction` (1 → 12, 0.07), shake 0.7: every enemy within 7 `ctx.hit(e, { damage: 125, knock: 4, from: point
})`. 2.2–4.5: the lances fade band by band, the prism shatters into glitter, the darken lifts. Clean by 4.5.
