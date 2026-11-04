# Timber kit: Hank, the Lumberjack (bruiser, melee)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "3. Hank Birchwood, the Lumberjack". 740 HP, 3.8 m/s, basic attack 2.5 m, 16 per 1.3 s (wind-up 0.4, look
'cleave'). Accent `#b5763a`, foil `#3f6b3a`. Question: let this tree grow for more damage, or chop it now? Weakness: he needs time; saplings are weak and he has
no dash. Model `models/heroes/timber_v2.glb`. Palette `TIMBER` / `TIMBER_CSS` in `src/effects/parts/timber.ts` (plaid red, wood brown, pine green, and pale
sawdust/birch under every dark layer). Trait `src/traits/timber.ts` (`timberTrait`), kit `src/kits/timber.ts` (`timberKit`).

- **Passive Fresh Cut**: his trees, 3 at most (a fourth makes the oldest fall over harmlessly). A sapling (30 HP, blocks nothing) is young at 1.2 s (120 HP, a
  pillar obstacle of radius 0.5) and full at 2.5 s (radius 0.7). A tree stays until it is chopped, torn up or broken; a stump stays 6 s. Bigger falls harder:
  chop 30 / 60 / 110, toss 30 / 60 / 90. Drawn by `Trait.marks` in five kinds ('sapling', 'young-tree', 'full-tree', 'stump', 'axe'), so no later cast can
  cut a tree off. Each stage is plain to see: a light two-tier sapling 1.5 m tall; a mid-green three-tier young tree 4.2 m; a tall dark five-tier full tree
  7.3 m. Young and full trees stand on a dark disc with a pale rim at the real obstacle radius.
- Q **Axe Swing** (`axeSwing.ts`, 'axe swing'): QUICK, `self` mode, radius 3, cd 3. A 3 m, 110 degree cone: 40 at 0.15 s on live positions. Any tree the cone
  touches (its trunk's nearest point to him inside the cone) is chopped on both screens (the same effect), falls straight away from him along the line through
  it: a strip 8 m long and 1.6 m wide, its shadow shown 0.6 s, then 30 / 60 / 110 by stage on live positions, thrown along the strip. TIMBER! A full tree sends
  birds out. 3 falls at most. **Root: the strip is returned with its impact at the SWING (0.15 s) and `until` at the landing (0.75 s)**, so he is rooted for the
  swing only, not the 0.6 s fall; the zone check has no clock, so the fall lands inside the recorded shape. No `projectile: true`. The CPU's zone dodge skips
  line zones, so only a player dodges a fall.
- W **Fast Growth** (`fastGrowth.ts`, 'fast growth'): `ground`, 6 m (at least 1.5 m from him), cd 7, `charges { slot 1, count 2, every 7 }`. Plants a tree at
  the spot at the cast. At 0.7 s an enemy within 1.5 m on its live position (`ctx.enemies`): 40 and a 0.5 s knock-up; roots burst. Telegraph: the 1.5 m circle,
  impact 0.7 s (he is rooted until then). The CPU holds it within 2 m of the enemy unless Q is ready (`aiHold`; Q is not ready without the axe either).
- E **Caber Toss** (`caberToss.ts`, 'caber toss'): `aim: 'line'`, 9 m, 16 m/s, 0.3 s wind-up, radius 0.9, cd 9. Rips up the nearest tree within 3 m (any stage; a
  stump stays), swings it over his head and hurls it end over end (`ctx.projectile`): 30 / 60 / 90 and a knock-back of 6. Telegraph width `boltWidth(0.9)`.
  The tree is drawn 2.6 m long, tumbling about its middle: a 1.3 m sweep, which is the bolt's radius plus a body. With no tree he throws his axe (the same line,
  piercing so it flies the whole way): 30, knock 3, `mem.noAxe` set. The axe lands at `sentFrom + aim * 9`, stopped by the first cover (`firstSurface`, straight-line
  maths, no `bankPath`); a mark (the axe in a pale 1.5 m ring) is drawn there. `canCast(t, 0)` is "Fetch your axe" until he is within 1.5 m (`tick` clears it).
  If the bolt hits the enemy it ends there but the axe still flies to the mark (his screen cannot know). The CPU does not walk to its axe: it has it back 3 s after
  it lands.
