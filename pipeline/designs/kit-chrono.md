# Chrono kit: Tempo, the Unwound Hour (ranged control / sustain)

## Role (2026-10-30)
**Mage (chrono), 580 HP.** Signature: rewind. See hero-roles.md.
- Q Second Hand: BOOMERANG, range 10, cd 3, `aim: 'line'`. Out as a piercing bolt, hangs 0.15 s, comes back along the line to where he stands (a second piercing bolt aimed at his position at the turn). 35 per leg, slow 1.0, each enemy once per leg.
- W Stopped Moment, E Rewind: unchanged.
- R Twelfth Hour: FUSE, no `cc`. The build is stretched so the hand strikes 3.5 s after the cast: 180, no stun, radius 7, knock 3. cd 20, clean by 5.8 s.

**Signature shape: the luminous clock dial.** Time is drawn as **clock dials**: rings of Roman numerals and tick
marks in glowing radium paint (like an old watch face in the dark), long tapered **clock hands** that sweep, and
**afterimages**: pale translucent echoes of a figure or an object, two or three steps behind it in time. Moments
that stop show as frozen motes and a dial that freezes mid-tick; moments that rewind show as afterimages playing
backward. Not the clockwork kit (copper gears, springs, rivets: **no gears, no brass**), not the `hourglass of
ages` recipe (no sand, no hourglass) and not the dawn kit (gold light panels).

Read `kit-common.md` first (files, naming, timing, budgets including the **Mechanics budget**, look lessons) and
`docs/architecture/mechanics.md` (skillshots, stun, slow, heal, **dash**: `ctx.moveCaster` may be called at any time
during play, not only at the cast). Tempo is a **ranged control mage with sustain**: a slowing hand, a stopped
moment, a rewind that heals, and a stunning twelfth hour.

- **Hero:** a slim timekeeper in a long dark coat with an ivory dial-face shoulder plate, a monocle, white hair tied
  back, a glowing clock dial floating behind the head like a halo, and a staff shaped like a giant minute hand with a
  red second hand pinned at its pivot. **Category:** `hero: chrono`. **Parts file:** `src/effects/parts/chrono.ts`.
  **Kit:** `src/kits/chrono.ts` (`chronoKit`, name `Tempo`, title `the Unwound Hour`).
