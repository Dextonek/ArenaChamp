---
title: Big Yoko, the Sumo (kit)
tags: [design, heroes, kits, sumo]
updated: 2026-11-04
---

# v5 (2026-11-04)

Theme `sumo`. Tank, melee. 840 HP, 3.6 m/s, basic attack 2.4 m, 20 per 1.2 s (0.35 s wind-up). Accent `#e63a3a`, foil `#f4ead0`.
Numbers from [new-heroes-kits.md](new-heroes-kits.md) section 16; the constants live in `src/traits/sumo.ts`.

| Key | Spell | CD | Rule | Built as |
|---|---|---:|---|---|
| P | Dohyo | | One ring at a time, 5 m radius, 8 s, a straw rope on the floor. A push of his that carries you from inside it to outside is a **ring-out**: +80 damage, stunned 0.5 s | `sumoBooks` record written by Stomp; `marks` / `markLook` draw it; `victimTick` decides the ring-out |
| Q | Palm Strike | 3 | A 2.8 m by 2 m strip, 0.4 s: 54 and shoved 3 m along his facing over 0.22 s | Self spell, line telegraph, `ctx.carry` |
| W | Stomp | 11 | 3 m circle, 0.5 s: 50 and slowed 1 s. Stamps the ring at his feet | Self spell, circle telegraph; writes the ring on both screens |
| E | Charge | 10 | 6 m run (0.4 s wind-up, 2 m strip shown): the first enemy on it takes 40 and is carried ahead of him. Ring-out counts | Ground spell, `ctx.moveCaster`, `ctx.carry` every frame (as Forge Charge) |
| R | Salt Throw | 22 | 6 m cone, 70 degrees, 0.6 s: blinded 1.5 s. The ring loses 2 m of radius (5, 3, 1) for the rest of its life. He is 30% faster for 4 s | Self spell, cone telegraph; `shrinkRing` on both screens; haste from `tick` 0.6 s after the cast |

Counterplay (checked with the numbers in kits-v5.md): Q is 0.4 s with the strip shown, and walking away is faster than he is (4 against 3.6). W: leave 3 m in 0.5 s
(2 m at 4 m/s; he is slower, and the circle starts at his feet). E: a strip 2 m wide, 0.4 s wind-up, sidestep 1 m in 0.25 s. R: stay out of the cone, or
leave the ring. Weakness: walk out of the ring before he finishes it; he is slow.

## Network duel

The ring is a place both screens know: Stomp's effect writes the record (`bookOf(caster).ring`) when it lands, from `sentFrom`, and Salt Throw's effect shrinks it at its
own impact moment, on both screens. Nothing in it depends on the effect staying alive.

- Moving the enemy: the effect carries it with `ctx.carry`, which moves only the hero that screen decides (offline everyone, online the victim's own hero). Judged by live position.
- Ring-out: the effect opens a push window on the record (`pushUntil`, both screens). `victimTick` (offline always, online the victim's screen) remembers whether the enemy was
  inside the ring last frame, and if inside the window it is outside now, it makes the bonus hit with `hitEnemy` (80, stun 0.5 s, a 'trait' hit) once and closes the window.
  Big Yoko has no `dealt` hook, so no hit of his can start a ring-out or answer one: the bonus hit cannot trigger itself. A ring that shrinks under the enemy, or an enemy
  who walks out outside a push window, is not a ring-out.
- The word RING OUT (`enemyLabel`, read on both screens) comes from `ringOutAt`, set where the ring-out was decided and sent to his own client with `noteOwner('ringout')`.
- A new round: `marks` / `victimTick` notice the trait clock going back and drop the ring.
- Haste: his own client, `tick`, 0.6 s after the cast (`t.buff('haste', 0.3, 4)`).

## The CPU

- `aiGoal`: a ring up and the enemy inside it (at least 0.3 m from the rope): it walks to the point 1.8 m from the enemy on the side away from the nearest rope, so a shove goes out over
  the edge. Near the middle it uses the way it already faces the enemy. At that point (within 0.4 m) it returns to the usual steering.
- `aiHold`: W when there is no ring, or the enemy is outside it and within 3 m of him; R only with the enemy within 6 m.
- Q: whenever the enemy is within 2.8 m (the usual order R, E, W, Q picks the first ready spell in reach). E is flagged `dash`: it runs when the enemy is out of Q's reach (past 3.3 m, within 6 m), W when it may (above) and Q last.
