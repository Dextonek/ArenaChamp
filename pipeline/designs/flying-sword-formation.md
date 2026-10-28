# Flying Sword Formation

- **Label:** `flying sword formation` · **File:** `src/spells/targeted/flyingSwordFormation.ts` · **Module:** `flyingSwordFormationModule`
- **Targeting:** `ground`, `radius: 5`
- **Look:** `docs/ART_BIBLE.md` §2 row **Thunder (swords are objects: dark steel body, gold guard, violet-white edge)**. The shape that makes it ours: **a xianxia sword formation**: 36 flying swords in a slowly turning sky sigil (concentric rings), blades down, that rain onto the area in waves, then one giant sword drops last.
- **Recipes:** `g-castorice-sky-rift-blade-rain` (show the source ~0.3 s early; dark blades with hot edges hang as scars), `b-elden-ring-founding-rain-of-stars` (staggered field of falling projectiles), `c-ue5-triangle-portal` (sky sigil as the source).

## Timeline (~5 s)
- 0-0.8: darken 0.75. A sky sigil draws itself above the area, tilted ~55 degrees toward the caster (art bible). Swords appear on its rings, blade-down.
- 0.8-1.4: the formation turns faster; thin violet arcs jump between swords.
- 1.4-2.6: three waves of 12 swords drop (0.4 s apart), fast streaks with short trails, sticking into the ground at angles (they stay as scars). Enemies within 1 m of a landing: damage 6.
- 2.6-2.9: dead beat; the empty sigil collapses into one giant sword (5 m) pointing down.
- D = 3.0: the giant sword drops into the centre: impact frames, violet ground discharge, all stuck swords flash and shatter at once. `ctx.hit(e, { damage: 50, knock: 6, from: center })`.
- 3.0-5.0: shards fall, the giant sword dissolves from the tip up into motes, scorch.

## Layers
darken, tilted sky sigil, swords (instanced; `createSwordGeometry` from common.ts), trails, arcs, ground scars, giant sword, discharge, shards.

## Hits and telegraphs
`circle` radius 5 from 0.8 until D.

## Exaggerate
36 swords in formation; swords left standing in the ground; the giant last sword.
