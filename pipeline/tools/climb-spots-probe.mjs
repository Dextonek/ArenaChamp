/**
 * Which of a Climb floor's spots stand inside or on a piece of its cover (2026-11-16: the War's places and the armies' homes stood in
 * the middle of the standards' 0.9 m stone feet). Reads the floors as the game has them (through Vite's loader, as climb-packs.mjs does,
 * with a cache folder of its own) and measures every spot of a floor's data against every piece of its cover (a pillar's circle, a
 * wall's capsule): the places' stands, the people, the packs' homes and patrol points, caches, waystones, the lore stone, the doors
 * (not their walls), every quest step's spots (a lead's road too), the rival's spot and goal, the law's banners and the start.
 *
 *   node pipeline/tools/climb-spots-probe.mjs 42-50          the spots closer than 0.5 m to the cover's edge (inside: a minus)
 *   node pipeline/tools/climb-spots-probe.mjs 41-50 --near 1.5 --json out.json
 *
 * A place's middle is left out (it may be cover: `PlaceDef.stand` is its open ground), and so are the "reach" steps that touch a
 * standard (`r` 3.8 m round the standard's middle: the quest touches the standard itself).
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const near = Number(opt('--near', '0.5'));
const json = opt('--json', null);
const span = args.find((a) => /^\d+(-\d+)?$/.test(a)) ?? '42-50';
const [a, b] = span.split('-').map(Number);

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vite = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom', cacheDir: join(tmpdir(), 'arena-climb-spots-vite'),
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] },
});
const r2 = (v) => Math.round(v * 100) / 100;
const out = [];
try {
  const { FLOORS } = await vite.ssrLoadModule('/src/tower/world/floors/index.ts');
  for (let n = a; n <= (b || a); n++) {
    const def = FLOORS[n];
    if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
    const spots = [];
    const add = (name, p) => { if (p && Number.isFinite(p.x)) spots.push({ name, x: p.x, z: p.z }); };
    add('start', def.start); add('camp', def.camp);
    for (const p of Object.values(def.places)) add(`place ${p.id} stand`, p.stand);
    for (const p of def.people) add(`person ${p.id}`, p.at);
    for (const p of def.packs) { if (p.named) p.named.patrol.forEach((q, i) => add(`patrol ${p.id}.${i}`, q)); else add(`pack ${p.id}`, p.at); }
    for (const w of def.waystones) add(`waystone ${w.id}`, w.at);
    for (const c of def.caches) add(`cache ${c.id}`, c.at);
    add('lore', def.lore.at);
    for (const d of def.doors) if (!d.wall) add(`door ${d.id}`, d.at);
    for (const q of def.quests) q.steps.forEach((s, i) => {
      const t = `${q.id}.${i + 1} ${s.verb}`;
      if (s.at && !(s.verb === 'reach' && /standard/i.test(s.text ?? ''))) add(`${t} at`, s.at);
      if (s.from) add(`${t} from`, s.from);
      if (s.to) add(`${t} to`, s.to);
      if (s.things) s.things.forEach((x) => add(`${t} ${x.id}`, x.at));
      if (s.path) s.path.forEach((x, k) => add(`${t} road ${k}`, x));
    });
    add('rival at', def.rival.at); add('rival goal', def.rival.to);
    for (const bn of def.law.banners ?? []) add(`banner ${bn.id}`, bn.at);
    const cover = def.cover.filter((c) => !c.fixed);
    const hits = [];
    for (const s of spots) {
      let best = null;
      for (const c of cover) {
        const ex = c.bx - c.ax, ez = c.bz - c.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((s.x - c.ax) * ex + (s.z - c.az) * ez) / l2)) : 0;
        const d = Math.hypot(s.x - (c.ax + ex * t), s.z - (c.az + ez * t)) - c.r;
        if (!best || d < best.d) best = { d, c };
      }
      if (best && best.d < near) hits.push({ spot: s.name, x: r2(s.x), z: r2(s.z), clear: r2(best.d), cover: { kind: best.c.kind, x: r2((best.c.ax + best.c.bx) / 2), z: r2((best.c.az + best.c.bz) / 2), r: best.c.r, h: best.c.height } });
    }
    out.push({ floor: n, spots: spots.length, cover: cover.length, hits });
  }
} finally {
  await vite.close();
}
for (const f of out) {
  if (f.error) { console.log(`floor ${f.floor}: ${f.error}`); continue; }
  console.log(`floor ${f.floor}: ${f.spots} spots, ${f.cover} cover; ${f.hits.length} within ${near} m of the cover's edge`);
  for (const h of f.hits) console.log(`  ${h.spot.padEnd(28)} (${h.x}, ${h.z})  ${h.clear < 0 ? 'INSIDE' : 'clear'} ${h.clear} m  of a ${h.cover.kind} r ${h.cover.r} h ${h.cover.h} at (${h.cover.x}, ${h.cover.z})`);
}
if (json) writeFileSync(json, JSON.stringify(out, null, 1));
