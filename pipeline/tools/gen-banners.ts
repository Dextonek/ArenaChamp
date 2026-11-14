/**
 * Bakes floor 41, The Field of Banners, at the Climb's new size (pipeline/designs/tower-50.md: five times the ground, the handmade
 * floors grow too): `makeBannersFloor` (src/tower/world/gen/war.ts) lays the small floor's places, people, quests and ids out again
 * on a broad field, and this writes the result to src/tower/world/floors/banners-made.ts, which floors/banners.ts reads. Run with node:
 *
 *   node pipeline/tools/gen-banners.ts        the floor from its seed (41000)
 *   node pipeline/tools/gen-banners.ts 1      from the next seed (after a check threw the layout out)
 *
 * (`gen-floors.ts` bakes the made floors 42 to 50; it leaves every chapter's first floor alone.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBannersFloor } from '../../src/tower/world/gen/war.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'banners-made.ts');
const from = Number(process.argv[2] || 0);
let g: ReturnType<typeof makeBannersFloor> | null = null;
for (let a = from; !g && a < from + 30; a++) {
  try { g = makeBannersFloor(a); } catch (e) { console.log(`  attempt ${a}: ${(e as Error).message}; the next seed`); }
}
if (!g) throw new Error('floor 41: thirty seeds and no layout');
writeFileSync(OUT, `// Made by pipeline/tools/gen-banners.ts: floor 41, The Field of Banners, at the new size, seed ${g.seed}. Made again by that tool; a hand
// fix is kept only until then (pipeline/designs/tower-50.md).
import type { GenFloor } from '../gen/types';

export const BANNERS_41: Omit<GenFloor, 'pieces'> = ${JSON.stringify(g, null, 1)};
`);
const f = g.floor;
console.log(`floor 41 (seed ${g.seed}): ring ${f.ring}; places ${Object.values(f.places).map((p) => p.name).join(', ')}; cover ${g.look.pieces.length}`);
