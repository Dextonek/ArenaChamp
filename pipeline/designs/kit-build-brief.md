---
title: Kit build brief
tags: [design, heroes, kits, workflow]
updated: 2026-11-04
---

# Building one hero of kits v5

For a worker building one hero. Read this, then [kits-v5.md](kits-v5.md) ("The rules every kit follows", "How the counterplay numbers were run" and your
hero's section), then [kit-common.md](kit-common.md). Your hero's table in kits-v5.md decides every number and every word of the counterplay. If a line cannot
be built as written, build the nearest thing and say so in your report. Do not quietly change a number.

## What you own

Only these. Other workers are editing other heroes in this folder at the same time.

- `src/kits/<theme>.ts`: the kit data. Replace the four `spells`: new labels, names, ranges, cooldowns, blurbs, flags, and a new canvas-drawn icon per spell in the kit's palette. Keep the hero's `name`, `title`, `accent`, `foil` and portrait unless told otherwise.
- `src/traits/<theme>.ts`: the rules. Replace the passive, and add what the kit needs.
- `src/spells/targeted/<camelName>.ts`: one new file per new spell, exporting `<camelName>Module` with `category: 'hero: <theme>'`. Grep `src/spells/targeted/` first: a new file name or `label` must not clash with any other. The hero's old spell files stay: the VFX tool still lists them.
- `src/effects/parts/<theme>.ts`: you may add to it. Use its palette and its existing pooled parts first: they are the hero's look. Do not rewrite what is there, because old spells use it.
- `pipeline/designs/kit-<theme>.md`: add a "v5 (2026-11-04)" section at the top with the final numbers.

**Never edit** `traits/index.ts`, `traits/types.ts`, `traits/runtime.ts`, `traits/fx.ts`, `heroes.ts`, `spells/targeted/index.ts`, `duel.ts`, `arena.ts`, `heroMode.ts`, `effects/status.ts`, `effects/projectile.ts`, `effects/summon.ts`. If you need something there, say so in your report. I register your modules and wire shared code.

Do not commit, do not start a server, do not use a browser. Never create a file name containing `: ? * < > |`.

## Copy the shape of these spells

| You need | Read |
|---|---|
| A delayed strike on a fixed spot, with a telegraph | `meteorMark.ts` |
| A targeted spell that needs sight when it lands, with a wind-up | `skyRend.ts` |
| A channel: rooted, can be broken, with a bar | `moonPull.ts` |
| A skillshot | `pinningArrow.ts`, `waveDisc.ts` |
| A recast the effect tells apart by itself | `crosswind.ts` |
| A self shield with a look | `boneArmour.ts` |
| A dash | `featherStep.ts`, `skyward.ts` |
| A summon, and a `MinionLook` | `homunculus.ts`, `raiseDead.ts` |
| Terrain | `coralSpire.ts` |

## The rules of a spell

- **Timing:** Q, W and E land 0.4-0.8 s after the cast unless your table says otherwise, and are clean by about 2 s. R is the biggest, with one short impact frame, under the gameplay camera, no cinematic.
- **Telegraphs:** `telegraphs()` must return the real hit shape. A hit lands only inside one of the cast's telegraphs or as `projectile: true`. A telegraph's `impact` also roots the caster until then, capped at 2.5 s. Longer roots use `t.hold`.
- **Zone hits:** re-check each enemy's live position at the impact moment. Never use a victim list frozen at the cast.
- **Skillshot budget:** it reaches 6 m no sooner than 0.5 s after the cast starts.
- **Look:** read "Look lessons" in kit-common.md. Shapes must read at gameplay distance, with a pale foil and a dark layer. Effects are the point of this project, so make each spell read as this hero and not as a coloured circle. Draw the moment the opponent has to read (the wind-up, the fixed circle, the ring) so a person can see it clearly.
- **Header comment:** say what the spell does, its numbers and its timeline, as the neighbouring files do. Keep `default<Name>()` settings for damage, and a `buildGui`.

## The trait API

`src/traits/types.ts` is the reference. **Where each hook runs matters, because a network duel has two screens:**

| Hook | Runs | Use it for |
|---|---|---|
| `castMods`, `afterCast`, `cooldown`, `recastAct`, `attackMods`, `landed`, `tick`, `canCast` | this hero's own client | Own state, refunds (`landed`), `t.hold`, `t.show` |
| `dealt` | where the hit is decided: online, the victim's screen | Changing a hit, stacks on the enemy, `t.hitEnemy`. `setCooldown` does nothing real there: use `t.noteOwner` with `peerNote` |
| `taken` | the victim's own client | Swallowing or reducing hits on this hero |
| `victimTick` | offline always, online the victim's screen | A rule that moves or hits the enemy: `t.carryEnemy`, `t.hitEnemy` |
| `enemyCast` | both screens | A rule about what the enemy casts |
| `ring`, `marks`, `badge` | both screens, every frame | Reads only `time`, `own` and `mem` written by `ownChanged` |
| `ownChanged` | the other screen | Mirror a `t.show` value into what the effects read |

Spell effects play on both screens, so a WeakMap keyed by the caster's figure is how an effect and a trait share state. Write it from `afterCast` on the own client and from `ownChanged` on the other screen. Messages arrive in order, so a `t.show` made in `afterCast` is there before the cast. Do not use `Math.random` for anything both screens must agree on.

Tools you have: `t.show(name, n)` with `ownLook` for pips on both screens. `t.addStacks` for pips on the enemy. `ring` for a ring at the feet. `RecastSpec.arm` for a recast that opens late, `aiWait` to stop the CPU firing it. `t.hold`, `t.release`, and `channelBroken`, `stillSees`, `ChannelBar` from `src/effects/channel.ts`. `t.clearShield`, `t.hitEnemy`, `t.carryEnemy`, `t.noteOwner`. `ctx.confine`, `ctx.casterStatus`, `ctx.releaseCaster`. Statuses `charm` and `sealed`; the debuff `grounded`.

The `HeroSpell` flags tell the CPU how to use a spell: `cc`, `dash`, `save`, `parry`, `summon`, `aim: 'line'`. Set them. The CPU casts R, E, W, Q in that order when in reach, so mark what must wait.

## Verify and report

Run `npx tsc --noEmit` from `C:\VFXTool`. Your files must be clean. Report other files' errors, but do not fix them.

Report in under 200 words: the module names to register (exact import path and export), anything shared you need changed, the final numbers, and anything you could not build as written and why.
