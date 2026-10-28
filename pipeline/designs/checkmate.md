# Checkmate

- **Label:** `checkmate` · **File:** `src/spells/targeted/checkmate.ts` · **Module:** `checkmateModule`
- **Targeting:** `enemy`
- **Palette (value ladder core → hot → body → accent → dark):** ivory `#f4efe4` → marble grey `#b8b4ac` → ebony `#1a1818` → accent red `#e0302a` → board dark `#0a0a0a`
- **The shape that makes it ours:** a **chessboard** unrolls under the target (8x8 marble tiles), giant **black chess pieces** (rook, bishop, knight, queen: lathe / extruded silhouettes, polished ebony with an ivory rim light) slide in along their legal moves, and the **queen** delivers checkmate; the target's tile cracks and the board flips away.
- **Recipes:** `a-ow-doomfist-meteor-strike` (landing marked on the ground), `g-castorice-dash-crescent-spike` (sharp dash strikes), `i-toon-spiked-scribble-ring-pop` (toon ring pop)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.6 s)
- 0-0.7: darken 0.6. The board flips in tile by tile from the target outward (tiles rotate up from edge-on).
- 0.7-1.9: pieces appear at board edges (rise from the tiles) and slide along legal moves to surround the target: rook along a file, bishop on a diagonal, knight in an L (hop), each move ending with a small tap ring and a red check glint. Small hits (damage 6) per arriving piece.
- 1.9-2.15: the queen rises at the far corner; a thin red line traces her diagonal to the target; dead beat.
- D = 2.2: the queen slides the whole diagonal in 0.12 s and strikes: impact frames (red/black, short), the target's tile cracks into shards, a toon ring pop. `ctx.hit(e, { damage: 60, knock: 6 })`.
- 2.2-4.6: the pieces topple like tipped kings and sink; the board tiles flip away in a wave and fade.

## Exaggerate
Readable legal chess moves; the queen's instant diagonal slide; the board flipping away.
