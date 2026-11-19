import * as THREE from 'three';
import { clamp01, hash, smooth } from '../../../heroes/sheath/partsBig';

/**
 * Pieces of gallery group 4 (pipeline/designs/gallery-20.md): the Celtic knot's band and the watercolour's floor and daubs.
 * Everything is made in a constructor, nothing at load; no dice (a hash of an index); the per-frame work writes into buffers
 * made once.
 */

const TAU = Math.PI * 2;
export type RGB = readonly [number, number, number];

/** A css hex as r, g, b in 0..1 (no three.js object). */
export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------------------
// The knot (Celtic knot snare).
// ---------------------------------------------------------------------------------------------------------------

const KN = 360; // segments along the band
const KM = 12; // sides of the band
const LOBES = 5;

/**
 * One closed band drawn as a pentafoil, a (2, 5) torus knot seen from above: it winds twice round the centre and has five
 * lobes, so it crosses itself five times, always over then under (the strand at the crossing is at the top of its rise, its
 * partner at the bottom). It is one stroke, so `reveal` runs along it like a pen (`start` rubs it out from the front again).
 * `e` (0..1) morphs it from the knot on the floor into a coil that rises round `(vx, vz)`: the same band, the same crossings
 * of its lobes, wound upward round a body. Colour is per vertex: dark bronze to bronze by the light on the side, a silver
 * inlay along the top, the strand that goes under darkened at the crossing, moss-green light (`arm`, a travelling `pulse`,
 * `flare`) over it.
 */
export class KnotBand {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  cx = 0;
  cz = 0;
  vx = 0;
  vz = 0;
  /** Morph to the coil, a little over 1 for the snap. */
  e = 0;
  reveal = 0;
  start = 0;
  opacity = 1;
  /** The armed glow, the travelling pulse (0..1 along the band, -1 none), a flare over the whole coil. */
  arm = 0;
  pulse = -1;
  flare = 0;
  /** Where the coil ends: its radius and rise (an empty snare closes small). */
  coilR = 0.5;
  coilH = 1.55;
  readonly radius: number;
  private pos = new Float32Array((KN + 1) * 3);
  private posA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private bronzeD: RGB;
  private bronze: RGB;
  private silver: RGB;
  private moss: RGB;
  private dark: RGB;
  private hot: RGB;

