// The Climb's hunting plains (2026-11-19, the user: "make the hunting plains, hunt quest and 10 mobs"): finds on every floor the widest
// open ground clear of its roads, places, packs, people and every spot of its quests, its cover and its pools, and writes the table the
// game reads (src/tower/world/plains-table.ts). The floors' data is not changed. Run again after a floor is made again:
//
//   node --experimental-strip-types --no-warnings pipeline/tools/plains.mts
//
// Offsets are world coordinates (the floors' own). One plain a floor, 10 to 22 m round.
import { readdirSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/VFXTool/';
const url = (p: string) => 'file:///' + ROOT + p;
const { floorKeep } = await import(url('src/tower/world/keep.ts'));
const RING = { x: 0, z: 7 };

type Pt = { x: number; z: number };
interface Src { n: number; chapter: string; look: any; floor: any }
const srcs: Src[] = [];
const genDir = 'src/tower/world/floors/gen/';
for (const f of readdirSync(ROOT + genDir)) {
  if (!/^(sea|wood|sands|deep|war)-\d+\.ts$|^harbour-big\.ts$/.test(f)) continue;
  const m = await import(url(genDir + f));
  const g: any = Object.values(m).find((v: any) => v?.look?.paths && v?.floor);
  srcs.push({ n: g.n ?? 1, chapter: g.chapter ?? 'sea', look: g.look, floor: g.floor });
}
for (const [file, name, n, chapter] of [['woodGrown', 'WOOD_11', 11, 'wood'], ['canyon-made', 'CANYON_21', 21, 'sands'], ['deep-home', 'DEEP_HOME', 31, 'deep'], ['banners-made', 'BANNERS_41', 41, 'war']] as const) {
  const m = await import(url(`src/tower/world/floors/${file}.ts`));
  srcs.push({ n, chapter, look: m[name].look, floor: m[name].floor });
}

const segD = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
};

const NAMES: Record<string, string[]> = {
  sea: ['The Gull Flats', 'The Salt Meadow', 'The Tideward Downs', 'The Driftfield', 'The Wrack Lea', 'The Shell Heath', 'The Brine Lea', 'The Gannet Green', 'The Netters’ Field', 'The Foam Downs'],
  wood: ['The Fern Glade', 'The Antler Clearing', 'The Thornlea', 'The Hollow Green', 'The Mossfield', 'The Stag Lawn', 'The Briar Glade', 'The Rootlea', 'The Leafward Clearing', 'The Owl Green'],
  sands: ['The Glass Pan', 'The Bonefield', 'The Red Flats', 'The Scorpion Pan', 'The Dust Lea', 'The Mirage Field', 'The Cinder Pan', 'The Jackal Flats', 'The Salt Pan', 'The Sunbaked Field'],
  deep: ['The Black Shelf', 'The Echo Floor', 'The Mite Fields', 'The Lightless Lea', 'The Shard Floor', 'The Drip Hollow', 'The Gloom Shelf', 'The Glimmer Floor', 'The Under-Lea', 'The Still Floor'],
  war: ['The Burnt Field', 'The Crow Field', 'The Broken Line', 'The Ash Lea', 'The Muster Ground', 'The Fallow Field', 'The Rout Meadow', 'The Spear Lea', 'The Trampled Field', 'The Last Furrow'],
};

const rows: string[] = [];
const report: string[] = [];
for (const s of srcs.sort((a, b) => a.n - b.n)) {
  const look = s.look, fl = s.floor;
  const rim: number[] = look.rim ?? new Array(48).fill(fl.ring ?? 48);
  const rimAt = (dx: number, dz: number) => {
    const ang = ((Math.atan2(dz, dx) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), k = (ang / (2 * Math.PI)) * rim.length, i = Math.floor(k) % rim.length, f = k - Math.floor(k);
    return rim[i] * (1 - f) + rim[(i + 1) % rim.length] * f;
  };
  const roads: number[][] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
  const places = Object.values(fl.places) as any[];
  const packs: Pt[] = fl.packs.flatMap((p: any) => [p.at, ...(p.named?.patrol ?? [])]);
  const spots: Pt[] = floorKeep(fl);
  const cover = (look.pieces ?? []).filter((p: any) => p.look !== 'edge').map((p: any) => p.o);
  const pools: any[] = look.pools ?? look.flats ?? [];
  /** How much room is round (x, z) (negative: none). */
  // `k`: 1 the rules, 0 a looser second try for a floor with no room (packs 12 m off instead of 16, spots 4, the edge 5)
  const clear = (x: number, z: number, k = 1) => {
    const dx = x - RING.x, dz = z - RING.z;
    let d = rimAt(dx, dz) - 5 - 2 * k - Math.hypot(dx, dz);
    for (const r of roads) d = Math.min(d, segD(x, z, r[0], r[1], r[2], r[3]) - 3);
    for (const p of places) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - p.r - 6);
    for (const p of packs) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - 12 - 4 * k);
    for (const p of spots) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - 4 - k);
    // a door 14 m off (a fight on the plain must not walk the hero through one: a trial or the gate by mistake)
    for (const dr of fl.doors) d = Math.min(d, Math.hypot(x - dr.at.x, z - dr.at.z) - 14);
    for (const c of cover) d = Math.min(d, segD(x, z, c.ax, c.az, c.bx, c.bz) - c.r - 1);
    for (const f of pools) d = Math.min(d, Math.hypot(x - f.x, z - f.z) - Math.max(f.rx, f.rz) - 2);
    return d;
  };
  const R = Math.max(...rim) + 4;
  let best = { c: -1, x: 0, z: 0 };
  for (const k of [1, 0]) {
    for (let x = -R; x <= R; x += 2) for (let z = -R; z <= R; z += 2) {
      const c = clear(RING.x + x, RING.z + z, k);
      if (c > best.c) best = { c, x: Math.round((RING.x + x) * 10) / 10, z: Math.round((RING.z + z) * 10) / 10 };
    }
    if (best.c >= 9) break;
  }
  if (best.c < 9) { report.push(`floor ${s.n}: no room (widest ${best.c.toFixed(1)} m)`); continue; }
  const name = NAMES[s.chapter][(s.n - 1) % 10];
  const r = Math.min(22, Math.round(best.c * 10) / 10);
  rows.push(`  ${s.n}: { x: ${best.x}, z: ${best.z}, r: ${r}, name: '${name.replace(/'/g, "\\'")}' },`);
  report.push(`floor ${String(s.n).padStart(2)} ${s.chapter.padEnd(5)} ${name.padEnd(22)} at ${best.x}, ${best.z}  r ${r}`);
}

writeFileSync(ROOT + 'src/tower/world/plains-table.ts', `// Made by pipeline/tools/plains.mts from the floors' own data: do not edit by hand, run it again.
// Each Climb floor's hunting plain (2026-11-19): its middle (world), how far round it is open (m) and its name.

export interface PlainSpot { x: number; z: number; r: number; name: string }

export const PLAINS: Record<number, PlainSpot> = {
${rows.join('\n')}
};
`);
console.log(report.join('\n'));
console.log(`${rows.length} plains written`);
