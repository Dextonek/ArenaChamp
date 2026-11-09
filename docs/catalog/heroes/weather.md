---
title: Barry Cloudsley, the Sky Augur (weather kit)
tags: [catalog, heroes, weather, mage, ranged, forecast, mechanics]
updated: 2026-11-04
---

# Barry Cloudsley, the Sky Augur

The weather hero kit: Barry's four spells (Q, W, E and the R ultimate), the passive forecast, the shared parts file, the palette row and the rigged hero model. A seer of the sky in a long storm-slate coat with a cloud mantle on his shoulders and a weathervane staff taller than he is. He is built on the [combat mechanics](../../architecture/mechanics.md): a ranged mage in an arena whose weather changes every 8 s and hits both heroes.

## Role

| | |
|---|---|
| Role | Mage (ranged) |
| Signature | And Now the Weather |
| HP | 610 |
| Kit shapes | Q LINE gust (reads the weather) · W ZONE lightning · E SELF forecast change · R ZONE walking tornado |

He wins by calling the weather right: he is stronger in a weather he forecast correctly, his gust changes with it, and he can change the forecast with an Update. His weakness is that the weather hits both heroes, everyone sees it coming, and one forecast in five is wrong.

## At a glance

| | |
|---|---|
| Hero | Barry Cloudsley, the Sky Augur |
| Spell category | `hero: weather` |
| Parts file | [`src/effects/parts/weather.ts`](../../../src/effects/parts/weather.ts) |
| Kit data | [`src/kits/weather.ts`](../../../src/kits/weather.ts) |
| Trait | [`src/traits/weather.ts`](../../../src/traits/weather.ts) |
| Kit sheet | [`kit-weather.md`](../../../pipeline/designs/kit-weather.md) |
| Model | [`public/models/heroes/weather_v3.glb`](../../../public/models/heroes/weather_v3.glb) |

## Palette

Sky blue, sunshine yellow, a mint wind, cloud white and a storm grey. Constants `WEATHER` and `WEATHER_CSS` in the parts file; the kit accent is the sky blue and the foil the sun yellow. Weather is an index everywhere: 0 rain, 1 sun, 2 wind.

| Core | Accent (rain) | Foil (sun) | Wind (mint) | Cloud | Grey | Storm | Dark | Suit |
|---|---|---|---|---|---|---|---|---|
| `#ffffff` | `#6ac8ff` | `#f4e65a` | `#b8f0d0` | `#e4edf8` | `#7b8aa2` | `#4a5870` | `#16233b` | `#2f5ea8` |

## Signature shape and material rules

A smiling cloud and a weather card. Even the storm cloud grins. The weather itself is a layer across the whole arena.

- Everything is pooled or built once, has `reset()` where it holds state and stays under the bloom threshold.
- The arena weather (`rainLook`, `sunLook`, `windLook`) is a few hundred quads moved entirely in a vertex shader from one time uniform, so nothing is allocated or written per frame; `driveWeather` sets the time, the wind and the fades.

## Passive and twist

