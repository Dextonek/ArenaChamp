// Compares two hero GLBs: the skeleton (node names, parents, rest TRS, skin joints, inverse bind matrices), the mesh
// (triangles and positions per material) and the materials' factors. Usage: node compare.mjs before.glb after.glb
import { readGlb } from './glbread.mjs';
const [A, B] = await Promise.all(process.argv.slice(2, 4).map(readGlb));
const r = (x) => (x ?? []).map((v) => +v.toFixed(5));
const nodes = (g) => {
  const par = {};
  g.json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (par[c] = n.name)));
  return Object.fromEntries(g.json.nodes.map((n, i) => [n.name, { parent: par[i], t: r(n.translation), q: r(n.rotation), s: r(n.scale), mesh: n.mesh !== undefined }]));
};
const na = nodes(A), nb = nodes(B);
let bad = 0;
for (const k of new Set([...Object.keys(na), ...Object.keys(nb)])) {
  if (JSON.stringify(na[k]) !== JSON.stringify(nb[k])) { if (bad++ < 12) console.log('node differs', k, JSON.stringify(na[k]), JSON.stringify(nb[k])); }
}
console.log('nodes', Object.keys(na).length, Object.keys(nb).length, 'differing', bad);
const joints = (g) => g.json.skins[0].joints.map((j) => g.json.nodes[j].name);
const ja = joints(A), jb = joints(B);
console.log('joints', ja.length, jb.length, 'same order', JSON.stringify(ja) === JSON.stringify(jb));
const ia = A.accessor(A.json.skins[0].inverseBindMatrices), ib = B.accessor(B.json.skins[0].inverseBindMatrices);
let md = 0;
ja.forEach((name, i) => { const k = jb.indexOf(name); for (let e = 0; e < 16; e++) md = Math.max(md, Math.abs(ia[i * 16 + e] - ib[k * 16 + e])); });
console.log('inverse bind matrices max diff', md.toExponential(2));
const prims = (g) => Object.fromEntries(g.json.meshes.flatMap((m) => m.primitives).map((p) => {
  const pos = g.accessor(p.attributes.POSITION), idx = g.accessor(p.indices);
  // triangle centroids, sorted, as a signature that ignores vertex order and splits
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) { let s = [0, 0, 0]; for (let c = 0; c < 3; c++) for (let d = 0; d < 3; d++) s[d] += pos[idx[t + c] * 3 + d] / 3; tris.push(s.map((v) => v.toFixed(4)).join(',')); }
  tris.sort();
  const cent = [];
  for (let t = 0; t < idx.length; t += 3) { const s = [0, 0, 0]; for (let c = 0; c < 3; c++) for (let d = 0; d < 3; d++) s[d] += pos[idx[t + c] * 3 + d] / 3; cent.push(s); }
  return [g.json.materials[p.material].name, { verts: pos.length / 3, tris: idx.length / 3, sig: tris, cent, attrs: Object.keys(p.attributes).join(',') }];
}));
const pa = prims(A), pb = prims(B);
for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
  const a = pa[k], b = pb[k];
  if (!a || !b) { console.log('material only in one', k); continue; }
  let same = 0; const sb = new Set(b.sig); for (const s of a.sig) if (sb.has(s)) same++;
  // the farthest any triangle of `a` is from its nearest triangle of `b` (centroids, metres): 4-decimal rounding can
  // put a triangle that did not move on the other side of a rounding step
  let far = 0;
  if (same < a.tris) for (const c of a.cent) { let best = Infinity; for (const d of b.cent) best = Math.min(best, Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2])); far = Math.max(far, best); }
  console.log(`${k.padEnd(22)} tris ${a.tris} -> ${b.tris}, verts ${a.verts} -> ${b.verts}, triangles in place ${same}/${a.tris}${same < a.tris ? `, farthest ${far.toExponential(1)} m` : ''}  [${b.attrs}]`);
}
const mats = (g) => Object.fromEntries(g.json.materials.map((m) => [m.name, JSON.stringify({ ...m, pbrMetallicRoughness: { ...m.pbrMetallicRoughness, baseColorTexture: m.pbrMetallicRoughness?.baseColorTexture ? 'tex' : undefined, metallicRoughnessTexture: m.pbrMetallicRoughness?.metallicRoughnessTexture ? 'tex' : undefined } })]));
const ma = mats(A), mb = mats(B);
for (const k of Object.keys(ma)) if (ma[k] !== mb[k]) console.log('material', k, '\n  before', ma[k], '\n  after ', mb[k]);
console.log('size', A.size, '->', B.size, 'bytes; images', (A.json.images ?? []).map((i) => A.json.bufferViews[i.bufferView].byteLength), '->', (B.json.images ?? []).map((i) => B.json.bufferViews[i.bufferView].byteLength));