- R **TIMBER!** (`timberCall.ts`, 'timber call'): `aim: 'line'`, range 10, cd 24, `recast { slot 3, window 4, arm 1.0, name 'Timber', power 1, replay true }`. Five trees
  in a row along the aim at 2, 4, 6, 8, 10 m, one starting every 0.1 s from 0.2 s; each young 0.25 s and full 0.5 s after its start (the last at 1.1 s). They are
  his trees for this cast only (a row number; no cap), real cover, **with no HP unit** (units are capped at 6 a side and three normal trees may stand), and birds
  fly out of every tree as it fills. The recast is told from the first cast by the row's record (`startRow`, `rowOpen`, on the shared round clock, as a per-figure
  clock), not by the effect instance. At the recast he swings (one short impact frame, a huge TIMBER! floats over the row) and the trees fall along the row, away from
  him, one every 0.15 s from 0.25 s, 0.6 s to fall, a shadow strip 5 m x 1.6 m each. On landing: 90 to an enemy inside the strip on its live position, 3 hits at most
  on one enemy (5 m strips mean a point on the row lies in 3 at the most anyway). Without the recast they stand until 7.3 s and fall over slowly and harmlessly (8 s
  in all; the trait removes any left at 8.5 s). Telegraph: empty on the cast (nothing hits); on the recast each strip, impact at the swing, `until` at its landing.
  The CPU fires the recast only with the enemy within 2.5 m of the row (`aiHold` slot 3; false when no row stands, so the first cast is free).

### How the trees work across screens
- A tree is a record in `books` (a WeakMap keyed by his figure) written by the effects at the moment they land, on both screens, with ids 0..19 in cast order.
  Its obstacle and unit are built by `advance`, which `marks` runs every frame on both screens from the clock `marks` writes (`timberNow`, the round clock; real
  time in the VFX tool, where `ToolTrees` draws and advances them), with the cast context that planted the tree. A restarted effect cannot cut a growing tree off.
- The HP unit is a hidden 'turret' (damage 0, no reach). A sapling's has 30 HP and runs out at young (not slain, so nothing breaks); the 120 HP one follows. A slain
  unit breaks the tree on the screen that has it: the obstacle goes, a stump stays, and the other screen is told (`victimTick` -> `noteOwner('broke', id)` ->
  `peerNote` on his client; his own client's `tick` -> `show('broken', id + 1)` -> `ownChanged` on the other screen).
- Q's chop, E's rip and R's dominoes remove trees in the effect on both screens from the same shared record: no message.
- The axe's mark is written by Caber Toss's effect on both screens; `show('axe', 1/0)` mirrors "axe out" (pick-up clears it on the other screen).

### Hit boxes (what is drawn is what is hit)
Cone = the fan; fall = the shadow strip and the falling tree (foliage no wider than 1.6 m, 8 m / 5 m long); W = the pale ring at 1.5 m and the spikes; E = the
`boltWidth(0.9)` strip and a 1.3 m tumble; tree footprint = the disc at 0.5 / 0.7 m.

### Things to know
- Q is `self` mode: its direction is the caster's facing at the cast (`caster.group.rotation.y`, not `ctx.aim`, which is 0 for the CPU). The engine turns him toward the nearest enemy within 3 m, else toward -z, so with nobody that close the cone faces -z, not necessarily at a tree.
- The CPU's zone dodge ignores `line` zones: it does not step out of a fall or a domino.
- R's trees cannot be broken; normal trees can (HP unit), and they are the only ones that give a break note.
- The row is not clipped to the ring: a row aimed outward from the edge can stand outside it.
