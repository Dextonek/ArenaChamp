# Door kit: Wick, the Doorman (ranged controller)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "8. Wick, the Doorman". 590 HP, 4.0 m/s, basic attack 6 m, 10 per 1.0 s (look 'dart').
Accent `#b08a4a`, foil `#6a2a2a`. Question: where do I put the doors so only I profit? Weakness: you can use them too, or break them; without
them he is weak. Second decision: a door placed for escape is not there to shoot through. Palette `DOOR` / `DOOR_CSS` in `src/effects/parts/door.ts`:
brass, polished dark wood, the red of his livery, white gloves, warm light from a crack, keys turning in the air. A very polite old man.
- **Passive This Way, Please** (`src/traits/door.ts`): two doors at a time. Anyone who walks into one leaves by the other; a bolt of either side that
  flies into one comes out of the other, going the same way (`ctx.doors()`: ONE `BoltDoor` `{ ax, az, bx, bz, r: 0.8 }` while both stand, the same object
  all that time, removed when either goes). Each door is a record in `doorBooks` (a WeakMap keyed by his figure, written by the effects on both screens at
  the cast; ids count the casts) drawn by `Trait.marks` with `markLook`: an upright door in a dark wood frame with brass strips, a brass cornice and
  finial, a leaf of panels hung ajar so warm light shows from the crack and pools on the floor, a brass handle, a brass number plate on BOTH faces (the second
  door of a pair takes the first's number; a lone door is dim), two keys turning above it, and a service bell on a post 1.15 m to the side (the part a hit
  finds). A brass thread joins a pair on the floor. Doors are NOT obstacles: a hero walks into one.
- Trips. The enemy: `victimTick` (the victim's screen) calls `t.carryEnemy(dx, dz)`; himself: `tick` (his own client) calls `t.carrySelf(dx, dz)`. A hero
  within 0.8 m of a door's middle is set down 1.4 m beyond the far door, going the way he was going. Each hero has a 1 s lock after a trip, and has to be seen
  clear of a door's reach (reach + 0.3 m) before that door can take him, so a door put down on top of a hero does not take him until he has stepped off and
  back. A rooted or stunned hero is not taken. Words: THIS WAY, PLEASE (over Wick's head).
- **Doors have 40 HP** through a hidden `turret` unit (`damage: 0`, an invisible look, the HP bar over the bell), made where `ctx.summon` exists (the victim's
  screen) and kept on the bell by `victimTick`. It stands 1.15 m off the door's middle on purpose: a bolt that comes out of a door flies from its middle, and a unit
  there would be hit by every bolt the door passes (an enemy's 50 would break it at once). Aim at the bell, or use a spell, to break a door. Its death is
  told to his client with `noteOwner('broke', id)`; a broken door leaves planks for 0.7 s.
- Q **Key Toss** (`keyToss.ts`, 'key toss'): SHOT, cd 3.5, `aim: 'line'`. 0.3 s wind-up (a key drawn out at a white glove, turning faster), 9 m, 22 m/s,
  radius 0.3: 50, knock 1.5. A key flying lengthways, rolling about its length, with a brass gleam. Reaches 6 m at 0.57 s. Telegraph: a line per leg for the first
  three legs, `boltWidth(0.3)` wide; `doorPath` (a pure function of `sentFrom`, the aim, `ctx.doors()` and the obstacles, the same test as the projectile system)
  gives the legs, so the line goes to the door and on from the far door. Where no bolt flies (his screen online) the key is drawn along the same legs. A flash on
  the door it goes in and the one it comes out of when the real bolt's `doorLock` turns up (it does not tell an enemy's bolt: see below).
- W **Door** (`wickDoor.ts`, 'wick door'): TERRAIN, 9 m, 2 charges (`charges`: one back every 4 s), 0.6 s between casts. Rises at 0.5 s and stands 10 s. Not
  within 1.2 m of him; the second door of a pair is pushed to 3 m from the first. A third while two stand makes the oldest go (the spell is also refused by
  `canCast`: "Both doors stand"). Telegraph: the 0.9 m footprint, impact at the rise (he is rooted 0.5 s).
- E **Slam** (`doorSlam.ts`, 'door slam'): SELF (`radius: 30`), cd 9, `cc: true`. After 0.7 s every door of his that stands slams: 40 and a 0.5 s stun on an enemy within
  1.5 m of it, on the LIVE position (`ctx.enemies`). Telegraph: a 1.5 m circle at each door, the real shape (he is rooted until it lands). `canCast`: "No door
  stands". A lone door slams too. A door that broke meanwhile does not.
- R **Grand Lobby** (`grandLobby.ts`, 'grand lobby'): GROUND, 9 m, cd 24. 0.8 s wind-up (hands up, a key over each glove, the ring fills, four keys circle), then
  four tall red double doors rise on a 3 m ring round the aim point, turned so a gap (not a door) faces him, and stand 4 s. Walking into one (within 1.1 m) sets a hero down
  1.8 m inside the ring at the far side (the opposite door); two `BoltDoor`s (opposite doors, `r` 1.1) so a bolt that flies into one comes out of the opposite one (one in, one out: not four in a row), his Q included; a straight Q crosses a gap and hits what stands in the middle. They do not count against the two-door limit and have no HP. The gap between two doors is 4.24 - 2.2 = 2.04 m: anyone can walk out. Needs
  sight of the spot at the rise and 9.5 m or less, else it fizzles. One short impact frame and a warm flash.

### The CPU (aiHold, aiGoal)
- Q: as every skillshot, at the enemy within 9 m in sight.
- W: held while two doors are placed. `aiHold` marks the cast (`cpuAt`), so with no door standing the first door goes 2.2 m from him toward the enemy, and the second goes
  where the CPU aims, at the enemy (the effect keeps it 3 m from the first).
- E: held unless one of his standing doors is within 1.5 m of the enemy.
- R: held when the enemy is more than 9 m away (and by the CPU's usual rule for an ultimate).
- `aiGoal`: with the enemy within 3 m (the traits cannot see a kit's `melee`) and a door he has been clear of standing within 4 m that leads somewhere at least 4 m
  from the enemy (and farther than he is), he walks into it.

### Things to know
- Online, bolts fly on the victim's screen (and his own bolts at him on his), so the bolt list is kept right on both: `syncBolts` runs from `tick`, `victimTick`
  and the effects. A new round empties the list; `newRound` (a `t.time` that went back) clears the book.
- A trip is one big step through `carryEnemy` / `carrySelf`. `arena.moveFoe` (offline CPU) slides the step round an obstacle only within 0.03 m of the start, and
  `keepInside` puts the arrival out of any obstacle and inside the ring, so the step lands where it was meant to. The hero camera is rate-limited (it eases in over
  about 0.2 s): a 9 m trip shows as a swoop, not a cut. The CPU's route is rebuilt every frame (`pathClear`).
- The flash on the far door is drawn for his own key only. For an enemy's bolt it would need a hook in `projectile.ts` (e.g. `BoltDoor.onPass`).
- Q's telegraph reads `ctx.doors()` at the cast: a key thrown within 0.5 s of the second door sees no pair in the list, so the line is straight while the real bolt jumps.
- A dash through a door: the carry is overwritten next frame by the dash, and the 1 s lock is spent (`TraitView` has no dash query).
- `aiGoal` is reached after the CPU's basic-attack branch, so inside his 6 m reach he attacks when ready and walks to the door between attacks.
- The bell (and its unit) stands at world +x of every door: a bolt leaving the far door toward +x hits that bell.
