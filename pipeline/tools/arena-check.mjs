// Checks an arena's cover layout (src/arenas/real/<id>.json, written by blender/arenas/real/<id>.py) against the rules
// of docs/architecture/arenas.md "Rules for a new arena":
//
//   node pipeline/tools/arena-check.mjs harbour [canyon ...]
//
// - point-symmetric about the ring's centre (0, 7): every obstacle has its twin (or is its own, in the middle)
// - both starts, (0, 13) and (0, 1), clear for 3 m
// - nothing within 1.5 m of the rim (radius 12)
// - gaps of at least 2 m between obstacles (so a hero always fits through), unless they touch or overlap on purpose
// - a pillar's radius at most 1.0, a wall's half thickness at most 0.4
// - the two starts see neither each other (something stands between them) nor are walled in (the open floor connects)
// Exit code 1 if a rule is broken. It cannot see the meshes: that each one covers its capsule is checked by eye.
import fs from 'node:fs';

const C = { x: 0, z: 7 }, R = 12, STARTS = [{ x: 0, z: 13 }, { x: 0, z: 1 }];
const seg = (o, x, z) => {
  const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / l2)) : 0;
  return Math.hypot(x - (o.ax + dx * t), z - (o.az + dz * t));
};
/** Distance between two capsules' surfaces (sampled along both segments). */
const gap = (a, b) => {
  let best = Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = a.ax + ((a.bx - a.ax) * i) / 24, z = a.az + ((a.bz - a.az) * i) / 24;
    best = Math.min(best, seg(b, x, z));
    const x2 = b.ax + ((b.bx - b.ax) * i) / 24, z2 = b.az + ((b.bz - b.az) * i) / 24;
    best = Math.min(best, seg(a, x2, z2));
  }
  return best - a.r - b.r;
};
const near = (a, b) => Math.abs(a - b) < 0.02;

let failed = false;
for (const id of process.argv.slice(2)) {
  const { obstacles } = JSON.parse(fs.readFileSync(`src/arenas/real/${id}.json`, 'utf8'));
  const bad = [];
  obstacles.forEach((o, i) => {
    const twin = obstacles.find((p) => p.kind === o.kind && near(p.r, o.r) && near(p.height, o.height)
      && ((near(p.ax, 2 * C.x - o.ax) && near(p.az, 2 * C.z - o.az) && near(p.bx, 2 * C.x - o.bx) && near(p.bz, 2 * C.z - o.bz))
        || (near(p.bx, 2 * C.x - o.ax) && near(p.bz, 2 * C.z - o.az) && near(p.ax, 2 * C.x - o.bx) && near(p.az, 2 * C.z - o.bz))));
    if (!twin) bad.push(`#${i} has no twin through (0, 7)`);
    for (const s of STARTS) if (seg(o, s.x, s.z) - o.r < 3) bad.push(`#${i} is ${(seg(o, s.x, s.z) - o.r).toFixed(2)} m from the start (${s.x}, ${s.z}): less than 3`);
    const reach = Math.max(Math.hypot(o.ax - C.x, o.az - C.z), Math.hypot(o.bx - C.x, o.bz - C.z)) + o.r;
    if (R - reach < 1.5) bad.push(`#${i} is ${(R - reach).toFixed(2)} m from the rim: less than 1.5`);
    if (o.kind === 'pillar' && o.r > 1.0) bad.push(`#${i}: pillar radius ${o.r} over 1.0`);
    if (o.kind === 'wall' && o.r > 0.4) bad.push(`#${i}: wall half thickness ${o.r} over 0.4`);
    for (let k = i + 1; k < obstacles.length; k++) {
      const g = gap(o, obstacles[k]);
      if (g > 0.05 && g < 2) bad.push(`#${i} and #${k} are ${g.toFixed(2)} m apart: a gap under 2 m`);
    }
  });
  // sight between the starts
  let blocked = false;
  for (let i = 0; i <= 120 && !blocked; i++) {
    const x = STARTS[0].x + ((STARTS[1].x - STARTS[0].x) * i) / 120, z = STARTS[0].z + ((STARTS[1].z - STARTS[0].z) * i) / 120;
    blocked = obstacles.some((o) => seg(o, x, z) <= o.r);
  }
  if (!blocked) bad.push('the two starts see each other: nothing stands between them');
  // the open floor connects the starts: flood a 0.25 m grid, a hero's body (0.45 m) clear of every obstacle
  const N = 97, cell = (2 * R) / (N - 1), open = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = C.x - R + i * cell, z = C.z - R + j * cell;
    open[j * N + i] = Math.hypot(x - C.x, z - C.z) <= R - 0.45 && obstacles.every((o) => seg(o, x, z) > o.r + 0.45) ? 1 : 0;
  }
  const idx = (p) => Math.round((p.z - C.z + R) / cell) * N + Math.round((p.x - C.x + R) / cell);
  const seen = new Uint8Array(N * N), todo = [idx(STARTS[0])];
  seen[todo[0]] = 1;
  while (todo.length) {
    const k = todo.pop();
    for (const d of [1, -1, N, -N]) {
      const n = k + d;
      if (n >= 0 && n < N * N && open[n] && !seen[n]) { seen[n] = 1; todo.push(n); }
    }
  }
  if (!seen[idx(STARTS[1])]) bad.push('the two starts are not joined by open floor');
  const reached = seen.reduce((s, v) => s + v, 0), total = open.reduce((s, v) => s + v, 0);
  if (reached < total * 0.98) bad.push(`${total - reached} of ${total} open cells cannot be reached: a pocket`);
  console.log(`${id}: ${obstacles.length} obstacles, ${bad.length ? `${bad.length} broken rules` : 'all rules hold'}`);
  for (const b of bad) console.log('  - ' + b);
  failed ||= bad.length > 0;
}
process.exit(failed ? 1 : 0);
