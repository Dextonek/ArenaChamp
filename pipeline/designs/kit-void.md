# Void kit: Oblivion, the Unmaker (melee juggernaut)

## Role (2026-10-30)
**Juggernaut (melee), 760 HP.** Signature: into the rift. See hero-roles.md.
- Q Rift Cleave, W Null Tether: unchanged.
- E Void Mantle: no shield, no silence; one pulse (1.0 s) to radius 4 that hits 25, plus a **void maw shell** round him for `shell` 2.0 s (the trait swallows the next enemy spell). 2.6 s. cd 10.
- R Unmaking: radius 7 -> 5 (110, pull 4, silence 1.5 unchanged), cd 20.

**Signature shape: torn space.** The world **tears like paper or cracks like glass**, and the tears show pure
black with nothing in it. Every rift is a **jagged slit of black** with a hot rift-pink edge on one side and a thin
cyan fringe on the other (a chromatic split, like a lens that came apart). Shards of the world (ground-coloured
flakes with a pale ash edge) drift **into** the tears; ash motes fall upward. Not the shadow kit (flat violet-black
cut-paper silhouettes), not the astral kit (stars on violet night) and not the black-hole effect (no spheres, no
accretion disc, no swirling: void is cuts, slits and shards).

Read `kit-common.md` first (files, naming, timing, budgets including the **Mechanics budget** and the pull line,
look lessons) and `docs/architecture/mechanics.md` (melee kits, dash, statuses, shield, and **Pull**). Oblivion is a
**melee juggernaut** (`melee: true`, `maxHp: 700`): he drags enemies to him and silences them.

- **Hero:** a towering knight in black plate cracked with glowing pink rifts, a horned featureless helm with one
  rift slit for a visor, a ragged cloak whose hem breaks up into floating black shards, and a huge two-handed
  greatsword whose blade is a jagged tear of void. **Category:** `hero: void`. **Parts file:**
  `src/effects/parts/void.ts`. **Kit:** `src/kits/void.ts` (`voidKit`, name `Oblivion`, title `the Unmaker`).
- **Palette** (`VOID` / `VOID_CSS`): core `#ffffff` → hot `#ffc4d4` → body `#ff2a55` (rift pink-red) → accent
  `#7affff` (cyan fringe, thin, and 2–3 frames at hits) → dark `#000000` (the void itself); **foil** ash `#d8d4e0`.
- **Material rules:** the void = unlit pure black (`#000000`) with `depthWrite` on so it really cuts the frame; rift
  edges = a pink band (≥ 0.08 wide) on one side and a cyan band (≥ 0.05) on the other, both jagged, never a smooth
  outline; shards = flat irregular flakes, toon-lit dark grey faces with an ash rim, ≤ 12 per spell, short life;
  black on the darkened floor needs the ash foil or the pink edge next to it.

## Shared parts (`void.ts`)
- `VOID`, `VOID_CSS`.
- `Rift`: a jagged black tear (a polyline slit with the pink/cyan chromatic edges) on the ground or standing in the
  air: `open(center, dir, length, width, seconds)`, `close(seconds)`. Jag the outline with noise; vary the width
  along the slit.
- `Shards`: pooled world-shards that drift toward a point and vanish into it: `drift(from, to, count, seconds)`,
  `burst(pos, count, speed)`.
- `Crackle`: a ground decal of glass-like cracks radiating from a point, the cracks black with pink edges:
  `grow(center, radius, seconds)`, `fade(seconds)`.
- `AshMotes`: small pale motes that rise slowly: `emit(center, radius, count)`.

## Q · Rift Cleave (`riftCleave.ts`, label `rift cleave`, `enemies` mode with `maxTargets` 10, range 3, cd 2.5, damage 40)
A melee greatsword sweep that leaves a tear in the air. Telegraph: a `cone` of 110°, radius 3.2, start 0, impact
0.3. 0–0.15: the blade draws back, a few motes. **0.3 hit**: one wide crescent sweep; behind the blade's path a
standing `Rift` opens along the arc (black slit, pink/cyan edges), shards burst, a cyan accent (2 frames): every
enemy still in the cone `ctx.hit(e, { damage: 40, knock: 0, pull: 1.5, from: ctx.from, color: VOID_CSS.body })` (pulled 1.5 m toward him, no knock-back). 0.5–1.0: the rift zips shut
from both ends. Clean by 1.2.

## W · Null Tether (`nullTether.ts`, label `null tether`, `ground`, radius 3.5, range 8, cd 8, damage 30 + pull + slow)
He reaches out and drags everyone in. 0–0.3: a ground `Crackle` spreads over the zone. 0.3–0.6: black tendril-rifts
(3–5 thin tears, ≥ 0.15 wide) race along the ground from the zone to his feet. **0.65 hit**: the tears snap taut and
yank: every enemy inside (re-check at impact) `ctx.hit(e, { damage: 30, knock: 0, pull: 3, color: VOID_CSS.body,
status: { kind: 'slow', seconds: 1.0 } })` (no `from`: they are dragged toward him). Shards stream along the tears
toward him. 0.8–1.6: the tears close, the cracks fade. Clean by 1.8.

## E · Void Mantle (`voidMantle.ts`, label `void mantle`, `self`, radius 4, cd 10, damage 25, maw shell)
0–0.3: a ring of standing rifts (5, each ~1.4 tall) opens around him (radius 1.4), slowly turning, and a **maw
shell** (radius 1.9, faceted sphere of low-opacity dark faces, bright violet rim lines, 7 slit tears with violet
outlines, an equator band, a counter-turning inner cage) forms and turns slowly, following him. It lasts `shell` =
2.0 s from the cast and collapses over the last 0.25 s. At 1.0 the rifts flare and a crack ring races out to radius
4: every enemy inside `ctx.hit(e, { damage: 25, knock: 1 })`. No silence, no shield. 2.0–2.4: the rifts zip shut
one by one. Clean by 2.6. Telegraph ends at the pulse.

## R · Unmaking (`unmaking.ts`, label `unmaking`, `ground`, radius 7, range 13, cd 20, damage 100 + pull + silence, `cc`)
The ultimate: **the zone is cut out of the world.**
0–0.4: the world darkens (`darken` 0.55, tint `#000000`); a crack line traces the radius-7 circle.
0.3–1.6: the ground inside cracks like glass from the centre out; the plates of ground lift a little and drift
inward; a vast vertical `Rift` (~6 tall, ~1.2 wide) opens above the point and widens; shards and ash stream into it;
enemies are shown being drawn in (`ctx.displace` up to 0.6, reset after). 1.6–1.85: the rift goes still, the edges
flicker cyan — **dead beat 1.85–2.0**. **2.0–2.2**: the rift slams shut, and the whole cracked disc **inverts**
for two frames (the floor plates go black with pink edges). **2.2 hit**: impact frames `[1, 2]` at 0.04 s, the plates
shatter outward as shards, a cyan accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75: every
enemy within 7 `ctx.hit(e, { damage: 100, knock: 0, pull: 4, from: point, color: VOID_CSS.body, status: { kind:
'silence', seconds: 1.5 } })`. 2.2–4.5: the shards fall and fade, the cracks heal, the darken lifts. Clean by 4.5.
