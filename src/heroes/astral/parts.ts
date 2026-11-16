import * as THREE from 'three';

/**
 * The astral kit (pipeline/designs/kit-astral.md): constellations. Four-point stars joined by crisp gold lines that
 * draw themselves from star to star, then snap and fall as shooting stars; light arrows with a long tapered tail; a
 * parchment star chart on the ground (the pale foil) and a dark violet night veil behind the gold (the dark layer).
 * Everything is pooled, takes world-space positions and has a `reset()`. All materials are normal-blended custom
 * shaders; the gold sits at the bloom threshold, the parchment stays below it.
 */

/** Palette. Numbers for `THREE.Color`, `ASTRAL_CSS` for APIs that want a string. */
export const ASTRAL = {
  core: 0xfffbe8,
  hot: 0xffe08a,
  body: 0x5a3fc0,
  accent: 0x7ff3ff,
  dark: 0x070414,
  foil: 0xe8e0c8,
} as const;

export const ASTRAL_CSS = {
  core: '#fffbe8',
  hot: '#ffe08a',
  body: '#5a3fc0',
  accent: '#7ff3ff',
  dark: '#070414',
  foil: '#e8e0c8',
} as const;

const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutBack = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};

// ---------------------------------------------------------------------------------------------------------------
// Ribbons: camera-facing line segments between two world points (instanced). Used by lines, tails and arrows.
// ---------------------------------------------------------------------------------------------------------------

interface RibbonOptions {
  /** Total width in world units (halo included). */
  width: number;
  /** Width of the crisp core as a fraction of the total. */
  coreFrac: number;
  /** Opacity of the soft halo under the core (0 = none). */
  halo: number;
  /** Comet: width and alpha grow from the first point (a) to the second (b). */
  comet?: boolean;
  color?: THREE.ColorRepresentation;
  coreColor?: THREE.ColorRepresentation;
  haloColor?: THREE.ColorRepresentation;
}

const ribbonVertex = /* glsl */ `
  attribute vec3 aA; attribute vec3 aB; attribute vec4 aS;
  uniform float uWidth; uniform float uMode;
  varying vec2 vUv; varying float vAlpha;
  void main() {
    float u = position.x * 0.5 + 0.5;
    float side = position.y;
    float s = mix(aS.y, aS.x, u);
    vec4 va = modelViewMatrix * vec4(aA, 1.0);
    vec4 vb = modelViewMatrix * vec4(aB, 1.0);
    vec3 p = mix(va.xyz, vb.xyz, s);
    vec2 d = vb.xy - va.xy;
    float l = length(d);
    vec2 dir = l > 1e-5 ? d / l : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float w = uWidth * aS.w;
    if (uMode > 0.5) w *= s;
    p.xy += perp * side * 0.5 * w;
    vUv = vec2(s, side);
    vAlpha = aS.z;
    gl_Position = projectionMatrix * vec4(p, 1.0);
  }`;

const ribbonFragment = /* glsl */ `
  uniform vec3 uHot, uCore, uHaloCol; uniform float uCoreFrac, uHalo, uMode;
  varying vec2 vUv; varying float vAlpha;
  void main() {
    float ay = abs(vUv.y);
    float core = 1.0 - smoothstep(uCoreFrac * 0.75, uCoreFrac, ay);
    float h = 1.0 - ay;
    float halo = h * h * uHalo;
    float a = max(core, halo);
    vec3 col = mix(uHaloCol, uHot, core);
    float lift = uMode > 0.5 ? vUv.x * vUv.x : 0.5;
    col = mix(col, uCore, core * (1.0 - smoothstep(0.0, uCoreFrac * 0.5, ay)) * lift);
    if (uMode > 0.5) a *= vUv.x;
    a *= vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }`;

/** A pool of ribbons: `begin()`, then `push(...)` for each, then `end()` once per frame. */
class RibbonSet {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.InstancedBufferGeometry();
  private aA: THREE.InstancedBufferAttribute;
  private aB: THREE.InstancedBufferAttribute;
  private aS: THREE.InstancedBufferAttribute;
  private n = 0;

