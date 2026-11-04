---
title: Sir Whiskers, the Cat Knight (cat kit)
tags: [catalog, heroes, cat, melee, assassin, lives]
updated: 2026-11-04
---

# Sir Whiskers, the Cat Knight

The cat hero kit (kits v5, a new hero): Sir Whiskers's four spells (Q, W, E and the R ultimate), his passive and twist, the shared parts file, the palette and the rigged hero model. An upright ginger cat in shining plate armour with a red plume and a tiny rapier, very pleased with himself. He is built on the [combat mechanics](../../architecture/mechanics.md): a fast melee assassin whose HP bar is nine lives.

## Role

| | |
|---|---|
| Role | Assassin (melee) |
| Signature | Nine Lives |
| HP | 540, in 9 lives of 60 (`hpChunks: 9`) |
| Kit shapes | Q QUICK claw cone, readies the next attack · W GROUND pot from cover, stun · E DASH leap that costs a life · R SELF save, the next lost life is kept |

He wins a 1v1 by deciding when to spend a life on purpose: attack on a full life, and on a low one spend it for a Cat Leap. His weakness is that many small hits and damage over time cut him apart (a big hit wastes most of its damage), and he has no answer to a slow. Walk speed 4.5 m/s.

## At a glance

| | |
|---|---|
| Hero | Sir Whiskers, the Cat Knight |
| Spell category | `hero: cat` |
| Parts file | [`src/effects/parts/cat.ts`](../../../src/effects/parts/cat.ts) |
| Kit data | [`src/kits/cat.ts`](../../../src/kits/cat.ts) |
| Trait data | [`src/traits/cat.ts`](../../../src/traits/cat.ts) |
| Kit sheet | [`kit-cat.md`](../../../pipeline/designs/kit-cat.md) (read [kit-common.md](../../../pipeline/designs/kit-common.md) first) |
| Design | [`new-heroes-kits.md`](../../../pipeline/designs/new-heroes-kits.md), section 5 |
| Model | [`public/models/heroes/cat_v2.glb`](../../../public/models/heroes/cat_v2.glb) |

## Palette

The palette `CAT` / `CAT_CSS` in the parts file. Ginger fur, shining steel, a red plume and a cream foil that shows on the dark floor and under every dark layer. Kit accent `#e8a13a`, kit foil `#f4e6c8`.

| Core | Body | Warm | Dark | Plume | Steel | Clay | Pink | Foil |
|---|---|---|---|---|---|---|---|---|
| `#fff6e0` | `#e8a13a` | `#c9741f` | `#2a1608` | `#c8423a` | `#c4ced8` | `#b5653a` | `#ff9eb4` | cream `#f4e6c8` |

Core is the white heart of a claw stroke; body (ginger) is the amber band of every stroke and ribbon; warm is the darker ginger; dark is the outline under every shape; plume (red) is the feather and the cracked hearts; steel is the armour; clay (with a darker `clayDark` `#6e3a20`) is the pot; pink is the cat's nose and ear insides.

## Signature shape and material rules

Comic strokes and a cat. Everything is drawn flat, with a dark outline under an amber band under a pale core, like a cartoon: three crossed claw strokes in the air, a leap as an amber ribbon with a ginger head with two ears riding its front, a clay pot that rocks, tumbles and breaks, floating comic words (MROW, MEH, CRASH, GOTCHA, FEET, NINE LIVES), paw prints and tiny cracked hearts.

- Flat unlit colours, nothing additive, so nothing turns into a white blob under bloom.
- Everything is pooled and ends clean within a few seconds of the cast.

## Passive and twist

| | |
|---|---|
| Passive | **Nine Lives**: his bar is nine lives of 60 HP. No single hit takes more than the life he is on: the rest of a big hit is wasted. Many small hits and damage over time are what cut him apart. |
| Twist | **Spend a life**: on a full life, attack. On a low one, spend it: Cat Leap costs the life he is on and Land on My Feet saves the next one. |
| Resource or meter | meter `LIVES` (max 9). The HP bar is cut into 9 chunks for both players. A cream `claw` mark pip shows while Scratch's free attack waits, and an amber `feet` gem while Land on My Feet is armed; a pulsing ring at his feet shows the armed save |
| Walk speed | 4.5 m/s |
| Basic attack | melee, 2 m, 15 per 0.7 s, wind-up 0.25 s, claw look |

