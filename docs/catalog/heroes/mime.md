---
title: Mum, the mime (mime kit)
tags: [catalog, heroes, mime, controller, ranged, walls, mechanics]
updated: 2026-11-04
---

# Mum, the mime

The mime hero kit: Mum's four spells (Q, W, E and the R ultimate), the passive walls, the shared parts file, the palette row and the rigged hero model. A thin mime with a white face, a striped shirt, a black beret, a red scarf and white gloves. She never speaks: no floating words, only gestures. She is built on the [combat mechanics](../../architecture/mechanics.md): a ranged controller whose walls and ball you cannot see, only chalk lines on the floor.

## Role

| | |
|---|---|
| Role | Controller (ranged) |
| Signature | Silence Is Golden |
| HP | 620 |
| Kit shapes | Q LINE bolt you cannot see · W WALL (three charges) · E TARGET pull · R BOX of four walls |

She wins by hiding what is real: an unseen ball down a chalk line, walls that block the enemy and not her ball, a rope that drags the enemy in and a box that shuts them in. Her weakness is that one hit of any size breaks a wall, and the chalk shows where they are.

## At a glance

| | |
|---|---|
| Hero | Mum, the mime |
| Spell category | `hero: mime` |
| Parts file | [`src/effects/parts/mime.ts`](../../../src/effects/parts/mime.ts) |
| Kit data | [`src/kits/mime.ts`](../../../src/kits/mime.ts) |
| Trait | [`src/traits/mime.ts`](../../../src/traits/mime.ts) |
| Kit sheet | [`kit-mime.md`](../../../pipeline/designs/kit-mime.md) |
| Model | [`public/models/heroes/mime_v2.glb`](../../../public/models/heroes/mime_v2.glb) |

## Palette

Black and white, chalk on stone, with one red accent from the scarf. Constants `MIME` and `MIME_CSS` in the parts file; the kit accent is chalk and the foil the dark.

| Chalk (accent) | Dim | Smudge | Dark (foil) | Ink | Red | Skin |
|---|---|---|---|---|---|---|
| `#f7f7f2` | `#cfcfc8` | `#8d8d96` | `#20202a` | `#0c0c12` | `#d23a3a` | `#fbfbf6` |

## Signature shape and material rules

The white glove, and dashed chalk lines for what cannot be seen. A wall, the ball's path and the rope are shown only as a dashed chalk line on a dark layer on the floor; a wall also has a faint shimmer in the air.

- Plain materials: this kit has no additive glow and is not bright.
- Nothing flies in the air for the ball, and no word is ever shown: gestures only.
- Chalk chips and flakes fly and fall where something is hit; a red-edged line is the telegraph of a wall.

## Passive and twist

| | |
|---|---|
| Passive | Silence Is Golden. She makes up to 3 invisible walls (Wall) and Boxed In makes 4 more: real, solid for both heroes, for 5 s (3 s for the Box), shown only as faint chalk on the floor and a faint shimmer. One hit of any size breaks a wall. |
| Twist | Which Wall Is Real. A wall for cover is not a wall to trap you: read the chalk, and break the one in your way with anything. She never speaks, and her walls cost her her own sight too. |
| Meter | WALLS, max 3: the plain walls standing. |
| Speed | 4.1 m/s. |
| Basic attack | Ranged, range 5.5, damage 14, every 0.9 s, wind-up 0.25 s, speed 20, look `orb`. |
| Charges | W has 3 charges, one back every 3 s; its cooldown is a 0.6 s gap. |
| Hooks | `marks` and `markLook` (walls), `victimTick` (keeps each wall unit on the line between the enemy and her, expires walls), `tick`, `peerNote`, `ownChanged`, `aiHold`, `badge`. |

