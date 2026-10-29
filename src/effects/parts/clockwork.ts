import * as THREE from 'three';
import { defaultLook, type MinionLook, type MinionPalette, type MinionRig } from './minion';
import type { SummonKind } from '../summon';

/**
 * The clockwork kit (pipeline/designs/kit-clockwork.md): machined copper and brass. Toothed gears that spin, mesh,
 * assemble in clicks and scatter into loose cogs; coiled springs that compress and release; cyan electric zigzag
 * sparks; small white steam puffs with eroding edges; a chain of links; a copper rivet; and the brass turret look for
 * summons. Metal is toon-lit (3 flat bands, no gloss), sparks are thin unlit cyan threads, steam is small toon wisps.
 * Everything is pooled, takes world-space positions and has `reset()`. Materials stay below the bloom threshold.
 */

/** Palette. Numbers for `THREE.Color`, `CLOCKWORK_CSS` for APIs that want a string. `foil` (steel) is the pale foil. */
export const CLOCKWORK = {
  core: 0xffffff,
  hot: 0xffd08a,
  body: 0xd9773a,
  accent: 0x6affea,
  dark: 0x1a0f08,
  foil: 0xd8dde2,
} as const;

export const CLOCKWORK_CSS = {
  core: '#ffffff',
  hot: '#ffd08a',
  body: '#d9773a',
  accent: '#6affea',
  dark: '#1a0f08',
  foil: '#d8dde2',
} as const;

const BRASS = 0xd9a655;
const STEEL = 0x9aa3ac;
const rawColor = (hex: number) => new THREE.Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace);
const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 3);
const backOut = (x: number) => { const t = clamp01(x) - 1; return 1 + 2.2 * t * t * t + 1.2 * t * t; };
const hash = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// Toon metal materials
// ---------------------------------------------------------------------------------------------------------------

const TOON_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vP; varying vec3 vNo;
  void main() {
    vec4 lp = vec4(position, 1.0);
    vec3 ln = normal;
    #ifdef USE_INSTANCING
      lp = instanceMatrix * lp;
      ln = mat3(instanceMatrix) * ln;
    #endif
    vP = position; vNo = normal;
    vN = normalize(normalMatrix * ln);
    gl_Position = projectionMatrix * modelViewMatrix * lp;
  }`;

const TOON_BAND = /* glsl */ `
  float band(vec3 n) {
    float nl = dot(normalize(n), normalize(vec3(-0.35, 0.8, 0.5)));
    return nl > 0.3 ? 1.0 : (nl > -0.2 ? 0.8 : 0.6);
  }`;

/** A single-colour toon metal (three flat light bands). */
function toonMetal(color: number, raw = false) {
  // `raw`: write the hex digits as the displayed colour (no sRGB-to-linear step), for steel that must not wash out.
  const col = raw ? new THREE.Color().setRGB(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, THREE.LinearSRGBColorSpace) : new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col } },
    vertexShader: TOON_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vN; varying vec3 vP; varying vec3 vNo;
      ${TOON_BAND}
      void main() { gl_FragColor = vec4(uColor * band(vN), 1.0); }`,
  });
}

let gearMat: THREE.ShaderMaterial | undefined;
/**
 * Gear metal with three value steps (lit / shade / dark): copper body #b8662e -> #6e3416, steel teeth #8a929a -> #4a5258,
 * dark iron hub #2a1a10. Colours are the on-screen targets (converted to linear, the frame is sRGB-encoded afterwards),
 * with a gain below 1 so bloom never pushes them to white.
 */