  constructor(radius: number, colors: { bronzeD: string; bronze: string; silver: string; moss: string; dark: string; hot: string }) {
    this.radius = radius;
    const lin = (h: string): RGB => rgb(h).map((x) => Math.pow(x, 2.2)) as unknown as RGB; // vertex colours are linear
    this.bronzeD = lin(colors.bronzeD);
    this.bronze = lin(colors.bronze);
    this.silver = lin(colors.silver);
    this.moss = lin(colors.moss);
    this.dark = lin(colors.dark);
    this.hot = lin(colors.hot);
    const V = (KN + 1) * KM;
    this.posA = new THREE.BufferAttribute(new Float32Array(V * 3), 3);
    this.colA = new THREE.BufferAttribute(new Float32Array(V * 3), 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.colA.setUsage(THREE.DynamicDrawUsage);
    const idx = new Uint16Array(KN * KM * 6);
    let n = 0;
    for (let i = 0; i < KN; i++) {
      for (let j = 0; j < KM; j++) {
        const a = i * KM + j, b = i * KM + (j + 1) % KM, c = (i + 1) * KM + j, d = (i + 1) * KM + (j + 1) % KM;
        idx[n++] = a; idx[n++] = c; idx[n++] = b;
        idx[n++] = b; idx[n++] = c; idx[n++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.posA);
    g.setAttribute('color', this.colA);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** The band's centreline at `u` (0..1) into the position buffer slot `i`. */
  private point(i: number, u: number) {
    const k = u * TAU, e = this.e;
    const lobe = Math.cos(LOBES * k), over = Math.sin(LOBES * k);
    const rK = this.radius + 0.42 * lobe, yK = 0.2 + 0.1 * over;
    const rC = this.coilR + 0.07 * lobe * (this.coilR > 0.3 ? 1 : 0.4), yC = 0.12 + this.coilH * u + 0.06 * over;
    const r = rK + (rC - rK) * e, y = yK + (yC - yK) * e;
    const ang = 2 * k + 0.35 + 0.5 * e;
    const x = this.cx + (this.vx - this.cx) * e + r * Math.cos(ang);
    const z = this.cz + (this.vz - this.cz) * e + r * Math.sin(ang);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
  }

  /** Rebuild the band for the fields set now. */
  build() {
    const visible = this.opacity > 0.01 && this.reveal > 0.002 && this.start < this.reveal - 0.002;
    this.mesh.visible = visible;
    if (!visible) return;
    const e = this.e, p = this.pos, pc = this.posA.array as Float32Array, cc = this.colA.array as Float32Array;
    const eC = clamp01(e);
    const w = mix(0.11, 0.085, eC), th = mix(0.075, 0.07, eC);
    for (let i = 0; i <= KN; i++) this.point(i, i / KN);
    const bd = this.bronzeD, br = this.bronze, sv = this.silver, ms = this.moss, dk = this.dark, ht = this.hot;
    for (let i = 0; i <= KN; i++) {
      const a = Math.max(0, i - 1) * 3, b = Math.min(KN, i + 1) * 3;
      let tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], tz = p[b + 2] - p[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      let sx = tz, sz = -tx;
      const sl = Math.hypot(sx, sz);
      if (sl < 1e-4) { sx = 1; sz = 0; } else { sx /= sl; sz /= sl; }
      // N = T x S, S = (sx, 0, sz)
      const nx = ty * sz, ny = tz * sx - tx * sz, nz = -ty * sx;
      const u = i / KN, k = u * TAU;
      const under = smooth((-Math.sin(LOBES * k) - 0.5) / 0.4) * (1 - eC) * 0.8;
      // moss light: the armed glow, the pulse that runs along the band, the flare of the coil
      let d = 0;
      if (this.pulse >= 0) {
        for (let q = 0; q < 2; q++) {
          let dd = Math.abs(u - ((this.pulse + q * 0.5) % 1));
          dd = Math.min(dd, 1 - dd);
          d = Math.max(d, Math.exp(-(dd * dd) / 0.0016));
        }
      }
      const glow = clamp01(this.arm * 0.3 + d * 0.8 + this.flare * (0.45 + 0.4 * Math.sin(u * 40 - this.flare * 9)));
      for (let j = 0; j < KM; j++) {
        const phi = (j / KM) * TAU, cs = Math.cos(phi), sn = Math.sin(phi);
        const o = (i * KM + j) * 3;
        pc[o] = p[i * 3] + sx * cs * w + nx * sn * th;
        pc[o + 1] = p[i * 3 + 1] + ny * sn * th;
        pc[o + 2] = p[i * 3 + 2] + sz * cs * w + nz * sn * th;
        const lit = 0.5 + 0.5 * (ny * sn);
        const inlay = smooth((ny * sn - 0.8) / 0.18) * 0.7;
        let r = mix(bd[0], br[0], lit), g = mix(bd[1], br[1], lit), bl = mix(bd[2], br[2], lit);
        r = mix(r, sv[0], inlay); g = mix(g, sv[1], inlay); bl = mix(bl, sv[2], inlay);
        r = mix(r, dk[0], under); g = mix(g, dk[1], under); bl = mix(bl, dk[2], under);
        r = mix(r, ms[0], glow * 0.85); g = mix(g, ms[1], glow * 0.85); bl = mix(bl, ms[2], glow * 0.85);
        const core = d * d * (1 - under) * inlay * 1.2;
        cc[o] = mix(r, ht[0], core); cc[o + 1] = mix(g, ht[1], core); cc[o + 2] = mix(bl, ht[2], core);
      }
    }
    this.posA.needsUpdate = this.colA.needsUpdate = true;
    this.material.opacity = this.opacity;
    const s = Math.floor(this.start * KN), f = Math.min(KN, Math.ceil(this.reveal * KN));
    this.mesh.geometry.setDrawRange(s * KM * 6, Math.max(0, f - s) * KM * 6);
  }

  /** Where the pen is (reveal's end) at the floor knot, for the pen's light. */
  tip(out: THREE.Vector3) {
    this.point(0, clamp01(this.reveal));
    out.set(this.pos[0], this.pos[1] + 0.1, this.pos[2]);
    return out;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The watercolour floor and its daubs (Watercolour vortex).
// ---------------------------------------------------------------------------------------------------------------

const FLOOR_VERT = `
varying vec2 vP;
uniform float uRadius;
void main() {
  vP = position.xz / uRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FLOOR_FRAG = `
precision highp float;
varying vec2 vP;
uniform float uSwirl, uBuild, uBloom, uDry, uAlpha, uCore, uBeat;
uniform vec3 uDark, uAccent, uFoil, uHot;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
vec4 over(vec4 top, vec4 bot) {
  float a = top.a + bot.a * (1.0 - top.a);
  return vec4((top.rgb * top.a + bot.rgb * bot.a * (1.0 - top.a)) / max(a, 1e-4), a);
}
void main() {
  vec2 p = vP;
  float r = length(p);
  float a = atan(p.y, p.x);
  float n1 = fbm(p * 2.3 + 3.1);
  float n2 = fbm(p * 7.0 + 1.3);
  float n3 = fbm(p * 15.0);
  // the wet edge: noisy, soft, and a pooled rim where the pigment dries darker
  float edge = r + (n1 - 0.5) * 0.30;
  float cover = 1.0 - smoothstep(0.90, 1.0, edge);
  float rim = smoothstep(0.78, 0.92, edge) * (1.0 - smoothstep(0.95, 1.0, edge));
  // the wash is laid from the rim inward
  float thr = 1.12 - uBuild * 1.30;
  float rev = smoothstep(thr - 0.10, thr + 0.10, edge);
  // arms of pigment in a log spiral; the bloom lets them bleed together
  float diff = smoothstep(0.0, 0.7, uBloom);
  float ang = a + 2.2 * log(r + 0.07) - uSwirl + (n1 - 0.5) * 1.3;
  float arms = 0.5 + 0.5 * cos(3.0 * ang + (n2 - 0.5) * 2.5);
  arms = mix(arms, 0.5, diff * 0.8);
  float core = 1.0 - smoothstep(0.0, 0.9, r);
  vec3 col = uFoil;
  col = mix(col, uAccent, smoothstep(0.18, 0.60, arms) * 0.92);
  col = mix(col, uDark, smoothstep(0.58, 0.92, arms) * (0.55 + 0.45 * core));
  col = mix(col, uDark, (1.0 - smoothstep(0.0, 0.24, r)) * 0.65 * (1.0 - diff));
  col *= 0.90 + 0.22 * n3;
  col = mix(col, uDark * 0.75, rim * 0.6);
  col = mix(col, uFoil, uBeat * 0.12 * (1.0 - rim));
  float alpha = cover * rev * (0.50 + 0.42 * smoothstep(0.10, 0.60, arms));
  alpha = max(alpha, rim * cover * rev * 0.92);
  vec4 o = vec4(col, alpha);
  // the bloom: a front of wet pigment with a cauliflower edge, darker on its outside, a pale wash behind it
  float rb = uBloom * 1.02;
  float redge = r + (fbm(p * 5.0 + 7.0) - 0.5) * 0.30 + (n2 - 0.5) * 0.10;
  float bw = 0.20 * (1.0 - 0.5 * uBloom) + 0.03;
  float on = step(0.001, uBloom);
  float lead = smoothstep(-bw, bw, redge - rb);
  float ring = (1.0 - smoothstep(bw * 0.4, bw, abs(redge - rb))) * on;
  vec4 wash = vec4(mix(uFoil, uAccent, smoothstep(0.35, 0.8, n1) * 0.55), (1.0 - smoothstep(rb - 0.03, rb + 0.03, redge)) * 0.42 * on * cover);
  o = over(wash, o);
  vec4 bl = vec4(mix(uAccent, uDark, smoothstep(0.5, 1.0, lead)), ring * 0.92);
  o = over(bl, o);
  // dried: tide-mark rings where each wave of the wash stopped
  float lines = abs(fract(edge * 4.0 + 0.1) - 0.5);
  float tl = smoothstep(0.45, 0.5, lines) * uDry * cover * 0.65;
  o = over(vec4(mix(uAccent, uDark, 0.55), tl), o);
  // the hot spot, kept small
  float hot = (1.0 - smoothstep(0.0, 0.13, r)) * uCore;
  o = over(vec4(uHot, hot), o);
  o.a *= uAlpha;
  gl_FragColor = o;
}`;

/** The whirlpool and its bloom: one soft-edged wash on the floor, drawn by a shader (`uniforms` are the look's dials). */
export class WaterFloor {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(radius: number, colors: { dark: string; accent: string; foil: string; hot: string }) {
    const c = (h: string) => new THREE.Color(h);
    this.material = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uRadius: { value: radius },
        uSwirl: { value: 0 }, uBuild: { value: 0 }, uBloom: { value: 0 }, uDry: { value: 0 },
        uAlpha: { value: 0 }, uCore: { value: 0 }, uBeat: { value: 0 },
        uDark: { value: c(colors.dark) }, uAccent: { value: c(colors.accent) }, uFoil: { value: c(colors.foil) }, uHot: { value: c(colors.hot) },
      },
    });
    const size = radius * 2.7;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), this.material);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(swirl: number, build: number, bloom: number, dry: number, alpha: number, core: number, beat: number) {
    const u = this.material.uniforms;
    u.uSwirl.value = swirl; u.uBuild.value = build; u.uBloom.value = bloom; u.uDry.value = dry;
    u.uAlpha.value = alpha; u.uCore.value = core; u.uBeat.value = beat;
    this.mesh.visible = alpha > 0.004;
  }
}

/**
 * Daubs of pigment: small flat blobs on the floor that ride the whirlpool (an inward spiral that speeds up), are sucked to the
 * middle at the pull, and are thrown out with the bloom, then shrink away. Hash-placed, one instanced mesh, no allocation.
 */
export class Daubs {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(private n: number, private radius: number, colors: { dark: string; accent: string; foil: string }) {
    const geo = new THREE.CircleGeometry(0.26, 9).rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }), n);
    const pick = [colors.dark, colors.accent, colors.accent, colors.dark];
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.col.set(pick[i % 4]));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  hide() {
    this.mesh.count = 0;
  }

  /**
   * `t` seconds since play; the beats: `pullT` (the pull), `bloomT` (the bloom starts), `endT` (all gone); `swirl` the floor's
   * turn; (cx, cz) the centre.
   */
  update(t: number, swirl: number, pullT: number, bloomT: number, endT: number, cx: number, cz: number) {
    const R = this.radius;
    this.mesh.count = this.n;
    for (let i = 0; i < this.n; i++) {
      const born = 0.05 + 0.9 * hash(i * 1.7 + 1);
      const grow = smooth((t - born) / 0.35);
      const r0 = R * (0.35 + 0.65 * Math.sqrt(hash(i * 2.3 + 2)));
      const r1 = R * (0.25 + 0.75 * hash(i * 3.1 + 3)) * 0.98;
      let rho = r0 * (1 - 0.5 * smooth(t / 1.5));
      if (t > pullT) rho = mix(rho, R * 0.07, smooth((t - pullT) / 0.22));
      if (t > bloomT) rho = mix(R * 0.07, r1, 1 - Math.pow(1 - clamp01((t - bloomT) / 0.7), 3));
      const spin = swirl * (0.6 + 0.9 * (1 - rho / R));
      const th = hash(i * 4.7 + 4) * 6.2832 + spin;
      const shrink = 1 - smooth((t - (endT - 0.6)) / 0.5);
      const size = (0.4 + 0.7 * hash(i * 5.9 + 5)) * grow * shrink * (t > bloomT ? 1.0 : 1) * (t > bloomT ? 1 - smooth((t - bloomT) / 0.9) : 1);
      const stretch = 1 + 1.6 * (1 - smooth((t - pullT) / 0.3)) * smooth(t / 1.2) * (t < bloomT ? 1 : 0);
      this.p.set(cx + Math.cos(th) * rho, 0.07 + 0.05 * hash(i * 6.1 + 6) + 0.2 * (1 - rho / R) * smooth(t / 1.4) * (t < bloomT ? 1 : 0), cz + Math.sin(th) * rho);
      this.e.set(0, -th - 1.5708, 0);
      this.q.setFromEuler(this.e);
      this.s.set(Math.max(1e-3, size * stretch), Math.max(1e-3, size), Math.max(1e-3, size * 0.7));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
