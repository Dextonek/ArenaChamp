# Clockwork kit: Ada, the Artificer (ranged control)

**Signature shape: gears and springs.** Everything is **machined copper and brass**: toothed gears that spin and mesh,
coiled springs, rivets and pistons, with **cyan electric sparks** jumping between moving parts and small white steam
puffs from vents. Mechanisms assemble in clicks and fall apart into loose cogs. Not the forge kit (molten metal,
fire, an anvil) and not the dawn kit (gold hard-light panels).

Read `kit-common.md` first (files, timing, budgets including the **Summon budget**, look lessons) and
`docs/architecture/mechanics.md` (projectiles with bounce, statuses, summons with a pluggable `look`). Ada is a
**ranged control** hero: slows, a root and a turret.

- **Hero:** a young inventor in a copper-trimmed coat with goggles, a brass backpack of gears and a spring-loaded
  wrist launcher. **Category:** `hero: clockwork`. **Parts file:** `src/effects/parts/clockwork.ts`. **Kit:**
  `src/kits/clockwork.ts` (`clockworkKit`, name `Ada`, title `the Artificer`).
- **Palette** (`CLOCKWORK` / `CLOCKWORK_CSS`): core `#ffffff` → hot `#ffd08a` → body `#d9773a` (copper) → accent
  `#6affea` (electric cyan, sparks and 2–3 frames at hits) → dark `#1a0f08` (oiled iron, gear shadows); **foil**
  steel `#d8dde2`.
- **Material rules:** gears and springs = toon-lit metal (copper/brass bodies, steel teeth edges, dark iron hubs),
  a pinpoint highlight at most, chunky teeth (gear teeth ≥ 0.1); sparks = thin unlit cyan zigzags, short-lived; steam
  = small white toon puffs with eroding edges.

## Shared parts (`clockwork.ts`)
- `CLOCKWORK`, `CLOCKWORK_CSS`.
- `Gear`: pooled toothed gears (teeth count, radius, thickness): `place(pos, normal, radius, spin)`,
  `assemble(seconds)`, `scatter(speed, life)`.
- `Spring`: a coiled spring that compresses and releases: `set(from, to, coils, radius)`, `stretch(k)`.
- `Sparks`: small cyan zigzag arcs between two points or bursting from a point: `arc(a, b)`, `burst(pos, count)`.
- `SteamPuffs`: small white puffs from vents: `puff(pos, dir, count)`.
- **Turret look** for summons: a `MinionLook` that builds a small brass turret (a tripod, a gear body, a short
  barrel and a cyan lens) for `turret` units. Pass it as `look` in `ctx.summon`.

## Q · Rivet Shot (`clockworkRivetShot.ts`, label `clockwork rivet shot` (forge owns `rivet shot`), `ground`, `aim: 'line'`, range 12, cd 3, damage 45 + slow)
A skillshot that ricochets. 0–0.2: her wrist launcher's spring winds up with sparks. 0.2:
`ctx.projectile({ from, dir, speed: 24, range: 12, radius: 0.4, bounce: 1, hit: { damage: 45, knock: 1, color:
CLOCKWORK_CSS.body, status: { kind: 'slow', seconds: 1.5 } } })`; the bolt is a spinning copper rivet with a cyan
spark trail; each hit throws a few small cogs and a spark burst, a cyan accent (2 frames). Clean by 1.5.

## W · Cog Turret (`cogTurret.ts`, label `cog turret`, `ground`, radius 2, range 9, cd 12, `summon`)
0–0.5: gears and a spring fly in from her backpack and click together at the point (assemble), steam puffs. At 0.5
`ctx.summon({ kind: 'turret', at: point, hp: 80, seconds: 6, damage: 10, attackEvery: 1.4, range: 8, look:
turretLook })`; a small hit for anyone standing on the spot at 0.5: `ctx.hit(e, { damage: 15, knock: 3 })`. The
spell's own visual is clean by 1.6 (the turret lives on as a unit; it scatters into cogs when it dies).

## E · Gear Field (`gearField.ts`, label `gear field`, `self`, radius 5, cd 9, 2 × 13 + slow)
0–0.3: three large flat gears unfold around her at ankle height (radii 1.5, 2.5, 3.5), meshing and spinning, sparks
jumping between them. At 1.0 and 2.0 the gears lurch a notch and an electric ring races out to radius 5: every enemy
inside `ctx.hit(e, { damage: 13, knock: 0, status: { kind: 'slow', seconds: 1.0 } })`. 2.6–3.0: the gears fold away
with steam. Clean by 3.2. Telegraph ends at the first pulse.

## R · Gearfall (`gearfall.ts`, label `gearfall`, `ground`, radius 7, range 13, cd 20, damage 125 + root, `cc`)
The ultimate: a **colossal gear** is lowered from the sky by a crane of girders and slammed flat onto the zone,
pinning everyone under its teeth.
0–0.4: the world darkens to a warm iron-dark (`darken` 0.55, tint `#1a0f08`); a ring of small gears marks radius 7.
0.3–1.6: a giant gear (radius ~6, chunky teeth, dark hub, copper spokes) descends tilted from ~9 high, spinning
slowly, with two crane chains and sparks jumping along its rim; enemies are pulled 0.4 toward the centre. 1.6–1.85:
it stops, tilts flat, steam bursts from its hub — **dead beat 1.85–2.0**. **2.0–2.2**: it drops. **2.2 hit**: impact
frames `[1, 2]` at 0.04 s, a ring of loose cogs and steam bursts outward, a cyan spark ring races across the radius,
ground `ShockRefraction` (1 → 12, 0.07), shake 0.75: every enemy within 7 `ctx.hit(e, { damage: 125, knock: 0,
from: point, status: { kind: 'root', seconds: 1.2 } })`. 2.2–4.5: the gear spins down, sinks with steam and breaks
into cogs that fade, the darken lifts. Clean by 4.5.
