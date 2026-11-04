# Mime kit: Mum, the mime (ranged controller)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "13. Mum, the mime". 580 HP, 4.1 m/s, basic attack 5.5 m, 9 per 0.9 s (look 'orb', speed 20). Accent `#f7f7f2`,
foil `#20202a`, one red `#d23a3a` (her scarf). Question: which wall is real? Weakness: one hit breaks a wall, and chalk lines show them. Second
decision: a wall for cover is not a wall to trap you (her own walls block her sight and her basic attacks too). Palette `MIME` / `MIME_CSS` in
`src/effects/parts/mime.ts`. **She never says a word**: no `t.say`, no floating text of hers; gestures (white gloves, a red scarf tail) and chalk only.
- **Passive Silence Is Golden** (`src/traits/mime.ts`): up to 3 plain Walls stand, and The Box adds 4. Each is a real obstacle for both heroes, shown only as a
  faint dashed chalk line on the floor (a dark layer under it) and a faint rippling shimmer in the air, both from `Trait.marks` / `markLook`, on both screens.
  One hit of any size breaks one. A broken wall leaves chalk chips for 0.7 s.
- Q **Invisible Ball** (`invisibleBall.ts`, 'invisible ball'): SHOT, cd 3.5, `aim: 'line'`. 0.3 s wind-up, 9 m, 22 m/s, radius 0.3: 50, knock 1.5. Nothing is drawn in
  the air: her glove closes on nothing, draws back and throws; the dashed chalk line and the telegraph (`boltWidth(0.3)` = 1.44 m wide) are the only sign. It
  reaches 6 m at 0.54 s. A hit pops a chalk star and chips; a miss ends in a small dust puff. It flies through her own walls.
- W **Wall** (`mimeWall.ts`, 'mime wall'): TERRAIN, 9 m (at least 1.5 m), 3 charges, one back every 3 s, 0.6 s between casts (`Trait.charges`). Both gloves press a
  pane that is not there while a chalk line is drawn 4 m long, square to her aim; at 0.5 s it is a wall for 5 s. Telegraph: its line, 0.5 m wide.
- E **Rope Trick** (`ropeTrick.ts`, 'rope trick'): TGT, 7 m, cd 11, sight when it lands. 0.5 s: two gloves go hand over hand, the scarf streams, a chalk dashed line
  marches from the enemy to her. If she still sees it (her own walls are cover) and it is within 9.2 m: 30 and pulled 3 m over 0.3 s, stopping 1 m short
  (`ctx.carry`, else the hit's `pull`). Otherwise the rope slips (chips of chalk), nothing happens. Telegraph: a circle on the enemy, live (the chalk line is only drawn).
- R **The Box** (`theBox.ts`, 'the box'): ZONE, 9 m (at least 2.4 m, so she is outside), cd 22. She traces a box in the air with both gloves while a chalk square is
  drawn on the floor, 3 m a side, turned to her aim. At 0.8 s four walls close for 3 s, with a red mark at each corner. Telegraph: the four lines, 0.5 m wide.
  From the middle a wall is 1.5 m away: 0.63 s with the reaction time, inside the 0.8 s.

### How a wall is built (and why it can be hit anywhere along its length)
`raiseWall` makes, at the rise, on both screens: the obstacle (`ctx.addObstacle`: a capsule on the wall's line, 0.14 m each side); a **bolt wall**
(`ctx.boltWall`) on the same line, half-width 0.16 m; and, where `ctx.summon` exists, a hidden 1 HP 'turret' unit (the unit is made BEFORE the obstacle, as in
crystalPillar.ts). Why two of them: an enemy bolt that meets the obstacle ends at its surface, and `ProjectileSystem.step` then tests the bolt walls on that
shortened path, so the bolt wall catches any bolt that reaches the wall anywhere, and its `onBlock` breaks the wall. That is a side-aware rule for free: it
stops only the other side's bolts. A unit alone would only be touched by bolts within 0.8 m of its centre. The unit takes what is not a bolt (basic attacks, zone
spells and units' hits); it follows the shot: each frame (`victimTick`) it stands where the line from the enemy to her crosses the wall, so a bolt aimed at her
also meets its reach. Its HP bar is sent 300 m below the floor (`barY`), so no bar gives a wall away. `dropWall` ends all three at once.
The unit cap is 6 a side (`MAX_UNITS`): plain Walls are at most 3; a Wall or a Box that would put her over 6 units drops the oldest wall (`makeRoom`).

### The two screens
Records (`mimeBooks`, per figure) are written at the cast on both screens, with ids that count the walls made, so both agree. A break is learned where the hit is
decided: from the unit's death (the screen that has `ctx.summon`: offline the only screen, online the victim's) or from the bolt wall's `onBlock` (the screen that
flies the bolts at her). `victimTick` tells her own client with `noteOwner('broke', id)` (`peerNote` there drops the wall); `tick` on her client tells the other
screen with `show('broke', id)` (`ownChanged` drops it). Both also expire walls by time.

### Her own bolt passes her own walls
Obstacles stop every bolt, whoever threw it, and no shared code tells them apart. So `passBolt` lifts a wall's obstacle out of the arena while her Invisible Ball is within
1.6 m of it on its path, and `restoreWalls` puts it back (with the time it has left) when the bolt is past or gone; the effect's telegraph ignores her own walls
(`isOwnWall`). It works, but a wall is open for a moment each time. **Not built (shared code):** her basic attacks and her cast checks use line of sight
(`blocksSight`), which counts every obstacle, so inside The Box she can shoot in only with Invisible Ball. A tag on `Obstacle` for its owner's side, skipped by the
arena's `blocked` / `surface` (bolts) and by sight for that side, would remove `passBolt` and let her attacks and Rope Trick reach into a Box.

### Engine behaviour that shows on a wall (not fixable from the kit)
The wall's unit is an ordinary summoned unit: a hit on it floats a damage number over the wall (`SummonSystem.hurt`), and `MinionFx` draws a 0.4 s ring when it rises and a
chip puff when it dies, at its spot. A ground mark shrinks in its last second while the obstacle is still solid. A wall made while the cap is full gets its unit a frame late
(`attachUnit`, retried in `victimTick`); the bolt wall covers that frame.

### CPU
`aiHold`: Wall only with the enemy 3 to 8 m away and fewer than 3 plain walls standing; The Box only with the enemy within 8 m. Everything else is the usual order R, E, W, Q.
W has `summon: true`, so the CPU raises its Wall 3 m in front of itself toward the enemy (cover, with no sight check; the engine's `summonSpot`), not on the enemy. The Box and the Ball are aimed at the enemy; the Rope at it.
