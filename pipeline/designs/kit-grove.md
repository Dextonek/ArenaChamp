# Grove kit: Fenna, the Grove Warden

## v5 (2026-11-04)
Rebuilt from [kits-v5.md](kits-v5.md) ("Fenna"). Support, 600 HP, 4.0 m/s, basic attack 5.5 m, 8 per 0.7 s. Question: where do I plant, and do I stay or glide? Weakness: away from her garden she has low damage and no healing; every flower can be trampled. Old spells (`bloomLash`, `overgrowth`, `verdantWard`, `seedOfRebirth`) stay in the VFX tool and in `parts/grove.ts`; `traits/grove.ts` exports nothing they import.
- **Passive, Living Garden** (`traits/grove.ts`): flowers are a list per figure in a WeakMap (`{ id, x, z, born }`, at most 4, the oldest goes, 7 s each). Spells add them at the moment they land (`plantFlower`), on both screens. `marks` draws them (`markLook` 'flower': a big open `Bloom` on a dark soil disc with a pink ring at the 1 m trample reach and a pale ring at the 1.5 m slow reach), ages them out, and writes the clock the effects read (`gardenNow`). A trampled flower leaves a 0.55 s stomp puff ('puff' mark).
  - Heal (`tick`, her client): flowers within 3 m of her, at most 2 count: 2 HP/s each, or 3 HP/s each if the flower is within 6 m of a standing World Tree. At most 6 HP/s. `t.heal(rate * dt)` every frame.
  - Slow and trample (`victimTick`, the victim's screen): an enemy within 1.5 m of a flower gets `slow` 0.6 s every 0.4 s (`hitEnemy`, damage 0). Within 1 m for 0.6 s in all: the flower is trampled, `noteOwner('trample', id)`, `peerNote` removes the same id on her screen. Ids are 0-19. `enemyGoal`: the nearest flower within 3 m of the enemy, so the CPU tramples.
- **Q Seed Shot** (`seedShot.ts`, `seed shot`, `ground`, `aim: 'line'`, range 9, cd 4): 0.25 s wind-up, seed 20 m/s radius 0.35 from her feet (reaches 6 m at 0.55 s). 50 damage. A flower grows where the seed stops: at the contact point on the enemy, or a step short of where a miss or a wall ended it. Network duels: the dealer's screen has no bolt, so it works out the stop along the aim (first enemy or wall, else 9 m) and plants then. Clean by 1.4 s.
- **W Strangle Vine** (`strangleVine.ts`, `strangle vine`, `enemy`, range 7, cd 11, `cc`): 0.5 s wind-up (two vines run along the ground, a red circle on the enemy). 30 damage, root 1.0 s, 1.4 s if the enemy is within 3 m of a flower when it lands. `projectile: true`. Six vines of different reach and coil follow the live position up the figure (irregular outline); pink blooms show the longer root. No flower. Clean by about 2.6 s.
- **E Pollen Glide** (`pollenGlide.ts`, `pollen glide`, `ground`, range 6, cd 12, `dash`): a 6 m glide (`ctx.moveCaster`, 0.3 s; a shorter aim glides less, 2 m at least). A flower grows where she lands. No heal, no damage, no zone. Clean by 1.3 s.
- **R World Tree** (`worldTree.ts`, `world tree`, `ground` radius 3, range 9, cd 24): a 3 m circle telegraphed, impact 1.2 s, she is rooted until then. At 1.2 s the tree bursts up (a trunk of three twisted vines 6.4 m tall, five branches with blooms, a crown bloom, petals): an enemy inside 3 m on live positions is rooted 1 s (`damage: 0`). It stands 8 s as an obstacle (`ctx.addObstacle`, a pillar of radius 1.0: blocks walking, sight and bolts). Her flowers within 6 m of it heal +50%. Built from `sentFrom` and `point`. Clean by 10.2 s.
  - **Recast, Uproot** (`recast: { slot: 3, window: 9.2, arm: 1.3, aiWait: true }`): told from the first cast by the tree's record in the trait's WeakMap (`treeActive`), because the engine plays the recast on a new instance in hero mode and on the same one for the CPU. It removes the obstacle, draws a 3 m ring and thorn tips for 0.6 s while the tree shudders (the owning effect watches the record), then thorns: 60 to everyone within 3 m on live positions, `projectile: true`; the tree sinks.
- New part in `effects/parts/grove.ts`: `Thorns` (instanced spikes on a disc: `place`, `peek`, `burst`).


## Role (2026-10-30)
**Support**, 640 HP. Signature: *Regrowth*. Heals through the trade and roots.
- Q Bloom Lash: 54 damage (no self-heal).
- W Overgrowth: now `enemy` mode, range 9 (`cc`): vines grow up round the chosen enemy (zone radius 2 round where it stood), 45 damage and **root 1.2** at 0.75 s if it is still within 2 m; tick 10.
- E Verdant Ward: a TURRET (`summon`, ground mode, range 9, cd 12): one flowering vine (80 HP, 6 s, 12 per shot every 1.4 s, range 8). The three growing vines are the assembly; the unit has its own blossom look (`blossomLook` in the spell file).
- R World Blossom: a SELF-R (`cc`, range 0, radius 7 to 5): the flower closes over her, **heal 70** at the slam, 130 damage and **slow 2.0** to everything within 5 m.

**Signature shape: the spiral vine that blooms.** Thick green vines grow in **spirals** (a coiling stem with leaf
pairs along it), and at the end of every spiral a **giant flower bursts open** (5–7 broad petals in a cup, a bright
pollen core), then sheds petals and pollen. Growth is the motion: things grow out of the ground in seconds. Not
thorns (blood and the existing thornwood): soft, curling, leafy and flowering.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a forest warden with antler-like branches in her hair and a living staff; roots, binds, blooms.
  **Category:** `hero: grove`. **Parts file:** `src/effects/parts/grove.ts`. **Kit:** `src/kits/grove.ts` (`groveKit`).
- **Palette** (`GROVE` / `GROVE_CSS`): core `#fffbe0` (tiny) → hot `#ffe36a` (pollen) → body `#4caf50` (leaf green)
  → accent `#ff7ab8` (petal pink, 2–3 frames at hits) → dark `#14260f`; **foil** bark cream `#e8dcc0` (the inner face
  of petals, pale bark, the seed rings).
- **Material rules:** vines = a lit tube (dark green underside, body, a lighter top line) with leaf pairs as flat
  two-tone cards; petals = flat broad cards, cream inner face and pink rim, opening to ≤ 40° (a cup, art bible);
  pollen = few small soft gold motes, additive at low opacity.

## Shared parts (`grove.ts`)
- `GROVE`, `GROVE_CSS`.
- `SpiralVine`: a coiling vine growing along a path: `grow(base, dir, length, coils, width, seconds)`, leaf pairs every
  few segments, `wither(seconds)` (browns and sinks), `reset()`.
- `Bloom`: a giant flower: `open(pos, size, seconds)`, `shed(seconds)` (petals drift down), `close(seconds)`.
- `Petals`: instanced falling/spinning petals: `burst(pos, count, speed)`, short life.
- `Pollen`: soft gold motes: `puff(pos, count)`, `drift(center, radius, count)`.
- `RootRing`: a ground decal of roots spreading from a point: `spread(center, radius, seconds)`, `fade(seconds)`.

## Q · Thorned Tendril (`bloomLash.ts`, label `bloom lash`, `enemy`, range 10, cd 3, damage 50)
0–0.2: she sweeps the staff; a vine bursts from the ground at her feet. **0.5 hit**: the vine spirals across the
ground to the target and up around it (2 coils), and a flower bursts open on top (size 1.2); pink accent (2 frames),
petal burst, a small ground `ShockRefraction` (0.03). `ctx.hit(target, { damage: 50, knock: 1, color: GROVE_CSS.body })`.
0.9–1.5: the flower sheds, the vine withers and sinks. Clean by 1.6.

## W · Overgrowth (`overgrowth.ts`, label `overgrowth`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: roots spread from the point (radius 4). 0.3–0.7: 6–8 spiral vines grow up out of the roots, coiling around the
enemies inside and holding them (sink 0.1). **0.75 hit**: every vine bursts into a flower at once (a ring of blooms),
pollen puffs, shake 0.35, ground `ShockRefraction` (1 → 5, 0.04). `ctx.hit(e, { damage: 45, knock: 0 })` within 4;
a tick at 1.3: `ctx.hit(e, { damage: 10, knock: 0 })`. 1.4–2.2: the flowers shed, the vines wither, the roots fade.
Clean by 2.3.

## E · Verdant Ward (`verdantWard.ts`, label `verdant ward`, `self`, radius 5, cd 9, 2 × 13)
0–0.3: three vines rise around her and spiral upward (radius 1.2), a flower opens on each. 0.3–2.6: the flowers turn
to face outward; at 1.0 and 2.0 each flower fires a jet of pollen and petals at every enemy within 5 (a short petal
stream that lands in a small puff): `ctx.hit(e, { damage: 13, knock: 1 })`. 2.6–3.0: the vines wither. Clean by 3.2.
Telegraph ends at the first pulse.

## R · World Blossom (`worldBlossom.ts`, label `world blossom`, `ground`, radius 7, range 13, cd 20, damage 125)
The ultimate: a **colossal flower** grows out of the zone, closes over it and bursts.
0–0.4: she plants the staff; the world darkens to a green dusk (`darken` 0.5, tint `#14260f`); roots spread over the
whole radius 7. 0.3–1.5: a thick trunk of braided spiral vines grows up from the point to ~6 high; a giant bud forms
on top and opens into a flower ~8 wide (petals in a cup, cream inside, pink rim); pollen falls; vines hold the enemies
(pull 0.5 toward the centre). 1.5–1.85: the flower closes its petals around the zone like a fist — **dead beat
1.85–2.0** (everything still, pollen hanging). **2.0–2.2**: the petals slam down onto the zone. **2.2 hit**: impact
frames `[1, 2]` at 0.04 s, a ring of smaller flowers bursts open across the radius, petals and pollen explode
outward, pink accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75.
`ctx.hit(e, { damage: 125, knock: 6, from: point })` within 7. 2.2–4.5: petals rain down and fade, the vines wither,
the roots fade, the darken lifts. Clean by 4.5.
