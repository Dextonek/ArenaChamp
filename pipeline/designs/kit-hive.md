# Hive kit: Sirix, the Swarm Warden (melee brawler + summons)

## Role (2026-10-30)
**Juggernaut (melee, summons), 700 HP.** Signature: the swarm. See hero-roles.md.
- Q Mandible Rend, W Swarm Leap: unchanged (the leap drops 2 wasps).
- E Chitin Carapace: no shield any more (the kit gives an armor buff); the swarm flare is a show only, no hit, no telegraph. cd 9.
- R Queen's Descent: no `cc`. The dive hits 75 and slows 1.5 (was stun 0.6) and drops 3 melee wasp soldiers (40 HP, 6 s, 6 per 1 s) at the centre; with the leap's 2 that is at most 5 of the cap of 6. cd 20.

**Signature shape: the hexagon and the swarm.** Everything is **honeycomb hexagons** (wax-amber cells, hexagonal
chitin plates) and **swarms of small insects** that move as one cloud: dozens of tiny dark wasps with amber
bodies and a flicker of wings, streaming in ribbons, circling and diving. Hits splash sticky amber honey. Not the
sand kit (dunes, gold, desert) and not the alchemy kit (glass, potions, green fumes).

Read `kit-common.md` first (files, naming, timing, budgets including the **Summon budget** and **Mechanics
budget**, look lessons) and `docs/architecture/mechanics.md` (melee, dash, summons with a pluggable `look`,
statuses, shield). Sirix is a **melee brawler** (`melee: true`, `maxHp: 700`) who brings his swarm.

- **Hero:** a broad warrior in black-and-amber chitin plate with hexagonal pauldrons, a crested insect helm with
  amber eye lenses, translucent wing-cloak and two serrated claw gauntlets. **Category:** `hero: hive`. **Parts
  file:** `src/effects/parts/hive.ts`. **Kit:** `src/kits/hive.ts` (`hiveKit`, name `Sirix`, title `the Swarm Warden`).
- **Palette** (`HIVE` / `HIVE_CSS`): core `#fffbe0` → hot `#ffe08a` → body `#f0b020` (honey amber) → accent `#7aff5a`
  (acid green, 2–3 frames at hits and in wasp eyes) → dark `#120e06` (chitin black); **foil** wax `#f6e6b0`.
- **Material rules:** chitin = toon-lit near-black with an amber rim highlight; honeycomb = flat hexagon cells, wax
  walls `#f6e6b0`, amber cell faces, dark gaps; wasps = tiny instanced bodies (≥ 0.12 long at gameplay distance:
  draw them bigger than life), amber abdomen with dark stripes, a pale wing flicker; honey splashes = glossy-free
  amber blobs, few, gone by the end.

## Shared parts (`hive.ts`)
- `HIVE`, `HIVE_CSS`.
- `Swarm`: an instanced cloud of wasps that follows a target point with flocking noise: `set(center, radius,
  count)`, `stream(from, to, seconds)`, `dive(point, seconds)`, `scatter(seconds)`.
- `Honeycomb`: a hexagon-cell decal or wall that grows cell by cell: `grow(center, radius, seconds)`,
  `wall(center, radius, height, seconds)`, `crumble(seconds)`.
- `HoneySplash`: small amber splashes: `burst(pos, count)`.
- **Wasp-soldier look** for summons: a `MinionLook` that builds a giant wasp (~0.9 m, hovering, amber and black
  stripes, two pairs of flickering wings, stinger) for `melee` units. Pass it as `look` in `ctx.summon`.

## Q · Mandible Rend (`mandibleRend.ts`, label `mandible rend`, `enemies` mode with `maxTargets` 10, range 3, cd 2.5, damage 40 + slow)
A melee double claw swipe. Telegraph: a `cone` of 100°, radius 3.2, start 0, impact 0.3. 0–0.15: the claws spread,
a few wasps buzz off them. **0.3 hit**: two crossing serrated claw arcs (amber-edged dark crescents with
hexagonal flecks) sweep the cone, honey splashes, a green accent (2 frames): every enemy still in the cone
`ctx.hit(e, { damage: 40, knock: 0, color: HIVE_CSS.body, status: { kind: 'slow', seconds: 1.0 } })` (no shove). **0.6**: a second, mirrored swipe re-checks the cone: 35% damage (14), same slow, no knock, a second mirrored arc. Clean by 1.2.

## W · Swarm Leap (`swarmLeap.ts`, label `swarm leap`, `ground`, range 8, cd 9, damage 30, `dash`, `summon`)
A gap closer that brings the swarm. 0–0.1: the swarm lifts off his back in a cloud. 0.1–0.35:
`ctx.moveCaster(point, 0.25)` in a leap, the swarm streaming behind him as a ribbon. **0.4 hit** at the real
landing spot: a honeycomb burst under him, honey splashes; everyone within 2.5 `ctx.hit(e, { damage: 30, knock: 3,
color: HIVE_CSS.body })`. At 0.4 two wasp soldiers peel off the swarm: `ctx.summon({ kind: 'melee', at: landing,
count: 2, hp: 40, seconds: 6, damage: 6, attackEvery: 1, look: waspLook })`. Telegraph: a `line` along the leap
(width 1.4) plus a `circle` of 2.5 at the point, impact 0.4. Clean by 1.6 (the wasps live on as units).

## E · Chitin Carapace (`chitinCarapace.ts`, label `chitin carapace`, `self`, radius 4, cd 9, shield 40 + 2 × 12)
0–0.3: hexagonal chitin plates snap together around him in a shell (radius 1.2); the swarm circles it;
no shield (the kit's armor buff replaces it). At 1.0 and 2.0 the swarm bursts outward to radius 4: every enemy inside
`ctx.hit(e, { damage: 12, knock: 0, status: { kind: 'slow', seconds: 0.8 } })`. 2.6–3.0: the plates fall and the
swarm settles. Clean by 3.2. Telegraph ends at the first pulse.

## R · Queen's Descent (`queensDescent.ts`, label `queen's descent`, `ground`, radius 7, range 13, cd 20, damage 90 + stun, `cc`)
The ultimate: **the whole hive descends** — a tower of honeycomb rises around the zone and a colossal swarm in the
shape of a queen wasp dives into it.
0–0.4: the world darkens to amber-black (`darken` 0.55, tint `#120e06`); honeycomb cells grow over the zone edge.
0.3–1.6: the honeycomb rises into a ring wall (~2 high) around radius 7; above the point a vast swarm (hundreds of
wasps) gathers and forms the silhouette of a giant queen wasp (~8 wide wings, ~6 long) hovering 5–7 high; enemies
are pulled 0.4 toward the centre. 1.6–1.85: the queen folds her wings and points down — **dead beat 1.85–2.0**.
**2.0–2.2**: the swarm-queen dives into the centre. **2.2 hit**: impact frames `[1, 2]` at 0.04 s, the swarm bursts
outward across the radius in a ring, honey splashes, a green accent at the centre, ground `ShockRefraction` (1 → 12,
0.07), shake 0.7: every enemy within 7 `ctx.hit(e, { damage: 90, knock: 3, from: point, status: { kind: 'stun',
seconds: 0.6 } })`. 2.2–4.5: the wasps scatter and fade, the honeycomb wall crumbles, the darken lifts. Clean by 4.5.
