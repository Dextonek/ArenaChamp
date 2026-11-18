/**
 * Bakes floor 11, The Walking Wood, at the new size (pipeline/designs/tower-50.md: "the five handmade floors grow too") into
 * src/tower/world/floors/woodGrown.ts: its layout made by the Wood's generator (src/tower/world/gen/wood.ts `makeWoodEleven`), its people,
 * quests, packs and law as they were. Its set pieces stay in pieces/floors.ts. Run with node:
 *
 *   node pipeline/tools/gen-wood11.ts        (the first seed that makes a layout)
 *   node pipeline/tools/gen-wood11.ts 3      (from attempt 3 on, after a check threw a layout out)
 *
 * (gen-floors.ts bakes the made floors 12 to 20 and never a handmade one; this file is the Wood's own, so it does not live in floors/gen/,
 * whose list would take it for a made floor.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWoodEleven } from '../../src/tower/world/gen/wood.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'woodGrown.ts');
const from = Number(process.argv[2] || 0);
let g: ReturnType<typeof makeWoodEleven> | null = null;
for (let a = from; !g && a < from + 30; a++) {
  try { g = makeWoodEleven({ attempt: a }); } catch (e) { console.log(`  attempt ${a}: ${(e as Error).message}; the next seed`); }
}
if (!g) throw new Error('floor 11: thirty seeds and no layout');
const body = `// Made by pipeline/tools/gen-wood11.ts: floor 11, The Walking Wood, at the new size, seed ${g.seed}. Made again by that tool; a hand fix is
// kept only until then (pipeline/designs/tower-50.md). Its set pieces are in pieces/floors.ts.
import type { FloorDef } from '../def';
import type { WoodLook } from '../gen/wood';

export const WOOD_11: { seed: number; floor: Omit<FloorDef, 'arena' | 'cover'>; look: WoodLook } = ${JSON.stringify({ seed: g.seed, floor: g.floor, look: g.look }, null, 1)};
`;
writeFileSync(OUT, body);
const f = g.floor;
console.log(`floor 11 (seed ${g.seed}): ${f.name}; places ${Object.values(f.places).map((p) => p.name).join(', ')}; cover ${g.look.pieces.length}; ring ${f.ring}`);
