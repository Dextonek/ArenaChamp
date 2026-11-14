// The props probe for the Climb's floors (2026-11-14, the user: "lets look at all props one by one and make the correct"). A body for
// world-shots.py, on the game page:
//   python -I pipeline/tools/world-shots.py <file that sets window.__probeFloors = [...] then has this text> --page /game --port 5252
// (or this file alone: the floors below). Builds each floor's zone (no fight) and measures every placed piece against the ground as it is
// DRAWN (the zone's ground plane, its own triangles; on the edge of the walkable ground they lift off the flat by up to a few dm), not
// the planners' numbers. The props are merged into big meshes, so it first splits every mesh back into its pieces (triangles that share
// a corner: a box, a tube, a ring), then joins pieces that touch into things (a box and the bands round it; a sack on a cart).
// What it flags, per floor:
// - `float`: a thing none of whose points is within 5 cm of the ground: it hangs in the air (a lantern on its post is one thing with the post).
// - `gap`: a piece that stands on the ground with a flat base and the ground falls away under part of that base (a crate on a slope):
//   light under one side. Only pieces wider than 0.3 m, gap over 12 cm.
// - `buried`: a thing wholly under the ground (nobody sees it).
// - `cover`: a piece of the depth or the scenes (the vertex-coloured meshes) whose middle stands inside a piece of cover (a rock, a wall,
//   a tree's trunk) by more than 0.3 m: a prop through a wall. The cover's own drawing is not vertex-coloured in the Sands and the War;
//   in the Deep it is (its cover pieces are their own meshes, outside `deep-depth`), so there only `deep-depth`'s pieces are checked.
// Each hit: kind, x, z (world), the size of the thing (w, h), how much (m), and the main colour of its points (to find it in the code).
// `window.__probeDump = [x, z, r]` lists the pieces near a point instead (their boxes, colours and the ground under them).
// `window.__probeLog = true` prints each floor's result in full as it goes. `window.__probeAll = true` lists every hit (else the first 40 a kind per floor) and `window.__probeNear = [x, z, r]` lists only hits near a point.
const floors = window.__probeFloors ?? [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
const F = await import('/src/tower/world/floors/index.ts');
const { rimAt } = await import('/src/tower/world/land.ts');
const RING = { x: 0, z: 7 };
const segDist = (px, pz, ax, az, bx, bz) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(Math.pow(v, 1 / 2.2) * 255))).toString(16).padStart(2, '0')).join('');
const out = [];
for (const n of floors) {
  const def = F.FLOORS[n];
  if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
  const z = def.arena.build();
  const root = z.group;
  root.updateMatrixWorld(true);
  // --- the ground as drawn: the biggest PlaneGeometry
  let ground = null;
  root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.geometry.attributes.position.count > 1000 && (!ground || o.geometry.attributes.position.count > ground.geometry.attributes.position.count)) ground = o; });
  if (!ground) { out.push({ floor: n, error: 'no ground plane' }); z.dispose(); continue; }
  const gp = ground.geometry.parameters, GX = gp.widthSegments, GZ = gp.heightSegments, gw = gp.width, gh = gp.height;
  const GA = ground.geometry.attributes.position, gm = ground.matrixWorld.elements;
  const GW = new Float32Array(GA.count * 3);
  for (let i = 0; i < GA.count; i++) {
    const x = GA.getX(i), y = GA.getY(i), zz = GA.getZ(i);
    GW[i * 3] = gm[0] * x + gm[4] * y + gm[8] * zz + gm[12]; GW[i * 3 + 1] = gm[1] * x + gm[5] * y + gm[9] * zz + gm[13]; GW[i * 3 + 2] = gm[2] * x + gm[6] * y + gm[10] * zz + gm[14];
  }
  const x0 = GW[0], z0 = GW[2], cw = gw / GX, ch = gh / GZ; // vertex 0 is the corner at (-w/2, -h/2) after the plane's turn
  const tri = (px, pz, a, b, c) => {
    const ax = GW[a * 3], az = GW[a * 3 + 2], bx = GW[b * 3], bz = GW[b * 3 + 2], cx = GW[c * 3], cz = GW[c * 3 + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) return null;
    return l1 * GW[a * 3 + 1] + l2 * GW[b * 3 + 1] + l3 * GW[c * 3 + 1];
  };
  const groundAt = (px, pz) => {
    const ix = Math.max(0, Math.min(GX - 1, Math.floor((px - x0) / cw))), iz = Math.max(0, Math.min(GZ - 1, Math.floor((pz - z0) / ch)));
    const W = GX + 1, a = ix + W * iz, b = ix + W * (iz + 1), c = ix + 1 + W * (iz + 1), d = ix + 1 + W * iz;
    return tri(px, pz, a, b, d) ?? tri(px, pz, b, c, d) ?? tri(px, pz, a, b, c) ?? tri(px, pz, a, c, d) ?? GW[a * 3 + 1];
  };
  // --- the zone's outline: the invisible edge walls (the floor's fixed cover), a ring of segments round the middle
  const edges = def.cover.filter((c) => c.fixed);
  const poly = edges.map((c) => [c.ax, c.az]);
  const insidePoly = (x, zz) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > zz) !== (zj > zz) && x < ((xj - xi) * (zz - zi)) / (zj - zi) + xi) k = !k; } return k; };
  const beyond = (x, zz) => { if (poly.length < 3) return NaN; let m = 1e9; for (const c of edges) m = Math.min(m, segDist(x, zz, c.ax, c.az, c.bx, c.bz)); return insidePoly(x, zz) ? -m : m; };
  // --- the scenes, to name what a hit belongs to: the Sands' and the Deep's logs (their items' circles), the War's (centre and radius)
  const story = [];
  const sl = root.userData.depth?.scenes;
  if (sl) for (const sc of sl) for (const it of sc.items) story.push({ x: it.x, z: it.z, r: it.r + 0.3, kind: sc.kind });
  root.traverse((o) => { if (o.userData?.scenes && o.userData?.sceneLook) for (const sc of o.userData.scenes) for (const it of sc.items) story.push({ x: it.x, z: it.z, r: it.r + 0.3, kind: sc.kind }); });
  const wl = [...(globalThis.__warScenesLog ?? new Map()).values()].find((l) => l.floor === n);
  if (wl) for (const sc of wl.scenes) story.push({ x: sc.x, z: sc.z, r: (sc.r ?? sc.R) + 0.5, kind: sc.kind + sc.v });
  const storyAt = (x, zz) => { let best = null, bd = 1e9; for (const s of story) { const d = Math.hypot(x - s.x, zz - s.z) - s.r; if (d < 0 && d < bd) { bd = d; best = s.kind; } } return best ?? 'depth'; };
  // --- every piece
  const pieces = []; // { x0, y0, z0, x1, y1, z1, P (world positions), col, vc, deep }
  const mul = (a, b) => { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
  root.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || o === ground) return;
    const g = o.geometry, A = g?.attributes?.position;
    if (!A || A.count < 3) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || mat.type === 'MeshBasicMaterial' || (mat.transparent && mat.opacity < 0.6) || mat.depthWrite === false || g.type === 'PlaneGeometry') return; // glows, smoke, shadows, water (a cover piece that fades when the hero is behind it is kept)
    let deep = false; for (let p = o; p; p = p.parent) if (p.name === 'deep-depth' || p.name === 'war-scenes') deep = true;
    const C = g.attributes.color, idx = g.index;
    const insts = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < insts; k++) {
      const e = o.isInstancedMesh ? mul(o.matrixWorld.elements, Array.from(o.instanceMatrix.array.slice(k * 16, k * 16 + 16))) : o.matrixWorld.elements, nv = A.count;
      const W = new Float32Array(nv * 3);
      for (let i = 0; i < nv; i++) { const x = A.getX(i), y = A.getY(i), zz = A.getZ(i); W[i * 3] = e[0] * x + e[4] * y + e[8] * zz + e[12]; W[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * zz + e[13]; W[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * zz + e[14]; }
      // union of the vertices that share a corner (by position, to the millimetre) and of each triangle's three
      const parent = new Int32Array(nv); for (let i = 0; i < nv; i++) parent[i] = i;
      const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
      const seen = new Map();
      for (let i = 0; i < nv; i++) { const key = Math.round(W[i * 3] * 1000) + ',' + Math.round(W[i * 3 + 1] * 1000) + ',' + Math.round(W[i * 3 + 2] * 1000); const j = seen.get(key); if (j === undefined) seen.set(key, i); else join(i, j); }
      const nt = idx ? idx.count / 3 : nv / 3;
      for (let t = 0; t < nt; t++) { const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2; join(a, b); join(b, c); }
      const comp = new Map();
      for (let i = 0; i < nv; i++) { const r = find(i); let c = comp.get(r); if (!c) comp.set(r, (c = [])); c.push(i); }
      for (const list of comp.values()) {
        const P = new Float32Array(list.length * 3);
        let ax = 1e9, ay = 1e9, az = 1e9, bx = -1e9, by = -1e9, bz = -1e9, cr = 0, cg = 0, cb = 0;
        list.forEach((i, j) => {
          const x = W[i * 3], y = W[i * 3 + 1], zz = W[i * 3 + 2];
          P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = zz;
          ax = Math.min(ax, x); ay = Math.min(ay, y); az = Math.min(az, zz); bx = Math.max(bx, x); by = Math.max(by, y); bz = Math.max(bz, zz);
          if (C) { cr += C.getX(i); cg += C.getY(i); cb += C.getZ(i); }
        });
        const m = list.length;
        const col = C ? hex(cr / m, cg / m, cb / m) : '#' + (mat.color?.getHexString?.() ?? '??????');
        if (Number.isFinite(beyond(ax, az)) && Math.min(beyond(ax, az), beyond(bx, bz), beyond((ax + bx) / 2, (az + bz) / 2)) > 70) continue; // far scenery
        pieces.push({ x0: ax, y0: ay, z0: az, x1: bx, y1: by, z1: bz, P, col, vc: !!C, deep, mesh: o.name || '' });
      }
    }
  });
  if (window.__probeDump) { const [dx, dz, dr] = window.__probeDump; out.push({ floor: n, dump: pieces.filter((p) => Math.hypot((p.x0 + p.x1) / 2 - dx, (p.z0 + p.z1) / 2 - dz) < dr).map((p) => `${p.col} x${p.x0.toFixed(2)}..${p.x1.toFixed(2)} y${p.y0.toFixed(2)}..${p.y1.toFixed(2)} z${p.z0.toFixed(2)}..${p.z1.toFixed(2)} n${p.P.length / 3} g${groundAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2).toFixed(2)}`) }); z.dispose(); continue; }
  // --- things: pieces whose boxes touch (2 cm), by a 2 m grid
  const N = pieces.length, par = new Int32Array(N); for (let i = 0; i < N; i++) par[i] = i;
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const CS = 2, cells = new Map();
  pieces.forEach((p, i) => {
    if (p.x1 - p.x0 > 40 || p.z1 - p.z0 > 40) return; // a cliff or a road: not a thing to join through
    for (let gx = Math.floor(p.x0 / CS); gx <= Math.floor(p.x1 / CS); gx++) for (let gz = Math.floor(p.z0 / CS); gz <= Math.floor(p.z1 / CS); gz++) {
      const key = gx * 100003 + gz; let c = cells.get(key); if (!c) cells.set(key, (c = [])); c.push(i);
    }
  });
  const T = 0.02;
  for (const list of cells.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const p = pieces[list[a]], q = pieces[list[b]];
    if (p.x0 - T > q.x1 || q.x0 - T > p.x1 || p.y0 - T > q.y1 || q.y0 - T > p.y1 || p.z0 - T > q.z1 || q.z0 - T > p.z1) continue;
    const ra = find(list[a]), rb = find(list[b]); if (ra !== rb) par[ra] = rb;
  }
  const things = new Map();
  pieces.forEach((p, i) => { const r = find(i); let t = things.get(r); if (!t) things.set(r, (t = [])); t.push(p); });
  // --- the checks
  const hits = { float: [], gap: [], buried: [], cover: [] };
  const where = (x, zz) => { const b = beyond(x, zz); return Number.isNaN(b) ? '' : b < -1 ? 'in' : b < 3 ? 'edge' : 'out' + Math.round(b) + (zz > 7 ? 's' : 'n'); };
  const near = window.__probeNear;
  const keep = (x, zz) => !near || Math.hypot(x - near[0], zz - near[1]) < near[2];
  for (const list of things.values()) {
    let lo = 1e9, hi = -1e9, ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9, ay = 1e9, by = -1e9, cols = new Map();
    for (const p of list) {
      for (let i = 0; i < p.P.length; i += 3) { const c = p.P[i + 1] - groundAt(p.P[i], p.P[i + 2]); lo = Math.min(lo, c); hi = Math.max(hi, c); }
      ax = Math.min(ax, p.x0); az = Math.min(az, p.z0); bx = Math.max(bx, p.x1); bz = Math.max(bz, p.z1); ay = Math.min(ay, p.y0); by = Math.max(by, p.y1);
      cols.set(p.col, (cols.get(p.col) ?? 0) + p.P.length);
    }
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    if (!keep(cx, cz)) continue;
    const colour = [...cols.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]).join(' ');
    const rec = { x: +cx.toFixed(1), z: +cz.toFixed(1), y: +ay.toFixed(2), of: storyAt(cx, cz), w: +Math.max(bx - ax, bz - az).toFixed(2), h: +(by - ay).toFixed(2), where: where(cx, cz), colour, parts: list.length };
    if (lo > 0.05) hits.float.push({ ...rec, m: +lo.toFixed(2) });
    else if (hi < 0.005) hits.buried.push({ ...rec, m: +hi.toFixed(2) });
  }
  for (const p of pieces) {
    const w = Math.max(p.x1 - p.x0, p.z1 - p.z0);
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    if (!keep(cx, cz)) continue;
    if (w > 0.3 && w < 12) {
      // its base: the points within 3 cm of its lowest; the ground under each
      let lo = 1e9, top = -1e9, ga = 1e9, gb = -1e9;
      for (let i = 0; i < p.P.length; i += 3) { const c = p.P[i + 1] - groundAt(p.P[i], p.P[i + 2]); lo = Math.min(lo, c); }
      if (lo < 0.05) {
        let nb = 0;
        for (let i = 0; i < p.P.length; i += 3) if (p.P[i + 1] < p.y0 + 0.03) { nb++; const c = p.P[i + 1] - groundAt(p.P[i], p.P[i + 2]); top = Math.max(top, c); ga = Math.min(ga, c); }
        // a base of more than two corners (not a log on its side), resting where the ground lies under part of it and falls away elsewhere
        if (nb >= 3 && top > 0.12 && ga < 0.05) hits.gap.push({ x: +cx.toFixed(1), z: +cz.toFixed(1), y: +p.y0.toFixed(2), of: storyAt(cx, cz), w: +w.toFixed(2), h: +(p.y1 - p.y0).toFixed(2), where: where(cx, cz), colour: p.col, m: +top.toFixed(2), sunk: +ga.toFixed(2) });
      }
    }
    // through cover
    const check = p.vc && (n < 31 || n > 40 ? true : p.deep);
    if (check && w < 8) {
      for (const c of def.cover) {
        if (c.fixed) continue; // the edge walls: nothing is drawn there
        const d = segDist(cx, cz, c.ax, c.az, c.bx, c.bz) - c.r;
        if (d < -0.3) { hits.cover.push({ x: +cx.toFixed(1), z: +cz.toFixed(1), y: +p.y0.toFixed(2), of: storyAt(cx, cz), w: +w.toFixed(2), h: +(p.y1 - p.y0).toFixed(2), where: where(cx, cz), colour: p.col, m: +(-d).toFixed(2), coverR: c.r, look: c.look ?? '' }); break; }
      }
    }
  }
  z.dispose();
  const line = (h) => `${h.x},${h.z} y${h.y} ${h.of} ${h.where} w${h.w} h${h.h} m${h.m}${h.sunk !== undefined ? ' sunk' + h.sunk : ''}${h.parts ? ' p' + h.parts : ''}${h.coverR ? ' r' + h.coverR + ' ' + h.look : ''} ${h.colour}`;
  const cut = (xs) => (window.__probeAll ? xs : xs.slice(0, 40)).map(line);
  const row = { floor: n, pieces: N, things: things.size, counts: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])), float: cut(hits.float), gap: cut(hits.gap.sort((a, b) => b.m - a.m)), buried: cut(hits.buried), cover: cut(hits.cover.sort((a, b) => b.m - a.m)) };
  if (window.__probeLog) await __log(JSON.stringify(row)); // the runner prints only the start of a long result: each floor in full here
  out.push(row);
}
return out;
