---
title: Weather kit, Barry Cloudsley
tags: [design, heroes, kits, weather]
updated: 2026-11-04
---

# Weather kit: Barry Cloudsley, the weatherman (ranged mage)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "17. Barry Cloudsley". 570 HP, 4.0 m/s, basic attack 6 m, 10 per 1.0 s (look 'drop'). Accent `#6ac8ff`,
foil `#f4e65a`. Question: change the forecast, or trust it? Weakness: everyone sees the forecast, and the weather hits both. Second decision: a
change spends his damage spell. Palette `WEATHER` / `WEATHER_CSS` in `src/effects/parts/weather.ts`. Model: not set (registered by the lead). A cheerful TV
weatherman: a pointer tap, a smile, weather cards. Words: AND NOW THE WEATHER, SORRY FOLKS.

- **Passive And Now the Weather** (`src/traits/weather.ts`): every 8 s the weather changes to Rain (everyone slowed), Sun (everyone heals 4 a second)
  or Wind (a push of 1 m/s across the arena, in one of eight directions by the step). The next one is shown for 3 s, and one forecast in five is wrong.
  He is +20% in a weather he called right (the might buff, renewed every 0.35 s for 0.7 s; the engine multiplies it into every cast and attack, so
  `castMods` has nothing to add). In a wrong step he has no bonus.
- **The weather agrees on both screens by arithmetic, not messages.** `sync(t)` reads the round time and `own('upd')` (the number of Updates, sent with
  `t.show('upd')`) and keeps a per-figure `WeatherBook`. Step 0 is `mix(0) % 3`. Each later step's weather is `(now + 1 + ((mix(step) & 1) ^ (updates & 1))) % 3`:
  always another weather than the one now, and each Update flips which of the other two. The forecast shown is that, except when `mix(step*31 + updates*17 + 7) % 5 == 0`:
  then a different one. `mix` is an integer hash: no `Math.random`. Each screen latches a step's weather as it begins. A new round (the clock or the
  count goes back) starts over. Update cannot be cast in the last 0.6 s before a change, so both screens have the count before the step turns.
- **Applied per client.** `tick` (his own client): slow on himself (renewed every 0.3 s for 0.6 s), heal 4 once a second (only when hurt), `carrySelf` 1 m/s, the might buff.
  `victimTick` (the screen that decides the enemy's position): the same on the enemy through `t.status(enemy).apply('slow')`, `healEnemy`, `carryEnemy`.
- **What both players see.** The weather across the arena: one mark centred on it (`marks`, kinds `rain`, `sun`, `wind`, built once each by `markLook`). Every layer is
  a few hundred quads moved in a vertex shader from one time uniform (`driveWeather`: set once a frame, nothing allocated): 300 slanting rain streaks (alpha at
  most 0.5) and 90 floor ripples; 7 warm shafts on the floor and 80 twinkling motes; 90 leaves and 70 dust streaks along the wind. They fade out toward the arena's
  rim, never above the bloom threshold, and cross-fade over 1.2 s at a change. A ring at his feet in the weather's colour fills with the time left. In the 3 s before a
  change a big weather card ('NEXT: RAIN') hangs over Barry and `enemyLabel` shows 'RAIN IN 2' over the enemy; after the change the card says AND NOW THE WEATHER (or
  SORRY FOLKS, with the real weather, if the forecast was wrong).
- Q **Cold Front** (`coldFront.ts`, 'cold front'): GROUND, 9 m, cd 3.5, a skillshot. 0.25 s wind-up, 20 m/s, radius 0.4, 50. It reaches 6 m at 0.55 s (needs 0.25 + 0.9/4 = 0.48 s).
  In Rain the hit slows 1.5 s; in Wind it adds a knock of 6 (the engine caps a knock at 8 and moves a player 0.18 m per point, so about 1.4 m on a player, about 1.1 m on a CPU: it
  is not the 2 m of the table, which a knock cannot give). Both are put on the hit in `dealt`, where it is decided. The gust sheds drops, sparkles or leaves by the weather.
- W **Lightning Risk** (`lightningRisk.ts`, 'lightning risk'): GROUND, 9 m, cd 9. A grinning storm cloud rolls in over the spot, a 1.5 m circle, 0.8 s (0.25 + 1.5/4 = 0.63 s of reaction): 45.
- E **Forecast Update** (`forecastUpdate.ts`, 'forecast update'): SELF (radius 30 so the CPU's reach check never holds it), cd 12. The forecast changes now: the next change goes to
  the other weather (the other of the two it could have been: "the one you need least" is simplified to a cycle, not read from the enemy's situation). The new
  forecast is shown on a card flipped over his head with his pointer. It costs his damage spell: Cold Front goes on a 6 s cooldown. It is not castable in the last 0.6 s before a change.
- R **Severe Warning** (`severeWarning.ts`, 'severe warning'): GROUND, 9 m, cd 24. A 2 m warning circle for 1.0 s (he is rooted), then a tornado 5 m tall walks at the enemy at 2.5 m/s for 4 s,
  25 a second within 2 m (4 hits a second of 6, 6, 6, 7). It walks to the enemy's live position (both screens have it) and is kept in the ring. The hits are the trait's: the effect
  writes the tornado's place and `live` to the book every frame, and `victimTick` hits the enemy from it. One short impact frame as it stands up.

**CPU** (`aiHold`): Q and W as usual (no hold). E only when the step's weather was a surprise (the forecast was wrong) or on every third step by `mix(step*5+1)`, never in the last
second before a change. R only when the enemy is within 9 m. The CPU walks and aims like any hero.

**Needs from shared code:** register `weatherKit` in `HERO_KITS` and `Barry Cloudsley: weatherTrait` in `traits/index.ts`, the four modules in `spells/targeted/index.ts`, and a model.
A way to read the enemy's HP in a trait would stop Sun's "+0" floating over a full-health enemy (`healEnemy` shows a number even when it heals nothing).
