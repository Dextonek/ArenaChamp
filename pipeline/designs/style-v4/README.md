# One hero style (v4): directions to pick from

**Status (2026-11-10): waiting on the user to pick a direction (six shown in two rounds).** Nothing in the game has changed.

The user: "as you can see heroes have different style, let's make one better". The 39 heroes come from three
generations: A, the 12 oldest (`hero_figures.py`: slim, small heads, plain robes: Lyra, Vitriol, Nyx, Fenna, Marin,
Mortis, Ada, Sirix, Cantor, Opaline, Shiori, Tempo); B, 8 remade (`moba_figures.py`, big heads and eyes); C, the 19
newest (the restyle). Asked which should become the one style, the user chose **a new style**, built with **new
stand-alone builders on this computer** (the old ones need a helper folder that is only on the first computer), with
**Lyra as the sample**.

The style itself was not described, so before modelling a full Lyra three rough blockouts were built: flat colours,
simple forms, no rig. Each is a direction to pick, mix or draw over.

![The three directions](lyra_directions.jpg)

![Beside today's heroes](lyra_beside_today.jpg)

| # | Direction | Proportions | Idea |
|---|---|---|---|
| 1 | Lacquer and gold | 6 heads, 1.75 m | The weapon look of `docs/ART_BIBLE.md` section 1 on a figure: dark lacquer body, gold structure, one cream face (the skirt panel), one glow (the chest gem and the bowstring). Calm, statue-like, a porcelain face with narrow eyes. |
| 2 | Heroic | 7 heads, 1.82 m | The anime finisher look of the user's reference videos: long legs, a layered asymmetric costume (short skirt, coat tail, a cape off one shoulder, thigh boots), a knee-length ponytail, big eyes on a small face. |
| 3 | Chibi | 3.5 heads, 1.5 m | Groups B and C pushed to one rule: a big head and eyes, one bell of a cloak with stars sewn on, big hands, boots and props. Reads best from the game camera. |

## Second round: unique designs

The user's answer to the first three: "let's try some unique design". Three bolder directions, each a way of making a
whole figure rather than a costume (`blender/heroes/style_blockout2.py`):

![Three unique directions](lyra_unique.jpg)

| # | Direction | Idea | What it means for the game |
|---|---|---|---|
| 4 | Figurine | A jointed lacquer puppet, a precious game piece ("Arena of Kits"): rigid lacquer segments, gold ball joints, a porcelain mask face with painted eyes, a skirt of rigid petals, hair in rigid segments with gold rings. 4.6 heads. | Nothing bends, so nothing stretches or clips: every part follows one bone. Works for every body type (a heavy smith is a heavy puppet). |
| 5 | Spirit | A masked spirit: one tall cloak with no legs, a hood with a floating porcelain mask and glowing eyes, hands floating free in gold cuffs, a long ribbon. 5.4 heads. | The silhouette is the character; arms and legs are hidden, so their motion barely shows. Heavy fighters and armoured heroes lose their bodies. |
| 6 | Origami | Folded paper and gold leaf: every surface a flat fold, a paper mantle like a crane's wings, gold along the creases, diamond eyes. 5.4 heads. | Very light models (under 1,000 faces here). Hard, drawn shapes as the art bible asks; faces are the hard part. |

All six keep Lyra's idea: night violet, a gold crescent bow across the back with a glowing string, a constellation
halo. The bow stays on her back for now (today she holds nothing; a bow in the hand changes her stance, carry and aim).

## Files

- `blender/heroes/figkit.py`: the stand-alone figure kit (plain bpy and bmesh): materials, ellipsoids, tubes, lofts,
  rings, stars, one mesh per material.
- `blender/heroes/style_blockout.py`: the three Lyra blockouts and the proportions table (`STYLES`). Run:
  `blender --background --factory-startup --python blender/heroes/style_blockout.py -- pipeline/designs/style-v4`
  (writes `lyra_<direction>.glb`; they are not committed, 10 s to rebuild).
- The pictures were taken in the game's own preview light (`HeroPreview`), the blockouts loaded beside it at the
  heroes' 1.3x.

## What a finished model must meet (the game reads these)

- **Rig:** reuse an existing armature (import a current hero's GLB, keep the rig, move the joints): the game's layered
  motion turns bones about fixed axes. Bone names, lower-cased without punctuation, must match `NAMES` in
  `src/effects/weapons/hero.ts`; optional `sway_*` chains.
- **Rest pose:** arms hanging 10-15° out (not a T-pose), legs straight, feet at the origin, the right hand on -x
  (Brannoc, Oblivion and Shiori came out mirrored).
- **Held items:** rigid to the hand bone (weight 0.9 or more), reaching more than 0.16 m from the wrist.
- **Skinning:** a part's main bone decides the body outline (`Hero.body`) and the robe value: skirts to pelvis and thighs.
- **Export:** as the patch scripts do (meshopt, the active vertex colour), emissive at most 1, 300-600 KB.
- **Roll-out:** a new file (`astral_v4.glb`) shown in the preview first; only after approval `MODELS` and `HERO_BODIES`
  in `src/heroes.ts`, the portrait in `src/kits/astral.ts`, the catalog page, News.

## After the pick

One finished, rigged Lyra in the chosen direction, shown beside the line-up; then the rest in batches. A new style
means all 39 are rebuilt. On hold until then: the five model fixes offered earlier (Vesper's and Zambini's capes,
Cantor's lyre, Opaline's wand, Bo's forearm).
