# Tide kit: Marin, the Tide Dancer

**Signature shape: the water ribbon.** Water moves as **thick, smooth ribbons** that she swirls like a dancer's
sash: a curling band of clear blue water with a **white foam crest** on its leading edge, throwing **spinning
droplets** off the curls. Every spell is a dance move: a whip, a spiral, a fountain, a wave. Not a sea wave wall or
moonlit tide (the existing great wave and lunar tide): ribbons and foam at human scale, choreographed.

Read `kit-common.md` first (files, timing, balance budget, look lessons; the water lesson in the art bible: smooth
normals, unlit or rough material, foam as a soft gradient band on the tips, never faceted glossy sheets).

- **Hero:** a barefoot dancer with flowing sashes and water rings on her wrists; agile, pushes and pulls.
  **Category:** `hero: tide`. **Parts file:** `src/effects/parts/tide.ts`. **Kit:** `src/kits/tide.ts` (`tideKit`).
- **Palette** (`TIDE` / `TIDE_CSS`): core `#ffffff` (tiny highlights) → hot `#bff2ff` (shallow water, foam shadow)
  → body `#1f9fd6` (water) → accent `#ff9a6a` (coral, 2–3 frames at hits) → dark `#05253a` (deep water, the ribbon's
  underside); **foil** foam `#eaf8fb` (the foam crests and splash rims).
- **Material rules:** water ribbons = a smooth band with a deep underside, the body colour, a shallow lighter top and a
  foam gradient on the leading edge (no gloss highlight, no faceting), translucent at most 0.85; droplets = small
  teardrops stretched along their velocity, few; splashes = crown-shaped foam rings on the floor.

## Shared parts (`tide.ts`)
- `TIDE`, `TIDE_CSS`.
- `WaterRibbon`: a thick smooth water band along a curve: `setPath(points)` / `setFunction(fn)`, `width`,
  `head`/`tail` reveal, a foam crest on the head, droplets shed from curls, `reset()`.
- `Droplets`: instanced spinning teardrops with gravity, landing in small splash rings (cap ~12): `spray(pos, dir,
  count, speed)`.
- `SplashCrown`: a foam crown splash on the floor: `burst(pos, size)`.
- `WaterPool`: a shallow ripple pool decal: `spread(center, radius, s)`, `ripple(pos)`, `drain(s)`.

## Q · Tide Whip (`tideWhip.ts`, label `tide whip`, `enemy`, range 10, cd 3, damage 50)
0–0.2: she spins; a water ribbon unrolls from her wrist in a curl. **0.45 hit**: the ribbon lashes out to the target
like a whip (width 0.4), wraps around it once and bursts into a splash crown; coral accent (2 frames), droplets, small
ground `ShockRefraction` (0.03), one impact frame `[1]` at 0.03 s. `ctx.hit(target, { damage: 50, knock: 3, color:
TIDE_CSS.body })`. 0.6–1.4: the ribbon falls as droplets, the pool drains. Clean by 1.5.

## W · Whirlpool (`whirlpool.ts`, label `whirlpool`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a water pool spreads at the point (radius 4). 0.3–0.7: three water ribbons rise from the pool and spiral around
the centre faster and faster, pulling the enemies inside 0.5 toward the centre. **0.75 hit**: the spiral snaps upward
into a tall water column (2.5 high) with a foam crown, splashes outward, shake 0.35, ground `ShockRefraction` (1 → 5,
0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3 as the column collapses:
`ctx.hit(e, { damage: 10, knock: 0 })`. 1.4–2.2: the water falls back, droplets, the pool drains. Clean by 2.3.

## E · Undertow Dance (`undertowDance.ts`, label `undertow dance`, `self`, radius 5, cd 9, 2 × 13)
0–0.3: two water ribbons rise and circle her like sashes (radius 1.2–1.6, waist to shoulder). 0.3–2.6: she spins;
at 1.0 and 2.0 the ribbons flare out to radius 5 in a flat spinning ring of water with foam on its edge, splashing
every enemy inside: `ctx.hit(e, { damage: 13, knock: 2 })`. 2.6–3.0: the ribbons fall as droplets. Clean by 3.2.
Telegraph ends at the first pulse.

## R · Leviathan's Waltz (`leviathansWaltz.ts`, label `leviathan's waltz`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **giant water serpent made of ribbons** rises, circles the zone and crashes down through it.
0–0.4: she lifts both arms; the world darkens to deep sea blue (`darken` 0.55, tint `#05253a`); a water pool spreads
over the whole radius 7. 0.3–1.6: from the pool, a huge water ribbon (width ~1.2) rises and coils into the form of a
serpent (a head with a foam mane and two pale eye glints, a long coiling body) circling the zone at 3–6 high; droplets
stream off it; the enemies are pulled 0.4 toward the centre. 1.6–1.85: the serpent rears up over the point, mouth open
— **dead beat 1.85–2.0** (droplets hang in the air). **2.0–2.2**: it dives straight down into the point. **2.2 hit**:
impact frames `[1, 2]` at 0.04 s, a huge splash crown, a ring wave of water racing outward across the radius, coral
accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75. `ctx.hit(e, { damage: 125, knock: 6, from:
point })` within 7. 2.2–4.5: the water falls as rain, the pool drains, the darken lifts. Clean by 4.5.
