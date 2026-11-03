# Clockwork kit: Ada, the Artificer (ranged control)

## Role (2026-10-30)
**Summoner** (turret engineer), 580 HP. Q, R unchanged.
- W Cog Turret: cooldown 12 to 9 (kit data only).
- E Gear Field: a LINGER placed at the aim (`ground` mode, range 9, radius 3.6): the gears lurch three times (0.8, 1.8, 2.8 s), each pulse 9 damage and **slow 1.0** to whoever is inside, and the field folds at 3.4 s.

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
A skillshot whose rivet sticks (no ricochet). 0–0.2: her wrist launcher's spring winds up with sparks. 0.2:
`ctx.projectile({ from, dir, speed: 24, range: 12, radius: 0.4, hit: { damage: 45, knock: 1, color:
CLOCKWORK_CSS.body, status: { kind: 'slow', seconds: 1.5 } } })`; the bolt is a spinning copper rivet with a cyan
spark trail; each hit throws a few small cogs and a spark burst, a cyan accent (2 frames). The rivet then sticks in the first enemy: a blinking copper light and a spinning gear follow it, and 1.0 s later it pops (sparks) for a second hit of 25% damage, `projectile: true` (cannot be dodged; skipped if the victim is gone). Clean by about 2.5.

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

## R · Mag Rail (`magRail.ts`, label `mag rail`, `ground` aimed as a `line`, range 14, cd 18, 70 + 38 per turret)
Batch 3 (kit-shapes-v3): replaces Gearfall (`gearfall.ts` stays in the repo, unregistered). Rails fire from her AND
from each live Cog Turret (`cogTurrets` WeakMap in cogTurret.ts), all aimed at the targeted spot so the lines cross.
0–0.6 charge: magnetic coil rings (`MagCoil`) spin up at every muzzle, cyan arcs jump (also between her and the
turrets), a thin aim line (`RailBeam`) runs from each origin to the spot while a ring closes on it; a turret that dies
during the charge fizzles. 0.6: each origin fires a piercing bolt through `ctx.projectile` (45 m/s, range 18, radius
0.4): a hard white head, an ion streak and a thin glowing line left behind. Her rail `damage` 70, each turret's 38.
A hit: first impact frame, star, sparks, ground `ShockRefraction`, shake. Clean by 1.6 s. With no turret up only her
rail fires. Network duels have no summons or bolts: her rail plays as a visual with no hit.

