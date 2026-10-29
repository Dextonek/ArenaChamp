import * as THREE from 'three';

/**
 * The bard kit (pipeline/designs/kit-bard.md): sound made visible. Flowing five-line staves (`Stave`), dark ink note
 * glyphs with a glowing rose rim (`Notes`), crisp quick sound rings (`SoundRings`) and a golden lyre that strums
 * (`Lyre`). Everything is pooled, takes world-space positions and has `reset()`. Staves and notes are unlit camera-facing
 * shapes, the lyre is toon-lit gold. Materials stay below the bloom threshold.
 */

/** Palette. Numbers for `THREE.Color`, `BARD_CSS` for APIs that want a string. `foil` (parchment) is the pale foil. */
export const BARD = {
  core: 0xffffff,
  hot: 0xffb8e6,
  body: 0xe04aa8,
  accent: 0xffd24a,
  dark: 0x1e0a1a,
  foil: 0xf2e6d0,
} as const;

export const BARD_CSS = {
  core: '#ffffff',
  hot: '#ffb8e6',
  body: '#e04aa8',
  accent: '#ffd24a',
  dark: '#1e0a1a',
  foil: '#f2e6d0',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 3);
const backOut = (x: number) => { const t = clamp01(x) - 1; return 1 + 2.2 * t * t * t + 1.2 * t * t; };
const col = (hex: number, gain = 0.94) => new THREE.Color(hex).multiplyScalar(gain);

// ---------------------------------------------------------------------------------------------------------------
// Stave
// ---------------------------------------------------------------------------------------------------------------

const LINES = 5;

/**
 * A five-line music stave along a path: five thin parallel ribbons in parchment with a rose glow edge, camera-facing,
 * unlit, gently waving. `setPath(points, width, head, tail)` sets the path (world points, in order) and the visible
 * stretch of it (`tail`..`head`, fractions 0..1 of the path); `wave(amplitude)` makes it undulate; `at(u, out)` gives the
 * point at fraction `u` (with the wave) so notes can ride it. Each line is `width` wide and the lines are about
 * 1.9 x `width` apart. Call `setPath` any time the path moves, then `update(dt)` each frame. `alpha` fades it. Add `mesh`.
 */
export class Stave {
  readonly mesh: THREE.Mesh;
  frozen = false;
  alpha = 1;
  private geo = new THREE.BufferGeometry();
  private pts: THREE.Vector3[] = [];
  private tmp: THREE.Vector3[] = [];
  private n = 0;
  private _head = 1;
  private _tail = 0;
  private amp = 0;
  private time = 0;
  private phase = Math.random() * 6.28;
  private pos: Float32Array;
  private nxt: Float32Array;
  private side: Float32Array;
  private line: Float32Array;
  private alp: Float32Array;
  private mat: THREE.ShaderMaterial;

