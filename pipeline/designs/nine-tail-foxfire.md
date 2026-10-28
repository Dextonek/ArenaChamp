# Nine-Tail Foxfire

- **Label:** `nine tail foxfire` · **File:** `src/spells/targeted/nineTailFoxfire.ts` · **Module:** `nineTailFoxfireModule`
- **Targeting:** `enemies`, `maxTargets: 9`
- **Look:** `docs/ART_BIBLE.md` §2 row **Fire / phoenix (pink accent leads)**. The shape that makes it ours: **nine fox tails** drawn as one canvas silhouette fanned out behind the caster (hard edges, black outline, orange to pink tips), each tail tip lighting a **foxfire wisp** (a teardrop flame sprite) that then hunts one enemy.
- **Recipes:** `c-jangafx-seeking-arc-fireball` (wisps curve in seeking arcs, not straight lines), `f-html-meteor-volley` (many small hits staggered in a readable order), `d-wolf-4-coral-flame-slash-sphere` (pink-coral flame palette and four-point sparkles).

## Timeline (~4.2 s)
- 0-0.6: darken 0.6 tint `#3a0d0a`. The nine tails fan open behind the caster (from closed to a 200 degree fan, overshoot), sway gently.
- 0.6-1.2: a wisp ignites at each tail tip, one after another (0.06 s apart): a teardrop flame sprite (hot core `#fff4d6`, body `#ff6a1f`, pink `#ff4f8b` edge, black outline) with a short ember trail.
- 1.2-2.4: wisps leave in order and fly curved seeking arcs (bezier with a sideways bulge) to their targets (cycle targets if fewer than 9). Each impact: a small toon `CrescentArc` flame pop + `StarBurst` (additive false), `ctx.hit(e, { damage: 9, knock: 1 })`.
- D = 2.5: the tails flick (all snap closed) and every landed wisp bursts again at once: `impactFrameAt(t, D, [1, 2])`, pink impact colour, `ctx.hit(e, { damage: 25, knock: 4 })` on all targets.
- 2.5-4.2: tails burn away from the tips inward (erosion), embers drift up, small black `SmokeBall`s at each target. Clean by ~3.8 s.

## Layers
darken, fox-tail canvas silhouette (normal, hard alpha), wisp sprites (normal body + small additive core), ember trails (`Emitter` additive), pops (`CrescentArc`, `StarBurst`), black smoke (`SmokeBall`), impact frame.

## Hits and telegraphs
Small `circle` (1.3) under each target from 1.2 until D.

## Exaggerate
Nine tails filling the frame behind the caster; a readable one-by-one volley; the tail flick that detonates them all.
