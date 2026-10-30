# Shadow kit: Nyx, the Umbral Stalker

## Role (2026-10-30)

**Assassin, 560 HP.** Signature: *Shadowstep*. She appears on you, silences you, cuts you down. Design: `pipeline/designs/hero-roles.md`.

| Slot | Spell | New shape and numbers |
|---|---|---|
| Q | Umbral Blink | Real dash strike. `enemy` mode, range 7, cd 3. `moveCaster` slides her beside the target (a step short, to her right) in 0.25 s while the shadow blinks along the path; the blades cut at 0.45 s for 55. Telegraph: line plus a 1.8 m circle at the target. |
| W | Grasp of the Deep | Self burst. `self` mode, radius 3 (was a ground zone r 4), cd 7. Hands rise round her; hit 40 + **silence 1.0** (tick 10 stays). |
| E | Night Shroud | QUICK, no aim. `self` mode, radius 8 (the AI fires inside 7.4 m), cd 9. Three clones fly out as 3 skillshots (`projectile`) fanned 25 degrees apart along her facing (`caster.group.rotation.y`), range 9, speed 18, 3 x 22. Telegraph: three lines, impact 0.2 s. |
| R | Eclipse Execution | EXECUTE. Radius 7 -> 2.5, range 10, cd 20, 150. The eclipse and crescent keep their size over a small zone. |

**Signature shape: flat cut-paper shadow.** Shadows are **flat, matte-black shapes** (like cut paper or ink
silhouettes) with a thin, hard **violet edge line**: blades, hands, a crescent mouth, the hero's own silhouette as a
clone. They lie flat on the floor or stand upright as cut-outs and move in sharp, stepped motions. Not smoke and not
glowing void (that is the existing void and crow sets): solid black shapes with a crisp coloured rim.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a hooded assassin with twin curved daggers; blinks, clones, executes. **Category:** `hero: shadow`.
  **Parts file:** `src/effects/parts/shadow.ts`. **Kit:** `src/kits/shadow.ts` (`shadowKit`).
- **Palette** (`SHADOW` / `SHADOW_CSS`): core `#f4e8ff` (tiny) → hot `#c88cff` (the edge line) → body `#6a2ec0` →
  accent `#5affd2` (a cold mint cut, 2–3 frames at hits) → dark `#050308` (the shapes themselves); **foil** moon grey
  `#cfcad8` (a pale floor circle under shadow pools, the moon crescent).
- **Material rules:** shadow shapes = normal-blended matte black (`SHADOW.dark`) with a hot edge line (an outline pass
  or a slightly larger hot copy behind), never additive; the floor under them gets a pale foil disc so black reads on
  the dark floor; cuts = thin hot crescents with a mint core for 2 frames at the hit.

## Shared parts (`shadow.ts`)
- `SHADOW`, `SHADOW_CSS`.
- `CutShape`: a flat black cut-out with a violet edge from a drawn 2D outline (canvas or shape geometry): presets
  `blade`, `hand`, `crescent`, `figure` (a hooded silhouette); `place(pos, normal, size, rotation)`, `opacity`,
  `edge` (0..1).
- `ShadowPool`: a black ground pool with a hard violet rim and a pale foil disc under it: `spread(center, radius, s)`,
  `shrink(seconds)`.
- `ShadowHands`: instanced flat hands/claws that rise out of a pool, grab and sink: `grab(at, count, height, s)`.
- `Afterimage`: a stepped trail of fading black figure cut-outs between two points: `trail(from, to, steps, s)`.
- `CutFlash`: the hit cut: a thin hot crescent with a mint core: `cut(pos, dir, size)`.

## Q · Umbral Blink (`umbralBlink.ts`, label `umbral blink`, `enemy`, range 10, cd 3, damage 50)
0–0.15: Nyx's silhouette doubles: a black figure cut-out peels off her. 0.15–0.4: the cut-out blinks to the target in
3 stepped jumps (an `Afterimage` trail of 4 fading figures). **0.45 hit**: two crossed blade cut-outs slash through the
target (an X of black blades with violet edges), mint accent cut (2 frames), a small shadow pool under it, a small
ground `ShockRefraction` (0.03), one impact frame `[1]` at 0.03 s. `ctx.hit(target, { damage: 50, knock: 2, color:
SHADOW_CSS.hot })`. 0.6–1.4: the cut-outs shatter into flat black shards that fall and fade, the pool shrinks. Clean
by 1.5.

## W · Grasp of the Deep (`graspOfTheDeep.ts`, label `grasp of the deep`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a shadow pool (radius 4) with a pale foil disc spreads at the point. 0.3–0.7: 6–8 black hands rise from the
pool around and under the enemies, fingers spread. **0.75 hit**: the hands close on the enemies and pull them down
0.2 (`ctx.displace`); a ring of upright blade cut-outs snaps up around the edge; shake 0.35, ground `ShockRefraction`
(1 → 5, 0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3: `ctx.hit(e, { damage: 10, knock: 0 })`.
1.4–2.2: the hands sink, the blades fall flat and fade, the pool shrinks. Clean by 2.3.

## E · Night Shroud (`nightShroud.ts`, label `night shroud`, `self`, radius 5, cd 9, 2 × 13)
0–0.3: a shadow pool spreads under her (radius 2) and three figure cut-outs (clones) rise around her at radius 1.6.
0.3–2.6: the clones circle her slowly; at 1.0 and 2.0 every clone lunges out to the nearest enemy within 5 in a single
stepped dash (Afterimage) and slashes (blade cut-out + mint cut), then snaps back:
`ctx.hit(e, { damage: 13, knock: 1 })`. 2.6–3.0: the clones fold flat into the pool, the pool shrinks. Clean by 3.2.
Telegraph ends at the first pulse.

## R · Eclipse Execution (`eclipseExecution.ts`, label `eclipse execution`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **black eclipse moon** rises over the zone and a **giant crescent blade** cuts across it.
0–0.4: Nyx raises a dagger; the world darkens hard (`darken` 0.75, tint `#050308`); a shadow pool spreads over the whole
radius 7 with its pale foil disc. 0.3–1.5: behind the zone, ~6 above the ground, a pale moon (foil) rises and a
black disc slides across it into an eclipse (a thin hot violet ring of light at the rim); shadow hands rise across
the pool and hold the enemies (pull 0.4 toward the centre). 1.5–1.85: from the eclipse a giant black crescent blade
(~12 wide, violet edge) forms and tilts back — **dead beat 1.85–2.0** (everything still). **2.0–2.2**: the crescent
sweeps down through the zone in one stroke. **2.2 hit**: impact frames `[1, 2]` at 0.04 s (silhouettes on the pale
moon card), a long mint cut across the zone, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75.
`ctx.hit(e, { damage: 125, knock: 6, from: point })` within 7. 2.2–4.5: the crescent shatters into flat black shards,
the hands sink, the eclipse slides off the moon and the moon fades, the darken lifts. Clean by 4.5.
