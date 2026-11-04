# Cat kit: Sir Whiskers, the Cat Knight (melee assassin)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "5. Sir Whiskers, a cat knight". 540 HP in 9 lives of 60 (`hpChunks: 9`), 4.5 m/s, basic attack 2 m, 15 per 0.7 s
(0.25 s wind-up, look 'claw'). Accent `#e8a13a`, foil `#f4e6c8`. Question: when do I spend a life on purpose? Weakness: many small hits cut him apart,
and he has no answer to a slow. Palette `CAT` / `CAT_CSS` in `src/effects/parts/cat.ts`. Model: not set (registered by the caller).
- **Passive Nine Lives** (`src/traits/cat.ts`, `taken`, runs on his own client): no hit takes more than the life he is on. The life is `ceil(hp / 60)` and the room is
  `hp - 60 x (life - 1)` read live, so a hit on 12 HP of room takes 12 and a damage tick of 3 takes 3. At exactly 480 HP he is on life 8, full.
- Q **Scratch** (`scratch.ts`, 'scratch'): QUICK, `self`, cd 3. A 2.5 m cone, 90 degrees, impact 0.15 s: 64 to whoever is inside on their live position. Three crossed claw
  strokes in the air. His next attack within 2 s is ready at once (`resetAttack`) with a pip over him until it goes.
- W **Knock It Over** (`knockItOver.ts`, 'knock it over'): GROUND, `cc`, cd 9, 9 m. Needs cover within 4 m of him (the surface of a pillar or wall in `ctx.obstacles()`).
  A pot rocks on the cover's top, is batted off at 0.2 s, falls along an arc, tumbling, onto the spot (shown from the cast, 1.5 m circle) at 0.7 s: 60 and a 0.5 s stun
  (circle delay 0.7 >= 0.25 + 1.5 / 4 = 0.63). It shatters. With no cover: nothing, he bats the air (MEH), no telegraph, no hit.
- E **Cat Leap** (`pounce.ts`, 'pounce'): GROUND, `dash`, cd 8, 7 m. `afterCast` pays the life he is on (`payHp(room)`: to the start of that life), a cracked heart and
  MROW. Leap 0.65 s (`moveCaster`) landing 0.8 m short of the aim: 60 in a 1.5 m circle on live positions. He cannot cast for 0.4 s after landing (`hold` and `canCast`).
  Not castable on life 1 ("Last life").
- R **Land on My Feet** (`landOnMyFeet.ts`, 'land on my feet'): SELF, `save`, cd 24. Armed 4 s, shown as a pulsing ring at his feet (`show('feet')`, `Trait.ring`) and
  a cream ring with six gems on the effect. The first hit that would cost a life instead leaves him 1 HP into it, loses its status and knock, and he leaps 3 m away from the enemy
  in 0.25 s (`moveTo`); a leap counter in `catBooks` (also `show('leap')` for the other screen) lets the effect draw a streak, prints and FEET. Attack speed +30% until then:
  the gap after each swing is 0.29 s instead of 0.45 s (`resetAttack` from `tick`).

### What the CPU does (`aiHold`)
Q: whenever in 2.5 m (melee AI closes to about 2 m). W: held unless cover is within 4 m of it (`DUEL_OBSTACLES`). E: held on life 1 or beyond 8.5 m; otherwise only on a life
with under 20 HP left, or at 4 to 7 m with more than 3 lives. R: `save` (under about 45% HP), and held while it is armed.

### Known gaps
- Scratch's "free of its wind-up" is built as "ready at once": the engine has no hook to shorten a basic attack's wind-up.
- +30% attack speed has the same limit: only the gap after a swing shortens.
