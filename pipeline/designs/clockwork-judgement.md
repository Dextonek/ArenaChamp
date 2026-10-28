# Clockwork Judgement

- **Label:** `clockwork judgement` · **File:** `src/spells/targeted/clockworkJudgement.ts` · **Module:** `clockworkJudgementModule`
- **Targeting:** `ground`, `radius: 5.5`
- **Palette (value ladder core → hot → body → accent → dark):** `#fff1d0` → `#ffc76a` → brass `#b8862e` → steam cyan `#7fe0e0` → dark iron `#1a1410`
- **The shape that makes it ours:** a **giant brass clock face** assembles on the ground (Roman numerals, filigree hands, interlocking gears around the rim, drawn on canvas + real gear meshes), the hands sweep to midnight, and at twelve the gears stand up and crush inward.
- **Recipes:** `h-lelu-symmetry-magic-circle` (radial symmetry ornament), `c-unity-summon-circle` (drawn circle first), `b-ffxiv-titan-weight-of-the-land` (heavy slam, big flat plates)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.8 s)
- 0-0.8: darken 0.6. Gears (flat extruded meshes, brass, dark teeth outlines) roll in along the rim and lock together with small steam puffs (pale cyan, soft, normal blend). The clock face draws in (canvas: numerals, minute ticks, black outline).
- 0.8-2.0: the two hands sweep fast to 11:59 with a tick-tock stepped motion (12 fps steps); each tick pops a tiny cyan glint and the gears turn one tooth. Enemies inside take 2 small ticks (damage 6).
- 2.0-2.2: the hands hit twelve; dead beat; a cold cyan glint on the XII.
- D = 2.25: the rim gears tilt up into vertical walls and slam inward; impact frames (brass), steam bursts out between the teeth, gold star with tiny core, big flat iron plates crack the face. `ctx.hit(e, { damage: 55, knock: 3, from: center })`.
- 2.25-4.8: gears fall flat and spin down, the face fades by breaking into numerals that fall away, steam drifts and clears.

## Exaggerate
A clock you can read from the gameplay camera; the stepped tick-tock rhythm; gears standing up as walls.
