# Sand kit: Sefu, the Dune Sovereign

## v5 (2026-11-04)
Rebuilt from [kits-v5.md](kits-v5.md) ("Sefu"). Controller, 620 HP, 4.0 m/s, basic attack 5.5 m, 9 per 0.7 s. Question: when do I Judge them, and can I keep them Judged? Weakness: cover (the crook needs sight and is his only way to Judge before R). Old spells (`sandLash`, `quicksand`, `burrow`, `duneSurge`) stay in the VFX tool; `BURROW_SECONDS` stays exported from `traits/sand.ts` for `burrow.ts`.
- **Passive, Pharaoh's Decree** (`traits/sand.ts`): the crook's hit, and the sarcophagus's burst (not its 0-damage seal), Judge for 3 s: one stack `judged`, and the debuff `grounded` 0.5 for 3 s (dashes, blinks and leaps go half as far). All his hits on a Judged enemy deal +20% (the stack is read before the hit adds it). A Cobra Spit hit on a Judged enemy halves Q's remaining cooldown (`noteOwner('spit')`, `peerNote`; the bolt lands >= 0.25 s after the cast set the cooldown, so it is safe).
- **Q Cobra Spit** (`cobraSpit.ts`, label `cobra spit`, `ground`, `aim: 'line'`, range 9, cd 5): a sand cobra rears in front of him, 0.25 s wind-up, venom bolt 20 m/s radius 0.35 from his feet (reaches 6 m at 0.55 s). 62 damage, blind 1.2 s. Clean by 1.3 s.
- **W Shepherd's Crook** (`shepherdsCrook.ts`, label `shepherd's crook`, `enemy`, range 6, cd 10, `cc`): 0.5 s wind-up with a gold mark on the enemy; a stone crook hooks the neck. 35 damage, pull 3, knock 0, slow 0.5 s, `projectile: true`. Judged. Clean by 1.3 s.
- **E Scarab Stride** (`scarabStride.ts`, label `scarab stride`, `ground`, range 11 = the AI's gap-closing reach, cd 12, `dash`): a 6 m dash over 0.5 s, line telegraphed at the start (1.4 m wide). Passing through the enemy (live position vs the swept path, within 0.7 m) bites once: 30, then 30 poison as two ticks of 15 at +1 s and +2 s. Not untouchable. The poison ends about 2.5 s after the cast; clean by 3.0 s.
- **R Sarcophagus** (`sarcophagus.ts`, label `sarcophagus`, `enemy`, range 9, cd 24, `cc`): a 1.6 m circle at the spot the enemy stood at the cast. The gold case rises with its halves wide and shuts at 0.7 s. If they are still inside: sealed 1.2 s (cannot act, cannot be hit). One frame after the seal ends the case bursts open in scarabs: 110 damage (132 on a Judged enemy), Judged, with `projectile: true`. That is about 2.0 s after the cast, not 1.9: the effect cannot read the enemy's status, so it waits one frame past the seal. If they stepped out it shuts on nothing: no seal, no damage. Clean by about 3.1 s.
- New parts in `effects/parts/sand.ts`: `ScarabSwarm` (pooled scarabs: `burst`, `scuttle`), `Sarcophagus` (two-half gold mummiform case: `place`, `set(open, rise)`).

## Role (2026-10-30)
**Controller**, 600 HP. Signature: *Shackles and teeth*.
- Q Sand Lash: **root 0.8** (`cc`), 53 damage.
- W Quicksand: a LINGER (`cc`): the sand turns for 2 s, three ticks (6 each) **slow 1.2** whoever is inside radius 4, then at 2.6 s the pillars close: 40 damage and **root 1.0**. The telegraph is armed at the first tick (0.8 s) and drawn until the pillars close.
- E Dune Ward: no shield; the two sand rings (13) **slow 1.0**.
- R Tomb of Kings: **stun 1.0** at the implosion (`cc`), 130 damage.

**Signature shape: sand that flows like a ribbon and sets like stone.** Sand pours in thick, grainy **ribbons**
(a warm ochre band with a darker shadow edge and fine grains streaming off its trailing edge), and wherever it stops
it **hardens into carved sandstone** with glyphs cut into it (pale stone with dark incised lines). Every spell moves
sand, then sets it, then crumbles it back to dust. Not a sandstorm cloud (that is the existing djinn): ribbons and
carved stone.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a desert king in layered linen and a gold headdress with a crook of sandstone; controls ground and space.
  **Category:** `hero: sand`. **Parts file:** `src/effects/parts/sand.ts`. **Kit:** `src/kits/sand.ts` (`sandKit`).
- **Palette** (`SAND` / `SAND_CSS`): core `#fff6dc` (tiny) → hot `#ffd27a` (sunlit sand) → body `#c8913f` (ochre) →
  accent `#3fd4c8` (turquoise inlay glint, 2–3 frames at hits) → dark `#2a1a0c`; **foil** sandstone `#e8d8b4` (the
  carved stone, the glyph tablets).
