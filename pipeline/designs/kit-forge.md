# Forge kit: Brannoc, the Ashen Smith

## v5 (2026-11-04)
Source of truth: [kits-v5.md](kits-v5.md), section "Brannoc". 780 HP, 3.6 m/s (nothing makes him faster), attack 2.6 m, 18 per 1.6 s. Code: `src/kits/forge.ts`, `src/traits/forge.ts`, spells `chainHammer.ts`, `forgeRoar.ts`, `redHotRivet.ts`, `moltenCore.ts` (labels `chain hammer`, `forge roar`, `red-hot rivet`, `molten core`), parts added to `src/effects/parts/forge.ts` (`ChainLine`, `SlagCone`). The old spells below stay in the tool.
- **Passive, Hot Iron:** his hits put Heat on the enemy (3 at most, 5 s). His next spell that lands on a 3-Heat enemy is Tempered: bonus, Heat cleared, no Heat added by that spell. Decided in `dealt`, once per cast (`hit.cast`).
- **Q Chain Hammer** (HOOK, cc, aim line, 9 m, cd 9): 18 m/s, 0.3 s wind-up, radius 0.45. 40, `pull: 4`, `knock: 0`, slow 1 s, no Heat. Tempered: stun 0.75 s (replaces the slow). The chain is drawn back to his hand.
- **W Forge Roar** (SELF, cd 11): +30% armour 3 s (kit `buff`). His next basic attack in 3 s: power (18 + 35) / 18, knock-up 0.5 s, +2 Heat; on a 3-Heat enemy a 0.8 s knock-up that clears the Heat. No speed.
- **E Red-Hot Rivet** (TGT, sight, 6 m, cd 4): 30 at 0.55 s, then 2 ticks of 8 at 1.55 s and 2.55 s, +2 Heat. Tempered: the enemy takes 20% more for 3 s.
- **R Molten Core** (SELF, cd 24): 6 s: immune to slow, root and knock-up (`taken`), +25 per attack, reach 3 m, +1 Heat per attack, a 3 m slag cone drawn per swing. Recast Quench (opens 0.3 s later, `aiWait`): ends the core, holds him 0.6 s, a 3 m ring for 0.6 s, then 30 + 10 per second left (live positions, `projectile: true`). Tempered Quench: stun 0.75 s.
- **Shared state:** `forgeFx` (per figure, in `traits/forge.ts`): `slamOffAt`, `coreOffAt`, `swings`, `quenchLeft` (tenths over the wire as 'quench'), mirrored in `ownChanged`.

## Role (2026-10-30)
**Tank (melee), 820 HP**, `melee: true`. Signature: anvil lock, most hard CC, biggest shield, low damage.
- Q Rivet Shot: range 10 -> 3 (point-blank flick), 35, slow 0.8, cd 3.
- W Anvil Drop: small LOB, range 8, radius 2 (anvil scaled down), 35, slow 1.5, cd 7.
- E Bellows Ward: shield 80 for 3 s; the two heat pulses (radius 5) pull enemies 1.5 m toward him, no damage and no telegraph hit. cd 9.
- R Forgefall: SELF-R, `cc`, range 0. The hammer falls on his own spot, radius 5, 90, knock-up 0.5. cd 20.

**Signature shape: molten slag that cools.** Liquid metal glows white-orange, then a black crust grows over it
from the edges inward, leaving glowing orange cracks that dim to dull red and go out. Every spell ends with
something cooling. Second shape: hard, heavy smith's iron (a hammer, an anvil, rivets, chain links) with hot edges.

Read `kit-common.md` first (files, timing, look lessons).

- **Hero:** a dwarf-sized giant of a blacksmith with a forge in his chest; heavy, slow, every hit lands like a
  hammer. **Category:** `hero: forge`. **Parts file:** `src/effects/parts/forge.ts`. **Kit:** `src/kits/forge.ts`.
- **Palette** (`FORGE` / `FORGE_CSS`): core `#fff3d0` (tiny) → hot `#ffb03a` → body `#ff5a12` → accent `#6fe0ff`
  (cold quench steam, 2–3 frames) → dark `#120a08`; **foil** ash grey `#cfc6b8` (ash, cooled iron edges, smoke rim).
- **Material rules:** molten = an unlit shader with a crust mask (dark crust plates with bright cracks between them,
  the crack brightness animated with a `cool` 0..1 parameter: 0 = all glowing, 1 = black with dull red cracks);
  iron = dark `MeshStandard` with a thin hot rim on the forged edges; sparks = short streaks (not dots), few.

