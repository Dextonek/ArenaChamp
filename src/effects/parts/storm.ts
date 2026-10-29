import * as THREE from 'three';

/**
 * The storm kit (pipeline/designs/kit-storm.md): thick hard-edged lightning that branches like a tree (dark outline
 * under a blue body under a white core), flat-bottomed dark toon clouds with a pale lit underside, slanting rain
 * streaks at one shared angle, ground ripples with wet patches, and short yellow crackle sparks. Everything is pooled,
 * takes world-space positions and has a `reset()`. Materials are normal-blended toon shaders kept below the bloom
 * threshold (~0.86) except the tiny white lightning core and the spark centres.
 */

/** Palette. Numbers for `THREE.Color`, `STORM_CSS` for APIs that want a string. `rain` is the pale foil. */
export const STORM = {
  core: 0xffffff,
  hot: 0xd6f2ff,
  body: 0x4aa8ff,
  accent: 0xffe36a,
  dark: 0x0a1220,
  rain: 0xc8d4de,
} as const;

export const STORM_CSS = {
  core: '#ffffff',
  hot: '#d6f2ff',
  body: '#4aa8ff',
  accent: '#ffe36a',
  dark: '#0a1220',
  rain: '#c8d4de',
} as const;

const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const hash1 = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// LightningTree
// ---------------------------------------------------------------------------------------------------------------

interface Poly { pts: THREE.Vector3[]; width: number; start: number; depth: number; ord: number }

interface Bolt {
  alive: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  branches: number;
  width: number;
  life: number;
  age: number;
  grow: number;
  hold: number;
  ground: number;
  levels: number;
  jag: number;
  maxSeg: number;
  seed: number;
  timer: number;
  every: number;
  polys: Poly[];
  on: boolean;
  p: number;
  step: number;
}

export interface StrikeOptions {
  /** Seconds the bolt takes to reach `to` from `from` (default 0 = there at once). */
  grow?: number;
  /** Fraction of the life it stays solid before it starts to flicker out (default 0.35). */
  hold?: number;
  /** Extra forks that run flat across the floor from the last points of the trunk (default 0). */
  groundForks?: number;
  /** Fork depth below the trunk, 1..3 (default 3). */
  levels?: number;
  /** Seconds before it starts (default 0). */
  delay?: number;
  /** Jag multiplier of the trunk (default 1). */
  jag?: number;
  /** Cap on segments for this bolt (default 150). */
  maxSegments?: number;
}

/**
 * Branching lightning: a jagged trunk from a start to an end point that forks like a tree (2-3 levels, thinner at
 * every level), with a dark outline drawn under a blue body under a white core. Camera-facing ribbons in one draw
 * call. A bolt is re-randomised every ~3 frames while it lives, stays solid for `hold` of its life and then flickers
 * out in 3-frame steps (small forks drop first), never a smooth fade. Up to `max` bolts at once; the oldest is
 * recycled when the pool is full. `update(dt)` each frame. Add `mesh` to the group.
 */
export class LightningTree {
  readonly mesh: THREE.Mesh;
  /** True: nothing ages or re-rolls (a dead beat). */
  frozen = false;
  private bolts: Bolt[] = [];
  private geo = new THREE.BufferGeometry();
  private maxQuads: number;
  private positions: Float32Array;
  private layers: Float32Array;
  private camLocal = new THREE.Vector3();
  private tp: THREE.Vector3[] = Array.from({ length: 40 }, () => new THREE.Vector3());
  private sd: THREE.Vector3[] = Array.from({ length: 40 }, () => new THREE.Vector3());
  private t1 = new THREE.Vector3();
  private t2 = new THREE.Vector3();
  private t3 = new THREE.Vector3();

