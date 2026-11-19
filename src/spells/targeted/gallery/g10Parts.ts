import * as THREE from 'three';

/**
 * Pieces of gallery group 10 (whiplash fissure, venom orchid). Everything is made in a constructor, nothing when the file is
 * loaded, and no dice are rolled: hashes of an index.
 *
 * - `Ribbon`: a flat strip along a path on the floor, its width given point by point (a crack, a lip, a tendril, a vine).
 * - `petalGeometry`, `leafGeometry`: vertex-coloured, bent orchid parts (a petal that cups and curls, a leaf with dark veins).
 * - `Puffs`: soft round points for a lingering cloud.
 */

export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** Overshoots a little, then settles (an unfurling petal). */
export const easeBack = (x: number) => { const t = clamp01(x) - 1; return 1 + t * t * (2.6 * t + 1.6); };

/** A flat strip lying on the floor, `n` points long; `path` sets the points and the half-width at each. */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  private pos: Float32Array;
  private attr: THREE.BufferAttribute;
  private geo = new THREE.BufferGeometry();

  constructor(readonly n: number, color: string, additive = false, order = 3, opacity = 1) {
    this.pos = new Float32Array(n * 6);
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** The first `m` points of (xs, zs) at height `y`, with half-widths `hs`; the strip hides when it has less than 2 or is thin. */
  path(xs: Float32Array, zs: Float32Array, hs: Float32Array, m: number, y: number) {
    let widest = 0;
    for (let i = 0; i < m; i++) widest = Math.max(widest, hs[i]);
    this.mesh.visible = m >= 2 && widest > 0.004;
    if (!this.mesh.visible) return;
    const p = this.pos;
    for (let i = 0; i < m; i++) {
      const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      let dx = xs[b] - xs[a], dz = zs[b] - zs[a];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const h = hs[i];
      p[i * 6] = xs[i] - dz * h; p[i * 6 + 1] = y; p[i * 6 + 2] = zs[i] + dx * h;
      p[i * 6 + 3] = xs[i] + dz * h; p[i * 6 + 4] = y; p[i * 6 + 5] = zs[i] - dx * h;
    }
    this.geo.setDrawRange(0, (m - 1) * 6);
    this.attr.needsUpdate = true;
  }
}

/**
 * A vertex-coloured, bent petal: its length along +x, its width along z, bending up by `bend` and cupping by `cup`.
 * Colour runs from `base` through `mid` to `tip`; the midrib is a little darker.
 */
export function petalGeometry(len: number, wid: number, bend: number, cup: number, round: number, base: string, mid: string, tip: string): THREE.BufferGeometry {
  const nu = 10, nv = 7;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const cb = new THREE.Color(base), cm = new THREE.Color(mid), ct = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(u, round)), 0.7);
    for (let j = 0; j < nv; j++) {
      const v = (j / (nv - 1)) * 2 - 1;
      pos.push(u * len, bend * u * u * len + cup * v * v * w, v * w);
      if (u < 0.45) c.copy(cb).lerp(cm, u / 0.45); else c.copy(cm).lerp(ct, (u - 0.45) / 0.55);
      c.lerp(ct, Math.pow(Math.abs(v), 3) * 0.35);
      c.multiplyScalar(1 - 0.28 * (1 - Math.abs(v)) * Math.sin(Math.PI * Math.min(1, u * 1.2)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j, b = a + 1, d = a + nv, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** A flat leaf lying on the floor (length 1 along +x, base at the origin): a green blade with a dark midrib and dark side veins. */
export function leafGeometry(wid: number, body: string, vein: string): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const cb = new THREE.Color(body), cv = new THREE.Color(vein);
  const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, c: THREE.Color, y: number) => {
    pos.push(ax, y, az, bx, y, bz, cx, y, cz);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  const half = (u: number) => wid * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8);
  const nu = 12;
  for (let i = 0; i < nu; i++) {
    const u0 = i / nu, u1 = (i + 1) / nu, h0 = half(u0), h1 = half(u1);
    tri(u0, -h0, u0, h0, u1, h1, cb, 0);
    tri(u0, -h0, u1, h1, u1, -h1, cb, 0);
  }
  const w = 0.026;
  for (let i = 0; i < nu; i++) { // the midrib, a little wider at the base
    const u0 = i / nu, u1 = (i + 1) / nu, a = w * (1.5 - u0), b = w * (1.5 - u1);
    tri(u0, -a, u0, a, u1, b, cv, 0.004);
    tri(u0, -a, u1, b, u1, -b, cv, 0.004);
  }
  for (let k = 0; k < 4; k++) { // side veins, slanting toward the tip
    const u0 = 0.16 + k * 0.17;
    for (const side of [-1, 1]) {
      const u1 = u0 + 0.2, z1 = side * half(u1) * 0.82, vw = 0.02;
      tri(u0, 0, u0 + vw, 0, u1, z1, cv, 0.004);
      tri(u0 + vw, 0, u1 + vw, z1, u1, z1, cv, 0.004);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function softTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** A lingering cloud: `n` soft round points that swell and drift from a centre, all one opacity (`opacity`). */
export class Puffs {
  readonly mesh: THREE.Points;
  private pos: Float32Array;
  private attr: THREE.BufferAttribute;
  private home: Float32Array;
  private tint: Float32Array;
  private mat: THREE.PointsMaterial;

  constructor(private n: number, size: number, a: string, b: string, order = 6) {
    this.pos = new Float32Array(n * 3);
    this.home = new Float32Array(n * 4);
    this.tint = new Float32Array(n * 3);
    const ca = new THREE.Color(a), cb = new THREE.Color(b), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const az = hash(i * 1.9 + 1) * Math.PI * 2, r = Math.sqrt(hash(i * 3.3 + 2));
      this.home[i * 4] = Math.cos(az) * r; this.home[i * 4 + 1] = Math.sin(az) * r;
      this.home[i * 4 + 2] = hash(i * 5.7 + 4); // height share
      this.home[i * 4 + 3] = 0.6 + 0.8 * hash(i * 7.1 + 6); // drift speed
      c.copy(ca).lerp(cb, hash(i * 2.3 + 9));
      this.tint[i * 3] = c.r; this.tint[i * 3 + 1] = c.g; this.tint[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    geo.setAttribute('color', new THREE.BufferAttribute(this.tint, 3));
    this.mat = new THREE.PointsMaterial({
      size, map: softTexture(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    this.mesh = new THREE.Points(geo, this.mat);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** The cloud `age` seconds after it was released at (x, z): it swells to `radius` and rises and sinks as it drifts. */
  set(x: number, z: number, age: number, radius: number, opacity: number) {
    this.mesh.visible = opacity > 0.01;
    if (!this.mesh.visible) return;
    this.mat.opacity = opacity;
    const k = 1 - Math.exp(-age * 2.4);
    for (let i = 0; i < this.n; i++) {
      const h = this.home, s = h[i * 4 + 3];
      const swirl = age * 0.35 * s;
      const cx = h[i * 4] * Math.cos(swirl) - h[i * 4 + 1] * Math.sin(swirl);
      const cz = h[i * 4] * Math.sin(swirl) + h[i * 4 + 1] * Math.cos(swirl);
      this.pos[i * 3] = x + cx * radius * k;
      this.pos[i * 3 + 1] = 0.25 + h[i * 4 + 2] * 1.5 * k + 0.1 * Math.sin(age * 1.3 * s + i);
      this.pos[i * 3 + 2] = z + cz * radius * k;
    }
    this.attr.needsUpdate = true;
  }
}
