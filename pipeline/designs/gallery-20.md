---
title: The gallery, twenty tool spells
tags: [design, vfx, tool, spells]
updated: 2026-11-19
status: designed; six helpers build them in groups
---

# The gallery: twenty tool spells

The user, shown the Scarlet Sheath's World Sever on the tool page (2026-11-19): "lets make more like this effects do like 20 more
spells in like different action and different style but this quality". So: twenty spells for the VFX TOOL page only (never the
game), each with an action no other of the twenty has, and each in its own art style, none a style the tool already has (see
"Taken" below).

## The quality bar (what "this quality" means)

The reference is the Scarlet Sheath's four, above all **Sekai-giri** (`src/heroes/sheath/spells/sekaiGiri.ts`, its parts in
`src/heroes/sheath/partsBig.ts`) and **Senbon** (`spells/senbon.ts`); pictures `docs/spells/kagen/tool/`. What they do that a
plain effect does not:

1. **A timeline with a held breath.** Anticipation that builds (a line drawn, a ring painted, blades gathering), a **dead beat**
   just before the hit (everything holds or thins), one sharp release, an aftermath that settles and clears (by about 2.5-3.5 s).
2. **One signature shape** that says the style at a glance (the burning almond tear; katanas point-down; the brush-stroke ring).
3. **A small palette with roles:** a dark layer, one accent, a pale foil beside every dark colour, a hot core used sparingly.
   Never a white-out blob, never the game's enemy red as the main colour, nothing brighter than the floor can bear.