  constructor(readonly max: number, opts: RibbonOptions) {
    const quad = new THREE.PlaneGeometry(2, 2);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.attributes.position);
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aB = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aA', this.aA);
    this.geo.setAttribute('aB', this.aB);
    this.geo.setAttribute('aS', this.aS);
    this.geo.instanceCount = 0;
    const hot = new THREE.Color(opts.color ?? ASTRAL.hot);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uWidth: { value: opts.width }, uMode: { value: opts.comet ? 1 : 0 },
        uCoreFrac: { value: opts.coreFrac }, uHalo: { value: opts.halo },
        uHot: { value: hot }, uCore: { value: new THREE.Color(opts.coreColor ?? ASTRAL.core) },
        uHaloCol: { value: new THREE.Color(opts.haloColor ?? hot) },
      },
      vertexShader: ribbonVertex,
      fragmentShader: ribbonFragment,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  begin() {
    this.n = 0;
  }

  /** Draws the part `tail..head` (0..1) of the segment a -> b. `wScale` scales the width. */
  push(a: THREE.Vector3, b: THREE.Vector3, head: number, tail: number, alpha: number, wScale = 1) {
    if (this.n >= this.max || alpha <= 0.002 || head - tail < 1e-3) return;
    const i = this.n++;
    this.aA.setXYZ(i, a.x, a.y, a.z);
    this.aB.setXYZ(i, b.x, b.y, b.z);
    this.aS.setXYZW(i, head, tail, alpha, wScale);
  }

  end() {
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    this.aA.needsUpdate = true;
    this.aB.needsUpdate = true;
    this.aS.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// StarPoints
// ---------------------------------------------------------------------------------------------------------------

interface Star {
  live: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: number;
  alpha: number;
  spin: number;
  phase: number;
  age: number; // negative = still waiting to appear
  falling: boolean;
  fallAge: number;
  life: number;
  dropH: number; // > 0: the star streaks down from this height above `pos`
  dropDur: number;
}

export interface StarPointsOptions {
  /** Max stars alive at once. Default 48. */
  max?: number;
}

/**
 * Instanced four-point stars (hard shape, tiny white core, dark outline), camera-facing. `add(pos, size, delay)`
 * pops one in (3 frames, slight overshoot) and returns its handle; `place` moves it, `twinkle` is the size pulse
 * amplitude; `fall(i, vel)` turns it into a shooting star with a short tail; `update(dt)` each frame. Add `mesh`.
 */
export class StarPoints {
  readonly mesh = new THREE.Group();
  /** Size pulse amplitude (0 = steady). */
  twinkle = 0.16;
  /** Gravity for falling stars. */
  gravity = -7;
  /** Global fade, 0..1. */
  opacity = 1;
  private stars: Star[] = [];
  private cursor = 0;
  private geo = new THREE.InstancedBufferGeometry();
  private aP: THREE.InstancedBufferAttribute;
  private aS: THREE.InstancedBufferAttribute;
  private body: THREE.Mesh;
  private tails: RibbonSet;
  private time = 0;
  private ta = new THREE.Vector3();
  private rp = new THREE.Vector3();

  constructor(opts: StarPointsOptions = {}) {
    const max = opts.max ?? 48;
    const quad = new THREE.PlaneGeometry(2, 2);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.attributes.position);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aP', this.aP);
    this.geo.setAttribute('aS', this.aS);
    this.geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uHot: { value: new THREE.Color(ASTRAL.hot) }, uCore: { value: new THREE.Color(ASTRAL.core) },
        uDark: { value: new THREE.Color(0x2a1a6a) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aP; attribute vec4 aS;
        varying vec2 vP; varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(aP, 1.0);
          float c = cos(aS.z), s = sin(aS.z);
          vec2 o = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aS.x;
          mv.xy += o;
          vP = position.xy;
          vAlpha = aS.y;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHot, uCore, uDark;
        varying vec2 vP; varying float vAlpha;
        void main() {
          // Four-point star: a fat astroid. d > 0 inside.
          float a = pow(abs(vP.x), 0.72) + pow(abs(vP.y), 0.72);
          float d = 1.0 - a;
          float aa = max(fwidth(d) * 1.5, 1e-3);
          float body = smoothstep(0.0, aa, d);
          if (body * vAlpha < 0.004) discard;
          vec3 col = mix(uHot, uCore, smoothstep(0.35, 0.8, d));
          col = mix(uDark, col, smoothstep(0.02, 0.1, d));           // thin dark outline
          float dot0 = 1.0 - smoothstep(0.1, 0.16, length(vP));       // tiny white core
          col = mix(col, uCore, dot0);
          gl_FragColor = vec4(col, body * vAlpha);
        }`,
    });
    this.body = new THREE.Mesh(this.geo, mat);
    this.body.frustumCulled = false;
    this.body.renderOrder = 6;
    this.tails = new RibbonSet(max, { width: 0.26, coreFrac: 0.4, halo: 0.25, comet: true });
    this.tails.mesh.renderOrder = 5;
    this.mesh.add(this.tails.mesh, this.body);
    for (let i = 0; i < max; i++) {
      this.stars.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.5, alpha: 1, spin: 0, phase: 0,
        age: 0, falling: false, fallAge: 0, life: 1, dropH: 0, dropDur: 0,
      });
    }
  }

  /** A star at `pos` of half-size `size` (world units; 0.3 small .. 0.9 big), appearing after `delay` seconds. */
  add(pos: THREE.Vector3, size = 0.5, delay = 0): number {
    let idx = -1;
    for (let k = 0; k < this.stars.length; k++) {
      const j = (this.cursor + k) % this.stars.length;
      if (!this.stars[j].live) { idx = j; break; }
    }
    if (idx < 0) idx = this.cursor;
    this.cursor = (idx + 1) % this.stars.length;
    const s = this.stars[idx];
    s.live = true; s.pos.copy(pos); s.vel.set(0, 0, 0); s.size = size; s.alpha = 1;
    s.spin = (Math.random() - 0.5) * 0.5; s.phase = Math.random() * 6.28; s.age = -delay;
    s.falling = false; s.fallAge = 0; s.life = 1; s.dropH = 0; s.dropDur = 0;
    return idx;
  }

  /**
   * A star that streaks down from `height` above `pos` and lands there after `seconds` (plus `delay`), with a thin
   * tail while it falls. It stays on `pos` afterwards like any other star. Returns its handle.
   */
  drop(pos: THREE.Vector3, size: number, height: number, seconds: number, delay = 0): number {
    const i = this.add(pos, size, delay);
    this.stars[i].dropH = height;
    this.stars[i].dropDur = Math.max(seconds, 0.05);
    return i;
  }

  /** Moves a star (a figure that travels or turns). */
  place(i: number, pos: THREE.Vector3) {
    this.stars[i]?.pos.copy(pos);
  }

  position(i: number): THREE.Vector3 {
    return this.stars[i].pos;
  }

  setSize(i: number, size: number) {
    if (this.stars[i]) this.stars[i].size = size;
  }

  /** Hides a star now. */
  remove(i: number) {
    if (this.stars[i]) this.stars[i].live = false;
  }

  /** The star drops as a shooting star (default velocity: a small random drift, down). */
  fall(i: number, vel?: THREE.Vector3, life?: number) {
    const s = this.stars[i];
    if (!s || !s.live || s.falling) return;
    s.falling = true;
    s.fallAge = 0;
    s.dropH = 0;
    s.dropDur = 0;
    s.life = life ? life * (0.8 + Math.random() * 0.4) : 0.8 + Math.random() * 0.5;
    if (vel) s.vel.copy(vel);
    else s.vel.set((Math.random() - 0.5) * 2.4, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 2.4);
  }

  /** Every live star falls (`life` = seconds of the fall, default 0.8..1.3). */
  fallAll(speed = 1, life?: number) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (!s.live || s.falling || s.age < 0) continue;
      this.fall(i, undefined, life);
      s.vel.multiplyScalar(speed);
    }
  }

  /** Number of stars not yet fallen / hidden. */
  get standing() {
    let n = 0;
    for (const s of this.stars) if (s.live && !s.falling) n++;
    return n;
  }

  reset() {
    for (const s of this.stars) s.live = false;
    this.geo.instanceCount = 0;
    this.body.visible = false;
    this.tails.begin();
    this.tails.end();
    this.opacity = 1;
    this.time = 0;
  }

  update(dt: number) {
    this.time += dt;
    this.tails.begin();
    let n = 0;
    for (const s of this.stars) {
      if (!s.live) continue;
      s.age += dt;
      if (s.age < 0) continue;
      let size = s.size * easeOutBack(s.age / 0.1);
      let alpha = this.opacity;
      if (s.falling) {
        s.fallAge += dt;
        s.vel.y += this.gravity * dt;
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y < 0.04 && s.vel.y < 0) { s.pos.y = 0.04; s.vel.set(0, 0, 0); s.life = Math.min(s.life, s.fallAge + 0.1); }
        if (s.fallAge >= s.life) { s.live = false; continue; }
        const k = s.fallAge / s.life;
        size *= 1 - 0.55 * k * k;
        alpha *= 1 - clamp01((k - 0.55) / 0.45);
        const sp = s.vel.length();
        if (sp > 0.05) {
          const len = Math.min(0.9, 0.12 + sp * 0.12);
          this.ta.copy(s.pos).addScaledVector(s.vel, -len / sp);
          this.tails.push(this.ta, s.pos, 1, 0, alpha * 0.9);
        }
      } else {
        size *= 1 + this.twinkle * Math.sin(this.time * 6 + s.phase);
      }
      size = Math.max(size, MIN_SCALE);
      const rp = this.rp.copy(s.pos);
      if (!s.falling && s.dropDur > 0) {
        const u = clamp01(s.age / s.dropDur);
        if (u < 1) {
          rp.y += s.dropH * (1 - u * u);
          this.ta.copy(rp);
          this.ta.y += Math.min(2.2, 0.6 + s.dropH * 0.12 * (1 - u));
          this.tails.push(this.ta, rp, 1, 0, alpha * 0.9);
        }
      }
      this.aP.setXYZ(n, rp.x, rp.y, rp.z);
      this.aS.setXYZW(n, size, alpha * s.alpha, s.spin, 0);
      n++;
    }
    this.geo.instanceCount = n;
    this.body.visible = n > 0;
    this.aP.needsUpdate = true;
    this.aS.needsUpdate = true;
    this.tails.end();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ConstellationLines
// ---------------------------------------------------------------------------------------------------------------

interface Line {
  live: boolean;
  a: THREE.Vector3;
  b: THREE.Vector3;
  delay: number;
  dur: number;
  age: number;
}

interface Shard {
  live: boolean;
  a: THREE.Vector3;
  b: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

export interface ConstellationLinesOptions {
  /** Max lines alive at once. Default 40. */
  maxLines?: number;
  /** Max falling pieces alive at once. Default 2 x maxLines. */
  maxShards?: number;
}

/**
 * Crisp gold line segments (core ~0.08 wide, a soft 0.3 halo under it) that draw themselves. `connect(a, b, seconds,
 * delay)` starts a line that grows from a to b and returns its handle; `move(i, a, b)` re-aims it (a figure that
 * moves or turns); `snap(seconds)` breaks every line into short pieces that fall and fade; `fadeOut(seconds)` fades
 * the lot. `update(dt)` each frame. Add `mesh`.
 */
export class ConstellationLines {
  readonly mesh: THREE.Mesh;
  /** Global fade, 0..1. */
  opacity = 1;
  /** Gravity for the falling pieces. */
  gravity = -6;
  /** Width multiplier (a figure seen from far away wants fatter lines). */
  widthScale = 1;
  private ribbons: RibbonSet;
  private lines: Line[] = [];
  private shards: Shard[] = [];
  private sCursor = 0;
  private fade = -1;
  private fadeDur = 0;
  private m = new THREE.Vector3();

  constructor(opts: ConstellationLinesOptions = {}) {
    const maxL = opts.maxLines ?? 40, maxS = opts.maxShards ?? maxL * 2;
    this.ribbons = new RibbonSet(maxL + maxS, { width: 0.3, coreFrac: 0.28, halo: 0.2, color: ASTRAL.hot, coreColor: ASTRAL.core });
    this.mesh = this.ribbons.mesh;
    this.mesh.renderOrder = 4;
    for (let i = 0; i < maxL; i++) this.lines.push({ live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), delay: 0, dur: 0.2, age: 0 });
    for (let i = 0; i < maxS; i++) this.shards.push({ live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1 });
  }

  /** Starts a line a -> b that draws itself over `seconds` after `delay`. Returns its handle (or -1 when full). */
  connect(a: THREE.Vector3, b: THREE.Vector3, seconds = 0.2, delay = 0): number {
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      if (l.live) continue;
      l.live = true; l.a.copy(a); l.b.copy(b); l.dur = Math.max(seconds, 0.01); l.delay = delay; l.age = 0;
      return i;
    }
    return -1;
  }

  /** Re-aims a line's endpoints (its draw progress is kept). */
  move(i: number, a: THREE.Vector3, b: THREE.Vector3) {
    const l = this.lines[i];
    if (!l) return;
    l.a.copy(a);
    l.b.copy(b);
  }

  /** Breaks every line into two short pieces that drop and fade within `seconds`. */
  snap(seconds = 0.6) {
    for (const l of this.lines) {
      if (!l.live) continue;
      l.live = false;
      const prog = easeOut((l.age - l.delay) / l.dur);
      if (prog < 0.05) continue;
      const split = 0.35 + Math.random() * 0.3;
      const end = this.m.lerpVectors(l.a, l.b, prog);
      for (let k = 0; k < 2; k++) {
        const s = this.shards[this.sCursor];
        this.sCursor = (this.sCursor + 1) % this.shards.length;
        s.live = true;
        if (k === 0) { s.a.copy(l.a); s.b.lerpVectors(l.a, end, split); } else { s.a.lerpVectors(l.a, end, split); s.b.copy(end); }
        s.vel.set((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
        s.age = 0;
        s.life = seconds * (0.75 + Math.random() * 0.4);
      }
    }
  }

  /** All live lines fade out within `seconds`. */
  fadeOut(seconds: number) {
    this.fade = 0;
    this.fadeDur = Math.max(seconds, 0.02);
  }

  get active() {
    return this.lines.some((l) => l.live) || this.shards.some((s) => s.live);
  }

  reset() {
    for (const l of this.lines) l.live = false;
    for (const s of this.shards) s.live = false;
    this.fade = -1;
    this.opacity = 1;
    this.ribbons.begin();
    this.ribbons.end();
  }

  update(dt: number) {
    let fadeK = 1;
    if (this.fade >= 0) {
      this.fade += dt;
      fadeK = 1 - clamp01(this.fade / this.fadeDur);
      if (fadeK <= 0) {
        for (const l of this.lines) l.live = false;
        this.fade = -1;
      }
    }
    this.ribbons.begin();
    for (const l of this.lines) {
      if (!l.live) continue;
      l.age += dt;
      const u = (l.age - l.delay) / l.dur;
      if (u <= 0) continue;
      this.ribbons.push(l.a, l.b, easeOut(u), 0, this.opacity * fadeK, this.widthScale);
    }
    for (const s of this.shards) {
      if (!s.live) continue;
      s.age += dt;
      if (s.age >= s.life) { s.live = false; continue; }
      s.vel.y += this.gravity * dt;
      s.a.addScaledVector(s.vel, dt);
      s.b.addScaledVector(s.vel, dt);
      const k = s.age / s.life;
      this.m.addVectors(s.a, s.b).multiplyScalar(0.5);
      // Shrink toward the middle as it fades.
      const shrink = 1 - 0.6 * k;
      this.ribbons.push(s.a, s.b, 0.5 + 0.5 * shrink, 0.5 - 0.5 * shrink, (1 - clamp01((k - 0.4) / 0.6)) * this.opacity, this.widthScale);
    }
    this.ribbons.end();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// StarArrow
// ---------------------------------------------------------------------------------------------------------------

/**
 * A light arrow: a bright four-point head and a long tapered gold tail over a violet underlay. `fly(from, to,
 * seconds)` sends it; `onArrive` fires once when it gets there, the tail then draws in over ~0.1 s. `update(dt)`
 * each frame. Add `mesh`.
 */
export class StarArrow {
  readonly mesh = new THREE.Group();
  /** Called once on arrival. */
  onArrive: (() => void) | null = null;
  /** Longest visible tail (world units). */
  tailLength = 3.4;
  private head = new StarPoints({ max: 1 });
  private under = new RibbonSet(1, { width: 0.55, coreFrac: 1, halo: 0, comet: true, color: ASTRAL.body, coreColor: ASTRAL.body });
  private tail = new RibbonSet(1, { width: 0.34, coreFrac: 0.42, halo: 0.22, comet: true });
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private tailPt = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private dur = 0.3;
  private age = 0;
  private state: 0 | 1 | 2 = 0;
  private fadeAge = 0;
  private starId = -1;

  constructor() {
    this.under.mesh.renderOrder = 4;
    this.tail.mesh.renderOrder = 5;
    this.head.twinkle = 0;
    this.mesh.add(this.under.mesh, this.tail.mesh, this.head.mesh);
  }

  get active() {
    return this.state !== 0;
  }

  /** Current head position (valid while active). */
  get position() {
    return this.pos;
  }

  /** Flight progress 0..1. */
  get progress() {
    return this.state === 0 ? 0 : clamp01(this.age / this.dur);
  }

  fly(from: THREE.Vector3, to: THREE.Vector3, seconds: number) {
    this.from.copy(from);
    this.to.copy(to);
    this.pos.copy(from);
    this.dur = Math.max(seconds, 0.02);
    this.age = 0;
    this.state = 1;
    this.fadeAge = 0;
    this.dir.subVectors(to, from);
    this.head.reset();
    this.starId = this.head.add(from, 0.42);
  }

  reset() {
    this.state = 0;
    this.head.reset();
    this.under.begin(); this.under.end();
    this.tail.begin(); this.tail.end();
  }

  update(dt: number) {
    if (this.state === 0) return;
    let alpha = 1;
    if (this.state === 1) {
      this.age += dt;
      const u = clamp01(this.age / this.dur);
      this.pos.lerpVectors(this.from, this.to, Math.pow(u, 1.25));
      if (u >= 1) {
        this.state = 2;
        this.fadeAge = 0;
        this.onArrive?.();
      }
    } else {
      this.fadeAge += dt;
      if (this.fadeAge >= 0.12) { this.reset(); return; }
    }
    const travelled = this.pos.distanceTo(this.from);
    const len = Math.min(this.tailLength, travelled);
    const back = this.dir.clone().normalize();
    this.tailPt.copy(this.pos).addScaledVector(back, -len);
    if (this.state === 2) {
      const k = clamp01(this.fadeAge / 0.12);
      this.tailPt.lerp(this.pos, k);
      alpha = 1 - k * 0.5;
      this.head.remove(this.starId);
    } else {
      this.head.place(this.starId, this.pos);
    }
    this.under.begin(); this.under.push(this.tailPt, this.pos, 1, 0, 0.5 * alpha); this.under.end();
    this.tail.begin(); this.tail.push(this.tailPt, this.pos, 1, 0, alpha); this.tail.end();
    this.head.update(dt);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// StarChart
// ---------------------------------------------------------------------------------------------------------------

function drawChart(): HTMLCanvasElement {
  const S = 1024, C = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const polar = (r: number, a: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
  const circle = (r: number, lw: number) => { g.lineWidth = lw; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };

  circle(498, 6);
  circle(480, 3);
  // Tick ring: 72 ticks, every sixth long, every third medium.
  g.lineWidth = 4;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, len = i % 6 === 0 ? 40 : i % 3 === 0 ? 26 : 14;
    const [x0, y0] = polar(478, a), [x1, y1] = polar(478 - len, a);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  circle(432, 8);
  // Glyph band with 12 dividers.
  g.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x0, y0] = polar(432, a), [x1, y1] = polar(352, a);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  circle(352, 6);
  const glyphs: ((s: number) => void)[] = [
    (s) => { g.beginPath(); g.arc(0, 0, s, 0, 6.3); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.18, 0, 6.3); g.fill(); },
    (s) => { g.beginPath(); g.arc(-s * 0.3, 0, s, -1.3, 1.3); g.stroke(); g.beginPath(); g.arc(s * 0.5, 0, s * 0.8, 1.9, 4.4); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.9, s * 0.7); g.lineTo(-s * 0.9, s * 0.7); g.closePath(); g.stroke(); },
    (s) => { g.beginPath(); g.arc(0, 0, s * 0.8, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.moveTo(0, -s); g.lineTo(0, s); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(0, s); g.lineTo(0, -s); g.moveTo(-s * 0.6, -s * 0.4); g.lineTo(0, -s); g.lineTo(s * 0.6, -s * 0.4); g.moveTo(-s * 0.6, s * 0.3); g.lineTo(s * 0.6, s * 0.3); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, 0); g.lineTo(0, s); g.lineTo(-s * 0.7, 0); g.closePath(); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(-s, -s * 0.8); g.lineTo(s, s * 0.8); g.lineTo(s, -s * 0.8); g.lineTo(-s, s * 0.8); g.closePath(); g.stroke(); },
    (s) => { g.beginPath(); g.arc(-s * 0.5, -s * 0.3, s * 0.5, Math.PI, 0); g.arc(s * 0.5, -s * 0.3, s * 0.5, Math.PI, 0); g.moveTo(0, -s * 0.3); g.lineTo(0, s); g.stroke(); },
    (s) => { g.beginPath(); g.arc(-s * 0.5, 0, s * 0.5, 0, 6.3); g.stroke(); g.beginPath(); g.arc(s * 0.5, 0, s * 0.5, 0, 6.3); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(-s * 0.8, -s); g.lineTo(s * 0.8, -s); g.lineTo(-s * 0.8, s); g.lineTo(s * 0.8, s); g.closePath(); g.stroke(); },
    (s) => { g.beginPath(); g.moveTo(-s, s * 0.4); g.lineTo(-s * 0.4, -s * 0.5); g.lineTo(s * 0.2, s * 0.5); g.lineTo(s, -s * 0.4); g.stroke(); },
    (s) => { g.beginPath(); g.arc(-s * 0.9, 0, s * 0.9, -1.2, 1.2); g.stroke(); g.beginPath(); g.arc(s * 0.9, 0, s * 0.9, Math.PI - 1.2, Math.PI + 1.2); g.stroke(); g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(s * 0.6, 0); g.stroke(); },
  ];
  g.lineWidth = 7;
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    const [x, y] = polar(392, a);
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    glyphs[i](26);
    g.restore();
  }
  // Inner dashed ring and a seven-point star figure with small star dots at the vertices.
  g.lineWidth = 5;
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * Math.PI * 2;
    g.beginPath(); g.arc(C, C, 318, a0, a0 + 0.075); g.stroke();
  }
  g.lineWidth = 3.5;
  const pts: [number, number][] = [];
  for (let i = 0; i < 7; i++) pts.push(polar(280, (i / 7) * Math.PI * 2 - Math.PI / 2));
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const p = pts[(i * 3) % 7];
    if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
  }
  g.closePath();
  g.stroke();
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 9, 0, 6.3); g.fill(); }
  circle(150, 4);
  return cv;
}

let chartTexture: THREE.CanvasTexture | null = null;

/**
 * The pale foil: a star-chart ring on the ground drawn on a canvas in parchment colour (tick marks, twelve glyphs, a
 * dashed ring, a seven-point figure), not glowing. `set(center, radius)` places it; `reveal` 0..1 draws it on as a
 * sweep around the circle; `opacity` fades it; `hole` (0..1 of the radius) hides the busy centre; `spin` turns it.
 * Add `mesh`.
 */
export class StarChart {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.05;
  private mat: THREE.ShaderMaterial;
  private _reveal = 0;
  private _opacity = 1;

  constructor(opts: { color?: THREE.ColorRepresentation } = {}) {
    if (!chartTexture) {
      chartTexture = new THREE.CanvasTexture(drawChart());
      chartTexture.colorSpace = THREE.SRGBColorSpace;
      chartTexture.anisotropy = 8;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uMap: { value: chartTexture }, uColor: { value: new THREE.Color(opts.color ?? ASTRAL.foil) },
        uReveal: { value: 0 }, uOpacity: { value: 1 }, uHole: { value: 0 }, uSpin: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uReveal, uOpacity, uHole, uSpin;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float sweep = fract(atan(p.x, p.y) / 6.28318530718);
          float m = 1.0 - smoothstep(uReveal * 1.02 - 0.012, uReveal * 1.02, sweep);
          float c = cos(uSpin), s = sin(uSpin);
          vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          float a = texture2D(uMap, q).a;
          float r = length(p) * 2.0;
          float hole = uHole > 0.001 ? smoothstep(uHole * 0.96, uHole, r) : 1.0;
          float o = a * m * uOpacity * hole;
          if (o < 0.004) discard;
          gl_FragColor = vec4(uColor * 0.93, o);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
  }

  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }
  /** Fraction of the radius left empty in the middle (0 = none). */
  get hole() { return this.mat.uniforms.uHole.value as number; }
  set hole(v: number) { this.mat.uniforms.uHole.value = v; }
  /** In-plane rotation (radians). */
  get spin() { return this.mat.uniforms.uSpin.value as number; }
  set spin(v: number) { this.mat.uniforms.uSpin.value = v; }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  /** Centres the chart at the x / z of `center`. */
  set(center: THREE.Vector3, radius: number) {
    this.mesh.position.set(center.x, this.y, center.z);
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this.reveal = 0;
    this.opacity = 1;
    this.hole = 0;
    this.spin = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// NightVeil
// ---------------------------------------------------------------------------------------------------------------

/**
 * The dark layer: a translucent dark-violet night with a few tiny stars. `set(center, radius, height)` is a ground
 * disc (height ~0) or a dome around a point; `setPlane(center, normal, rx, ry)` is an upright elliptical patch for a
 * figure drawn in the sky. `opacity` fades it. Add `mesh`.
 */
export class NightVeil {
  readonly mesh = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private dome: THREE.Mesh;
  private patch: THREE.Mesh;
  private _opacity = 1;
  private time = 0;
  /** Peak alpha of the night. */
  strength = 0.62;
  private zAxis = new THREE.Vector3(0, 0, 1);

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uBody: { value: new THREE.Color(ASTRAL.body) }, uDark: { value: new THREE.Color(0x0c0724) },
        uStar: { value: new THREE.Color(ASTRAL.hot) },
        uOpacity: { value: 0 }, uTime: { value: 0 }, uPlane: { value: 0 }, uBackOnly: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vU;
        void main() { vU = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uStar; uniform float uOpacity, uTime, uPlane, uBackOnly;
        varying vec3 vU;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          if (uBackOnly > 0.5 && gl_FrontFacing) discard;
          vec2 q = uPlane > 0.5 ? vU.xy : vU.xz;
          float r = length(q);
          float edge = 1.0 - smoothstep(0.62, 1.0, r);
          vec3 col = mix(uDark, uBody, 0.12 + 0.14 * (1.0 - r));
          float a = 0.62 * edge;
          vec2 p = q * 7.0;
          vec2 cell = floor(p);
          float h = hash(cell);
          vec2 c = vec2(0.25) + 0.5 * vec2(hash(cell + 3.1), hash(cell + 7.7));
          float d = length(fract(p) - c);
          float tw = 0.65 + 0.35 * sin(uTime * 3.0 + h * 40.0);
          float st = step(0.9, h) * (1.0 - smoothstep(0.045, 0.085, d)) * tw * edge;
          col = mix(col, uStar, st);
          a = max(a, st * 0.95);
          a *= uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat);
    this.patch = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    for (const m of [this.dome, this.patch]) { m.frustumCulled = false; m.visible = false; m.renderOrder = 0; this.mesh.add(m); }
  }

  get opacity() { return this._opacity; }
  set opacity(v: number) {
    this._opacity = v;
    this.mat.uniforms.uOpacity.value = v * (this.strength / 0.62);
    this.dome.visible = this.dome.userData.on === true && v > 0.004;
    this.patch.visible = this.patch.userData.on === true && v > 0.004;
  }

  /** A ground disc (small `height`) or a dome of `height` over it. */
  set(center: THREE.Vector3, radius: number, height = 0) {
    this.dome.userData.on = true;
    this.patch.userData.on = false;
    this.patch.visible = false;
    this.dome.position.set(center.x, 0.04 + center.y, center.z);
    this.dome.scale.set(Math.max(radius, MIN_SCALE), Math.max(height, 1e-3), Math.max(radius, MIN_SCALE));
    this.mat.uniforms.uPlane.value = 0;
    this.mat.uniforms.uBackOnly.value = height > radius * 0.35 ? 1 : 0;
    this.opacity = this._opacity;
  }

  /** An upright elliptical patch facing `normal` (the figure's plane). */
  setPlane(center: THREE.Vector3, normal: THREE.Vector3, rx: number, ry: number) {
    this.patch.userData.on = true;
    this.dome.userData.on = false;
    this.dome.visible = false;
    this.patch.position.copy(center);
    this.patch.quaternion.setFromUnitVectors(this.zAxis, normal.clone().normalize());
    this.patch.scale.set(Math.max(rx, MIN_SCALE), Math.max(ry, MIN_SCALE), 1);
    this.mat.uniforms.uPlane.value = 1;
    this.mat.uniforms.uBackOnly.value = 0;
    this.opacity = this._opacity;
  }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
  }

  reset() {
    this._opacity = 0;
    this.dome.userData.on = false;
    this.patch.userData.on = false;
    this.dome.visible = false;
    this.patch.visible = false;
    this.mat.uniforms.uOpacity.value = 0;
  }
}
