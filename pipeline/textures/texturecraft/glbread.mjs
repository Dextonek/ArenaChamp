// Reads a GLB (meshopt-compressed or not) into { json, view(i) -> Uint8Array, accessor(i) -> typed array }.
import fs from 'node:fs';
import { MeshoptDecoder } from '../../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

export async function readGlb(path) {
  await MeshoptDecoder.ready;
  const b = fs.readFileSync(path);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binStart = 20 + jl + 8;
  const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jl));
  const cache = new Map();
  const view = (i) => {
    if (cache.has(i)) return cache.get(i);
    const bv = json.bufferViews[i];
    const ext = bv.extensions?.EXT_meshopt_compression;
    let out;
    if (ext) {
      const src = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
      out = new Uint8Array(ext.count * ext.byteStride);
      MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter);
    } else out = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0), bv.byteLength).slice();
    cache.set(i, out);
    return out;
  };
  const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const T = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const accessor = (i) => {
    const a = json.accessors[i];
    const C = T[a.componentType], n = N[a.type];
    const v = view(a.bufferView);
    const stride = json.bufferViews[a.bufferView].byteStride ?? json.bufferViews[a.bufferView].extensions?.EXT_meshopt_compression?.byteStride ?? n * C.BYTES_PER_ELEMENT;
    const out = new Float64Array(a.count * n);
    const dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) {
      let x = dv[get]((a.byteOffset ?? 0) + k * stride + j * C.BYTES_PER_ELEMENT, true);
      if (a.normalized) x = { 5120: Math.max(x / 127, -1), 5121: x / 255, 5122: Math.max(x / 32767, -1), 5123: x / 65535 }[a.componentType] ?? x;
      out[k * n + j] = x;
    }
    return out;
  };
  return { json, view, accessor, size: b.length };
}
