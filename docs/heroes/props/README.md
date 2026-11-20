# The heroes' spell models

The user, 2026-11-19: "lets make more models for the heroes spells too", then, shown Hank's trees: "Yes, do the rest". What a spell
summons or places was drawn in code from a few primitives; each is a model now, built by script, in the arenas' clean style.

## Two kinds

- **A thing a spell places** (a tree, a door, a table, a sign, a mirror, a pillar, a wall): a still model, `blender/heroes/props/<module>.py`
  (one module may build several keys), built and rendered beside Sefu by
  `blender --background --factory-startup --python blender/heroes/props/run.py -- <key> <module>` (to
  `public/models/heroes/props/<key>.glb`, renders `docs/heroes/props/<key>-*.png`, put on one sheet `<key>_sheet.jpg`). In the game the
  spell's own drawing asks `heroProp(key)` (src/effects/props.ts): a copy once the file has landed, else null and the code shape as before.
  Load the files when the hero's fight begins (as Hank's trait does in its first `marks` frame: `preloadHeroProp`), so its first one is a
  model too. Keep the drawing's size, place and every decal or ring the fight reads.
- **A creature a spell summons** (a sheep, a skeleton, a rabbit, a crane, a wasp, a turret): a posed model like the Climb's beasts
  (docs/tower/beasts/README.md): rigid parts, `src/heroes/<hero>/<key>Model.ts` exporting a `BeastDef` with
  `url: 'models/heroes/props/<key>.glb'` and its pose, and the spell's `look` becomes `beastLook(def, codeLook, { speed, scale })`
  (src/tower/world/beasts/index.ts), the code look standing in until the file lands.

## The look

`blender/arenas/real/STYLE.md`: real proportions idealised, clean turned or boxed forms, smooth shading (`B.smooth = True`), one flat
colour a part, the hero's own palette (its `parts.ts`), a thin gold line where it fits, one small light at most, nothing cartoon
(`docs/ART_BIBLE.md` §1). It belongs to its hero: its people and realm in `docs/lore/LORE.md`. `pine.py` is the example of a placed thing,
`blender/tower/beasts/hound.py` of a creature.

## The check

A placed thing: a duel in an arena with that hero, the spell cast, from the game's camera and a low view
(`pipeline/tools/landmark-shot.js` with the hero set, or a short script of your own); the code look before beside the model after. A
creature: `pipeline/tools/beast-sheet.js` with `window._beast` and `window._codeLook`. `npx tsc --noEmit -p .` passes.
