/**
 * Writes `server/climb-packs.mjs`: every Climb floor's packs as the hub needs them for the open world's shared packs (stage 2,
 * pipeline/designs/climb-open-world.md): their ids (a pack id the floor does not have is refused) and their homes (a cleared pack
 * comes back only when nobody stands within 30 m of it). The floors are TypeScript with imports Node cannot follow, so they are read
 * through Vite's own loader, with its cache in a folder of its own (the shared cache is never touched).
 *
 *   node pipeline/tools/climb-packs.mjs           write the table
 *   node pipeline/tools/climb-packs.mjs --check   say whether the table is the floors' (exit 1 when it is not)
 *
 * Run it again after a floor's packs change (a new floor, a pack moved or renamed). The page checks the floor it plays against the
 * table on the dev server and warns in the console when they differ (src/tower/world/share.ts).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'server', 'climb-packs.mjs');
const vite = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom', cacheDir: join(tmpdir(), 'arena-climb-packs-vite'),
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] },
});
let text;
try {
  const { FLOORS } = await vite.ssrLoadModule('/src/tower/world/floors/index.ts');
  const r1 = (v) => Math.round(v * 10) / 10;
  const rows = Object.keys(FLOORS).map(Number).sort((a, b) => a - b).map((n) => {
    const packs = FLOORS[n].packs.map((p) => `[${JSON.stringify(p.id)}, ${r1(p.at.x)}, ${r1(p.at.z)}]`);
    return `  ${n}: [${packs.join(', ')}],`;
  });
  text = `// Made by pipeline/tools/climb-packs.mjs from src/tower/world/floors: do not edit by hand, run it again.
// Each Climb floor's packs: [id, home x, home z]. The hub's shared packs (the open world, stage 2) refuse an id a floor does not have.
/** @type {Record<number, [string, number, number][]>} */
export const CLIMB_PACKS = {
${rows.join('\n')}
};
`;
} finally {
  await vite.close();
}
if (process.argv.includes('--check')) {
  let now = '';
  try { now = readFileSync(out, 'utf8'); } catch { /* none yet */ }
  const same = now.replace(/\r\n/g, '\n') === text;
  console.log(same ? 'server/climb-packs.mjs is the floors\' table' : 'server/climb-packs.mjs is out of date: run node pipeline/tools/climb-packs.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(out, text);
console.log(`wrote ${out}: ${text.split('\n').length - 5} floors`);
