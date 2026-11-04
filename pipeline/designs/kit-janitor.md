---
title: Gus, the Caretaker (janitor kit)
tags: [design, heroes, kits, janitor]
updated: 2026-11-04
---

# v5 (2026-11-04)

Gus, theme `janitor`. Controller, melee. 700 HP, 3.9 m/s, attack 2.8 m, 14 per 1.3 s (melee, 'sweep'). Accent `#ffd23a`, foil `#3a6a8a`.
Numbers come from [new-heroes-kits.md](new-heroes-kits.md) section 12; the code constants are in `src/traits/janitor.ts`.

| Key | Spell | CD | Final numbers |
|---|---|---:|---|
| P | Wet Floor | | Mopped floor is wet 6 s (Flood's 5 s), shining pale blue. On it an enemy keeps sliding and turns half as fast; Gus never slides. Big Mop wipes the enemy's rods, flowers and ink |
| Q | Big Mop | 3.5 | `self`, 0.3 s wind-up. Cone 3.5 m, 140 degrees: 45 (60 on Flood). Wet strip 6 m x 2 m straight ahead |
| W | Wet Floor Sign | 0.8 gap, 2 charges, one back per 8 s | Ground, 8 m (at least 1.5 m). Lands at 0.4 s, stands 6 s, wall 0.9 m wide, 40 HP (a hidden turret unit). Slide into it at 2.5 m/s or more: 40 and stun 0.6 s |
| E | Mop Bucket | 10 | Skillshot 8 m, 16 m/s, 0.3 s wind-up, radius 0.4: 40. Reaches 6 m at 0.65 s. Wet disc 2.5 m where it stops, 6 s |
| R | Flood | 24 | `self`. 1 s warning (telegraph disc 7 m, roots him), then the disc is wet 5 s. He gets haste 35% for 5 s and his Q is 60 |

## The slide

No engine change. `victimTick` (the screen that decides the enemy's position) measures the enemy's own step each frame, clamped at 6 m/s, as a
velocity `o`. On dry floor the momentum `v` is just `o`. On wet floor `v` follows `o` at 4 per second (about 0.25 s to catch up: they turn half as
fast; once they stop pressing, `v` eases to nothing in about 0.6 s, a 0.8 m glide from a walk). The difference `(v - o) * dt` goes through
`t.carryEnemy`, so a hero pressing steadily is not faster, and cover still stops them. A stunned or rooted hero does not slide. A slide is fast and
can help the victim as well: it carries them across a strip they want to cross.

The sign needs the slide's speed toward the sign to be at least 2.5 m/s while they are on wet floor: a hero walking on dry floor at 4 m/s into the
sign takes nothing, and neither does a slowed hero (2.4 m/s). A sign can hurt at most once a second.

## Where each rule runs (two screens)

- The wet list (`janitorBooks`, a WeakMap keyed by his figure) is written by Big Mop (at the swing), the bucket (where it stops) and Flood (at 1 s)
  on both screens, and drawn with `marks`. Wet is read in `victimTick` on the deciding screen.
- The sign: effect on both screens; its HP unit lives where the cast is played against the breaker. A break there tells his own client with
  `noteOwner('signbroke')`; a slide hit tells it with `noteOwner('signhit')` so the sign clangs there too.
- The bucket's splash lands where each screen saw the bucket stop (the victim's screen has the real bolt). They can differ a little on his own screen.
- Flood's surf: `afterCast` notes the time, `tick` applies haste when the water comes, `castMods` makes Q 60 meanwhile; `show('flood')` and a ring
  at his feet show it on both screens.

## What the CPU does (as Gus)

- Big Mop: held until the enemy is within 3.3 m, then it swings (the melee AI closes to 2 m).
- Wet Floor Sign: only with the enemy on wet floor within 8 m and none of his signs standing.
- Mop Bucket: from 2.5 m to 7.5 m.
- Flood: with the enemy within 5.5 m and no flood running.
- Walking: with a sign up and the enemy on wet floor, it goes round to the far side of the enemy so their way away from him runs onto the sign.

## Weakness and counterplay

The wet shows (blue shine, never red), and a slide is fast, so you can slide on purpose. Sidestep the bucket (0.65 s at 6 m). Stay out of 3.5 m.
Break the sign (40 HP). Against Flood, stand near cover, which stops a slide, or walk straight lines.

## Not built as written

Nothing dropped. Two notes: the sign's cooldown is a 0.8 s gap (the 8 s is the charge refill, as for Mum's Wall); the CPU fighting him does not
understand slides.
