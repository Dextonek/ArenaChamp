# The Raid's fight models

The user, 2026-11-19: "lets make more models for the raid too" (after the Climb's beasts, docs/tower/beasts/README.md). The bosses were
already models; the creatures of their stages and the objects of their fights were still drawn in code. Now each is a model built by
script with the bosses' toolkit (`blender/raid/<key>.py`, built and rendered beside Sefu by `blender/raid/run.py`, exported to
`public/models/raid/<key>.glb`, its sheet `<key>_sheet.jpg` here).

| Key | What | Fight | In the game |
|---|---|---|---|
| `hourstone` | The Hour Stone: a marble hour pillar, a gold XII, a turning crown-band of rays, one eye that beams | The Sun Warden's stage (and the Hall's) | `src/raid/adds/hourStone.ts`, a posed add |
| `sunstone` | A broken fluted column drum of the Sun Court | Pillar Fall (stands 8 s as cover) | `FallingStone` (src/raid/fx.ts) |
| `sunshard` | A shard of the fallen sun, a gold crystal | Gathering Noon: lying, and carried over a hero's head | sunWarden.ts |
| `coalheart` | A molten heart in a cage of slag shards over a cone of cooled lava | Ash and Ember's stage | `src/raid/adds/coalHeart.ts`, a posed add |
| `cinder` | A basalt boulder with lava cracks | Ash's Cinder Rock, the Twin Forge's rocks | `FallingStone(..., 'cinder')` |
| `crustplate` | A broken slab of the Heart's bronze crust | Shade the heart (raised as cover) | heart.ts |
| `castshade` | The Cast shade: a hunched shadow with torn violet wings and one gold eye | The Eclipse Wyrm's stage | `src/raid/adds/castShade.ts`, a posed add |

- **The adds** are posed models through the Climb's beasts' look (`beastLook`, `BeastDef.url`): the code look stands in until the file
  lands, the hit flash follows the palette, each part's plain pieces are merged into one mesh to keep the draw calls down.
- **The objects** are still models (`src/raid/models.ts`: `preloadProps` as a fight's kit is made, `propClone`); until a file lands the
  object is drawn as it was in code.
- **Checked**: the adds in the game's own code beside Sefu (`pipeline/tools/beast-sheet.js` with `window._beast` and `window._codeLook`);
  every rule check still passes (`_raidCheck` 234 rows, `_raidAsh` 77, `_raidHeart` 246, `_raidTwin` 143, `_raidWyrm` 50,
  `_raidUpgrades` 40); each in its fight from the game page, `fight-*.jpg` (`pipeline/tools/raid-models-shots.py`). The marble of the
  sun-stone and the Hour Stone was darkened after the first fight pictures: under the Sun Court's light it bloomed white.
