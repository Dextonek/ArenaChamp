/**
 * Writes `server/climb-packs.mjs`: every Climb floor's packs as the hub needs them for the open world's shared packs (stage 2,
 * pipeline/designs/climb-open-world.md): their ids (a pack id the floor does not have is refused) and their homes (a cleared pack
 * comes back only when nobody stands within 30 m of it). And, for stage 3 (doors together), each floor's doors (id, piece, place,
 * ring: a door id the floor does not have is refused, a player far from it is not taken in) and the ruler behind its lair as the hub
 * keeps it for a party: its health, the shares its phases start at, its gauge and kneel, what a felled sentry earns, or the Raid boss
 * of a crown floor. A floor without set pieces of its own plays the highest floor's below it (`startPiece`), and so does the table.
 * The floors are TypeScript with imports Node cannot follow, so they are read through Vite's own loader, with its cache in a folder
 * of its own (the shared cache is never touched).
 *
 *   node pipeline/tools/climb-packs.mjs           write the table
 *   node pipeline/tools/climb-packs.mjs --check   say whether the table is the floors' (exit 1 when it is not)
 *
 * Run it again after a floor's packs, doors or ruler change (a new floor, a pack moved or renamed, a ruler's health). The page checks
 * the floor it plays against the table on the dev server and warns in the console when they differ (src/tower/world/share.ts,
 * src/tower/world/together.ts).
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
  const { doorRows } = await vite.ssrLoadModule('/src/tower/world/doorTable.ts');
  const r1 = (v) => Math.round(v * 10) / 10;
  const floors = Object.keys(FLOORS).map(Number).sort((a, b) => a - b);
  const rows = floors.map((n) => {
    const packs = FLOORS[n].packs.map((p) => `[${JSON.stringify(p.id)}, ${r1(p.at.x)}, ${r1(p.at.z)}]`);
    return `  ${n}: [${packs.join(', ')}],`;
  });
  const doors = floors.map((n) => `  ${n}: ${JSON.stringify(doorRows(FLOORS[n]))},`);
  text = `// Made by pipeline/tools/climb-packs.mjs from src/tower/world/floors: do not edit by hand, run it again.
// Each Climb floor's packs: [id, home x, home z]. The hub's shared packs (the open world, stage 2) refuse an id a floor does not have.
/** @type {Record<number, [string, number, number][]>} */
export const CLIMB_PACKS = {
${rows.join('\n')}
};

// Each Climb floor's doors, [id, piece, x, z, ring], and the ruler behind its lair as a party fights it (the open world, stage 3):
// its health, the shares of health its phases start at, its gauge and kneel (s), what a felled sentry earns, or a crown's Raid boss.
/** @type {Record<number, { doors: [string, string, number, number, number][], ruler: { hp: number, phases: number[], staggerMax: number, kneel: number, rewards: Record<string, { stagger?: number, kneel?: boolean }>, crown?: string, tier?: number } }>} */
export const CLIMB_DOORS = {
${doors.join('\n')}
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
