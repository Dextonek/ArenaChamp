/**
 * Bakes floor 21, The Storm Canyon, at the Climb's new size (pipeline/designs/tower-50.md: five times the ground, the handmade
 * floors grow too): `makeCanyonFloor` (src/tower/world/gen/sands.ts) lays the small floor's places, people, quests and ids out again
 * on a long canyon, and this writes the result to src/tower/world/floors/canyon-made.ts, which floors/canyon.ts reads. Run with node:
 *
 *   node pipeline/tools/gen-canyon.ts        the floor from its seed (21000)
 *   node pipeline/tools/gen-canyon.ts 1      from the next seed (after a check threw the layout out)
 *
 * (`gen-floors.ts` bakes the made floors 22 to 30; it leaves every chapter's first floor alone.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCanyonFloor } from '../../src/tower/world/gen/sands.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'canyon-made.ts');
const from = Number(process.argv[2] || 0);
let g: ReturnType<typeof makeCanyonFloor> | null = null;
for (let a = from; !g && a < from + 30; a++) {
  try { g = makeCanyonFloor(a); } catch (e) { console.log(`  attempt ${a}: ${(e as Error).message}; the next seed`); }
}
if (!g) throw new Error('floor 21: thirty seeds and no layout');
writeFileSync(OUT, `// Made by pipeline/tools/gen-canyon.ts: floor 21, The Storm Canyon, at the new size, seed ${g.seed}. Made again by that tool; a hand fix is
// kept only until then (pipeline/designs/tower-50.md).
import type { GenFloor } from '../gen/types';

export const CANYON_21: Omit<GenFloor, 'pieces'> = ${JSON.stringify(g, null, 1)};
`);
const f = g.floor;
console.log(`floor 21 (seed ${g.seed}): ring ${f.ring}; places ${Object.values(f.places).map((p) => p.name).join(', ')}; cover ${g.look.pieces.length}; storm every ${f.law.kind === 'storm' ? f.law.every : '?'} s`);
