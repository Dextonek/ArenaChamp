# Magic kit: The Great Zambini, stage magician (ranged trickster)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "15. The Great Zambini, stage magician". 570 HP, 4.1 m/s, basic attack 6 m, 12 per 1.0 s (look 'spark',
gold). Accent `#b05aff`, foil `#ffe08a`. Question: which hat do I come out of? Weakness: the hats really move, so watching beats him, and area
spells hit all three. Second decision: hide for safety, or stay out for damage. Model `models/heroes/magic_v2.glb` (the lead registers it). Palette
`MAGIC` / `MAGIC_CSS` in `src/effects/parts/magic.ts`. Kit name `The Great Zambini`, title `stage magician`. Words: TA-DA!, BEHOLD!.
- **Passive Ta-da!** (`src/traits/magic.ts`): the first spell after he comes out of a hat (not E, which has no damage) deals +40% (`castMods`
  power 1.4, kept 8 s) and a white rabbit runs at the enemy: 20 HP, 8 damage per 1.2 s, 4.5 m/s, lives 8 s (`rabbitLook`, base colour 0.72 at most),
  made by the effect with `ctx.summon` at the hat (on both screens online; its hits on the hero are decided on the enemy's screen).
- Q **Card Spray** (`cardSpray.ts`, 'card spray'): SHOT, cd 3.5, `aim: 'line'`. 0.3 s wind-up, three real bolts in a 24 degree fan (-12, 0, +12), 8 m,
  22 m/s, radius 0.3: 26 each. Telegraph: three lines, `boltWidth(0.3)` wide, shortened at walls. 6 m at 0.57 s.
- W **Sawn in Half** (`sawnInHalf.ts`, 'sawn in half'): SHOT, cd 10, `aim: 'line'`. 0.3 s wind-up, one bolt, 8 m, 18 m/s, radius 0.35: 60 and slowed 1.5 s
  (in the hit and in `castMods`, which is what reaches a network duel). 6 m at 0.63 s.
- E **The Hat Trick** (`hatTrick.ts`, 'hat trick'): SELF, cd 13. Three hats in a triangle 1.1 m round him; he is hidden (`figureHidden` from `own('down')`) and
  sealed 1.5 s. Three swaps of 0.42 s from 0.15 s, plain half-circle arcs (about 7 m/s at the fastest), each hat hopping. The two that swap and
  his hat come from `shuffleOf(key)`, `key` made on his own client in `afterCast` from the round time and a cast counter and sent with `show('hatKey')`.
  Each hat is a real 'turret' unit, 1 HP, damage 0, pinned to the hat; a hit pops it. Wrong hat: confetti and it goes. Right hat: `act.popped`, the trait's
  `victimTick` tells his own client, whose `peerNote` clears his statuses and stuns him 1 s; the effect moves him to the hat. At 1.5 s he steps out of his hat
  (`ctx.moveCaster` 0.05 s at 1.4 s). Then Ta-da!
- R **The Grand Finale** (`grandFinale.ts`, 'grand finale'): ENEMY click, 9 m, cd 24. He is hidden and sealed 1.2 s. Three hats ring the cast's `point` (3 m),
  from the key. From 0.7 s a sword rises from each; at 1.2 s three real bolts fly toward the centre (16 m/s, 3.6 m, radius 0.3): 30 each, stopped by walls.
  He steps out of one hat. One impact frame. Telegraph: the three sword lines. Hats here are not units.

### The two screens
`magicBooks` (a WeakMap on the caster's figure) holds `key` and the current hat act. The key is written in `afterCast` on his own client and in
`ownChanged` on the other one, so both shuffle the same way without `Math.random`. The effect plays on both screens and writes `act` at `play()`.
`ctx.summon` exists in both the hero's own cast context and the replayed one, so the hat units exist on both screens: on his screen the enemy's replayed casts
hit his hero-side hats (his `tick` sees `act.popped`); on the enemy's screen their own spells hit the opponent-side hats (the effect writes `act.popped`, `victimTick`
sends `noteOwner('popped')`, his `peerNote` ends the act). A hit on a wrong hat is known only on the screen where it happened (the other still draws it until the shuffle ends).
Hats are only hittable when all 3 units could be made (6 a side). Hidden state is `own('down')`, so both screens do not draw his figure.

### Engine limits met
- `sealed` is capped at 1.2 s and the lock at 1.5 s: the Hat Trick renews the seal in `tick` (it totals 1.5 s). A stun after a seal would get no lock time and he would be
  immune, so a popped hat clears his statuses and then stuns him (the nearest thing to the design). It also clears any slow or buff he had.
- A side holds 6 units: 3 hats and the rabbit fit. The hats are ended before the rabbit is made.
- Sealed is applied on his own client only, as Mabel's is, so online the other screen's hits on his hidden figure are not swallowed there.

### CPU (`aiHold`)
E when his HP is under 60% or the enemy is within 4 m; R when the enemy is within 9 m; Q and W by the duel AI's usual reach. A CPU fighting him does not look for the hat:
it hits what its spells reach.
