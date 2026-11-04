# Clockwork kit: Ada, the Artificer (ranged control)

## v5 (2026-11-04)
Source: [kits-v5.md](kits-v5.md) "Ada". 550 HP, 3.9 m/s, attack 6 m, 10 per 1.0 s (rivet). Code: `src/kits/clockwork.ts`, `src/traits/clockwork.ts`,
spells `homingDrone.ts`, `deployTurret.ts`, `grappleHook.ts`, `siegeMode.ts` (category `hero: clockwork`), parts added to `src/effects/parts/clockwork.ts`
(`HomingDrone`, `GrappleHook`, `SiegePlates`, `setTurretPower`). The older spells (Rivet Shot, Cog Turret, Gear Field, Mag Rail) stay for the VFX tool.

- **Passive, Overclock:** one rule. Her turrets within 5 m of her attack at 1.3x (`t.unitRate` from `tick` and from `ring`, so both screens apply it); in
  Siege Mode turrets within 8 m attack at 2x. The ring at her feet is 5 m (8 m in Siege Mode), copper, faint, always on. A turret inside it glows: a hot lens
  and a ring on the floor under it (`turretLook` reads `setTurretPower`, written by the trait every frame).
- **Q Homing Drone** (`enemy`, 8 m, sight, cd 4): the drone homes on the live position and lands 0.45 s after the cast: 45, `projectile: true`, no telegraph.
  `dealt` slot 0 tags them for 3 s (`tag`, one pip, plus a cogged ring on the ground).
- **Tag:** in `dealt`, a turret's hit on a tagged enemy deals x1.3. A turret hit arrives as kind `unit` on the player's side and as kind `spell`, slot 1, on
  the CPU's side (Deploy Turret deals no damage of its own, so slot 1 is always a turret). Both are handled.
- **W Deploy Turret** (`ground`, 8 m, `summon`, 2 charges, one back every 10 s, kit cooldown 10 shown): a turret for 8 s, 80 HP, 9 per 1.4 s, range 8.
  At most six units per side.
- **E Grapple** (`aim: line`, 9 m, 20 m/s, 0.25 s wind-up, cd 10): the bolt (`ctx.projectile`) does 30 and slow 1 s on the enemy and she stays put. The effect
  traces the line itself (`firstSurface` against `ctx.obstacles()`, plus `turretSpots`, her live turrets, 0.6 m either side of the line). A wall, pillar or
  turret first (or an enemy that sidestepped, with cover behind): the bolt's range is cut there and she reels to 0.9 m short (`moveCaster`, 0.3 s) if at
  least 0.5 m remains. She cannot cast it while braced (`canCast`). No pull on the enemy.
- **R Siege Mode** (`self`, cd 24): `t.hold(6)`, +20% armour, `show('siege')`. The effect draws four plates, braces, stakes, a ring gear and a `ChannelBar`.
  Every 0.8 s, from 0.8 s, the nearest target within 9 m she can see takes a heavy shell: 23, `projectile: true`, 0.25 s flight, and it is caught by cover that
  appears before it lands. Ends by the clock, a stun or silence (`channelBroken`), or Pack up (recast from 0.3 s, `replay: false`, `aiWait`): all through
  `siegeOf(caster).live`. The CPU holds R unless it has a turret up and the enemy is within 9 m (`aiHold`; the 9 m is an addition to the table).

## Role (2026-10-30)
**Summoner** (turret engineer), 550 HP. Q, R unchanged.
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

