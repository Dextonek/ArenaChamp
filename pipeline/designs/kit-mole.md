---
title: Mole kit, Mabel
tags: [design, heroes, kits, mole]
updated: 2026-11-04
---

# Mole kit: Mabel, the mole (melee assassin)

## v5 (2026-11-04)
Design source: `new-heroes-kits.md`, section "19. Mabel, the mole". 640 HP, 4.3 m/s, basic attack 2.2 m, 11 per 0.9 s (look 'claw').
Accent `#8a6a4a`, foil `#ffcf5a`. Question: where do I dig, and where do I come up? Weakness: her mound shows where she is, and she cannot cast
underground. Second decision: underground is safe, but she can only come up once. Palette `MOLE` / `MOLE_CSS` in `src/effects/parts/mole.ts`.
Model: not set (registered by the lead). A cheerful miner: dirt, clods, a little lamp glow from her helmet, a tiny pickaxe tap.

- **Passive Dig Site** (`src/traits/mole.ts`): her holes (`moleHoles`, a WeakMap list per figure, written by the effects on both screens when a hole
  opens, drawn by `Trait.marks` with a `pitLook` per hole) last 8 s, 3 at most (a fourth closes the oldest), radius 1.5 m. Falling in is
  `victimTick` (the victim's screen): rooted 0.8 s, then slowed. Once per hole visit (`in` flag; it resets when the enemy is more than 0.4 m
  outside the rim). She walks across hers (the rule only looks at the enemy). Only a walker falls: a hole that opens under a hero gives the Dig
  telegraph (0.7 s) first, and then the same rule, so a hero still standing in it at the opening falls.
- Q **Claw** (`moleClaw.ts`, 'mole claw'): SELF, 2.5 m, cd 3. A 0.4 s wind-up, then a 120 degree cone: 45. Three gold strokes sweep over the
  ground, clods fan out. Telegraph: the cone. (The cone angle is mine: the table gives only the 2.5 m reach.)
- W **Dig** (`moleDig.ts`, 'mole dig'): GROUND, 6 m, cd 7. A tiny pickaxe taps three times at the spot (cracks run out), at 0.7 s the ground
  gives way and the hole opens. Telegraph: the 1.5 m circle (0.25 + 1.5/4 = 0.63 s of reaction in 0.7 s).
- E **Tunnel** (`moleTunnel.ts`, 'mole tunnel'): GROUND, `dash: true`, cd 10. A 0.3 s dive (a pit opens under her), then 1.2 s underground at +40%
  (4.3 x 1.4 m/s, so 7.2 m at most; the aim distance is clamped to 2 to 7.2 m and the time underground is always 1.2 s), `ctx.moveCaster` with
  the engine's ease-out, so she is fastest first and slows toward the exit: the cue to step off. The mound (soil cone, dark outline, gold ring on
  the ground, a lamp glowing on top, a furrow behind, clods kicked sideways) is drawn by the effect on both screens from `sentFrom` and the aim.
  Pop-up at 1.5 s: 40 and a 0.5 s knock-up within 1.5 m of the exit on live positions. Telegraph: the exit circle from 0.3 s.
- R **Sinkhole** (`sinkhole.ts`, 'sinkhole'): ENEMY, 9 m (sight at the cast), cd 24. A 4 m circle at their spot, 1.3 s warning (0.25 + 4/4 = 1.25 s
  of reaction, as designed): she taps her pickaxe, tremor rings and cracks run to the rim, the floor darkens. At 1.3 s the pit drops (one short
  impact frame): 90 and a 1 s root to everyone inside on live positions. The pit crumbles shut about a second later. It is not one of her holes
  (it does not take part in Dig Site).

### Underground: what was built
`Trait.figureHidden` reads `own('down')`, which the trait shows from `tick` (her own client) for the 1.2 s after the dive; `show` carries it to the
other screen. In the same window `tick` applies `sealed` to her (`t.status(t.self()).apply('sealed', ...)`). `sealed` (status.ts) makes every
hit on her `blocked` where hits on her are decided (her own client) and counts as `stunned`: she cannot cast or attack, and cannot walk. It does
not stop `moveFigure`'s slide (the arena steps a dash whatever the status), which is how she moves. `canCast` also refuses spells for the window.
Side effect of the engine's rules: when a stun ends the figure is immune to stuns for 0.5 s, so she has that after popping up.

### Number changed
Falling in: -15% speed for 2 s is not buildable (the `slow` status is a fixed -40% and the buffs cannot be negative). Built as `slow` for 0.75 s after
the 0.8 s root, which costs the same walking time (0.15 x 2 s = 0.4 x 0.75 s). Constant `FALL_SLOW`. A shared change that adds a slow-by-amount
would let it be exact.

### The CPU (`aiHold`)
Q: usual (in reach). W: only with the enemy within 6 m and no hole within 2 m of them. E (flagged `dash`): only with the enemy 3 to 9 m away. R: only
with the enemy within 9 m. `aiGoal`: none.