function gearMaterial() {
  gearMat ??= new THREE.ShaderMaterial({
    uniforms: {
      uCopperLit: { value: new THREE.Color(0xb8662e) }, uCopperShade: { value: new THREE.Color(0x6e3416) },
      uSteelLit: { value: new THREE.Color(0x8a929a) }, uSteelShade: { value: new THREE.Color(0x4a5258) },
      uHub: { value: new THREE.Color(0x2a1a10) },
    },
    vertexShader: TOON_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uCopperLit, uCopperShade, uSteelLit, uSteelShade, uHub; varying vec3 vN; varying vec3 vP; varying vec3 vNo;
      void main() {
        float nl = dot(normalize(vN), normalize(vec3(-0.35, 0.8, 0.5)));
        float t = nl > 0.3 ? 1.0 : (nl > -0.2 ? 0.45 : 0.0);
        float r = length(vP.xy);
        vec3 copper = mix(uCopperShade, uCopperLit, t);
        vec3 steel = mix(uSteelShade, uSteelLit, t);
        vec3 base = copper;
        base = mix(base, uHub, 1.0 - step(0.26, r));
        base = mix(base, steel, step(0.26, r) * (1.0 - step(0.33, r)) * 0.8);
        base = mix(base, steel, step(0.84, r));
        if (abs(vNo.z) < 0.5) base = uSteelShade;
        gl_FragColor = vec4(base * 0.85, 1.0);
      }`,
  });
  return gearMat;
}

// ---------------------------------------------------------------------------------------------------------------
// Gear geometry
// ---------------------------------------------------------------------------------------------------------------

const gearGeos = new Map<string, THREE.BufferGeometry>();

/**
 * A toothed gear in the XY plane, outer radius 1 (tooth tips; roots at 0.8), thickness 1 along Z centred on 0. Chunky
 * trapezoid teeth. `spokes` > 0 cuts that many windows between copper spokes around a solid hub; `hole` > 0 makes a ring
 * gear instead (a round hole of that radius, no hub). Cached per argument set; scale it (r, r, thickness).
 */
export function gearGeometry(teeth: number, spokes = 5, hole = 0): THREE.BufferGeometry {
  const key = `${teeth}:${spokes}:${hole}`;
  const cached = gearGeos.get(key);
  if (cached) return cached;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  let first = true;
  for (let i = 0; i < teeth; i++) {
    for (const [da, r] of [[-0.36, 0.8], [-0.19, 1], [0.19, 1], [0.36, 0.8]]) {
      const a = (i + da) * step;
      if (first) { shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); first = false; }
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  shape.closePath();
  if (hole > 0) {
    const p = new THREE.Path();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      if (i === 0) p.moveTo(Math.cos(a) * hole, Math.sin(a) * hole); else p.lineTo(Math.cos(a) * hole, Math.sin(a) * hole);
    }
    p.closePath();
    shape.holes.push(p);
  } else if (spokes > 0) {
    const per = (Math.PI * 2) / spokes, span = per * 0.6;
    for (let s = 0; s < spokes; s++) {
      const a0 = s * per + (per - span) / 2, p = new THREE.Path();
      const N = 5;
      for (let i = 0; i <= N; i++) { const a = a0 + (i / N) * span; if (i === 0) p.moveTo(Math.cos(a) * 0.7, Math.sin(a) * 0.7); else p.lineTo(Math.cos(a) * 0.7, Math.sin(a) * 0.7); }
      for (let i = N; i >= 0; i--) { const a = a0 + span * 0.92 * (i / N) + span * 0.04; p.lineTo(Math.cos(a) * 0.4, Math.sin(a) * 0.4); }
      p.closePath();
      shape.holes.push(p);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.92, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.04, bevelOffset: -0.02, bevelSegments: 1, curveSegments: 1 });
  geo.translate(0, 0, -0.5);
  gearGeos.set(key, geo);
  return geo;
}

/** A sensible tooth count for a gear of this radius (chunky teeth, never fewer than 8). */
export function teethFor(radius: number) {
  return Math.round(THREE.MathUtils.clamp(radius * 7, 8, 24));
}

// ---------------------------------------------------------------------------------------------------------------
// Gear
// ---------------------------------------------------------------------------------------------------------------

type GearMode = 'wait' | 'fly' | 'idle' | 'fold' | 'loose';

interface GearItem {
  live: boolean;
  mode: GearMode;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  from: THREE.Vector3;
  hasFrom: boolean;
  normal: THREE.Vector3;
  radius: number;
  thick: number;
  angle: number;
  rate: number;
  kickRem: number;
  age: number;
  dur: number;
  click: number;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  tumble: number;
  life: number;
  quat: THREE.Quaternion;
}

export interface GearOptions {
  teeth?: number;
  spokes?: number;
  /** A ring gear: a round hole of this radius (fraction of the outer radius). */
  hole?: number;
  /** Thickness (default max(0.1, radius * 0.16)). */
  thick?: number;
  /** Where it flies in from on `assemble()` (e.g. her backpack); without it the gear unfolds in place. */
  from?: THREE.Vector3;
  /** Seated at once, no assembly. */
  instant?: boolean;
}

/**
 * Pooled toothed gears (copper body, steel tooth edges, dark iron hub, toon-lit). `place(pos, normal, radius, spin, opts)`
 * puts one (spin = rotation speed in rad/s; `normal` is the way its face looks) and returns its index; a placed gear waits
 * hidden until `assemble(seconds)` flies it in from `opts.from` (or unfolds it in place), one after another, each
 * ending in a click (`onClick` fires; the last one lands at `seconds`). `move`, `setRate`, `kick` (a quick notch of rotation) and `hide` drive a seated gear, `fold(seconds)`
 * shrinks them all away, `scatter(speed, life)` flings every seated gear off as a loose cog that tumbles, bounces and
 * shrinks away. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Gear {
  readonly mesh = new THREE.Group();
  frozen = false;
  gravity = 14;
  /** Called when a gear clicks into place. */
  onClick: ((pos: THREE.Vector3, index: number) => void) | null = null;
  private items: GearItem[] = [];
  private cursor = 0;
  private qN = new THREE.Quaternion();
  private qS = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(max = 12) {
    const mat = gearMaterial();
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(gearGeometry(8, 0, 0), mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.mesh.add(mesh);
      this.items.push({
        live: false, mode: 'idle', mesh, pos: new THREE.Vector3(), from: new THREE.Vector3(), hasFrom: false, normal: new THREE.Vector3(0, 1, 0),
        radius: 1, thick: 0.2, angle: 0, rate: 0, kickRem: 0, age: 0, dur: 1, click: 0, vel: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0),
        tumble: 0, life: 1, quat: new THREE.Quaternion(),
      });
    }
  }

  /** True while any gear is still shown or waiting. */
  get busy() {
    return this.items.some((g) => g.live);
  }

  place(pos: THREE.Vector3, normal: THREE.Vector3, radius: number, spin = 0, o: GearOptions = {}) {
    let idx = this.items.findIndex((g) => !g.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.items.length; }
    const g = this.items[idx];
    g.live = true;
    g.mesh.geometry = gearGeometry(o.teeth ?? teethFor(radius), o.spokes ?? 5, o.hole ?? 0);
    g.pos.copy(pos);
    g.normal.copy(normal).normalize();
    g.radius = Math.max(radius, MIN_SCALE);
    g.thick = o.thick ?? Math.max(0.1, radius * 0.16);
    g.angle = Math.random() * 6.28;
    g.rate = spin;
    g.kickRem = 0;
    g.click = 0;
    g.age = 0;
    g.hasFrom = !!o.from;
    if (o.from) g.from.copy(o.from);
    g.mode = o.instant ? 'idle' : 'wait';
    g.mesh.visible = !!o.instant;
    return idx;
  }

  /** Flies in (or unfolds) every waiting gear over `seconds`, one after another, each ending in a click. */
  assemble(seconds: number) {
    const waiting = this.items.filter((g) => g.live && g.mode === 'wait');
    // Each flight takes about two thirds of `seconds`; they start one after another so the last click lands at `seconds`.
    const n = waiting.length;
    const dur = Math.max(n > 1 ? seconds * 0.65 : seconds, 0.12);
    const gap = n > 1 ? Math.max(seconds - dur, 0) / (n - 1) : 0;
    waiting.forEach((g, i) => {
      g.mode = 'fly';
      g.age = -i * gap;
      g.dur = dur;
    });
  }

  /** Moves a seated gear (and turns its face to `normal` when given). */
  move(i: number, pos: THREE.Vector3, normal?: THREE.Vector3) {
    const g = this.items[i];
    g.pos.copy(pos);
    if (normal) g.normal.copy(normal).normalize();
  }

  setRate(i: number, rate: number) {
    this.items[i].rate = rate;
  }

  setRadius(i: number, radius: number) {
    this.items[i].radius = Math.max(radius, MIN_SCALE);
  }

  /** A quick notch: the gear turns `angle` more over about a tenth of a second. */
  kick(i: number, angle: number) {
    this.items[i].kickRem += angle;
  }

  hide(i: number) {
    const g = this.items[i];
    g.live = false;
    g.mesh.visible = false;
  }

  /** Shrinks every seated gear away over `seconds` (they sink a little as they go). */
  fold(seconds: number) {
    for (const g of this.items) {
      if (!g.live || (g.mode !== 'idle' && g.mode !== 'fly')) continue;
      g.mode = 'fold';
      g.age = 0;
      g.dur = Math.max(seconds, 0.05);
    }
  }

  /**
   * Every seated gear becomes a loose cog: flung away from `origin` (default the middle of them) at about `speed`,
   * tumbling, bouncing on the floor and shrinking away over `life` seconds.
   */
  scatter(speed = 5, life = 0.9, origin?: THREE.Vector3) {
    const act = this.items.filter((g) => g.live && g.mode !== 'loose' && g.mode !== 'fold');
    if (!act.length) return;
    const c = origin ?? this.v.set(0, 0, 0);
    if (!origin) { for (const g of act) c.add(g.pos); c.multiplyScalar(1 / act.length); }
    for (const g of act) {
      this.qN.setFromUnitVectors(Z, g.normal);
      this.qS.setFromAxisAngle(Z, g.angle);
      g.quat.copy(this.qN).multiply(this.qS);
      g.mode = 'loose';
      g.age = 0;
      g.life = life * (0.8 + Math.random() * 0.4);
      const dx = g.pos.x - c.x, dz = g.pos.z - c.z, l = Math.hypot(dx, dz);
      const a = l > 0.05 ? Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.7 : Math.random() * 6.28;
      const sp = speed * (0.6 + Math.random() * 0.7);
      g.vel.set(Math.cos(a) * sp, speed * (0.5 + Math.random() * 0.6), Math.sin(a) * sp);
      g.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      g.tumble = (6 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
      g.mesh.visible = true;
    }
  }

  reset() {
    for (const g of this.items) { g.live = false; g.mesh.visible = false; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (let i = 0; i < this.items.length; i++) {
      const g = this.items[i];
      if (!g.live) continue;
      const m = g.mesh;
      let s = 1;
      let spinMul = 1;
      this.p.copy(g.pos);
      if (g.mode === 'wait') { m.visible = false; continue; }
      if (g.mode === 'fly') {
        g.age += d;
        if (g.age < 0) { m.visible = false; continue; }
        const k = clamp01(g.age / g.dur);
        if (g.hasFrom) {
          this.p.lerpVectors(g.from, g.pos, easeOut(k));
          this.p.y += Math.sin(k * Math.PI) * (0.8 + g.from.distanceTo(g.pos) * 0.12);
          s = 0.4 + 0.6 * k;
        } else s = backOut(k);
        spinMul = 1 + 3 * (1 - k);
        if (k >= 1) {
          g.mode = 'idle';
          g.click = 0.14;
          this.onClick?.(g.pos, i);
        }
      } else if (g.mode === 'idle') {
        if (g.click > 0) { g.click = Math.max(0, g.click - d); s = 1 + 0.16 * Math.sin((g.click / 0.14) * Math.PI); }
      } else if (g.mode === 'fold') {
        g.age += d;
        const k = clamp01(g.age / g.dur);
        s = 1 - easeIn(k);
        this.p.y -= k * g.thick * 1.5;
        spinMul = 1 + 2 * k;
        if (k >= 1) { g.live = false; m.visible = false; continue; }
      } else {
        // Loose cog: ballistic, tumbling, bounces a little, shrinks away at the end.
        g.age += d;
        if (g.age >= g.life) { g.live = false; m.visible = false; continue; }
        g.vel.y -= this.gravity * d;
        g.pos.addScaledVector(g.vel, d);
        const floor = g.radius * 0.55;
        if (g.pos.y < floor) {
          g.pos.y = floor;
          if (g.vel.y < 0) g.vel.y = -g.vel.y * 0.35;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
        this.qS.setFromAxisAngle(g.axis, g.tumble * d);
        g.quat.premultiply(this.qS);
        const u = g.age / g.life;
        s = u < 0.65 ? 1 : 1 - Math.pow((u - 0.65) / 0.35, 2);
        m.position.copy(g.pos);
        m.quaternion.copy(g.quat);
        m.scale.set(Math.max(g.radius * s, MIN_SCALE), Math.max(g.radius * s, MIN_SCALE), Math.max(g.thick * s, MIN_SCALE));
        m.visible = true;
        continue;
      }
      let da = g.rate * d * spinMul;
      if (Math.abs(g.kickRem) > 1e-4) { const k = g.kickRem * (1 - Math.exp(-d * 20)); g.kickRem -= k; da += k; }
      g.angle += da;
      this.qN.setFromUnitVectors(Z, g.normal);
      this.qS.setFromAxisAngle(Z, g.angle);
      m.position.copy(this.p);
      m.quaternion.copy(this.qN).multiply(this.qS);
      const sc = Math.max(g.radius * s, MIN_SCALE);
      m.scale.set(sc, sc, Math.max(g.thick * s, MIN_SCALE));
      m.visible = true;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Spring
// ---------------------------------------------------------------------------------------------------------------

const RINGS_PER_COIL = 10;
const SPRING_SIDES = 6;

/**
 * A coiled brass spring (a round wire wound into a helix) that compresses and releases. `set(from, to, coils, radius)`
 * stands it between two points (the wire is `radius * 0.38` thick, so it reads at gameplay distance); `stretch(k)` scales
 * its length from `from` (1 = rest, 0.4 = squeezed, it bulges as it compresses; above 1 it overshoots). `hide()` /
 * `reset()` hide it. Add `mesh`.
 */
export class Spring {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private nrm: Float32Array;
  private maxRings: number;
  private from = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 1, 0);
  private len0 = 1;
  private coils = 5;
  private radius = 0.15;
  private k = 1;

  constructor(maxCoils = 8) {
    this.maxRings = maxCoils * RINGS_PER_COIL + 1;
    this.pos = new Float32Array(this.maxRings * SPRING_SIDES * 3);
    this.nrm = new Float32Array(this.maxRings * SPRING_SIDES * 3);
    const idx: number[] = [];
    for (let i = 0; i < this.maxRings - 1; i++) {
      for (let j = 0; j < SPRING_SIDES; j++) {
        const a = i * SPRING_SIDES + j, b = i * SPRING_SIDES + ((j + 1) % SPRING_SIDES), c = a + SPRING_SIDES, e = b + SPRING_SIDES;
        idx.push(a, c, b, b, c, e);
      }
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(this.geo, toonMetal(BRASS));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(from: THREE.Vector3, to: THREE.Vector3, coils = 5, radius = 0.15) {
    this.from.copy(from);
    this.dir.subVectors(to, from);
    this.len0 = Math.max(this.dir.length(), 0.05);
    this.dir.multiplyScalar(1 / this.len0);
    this.coils = Math.min(coils, (this.maxRings - 1) / RINGS_PER_COIL);
    this.radius = radius;
    this.mesh.visible = true;
    this.rebuild();
  }

  stretch(k: number) {
    this.k = Math.max(k, 0.05);
    this.rebuild();
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
    this.k = 1;
  }

  private rebuild() {
    const rings = Math.max(2, Math.round(this.coils * RINGS_PER_COIL) + 1);
    const len = this.len0 * this.k, bulge = this.radius * (1 + 0.35 * Math.max(0, 1 - this.k));
    const w = this.radius * 0.38, om = this.coils * Math.PI * 2;
    this.mesh.position.copy(this.from);
    this.mesh.quaternion.setFromUnitVectors(Z, this.dir);
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1), th = u * om, c = Math.cos(th), s = Math.sin(th);
      const cx = bulge * c, cy = bulge * s, cz = u * len;
      // Tangent, radial and the binormal of the helix.
      let tx = -bulge * s * om, ty = bulge * c * om, tz = len;
      const tl = Math.hypot(tx, ty, tz);
      tx /= tl; ty /= tl; tz /= tl;
      // b = T x radial(c, s, 0)
      let bx = ty * 0 - tz * s, by = tz * c - tx * 0, bz = tx * s - ty * c;
      const bl = Math.hypot(bx, by, bz);
      bx /= bl; by /= bl; bz /= bl;
      // r2 = b x T
      const rx = by * tz - bz * ty, ry = bz * tx - bx * tz, rz = bx * ty - by * tx;
      for (let j = 0; j < SPRING_SIDES; j++) {
        const ph = (j / SPRING_SIDES) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const nx = cp * rx + sp * bx, ny = cp * ry + sp * by, nz = cp * rz + sp * bz;
        const o = (i * SPRING_SIDES + j) * 3;
        this.pos[o] = cx + nx * w; this.pos[o + 1] = cy + ny * w; this.pos[o + 2] = cz + nz * w;
        this.nrm[o] = nx; this.nrm[o + 1] = ny; this.nrm[o + 2] = nz;
      }
    }
    this.geo.setDrawRange(0, (rings - 1) * SPRING_SIDES * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sparks
// ---------------------------------------------------------------------------------------------------------------

const SPARK_K = 6;

interface Arc { live: boolean; a: THREE.Vector3; b: THREE.Vector3; age: number; life: number; seed: number }

/**
 * Small cyan electric zigzag arcs: `arc(a, b)` jumps between two points, `burst(pos, count)` throws short arcs out of a
 * point, `ring(center, radius, count)` lays a broken ring of arcs on the floor (call it every frame with a growing radius
 * for a racing ring). Camera-facing threads about 0.09 wide with a pale core, unlit, re-rolled about 28 times a second,
 * each living 0.1 to 0.3 s. Pooled (`max` arcs). `update(dt)` each frame. Add `mesh`.
 */
export class Sparks {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private arcs: Arc[] = [];
  private cursor = 0;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private nxt: Float32Array;
  private side: Float32Array;
  private wid: Float32Array;
  private alp: Float32Array;
  private pts: THREE.Vector3[] = [];
  private d = new THREE.Vector3();
  private p1 = new THREE.Vector3();
  private p2 = new THREE.Vector3();
  private rnd = new THREE.Vector3();

  constructor(private max = 48) {
    for (let i = 0; i < max; i++) this.arcs.push({ live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), age: 0, life: 0.2, seed: 0 });
    for (let k = 0; k < SPARK_K; k++) this.pts.push(new THREE.Vector3());
    const nv = max * SPARK_K * 2;
    this.pos = new Float32Array(nv * 3);
    this.nxt = new Float32Array(nv * 3);
    this.side = new Float32Array(nv);
    this.wid = new Float32Array(nv);
    this.alp = new Float32Array(nv);
    const idx: number[] = [];
    for (let n = 0; n < max; n++) {
      for (let k = 0; k < SPARK_K - 1; k++) {
        const a = (n * SPARK_K + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setIndex(idx);
    const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('aNext', dyn(this.nxt, 3));
    this.geo.setAttribute('aSide', dyn(this.side, 1));
    this.geo.setAttribute('aW', dyn(this.wid, 1));
    this.geo.setAttribute('aA', dyn(this.alp, 1));
    this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uWidth: { value: 0.09 }, uCyan: { value: new THREE.Color(CLOCKWORK.accent).multiplyScalar(0.92) },
        uPale: { value: new THREE.Color(0xe8fffa).multiplyScalar(0.92) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aNext; attribute float aSide; attribute float aW; attribute float aA;
        uniform float uWidth; varying float vS; varying float vA;
        void main() {
          vec4 c = modelViewMatrix * vec4(position, 1.0);
          vec4 n = modelViewMatrix * vec4(aNext, 1.0);
          vec2 d = n.xy - c.xy;
          float l = length(d);
          d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
          c.xy += vec2(-d.y, d.x) * aSide * uWidth * aW;
          vS = aSide; vA = aA;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCyan, uPale; varying float vS; varying float vA;
        void main() { gl_FragColor = vec4(mix(uPale, uCyan, smoothstep(0.0, 0.85, abs(vS))), vA); }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  arc(a: THREE.Vector3, b: THREE.Vector3, life = 0.16) {
    const r = this.arcs[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    r.live = true;
    r.a.copy(a);
    r.b.copy(b);
    r.age = 0;
    r.life = life;
    r.seed = Math.random() * 100;
  }

  burst(pos: THREE.Vector3, count = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.2 + Math.random() * 0.9, l = 0.35 + Math.random() * 0.55;
      this.rnd.set(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(l).add(pos);
      this.arc(pos, this.rnd, 0.16 + Math.random() * 0.14);
    }
  }

  /** A broken ring of arcs on the floor (height `y`), `count` pieces. */
  ring(center: THREE.Vector3, radius: number, count = 10, y = 0.25) {
    const step = (Math.PI * 2) / count, off = Math.random() * step;
    for (let i = 0; i < count; i++) {
      const a0 = off + i * step, a1 = a0 + step * (0.55 + Math.random() * 0.3);
      this.p1.set(center.x + Math.cos(a0) * radius, y, center.z + Math.sin(a0) * radius);
      this.p2.set(center.x + Math.cos(a1) * radius, y, center.z + Math.sin(a1) * radius);
      this.arc(this.p1, this.p2, 0.1 + Math.random() * 0.05);
    }
  }

  reset() {
    for (const a of this.arcs) a.live = false;
    this.geo.setDrawRange(0, 0);
    this.frozen = false;
  }

  update(dt: number) {
    const dd = this.frozen ? 0 : dt;
    let n = 0;
    for (const r of this.arcs) {
      if (!r.live) continue;
      r.age += dd;
      if (r.age >= r.life) { r.live = false; continue; }
      const u = r.age / r.life, alpha = 1 - u * u, frame = Math.floor(r.age * 28);
      this.d.subVectors(r.b, r.a);
      const len = Math.max(this.d.length(), 1e-3);
      // Two perpendiculars to the arc for the zigzag.
      this.p1.crossVectors(this.d, UP);
      if (this.p1.lengthSq() < 1e-6) this.p1.set(1, 0, 0);
      this.p1.normalize();
      this.p2.crossVectors(this.d, this.p1).normalize();
      const amp = Math.min(0.24, len * 0.2);
      for (let k = 0; k < SPARK_K; k++) {
        const t = k / (SPARK_K - 1), ends = k === 0 || k === SPARK_K - 1 ? 0 : 1;
        const h1 = (hash(r.seed + frame * 7.1 + k * 3.3) - 0.5) * 2, h2 = (hash(r.seed + frame * 5.3 + k * 9.7) - 0.5) * 2;
        this.pts[k].copy(r.a).addScaledVector(this.d, t).addScaledVector(this.p1, h1 * amp * ends).addScaledVector(this.p2, h2 * amp * ends);
      }
      for (let k = 0; k < SPARK_K; k++) {
        const p = this.pts[k];
        const nx = k < SPARK_K - 1 ? this.pts[k + 1] : null;
        const w = k === 0 || k === SPARK_K - 1 ? 0.45 : 1;
        for (let s = 0; s < 2; s++) {
          const v = (n * SPARK_K + k) * 2 + s, o = v * 3;
          this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
          if (nx) { this.nxt[o] = nx.x; this.nxt[o + 1] = nx.y; this.nxt[o + 2] = nx.z; }
          else { const q = this.pts[k - 1]; this.nxt[o] = 2 * p.x - q.x; this.nxt[o + 1] = 2 * p.y - q.y; this.nxt[o + 2] = 2 * p.z - q.z; }
          this.side[v] = s === 0 ? -1 : 1;
          this.wid[v] = w;
          this.alp[v] = alpha;
        }
      }
      n++;
    }
    this.geo.setDrawRange(0, n * (SPARK_K - 1) * 6);
    for (const nm of ['position', 'aNext', 'aSide', 'aW', 'aA']) this.geo.attributes[nm].needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SteamPuffs
// ---------------------------------------------------------------------------------------------------------------

interface Puff { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; seed: number }

/**
 * Small white steam puffs from vents: toon wisps (crisp light and shadow bands, a lumpy outline that erodes as they age)
 * that rise, slow down and swell. `puff(pos, dir, count)` throws `count` puffs mostly along `dir`. Billboards, opaque
 * where visible, never a smooth sphere. Up to `max` at once, each living about 0.5 to 0.9 s. `frozen` holds time.
 * `update(dt)` each frame. Add `mesh`.
 */
export class SteamPuffs {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private puffs: Puff[] = [];
  private cursor = 0;
  private aP: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(private max = 40) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', this.aP);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec2 aP; varying vec2 vUv; varying vec2 vP;
        void main() {
          vUv = position.xy; vP = aP;
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          c.xy += position.xy * s;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec2 vP;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          float r = length(vUv);
          float ang = atan(vUv.y, vUv.x);
          float n = 0.5 + 0.5 * sin(ang * 3.0 + vP.y * 20.0) * sin(ang * 5.0 - vP.y * 9.0 + 1.3);
          float e = vP.x;
          float lim = (0.72 + 0.26 * n) * (1.0 - 0.5 * e) - e * 0.12;
          if (r > lim) discard;
          if (e > 0.35 && h(floor(vUv * 4.0) + vP.y) < (e - 0.35) * 0.9) discard;
          float lit = dot(vUv / max(r, 1e-3), vec2(-0.5, 0.8)) - r * 0.3;
          vec3 col = lit > 0.1 ? vec3(0.97, 0.98, 1.0) : vec3(0.78, 0.82, 0.88);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.puffs.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.7, size: 0.2, seed: 0 });
  }

  puff(pos: THREE.Vector3, dir: THREE.Vector3, count = 3) {
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      p.live = true;
      p.pos.copy(pos);
      p.pos.x += (Math.random() - 0.5) * 0.2;
      p.pos.z += (Math.random() - 0.5) * 0.2;
      this.v.copy(dir);
      if (this.v.lengthSq() < 1e-6) this.v.set(0, 1, 0);
      this.v.normalize().multiplyScalar(1 + Math.random() * 1.3);
      p.vel.set(this.v.x + (Math.random() - 0.5) * 0.9, this.v.y + 0.5 + Math.random() * 0.6, this.v.z + (Math.random() - 0.5) * 0.9);
      p.age = 0;
      p.life = 0.5 + Math.random() * 0.4;
      p.size = 0.14 + Math.random() * 0.12;
      p.seed = Math.random() * 10;
    }
  }

  reset() {
    for (const p of this.puffs) p.live = false;
    this.mesh.count = 0;
    this.frozen = false;
  }

  update(dt: number) {
    const dd = this.frozen ? 0 : dt;
    let n = 0;
    const a = this.aP.array as Float32Array;
    for (const p of this.puffs) {
      if (!p.live) continue;
      p.age += dd;
      if (p.age >= p.life) { p.live = false; continue; }
      p.vel.multiplyScalar(Math.max(0, 1 - 2.0 * dd));
      p.vel.y += 0.9 * dd;
      p.pos.addScaledVector(p.vel, dd);
      const u = p.age / p.life;
      const sz = Math.max(p.size * (1 + 0.8 * u), MIN_SCALE);
      this.m.compose(p.pos, this.q.identity(), this.s.setScalar(sz));
      this.mesh.setMatrixAt(n, this.m);
      a[n * 2] = u;
      a[n * 2 + 1] = p.seed;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aP.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Chain
// ---------------------------------------------------------------------------------------------------------------

/**
 * A hanging chain of steel links between two points (every other link turned a quarter, 0.09 thick, 0.3 apart).
 * `set(a, b)` draws it (call it every frame while the ends move), `hide()` / `reset()` hide it. Up to `max` links.
 * Add `mesh`.
 */
export class Chain {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private d = new THREE.Vector3();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1.5, 1);

  constructor(private max = 40) {
    this.mesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.13, 0.045, 5, 10), toonMetal(STEEL, true), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  set(a: THREE.Vector3, b: THREE.Vector3) {
    this.d.subVectors(b, a);
    const len = this.d.length();
    if (len < 0.1) { this.hide(); return; }
    const n = Math.min(this.max, Math.max(2, Math.round(len / 0.3)));
    this.d.multiplyScalar(1 / len);
    this.q.setFromUnitVectors(UP, this.d);
    for (let i = 0; i < n; i++) {
      this.p.lerpVectors(a, b, (i + 0.5) / n);
      this.q2.setFromAxisAngle(UP, (i % 2) * Math.PI * 0.5);
      this.m.compose(this.p, this.q.clone().multiply(this.q2), this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  hide() {
    this.mesh.count = 0;
  }

  reset() {
    this.hide();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Rivet
// ---------------------------------------------------------------------------------------------------------------

/**
 * The Q bolt: a chunky copper rivet (domed head on a steel washer, a brass shank trailing). Local frame +Z forward.
 * `place(pos, dir, spin)` puts it at `pos` flying along `dir`, rolled `spin` radians about its axis; `hide()` /
 * `reset()` hide it. About 0.5 long at scale 1. Add `mesh`.
 */
export class Rivet {
  readonly mesh = new THREE.Group();
  private q = new THREE.Quaternion();
  private qs = new THREE.Quaternion();

  constructor() {
    const copper = toonMetal(CLOCKWORK.body), steel = toonMetal(STEEL, true), brass = toonMetal(BRASS);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.26, 0.26, 0.26), copper);
    head.position.z = 0.04;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12).rotateX(Math.PI / 2), steel);
    plate.position.z = 0.02;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8).rotateX(Math.PI / 2), brass);
    shank.position.z = -0.27;
    // A copper streak behind it: a tapered cone, a hot core inside.
    const streak = (r: number, len: number, color: number, op: number) => new THREE.Mesh(
      new THREE.ConeGeometry(r, len, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.45 - len / 2),
      new THREE.MeshBasicMaterial({ color: rawColor(color), transparent: true, opacity: op, depthWrite: false }),
    );
    this.mesh.add(streak(0.2, 1.5, CLOCKWORK.body, 0.7), streak(0.1, 1.2, CLOCKWORK.hot, 0.85), head, plate, shank);
    this.mesh.scale.setScalar(2);
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3, dir: THREE.Vector3, spin = 0) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.q.setFromUnitVectors(Z, dir.lengthSq() > 1e-8 ? dir.clone().normalize() : Z);
    this.qs.setFromAxisAngle(Z, spin);
    this.mesh.quaternion.copy(this.q).multiply(this.qs);
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Turret look
// ---------------------------------------------------------------------------------------------------------------

let lensGeo: THREE.SphereGeometry | undefined;
let legGeo: THREE.CylinderGeometry | undefined;
let boxGeo: THREE.BoxGeometry | undefined;

function outlineOf(src: THREE.Mesh, p: MinionPalette, k: number) {
  const o = new THREE.Mesh(src.geometry, p.outline);
  o.position.copy(src.position);
  o.quaternion.copy(src.quaternion);
  o.scale.copy(src.scale).multiplyScalar(k);
  return o;
}

function turretRig(p: MinionPalette): MinionRig {
  lensGeo ??= new THREE.SphereGeometry(0.075, 10, 8);
  legGeo ??= new THREE.CylinderGeometry(0.035, 0.05, 1, 6);
  boxGeo ??= new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CLOCKWORK.accent).multiplyScalar(0.92) });
  // Tripod: three brass legs from a collar to the floor, uneven.
  const apex = new THREE.Vector3(0, 0.48, 0), dir = new THREE.Vector3(), foot = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4 + (i === 1 ? 0.12 : 0);
    foot.set(Math.cos(a) * (0.3 + i * 0.015), 0.02, Math.sin(a) * (0.3 + i * 0.015));
    dir.subVectors(foot, apex);
    const len = dir.length();
    const leg = new THREE.Mesh(legGeo, p.trim);
    leg.position.copy(apex).addScaledVector(dir, 0.5);
    leg.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    leg.scale.set(1, len, 1);
    root.add(outlineOf(leg, p, 1.25), leg);
    const pad = new THREE.Mesh(boxGeo, p.body);
    pad.scale.set(0.14, 0.04, 0.14);
    pad.position.set(foot.x, 0.02, foot.z);
    root.add(pad);
  }
  // The head: a spinning gear body (axis along X), a housing, a short barrel and the cyan lens.
  const head = new THREE.Group();
  head.position.y = 0.62;
  const spinner = new THREE.Group();
  const gear = new THREE.Mesh(gearGeometry(10, 5, 0), p.body);
  gear.rotation.y = Math.PI / 2;
  gear.scale.set(0.27, 0.27, 0.13);
  spinner.add(outlineOf(gear, p, 1.12), gear);
  const housing = new THREE.Mesh(boxGeo, p.trim);
  housing.scale.set(0.2, 0.2, 0.28);
  const barrel = new THREE.Mesh(boxGeo, p.trim);
  barrel.scale.set(0.1, 0.1, 0.36);
  barrel.position.set(0, 0, 0.27);
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(0, 0.0, 0.46);
  head.add(spinner, outlineOf(housing, p, 1.14), housing, barrel, lens);
  const collar = new THREE.Mesh(boxGeo, p.body);
  collar.scale.set(0.2, 0.1, 0.2);
  collar.position.set(0, 0.5, 0);
  root.add(collar, head);
  // Glow around the lens so the turret reads at gameplay distance.
  const glowMat = new THREE.MeshBasicMaterial({ color: rawColor(0x6affea), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(lensGeo, glowMat);
  glow.position.copy(lens.position);
  glow.scale.setScalar(2.1);
  head.add(glow);
  root.scale.setScalar(1.8); // about 1.6 m tall
  let spin = 0;
  return {
    root,
    barY: 2.0,
    animate(dt, pose) {
      spin += dt * (1.4 + pose.shot * 12);
      spinner.rotation.x = spin;
      barrel.position.z = 0.27 - pose.shot * 0.1;
      lens.position.z = 0.46 - pose.shot * 0.1;
      glow.position.z = lens.position.z;
      glow.scale.setScalar(2.1 + pose.shot * 1.2);
      lens.scale.setScalar(1 + pose.shot * 0.7 + Math.sin(pose.time * 4) * 0.08);
      head.rotation.y = Math.sin(pose.time * 1.1) * 0.05;
    },
    dispose() {
      lensMat.dispose();
      glowMat.dispose();
    },
  };
}

/** The brass turret for summons: a tripod, a spinning gear body, a short barrel and a cyan lens. Other kinds fall back to the default look. */
export const turretLook: MinionLook = (kind: SummonKind, palette: MinionPalette) =>
  kind === 'turret' ? turretRig(palette) : defaultLook(kind, palette);
