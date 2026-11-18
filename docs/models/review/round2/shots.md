# 7. Where shots leave (a proposal for the engine; nothing changed)

Every bolt, arrow, stone and net starts at a fixed 1.1 m over the floor (`BOLT_HEIGHT`, `src/effects/projectile.ts`: `init` sets
`p.pos.set(from.x, BOLT_HEIGHT, from.z)`, whatever height `from` has) and flies level. Only the drawing uses that height: what a bolt hits
is found in x and z alone (nothing in `projectile.ts` reads the bolt's y), so a change here cannot change a fight.

What it means on the Climb, the hand at the moment of the shot against 1.1 m (the units' hands measured in the game with
`pipeline/tools/shot-origin.js`; its side pictures did not catch the bolt clearly, so the numbers stand alone):

| Who | Size | The hand that shoots | Bolt starts |
|---|---|---|---|
| War bowman (crossbow) | x1.2 | 1.88 m (both hands, measured in the game on floor 41 at the shot) | 1.1 m: out of the belly |
| Slinger (overhand) | about x1.3 | 1.76 m (the throwing hand, floor 21 at the shot); the net caster about 2.0 m | 1.1 m: out of the hip |
| The Prism Mother, the Lamp Warden, the Crow King (ranged rulers) | x2.4 to x2.6 | 3.1 to 3.5 m (right hand at rest), staff head 4.4 to 4.7 m | 1.1 m: out of the knees |
| A hero (for comparison) | x1 | about 1.2 to 1.4 m | 1.1 m: fine |

**The smallest change (proposed, not made; the file is shared):** a bolt may start higher and glide down to 1.1 m over its first few
metres, so it leaves the hand and still arrives where it does now.

1. `src/effects/projectile.ts`: an optional start height on what `fire` takes (`height?: number`, beside `from`); `init` sets
   `p.pos.y = opts.height ?? BOLT_HEIGHT` and keeps `p.lift = p.pos.y - BOLT_HEIGHT`; `step` after moving sets
   `p.pos.y = BOLT_HEIGHT + p.lift * Math.max(0, 1 - travelled / 4)` (4 m to come down). About six lines; nothing else reads `lift`.
2. `src/effects/summon.ts` `shoot`: pass `height: u.figure.shotY` (a unit's look's hand at the release, times its size).
3. `src/effects/parts/minion.ts` (`MinionRig`) gets `shotY?`, which `modelLook` in `src/tower/world/foeModels.ts` sets from the hand
   at the release (the model review's sheets already measure it): the bowman 1.7 m, the slinger and net caster 2.0 m.
4. The rulers' bolts: where they are fired is to be confirmed (most likely the duel's own attack, `src/duel.ts`, not mine to edit);
   the same `height`, from the figure's hand times the ruler's size, would go there.

Checks after: the four perf prints (they must not move: y is drawn only), and a look at a bowman's and the Crow King's shot from the
game's camera.
