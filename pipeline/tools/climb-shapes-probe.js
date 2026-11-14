// The shapes check for the Climb's props (2026-11-14, the props pass): every shape a Sands or Deep scene, or the Deep's depth, copies into
// place, looked at on its own for parts that do not meet (a jar's neck beside its body, a cushion's tassels in the air beside it). A body for
// world-shots.py on the game page (python -I pipeline/tools/world-shots.py pipeline/tools/climb-shapes-probe.js --page /game --port 5252).
// A shape is split into its pieces (triangles that share a corner), the pieces whose boxes touch (within `window.__shapeTouch` m, 4 mm)
// are joined, and a shape of more than one group is listed with each loose group: its colour, its box and how far it is from the rest.
// Also its lowest point (`low`), so a shape meant to stand on the ground that does not is seen.
const T = window.__shapeTouch ?? 0.004;
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(Math.pow(v, 1 / 2.2) * 255))).toString(16).padStart(2, '0')).join('');
const check = (name, P, C) => {
  const nv = P.length / 3, parent = new Int32Array(nv);
  for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  for (let i = 0; i < nv; i++) { const k = Math.round(P[i * 3] * 1000) + ',' + Math.round(P[i * 3 + 1] * 1000) + ',' + Math.round(P[i * 3 + 2] * 1000); const j = seen.get(k); if (j === undefined) seen.set(k, i); else join(i, j); }
  for (let t = 0; t < nv; t += 3) { join(t, t + 1); join(t + 1, t + 2); }
  const comps = new Map();
  for (let i = 0; i < nv; i++) { const r = find(i); let c = comps.get(r); if (!c) comps.set(r, (c = { b: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], c: [0, 0, 0], n: 0 })); const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; c.b[0] = Math.min(c.b[0], x); c.b[1] = Math.min(c.b[1], y); c.b[2] = Math.min(c.b[2], z); c.b[3] = Math.max(c.b[3], x); c.b[4] = Math.max(c.b[4], y); c.b[5] = Math.max(c.b[5], z); c.c[0] += C[i * 3]; c.c[1] += C[i * 3 + 1]; c.c[2] += C[i * 3 + 2]; c.n++; }
  const L = [...comps.values()], par = L.map((_, i) => i);
  const f2 = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  const gap = (a, b) => Math.max(0, a.b[0] - b.b[3], b.b[0] - a.b[3], a.b[1] - b.b[4], b.b[1] - a.b[4], a.b[2] - b.b[5], b.b[2] - a.b[5]);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (gap(L[i], L[j]) <= T) par[f2(i)] = f2(j);
  const groups = new Map();
  L.forEach((c, i) => { const r = f2(i); let g = groups.get(r); if (!g) groups.set(r, (g = [])); g.push(c); });
  let low = 1e9;
  for (let i = 1; i < P.length; i += 3) low = Math.min(low, P[i]);
  const G = [...groups.values()].map((g) => { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], c = [0, 0, 0]; let n = 0; for (const p of g) { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p.b[k]); b[k + 3] = Math.max(b[k + 3], p.b[k + 3]); c[k] += p.c[k]; } n += p.n; } return { b, col: hex(c[0] / n, c[1] / n, c[2] / n), n }; }).sort((a, b) => b.n - a.n);
  const main = G[0];
  return { name, low: +low.toFixed(3), groups: G.length, loose: G.slice(1).map((g) => `${g.col} x${g.b[0].toFixed(2)}..${g.b[3].toFixed(2)} y${g.b[1].toFixed(2)}..${g.b[4].toFixed(2)} z${g.b[2].toFixed(2)}..${g.b[5].toFixed(2)} off ${gap(g, main).toFixed(3)}`) };
};
const out = { sandsScenes: [], deepScenes: [], deepDepth: [] };
const S = (await import('/src/tower/world/scenes/sands.ts')).sandsSceneShapes();
for (const [k, p] of Object.entries(S)) out.sandsScenes.push(check(k, p.pos, p.col));
const D = (await import('/src/tower/world/scenes/deep.ts')).deepSceneShapes();
for (const [k, kit] of Object.entries(D)) {
  const parts = Object.values(kit), n = parts.reduce((s, p) => s + p.pos.length, 0), P = new Float32Array(n), C = new Float32Array(n);
  let o = 0; for (const p of parts) { P.set(p.pos, o); C.set(p.col, o); o += p.pos.length; }
  out.deepScenes.push(check(k, P, C));
}
const F = await import('/src/tower/world/floors/index.ts');
const z = F.FLOORS[31].arena.build();
let shapes = null;
z.group.traverse((o) => { if (o.userData?.shapes) shapes = o.userData.shapes; });
if (shapes) for (const [k, p] of Object.entries(shapes)) if (p?.pos) out.deepDepth.push(check(k, p.pos, p.col));
z.dispose();
const only = (xs) => xs.filter((r) => r.groups > 1 || r.low > 0.02 || r.low < -0.3);
const res = { counts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), sandsScenes: only(out.sandsScenes), deepScenes: only(out.deepScenes), deepDepth: only(out.deepDepth) };
await __log(JSON.stringify(res));
return res.counts;