## Shared parts (`forge.ts`)
- `FORGE`, `FORGE_CSS`.
- `SlagPool`: a ground decal of molten slag with a lumpy edge: `place(center)`, `spread(radius, seconds)`,
  `cool(seconds)` (crust grows inward, cracks dim), `fade(seconds)`.
- `SlagBlobs`: instanced molten blobs (thrown slag): `throw(pos, vel, size)`, gravity, they land as small
  `SlagPool` splats (cap ~10) and cool.
- `Sparks`: instanced short streak sparks: `burst(pos, dir, count, speed, spread)`, gravity, life ~0.4 s.
- `ForgeIron`: builders for the heavy objects (returns meshes): `hammer(scale)`, `anvil(scale)`, `rivet(scale)`,
  `chainLink()`; dark iron with a hot rim line material whose heat you can set (0..1).
- `QuenchSteam`: a few pale toon steam puffs (ash foil colour) that rise and fade: `puff(pos, size)`.

## Q · Rivet Shot (`rivetShot.ts`, label `rivet shot`, `enemy`, range 10)
0–0.25: he pulls a white-hot rivet from his chest forge (a small hot `ForgeIron.rivet`, sparks). 0.25–0.45: he
flicks it: the rivet flies (a fast streak with a short hot trail and a few sparks). **0.45 hit**: the rivet punches
into the target: a burst of sparks out of the back, a small `SlagPool` splash under the target, 3 slag blobs,
a cold accent star (2 frames), a small ground `ShockRefraction` (0.03). `ctx.hit(target, {damage: 55, knock: 5})`.
0.45–1.6: the slag and the rivet cool to black, a quench steam puff, clean by 1.7.

## W · Anvil Drop (`anvilDrop.ts`, label `anvil drop`, `ground`, radius 3.5, range 10)
0–0.5: a glowing ring of molten runes draws on the ground at the point (ash-grey ring with orange runes); a huge
dark iron anvil (scale ~2.5, hot edges) appears 9 above it, falling. **0.7 hit**: the anvil slams, sinking 0.4 into
the floor: a radial ring of slag splashes out (8–10 `SlagBlobs`), a `SlagPool` crater (radius 3), heavy sparks,
shake 0.5, ground `ShockRefraction` (radius 1 → 5, 0.045). `ctx.hit(e, {damage: 65, knock: 6, from: point})` for
enemies within 3.5. 0.7–2.2: the anvil holds 0.6 s, then crumbles into dark iron chunks that sink; the crater
cools to black with dim cracks; steam puffs. Clean by 2.3.

## E · Bellows Ward (`bellowsWard.ts`, label `bellows ward`, `self`, radius 5)
0–0.3: his chest forge flares: a ring of heat haze rises around him. 0.3–2.8: two loops of heavy molten **chain**
(links, ~16 per loop, glowing then crusting) whirl around him at waist height in opposite directions (radius 1.6
and 2.2), throwing sparks; `HeatHaze` over him (0.015). Two pulses at 0.9 and 1.9: the chains flare, a ground ring
of heat (ash foil ring + orange) pushes out to radius 5, and every enemy inside takes
`ctx.hit(e, {damage: 15, knock: 3})`. 2.8–3.2: the chains cool black and drop with a clank (they shatter into
chunks), clean by 3.3. Loopable section 0.3–2.8.

## R · Forgefall (`forgefall.ts`, label `forgefall`, `ground`, radius 7, range 13)
The ultimate: he forges a **colossal hammer in the sky** and brings it down on the zone.
0–0.4: he raises his arm, the world darkens (`darken` 0.6, warm tint), an ash-grey anvil sigil draws on around the
point (radius 7). 0.3–1.4: slag streams pour up from the ground (from 6 points on the ring) into the sky over the
point and pool into the shape of a giant hammer head (12 long), glowing white-orange. 1.4–1.9: the hammer cools
black from its edges (cracks glowing) while it rotates up overhead — **dead beat 1.8–1.95** (everything stops).
**1.95–2.3**: it swings down. **2.3 hit**: impact frame, a huge spark fountain, a radial crack web of molten cracks
across the radius 7, slag splashes, a ground `ShockRefraction` (1 → 12, 0.07), shake 0.8, `HeatHaze` over the zone
for 1 s. `ctx.hit(e, {damage: 130, knock: 8, from: point})` within 7. 2.3–4.5: the hammer shatters into cooling
iron chunks, the cracks cool to black, ash falls, steam rises at the edges. Clean by 4.5.