- **Palette** (`CHRONO` / `CHRONO_CSS`): core `#ffffff` → hot `#f4ffd0` → body `#d4ff5a` (radium chartreuse, the
  numerals and hands) → accent `#ff4a4a` (the red second hand, and 2–3 frames at hits) → dark `#0c100a` (the dial
  face's dark); **foil** ivory dial `#f4ecd8`.
- **Material rules:** dials = flat rings on the ground or standing in the air, an ivory or dark face with
  chartreuse numerals and ticks (canvas textures; numerals ≥ 0.35 tall, ticks ≥ 0.06 wide), crisp, unlit; hands =
  tapered flat blades with a dark outline; afterimages = the shape copied at 25–40% opacity in pale chartreuse, 2–3
  copies, never more; frozen motes = few small pale points that stop dead.

## Shared parts (`chrono.ts`)
- `CHRONO`, `CHRONO_CSS`.
- `Dial`: a clock dial (numeral ring, ticks, optional face): `show(center, radius, normal, seconds)`,
  `tick(rate)`, `freeze()`, `hide(seconds)`; it owns two `Hand`s it can sweep.
- `Hand`: a tapered clock-hand blade: `set(pivot, angle, length, width)`, `sweep(from, to, seconds)`.
- `Afterimage`: 2–3 pale echoes of a figure or mesh that trail a moving thing or replay a path backward:
  `trail(object, count, spacing)`, `replay(points, seconds)`.
- `FrozenMotes`: small motes that stop mid-air in a radius: `freeze(center, radius, count)`, `release(seconds)`.

## Q · Second Hand (`secondHand.ts`, label `second hand`, `ground`, `aim: 'line'`, range 11, cd 3, damage 50 + slow)
A skillshot. 0–0.2: a small dial flicks open at his staff tip and the red second hand snaps off it. 0.2:
`ctx.projectile({ from, dir, speed: 22, range: 11, radius: 0.45, pierce: true, hit: { damage: 50, knock: 1, color:
CHRONO_CSS.body, status: { kind: 'slow', seconds: 1.0 } } })`. The bolt is a spinning red-and-chartreuse hand with
two afterimages trailing; each hit flashes a tiny dial (radius 0.6) on the target that ticks backward once. Clean by
1.5.

## W · Stopped Moment (`stoppedMoment.ts`, label `stopped moment`, `ground`, radius 3.5, range 10, cd 8, damage 35 + stun, `cc`)
0–0.3: a dial (radius 3.5) draws itself on the ground over the zone, numerals appearing one by one. 0.3–0.7: both
hands sweep toward twelve, the ticking speeds up. **0.75 hit**: the hands meet at twelve and the dial **freezes**:
the ticks stop, motes freeze in the air, a red accent (2 frames): every enemy inside (re-check at impact)
`ctx.hit(e, { damage: 35, knock: 0, color: CHRONO_CSS.body, status: { kind: 'stun', seconds: 0.8 } })`. 0.75–1.55:
the frozen frame holds (an afterimage of each victim stays where it was hit). 1.6–2.0: the motes release, the dial
fades. Clean by 2.2.

## E · Rewind (`rewind.ts`, label `rewind`, `self`, radius 3, cd 11, shield 25 + heal 45 + hit 15, `dash`)
He marks the moment and returns to it. 0–0.3: at his feet a dial (radius 1.2) appears and an afterimage of him stays
standing on it; record that spot (`anchor`). `ctx.shieldSelf(25, 2, CHRONO_CSS.body)`. 0.3–1.8: he may walk freely;
the anchored afterimage stays, its dial's hands run backward. **1.8**: the rewind — `ctx.moveCaster(anchor, 0.25)`,
2–3 afterimages replay his path backward from where he was to the anchor. **2.05** on arrival: `ctx.healSelf(45)`
and the dial flashes outward to radius 3: every enemy inside (re-check around the anchor) `ctx.hit(e, { damage:
15, knock: 2, from: anchor })`. 2.2–2.6: the dial fades. Clean by 2.8. Telegraph: a circle of 3 at the anchor from
1.4 to 2.05.

## R · Twelfth Hour (`twelfthHour.ts`, label `twelfth hour`, `ground`, radius 7, range 13, cd 20, damage 100 + stun, `cc`)
The ultimate: **a giant clock strikes twelve over the zone.**
0–0.4: the world darkens (`darken` 0.55, tint `#0c100a`); a numeral ring traces the radius-7 circle on the ground.
0.3–1.6: a vast standing dial (~7 across, ivory face, chartreuse numerals) rises behind the point, ~4 up, facing
the camera; its two hands (~3 long) sweep fast toward twelve, slowing as they near it; afterimages of the hands trail
the sweep; the ground ring ticks; enemies drift toward the centre (`ctx.displace` up to 0.4, reset after).
1.6–1.85: the minute hand stops one tick short — every mote freezes — **dead beat 1.85–2.0**. **2.0–2.2**: the
last tick: the hands meet at twelve, and the red second hand flies off the dial and drives into the centre. **2.2
hit**: impact frames `[1, 2]` at 0.04 s, the ground ring flashes, twelve chartreuse shock lines shoot out along the
numerals, a red accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.7: every enemy within 7
`ctx.hit(e, { damage: 100, knock: 3, from: point, color: CHRONO_CSS.body, status: { kind: 'stun', seconds: 0.6 }
})`. 2.2–4.5: the dial cracks into flakes and fades, the darken lifts. Clean by 4.5.