  constructor(max = 8, maxQuads = 2400) {
    this.maxQuads = maxQuads;
    this.positions = new Float32Array(maxQuads * 12);
    this.layers = new Float32Array(maxQuads * 4);
    const uvs = new Float32Array(maxQuads * 8);
    const index: number[] = [];
    for (let q = 0; q < maxQuads; q++) {
      uvs.set([0, 0, 1, 0, 0, 1, 1, 1], q * 8);
      const v = q * 4;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geo.setAttribute('aLayer', new THREE.BufferAttribute(this.layers, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(index);
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uDark: { value: new THREE.Color(STORM.dark) }, uBody: { value: new THREE.Color(STORM.body) },
        uHot: { value: new THREE.Color(STORM.hot) }, uCore: { value: new THREE.Color(STORM.core) },
      },
      vertexShader: /* glsl */ `
        attribute float aLayer; varying vec2 vUv; varying float vLayer;
        void main() { vUv = uv; vLayer = aLayer; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uBody, uHot, uCore; varying vec2 vUv; varying float vLayer;
        void main() {
          float x = abs(vUv.x * 2.0 - 1.0);
          vec3 col;
          if (vLayer < 0.5) col = uDark;
          else if (vLayer < 1.5) col = mix(uBody, uHot, step(x, 0.45) * 0.55);
          else col = x < 0.5 ? uCore : uHot;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
    this.mesh.onBeforeRender = (_r, _s, camera) => this.build(camera);
    for (let i = 0; i < Math.max(1, max); i++) {
      this.bolts.push({
        alive: false, from: new THREE.Vector3(), to: new THREE.Vector3(), branches: 2, width: 0.2, life: 1, age: 0, grow: 0,
        hold: 0.35, ground: 0, levels: 3, jag: 1, maxSeg: 150, seed: 0, timer: 0, every: 0.05, polys: [], on: true, p: 1, step: 0,
      });
    }
  }

  /** True while any bolt is alive. */
  get active() { return this.bolts.some((b) => b.alive); }

  /**
   * A bolt from `from` to `to` with `branches` forks off the trunk, trunk `width` world units across, living `seconds`.
   * Returns the pool slot. See `StrikeOptions` for growth, ground forks and delay.
   */
  strike(from: THREE.Vector3, to: THREE.Vector3, branches = 3, width = 0.2, seconds = 0.8, opts: StrikeOptions = {}): number {
    let slot = this.bolts.findIndex((b) => !b.alive);
    if (slot < 0) { // recycle the oldest
      let oldest = -1;
      this.bolts.forEach((b, i) => { if (b.age > oldest) { oldest = b.age; slot = i; } });
    }
    const b = this.bolts[slot];
    b.alive = true;
    b.from.copy(from);
    b.to.copy(to);
    b.branches = branches;
    b.width = width;
    b.life = Math.max(seconds, 0.06);
    b.age = -(opts.delay ?? 0);
    b.grow = opts.grow ?? 0;
    b.hold = opts.hold ?? 0.35;
    b.ground = opts.groundForks ?? 0;
    b.levels = clamp(opts.levels ?? 3, 1, 3);
    b.jag = opts.jag ?? 1;
    b.maxSeg = opts.maxSegments ?? 150;
    b.seed = Math.random() * 100;
    b.every = width > 0.4 ? 0.08 : 0.05;
    b.timer = 0;
    b.on = true; b.p = 1; b.step = 0;
    this.reroll(b);
    return slot;
  }

  reset() {
    for (const b of this.bolts) { b.alive = false; b.polys.length = 0; }
    this.frozen = false;
    this.geo.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  private reroll(b: Bolt) {
    const polys: Poly[] = [];
    b.polys = polys;
    const dir = this.t1.subVectors(b.to, b.from);
    const len = dir.length();
    if (len < 1e-3) return;
    dir.divideScalar(len);
    const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const p1 = new THREE.Vector3().crossVectors(dir, helper).normalize();
    const p2 = new THREE.Vector3().crossVectors(dir, p1).normalize();
    const segs = clamp(Math.round(len / 0.85), 6, 24);
    const amp = clamp((len / segs) * 0.5 * b.jag, 0.06, 0.7);
    const trunk: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const edge = i === 0 || i === segs ? 0 : 1;
      trunk.push(b.from.clone().addScaledVector(dir, (len * i) / segs)
        .addScaledVector(p1, (Math.random() - 0.5) * 2 * amp * edge)
        .addScaledVector(p2, (Math.random() - 0.5) * 2 * amp * edge * 0.6));
    }
    const root: Poly = { pts: trunk, width: b.width, start: 0, depth: 0, ord: 0 };
    polys.push(root);
    const budget = { n: b.maxSeg - segs };
    // Forks off the trunk, spread over its length.
    for (let k = 0; k < b.branches; k++) {
      const u = 0.16 + 0.72 * ((k + Math.random() * 0.8) / Math.max(1, b.branches));
      const idx = clamp(Math.round(u * segs), 1, segs - 2);
      this.fork(b, root, idx, 1, len, budget);
    }
    // Forks running flat across the floor from the end of the trunk.
    for (let g = 0; g < b.ground && budget.n > 5; g++) {
      const idx = segs - 1 - Math.floor(Math.random() * 3);
      const a = (g / Math.max(1, b.ground)) * Math.PI * 2 + Math.random() * 0.8;
      const L = (1.2 + Math.random() * 1.6) * (0.8 + b.width * 1.5);
      const n = 4 + Math.floor(Math.random() * 3);
      const o = trunk[idx];
      const d = this.t2.set(Math.cos(a), 0.05, Math.sin(a));
      const pts = [o.clone()];
      for (let i = 1; i <= n; i++) {
        const q = o.clone().addScaledVector(d, (L * i) / n);
        q.x += (Math.random() - 0.5) * (L / n) * 0.7;
        q.z += (Math.random() - 0.5) * (L / n) * 0.7;
        q.y = Math.max(b.to.y + 0.03, o.y * (1 - i / n) + b.to.y * (i / n)) + 0.04;
        pts.push(q);
      }
      budget.n -= n;
      polys.push({ pts, width: b.width * 0.42, start: 0.9, depth: 1, ord: polys.length });
    }
  }

  private fork(b: Bolt, parent: Poly, idx: number, depth: number, len: number, budget: { n: number }) {
    if (depth > b.levels || budget.n < 4) return;
    const pts = parent.pts;
    const o = pts[idx];
    const t = this.t2.subVectors(pts[Math.min(idx + 1, pts.length - 1)], pts[Math.max(idx - 1, 0)]).normalize();
    const perp = this.t3.randomDirection();
    perp.addScaledVector(t, -perp.dot(t)).normalize();
    const ang = 0.5 + Math.random() * 0.55;
    const d = new THREE.Vector3().copy(t).multiplyScalar(Math.cos(ang)).addScaledVector(perp, Math.sin(ang));
    d.y -= 0.22;
    d.normalize();
    const L = clamp(len * (depth === 1 ? 0.2 + 0.2 * Math.random() : 0.09 + 0.07 * Math.random()), 0.5, len * 0.5);
    const n = Math.min(clamp(Math.ceil(L / 0.55), 3, 9), budget.n);
    const out: THREE.Vector3[] = [o.clone()];
    for (let i = 1; i <= n; i++) {
      out.push(o.clone().addScaledVector(d, (L * i) / n).add(this.t1.randomDirection().multiplyScalar((L / n) * 0.4)));
    }
    budget.n -= n;
    const widths = [1, 0.55, 0.34, 0.2];
    const poly: Poly = {
      pts: out, width: Math.max(0.06, b.width * widths[depth]), start: clamp(parent.start + (idx / (pts.length - 1)) * (depth === 1 ? 1 : 0.25), 0, 0.88),
      depth, ord: b.polys.length,
    };
    b.polys.push(poly);
    if (depth < b.levels) {
      const kids = (Math.random() < 0.7 ? 1 : 0) + (depth === 1 && Math.random() < 0.4 ? 1 : 0);
      for (let k = 0; k < kids; k++) this.fork(b, poly, 1 + Math.floor(Math.random() * Math.max(1, n - 2)), depth + 1, len, budget);
    }
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let any = false;
    for (const b of this.bolts) {
      if (!b.alive) continue;
      b.age += d;
      if (b.age >= b.life) { b.alive = false; continue; }
      if (b.age < 0) continue;
      any = true;
      b.timer += d;
      if (b.timer >= b.every || b.polys.length === 0) { b.timer = 0; this.reroll(b); }
      const solid = b.life * b.hold;
      b.step = Math.floor(b.age / 0.05);
      if (b.age < solid) { b.p = 1; b.on = true; }
      else {
        b.p = 1 - (b.age - solid) / Math.max(b.life - solid, 1e-3);
        b.on = hash1(b.step * 3.7 + b.seed) < 0.15 + 0.8 * b.p;
      }
    }
    this.mesh.visible = any;
    if (!any) this.geo.setDrawRange(0, 0);
  }

  private build(camera: THREE.Camera) {
    this.camLocal.setFromMatrixPosition(camera.matrixWorld);
    this.mesh.worldToLocal(this.camLocal);
    let q = 0;
    for (let layer = 0; layer < 3; layer++) {
      for (const b of this.bolts) {
        if (!b.alive || b.age < 0 || !b.on) continue;
        const pop = b.age < 0.04 ? 1.4 : 1;
        const frac = b.grow <= 0 ? 1 : clamp01(b.age / b.grow);
        for (const poly of b.polys) {
          if (poly.depth > 0 && !(hash1(b.step * 1.9 + poly.ord * 17.3 + b.seed) < 0.3 + 0.7 * b.p)) continue;
          const pf = frac >= 1 ? 1 : poly.depth === 0 ? frac : clamp01((frac - poly.start) * 3.5);
          q = this.emit(poly, pf, layer, pop, q);
        }
      }
    }
    this.geo.setDrawRange(0, q * 6);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aLayer as THREE.BufferAttribute).needsUpdate = true;
  }

  private emit(poly: Poly, pf: number, layer: number, pop: number, q: number): number {
    const n = poly.pts.length;
    const segsF = pf * (n - 1);
    const cnt = Math.min(n, Math.floor(segsF) + 2);
    if (pf <= 0 || cnt < 2 || q + cnt - 1 > this.maxQuads) return q;
    const tp = this.tp, sd = this.sd;
    for (let i = 0; i < cnt; i++) tp[i].copy(poly.pts[i]);
    if (cnt - 1 > segsF) tp[cnt - 1].lerpVectors(poly.pts[cnt - 2], poly.pts[cnt - 1], segsF - (cnt - 2));
    for (let i = 0; i < cnt; i++) {
      const tan = this.t1.subVectors(tp[Math.min(i + 1, cnt - 1)], tp[Math.max(i - 1, 0)]);
      this.t2.subVectors(this.camLocal, tp[i]);
      sd[i].crossVectors(tan, this.t2);
      if (sd[i].lengthSq() < 1e-10) sd[i].set(0, 1, 0);
      sd[i].normalize();
    }
    const h = new Array<number>(cnt);
    for (let i = 0; i < cnt; i++) {
      const w = poly.width * (1 - 0.58 * (i / (n - 1))) * pop;
      const hb = Math.max(w * 0.5, 0.03);
      h[i] = layer === 0 ? hb + Math.max(0.04, w * 0.28) : layer === 1 ? hb : Math.max(0.014, w * 0.16);
    }
    for (let i = 0; i < cnt - 1; i++, q++) {
      const a = tp[i], b = tp[i + 1], sa = sd[i], sb = sd[i + 1];
      this.positions.set([
        a.x - sa.x * h[i], a.y - sa.y * h[i], a.z - sa.z * h[i],
        a.x + sa.x * h[i], a.y + sa.y * h[i], a.z + sa.z * h[i],
        b.x - sb.x * h[i + 1], b.y - sb.y * h[i + 1], b.z - sb.z * h[i + 1],
        b.x + sb.x * h[i + 1], b.y + sb.y * h[i + 1], b.z + sb.z * h[i + 1],
      ], q * 12);
      this.layers.fill(layer, q * 4, q * 4 + 4);
    }
    return q;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Streaks: instanced camera-facing stretched quads (rain and sparks)
// ---------------------------------------------------------------------------------------------------------------

interface StreakStyle { edge: number; core: number; taper: number; coreW: number; tailFade: number }

class Streaks {
  readonly mesh: THREE.InstancedMesh;
  private aHead: THREE.InstancedBufferAttribute;
  private aTail: THREE.InstancedBufferAttribute;
  private aS: THREE.InstancedBufferAttribute;
  private n = 0;

  constructor(private max: number, style: StreakStyle) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aHead = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aTail = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHead', this.aHead);
    geo.setAttribute('aTail', this.aTail);
    geo.setAttribute('aS', this.aS);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uEdge: { value: new THREE.Color(style.edge) }, uCore: { value: new THREE.Color(style.core) },
        uTaper: { value: style.taper }, uCoreW: { value: style.coreW }, uTailFade: { value: style.tailFade },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aHead; attribute vec3 aTail; attribute vec2 aS;
        uniform float uTaper;
        varying float vX; varying float vU; varying float vA;
        void main() {
          vec4 h = modelViewMatrix * vec4(aHead, 1.0);
          vec3 ax = mat3(modelViewMatrix) * aTail;
          float u = position.y + 0.5;
          vec3 c = h.xyz + ax * u;
          vec3 side = cross(ax, c);
          side = side / max(length(side), 1e-6);
          c += side * position.x * aS.x * mix(1.0, uTaper, u);
          vX = position.x * 2.0; vU = u; vA = aS.y;
          gl_Position = projectionMatrix * vec4(c, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uEdge, uCore; uniform float uCoreW, uTailFade;
        varying float vX; varying float vU; varying float vA;
        void main() {
          vec3 col = abs(vX) < uCoreW ? uCore : uEdge;
          float a = vA * (1.0 - vU * uTailFade);
          if (a < 0.004) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin() { this.n = 0; }

  /** `tail` is the offset from the head to the tail end. */
  push(head: THREE.Vector3, tail: THREE.Vector3, width: number, alpha: number) {
    if (this.n >= this.max) return;
    this.aHead.setXYZ(this.n, head.x, head.y, head.z);
    this.aTail.setXYZ(this.n, tail.x, tail.y, tail.z);
    this.aS.setXY(this.n, width, alpha);
    this.n++;
  }

  end() {
    this.mesh.count = this.n;
    this.aHead.needsUpdate = true;
    this.aTail.needsUpdate = true;
    this.aS.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// StormCloud
// ---------------------------------------------------------------------------------------------------------------

interface Puff { u: number; a0: number; size: number; seed: number; layer: number; yoff: number; delay: number; dd: number }

export interface GatherOptions {
  /** Radius of the clear hole in the middle (a ring of cloud with an eye). Default 0. */
  eye?: number;
  /** Turn speed in radians per second. Default 0. */
  spin?: number;
  /** Puffs in the lower layer. Default from the radius. */
  count?: number;
}

/**
 * A dark flat-bottomed toon cloud patch (or a ring of cloud with a clear eye): lumpy puffs with a pale lit underside,
 * opaque with a hard dark rim. `gather(center, radius, height, seconds)` grows it with its flat underside at `height`;
 * `disperse(seconds)` breaks it up (the edges erode, the puffs shrink and drift up). `flash` (0..1) lights the
 * underside and body. `eye`, `radius` and `spin` can be driven live (a tightening storm wheel). `frozen` holds time.
 * `update(dt)` each frame. Add `mesh`.
 */
export class StormCloud {
  readonly mesh: THREE.InstancedMesh;
  /** 0..1: lights the pale underside and the body (lightning inside the cloud). */
  flash = 0;
  /** True: nothing moves (a dead beat). */
  frozen = false;
  /** Current outer radius and eye radius; change them live while it is gathered. */
  radius = 1;
  eye = 0;
  spin = 0;
  /** Slope of the ring toward `tiltDir` (a ground direction): the side toward it hangs lower, the far side higher. */
  tilt = 0;
  tiltDir = new THREE.Vector3(0, 0, 1);
  private center = new THREE.Vector3();
  private height = 6;
  private puffs: Puff[] = [];
  private aS: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private mat: THREE.ShaderMaterial;
  private gAge = 0;
  private gDur = 0.5;
  private dAge = -1;
  private dDur = 0.5;
  private rot = 0;
  private live = false;
  private max: number;

  constructor(max = 96) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.aS);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x1a2438) }, uMid: { value: new THREE.Color(0x45556f) },
        uPale: { value: new THREE.Color(0x9aa8b8) }, uRain: { value: new THREE.Color(STORM.rain) },
        uHot: { value: new THREE.Color(STORM.hot) }, uFlash: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
        void main() {
          vUv = uv; vS = aS;
          vec4 c = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          c.xy += position.xy * aS.x;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uPale, uRain, uHot; uniform float uFlash;
        varying vec2 vUv; varying vec4 vS;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), a = atan(p.y, p.x);
          float lim = 0.8 + 0.1 * sin(a * 3.0 + vS.z * 6.0) + 0.07 * sin(a * 5.0 + vS.z * 11.0) + 0.04 * sin(a * 9.0 + vS.z * 19.0);
          lim -= vS.y * 0.6;
          float al = 1.0 - smoothstep(lim - 0.22, lim, r);                 // soft lumpy edge, transparent margin
          al *= 1.0 - smoothstep(-0.5, -0.32, -p.y) * 0.0;
          al *= smoothstep(-0.62, -0.46, p.y);                              // soft, nearly flat underside
          al *= 1.0 - vS.y * 0.5;
          if (al < 0.02) discard;
          // Three soft value bands: dark slate top, blue-grey middle, pale lit underside.
          float y = p.y + 0.06 * sin(p.x * 5.0 + vS.z * 9.0);
          vec3 col = mix(uMid, uTop, smoothstep(0.05, 0.6, y));
          vec3 pale = mix(uPale, uRain, 0.4);
          pale = mix(pale, uHot, clamp(uFlash * 1.3, 0.0, 1.0));
          col = mix(col, pale * mix(0.8, 1.0, uFlash), 1.0 - smoothstep(-0.38, -0.14, y));
          col = mix(col, uHot * 0.9, uFlash * 0.25);
          gl_FragColor = vec4(col, al * 0.94);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /** Grows the cloud over `seconds`, its flat underside `height` above the floor, `radius` wide around `center`. */
  gather(center: THREE.Vector3, radius: number, height: number, seconds = 0.5, opts: GatherOptions = {}) {
    this.center.copy(center);
    this.radius = radius;
    this.height = height;
    this.eye = opts.eye ?? 0;
    this.spin = opts.spin ?? 0;
    this.gAge = 0;
    this.gDur = Math.max(seconds, 0.05);
    this.dAge = -1;
    this.live = true;
    this.rot = Math.random() * 6;
    const span = Math.max(radius - this.eye, 0.5);
    const ring = this.eye > 0;
    const n0 = Math.min(Math.round((opts.count ?? (ring ? radius * 7 : radius * 4)) ), Math.floor(this.max * 0.69));
    const size0 = clamp(0.7 * span + 1.6, 2.2, 5);
    this.puffs.length = 0;
    const total = n0 + Math.round(n0 * 0.45);
    for (let i = 0; i < total; i++) {
      const layer = i < n0 ? 0 : 1;
      const j = layer === 0 ? i : i - n0;
      const cnt = layer === 0 ? n0 : total - n0;
      this.puffs.push({
        u: Math.sqrt((j + 0.5) / cnt), a0: j * 2.39996 + Math.random() * 0.3,
        size: size0 * (layer === 0 ? 0.85 + Math.random() * 0.3 : 0.62 + Math.random() * 0.2), seed: Math.random(), layer,
        yoff: layer === 0 ? 0 : size0 * (0.3 + Math.random() * 0.15),
        delay: Math.random() * 0.5 * this.gDur, dd: Math.random() * 0.4 * 0.5,
      });
    }
  }

  /** Height offset of the cloud at a ground point (from the tilt). */
  heightAt(x: number, z: number) {
    return -((x - this.center.x) * this.tiltDir.x + (z - this.center.z) * this.tiltDir.z) * this.tilt;
  }

  /** Breaks the cloud up over `seconds`: the edges erode, the puffs shrink and drift up. */
  disperse(seconds = 0.5) {
    if (!this.live) return;
    this.dAge = 0;
    this.dDur = Math.max(seconds, 0.05);
  }

  reset() {
    this.live = false;
    this.flash = 0;
    this.frozen = false;
    this.dAge = -1;
    this.mesh.count = 0;
    this.puffs.length = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.mat.uniforms.uFlash.value = clamp01(this.flash);
    if (!this.live) { this.mesh.count = 0; return; }
    this.gAge += d;
    this.rot += this.spin * d;
    if (this.dAge >= 0) this.dAge += d;
    const arr = this.aS.array as Float32Array;
    let n = 0;
    let anyLeft = false;
    for (const pf of this.puffs) {
      const g = easeOut((this.gAge - pf.delay) / (this.gDur * 0.5));
      const e = this.dAge < 0 ? 0 : clamp01((this.dAge - pf.dd * this.dDur) / (this.dDur * 0.65));
      const scale = g * (1 - e * e);
      if (scale < 0.003) continue;
      anyLeft = true;
      const rad = this.eye + (this.radius - this.eye) * pf.u;
      const a = pf.a0 + this.rot * (1.25 - pf.u * 0.5);
      const size = Math.max(pf.size * scale, MIN_SCALE);
      const px = this.center.x + Math.cos(a) * rad * (1 + e * 0.15), pz = this.center.z + Math.sin(a) * rad * (1 + e * 0.15);
      this.m.makeTranslation(px, this.height + pf.size * 0.25 * scale + pf.yoff + e * 1.2 + this.heightAt(px, pz), pz);
      this.mesh.setMatrixAt(n, this.m);
      arr[n * 4] = size; arr[n * 4 + 1] = e; arr[n * 4 + 2] = pf.seed; arr[n * 4 + 3] = 0;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
    if (this.dAge >= this.dDur && !anyLeft) this.live = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RainSheet
// ---------------------------------------------------------------------------------------------------------------

interface Drop { alive: boolean; lx: number; lz: number; s: number; v: number; len: number }

/**
 * Slanting rain: thin pale streaks, all at one shared angle (`slant`, `slantZ`), falling in a column over a disc or an
 * annulus. `fall(center, radius, seconds, density, inner)` starts it (it fills in over about half a second; `seconds`
 * 0 = until `stop()`), `stop()` lets the drops in the air land and no new ones start. `frozen` holds the drops in the
 * air. `update(dt)` each frame. Add `mesh`.
 */
export class RainSheet {
  readonly mesh: THREE.InstancedMesh;
  /** True: the drops hang in the air (a dead beat). */
  frozen = false;
  /** Sideways lean of the fall direction (x and z, per unit of fall). Shared by every drop. */
  slant = 0.3;
  slantZ = 0.08;
  /** Height of the column. */
  height = 8;
  /** Fall speed in world units per second. */
  speed = 17;
  private streaks: Streaks;
  private drops: Drop[] = [];
  private center = new THREE.Vector3();
  private radius = 1;
  private inner = 0;
  private active = 0;
  private running = false;
  private stopping = false;
  private age = 0;
  private seconds = 0;
  private head = new THREE.Vector3();
  private tail = new THREE.Vector3();

  constructor(max = 200) {
    this.streaks = new Streaks(max, { edge: STORM.rain, core: STORM.hot, taper: 0.7, coreW: 0.35, tailFade: 0.75 });
    this.mesh = this.streaks.mesh;
    for (let i = 0; i < max; i++) this.drops.push({ alive: false, lx: 0, lz: 0, s: 0, v: 1, len: 1 });
  }

  private norm() { return Math.sqrt(this.slant * this.slant + 1 + this.slantZ * this.slantZ); }

  private land(dr: Drop) {
    const a = Math.random() * Math.PI * 2;
    const r = this.inner > 0
      ? Math.sqrt(this.inner * this.inner + Math.random() * (this.radius * this.radius - this.inner * this.inner))
      : this.radius * Math.sqrt(Math.random());
    dr.lx = this.center.x + Math.cos(a) * r;
    dr.lz = this.center.z + Math.sin(a) * r;
  }

  /** Rain over a disc (or an annulus from `inner` to `radius`) around `center`; `density` 0..1 of the pool. */
  fall(center: THREE.Vector3, radius: number, seconds = 0, density = 1, inner = 0) {
    this.center.copy(center);
    this.radius = radius;
    this.inner = inner;
    this.seconds = seconds;
    this.age = 0;
    this.running = true;
    this.stopping = false;
    this.active = Math.round(this.drops.length * clamp01(density));
    const sMax = this.height * this.norm();
    this.drops.forEach((dr, i) => {
      dr.alive = i < this.active;
      if (!dr.alive) return;
      this.land(dr);
      dr.s = sMax * (1 + Math.random());
      dr.v = 0.85 + Math.random() * 0.3;
      dr.len = 0.8 + Math.random() * 0.8;
    });
  }

  stop() {
    this.stopping = true;
  }

  reset() {
    for (const dr of this.drops) dr.alive = false;
    this.running = false;
    this.stopping = false;
    this.frozen = false;
    this.streaks.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    if (this.running && !this.stopping) {
      this.age += d;
      if (this.seconds > 0 && this.age >= this.seconds) this.stopping = true;
    }
    const nrm = this.norm();
    const sMax = this.height * nrm;
    const ux = -this.slant / nrm, uy = 1 / nrm, uz = -this.slantZ / nrm; // points up along the rain line
    this.streaks.begin();
    let any = false;
    for (let i = 0; i < this.drops.length; i++) {
      const dr = this.drops[i];
      if (!dr.alive) continue;
      dr.s -= this.speed * dr.v * nrm * d;
      if (dr.s <= 0) {
        if (this.stopping) { dr.alive = false; continue; }
        this.land(dr);
        dr.s += sMax;
      }
      any = true;
      if (dr.s > sMax) continue;
      const y = dr.s * uy;
      if (y < 0.05) continue;
      this.head.set(dr.lx + ux * dr.s, y, dr.lz + uz * dr.s);
      this.tail.set(ux * dr.len, uy * dr.len, uz * dr.len);
      this.streaks.push(this.head, this.tail, 0.04, 0.6);
    }
    this.streaks.end();
    if (!any) this.running = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Puddles
// ---------------------------------------------------------------------------------------------------------------

interface Ripple { alive: boolean; pos: THREE.Vector3; size: number; age: number; life: number; seed: number }
interface Wet { alive: boolean; pos: THREE.Vector3; radius: number; age: number; seed: number }

const MAX_RIPPLES = 12;
const MAX_WET = 4;

/**
 * Ground ripples and wet patches. `ripple(pos, size)` is a double ring of pale rain grey over a dark ring that
 * widens and fades (cap 12). `wet(center, radius)` lays a dark glossy patch with a few pale reflection dashes (cap 4).
 * `dry(seconds)` fades the patches and the ripples out. `drizzle(center, radius, perSecond)` drops random ripples in a
 * disc until `stopDrizzle()`. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Puddles {
  readonly mesh = new THREE.Group();
  /** True: nothing ages (a dead beat). */
  frozen = false;
  private ripples: Ripple[] = [];
  private wets: Wet[] = [];
  private ripMesh: THREE.InstancedMesh;
  private wetMesh: THREE.InstancedMesh;
  private aR: THREE.InstancedBufferAttribute;
  private aW: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private rCursor = 0;
  private wCursor = 0;
  private dryAge = -1;
  private dryDur = 0.5;
  private drizzleOn = false;
  private drizzleCenter = new THREE.Vector3();
  private drizzleR = 1;
  private drizzleRate = 4;
  private acc = 0;

  constructor() {
    const quad = () => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const vert = /* glsl */ `
      attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
      void main() { vUv = uv; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
    // Ripples.
    const rg = quad();
    this.aR = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RIPPLES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    rg.setAttribute('aS', this.aR);
    this.ripMesh = new THREE.InstancedMesh(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uRain: { value: new THREE.Color(STORM.rain) }, uDark: { value: new THREE.Color(STORM.dark) } },
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform vec3 uRain, uDark; varying vec2 vUv; varying vec4 vS;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), t = vS.x;
          float r0 = 0.18 + 0.78 * t;
          float d = abs(r - r0);
          float pale = 1.0 - step(0.07, d);
          float dark = 1.0 - step(0.15, d);
          float r1 = r0 * 0.58;
          float d1 = abs(r - r1);
          float ring2 = (1.0 - step(0.05, d1)) * step(0.25, t);
          float ring2Dark = (1.0 - step(0.11, d1)) * step(0.25, t);
          pale = max(pale, ring2);
          dark = max(dark, ring2Dark);
          float fade = (1.0 - t) * vS.y;
          float a = max(dark * 0.55, pale * 0.95) * fade;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(uDark, uRain * 0.95, pale), a);
        }`,
    }), MAX_RIPPLES);
    this.ripMesh.frustumCulled = false;
    this.ripMesh.count = 0;
    this.ripMesh.renderOrder = 3;
    // Wet patches.
    const wg = quad();
    this.aW = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WET * 4), 4).setUsage(THREE.DynamicDrawUsage);
    wg.setAttribute('aS', this.aW);
    this.wetMesh = new THREE.InstancedMesh(wg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uRain: { value: new THREE.Color(STORM.rain) }, uDark: { value: new THREE.Color(0x060b14) } },
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform vec3 uRain, uDark; varying vec2 vUv; varying vec4 vS;
        float h(float x) { return fract(sin(x * 91.17 + vS.z * 37.0) * 43758.5453); }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), a = atan(p.y, p.x);
          float lim = 0.8 + 0.1 * sin(a * 3.0 + vS.z * 8.0) + 0.06 * sin(a * 5.0 + vS.z * 13.0);
          float m = 1.0 - smoothstep(lim - 0.1, lim, r);
          if (m < 0.01) discard;
          float al = 0.5 * m * vS.y;
          vec3 col = uDark;
          // A few pale reflection dashes.
          float dash = 0.0;
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            vec2 c = vec2(h(fi) * 1.3 - 0.65, h(fi + 9.0) * 1.3 - 0.65);
            float w = 0.09 + 0.12 * h(fi + 20.0);
            dash += (1.0 - step(0.014, abs(p.y - c.y))) * (1.0 - step(w, abs(p.x - c.x))) * step(length(c), lim * 0.8);
          }
          dash = min(dash, 1.0) * step(0.5, m);
          col = mix(col, uRain * 0.9, dash);
          al = max(al, dash * 0.65 * vS.y);
          gl_FragColor = vec4(col, al);
        }`,
    }), MAX_WET);
    this.wetMesh.frustumCulled = false;
    this.wetMesh.count = 0;
    this.wetMesh.renderOrder = 1;
    this.mesh.add(this.wetMesh, this.ripMesh);
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push({ alive: false, pos: new THREE.Vector3(), size: 1, age: 0, life: 0.7, seed: 0 });
    for (let i = 0; i < MAX_WET; i++) this.wets.push({ alive: false, pos: new THREE.Vector3(), radius: 1, age: 0, seed: 0 });
  }

  /** One ripple (a double ring) at `pos`, about `size` units across its outer ring. */
  ripple(pos: THREE.Vector3, size = 1) {
    const r = this.ripples[this.rCursor];
    this.rCursor = (this.rCursor + 1) % MAX_RIPPLES;
    r.alive = true;
    r.pos.copy(pos);
    r.size = size;
    r.age = 0;
    r.life = 0.6 + Math.random() * 0.15;
    r.seed = Math.random();
  }

  /** A dark wet patch about `radius` wide that spreads out in 0.35 s. */
  wet(center: THREE.Vector3, radius: number) {
    const w = this.wets[this.wCursor];
    this.wCursor = (this.wCursor + 1) % MAX_WET;
    w.alive = true;
    w.pos.copy(center);
    w.radius = radius;
    w.age = 0;
    w.seed = Math.random();
    this.dryAge = -1;
  }

  /** Fades the patches and every ripple out over `seconds`, and stops the drizzle. */
  dry(seconds = 0.6) {
    this.dryAge = 0;
    this.dryDur = Math.max(seconds, 0.05);
    this.drizzleOn = false;
  }

  /** Random ripples inside the disc, `perSecond` of them, until `stopDrizzle()`. */
  drizzle(center: THREE.Vector3, radius: number, perSecond = 6) {
    this.drizzleOn = true;
    this.drizzleCenter.copy(center);
    this.drizzleR = radius;
    this.drizzleRate = perSecond;
  }

  stopDrizzle() {
    this.drizzleOn = false;
  }

  reset() {
    for (const r of this.ripples) r.alive = false;
    for (const w of this.wets) w.alive = false;
    this.dryAge = -1;
    this.drizzleOn = false;
    this.acc = 0;
    this.frozen = false;
    this.ripMesh.count = 0;
    this.wetMesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    if (this.dryAge >= 0) this.dryAge += d;
    const dryK = this.dryAge < 0 ? 1 : 1 - clamp01(this.dryAge / this.dryDur);
    if (this.drizzleOn) {
      this.acc += this.drizzleRate * d;
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = Math.random() * Math.PI * 2, rr = this.drizzleR * Math.sqrt(Math.random());
        this.ripple(this.p.set(this.drizzleCenter.x + Math.cos(a) * rr, 0, this.drizzleCenter.z + Math.sin(a) * rr), 0.45 + Math.random() * 0.6);
      }
    }
    let n = 0;
    const ra = this.aR.array as Float32Array;
    for (const r of this.ripples) {
      if (!r.alive) continue;
      r.age += d;
      if (r.age >= r.life || dryK <= 0.01) { r.alive = false; continue; }
      this.m.compose(this.p.set(r.pos.x, 0.06, r.pos.z), this.q.identity(), this.s.setScalar(Math.max(r.size, MIN_SCALE)));
      this.ripMesh.setMatrixAt(n, this.m);
      ra[n * 4] = r.age / r.life; ra[n * 4 + 1] = dryK; ra[n * 4 + 2] = r.seed; ra[n * 4 + 3] = 0;
      n++;
    }
    this.ripMesh.count = n;
    this.ripMesh.instanceMatrix.needsUpdate = true;
    this.aR.needsUpdate = true;
    n = 0;
    const wa = this.aW.array as Float32Array;
    for (const w of this.wets) {
      if (!w.alive) continue;
      w.age += d;
      if (dryK <= 0.01) { w.alive = false; continue; }
      const g = easeOut(w.age / 0.35);
      this.m.compose(this.p.set(w.pos.x, 0.035, w.pos.z), this.q.identity(), this.s.setScalar(Math.max(w.radius * (0.4 + 0.6 * g), MIN_SCALE)));
      this.wetMesh.setMatrixAt(n, this.m);
      wa[n * 4] = g; wa[n * 4 + 1] = dryK * dryK; wa[n * 4 + 2] = w.seed; wa[n * 4 + 3] = 0;
      n++;
    }
    this.wetMesh.count = n;
    this.wetMesh.instanceMatrix.needsUpdate = true;
    this.aW.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sparks
