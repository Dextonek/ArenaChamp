# Jellyfish Bloom

- **Label:** `jellyfish bloom` · **File:** `src/spells/targeted/jellyfishBloom.ts` · **Module:** `jellyfishBloomModule`
- **Targeting:** `enemies`, `maxTargets: 6`
- **Palette (value ladder core → hot → body → accent → dark):** white `#f4ffff` → glow cyan `#7ff8ff` → violet `#a07aff` → pink accent `#ff7ad8` → deep sea `#04081a`
- **The shape that makes it ours:** a swarm of **bioluminescent jellyfish** (translucent bells with a fresnel rim, glowing inner pattern, long trailing tentacles that sway) drifts up from the caster and floats to the enemies, then they all **pulse and sting** in a chain of soft lightning.
- **Recipes:** `e-yougelly-starfall-comets` (slow drifting projectiles with trails), `j-abitofgamedev-refraction-bubble` (fresnel shell, translucent), `a-smite-zeus-chain-lightning` (chain between targets)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~5 s)
- 0-0.8: darken 0.8 to a deep-sea tint; floating plankton motes everywhere (tiny, sparse). 12 jellyfish rise from around the caster, bells pulsing (contract/expand), tentacles trailing (ribbon strips with sine sway).
- 0.8-2.4: they drift in slow pulses (move only on the contraction) toward the targets, 2 per target.
- 2.4-2.7: they hover over the enemies, tentacles dangling onto them; the glow builds; dead beat.
- D = 2.75: all pulse at once: a chain of soft cyan-violet lightning links the jellyfish (thin `LightningArc`, low brightness, reroll every 3 frames), impact frames (violet, short), small pink sting stars on each enemy. `ctx.hit(e, { damage: 35, knock: 1 })`.
- 2.75-5: the jellyfish drift upward and dim out one by one; motes linger.

## Exaggerate
Pulse-and-glide motion (not linear flight); the whole swarm stinging in one beat.