4. **Readable from a steep camera** (tool camera and the game's): shapes 0.15 m thick or more, the moment that matters drawn best.
5. **Material and motion with intent:** things are brushed on, fall with weight, stick, crack, drift, seal; debris and flecks
   from the event itself, not generic sparks. Screen effects (desaturate, darken, one impact frame) only for the big ones.
6. **The hit shape is the drawn shape:** built on the spell blocks, so the danger zone is exactly what hits.

## How they are built

- On the spell blocks, as the Sheath's are: `spell()` from `src/heroes/framework/spell.ts`, rules from
  `src/heroes/framework/blocks.ts` (bolt, circle, lane, target, zone; `move`; hooks `on.frame` for extra waves or hits inside the
  cast's own danger zone), a `Look` class told the moments. `category: 'targeted'`.
- Files: `src/spells/targeted/gallery/<camelName>.ts`, shared pieces of a group in `gallery/<group>Parts.ts`. Each group lists its
  modules in `gallery/g<N>.ts` (already wired: `gallery/index.ts` -> `src/spells/targeted/index.ts`).
- Numbers (damage, ranges) are a tool's: plausible (Q-sized 30-70, big ones 100-160), no balance needed. Warnings obey the rule
  `0.25 + radius / 4` s so they read as fair.
- No three.js object at a file's top level, no `Math.random` (a hash of an index), no allocation per frame.
- Pictures: a contact sheet per spell from the tool page (`pipeline/tools/contact-sheet.js`, `_review`), headless with
  `pipeline/tools/page-shots.py`, as `pipeline/tools/sheath-tool-shots.js` does; final sheets to `docs/spells/gallery/<slug>.jpg`.

## The twenty

| # | Label | Action (the block) | Style | The signature moment |
|---:|---|---|---|---|
| 1 | kintsugi shatter | sure hit on one enemy (`target`), delayed | Raku pottery: black glaze, crackle, molten gold | the enemy's outline crazes with gold seams, a dead beat, it bursts into glazed shards that are pulled back and mended in gold |
| 2 | quetzal descent | leap: the caster flies to a spot and slams (`circle` + `move` at play) | Aztec: jade, turquoise, gold, feathered serpent, stepped fret | a feathered serpent arcs over with him, its feathers fan into a stepped-fret ring as he lands |
| 3 | mosaic nova | a ring that grows outward from the caster (`zone` round him, hit as the ring passes in `on.frame`) | Byzantine mosaic: gold tesserae, lapis, red porphyry | gold tesserae lift off the floor round him and race outward as a widening ring, a crown of tiles that crashes down where it ends |
| 4 | celtic knot snare | trap: a sigil armed after a delay, then binds (`circle`, root status) | Celtic interlace: bronze, moss green, silver knotwork | a knot is drawn without lifting the pen, then its bands lift and tighten round whoever stands on it |
| 5 | mandala unbinding | big ground zone (`circle`, long build) | Tibetan sand mandala: saffron, lapis, vermilion, white sand | the mandala is laid ring by ring in coloured sand, a dead beat, then swept away in one spiral of wind (the hit) |
| 6 | geode heart | bolt that grows a crystal cluster where it stops (`bolt` + `on.stop`) | Amethyst geode: grey rind, violet crystal, quartz white | a grey stone flies, cracks open on impact, violet crystals spear outward from the hollow |
| 7 | molten glass bloom | cone in front (`zone` cone) | Glassblowing: orange-hot glass cooling to clear blue-green, soot | a gather of molten glass blown into a bloom of petals that cool and shatter as clear shards |
| 8 | carnival masquerade | blink behind the target and strike (`target` + `move`) | Venetian carnival: lacquered masks, gold leaf, teal silk ribbons | the caster dissolves into a fan of masks, reappears behind with a ribbon slash, masks clatter down |
| 9 | charcoal tempest | sweeping beam held for 1.5 s (`zone` strip, hits in `on.frame`) | Charcoal sketch: paper white, graphite, smudge, hatching | a hand-drawn beam of hatched strokes sweeps across, smudges left behind like rubbed charcoal |
| 10 | watercolour vortex | a pull: enemies in a circle are dragged to its centre, then it blooms (`circle` with `pull`) | Watercolour: wet pigment blooms, cauliflower edges, paper grain | wet pigment swirls into a whirlpool on the floor, drags them in, then blooms outward into soft-edged colour that dries to rings |
| 11 | art deco arc | chain hit, hopping between up to 4 enemies (`target`, chained hits in `on.frame`) | Art Deco: black lacquer, gold zigzag, sunburst fans, chrome | a geometric gold bolt hops target to target, a sunburst fan opening at each |
| 12 | coral bastion | a wall raised along a line, crumbling after (`lane` with no move, slow front) | Coral reef: pink-orange branching coral, sea-foam, little fish | a reef grows along the line branch by branch, fish scatter, it bleaches and crumbles to sand |
| 13 | arabesque fan | a fan of five bolts (`bolt` x5: one cast, extra bolts from `on.frame` or five spells' worth in one look) | Persian girih tiles: turquoise, cobalt, white glaze, gold lines | five eight-pointed tile stars spin out in a fan, each shattering into glazed shards where it stops |
| 14 | runestone fall | meteor from the sky (`circle`, a long fall) | Norse runestone: grey granite, carved runes in frost blue, iron | a carved standing stone falls from the clouds, runes kindling one by one, lands upright and the runes burst |
| 15 | whiplash fissure | a crack that travels along the ground (`lane`, a slow front) | Art Nouveau: whiplash curves, sage green, gold, cream | a whiplash vine curve races along the floor, and the ground opens along it in gilded, curling lips |
| 16 | gargoyle swoop | a summoned stone creature flies down a lane (`lane`, the creature is the front) | Gothic cathedral: weathered stone, lichen, candle gold, lead | a gargoyle tears free of a stone corbel, swoops low along the lane with stone wings, crumbles at the end |
| 17 | crescent return | boomerang: out along a line and back, hitting both ways (`lane` out, a second sweep back in `on.frame`) | Moon silver: indigo night, silver crescent, star dust | a silver crescent thrown flat, spinning, out and back, leaving a curved trail of star dust |
| 18 | venom orchid | mark and detonate: a flower grows on the target, then bursts (`target`, a long delay) | Botanical: magenta orchid, chartreuse pollen, dark leaf veins | an orchid unfurls at the enemy's feet petal by petal, pulses twice, bursts into a pollen cloud |
| 19 | whalebone harpoon | hook: a thrown harpoon that drags the enemy back (`bolt` + pull) | Arctic scrimshaw: ivory, black etched lines, sea-grey rope | a carved harpoon with etched lines flies, the rope pays out, it bites and reels the enemy in, ink waves etched on the ice |
| 20 | solar orrery | orbiting spheres that fly out to the nearest enemies (`circle` round him, hits at the planets' arrival) | Brass orrery: brass rings, enamel planets, star chart | a brass orrery opens round the caster, its rings spin up, the planets leave their orbits one by one and strike |

## Groups (two spells a helper, in two waves; each helper in its own worktree)

Changed after a review (2026-11-19): the first table had three "object drops on a circle", three "pattern drawn on the floor" and a
rain like Senbon. Now every action is different. Two spells a helper, so the first twelve can be shown while the rest are made.

| Wave | Group | Spells |
|---|---|---|
| 1 | g1 | 1 kintsugi shatter, 8 carnival masquerade |
| 1 | g2 | 2 quetzal descent, 14 runestone fall |
| 1 | g3 | 3 mosaic nova, 5 mandala unbinding |
| 1 | g4 | 4 celtic knot snare, 10 watercolour vortex |
| 1 | g5 | 6 geode heart, 19 whalebone harpoon |
| 1 | g6 | 7 molten glass bloom, 9 charcoal tempest |
| 2 | g7 | 11 art deco arc, 20 solar orrery |
| 2 | g8 | 12 coral bastion, 16 gargoyle swoop |
| 2 | g9 | 13 arabesque fan, 17 crescent return |
| 2 | g10 | 15 whiplash fissure, 18 venom orchid |

**A lane that is not a dash:** the runner sweeps a lane only until `windup + (move?.seconds ?? 0) + late`, and its danger zone
ends at `windup`. A lane whose front travels with no caster move (coral bastion, gargoyle swoop, crescent return, whiplash fissure)
sets `late` to its travel time and a `front` function for where the front is; read `src/heroes/framework/spell.ts` (`front`,
`sweep`, `zones`).

## Taken (styles and shapes the tool already has; do not copy)

Ink and brush (Shiori, Final Calligraphy, Brushstroke), stained glass, paper cranes, clockwork gears, tarot, Egyptian sun disk,
jade dragon and Chinese bronze, ukiyo-e great wave, jellyfish, tesla coils, glitch neon, frost crystals, lava calderas, the
Scarlet Sheath's iaido.
