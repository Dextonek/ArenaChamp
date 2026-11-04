# Mirror kit: Silvane, the Vain (ranged marksman)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "2. Silvane, the Vain". 620 HP, 4.1 m/s, basic attack 7.5 m, 16 per 1.0 s (look 'prism').
Accent `#cfe6ff`, foil `#d9b8ff`. Question: chase the mirror coming back, or stay where the shot is good? Weakness: open ground gives
no bounces; close up she has no damage. Model `models/heroes/mirror_v2.glb`. Palette `MIRROR` / `MIRROR_CSS` in `src/effects/parts/mirror.ts`.
She is not Opaline: the mirror is a real object (a spinning hand mirror, a standing mirror), there are many of them, and she runs to catch them.
- **Passive Fairest of All** (`src/traits/mirror.ts`): each bounce adds 25% damage and 2 m of range (the projectile system's `reflectBonus`
  and `reflectRange`, set by her spells). A mirror that ends its flight on the floor after a bounce lies there 2.5 s (`mirrorBooks`, drawn by
  `Trait.marks`, with a 1 m ring that is the catch reach). Within 1 m on her own client (`tick`): a caught Hand Mirror ends Q's cooldown, +20%
  speed 2 s (`buff haste 0.2`), a 0.25 s pose (`hold`), a word (GORGEOUS / STUNNING / DARLING); a caught Hall mirror cuts 2 s off R. She tells the other screen
  with `show('caught', id)`; `ownChanged` clears the same mark there. A rare self-compliment on a hit (her own screen).
- Q **Hand Mirror** (`handMirror.ts`, 'hand mirror'): SHOT, cd 3.5, `aim: 'line'`, `bank: true`. 0.3 s wind-up, 10 m, 22 m/s, radius 0.3, `reflect: 3`: 64
  (+25% per bounce, +2 m each). Spins as a real mirror and flashes at each bounce. Telegraph: a line per leg for the first two legs, `boltWidth(0.3)`
  wide (what it really hits). Floor mark after at least one bounce where the path ends (from `bankPath`, the same on both screens); a hit shatters it.
- W **Vanity Stand** (`vanityStand.ts`, 'vanity stand'): TERRAIN, 8 m, cd 12. Rises at 0.5 s, stands 6 s: a wall obstacle 1.1 m wide
  (`ctx.addObstacle`) plus a hidden 'turret' unit, 60 HP, damage 0 (removed in `onDeath`). Her bolts reflect off it. Bad Luck: `weaken` 15%, 7 s, on
  whoever breaks it, "SEVEN YEARS BAD LUCK".
- E **Through the Glass** (`throughTheGlass.ts`, 'through the glass'): DASH, cd 10, `dash: true`. Into the Stand and out 3 m beyond it, 9 m at most in all, 0.3 s
  (`ctx.moveCaster`); with no Stand, a 3 m step toward the aim.
- R **Hall of Mirrors** (`hallOfMirrors.ts`, 'hall of mirrors'): SELF, cd 22. A 0.6 s spin, then eight mirrors outward as real bolts (16 m/s, 12 m, radius 0.3,
  `reflect: 2`): 60 each, one bolt each. One spoke at the aim. Telegraph: eight lines, each the first leg of its path, `boltWidth(0.3)` wide; the gaps
  show. Up to four that end after a bounce (the four nearest her) lie on the floor, violet: each caught cuts 2 s off R. One short impact frame.

### How Bad Luck is placed (the two screens)
The Stand's unit exists on the screen where the cast is played against the breaker (the victim's screen online; the only screen offline), so
its `onDeath` runs there and writes `stand.broke` in the record both screens keep. The trait's `victimTick` runs on that same screen and
applies `weaken` to the enemy hero with `hitEnemy` (damage 0), so the screen that decides the breaker's damage is the one that knows. It also
sends `noteOwner('broke')`: on her own client `peerNote` marks her Stand gone, and the effect there breaks it too. On her own screen online
there is no unit, so no second application. The engine caps one application at 6 s (`BUFF_MAX_SECONDS`): the 7th second is a second application
about 0.4 s before the first ends.

### Things to know
- Q's floor mark follows `bankPath`, not the bolt: a mirror that hit shatters (the victim's screen sees the hit, hers learns it from `landed`).
  R's four are always laid, since her screen cannot tell which of the eight hit.
- The Stand is a flat wall along the screen's x axis, so a bolt coming straight down the screen comes straight back to her.
