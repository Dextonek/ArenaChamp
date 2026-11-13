/**
 * Bakes the Climb's made floors (pipeline/designs/tower-50.md) into data files under src/tower/world/floors/gen/, and writes that
 * folder's index. Run with node (it reads TypeScript as it is):
 *
 *   node pipeline/tools/gen-floors.ts 2          floor 2 of the sea
 *   node pipeline/tools/gen-floors.ts 2-9        floors 2 to 9
 *   node pipeline/tools/gen-floors.ts 5:1        floor 5 again from its next seed (after a check threw it out)
 *
 * The index lists every file in the folder, so a floor made earlier stays until it is made again.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSeaFloor } from '../../src/tower/world/gen/sea.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'src', 'tower', 'world', 'floors', 'gen');
mkdirSync(OUT, { recursive: true });

const wanted: { n: number; attempt: number }[] = [];
for (const arg of process.argv.slice(2)) {
  const [span, att] = arg.split(':');
  const [a, b] = span.split('-').map(Number);
  for (let n = a; n <= (b || a); n++) wanted.push({ n, attempt: Number(att || 0) });
}
if (!wanted.length) {
  console.log('usage: node pipeline/tools/gen-floors.ts 2 | 2-9 | 5:1');
  process.exit(1);
}

for (const { n, attempt } of wanted) {
  if (n < 2 || n > 10) throw new Error(`floor ${n}: the generator makes the sea's floors 2 to 10 for now (10 is the crown)`);
  const g = makeSeaFloor({ n, attempt });
  const nn = String(n).padStart(2, '0');
  const body = `// Made by pipeline/tools/gen-floors.ts: floor ${n} of the sea, seed ${g.seed}. Made again by that tool; a hand fix is kept only
// until then (pipeline/designs/tower-50.md).
import type { GenFloor } from '../../gen/types';

export const SEA_${nn}: GenFloor = ${JSON.stringify(g, null, 1)};
`;
  writeFileSync(join(OUT, `sea-${nn}.ts`), body);
  const f = g.floor;
  console.log(`floor ${n} (${f.id}, seed ${g.seed}): ${f.name}; sea ${g.look.mirror === 1 ? 'east' : 'west'}; places ${Object.values(f.places).map((p) => p.name).join(', ')}; ` +
    `cover ${g.look.pieces.length}, flats ${g.look.flats.length}; ruler ${g.pieces.ruler.name} (${g.pieces.ruler.stand}, ${g.pieces.ruler.hp}); gate ${g.pieces.gate.hero} L${g.pieces.gate.level}; ` +
    `people ${f.people.map((p) => `${p.role}:${p.hero}`).join(' ')}`);
}

// The index: every baked floor in the folder.
const files = readdirSync(OUT).filter((x) => /^sea-\d\d\.ts$/.test(x)).sort();
const names = files.map((x) => `SEA_${x.slice(4, 6)}`);
writeFileSync(join(OUT, 'list.ts'), `// Written by pipeline/tools/gen-floors.ts: the baked floors in this folder.
import type { GenFloor } from '../../gen/types';
${files.map((x, i) => `import { ${names[i]} } from './${x.replace(/\.ts$/, '')}';`).join('\n')}

export const BAKED: GenFloor[] = [${names.join(', ')}];
`);
console.log(`list: ${files.length} floor(s)`);