  constructor(private samples = 48) {
    const nv = LINES * samples * 2;
    this.pos = new Float32Array(nv * 3);
    this.nxt = new Float32Array(nv * 3);
    this.side = new Float32Array(nv);
    this.line = new Float32Array(nv);
    this.alp = new Float32Array(nv);
    for (let k = 0; k < samples; k++) this.tmp.push(new THREE.Vector3());
    const idx: number[] = [];
    for (let l = 0; l < LINES; l++) {
      for (let k = 0; k < samples - 1; k++) {
        const a = (l * samples + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setIndex(idx);
    const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('aNext', dyn(this.nxt, 3));
    this.geo.setAttribute('aSide', dyn(this.side, 1));
    this.geo.setAttribute('aLine', dyn(this.line, 1));
    this.geo.setAttribute('aA', dyn(this.alp, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uHalf: { value: 0.035 }, uSpace: { value: 0.12 }, uAlpha: { value: 1 },
        uPaper: { value: col(BARD.foil) }, uRose: { value: col(BARD.body) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aNext; attribute float aSide; attribute float aLine; attribute float aA;
        uniform float uHalf; uniform float uSpace;
        varying float vS; varying float vA;
        void main() {
          vec4 c = modelViewMatrix * vec4(position, 1.0);
          vec4 n = modelViewMatrix * vec4(aNext, 1.0);
          vec2 d = n.xy - c.xy;
          float l = length(d);
          d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
          c.xy += vec2(-d.y, d.x) * (aLine * uSpace + aSide * uHalf * (0.55 + 0.45 * aA));
          vS = aSide; vA = aA;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPaper, uRose; uniform float uAlpha; varying float vS; varying float vA;
        void main() {
          vec3 c = mix(uPaper, uRose, smoothstep(0.3, 0.9, abs(vS)));
          gl_FragColor = vec4(c, vA * uAlpha);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
  }

  get head() {
    return this._head;
  }

  get tail() {
    return this._tail;
  }

  setPath(points: THREE.Vector3[], width = 0.07, head = 1, tail = 0) {
    this.n = points.length;
    while (this.pts.length < this.n) this.pts.push(new THREE.Vector3());
    for (let i = 0; i < this.n; i++) this.pts[i].copy(points[i]);
    this._head = clamp01(head);
    this._tail = clamp01(tail);
    this.mat.uniforms.uHalf.value = width * 0.5;
    this.mat.uniforms.uSpace.value = width * 1.9;
  }

  /** Sets the visible stretch without touching the path. */
  setRange(head: number, tail = 0) {
    this._head = clamp01(head);
    this._tail = clamp01(tail);
  }

  wave(amplitude: number) {
    this.amp = amplitude;
  }

  /** The point at fraction `u` of the path (with the wave). */
  at(u: number, out: THREE.Vector3) {
    if (this.n < 1) return out.set(0, 0, 0);
    if (this.n < 2) return out.copy(this.pts[0]);
    const uu = clamp01(u);
    const f = uu * (this.n - 1), i = Math.min(Math.floor(f), this.n - 2);
    out.lerpVectors(this.pts[i], this.pts[i + 1], f - i);
    if (this.amp > 0) out.y += this.amp * Math.sin(uu * 9 + this.phase + this.time * 3.2);
    return out;
  }

  reset() {
    this.n = 0;
    this.amp = 0;
    this.time = 0;
    this.alpha = 1;
    this.frozen = false;
    this.mesh.visible = false;
    this.geo.setDrawRange(0, 0);
  }

  update(dt: number) {
    if (!this.frozen) this.time += dt;
    const S = this.samples;
    if (this.n < 2 || this._head - this._tail < 0.01 || this.alpha <= 0.001) {
      this.mesh.visible = false;
      this.geo.setDrawRange(0, 0);
      return;
    }
    this.mesh.visible = true;
    this.mat.uniforms.uAlpha.value = this.alpha;
    for (let k = 0; k < S; k++) this.at(this._tail + (this._head - this._tail) * (k / (S - 1)), this.tmp[k]);
    for (let l = 0; l < LINES; l++) {
      for (let k = 0; k < S; k++) {
        const p = this.tmp[k], a = Math.min(1, k / 2.5, (S - 1 - k) / 2.5);
        const nx = k < S - 1 ? this.tmp[k + 1] : null;
        for (let s = 0; s < 2; s++) {
          const v = (l * S + k) * 2 + s, o = v * 3;
          this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
          if (nx) { this.nxt[o] = nx.x; this.nxt[o + 1] = nx.y; this.nxt[o + 2] = nx.z; }
          else { const q = this.tmp[k - 1]; this.nxt[o] = 2 * p.x - q.x; this.nxt[o + 1] = 2 * p.y - q.y; this.nxt[o + 2] = 2 * p.z - q.z; }
          this.side[v] = s === 0 ? -1 : 1;
          this.line[v] = l - 2;
          this.alp[v] = Math.max(a, 0);
        }
      }
    }
    this.geo.setDrawRange(0, LINES * (S - 1) * 6);
    for (const nm of ['position', 'aNext', 'aSide', 'aLine', 'aA']) this.geo.attributes[nm].needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------------------------

/** Glyph ids for `Notes`. */
export const GLYPH = { quarter: 0, eighth: 1, beamed: 2, clef: 3, rest: 4 } as const;
const CELL = 128;
const GLYPH_COUNT = 5;
let glyphTex: THREE.CanvasTexture | undefined;

/**
 * The glyph atlas: five cells (quarter, eighth, beamed pair, treble clef, quarter rest). Red marks the ink, green the
 * rim, so the shader can colour them (dark ink and rose rim, or gold).
 */
function glyphTexture() {
  if (glyphTex) return glyphTex;
  const c = document.createElement('canvas');
  c.width = CELL * GLYPH_COUNT;
  c.height = CELL;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const head = (x: number, y: number, rx: number, ry: number, k: number) => {
    g.beginPath();
    g.ellipse(x, y, rx + k, ry + k, -0.45, 0, Math.PI * 2);
    g.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  for (let i = 0; i < GLYPH_COUNT; i++) {
    for (let pass = 0; pass < 2; pass++) {
      const rim = pass === 0, k = rim ? 0.06 : 0, color = rim ? '#00ff00' : '#ff0000';
      g.save();
      g.translate(i * CELL, 0);
      g.scale(CELL, CELL);
      g.fillStyle = color;
      g.strokeStyle = color;
      if (i === GLYPH.quarter) {
        head(0.36, 0.77, 0.21, 0.145, k);
        line(0.54, 0.72, 0.54, 0.1, 0.085 + k);
      } else if (i === GLYPH.eighth) {
        head(0.34, 0.77, 0.21, 0.145, k);
        line(0.52, 0.72, 0.52, 0.1, 0.085 + k);
        g.lineWidth = 0.1 + k;
        g.beginPath();
        g.moveTo(0.52, 0.1);
        g.bezierCurveTo(0.66, 0.26, 0.9, 0.34, 0.8, 0.62);
        g.stroke();
      } else if (i === GLYPH.beamed) {
        head(0.24, 0.8, 0.18, 0.13, k);
        head(0.7, 0.72, 0.18, 0.13, k);
        line(0.4, 0.76, 0.4, 0.2, 0.08 + k);
        line(0.86, 0.68, 0.86, 0.12, 0.08 + k);
        g.beginPath();
        g.moveTo(0.38, 0.1);
        g.lineTo(0.88, 0.02);
        g.lineTo(0.88, 0.2);
        g.lineTo(0.38, 0.28);
        g.closePath();
        g.fill();
        if (rim) { g.lineWidth = k * 2; g.stroke(); }
      } else if (i === GLYPH.clef) {
        g.lineWidth = 0.085 + k;
        g.beginPath();
        g.moveTo(0.56, 0.04);
        g.bezierCurveTo(0.8, 0.16, 0.66, 0.38, 0.48, 0.52);
        g.bezierCurveTo(0.2, 0.7, 0.3, 0.94, 0.5, 0.88);
        g.bezierCurveTo(0.74, 0.82, 0.68, 0.54, 0.46, 0.5);
        g.bezierCurveTo(0.34, 0.46, 0.34, 0.3, 0.42, 0.2);
        g.stroke();
        line(0.46, 0.5, 0.4, 0.94, 0.07 + k);
        g.beginPath();
        g.arc(0.38, 0.93, 0.07 + k, 0, Math.PI * 2);
        g.fill();
      } else {
        g.lineWidth = 0.12 + k;
        g.beginPath();
        g.moveTo(0.4, 0.1);
        g.lineTo(0.62, 0.3);
        g.lineTo(0.4, 0.5);
        g.lineTo(0.62, 0.68);
        g.bezierCurveTo(0.3, 0.62, 0.3, 0.92, 0.58, 0.9);
        g.stroke();
      }
      g.restore();
    }
  }
  glyphTex = new THREE.CanvasTexture(c);
  glyphTex.colorSpace = THREE.NoColorSpace;
  glyphTex.anisotropy = 4;
  return glyphTex;
}

type NoteMode = 'free' | 'ride' | 'hold';

interface NoteItem {
  live: boolean;
  mode: NoteMode;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  /** Real seconds since it appeared (the pop-in ignores `frozen`). */
  born: number;
  /** 0 = lives until killed. */
  life: number;
  size: number;
  glyph: number;
  rot: number;
  spin: number;
  gold: number;
  grav: number;
  fade: number;
  stave: Stave | null;
  u: number;
  du: number;
  lift: number;
  wrap: boolean;
}

export interface NoteOptions {
  /** Glyph size in metres (the cell; the drawn note fills about 85% of it). Default 0.7. */
  size?: number;
  gold?: boolean;
  /** Downward acceleration (negative rises). Default 2.5. */
  gravity?: number;
  /** Random velocity added to `vel`. Default 1. */
  spread?: number;
  /** Glyph id (`GLYPH`); random note glyphs when omitted. */
  glyph?: number;
}

export interface RideOptions {
  size?: number;
  gold?: boolean;
  /** Fraction of the stave per second (negative rides backwards). Default 0.3. */
  du?: number;
  /** 0 = rides until it leaves the stave. */
  life?: number;
  /** Height above the stave line. Default 0.18. */
  lift?: number;
  /** Loops round a closed stave instead of leaving it. */
  wrap?: boolean;
}

const randGlyph = () => [0, 1, 2, 0, 1, 3, 2][Math.floor(Math.random() * 7)];

/**
 * Pooled note glyphs (quarter, eighth, beamed pair, treble clef, rest): flat camera-facing billboards in dark ink with a
 * glowing rose rim (gold ones for heals). One instanced mesh. `emit(pos, vel, count, life, opts)` throws free notes,
 * `ride(stave, u, glyph, opts)` slides one along a stave, `hold(pos, glyph, size)` keeps one in place (move it with
 * `move`, grow it with `resize`, end it with `kill`). `fall` and `scatter` turn every note into a free one that drops
 * or flies off and fades. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Notes {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private items: NoteItem[] = [];
  private cursor = 0;
  private aN: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(private max = 64) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aN = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aN', this.aN);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: glyphTexture() },
        uInk: { value: col(BARD.dark, 1) }, uRim: { value: col(BARD.body) },
        uGold: { value: col(BARD.accent) }, uGoldRim: { value: col(0xfff0b8) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aN; varying vec2 vUv; varying float vG; varying float vA; varying float vGold;
        void main() {
          vUv = position.xy + 0.5; vG = aN.x; vA = aN.y; vGold = aN.z;
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          float cr = cos(aN.w), sr = sin(aN.w);
          vec2 p = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr);
          c.xy += p * s;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform vec3 uInk, uRim, uGold, uGoldRim;
        varying vec2 vUv; varying float vG; varying float vA; varying float vGold;
        void main() {
          vec4 t = texture2D(uTex, vec2((vG + vUv.x) / ${GLYPH_COUNT}.0, vUv.y));
          if (t.a < 0.05) discard;
          vec3 ink = mix(uInk, uGold, vGold);
          vec3 rim = mix(uRim, uGoldRim, vGold);
          vec3 c = (ink * t.r + rim * t.g) / max(t.r + t.g, 1e-3);
          gl_FragColor = vec4(c, t.a * vA);
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.items.push({
        live: false, mode: 'free', pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, born: 0, life: 1, size: 0.7, glyph: 0, rot: 0,
        spin: 0, gold: 0, grav: 2.5, fade: 1, stave: null, u: 0, du: 0.3, lift: 0.18, wrap: false,
      });
    }
  }

  /** True while any note is still shown. */
  get busy() {
    return this.items.some((n) => n.live);
  }

  private take() {
    let idx = this.items.findIndex((n) => !n.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.max; }
    const n = this.items[idx];
    n.live = true;
    n.age = 0;
    n.fade = 1;
    n.born = 0;
    n.stave = null;
    n.rot = (Math.random() - 0.5) * 0.5;
    n.spin = (Math.random() - 0.5) * 1.6;
    return { n, idx };
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, count = 1, life = 0.8, o: NoteOptions = {}) {
    for (let i = 0; i < count; i++) {
      const { n } = this.take();
      const sp = o.spread ?? 1;
      n.mode = 'free';
      n.pos.copy(pos);
      n.vel.set(vel.x + (Math.random() - 0.5) * 2 * sp, vel.y + (Math.random() - 0.3) * sp, vel.z + (Math.random() - 0.5) * 2 * sp);
      n.life = life * (0.8 + Math.random() * 0.4);
      n.size = (o.size ?? 0.7) * (0.85 + Math.random() * 0.3);
      n.glyph = o.glyph ?? randGlyph();
      n.gold = o.gold ? 1 : 0;
      n.grav = o.gravity ?? 2.5;
    }
  }

  ride(stave: Stave, u: number, glyph = -1, o: RideOptions = {}) {
    const { n, idx } = this.take();
    n.mode = 'ride';
    n.stave = stave;
    n.u = u;
    n.du = o.du ?? 0.3;
    n.lift = o.lift ?? 0.18;
    n.wrap = !!o.wrap;
    n.life = o.life ?? 0;
    n.size = (o.size ?? 0.7) * (0.85 + Math.random() * 0.3);
    n.glyph = glyph >= 0 ? glyph : randGlyph();
    n.gold = o.gold ? 1 : 0;
    n.spin = 0;
    n.rot = (Math.random() - 0.5) * 0.3;
    stave.at(u, n.pos);
    n.pos.y += n.lift;
    return idx;
  }

  hold(pos: THREE.Vector3, glyph: number, size: number, gold = false) {
    const { n, idx } = this.take();
    n.mode = 'hold';
    n.pos.copy(pos);
    n.life = 0;
    n.size = size;
    n.glyph = glyph;
    n.gold = gold ? 1 : 0;
    n.spin = 0;
    n.rot = 0;
    return idx;
  }

  move(i: number, pos: THREE.Vector3) {
    this.items[i].pos.copy(pos);
  }

  resize(i: number, size: number) {
    this.items[i].size = size;
  }

  kill(i: number) {
    this.items[i].live = false;
  }

  /** Every free or riding note starts to fall and fades out over about `life` seconds. */
  fall(gravity = 6, life = 1) {
    for (const n of this.items) {
      if (!n.live || n.mode === 'hold') continue;
      n.mode = 'free';
      n.vel.set((Math.random() - 0.5) * 0.8, -0.3 - Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
      n.grav = gravity * (0.7 + Math.random() * 0.6);
      n.age = 0;
      n.life = life * (0.7 + Math.random() * 0.5);
      n.spin = (Math.random() - 0.5) * 3;
    }
  }

  /** Every free or riding note is flung away from `origin` at about `speed`, drifts down and fades over `life`. */
  scatter(origin: THREE.Vector3, speed = 8, life = 1.8, gravity = 2.5) {
    for (const n of this.items) {
      if (!n.live || n.mode === 'hold') continue;
      n.mode = 'free';
      const dx = n.pos.x - origin.x, dz = n.pos.z - origin.z, l = Math.hypot(dx, dz);
      const a = (l > 0.05 ? Math.atan2(dz, dx) : Math.random() * 6.28) + (Math.random() - 0.5) * 0.5;
      const sp = speed * (0.5 + Math.random() * 0.8);
      n.vel.set(Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp);
      n.grav = gravity;
      n.age = 0;
      n.life = life * (0.75 + Math.random() * 0.5);
      n.spin = (Math.random() - 0.5) * 4;
    }
  }

  reset() {
    for (const n of this.items) { n.live = false; n.stave = null; }
    this.mesh.count = 0;
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let cnt = 0;
    const a = this.aN.array as Float32Array;
    for (const n of this.items) {
      if (!n.live) continue;
      n.age += d;
      n.born += dt;
      if (n.life > 0 && n.age >= n.life) { n.live = false; continue; }
      if (n.mode === 'free') {
        n.vel.y -= n.grav * d;
        n.vel.multiplyScalar(Math.max(0, 1 - 0.8 * d));
        n.pos.addScaledVector(n.vel, d);
        if (n.pos.y < 0.15) { n.pos.y = 0.15; n.vel.y = Math.abs(n.vel.y) * 0.2; }
        n.rot += n.spin * d;
      } else if (n.mode === 'ride' && n.stave) {
        n.u += n.du * d;
        if (n.wrap) n.u -= Math.floor(n.u);
        else if (n.u > n.stave.head || n.u < n.stave.tail) { n.live = false; continue; }
        n.stave.at(n.u, this.tmp);
        n.pos.copy(this.tmp);
        n.pos.y += n.lift;
      }
      let alpha = 1, sz = n.size;
      if (n.life > 0) {
        alpha = clamp01((n.life - n.age) / (n.life * 0.35));
        sz *= 0.65 + 0.35 * alpha;
      }
      const pop = backOut(n.born / 0.14);
      sz *= Math.max(pop, MIN_SCALE);
      this.m.compose(n.pos, this.q.identity(), this.s.setScalar(Math.max(sz, MIN_SCALE)));
      this.mesh.setMatrixAt(cnt, this.m);
      a[cnt * 4] = n.glyph;
      a[cnt * 4 + 1] = alpha * n.fade;
      a[cnt * 4 + 2] = n.gold;
      a[cnt * 4 + 3] = n.rot;
      cnt++;
    }
    this.mesh.count = cnt;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aN.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sound rings
// ---------------------------------------------------------------------------------------------------------------

export interface RingOptions {
  /** Start radius (default 0.3). An inward ring ends here. */
  r0?: number;
  /** The centre travels to this point over the ring's life (a ring racing down). */
  to?: THREE.Vector3;
  /** Band width in metres (default 0.16). */
  width?: number;
  /** `rose` (white lead), `dark` (ink with a parchment lead, for the hush) or `gold`. */
  tone?: 'rose' | 'dark' | 'gold';
  /** Starts at `radius` and snaps in to `r0`. */
  inward?: boolean;
}

interface Ring {
  live: boolean;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  from: THREE.Vector3;
  to: THREE.Vector3;
  hasTo: boolean;
  r0: number;
  r1: number;
  age: number;
  dur: number;
  width: number;
  inward: boolean;
}

const TONES = {
  rose: { lead: 0xffffff, body: BARD.body },
  dark: { lead: BARD.foil, body: BARD.dark },
  gold: { lead: 0xfff6d0, body: BARD.accent },
} as const;

/**
 * Quick crisp sound rings: a thin band, white leading edge and a rose body, expanding fast and fading.
 * `pulse(center, radius, seconds, normal, opts)` starts one lying in the plane facing `normal` (default up, on the floor).
 * Pooled (`max`). `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class SoundRings {
  readonly mesh = new THREE.Group();
  frozen = false;
  private rings: Ring[] = [];
  private cursor = 0;
  private q = new THREE.Quaternion();

  constructor(private max = 10) {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uW: { value: 0.1 }, uA: { value: 1 }, uLead: { value: new THREE.Color() }, uBody: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uW; uniform float uA; uniform vec3 uLead, uBody; varying vec2 vP;
          void main() {
            float d = (0.97 - length(vP)) / uW;
            if (d < 0.0 || d > 1.0) discard;
            vec3 c = mix(uLead, uBody, smoothstep(0.12, 0.5, d));
            float a = uA * (1.0 - 0.45 * d) * smoothstep(0.0, 0.06, d) * smoothstep(1.0, 0.9, d);
            gl_FragColor = vec4(c, a);
          }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 8;
      this.mesh.add(mesh);
      this.rings.push({
        live: false, mesh, mat, from: new THREE.Vector3(), to: new THREE.Vector3(), hasTo: false, r0: 0.3, r1: 1, age: 0, dur: 0.4, width: 0.16,
        inward: false,
      });
    }
  }

  /** True while any ring is still shown. */
  get busy() {
    return this.rings.some((r) => r.live);
  }

  pulse(center: THREE.Vector3, radius: number, seconds: number, normal: THREE.Vector3 = UP, o: RingOptions = {}) {
    let idx = this.rings.findIndex((r) => !r.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.max; }
    const r = this.rings[idx];
    const tone = TONES[o.tone ?? 'rose'];
    r.live = true;
    r.from.copy(center);
    r.hasTo = !!o.to;
    if (o.to) r.to.copy(o.to);
    r.r0 = o.r0 ?? 0.3;
    r.r1 = radius;
    r.age = 0;
    r.dur = Math.max(seconds, 0.05);
    r.width = o.width ?? 0.16;
    r.inward = !!o.inward;
    r.mat.uniforms.uLead.value.setHex(tone.lead).multiplyScalar(0.94);
    r.mat.uniforms.uBody.value.setHex(tone.body).multiplyScalar(0.94);
    this.q.setFromUnitVectors(UP, normal.lengthSq() > 1e-8 ? normal.clone().normalize() : UP);
    r.mesh.quaternion.copy(this.q);
    r.mesh.visible = true;
    this.place(r);
  }

  private place(r: Ring) {
    const k = clamp01(r.age / r.dur);
    const R = r.inward ? r.r1 + (r.r0 - r.r1) * easeIn(k) : r.r0 + (r.r1 - r.r0) * easeOut(k);
    if (r.hasTo) r.mesh.position.lerpVectors(r.from, r.to, easeIn(k) * 0.6 + k * 0.4);
    else r.mesh.position.copy(r.from);
    r.mesh.scale.setScalar(Math.max(R, MIN_SCALE));
    r.mat.uniforms.uW.value = Math.min(0.5, r.width / Math.max(R, 0.05));
    r.mat.uniforms.uA.value = r.inward ? (k < 0.75 ? 1 : 1 - (k - 0.75) * 4) : Math.pow(1 - k, 1.2);
  }

  reset() {
    for (const r of this.rings) { r.live = false; r.mesh.visible = false; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (const r of this.rings) {
      if (!r.live) continue;
      r.age += d;
      if (r.age >= r.dur) { r.live = false; r.mesh.visible = false; continue; }
      this.place(r);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Lyre
// ---------------------------------------------------------------------------------------------------------------

const STRINGS = 7;
const STR_PTS = 9;
const LYRE_TOP = 0.99;
const LYRE_BOT = 0.12;

let lyreMat: THREE.ShaderMaterial | undefined;
/** Toon gold: three flat bands (lit / mid / shade), written as on-screen colours with a gain below bloom. */
function goldMaterial() {
  lyreMat ??= new THREE.ShaderMaterial({
    uniforms: { uLit: { value: col(0xffd24a) }, uMid: { value: col(0xd99a1e) }, uShade: { value: col(0x8a5a14) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit, uMid, uShade; varying vec3 vN;
      void main() {
        float nl = dot(normalize(vN), normalize(vec3(-0.35, 0.8, 0.5)));
        gl_FragColor = vec4(nl > 0.3 ? uLit : (nl > -0.2 ? uMid : uShade), 1.0);
      }`,
  });
  return lyreMat;
}

/**
 * A golden lyre (about 1 m tall at scale 1, facing +Z before `yaw`): two curved arms, a crossbar with knobs, a bowl and
 * seven strings. `show(pos, scale, yaw)` pops it in over `pos` (its base), `place` moves or resizes it without the pop,
 * `strum()` makes the strings ring, `pull(k)` draws them back (0..1), `shimmer(rate)` keeps them humming (rad/s, 0 = off),
 * `hide()`. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Lyre {
  readonly mesh = new THREE.Group();
  frozen = false;
  private strings: THREE.Mesh;
  private sGeo = new THREE.BufferGeometry();
  private sPos: Float32Array;
  private time = 0;
  private popAge = 9;
  private scaleV = 1;
  private vib = 0;
  private pullK = 0;
  private hum = 0;
  private shown = false;

  constructor() {
    const gold = goldMaterial();
    const arm = (sx: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.2, 0.1, 0), new THREE.Vector3(sx * 0.36, 0.28, 0), new THREE.Vector3(sx * 0.43, 0.55, 0),
        new THREE.Vector3(sx * 0.37, 0.84, 0), new THREE.Vector3(sx * 0.27, 0.98, 0),
      ]);
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.06, 7, false), gold);
    };
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8).rotateZ(Math.PI / 2), gold);
    bar.position.set(0, LYRE_TOP + 0.01, 0);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold);
    bowl.scale.set(0.34, 0.2, 0.2);
    bowl.position.set(0, 0.16, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.07), gold);
    bridge.position.set(0, LYRE_BOT, 0.02);
    this.mesh.add(arm(-1), arm(1), bar, bowl, bridge);
    for (const sx of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), gold);
      knob.position.set(sx * 0.28, LYRE_TOP + 0.01, 0);
      this.mesh.add(knob);
    }
    // Strings: flat ribbons in the lyre's plane, rebuilt each frame so they can bow and hum.
    this.sPos = new Float32Array(STRINGS * STR_PTS * 2 * 3);
    const idx: number[] = [];
    for (let s = 0; s < STRINGS; s++) {
      for (let j = 0; j < STR_PTS - 1; j++) {
        const a = (s * STR_PTS + j) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.sGeo.setIndex(idx);
    this.sGeo.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.strings = new THREE.Mesh(this.sGeo, new THREE.MeshBasicMaterial({ color: col(0xfff0c8), side: THREE.DoubleSide }));
    this.strings.frustumCulled = false;
    this.strings.position.z = 0.03;
    this.mesh.add(this.strings);
    this.mesh.visible = false;
    this.buildStrings();
  }

  show(pos: THREE.Vector3, scale = 1, yaw = 0) {
    this.shown = true;
    this.popAge = 0;
    this.mesh.visible = true;
    this.place(pos, scale, yaw);
  }

  place(pos: THREE.Vector3, scale = 1, yaw = 0) {
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    this.scaleV = scale;
    this.applyScale();
  }

  strum(strength = 1) {
    this.vib = strength;
  }

  pull(k: number) {
    this.pullK = k;
  }

  shimmer(rate: number) {
    this.hum = rate;
  }

  hide() {
    this.shown = false;
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
    this.vib = 0;
    this.pullK = 0;
    this.hum = 0;
    this.time = 0;
    this.frozen = false;
  }

  private applyScale() {
    const pop = this.popAge < 0.3 ? Math.max(backOut(this.popAge / 0.3), MIN_SCALE) : 1;
    this.mesh.scale.setScalar(Math.max(this.scaleV * pop, MIN_SCALE));
  }

  private buildStrings() {
    const w = 0.036, amp = this.hum > 0 ? 0.012 + 0.01 * Math.min(this.hum / 60, 1) : 0;
    for (let s = 0; s < STRINGS; s++) {
      const x0 = -0.24 + s * 0.08;
      for (let j = 0; j < STR_PTS; j++) {
        const v = j / (STR_PTS - 1), bow = Math.sin(Math.PI * v);
        const dx = bow * (this.pullK * 0.075 * (1 + 0.15 * Math.sin(s * 1.9)) + this.vib * 0.05 * Math.sin(this.time * 42 + s * 1.7)
          + amp * Math.sin(this.time * this.hum + s * 2.3 + v * 3));
        const o = (s * STR_PTS + j) * 6, y = LYRE_TOP - v * (LYRE_TOP - LYRE_BOT - 0.03);
        this.sPos[o] = x0 + dx - w / 2; this.sPos[o + 1] = y; this.sPos[o + 2] = 0;
        this.sPos[o + 3] = x0 + dx + w / 2; this.sPos[o + 4] = y; this.sPos[o + 5] = 0;
      }
    }
    this.sGeo.attributes.position.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.shown) return;
    const d = this.frozen ? 0 : dt;
    this.time += d;
    this.popAge += d;
    this.vib *= Math.exp(-d * 4.5);
    this.applyScale();
    this.buildStrings();
  }
}
