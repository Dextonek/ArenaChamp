# Sky kit: Zephyr, the Wind Blade (melee)

**Signature shape: the wind crescent.** Wind is drawn as **sharp pale sickle crescents** and **thin spiral gust
ribbons**: slash arcs that hang for a few frames, streaming speed lines and small tumbling leaves/feathers to show the
wind's direction. Never a smoke tornado: it is clean, fast, cutting air. Not the storm kit (clouds, rain, lightning)
and not the tide kit (water ribbons).

Read `kit-common.md` first (files, timing, budgets, look lessons) and `docs/architecture/mechanics.md` (statuses,
dash, shield, melee). This is the first **melee** hero: `melee: true`, `maxHp: 780`.

- **Hero:** a light-footed swordsman in mint and white with a long scarf and a slim curved sword; closes in fast,
  knocks enemies up. **Category:** `hero: sky`. **Parts file:** `src/effects/parts/sky.ts`. **Kit:** `src/kits/sky.ts`
  (`skyKit`, name `Zephyr`, title `the Wind Blade`).
- **Palette** (`SKY` / `SKY_CSS`): core `#ffffff` → hot `#e6fff6` → body `#7fe6c8` (mint wind) → accent `#ff8fb0`
  (blossom pink, 2–3 frames at hits) → dark `#0d2a2a` (the crescents' dark inner edge); **foil** cloud `#eef3f6`.
- **Material rules:** crescents = unlit flat sickles with a hot leading edge, body middle and a thin dark inner edge,
  tapering to needle tips (≥ 0.15 wide at the middle); gust ribbons = thin translucent spirals (≥ 0.08 wide) with
  speed-line streaks; leaves = small two-tone cards, few.

## Shared parts (`sky.ts`)
- `SKY`, `SKY_CSS`.
- `WindCrescent`: pooled slash arcs: `slash(center, dir, radius, arcDeg, tilt, seconds)` sweeping on and fading.
- `GustRibbon`: a spiral ribbon along a path or around an axis: `spiral(center, radius, height, turns, seconds)`,
  `along(points, width, seconds)`.
- `SpeedLines`: short streaks along a direction: `burst(pos, dir, count, length)`.
- `Leaves`: tumbling mint/pink leaf cards blown along a direction: `blow(pos, dir, count, speed)`.

## Q · Gale Edge (`galeEdge.ts`, label `gale edge`, `enemies` mode with `maxTargets` 10, range 3, cd 2.5, damage 50)
A melee swing. Telegraph: a `cone` of 100°, radius 3.2, from the caster toward the target, start 0, impact 0.3.
0–0.15: wind gathers on the blade (a short spiral ribbon on the sword arm). **0.3 hit**: two crossing crescents sweep
the cone (radius 3.2), speed lines, a pink accent (2 frames), leaves blow forward; every enemy still inside the cone:
`ctx.hit(e, { damage: 50, knock: 2, color: SKY_CSS.body })`. Clean by 1.2.

## W · Tailwind Rush (`tailwindRush.ts`, label `tailwind rush`, `ground`, range 8, cd 7, damage 45, `dash`, `cc`)
A gap closer. 0–0.1: a gust ribbon trails from his feet toward the point. 0.1–0.35: `ctx.moveCaster(point, 0.25)`
with a streak of speed lines and a long crescent along the path; he arrives in a burst of leaves. **0.4 hit** at the
real landing spot (`moveCaster` returns it): a spiral gust lifts everyone within 2.5:
`ctx.hit(e, { damage: 45, knock: 0, color: SKY_CSS.body, status: { kind: 'knockup', seconds: 0.6 } })`. Telegraph:
a `line` along the dash (width 1.4) plus a `circle` of 2.5 at the point, impact 0.4. Clean by 1.6.

## E · Cyclone Guard (`cycloneGuard.ts`, label `cyclone guard`, `self`, radius 4, cd 9, shield 50 + 2 × 13)
0–0.2: a whirl of crescents and gust ribbons wraps him (radius 1.2–1.8); `ctx.shieldSelf(50, 3, SKY_CSS.body)`.
At 1.0 and 2.0 the whirl flares out to radius 4 as a ring of crescents: every enemy inside
`ctx.hit(e, { damage: 13, knock: 2 })`. 2.6–3.0: the whirl unwinds into leaves. Clean by 3.2. Telegraph ends at the
first pulse.

## R · Thousand Winds (`thousandWinds.ts`, label `thousand winds`, `ground`, radius 7, range 13, cd 20, damage 125, `cc`)
The ultimate: a **sky-high cyclone of blades** forms over the zone, and he dives into its eye.
0–0.4: the world darkens to a pale storm teal (`darken` 0.5, tint `#0d2a2a`); a ring of crescents marks radius 7.
0.3–1.6: a tall spiral of gust ribbons and hundreds of small crescents rises around the zone edge to ~8 high, spinning
faster; enemies are pulled 0.4 toward the centre; leaves stream inward. 1.6–1.85: the cyclone tightens to radius 3,
the crescents freeze edge-on — **dead beat 1.85–2.0**. **2.0–2.2**: he dashes in (`ctx.moveCaster(point, 0.2)`) and
a giant vertical crescent (~6 high) splits the centre. **2.2 hit**: impact frames `[1, 2]` at 0.04 s, the cyclone
bursts outward as a ring of crescents to the radius, a pink accent at the centre, ground `ShockRefraction`
(1 → 12, 0.07), shake 0.7: every enemy within 7 `ctx.hit(e, { damage: 125, knock: 0, from: point, status: { kind:
'knockup', seconds: 0.8 } })`. 2.2–4.5: leaves and crescents fall and fade, the darken lifts. Clean by 4.5.