| | |
|---|---|
| Passive | And Now the Weather. Every 8 s the arena's weather changes: Rain (everyone slower), Sun (everyone heals 4 a second) or Wind (a push of 1 m/s across). The next one is shown for 3 s before, but one forecast in five is wrong. He is +20% in a weather he called right. |
| Twist | Forecast. Change the forecast, or trust it? Everyone sees it, and the weather hits both. An Update costs his Cold Front. |
| Meter | NEXT, max 8: the seconds to the next change. |
| Speed | 4.0 m/s. |
| Basic attack | Ranged, range 6, damage 12, every 1.0 s, wind-up 0.25 s, speed 20, look `drop`. |
| Hooks | `tick` (the weather on his own hero), `victimTick` (the weather on the enemy and the tornado hits), `dealt` (Cold Front's rain slow and wind knock), `afterCast` (the Update), `canCast`, `marks`, `ring`, `enemyLabel`, `aiHold`, `badge`. |

- The weather is a pure function of the round time and the number of Updates cast; nothing is sent for the weather itself and nothing uses chance. Each screen applies it to the hero it decides.
- The might buff (+20%) is renewed while the weather lasts and the engine multiplies it into every cast and attack.
- An Update turns the next change to the other weather. It cannot be cast in the last 0.6 s before a change.

## Mechanics

Barry uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 9 m, 20 m/s, radius 0.4 |
| Arena weather | the passive: slow (Rain), heal 4 a second (Sun), push 1 m/s (Wind), for both heroes |
| Slow | Q in Rain slows 1.5 s |
| Knockback | Q knocks 2, or 6 in Wind |
| Might | +20% for him in a weather he forecast right |
| Walking mark | R's tornado walks at the enemy for 4 s and hits from `victimTick` |
| Cooldown cost | an Update puts Cold Front on a 6 s cooldown |
| Dash, pull, silence, summon | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/weather.ts`), numbers from `src/traits/weather.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [cold front](../../../src/spells/targeted/coldFront.ts) | ground LINE (bolt, radius 0.4) | 9 | 3.5 s | 0.25 s (launch) | about 2 s | He sweeps his pointer and a gust forms at his hand (three helices wound round a white puff) and leaves as a real bolt. It reaches 6 m at 0.55 s. What flies with it is the weather of the moment: blue drops in Rain, gold sparkles in Sun, leaves in Wind. A hit bursts into the weather's colour. Damage 64, knock 2; in Rain a 1.5 s slow; in Wind knock 6. |
| W | [lightning risk](../../../src/spells/targeted/lightningRisk.ts) | ground ZONE (r 1.5) | 9 | 9 s | 0.8 s | about 2.0 s | He points at the spot and a storm cloud with a wide grin rolls in 5.5 m above it, swelling and rumbling. A pale yellow ring marks the circle with sparks round its edge. At 0.8 s a jagged white-hot bolt comes down with a flash, a refraction ring and a star. Whoever stands in the circle at that moment is hit. The cloud lingers and drifts off, still smiling. Damage 64. |
| E | [forecast update](../../../src/spells/targeted/forecastUpdate.ts) | self (no target) | 0 (self) | 12 s | 0.34 s (the card flips) | 2.1 s | He swings his pointer up and a blank weather card hangs over his head. He taps it at 0.34 s with a crack of sparks and the card flips to the new forecast, swelling as it bobs, ringed by sparks in that weather's colour. It shrinks away at 1.7 s. No damage; the next change goes to the other weather and Cold Front is on a 6 s cooldown. |
| R | [severe warning](../../../src/spells/targeted/severeWarning.ts) | ground ZONE (r 2, a walking tornado) | 9 | 24 s | 1.0 s (it stands up) | about 5.8 s | A ring of the 2 m hit radius draws on the ground in pale blue and gold and a small whirl climbs out of the floor. At 1.0 s the tornado stands up, 5 m tall, in one impact frame: a funnel with swirling bands, orbiting debris and a skirt of dust. Then it walks at the enemy at 2.5 m/s for 4 s (they walk at 4, so it is a chase). Anyone within 2 m takes 25 a second, in four beats. It stops at 5.0 s and thins out. |

Spell sources: [`coldFront.ts`](../../../src/spells/targeted/coldFront.ts), [`lightningRisk.ts`](../../../src/spells/targeted/lightningRisk.ts), [`forecastUpdate.ts`](../../../src/spells/targeted/forecastUpdate.ts), [`severeWarning.ts`](../../../src/spells/targeted/severeWarning.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-weather).

The headers of `coldFront.ts` and `lightningRisk.ts` still say 50 and 45 damage; the numbers above are the constants in `src/traits/weather.ts` (`COLD_DAMAGE` 64, `BOLT_DAMAGE` 64).

## Parts file

[`src/effects/parts/weather.ts`](../../../src/effects/parts/weather.ts) holds everything the spells share. Everything is pooled or built once.

| Export | Role |
|---|---|
| `WEATHER`, `WEATHER_CSS`, `WEATHER_WORDS`, `WEATHER_CSS_OF`, `WEATHER_HEX_OF` | palette constants and the three weathers by index |
| `paintCloud`, `paintWeather` | canvas pictograms (the kit icons use them too) |
| `cardTexture`, `cardLook` | the big weather card over Barry |
| `rainLook`, `sunLook`, `windLook`, `driveWeather` | the layer of weather across the whole arena (`Trait.markLook`) and the one call that drives it |
| `Specks`, `Dots` | pooled round points (`Specks` fly on their own, `Dots` are placed by the caller) |
| `GustHead` | the cold front's flying head |
| `ThunderCloud` | a grinning cloud |
| `Lightning` | a jagged bolt |
| `Tornado` | a tall funnel with debris |
| `Pointer` | his pointer stick |

## Model

[`public/models/heroes/weather_v3.glb`](../../../public/models/heroes/weather_v3.glb): a rigged figure built by the `WeatherMythic` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Barry Cloudsley`); hero body size is radius 0.46, height 3.06 in `HERO_BODIES` (the staff counts, as Kaia's does). Restyled on 2026-11-09 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: a long storm-slate coat to the floor over a sky-blue front panel with gold buttons and edges, a high standing collar with a gold rim, flared sleeves, a muted sun-gold sash, dark boots, windswept brown hair and a calm, sure smile. Signature: a mantle of cloud heaped over his shoulders, and a staff topped by a gold weathervane: a ring with the sun, rain and wind glyphs round a glowing sky-blue orb, and an arrow across the top.
- HUD portrait (canvas-drawn in the kit data): a storm sky with slanting rain, the storm-slate coat with its sky-blue panel and gold buttons, the high collar, the cloud mantle, a calm face under windswept hair, and the weathervane staff with its glowing orb on the right.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-weather.md`](../../../pipeline/designs/kit-weather.md) |
| Parts | [`src/effects/parts/weather.ts`](../../../src/effects/parts/weather.ts) |
| Spells | [`coldFront.ts`](../../../src/spells/targeted/coldFront.ts), [`lightningRisk.ts`](../../../src/spells/targeted/lightningRisk.ts), [`forecastUpdate.ts`](../../../src/spells/targeted/forecastUpdate.ts), [`severeWarning.ts`](../../../src/spells/targeted/severeWarning.ts) |
| Kit data | [`src/kits/weather.ts`](../../../src/kits/weather.ts) |
| Trait | [`src/traits/weather.ts`](../../../src/traits/weather.ts) |
| Model | [`public/models/heroes/weather_v3.glb`](../../../public/models/heroes/weather_v3.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [The Great Zambini (magic)](magic.md), [Professor Puff (balloon)](balloon.md), [Bo (sheep)](sheep.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