Other trait rules (`src/traits/cat.ts`):

- The cap runs on his own client (`taken`) and reads his real HP: the life is `ceil(hp / 60)` and the room is what is left in it, so a hit on 12 HP of room takes 12 and a damage tick of 3 takes 3. At exactly 480 HP he is on life 8, full.
- Scratch readies his next basic attack at once (`resetAttack`) and for 2 s the next attack comes with no wait between the swings. The engine has no hook for the wind-up itself.
- Cat Leap spends the life he is on (`payHp`, down to the start of that life, so a low life is cheap) and cannot be cast on his last life ("Last life"). He cannot cast for 0.4 s after landing.
- Land on My Feet arms for 4 s. The first hit that would cost him a life leaves him 1 HP into it instead, the hit's status and knock are dropped, and he leaps 3 m away from the enemy in 0.25 s. Until then, or until it runs out, his attacks are 30% faster: the gap after each swing is 0.29 s instead of 0.45 s.
- The duel AI (`aiHold`) casts Knock It Over only with cover within 4 m of him, Cat Leap only on a life with under 20 HP left or at 4 to 7 m with more than 3 lives, and Land on My Feet not while it is armed.

## Mechanics

Sir Whiskers uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Melee kit | `melee: true` and `maxHp: 540` in the kit data. The duel AI walks up to about 2 m and keeps chasing |
| HP chunks | `hpChunks: 9`: the bar is cut into nine lives, for both players |
| Hit cap | the passive: no hit takes more than the life he is on |
| Pay HP | Cat Leap: `payHp` to the start of the current life |
| Dash | Cat Leap, up to 7 m in 0.65 s. Kit flag: E `dash` |
| Save | Land on My Feet. Kit flag: R `save` (the duel AI uses it under about 45% HP) |
| Stun | Knock It Over, 0.5 s. Kit flag: W `cc` |
| Cover | Knock It Over needs a pillar or wall within 4 m of him |
| Attack speed | Land on My Feet, +30% |
| Skillshot, summon, pull, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/cat.ts`), hit time and length from the spell files in `src/spells/targeted/`; "hit" is the telegraph impact time and the first damage. The E label in the kit data is "pounce" and its name is "Cat Leap".

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [scratch](../../../src/spells/targeted/scratch.ts) | self, QUICK cone (2.5 m, 90 degrees) | 2.5 | 3 s | 0.15 s | 1.3 s | He rakes the air in front of him: three crossed claw strokes, a pale star, fur and sparks, sometimes MROW. Damage 64 to everyone inside, with a small push. His next basic attack within 2 s is ready at once. |
| W | [knock it over](../../../src/spells/targeted/knockItOver.ts) | ground (r 1.5 pot), needs cover | 9 | 9 s | 0.7 s | 2.2 s | A clay pot rocks on the top of a pillar or wall within 4 m of him, is batted off at 0.2 s and falls in an arc onto the aimed spot (shown from the cast as a dark disc with an amber ring closing on it). At 0.7 s: 60 damage and a 0.5 s stun to whoever is inside, and the pot shatters (CRASH). With no cover in reach it does nothing: MEH, no zone and no hit. |
| E | [pounce](../../../src/spells/targeted/pounce.ts) | ground (dash, r 1.5 landing) | 7 | 8 s | 0.65 s | 2.2 s | Spends the life he is on (a cracked heart pops, MROW). He leaps up to 7 m toward the aim in 0.65 s, landing 0.8 m short of it, with an amber ribbon over the ground. At the landing: 60 damage and a push (knock 4) in a 1.5 m circle, four paw prints and GOTCHA. He cannot cast for 0.4 s after landing. Not on his last life. |
| R | [land on my feet](../../../src/spells/targeted/landOnMyFeet.ts) | self | 0 (self) | 24 s | flourish 0.4 s | 4.6 s | A twirl, a cream ring with six amber gems round his waist, sparkles, NINE LIVES. Armed for 4 s: the first hit that would cost a life is not lost, and he leaps 3 m away (a streak, paw prints and FEET). His attacks are 30% faster until then. No damage and no telegraph. |

Spell sources: [`scratch.ts`](../../../src/spells/targeted/scratch.ts), [`knockItOver.ts`](../../../src/spells/targeted/knockItOver.ts), [`pounce.ts`](../../../src/spells/targeted/pounce.ts), [`landOnMyFeet.ts`](../../../src/spells/targeted/landOnMyFeet.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-cat).

## Parts file

[`src/effects/parts/cat.ts`](../../../src/effects/parts/cat.ts) holds everything the four spells share. Spells import it directly (`../../effects/parts/cat`). Everything is pooled, takes world-space positions and has a `reset()`; the colours are flat and unlit.

| Export | Role |
|---|---|
| `CAT`, `CAT_CSS` | palette constants (`foil` is the cream) |
| `Claws` | three crossed claw strokes drawn in the air in front of the hero (a dark band, an amber band, a thin white core): `fire(at, yaw, size)` |
| `Specks` | pooled flecks (dust, sparks, fur, sparkles): `burst` throws them from a point, `ring` sends them out along the floor |
| `Pot` | one clay pot: `perch(at)` rocks on a ledge, `launch(to, dur, peak)` tips off and falls along an arc, `smash()` breaks into shards |
| `LandingMark` | the shadow of what is about to land: a dark disc with a cream rim at the real hit radius and a ring closing on it: `set(at, radius, k)`, `hide()` |
| `ArcTrail` | the leap of a cat: a tapering ribbon along a parabola with a ginger head with two ears riding its front: `fly(a, b, peak, dur)` |
| `Hearts` | a tiny cracked heart that drifts up (a life spent): `pop(at, size, life)` |
| `CatWord` | a floating comic word (MROW, GOTCHA): `show(text, at, size, life)` |
| `PawPrints` | paw prints on the floor that fade after a second: `stamp(at, yaw)` |
| `Halo` | a thin cream ring about a hero's waist with amber gems orbiting it: `set(center, radius, spin, opacity)` |

## Model

[`public/models/heroes/cat_v2.glb`](../../../public/models/heroes/cat_v2.glb): a rigged figure on the Dao rig. Built by `build("cat")` / `export("cat")` in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). Hero mode shows it with procedural walk, breath and cast poses. It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts). Hit size (`HERO_BODIES`): radius 0.49 m, height 2.39 m.

- Look: an upright ginger cat in shining plate, very pleased with himself. A cat first: an enormous round ginger head, tall ears with pink insides, a cream muzzle with a pink nose, long white whiskers, tabby stripes and half-closed green eyes. Plate on his chest, shoulders, arms and shins, a tiny rapier held up in the right paw and a tall red plume between the ears. A thick striped tail curls out behind him and up one side like a question mark.
- HUD portrait (canvas-drawn in the kit data): a cream halo of nine lives behind him, a steel pauldron and a red cloak at the shoulders, a gorget, then the head with its helmet and plume, and the small sword raised at the side.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-cat.md`](../../../pipeline/designs/kit-cat.md) |
| New heroes design | [`pipeline/designs/new-heroes-kits.md`](../../../pipeline/designs/new-heroes-kits.md) |
| Shared kit rules | [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md) |
| Parts | [`src/effects/parts/cat.ts`](../../../src/effects/parts/cat.ts) |
| Spells | [`scratch.ts`](../../../src/spells/targeted/scratch.ts), [`knockItOver.ts`](../../../src/spells/targeted/knockItOver.ts), [`pounce.ts`](../../../src/spells/targeted/pounce.ts), [`landOnMyFeet.ts`](../../../src/spells/targeted/landOnMyFeet.ts) |
| Kit data | [`src/kits/cat.ts`](../../../src/kits/cat.ts) |
| Trait | [`src/traits/cat.ts`](../../../src/traits/cat.ts) |
| Model | [`public/models/heroes/cat_v2.glb`](../../../public/models/heroes/cat_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mr. Ledger (ledger)](ledger.md), [Zephyr (sky)](sky.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
