// The grass probe for the Climb's floors (2026-11-15: grass tufts stood on cliff faces). A body for world-shots.py on the game page:
//   python -I pipeline/tools/world-shots.py <file that sets window.__grassFloors = [...] then has this text> --page /game --port 5267
// (or this file alone: one floor a chapter). Builds each floor's zone (no fight) and, for every small instanced thing in it (grass tufts,
// dry shrubs, flowers, pebbles, arrows, helmets: anything under 1.2 m tall drawn as instances), looks at the ground AS DRAWN under each
// copy (the zone's ground planes, their own triangles; where two planes overlap, the finer one): how steep that triangle is (rise over
// run: 0.6 is 31 degrees, 1 is 45) and how far the copy's foot is off it. Per floor and per kind (a kind is named by its geometry's size
// and colour): how many copies, how many on ground steeper than 0.6 and 1.0, the most off the ground, and the steepest few with their
// places (to take pictures of). `window.__grassAll = true` lists every steep copy.
const floors = window.__grassFloors ?? [1, 11, 21, 31, 41];
const F = await import('/src/tower/world/floors/index.ts');
const out = [];
for (const n of floors) {
  const def = F.FLOORS[n];
  if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
  const z = def.arena.build();
  const root = z.group;
  root.updateMatrixWorld(true);
  // --- the ground as drawn: every big PlaneGeometry, in world coordinates
  const planes = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry?.type !== 'PlaneGeometry' || o.geometry.attributes.position.count < 400) return;
    const P = o.geometry.parameters, A = o.geometry.attributes.position, m = o.matrixWorld.elements, W = new Float32Array(A.count * 3);
    for (let i = 0; i < A.count; i++) {
      const x = A.getX(i), y = A.getY(i), zz = A.getZ(i);
      W[i * 3] = m[0] * x + m[4] * y + m[8] * zz + m[12]; W[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * zz + m[13]; W[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * zz + m[14];
    }
    // a ground plane lies flat once turned: its corners' x and z span its size
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < A.count; i++) { x0 = Math.min(x0, W[i * 3]); x1 = Math.max(x1, W[i * 3]); z0 = Math.min(z0, W[i * 3 + 2]); z1 = Math.max(z1, W[i * 3 + 2]); }
    if (x1 - x0 < 20 || z1 - z0 < 20) return;
    planes.push({ W, GX: P.widthSegments, GZ: P.heightSegments, cw: P.width / P.widthSegments, ch: P.height / P.heightSegments, x0: W[0], z0: W[2], bx0: x0, bx1: x1, bz0: z0, bz1: z1, cell: P.width / P.widthSegments });
  });
  planes.sort((a, b) => a.cell - b.cell);
  const tri = (W, px, pz, a, b, c) => {
    const ax = W[a * 3], az = W[a * 3 + 2], bx = W[b * 3], bz = W[b * 3 + 2], cx = W[c * 3], cz = W[c * 3 + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) return null;
    // the triangle's slope: its normal's lean
    const ux = bx - ax, uy = W[b * 3 + 1] - W[a * 3 + 1], uz = bz - az, vx = cx - ax, vy = W[c * 3 + 1] - W[a * 3 + 1], vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return { y: l1 * W[a * 3 + 1] + l2 * W[b * 3 + 1] + l3 * W[c * 3 + 1], slope: Math.hypot(nx, nz) / Math.abs(ny || 1e-9) };
  };
  const groundAt = (px, pz) => {
    for (const p of planes) {
      if (px < p.bx0 || px > p.bx1 || pz < p.bz0 || pz > p.bz1) continue;
      // the plane's grid: vertex 0 is one corner; the cell from there (either way round, as the plane was turned)
      const sx = Math.sign(p.W[3] - p.W[0]) || 1, sz = Math.sign(p.W[(p.GX + 1) * 3 + 2] - p.W[2]) || 1;
      const ix = Math.max(0, Math.min(p.GX - 1, Math.floor(((px - p.x0) * sx) / p.cw))), iz = Math.max(0, Math.min(p.GZ - 1, Math.floor(((pz - p.z0) * sz) / p.ch)));
      const W = p.GX + 1, a = ix + W * iz, b = ix + W * (iz + 1), c = ix + 1 + W * (iz + 1), d = ix + 1 + W * iz;
      const hit = tri(p.W, px, pz, a, b, d) ?? tri(p.W, px, pz, b, c, d);
      if (hit) return hit;
    }
    return null;
  };
  // --- every small instanced thing
  const kinds = new Map();
  root.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, tall = bb.max.y - bb.min.y;
    if (tall > 1.2) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material, C = g.attributes.color;
    const col = C ? '#' + [C.getX(0), C.getY(0), C.getZ(0)].map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255).toString(16).padStart(2, '0')).join('') : '#' + (mat?.color?.getHexString?.() ?? '??????');
    const key = `${o.name || 'unnamed'} v${g.attributes.position.count} h${tall.toFixed(2)} ${col}`;
    const k = kinds.get(key) ?? { kind: key, n: 0, over06: 0, over10: 0, offMax: 0, nowhere: 0, steep: [] };
    for (let i = 0; i < o.count; i++) {
      const e = o.instanceMatrix.array, x = e[i * 16 + 12], y = e[i * 16 + 13], zz = e[i * 16 + 14];
      const gr = groundAt(x, zz);
      k.n++;
      if (!gr) { k.nowhere++; continue; }
      const off = y - gr.y;
      k.offMax = Math.max(k.offMax, Math.abs(off));
      if (gr.slope > 0.6) k.over06++;
      if (gr.slope > 1.0) k.over10++;
      if (gr.slope > 0.6) k.steep.push({ x: +x.toFixed(1), z: +zz.toFixed(1), y: +y.toFixed(2), slope: +gr.slope.toFixed(2), off: +off.toFixed(2) });
    }
    kinds.set(key, k);
  });
  const rows = [...kinds.values()].map((k) => ({ ...k, offMax: +k.offMax.toFixed(2), steep: (window.__grassAll ? k.steep : k.steep.sort((a, b) => b.slope - a.slope).slice(0, 6)) }));
  z.dispose();
  const row = { floor: n, planes: planes.map((p) => `${(p.bx1 - p.bx0).toFixed(0)}m/${p.cell.toFixed(2)}`), kinds: rows };
  if (window.__grassLog) await __log(JSON.stringify(row));
  out.push(row);
}
return out;
