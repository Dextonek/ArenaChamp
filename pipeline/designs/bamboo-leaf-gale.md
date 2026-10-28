# Bamboo Leaf Gale

- **Label:** `bamboo leaf gale` · **File:** `src/spells/targeted/bambooLeafGale.ts` · **Module:** `bambooLeafGaleModule`
- **Targeting:** `enemy`
- **Look:** `docs/ART_BIBLE.md` §2 row **Wind (gold accent)**. The shape that makes it ours: **a wind blade made of bamboo leaves**: hundreds of pointed green-white leaf sprites (hard edged, dark midrib) swirl into one huge horizontal crescent that cuts through the target.
- **Recipes:** `f-swipe-smoke-crescent-slash` (a soft smoke crescent reads as speed), `h-noggi-anime-wind-streaks` (tapered toon wind streaks), `e-yordin-toon-color-cyclone` (toon wind bands: light inner edge, saturated middle, dark outer edge).

## Timeline (~3.8 s)
- 0-0.7: light grade (darken 0.4). Leaves lift off the ground round the caster and spiral up (instanced leaf quads with flutter), toon wind bands circle the caster.
- 0.7-1.1: the spiral tightens and flattens into a horizontal crescent in front of the caster (leaves align along the arc). Dead beat 1.05-1.1.
- 1.1-1.4: the crescent shoots to the target, growing 3x wide, toon streaks trailing.
- D = 1.45: it cuts through: a crisp white slash line across the enemy, a soft grade impact frame (green-white), leaves explode outward. `ctx.hit(e, { damage: 45, knock: 7 })`.
- 1.45-3.8: the crescent continues and dissolves into fluttering leaves; a soft smoke crescent lingers 0.4 s.

## Layers
grade, leaves (instanced, normal, two tones), toon wind bands (`CrescentArc` toon), slash line, smoke crescent (`CrescentArc` soft), leaf burst.

## Hits and telegraphs
`line` from caster to target from 0.7 until D.

## Exaggerate
Leaves forming a blade; the blade growing as it flies.