// ---------------------------------------------------------------------------------------------------------------

interface Spark { alive: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; len: number }

/**
 * Short yellow-white crackle streaks with a white centre. `burst` throws them out of a point, `along` crackles them
 * along a line (the staff, the cloak). They live a quarter of a second. `update(dt)` each frame. Add `mesh`.
 */
export class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private streaks: Streaks;
  private sparks: Spark[] = [];
  private cursor = 0;
  private head = new THREE.Vector3();
  private tail = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(max = 96) {
    this.streaks = new Streaks(max, { edge: STORM.accent, core: STORM.core, taper: 0.25, coreW: 0.4, tailFade: 0.5 });
    this.mesh = this.streaks.mesh;
    for (let i = 0; i < max; i++) this.sparks.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.25, len: 0.3 });
  }

  /** One spark from `pos` with velocity `vel`, living `life` seconds. */
  emit(pos: THREE.Vector3, vel: THREE.Vector3, life = 0.25) {
    const s = this.sparks[this.cursor];
    this.cursor = (this.cursor + 1) % this.sparks.length;
    s.alive = true;
    s.pos.copy(pos);
    s.vel.copy(vel);
    s.age = 0;
    s.life = life;
    s.len = clamp(vel.length() * 0.05, 0.14, 0.5);
  }

  /** `count` sparks thrown out of `pos` at about `speed`. */
  burst(pos: THREE.Vector3, count = 8, speed = 5) {
    for (let i = 0; i < count; i++) {
      this.v.randomDirection().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      this.v.y += speed * 0.25;
      this.emit(pos, this.v, 0.18 + Math.random() * 0.17);
    }
  }

  /** `count` short sparks at random points along the line from `a` to `b`, jumping off sideways. */
  along(a: THREE.Vector3, b: THREE.Vector3, count = 4, speed = 2.5) {
    for (let i = 0; i < count; i++) {
      this.head.lerpVectors(a, b, Math.random());
      this.v.randomDirection().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      this.emit(this.head, this.v, 0.12 + Math.random() * 0.12);
    }
  }

  reset() {
    for (const s of this.sparks) s.alive = false;
    this.streaks.mesh.count = 0;
  }

  update(dt: number) {
    this.streaks.begin();
    for (const s of this.sparks) {
      if (!s.alive) continue;
      s.age += dt;
      if (s.age >= s.life) { s.alive = false; continue; }
      s.vel.y -= 8 * dt;
      s.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
      s.pos.addScaledVector(s.vel, dt);
      const sp = s.vel.length();
      if (sp < 1e-3) continue;
      this.tail.copy(s.vel).multiplyScalar(-s.len / sp);
      this.streaks.push(s.pos, this.tail, 0.07, 1 - clamp01((s.age / s.life - 0.5) / 0.5));
    }
    this.streaks.end();
  }
}
