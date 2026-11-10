// Packs the clips the game uses from Quaternius' Universal Animation Library (CC0) into one small animation-only GLB:
// the skeleton's nodes and the chosen clips, no mesh, no skin, no materials. Per clip it keeps every bone's rotation and
// the pelvis' position (the body's bob and sway), and drops the rest: scale, and the other bones' positions, which would
// pull a hero with its own proportions back to the pack's mannequin. Rotations are stored as normalized 16-bit numbers.
//
//   node pipeline/tools/strip-anim.mjs <out.glb> <in1.glb> <clip,clip,...> [<in2.glb> <clip,...> ...]
//
// All inputs must share the skeleton (the first input's nodes are written). Read by src/motion/real.ts.
import fs from 'node:fs';

const [out, ...rest] = process.argv.slice(2);
const read = (p) => {
  const b = fs.readFileSync(p);
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + len).toString());
  const bin = b.subarray(20 + len + 8, 20 + len + 8 + b.readUInt32LE(20 + len));
  return { json, bin };
};
const floats = (g, i) => {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  if (a.componentType !== 5126 || bv.byteStride) throw new Error('unexpected accessor layout');
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Float32Array(g.bin.buffer.slice(g.bin.byteOffset + off, g.bin.byteOffset + off + a.count * n * 4));
};

const chunks = [];
let size = 0;
const views = [], accessors = [], animations = [];
const push = (typed, type, extra = {}) => {
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (size % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
  views.push({ buffer: 0, byteOffset: size, byteLength: bytes.length });
  chunks.push(bytes);
  size += bytes.length;
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  accessors.push({ bufferView: views.length - 1, componentType: typed instanceof Int16Array ? 5122 : 5126, count: typed.length / n, type, ...extra });
  return accessors.length - 1;
};

let nodes = null, names = null, sceneNodes = null;
const report = [];
for (let k = 0; k < rest.length; k += 2) {
  const g = read(rest[k]);
  const want = rest[k + 1].split(',');
  // the skeleton only: every node that is not a mesh, renumbered
  const keep = g.json.nodes.map((n) => n.mesh === undefined);
  const renum = [];
  let c = 0;
  keep.forEach((x, i) => { renum[i] = x ? c++ : -1; });
  const stripped = g.json.nodes.filter((_, i) => keep[i]).map((n) => {
    const { skin, mesh, children, ...o } = n;
    const ch = (children ?? []).filter((i) => keep[i]).map((i) => renum[i]);
    return ch.length ? { ...o, children: ch } : o;
  });
  if (!nodes) {
    nodes = stripped;
    names = nodes.map((n) => n.name);
    sceneNodes = g.json.scenes[g.json.scene ?? 0].nodes.filter((i) => keep[i]).map((i) => renum[i]);
  }
  const index = new Map(names.map((n, i) => [n, i]));
  const times = new Map();
  for (const name of want) {
    const a = g.json.animations.find((x) => x.name === name);
    if (!a) throw new Error(`no clip ${name} in ${rest[k]}`);
    const samplers = [], channels = [];
    for (const ch of a.channels) {
      const bone = g.json.nodes[ch.target.node].name, path = ch.target.path;
      if (!index.has(bone)) throw new Error(`bone ${bone} is not in the first skeleton`);
      if (path === 'scale' || (path === 'translation' && bone !== 'pelvis')) continue;
      const s = a.samplers[ch.sampler];
      const tKey = `${rest[k]}:${s.input}`;
      if (!times.has(tKey)) {
        const t = floats(g, s.input);
        times.set(tKey, push(t, 'SCALAR', { min: [t[0]], max: [t[t.length - 1]] }));
      }
      const v = floats(g, s.output);
      let acc;
      if (path === 'rotation') {
        const q = new Int16Array(v.length);
        for (let i = 0; i < v.length; i++) q[i] = Math.max(-32767, Math.min(32767, Math.round(v[i] * 32767)));
        acc = push(q, 'VEC4', { normalized: true });
      } else acc = push(v, 'VEC3');
      samplers.push({ input: times.get(tKey), output: acc, interpolation: s.interpolation ?? 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: index.get(bone), path } });
    }
    animations.push({ name, samplers, channels });
    report.push(`${name} ${g.json.accessors[a.samplers[0].input].max[0].toFixed(2)}s`);
  }
}
const pad = (4 - (size % 4)) % 4;
if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
const json = {
  asset: { version: '2.0', generator: 'strip-anim.mjs', copyright: 'Universal Animation Library 1 and 2 by Quaternius (CC0)' },
  scene: 0, scenes: [{ nodes: sceneNodes }], nodes, animations, accessors, bufferViews: views, buffers: [{ byteLength: size }],
};
let jb = Buffer.from(JSON.stringify(json));
if (jb.length % 4) jb = Buffer.concat([jb, Buffer.alloc(4 - (jb.length % 4), 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + size, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(size, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(out, Buffer.concat([head, jh, jb, bh, ...chunks]));
console.log(`${animations.length} clips, ${nodes.length} nodes, ${Math.round(fs.statSync(out).size / 1024)} KB -> ${out}`);
console.log(report.join(', '));