- **Material rules:** sand ribbons = a lit band (hot on top, body in the middle, dark edge underneath) with a grain
  texture scrolling along it and grains (tiny points, few) shedding from the trailing edge; sandstone = flat-shaded
  pale stone with dark incised glyph lines (a canvas texture), never glowing; dust = small toon puffs in the body colour.

## Shared parts (`sand.ts`)
- `SAND`, `SAND_CSS`.
- `SandRibbon`: a thick flowing band along a curve: `setPath(points)` or `setFunction(fn)`, `width`, `head`/`tail`
  reveal, grain shedding, `reset()`.
- `SandstoneBlocks`: instanced carved stone blocks/pillars/shards with glyphs: `raise(base, size, seconds, delay)`,
  `crumble(perBlock, life)` into `Dust`.
- `GlyphRing`: a sandstone ground ring with carved glyphs (canvas): `set(center, radius)`, `reveal`, `opacity`, an
  option to hide its centre.
- `Dust`: small toon dust puffs and falling grains: `puff(pos, size)`, `fall(center, radius, count)` (cap ~10 puffs).
- `SandPool`: a ground decal of loose sand that swirls inward (a quicksand vortex): `spread(center, radius, s)`,
  `swirl` (0..1), `settle(seconds)`.

## Q - Sand Lash (`sandLash.ts`, label `sand lash`, `ground` (aim only), `aim: 'line'`, range 10, cd 3.5, damage 54), v3
A line skillshot. 0-0.2: he sweeps the crook; a sand ribbon pours up out of the floor at his side and winds once round
his raised arm. **0.24 the crack**: the coil unwinds into a whip of sand that flies down the aim at 24 m/s
(`ctx.projectile`, radius 0.45, a 3.6 m ribbon body trailing the tip). The first enemy it touches takes
`damage 54, knock 1, root 0.8 s` (the hit carries the root); the tip wraps its legs and sets into a sandstone shackle
(4 carved shards) that crumbles at +0.7 s. Impact frame, turquoise StarBurst, ground `ShockRefraction`, shake 0.14. A
miss lets the whip sink into the floor where it ended. Telegraph: a 0.9 m line, 10 m, armed at the crack. No projectile
(a network duel, caster's screen): the whip is the same visual at the same speed. Clean by 2.1.

## W · Quicksand (`quicksand.ts`, label `quicksand`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a glyph ring (radius 4) carves itself into the floor at the point. 0.3–0.7: a sand pool spreads inside it and
starts to swirl inward; enemies inside sink 0.15 (`ctx.displace`) and are pulled 0.4 toward the centre. **0.75 hit**:
the swirl snaps tight and 5–7 sandstone pillars punch up around the edge, leaning inward like closing teeth; dust,
shake 0.4, ground `ShockRefraction` (1 → 5, 0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3:
`ctx.hit(e, { damage: 10, knock: 0 })`. 1.4–2.2: the pillars crumble, the sand settles and fades. Clean by 2.3.

## E - Burrow (`burrow.ts`, label `burrow`, `ground` radius 9, `dash: true`, range 11 (AI reach), tunnel up to 7 m, cd 11, damage 45), v3
Replaces Dune Ward. 0-0.25: the sand under his feet swirls open. **0.25** he dives: the figure is hidden
(`group.visible = false`, restored at the eruption and in `reset()`), `ctx.moveCaster(exit, 0.75)`. A mound of swirling
sand follows him and a furrow trails 2.8 m behind (the enemy can read where he is). **Untouchable**: the trait's
`afterCast` sets `mem.burrow = time + BURROW_SECONDS (1.1)` and `taken` sets `hit.blocked`; the eruption is at
`BURROW_SECONDS - 0.1`. **1.0 the eruption**: three strands of sand shoot up, impact frame, StarBurst, sand ring,
refraction, shake 0.5; every enemy within 2 m of the exit takes `damage 30, knock 3, knock-up 0.5 s`. The exit is a
2.2 m telegraph circle (one shape object, updated if `moveCaster` clamps the exit) shown from 0.1. Clean by 2.4.

## R - Dune Surge (`duneSurge.ts`, label `dune surge`, `ground` radius 16 (direction only), `aim: 'line'`, range 12, cd 20), v3
Replaces Tomb of Kings. 0-0.6: the floor in front of him churns and heaves into three stacked ridges of sand; a
3.6 m wide, 12 m long lane telegraph is on the floor from 0.05. **0.6**: the wave (3 m wide) rolls 12 m at 11 m/s
(1.09 s). The first enemy inside it is caught (14 damage) and carried on the crest (`ctx.carry` every frame, as in
`forgeCharge.ts`); anything else it passes takes 16 and is thrown ahead (knock 7). At the end (or where the carried body
meets stone: a stalled carry, or the lane is shortened by `sweepHit`) the wave **crashes**: 92 damage, root 1.3 s, the
root sets into 5 sandstone pillars that crumble when it ends; impact frames, big StarBurst, sand ring, refraction, shake
0.7. Nobody caught: the wave breaks at 12 m. Clean by 3.9. Online each client carries and hits its own hero.
