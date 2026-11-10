---
title: Wick, the Doorwarden (door kit)
tags: [catalog, heroes, door, controller, ranged, portals, mechanics]
updated: 2026-11-04
---

# Wick, the Doorwarden

The door hero kit: Wick's four spells (Q, W, E and the R ultimate), the passive pair of doors, the shared parts file, the palette row and the rigged hero model. An old, thin keeper of thresholds in a long dark oxblood coat with gold braid, a hood lying back on his shoulders, and a great ring of keys with a glowing amber gem. He is built on the [combat mechanics](../../architecture/mechanics.md): a ranged controller whose doors come in pairs, so whoever walks in one leaves by the other.

## Role

| | |
|---|---|
| Role | Controller (ranged) |
| Signature | This Way, Please |
| HP | 650 |
| Kit shapes | Q LINE key (goes through doors) · W DOOR (two charges) · E AURA slam at the doors · R ZONE four doors round the enemy |

He wins by moving people and bolts: a hero or a bolt that enters a door comes out of its pair, and his key flies through all of them. His weakness is that the doors have only 40 HP and are his only trick: use them against him, or break the bell beside one. Without them he is a weak old man.

## At a glance

| | |
|---|---|
| Hero | Wick, the Doorwarden |
| Spell category | `hero: door` |
| Parts file | [`src/effects/parts/door.ts`](../../../src/effects/parts/door.ts) |
| Kit data | [`src/kits/door.ts`](../../../src/kits/door.ts) |
| Trait | [`src/traits/door.ts`](../../../src/traits/door.ts) |
| Kit sheet | [`kit-door.md`](../../../pipeline/designs/kit-door.md) |
| Model | [`public/models/heroes/door_v3.glb`](../../../public/models/heroes/door_v3.glb) |

## Palette

Brass, polished dark wood, a red livery with brass buttons, white gloves and a warm light behind every door. Every colour stays under the bloom threshold. Constants `DOOR` and `DOOR_CSS` in the parts file; the kit accent is the brass and the foil the livery red.

| Brass (accent) | Hot | Shade | Glow | Wood | Wood light | Wood dark | Red (foil) | Red light | Glove |
|---|---|---|---|---|---|---|---|---|---|
| `#b08a4a` | `#e6c984` | `#7a5c2c` | `#ffcf7a` | `#5a3321` | `#7a4a2c` | `#2c1a10` | `#6a2a2a` | `#8c3a38` | `#f0ebdd` |

## Signature shape and material rules

An upright door in its frame, ajar, with warm light at the crack and a brass number plate. A pair of doors carries the same number and a thin brass thread joins them on the floor.

- A door is a real upright door in its frame with a warm glow from its crack, a brass number on both faces, two keys turning in the air above it and a service bell on a post beside it where the door can be hit.
- The Grand Lobby doors are the wider red double doors; a broken door leaves planks and brass on the floor.
- Doors are drawn by the trait's `marks`, not by the spells.

## Passive and twist

