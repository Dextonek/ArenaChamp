/**
 * Bakes the Climb's made floors (pipeline/designs/tower-50.md) into data files under src/tower/world/floors/gen/, and writes that
 * folder's list. Run with node (it reads TypeScript as it is):
 *
 *   node pipeline/tools/gen-floors.ts 2          floor 2 (the sea's)
 *   node pipeline/tools/gen-floors.ts 2-10       floors 2 to 10
 *   node pipeline/tools/gen-floors.ts 12-20      the wood's made floors (once its generator is in gen/chapters.ts)
 *   node pipeline/tools/gen-floors.ts 5:1        floor 5 again from its next seed (after a check threw it out)
 *
 * The chapter of a floor is its ten (1-10 the sea, 11-20 the wood...); the first floor of each ten is handmade and never baked. A layout
 * that cannot be made is made again from the next seed (up to thirty). The list names every baked file in the folder, so a floor made
 * earlier stays until it is made again.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATORS } from '../../src/tower/world/gen/chapters.ts';
import { CHAPTER_OF, type GenFloor } from '../../src/tower/world/gen/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'gen');
mkdirSync(OUT, { recursive: true });

const wanted: { n: number; attempt: number }[] = [];
for (const arg of process.argv.slice(2)) {
  const [span, att] = arg.split(':');
  const [a, b] = span.split('-').map(Number);
  for (let n = a; n <= (b || a); n++) if (n % 10 !== 1) wanted.push({ n, attempt: Number(att || 0) });
}
if (!wanted.length) {
  console.log('usage: node pipeline/tools/gen-floors.ts 2 | 2-10 | 12-20 | 5:1');
  process.exit(1);
}

for (const { n, attempt } of wanted) {
  if (n < 2 || n > 50) throw new Error(`floor ${n}: the Climb's made floors are 2 to 50 (not 1, 11, 21, 31, 41)`);
  const chapter = CHAPTER_OF(n), make = GENERATORS[chapter];
  if (!make) throw new Error(`floor ${n}: the ${chapter} chapter has no generator yet (src/tower/world/gen/chapters.ts)`);
  let g: GenFloor | null = null;
  for (let a = attempt; !g && a < attempt + 30; a++) {
    try { g = make({ n, attempt: a }); } catch (e) { console.log(`  floor ${n} attempt ${a}: ${(e as Error).message}; the next seed`); }
  }
  if (!g) throw new Error(`floor ${n}: thirty seeds and no layout`);
  const nn = String(n).padStart(2, '0'), name = `${chapter.toUpperCase()}_${nn}`;
  const body = `// Made by pipeline/tools/gen-floors.ts: floor ${n} of the ${chapter}, seed ${g.seed}. Made again by that tool; a hand fix is kept only
// until then (pipeline/designs/tower-50.md).
import type { GenFloor } from '../../gen/types';

export const ${name}: GenFloor = ${JSON.stringify(g, null, 1)};
`;
  writeFileSync(join(OUT, `${chapter}-${nn}.ts`), body);
  const f = g.floor;
  console.log(`floor ${n} (${f.id}, seed ${g.seed}): ${f.name}; places ${Object.values(f.places).map((p) => p.name).join(', ')}; ` +
    `cover ${g.look.pieces.length}; ruler ${g.pieces.ruler.name} (${g.pieces.ruler.stand}, ${g.pieces.ruler.hp}); gate ${g.pieces.gate.hero} L${g.pieces.gate.level}; ` +
    `people ${f.people.map((p) => `${p.role}:${p.hero}`).join(' ')}`);
}

// The list: every baked floor in the folder, every chapter.
const files = readdirSync(OUT).filter((x) => /^(sea|wood|sands|deep|war)-\d\d\.ts$/.test(x)).sort((x, y) => Number(x.slice(-5, -3)) - Number(y.slice(-5, -3)));
const names = files.map((x) => `${x.replace(/-\d\d\.ts$/, '').toUpperCase()}_${x.slice(-5, -3)}`);
writeFileSync(join(OUT, 'list.ts'), `// Written by pipeline/tools/gen-floors.ts: the baked floors in this folder.
import type { GenFloor } from '../../gen/types';
${files.map((x, i) => `import { ${names[i]} } from './${x.replace(/\.ts$/, '')}';`).join('\n')}

export const BAKED: GenFloor[] = [${names.join(', ')}];
`);
console.log(`list: ${files.length} floor(s)`);
