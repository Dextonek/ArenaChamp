# Sky kit: Zephyr, the Wind Blade (v4, 2026-11-03)

Replaces the v3 kit (Gale Edge, Tailwind Rush, Wind Barrier, Gale Cyclone). Design source: `kits-v4.md`, section
"Zephyr, the Wind Blade". Read `kit-common.md` first.

## Role
**Assassin (melee)**, 690 HP, melee attack (range 2.4, 10 damage, 0.9 s interval), walk speed 4.6. One verb: *never stop
moving*, every dash feeds the next strike.
- **Passive Tailwind.** Every dash (Q's recast, W, E) gives him a **Gust** (3 at most, 4 s; each dash refreshes the time)
  and resets his basic attack. A basic attack spends one Gust for +25 damage and 1 m more reach. Shown by the badge on the
  passive slot (the Gust count) and a floating GUST word. No twist.
- Cooldowns are not in the design; chosen here: Q 4 s, W 8 s, E 7 s per charge, R 24 s.
- **Palette** (`SKY` / `SKY_CSS`): jade wind `#7fe6c8`, white `#ffffff` / `#e6fff6`, blossom pink `#ff8fb0` as the accent,
  dark `#0d2a2a`, cloud foil `#eef3f6`. Signature shape: the wind crescent (see `parts/sky.ts`).

| Key | Spell (label) | Type | Numbers |
|---|---|---|---|
| Q | Crosswind (`crosswind`) | cone, RECAST | range 3, `enemies` mode; cone 3 m / 110 deg, 42 damage; recast within 2 s: 3 m dash-slash, 28 damage (power 2/3) |
| W | Skyward (`skyward`) | LEAP, `dash`, `cc` | range 5, `ground` mode radius 2; untouchable 0.8 s; landing 34 damage within 2 m and a 0.5 s knock-up |
| E | Feather Step (`feather step`) | DASH, `dash`, `parry`, `aim: 'line'` | range 4, `ground` mode radius 1; 2 charges (7 s each); untouchable 0.2 s |
| R | Sky Rend (`sky rend`) | TGT, `enemy` mode | range 7; six hits of 15 over about 1 s, double on a knocked-up enemy; untouchable 1.6 s; ends 1.4 m behind the enemy |

## How the passive works (`src/traits/sky.ts`)
- **The Gust** is his own counter in `t.mem`: `gust` (how many) and `gustUntil` (the deadline). `gusts(t)` reads it and
  returns 0 after the deadline. `addStacks` is for stacks on the enemy and is not used.
- **A dash gives a Gust.** `gain(t)` runs in `recastAct` (Q's recast), and in `afterCast` for slots 1 (W) and 2 (E).
  It adds one (max 3), sets the deadline 4 s ahead and says GUST or GUST xN.
- **The basic attack.** `attackMods` runs once as an attack is released: with a Gust banked it spends one and returns
  `power: 1 + 25 / 10` (35 damage in all). `attackReach` returns 1 (m) while a Gust is banked; it is read every frame
  (approach, in-range check, the AI) and has no side effects. The release is checked against the reach only through the
  engine's 0.8 m leash, so spending the Gust at the release does not cancel a swing that began at the long reach.
- **A dash resets the attack.** `t.resetAttack()` in `recastAct` (Q recast) and in `afterCast` for E. W resets at
  touchdown: `afterCast` sets `mem.landAt` and `tick` fires the reset when the clock reaches it, so the mid-air swing is
  not the one that is reset.
- **Untouchable windows** (`taken` sets `hit.blocked` while any deadline holds): `mem.airUntil` (W, `SKYWARD_AIR` 0.8 s),
  `mem.stepUntil` (E, `STEP_GRACE` 0.2 s), `mem.rendUntil` (R, `REND_AIR` 1.6 s). The constants are exported and the
  effects land on the same beat.
- **Sky Rend doubles on an airborne enemy**: `dealt` doubles the damage of slot 3 when `t.status(victim)` has `knockup`
  (Skyward's landing knocks up for 0.5 s, so W then R lands the first one or two cuts doubled).
- **Charges and recast** are the engine's: `charges: { slot: 2, count: 2, every: 7 }` and `recast: { slot: 0, window: 2,
  name: 'Dash-slash', power: 2 / 3 }` (a replaying recast: the second cast plays the same effect module).

## Numbers that differ from the design, and why
- **Basic attack online.** +25 damage is a power of 3.5. Online the server clamps a cast's or attack's power to 3, so a
  Gust strike deals 30, not 35. Offline it is the full 35. Kept like this because the design says to keep `attack` (10
  damage); raising the base to 12 would give 36 and fit the cap.
- **Sky Rend takes about 1.5 s from cast to reappearing**, not 1.2 s: a 0.25 s wind-up, then six cuts 0.2 s apart from
  0.35 s (the last at 1.35 s), then the step behind (1.5 s). The cuts themselves span 1.0 s. `REND_AIR` is 1.6 s so he is
  untouchable the whole time.
- Q recast power 2/3 (not the default 0.6) so the dash-slash is 28 of 42 exactly.

## Q · Crosswind (`crosswind.ts`, label `crosswind`, `enemies` mode `maxTargets` 10)
Two variants of one effect, told apart by a clock per caster figure: a second cast of the same figure within 2.2 s is the
dash (so the other screen of a network duel, which replays both casts, agrees; the trait's `recastAct` handles the Gust).
The `mode` setting (auto, cone, dash) forces one in the tool.
- **Cone** (impact 0.25 s, clean by 1.2 s). Telegraph: a `cone`, radius 3, 110 deg, start 0, impact 0.25. 0..0.25 wind
  gathers on the sword arm (a spiral and a trailing crescent); at 0.25 two crescents cut across each other into an X
  (tilt 0.85 and -0.85, the second reversed and pink-tinged), a pink star pop, a camera-facing refraction ring, speed lines,
  blown leaves, one light impact frame, shake 0.16. Everyone inside the cone at 0.25 s is hit for 42, knock 2.
- **Dash-slash** (impact 0.13 s). Telegraph: a `line` strip 1.8 m wide along the 3 m path. He slides 3 m
  (`ctx.moveCaster`, 0.18 s), a jade afterimage stays where he stood, a long crescent pair and a gust ribbon run the path,
  speed lines sweep it. Everyone in the strip at 0.13 s is hit for 42 x power (28), knock 2.5. Shake 0.1.
- Online: the other screen has no `moveCaster`, so the strip is the nominal 3 m from `sentFrom` and the aim.

## W · Skyward (`skyward.ts`, label `skyward`, `ground` mode radius 2)
The leap follows `dawnDescent.ts`. Timeline: 0..0.14 crouch (a flat whirl of crescents and a gust spiral at his feet),
0.14 take-off (speed lines and leaves burst up, a ground refraction ring), flight to 0.8 along a parabola (height 2.4 to
3.8 m by distance, jade afterimages every 0.07 s, streaks falling behind him), 0.8 touchdown, clean by 2.0 s.
- **Warning.** Telegraph: a `circle` radius 2 at the landing spot, start 0, impact 0.8, read live at touchdown. A ring of
  wind (two half-ring ribbons) and two spiralling funnels draw on at the landing spot from 0.06 s.
- **Touchdown.** Impact frames, a pink star and a white flare, two rings of ground crescents (six each, offset), a ground
  refraction ring, leaves, shake 0.6. Everyone within 2.25 m of the spot is hit for 34, knock 3 and a 0.5 s knock-up.
- **Landing spot** is the aim point clamped to 5 m (at least 0.5 m). His path is `ctx.moveCaster` re-aimed every frame for
  an even pace; the height is written onto the caster group (player's hero) and through `ctx.displace` (a duel opponent).
- Online: the other screen has no `moveCaster`, so the figure is lifted where it stands; the zone, effects and the hit are
  all drawn and decided there.

## E · Feather Step (`featherStep.ts`, label `feather step`, `ground` mode radius 1, `aim: 'line'`)
A 4 m step in 0.2 s (`ctx.moveCaster`, shared `STEP_GRACE`). The distance is the aim's distance clamped to 2..4 m (the
AI's gap-closer aim is shorter than 4 m, and it must not overshoot). Three jade afterimages stand along the path and fade
one after another, a gust ribbon and a crescent run the path, speed lines sweep it and burst back from his start, feathers
blow back, a ring marks where he left (0.35 s) and a small pink star and ring where he lands. No damage, no zone. Clean by 1.0 s.

## R · Sky Rend (`skyRend.ts`, label `sky rend`, `enemy` mode, hits `projectile: true`)
- **0..0.25** the wind coils round him (two gust spirals, the screen dims, a pink flare grows).
- **0.25** he vanishes: his figure is hidden (`caster.group.visible = false`) and sunk 8 m under the floor through
  `ctx.displace` (a duel opponent's body is drawn by the duel, so hiding the arena figure alone would not show), a jade
  streak shoots to the enemy.
- **0.35, 0.55, 0.75, 0.95, 1.15, 1.35** six cuts. Each from a new side (the side turns 2.4 rad each time, 1.6 m from the
  enemy): a wraith (jade afterimage) slides through, a crescent stands up through the chest (tilt alternating), speed lines
  sweep through, a pink star pops (three alternate), a refraction ring runs, shake 0.14. The sixth is the finisher: bigger
  crescents (two, crossing), a big star, impact frames, a chromatic pulse, shake 0.45, knock 3. Each cut is 15 damage with
  `projectile: true` on the target's live position (`ctx.hit`); the trait doubles it on a knocked-up enemy.
  His real body slides to each side (`ctx.moveCaster`, 0.05 s).
- **1.4** he slides to 1.4 m behind the enemy (by the enemy's facing); **1.5** he steps out: figure shown, a ring and a pink
  star. Clean by 2.4 s; `reset()` shows the figure again and restores the displacement.
- No telegraph: the hits cannot be dodged, so the counterplay is the cost (24 s) and the stun held back for when he lands.
- Online: the other screen has no `moveCaster`; his figure stays hidden where it is streamed until 1.5 s. The hits are made
  by the victim's own client on its live position.

## New part (`parts/sky.ts`)
`WindWraith(max)`: pooled afterimages of Zephyr, flat jade cut-outs (a canvas silhouette: pale head, mint body fading to the
feet, a pink scarf) that face the camera, slide along a direction while they fade and shrink: `show(pos, dir, life, size,
speed, opacity)`, `update(dt)`, `reset()`. Used by Crosswind's dash, Skyward's flight, Feather Step's ghosts and Sky Rend's strikers.

## Duel AI
- Flags: W `dash` + `cc`, E `dash` + `parry` (the AI also dodges with it when a bolt is about to hit or his attack winds up in reach), Q and R none. The AI uses a `dash` spell as a gap closer when the enemy is beyond
  Q's range + 0.5 (3.5 m) and within the spell's range: W from 3.5 to 5 m (aimed 1.8 m short of the enemy, so the 2 m
  landing circle covers it), E from 3.5 to 4 m (a short step to close, then Q). An open Q recast counts as ready: the AI
  fires the dash-slash when the enemy is within 3 m. R goes only under 55% enemy HP or after 20 s, within 7 m.
- Targeting radii: Q `enemies` (no radius), W `ground` radius 2, E `ground` radius 1 (unused by the AI for a dash), R `enemy`.

## Balance pass (2026-11-03)
A 24-duel AI tournament gave Zephyr 5 wins; he lost every duel to the melee bruisers. Changes: Q 40 to 45 (recast 25 to
30), W landing 30 to 45, R 15 to 20 per cut, and E gains `parry` so the AI uses it as a dodge. Cooldowns unchanged.

## Balance pass 2 (2026-11-03)
After pass 1 he won 17 of 24 AI duels (target 40-60%). Stepped back: Q 45 to 42 (recast 28), W landing 45 to 38, R 20 to 17
per cut, Feather Step charges 6 s to 7 s each. Flags and charges (2) unchanged.

## Balance pass 3 (2026-11-03)
Pass 2 left him at 16 of 24 (67%). Trim: W landing 38 to 34, R 17 to 15 per cut. Everything else unchanged.