- Each wall is a real obstacle, a bolt wall and a 1 HP unit. Units count toward the cap of 6 a side: a wall or Box that would go over drops the oldest wall.
- Her own Invisible Ball passes her walls (`passBolt` lifts a wall's obstacle while the bolt is at it).
- The CPU raises a Wall only with the enemy 3 to 8 m away and fewer than 3 plain walls standing, and casts Boxed In only within 8 m.

## Mechanics

Mum uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 9 m, 22 m/s, radius 0.3. It stops at pillars and arena walls, not at her own walls |
| Obstacles | W and R raise walls with `ctx.addObstacle`: capsules 0.14 m each side of the line, 2.3 m high, solid for both heroes and the AI |
| Charges | W has 3 charges (see the passive) |
| Pull | E pulls the enemy 3 m toward her over 0.3 s with `ctx.carry`, stopping 1 m short of her |
| Sight | E needs sight when it lands; cover (her own walls too) breaks it |
| Units | each wall is a 1 HP unit, so one hit of any size breaks it |
| Knockback | Q knocks 1.5 |
| Heal, dash, silence | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/mime.ts`), numbers from `src/traits/mime.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [invisible ball](../../../src/spells/targeted/invisibleBall.ts) | ground LINE (aimed along a chalk line) | 9 | 3.5 s | 0.3 s (thrown) | 2.2 s | Her glove closes round nothing, winds back and throws. Nothing flies in the air; the only sign is a dashed chalk line on the floor, as wide as the ball really hits. The ball is a real bolt, reaches 6 m at 0.54 s and flies through her own walls. Where it hits, a chalk star and chips pop out of the air. A miss ends in a puff of chalk dust. Damage 72, knock 1.5. |
| W | [mime wall](../../../src/spells/targeted/mimeWall.ts) | ground LINE (a 4 m wall, at least 1.5 m from her) | 9 | 0.6 s (3 charges) | 0.5 s (the wall rises) | 1.4 s | Both flat gloves press a pane that is not there and walk sideways along it while a dashed chalk line is drawn on the floor. At 0.5 s it is a wall for both heroes, standing 5 s. One hit of any size breaks it. Three plain walls at most; a fourth takes the oldest. She is rooted until it rises. No damage. |
| E | [rope trick](../../../src/spells/targeted/ropeTrick.ts) | enemy (needs sight) | 7 | 11 s | 0.5 s | 1.6 s | She mimes a rope, hand over hand, scarf streaming, while a dashed chalk line from the enemy to her marches toward her. At 0.5 s she heaves: if she still sees the enemy and it is within 9.2 m the rope has it, and it is hit and pulled 3 m toward her. A step behind cover before the heave frees it. Damage 55, pull 3 m. |
| R | [the box](../../../src/spells/targeted/theBox.ts) | ground (box 3 m a side, at least 2.4 m from her) | 9 | 22 s | 0.8 s | 1.7 s | She draws a box in the air with both gloves while a dashed chalk square is drawn on the floor and four red-edged lines show the walls. At 0.8 s four walls close round the spot, each a real obstacle that one hit breaks, standing 3 s. Whoever is inside cannot walk out; she cannot see or walk in. No damage. |

Spell sources: [`invisibleBall.ts`](../../../src/spells/targeted/invisibleBall.ts), [`mimeWall.ts`](../../../src/spells/targeted/mimeWall.ts), [`ropeTrick.ts`](../../../src/spells/targeted/ropeTrick.ts), [`theBox.ts`](../../../src/spells/targeted/theBox.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-mime).

The headers of `invisibleBall.ts` and `ropeTrick.ts` still say 50 and 30 damage; the numbers above are the constants in `src/traits/mime.ts` (`BALL_DAMAGE` 72, `ROPE_DAMAGE` 55).

## Parts file

[`src/effects/parts/mime.ts`](../../../src/effects/parts/mime.ts) holds everything the spells share. Everything takes world-space positions and has `reset()` where it holds state.

| Export | Role |
|---|---|
| `MIME`, `MIME_CSS` | palette constants |
| `ChalkDashes` | a dashed chalk line on the floor over a dark layer; grows along its length |
| `Flecks` | chalk chips and flakes that fly and fall |
| `Gloves` | pooled white gloves with a dark cuff (the hands she mimes with: open palm to a fist) |
| `ScarfTail` | a short red ribbon that flutters |
| `wallLook`, `crumbLook` | what a wall and a broken wall leave on the floor (`Trait.markLook`): faint chalk and a faint shimmer |

## Model

[`public/models/heroes/mime_v2.glb`](../../../public/models/heroes/mime_v2.glb): a rigged figure built by the `Mime` class in [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Mum`); hero body size is radius 0.45, height 2.58 in `HERO_BODIES`.

- Look: thin, with a big white-painted face with black diamonds over the eyes, high arched brows and a small red mouth, a tilted black beret, a striped shirt in big black and white bands, high black trousers and a long red scarf flying behind her. Huge white gloves with open, spread fingers and frilled cuffs, the one thing she talks with.
- HUD portrait (canvas-drawn in the kit data): a dark ink ground with a white glove pressed flat against an invisible pane and a dashed chalk line where the pane stands, a striped shirt, a red scarf knotted at the throat with one tail flying, and a long oval white painted face with a beret, raised brows, round lashed eyes and a tear.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-mime.md`](../../../pipeline/designs/kit-mime.md) |
| Parts | [`src/effects/parts/mime.ts`](../../../src/effects/parts/mime.ts) |
| Spells | [`invisibleBall.ts`](../../../src/spells/targeted/invisibleBall.ts), [`mimeWall.ts`](../../../src/spells/targeted/mimeWall.ts), [`ropeTrick.ts`](../../../src/spells/targeted/ropeTrick.ts), [`theBox.ts`](../../../src/spells/targeted/theBox.ts) |
| Kit data | [`src/kits/mime.ts`](../../../src/kits/mime.ts) |
| Trait | [`src/traits/mime.ts`](../../../src/traits/mime.ts) |
| Model | [`public/models/heroes/mime_v2.glb`](../../../public/models/heroes/mime_v2.glb) |
| Model script | [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Big Yoko (sumo)](sumo.md), [Referee Whistler (referee)](referee.md), [Wick (door)](door.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