| | |
|---|---|
| Passive | This Way, Please. Two doors at a time (Door), standing 10 s, 40 HP each, with the same brass number on both. Anyone who walks into one leaves by the other, and a bolt that flies in comes out of the other, going the same way, whoever shot it. A hero is left alone for 1 s after a trip. |
| Twist | A Door For Whom. A door put down to escape is not there to shoot through. Use his doors against him, or break the bell by one. Without them he is a weak old man. |
| Meter | DOORS, max 2. |
| Speed | 4.0 m/s. |
| Basic attack | Ranged, range 6, damage 15, every 1.0 s, wind-up 0.25 s, speed 20, look `dart`. |
| Charges | W has 2 charges, one back every 4 s; its cooldown is a 0.6 s gap. |
| Hooks | `marks` and `markLook` (the doors), `victimTick` (the enemy's trip, with `carryEnemy`), `tick` (his own trip, with `carrySelf`), `canCast`, `afterCast`, `peerNote`, `aiHold`, `aiGoal`, `badge`. |

- Doors are not obstacles: a hero walks into one. A bolt that reaches a door comes out of its pair (`ctx.doors()` gets one bolt door while two stand).
- After a trip a hero has a 1 s lock and must have been seen clear of a door's reach before it can take him again. A door put down on top of a hero does not take him until he has stepped off and back.
- A door's 40 HP is a hidden `turret` unit on the bell beside it; its death is told to his own client.
- The Grand Lobby doors are not counted against his two doors and have no HP.

## Mechanics

Wick uses these pieces of [the combat mechanics](../../architecture/mechanics.md):

| Mechanic | Where |
|---|---|
| Projectile | Q is a real bolt (`ctx.projectile`): 9 m, 22 m/s, radius 0.3. Bolts pass through doors via `ctx.doors()` |
| Doors (teleport) | the passive and R; the trip moves the enemy with `carryEnemy` and him with `carrySelf` |
| Charges | W has 2 charges (see the passive) |
| Units | each door has a hidden 40 HP `turret` unit |
| Stun | E: 0.5 s (`cc: true`, so the duel AI casts it first when in range) |
| Dash, pull, silence, heal | none |

## Spells

All four play under the normal gameplay camera. Range and cooldown come from the kit data (`src/kits/door.ts`), numbers from `src/traits/door.ts`, hit time and length from the spell files in `src/spells/targeted/`.

| Key | Label | Targeting | Range | Cooldown | Hit time | Length | What happens |
|---|---|---|---|---|---|---|---|
| Q | [key toss](../../../src/spells/targeted/keyToss.ts) | ground LINE (bolt, radius 0.3) | 9 | 3.5 s | 0.3 s (launch) | about 2.5 s | He draws a brass key out at his white-gloved hand over the wind-up and throws it as a real bolt. The key flies lengthways and turns about its length so its teeth flash, with a brass gleam behind it. It reaches 6 m at 0.57 s. A bolt that flies into a door comes out of its pair, going the same way (his own key too), and through all four doors of the Grand Lobby; the telegraph shows the line from him to the door and from the other door onward. Damage 78 and a small knock. |
| W | [wick door](../../../src/spells/targeted/wickDoor.ts) | ground (door footprint r 0.9, at least 1.2 m from him) | 9 | 0.6 s (2 charges) | 0.5 s (it rises) | about 1.8 s | A brass ring and a column of warm light mark the spot while three keys turn round it. At 0.5 s a real upright door in its frame steps up there, with a warm glow from its crack, a brass number on both faces and a service bell on a post beside it. A second door takes the first's number and a brass thread joins them. He is rooted until it rises. No damage. 40 HP each, 10 s. |
| E | [door slam](../../../src/spells/targeted/doorSlam.ts) | self (circles round each standing door, r 1.5) | 0 (self) | 9 s | 0.7 s | 1.7 s | Every door of his that stands is the centre of a circle: for 0.7 s the light in its crack grows hotter and wider, a red warning disc fills the circle inside a brass ring and brass flecks rattle off the frame. At 0.7 s the doors slam, with a big star on each, a ring of force, a burst of brass and a camera jolt. A door that broke meanwhile does not slam. He is rooted until then. Damage 70, stun 0.5 s. |
| R | [grand lobby](../../../src/spells/targeted/grandLobby.ts) | ground ZONE (ring r 3 round the enemy's spot, needs sight) | 9 | 24 s | 0.8 s (the doors rise) | about 2.3 s (doors stand 4 s) | He raises both gloved hands with a key turning over each, and the floor round the enemy's spot fills with a brass ring while four keys circle it and four door-shaped shadows mark where the doors will stand. At 0.8 s four tall red double doors rise on the ring, with a big star on each, a ring of force, an impact frame and a warm flash. They stand for 4 s. Each is the other's mate across the ring: walking into one sets you down at the far side. No damage. |

Spell sources: [`keyToss.ts`](../../../src/spells/targeted/keyToss.ts), [`wickDoor.ts`](../../../src/spells/targeted/wickDoor.ts), [`doorSlam.ts`](../../../src/spells/targeted/doorSlam.ts), [`grandLobby.ts`](../../../src/spells/targeted/grandLobby.ts). Their catalog rows are in the [effect catalog](../effects.md#hero-door).

The headers of `keyToss.ts` and `doorSlam.ts` still say 50 and 40 damage; the numbers above are the constants in `src/traits/door.ts` (`KEY_DAMAGE` 78, `SLAM_DAMAGE` 70).

## Parts file

[`src/effects/parts/door.ts`](../../../src/effects/parts/door.ts) holds everything the spells share. Everything takes world-space positions and has `reset()` where it holds state.

| Export | Role |
|---|---|
| `DOOR`, `DOOR_CSS` | palette constants |
| `doorLook`, `DoorLookOptions`, `pairDoorLook`, `grandDoorLook` | a real upright door in its frame (`Trait.markLook`) and the Grand Lobby's wider red double door |
| `brokenLook` | planks and brass on the floor |
| `threadLook` | the brass line between a pair |
| `lobbyRingLook` | the brass ring the Grand Lobby draws on the floor |
| `KeyFlock` | pooled brass keys |
| `buildKey` | one brass key |
| `Flecks` | brass confetti that flies and falls |
| `Glove` | a white glove |
| `glowSpill`, `flatRing` | floor light and rings |
| `DOOR_OPEN`, `DOOR_HEIGHT`, `LOBBY_OPEN`, `LOBBY_HEIGHT`, `BELL_X`, `BELL_TOP`, `doorMid` | sizes and a helper |

## Model

[`public/models/heroes/door_v3.glb`](../../../public/models/heroes/door_v3.glb): a rigged figure built by the `DoorMythic` class in [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py). It is wired through the `MODELS` map in [`src/heroes.ts`](../../../src/heroes.ts) (name `Wick`); hero body size is radius 0.41, height 2.44 in `HERO_BODIES`. Restyled on 2026-11-10 to the game's look ([heroes-restyle.md](../../../pipeline/designs/heroes-restyle.md)); the old `_v2` file stays beside it.

- Look: old and thin as a door. A long dark oxblood coat to below the knee with wide gold braid down the front, at the hem and at the cuffs, a high stiff collar, small gold shoulder plates, dark gloves, a hood lying back on his shoulders with a gold rim and its point down his back, short silver hair swept back, a long calm face and a thin polite smile. Signature: a great brass ring of oversized keys hanging from his right hand with a glowing amber gem among the keys, and a small dark lantern with a gold frame hanging from his left hand.
- HUD portrait (canvas-drawn in the kit data): a dark wine-brown ground with a door behind him, ajar, warm light at its crack, a long oxblood coat with a stiff collar and gold braid down the front, a hood lying back on his shoulders, a long thin pale face with silver hair swept back, level brows, calm steady eyes and a thin smile, and a dark-gloved hand holding up a ring of keys with a glowing amber gem among them.

## Files

| What | Where |
|---|---|
| Kit sheet (design) | [`pipeline/designs/kit-door.md`](../../../pipeline/designs/kit-door.md) |
| Parts | [`src/effects/parts/door.ts`](../../../src/effects/parts/door.ts) |
| Spells | [`keyToss.ts`](../../../src/spells/targeted/keyToss.ts), [`wickDoor.ts`](../../../src/spells/targeted/wickDoor.ts), [`doorSlam.ts`](../../../src/spells/targeted/doorSlam.ts), [`grandLobby.ts`](../../../src/spells/targeted/grandLobby.ts) |
| Kit data | [`src/kits/door.ts`](../../../src/kits/door.ts) |
| Trait | [`src/traits/door.ts`](../../../src/traits/door.ts) |
| Model | [`public/models/heroes/door_v3.glb`](../../../public/models/heroes/door_v3.glb) |
| Model script | [`blender/heroes/restyle_batch3.py`](../../../blender/heroes/restyle_batch3.py) (the `_v3` class), [`blender/heroes/moba_figures.py`](../../../blender/heroes/moba_figures.py) (the old class and the build kit) |

## See also

- [Hero roster and shared structure](README.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Mum (mime)](mime.md), [The Great Zambini (magic)](magic.md), [Mr. Ledger (ledger)](ledger.md)
- [Effect catalog](../effects.md)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
