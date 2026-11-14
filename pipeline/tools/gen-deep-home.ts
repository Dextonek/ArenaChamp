/**
 * Bakes floor 31, the Lightless Deep, at the new size (pipeline/designs/tower-50.md, "The new scope": the five handmade floors grow
 * too): the same place, people, quests, ruler, gatekeeper, race and law, laid out again on a cave five times floor 1's ground by the
 * Deep's generator (src/tower/world/gen/deep.ts, its `home` floor). Writes src/tower/world/floors/deep-home.ts; floors/deep.ts makes the
 * floor of it. Not in floors/gen/: the baking tool's list takes every `deep-NN.ts` there as a made floor. Run with node:
 *
 *   node pipeline/tools/gen-deep-home.ts        from the first seed (a layout that cannot be made is made from the next)
 *   node pipeline/tools/gen-deep-home.ts 3      from seed offset 3
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDeepFloor } from '../../src/tower/world/gen/deep.ts';
import type { GenFloor } from '../../src/tower/world/gen/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'deep-home.ts');
const from = Number(process.argv[2] ?? 0);
let g: GenFloor | null = null;
for (let a = from; !g && a < from + 30; a++) {
  try { g = makeDeepFloor({ n: 31, attempt: a }); } catch (e) { console.log(`  attempt ${a}: ${(e as Error).message}; the next seed`); }
}
if (!g) throw new Error('floor 31: thirty seeds and no layout');
const { look, floor, seed } = g;
writeFileSync(OUT, `// Made by pipeline/tools/gen-deep-home.ts: floor 31, the Lightless Deep, grown (seed ${seed}). Made again by that tool; a hand fix is
// kept only until then. Its set pieces are pieces/floors.ts's (floor 31), unchanged.
import type { DeepLook } from '../deepZone';
import type { FloorDef } from '../def';

export const DEEP_HOME: { seed: number; look: DeepLook; floor: Omit<FloorDef, 'arena' | 'cover'> } = ${JSON.stringify({ seed, look, floor }, null, 1)};
`);
console.log(`floor 31 (seed ${seed}): places ${Object.values(floor.places).map((p) => p.name).join(', ')}; cover ${look.pieces.length}; ring ${floor.ring}; par ${floor.par}`);
