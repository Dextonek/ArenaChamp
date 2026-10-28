# Kraken's Grasp

- **Label:** `kraken grasp` · **File:** `src/spells/targeted/krakenGrasp.ts` · **Module:** `krakenGraspModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Palette (value ladder core → hot → body → accent → dark):** foam `#e8fff8` → bioluminescent teal `#5fffe0` → sea `#1a7a80` → suction-cup coral `#ff7a6a` → abyss `#03080c`
- **The shape that makes it ours:** **dark water portals** open under each enemy and **huge black tentacles** (thick tapered tubes with a teal underside, coral suction cups, hard silhouette) burst up, coil around the targets and drag them down.
- **Recipes:** `d-maxmdp-2-grave-hands-portal-aura` (grasping limbs from a portal), `d-kler-1-singularity-accretion-pull` (pull to a centre), `j-flexunit-swirl-portal` (two-noise swirl portal)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.6 s)
- 0-0.6: darken 0.7, a deep teal grade. Dark water swirl portals (two-noise swirl, black centre, teal foam rim) open under each target in order.
- 0.6-1.6: one tentacle per target bursts up (bezier tube, thick at the base, tapering, curling at the tip), splashing foam (white-teal droplets, small); it wraps around the enemy (the tip spirals 1.5 turns around it). Hit per target as it wraps (damage 10, knock 0); `ctx.displace` lifts the enemy 0.8 m.
- 1.6-2.2: squeeze: the coils tighten; the tentacles sway; dead beat at 2.15.
- D = 2.25: all tentacles yank down into their portals at once; impact frames (teal), big foam splash crowns, black ink cloud bursts (small). `ctx.hit(e, { damage: 40, knock: 2 })`; enemies return to the ground.
- 2.25-4.6: portals close with a ripple ring, foam rings spread on the ground and fade.

## Exaggerate
Tentacles bigger than the enemies; the synchronised yank under; foam crowns.
