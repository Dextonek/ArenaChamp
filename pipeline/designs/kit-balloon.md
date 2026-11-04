# Balloon kit: Professor Puff, balloon scientist (ranged mage)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "4. Professor Puff, balloon scientist". 560 HP, 3.9 m/s, basic attack 6 m, 10 per 1.0 s (look 'orb').
Accent `#ff8fb8`, foil `#fff1a8`. Question: pop you now, or inflate you more? Weakness: you can deflate, by standing still or by hitting him; he is
fragile. Palette `BALLOON` / `BALLOON_CSS` in `src/effects/parts/balloon.ts`. Kit `src/kits/balloon.ts` (`balloonKit`), trait `src/traits/balloon.ts` (`balloonTrait`).
- **Passive Inflate**: his hits add Air to the enemy hero (stacks `air`, 10 at most, 6 s from the last add): Air Hose 3, Helium Bomb 3, a basic attack 1
  (the design is silent on attacks; 1 is a guess). The enemy really swells: `enemyScale` = 1 + 6% per Air (both screens; the hit size follows). Each Air
  pushes his hits 8% farther: `dealt` multiplies the hit's knock by 1 + 0.08 x the Air it had BEFORE this hit. Standing still for 1 s lets out 1 Air, then
  1 per 0.3 s; each hit the enemy lands on him lets out 1. A vent keeps the old lapse time (the Air never lasts longer for being let out). A label BLOAT
  shows over the enemy from 7 Air. Pips: `air` needs a look (see "Shared changes").
- Q **Air Hose** (`airHose.ts`, 'air hose'): SHOT, cd 3.5, `aim: 'line'`. 0.3 s wind-up, 8 m, 22 m/s, radius 0.35: 45, 1 m push (knock 7). A pink balloon pumped up at
  the nozzle flies as the bolt, emptying, with a stream of puffs and bubbles; PFFT on a hit. Telegraph: one line, `boltWidth(0.35)`, impact at the launch.
- W **Helium Bomb** (`heliumBomb.ts`, 'helium bomb'): ZONE, 9 m, cd 9. A foil balloon floats to the spot (0.4 s), hangs 2.6 m up and swells; pops at 1.0 s: 40 to
  every enemy within 2.5 m (live positions), pushed out from the spot (knock 5). Circle telegraph, 1.0 s (0.88 s needed to leave with a 0.25 s reaction). Scraps, ring, POP.
- E **Hot Air** (`hotAir.ts`, 'hot air'): SELF, cd 10, aim range 9. 0.4 s wind-up (three big balloons swell over him; BLOAT), then the air lets go: anyone within 2.5 m of where he
  stood is pushed 3 m (knock 21, no damage); he floats 6 m AWAY from the aimed spot in 0.7 s (`ctx.moveCaster`), lifted a little, and lands. A foil ring shows the landing
  from 0.2 s. Pointing at the danger backs him off it.
- R **Pop!** (`popPin.ts`, 'pop!'): TGT, 9 m, cd 22. 0.6 s wind-up with a mark on the enemy (red circle and a closing ring, live); the pin is thrown at 0.15 s and lands at 0.6 s.
  At the landing: no sight, or more than 11 m, and it fizzles. Otherwise one `projectile` hit: 50 + 20 per Air (added in the trait's `dealt`) and a fixed 3 m shove (knock 21, NOT
  scaled by Air); all the Air goes. The pop is a snap sized by the Air that was in it (scraps 10 to 30), one impact frame, POP!.

### Where each rule runs (the two screens)
- `dealt` (where the hit is decided: the victim's screen online) adds the Air, scales the knock, and resolves Pop!'s damage and shove. `addStacks` there tells the
  enemy's own client through `stacksChanged`.
- Letting Air out is decided where the Air lives (the victim's screen), in `victimTick`: the enemy's position is tracked in `mem` (`t.still` is Puff's own). The hits
  on Puff are seen by his own client (`taken`), which cannot touch the enemy's stacks (his side's host has no `stacksChanged`), so it counts them in `show('vent', n)` (no
  look, no pips). That value arrives on the deciding screen through `setOwn` (online) or sits on the same runtime (offline), and `victimTick` vents as many Air as the count
  grew. No double vent: `ownChanged` is not used.
- `enemyScale` reads `stacks('air')` on both screens and also writes `airSeen` (a WeakMap keyed by his figure) for the pop's size.

### CPU (`aiHold`)
R is held until the enemy has 4 Air (the "under 25% HP" half cannot be read: a trait has no view of the enemy's HP). E is held unless the enemy is within 3.5 m (it floats him away from
the enemy, which the CPU aims at). Q and W are cast whenever ready and in reach.

### Shared changes needed
- `STACK_LOOK` in `src/traits/fx.ts`: `air: { color: '#ff8fb8', shape: 'balloon' }`, and a `'balloon'` shape in `token()`: a sphere scaled (1, 1.2, 1) in the colour, a small knot
  (a cone) under it, a dark outline, and a pale `#fff1a8` highlight dot at the upper left. The type of `shape` (here and in `PipLook`) needs `'balloon'`.
- Register: `airHoseModule`, `heliumBombModule`, `hotAirModule`, `popPinModule`; kit `balloonKit`; trait `balloonTrait` (hero name 'Professor Puff').
- `duel.ts` `peerStacks` gives the stacks it receives 4 s (`setStacks` default), not Air's 6 s, so on Puff's own screen online the enemy shrinks 2 s early. Pass the seconds with the count, or let Air lapse only on the deciding screen.
- Optional: a `TraitView` read of the enemy's HP fraction, for the CPU's second Pop! condition.
