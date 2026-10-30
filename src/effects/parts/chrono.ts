import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The chrono kit (pipeline/designs/kit-chrono.md): time drawn as luminous radium clock dials (`Dial`: rings of Roman
 * numerals and ticks on canvas textures, unlit and crisp), tapered clock-hand blades with a dark outline (`Hand`),
 * pale afterimages two or three steps behind a moving thing (`Afterimage`), motes that stop dead in the air
 * (`FrozenMotes`) and a few falling flakes of a cracked dial (`Flakes`). Everything is pooled, takes world-space
 * positions and has `reset()`. No gears, no brass, no sand. Materials are unlit and `toneMapped: false`.
 */

/** Palette. Numbers for `THREE.Color`, `CHRONO_CSS` for APIs that want a string. `foil` (ivory dial) is the pale foil. */
export const CHRONO = {
  core: 0xffffff,
  hot: 0xf4ffd0,
  body: 0xd4ff5a,
  accent: 0xff4a4a,
  dark: 0x0c100a,
  foil: 0xf4ecd8,
} as const;

export const CHRONO_CSS = {
  core: '#ffffff',
  hot: '#f4ffd0',
  body: '#d4ff5a',
  accent: '#ff4a4a',
  dark: '#0c100a',
  foil: '#f4ecd8',
} as const;

const MIN_SCALE = 1e-4;
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 3);
const easeIO = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const UP = new THREE.Vector3(0, 1, 0);

/** Dial frame from a plane normal: `u` is "twelve" (world up projected into the plane), `r` is "three". */
function dialFrame(normal: THREE.Vector3, u: THREE.Vector3, r: THREE.Vector3, n: THREE.Vector3) {
  n.copy(normal).normalize();
  u.copy(UP).addScaledVector(n, -UP.dot(n));
  if (u.lengthSq() < 1e-4) u.set(0, 0, -1);
  u.normalize();
  r.crossVectors(u, n).normalize();
}

// ---------------------------------------------------------------------------------------------------------------
// Dial textures
// ---------------------------------------------------------------------------------------------------------------

export type DialFace = 'ring' | 'ivory' | 'dark';
export type DialMarks = 'full' | 'quarter' | 'ticks' | 'band';

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const texCache = new Map<string, THREE.CanvasTexture>();

function makeTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** A dial face: disc, rim, ticks and numerals (chartreuse with a dark outline). 12 o'clock is up; the dial's radius is the half-width. */
function dialTexture(face: DialFace, marks: DialMarks) {
  const key = face + marks;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 1024, h = S / 2, R = h * 0.98;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(h, h);
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  const body = '#d4ff5a', dark = '#0c100a', foil = '#f4ecd8';

  // Face.
  g.beginPath();
  g.arc(0, 0, R * 0.97, 0, TAU);
  if (face === 'ivory') {
    const gr = g.createRadialGradient(0, -R * 0.15, R * 0.1, 0, 0, R);
    gr.addColorStop(0, '#fbf5e4');
    gr.addColorStop(1, '#e2d6b8');
    g.fillStyle = gr;
  } else if (face === 'dark') {
    const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    gr.addColorStop(0, '#1b2314');
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
  } else g.fillStyle = 'rgba(12,16,10,0.55)';
  g.fill();

  // Rim: dark under chartreuse, plus a thin ivory line on the ring face (the pale foil on the dark floor).
  const rimR = marks === 'band' ? R * 0.975 : R * 0.955;
  g.strokeStyle = dark;
  g.lineWidth = R * 0.07;
  g.beginPath();
  g.arc(0, 0, rimR, 0, TAU);
  g.stroke();
  g.strokeStyle = body;
  g.lineWidth = R * 0.034;
  g.stroke();
  if (face === 'ring') {
    g.strokeStyle = foil;
    g.lineWidth = R * 0.014;
    g.beginPath();
    g.arc(0, 0, rimR + R * 0.028, 0, TAU);
    g.stroke();
  }

  const tick = (k: number, n: number, r0: number, r1: number, w: number) => {
    const a = (k / n) * TAU, sx = Math.sin(a), sy = -Math.cos(a);
    for (const pass of [0, 1]) {
      g.strokeStyle = pass === 0 ? dark : body;
      g.lineWidth = pass === 0 ? w * R + R * 0.018 : w * R;
      g.beginPath();
      g.moveTo(sx * r0 * R, sy * r0 * R);
      g.lineTo(sx * r1 * R, sy * r1 * R);
      g.stroke();
    }
  };
  const numeral = (k: number, text: string, r: number, cap: number) => {
    const a = (k / 12) * TAU, fs = (cap * R) / 0.72;
    g.font = `bold ${fs}px Georgia, "Times New Roman", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const x = Math.sin(a) * r * R, y = -Math.cos(a) * r * R;
    g.strokeStyle = dark;
    g.lineWidth = fs * 0.26;
    g.strokeText(text, x, y);
    g.fillStyle = body;
    g.fillText(text, x, y);
  };

  if (marks === 'full') {
    for (let i = 0; i < 60; i++) if (i % 5) tick(i, 60, 0.84, 0.91, 0.02);
    for (let i = 0; i < 12; i++) tick(i, 12, 0.8, 0.91, 0.045);
    for (let i = 0; i < 12; i++) numeral(i, ROMAN[i], 0.6, 0.15);
  } else if (marks === 'quarter') {
    for (let i = 0; i < 12; i++) tick(i, 12, 0.76, 0.9, 0.06);
    for (const i of [0, 3, 6, 9]) numeral(i, ROMAN[i], 0.5, 0.3);
  } else if (marks === 'ticks') {
    for (let i = 0; i < 12; i++) tick(i, 12, i % 3 ? 0.62 : 0.5, 0.9, 0.1);
  } else {
    for (let i = 0; i < 60; i++) if (i % 5) tick(i, 60, 0.925, 0.96, 0.014);
    for (let i = 0; i < 12; i++) tick(i, 12, 0.9, 0.96, 0.032);
    for (let i = 0; i < 12; i++) numeral(i, ROMAN[i], 0.8, 0.12);
  }
  const tex = makeTexture(c);
  texCache.set(key, tex);
  return tex;
}

let crackTex: THREE.CanvasTexture | null = null;
/** Jagged cracks spreading from the middle of a dial: dark lines with an ivory edge. Fixed seed. */
function crackTexture() {
  if (crackTex) return crackTex;
  const S = 512, h = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(h, h);
  g.lineCap = 'round';
  g.lineJoin = 'miter';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const crack = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    let px = x, py = y, pa = a, left = len;
    while (left > 0) {
      const seg = 14 + rnd() * 26;
      pa += (rnd() - 0.5) * 0.9;
      px += Math.cos(pa) * seg;
      py += Math.sin(pa) * seg;
      pts.push([px, py]);
      left -= seg;
      if (depth > 0 && rnd() < 0.3) crack(px, py, pa + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), left * 0.6, depth - 1);
    }
    for (const pass of [0, 1]) {
      g.strokeStyle = pass === 0 ? '#f4ecd8' : '#0c100a';
      g.lineWidth = pass === 0 ? 11 : 5;
      g.beginPath();
      pts.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
      g.stroke();
    }
  };
  for (let i = 0; i < 7; i++) crack(0, 0, (i / 7) * TAU + rnd() * 0.5, 190 + rnd() * 60, 2);
  crackTex = makeTexture(c);
  return crackTex;
}

// ---------------------------------------------------------------------------------------------------------------
// Hand
// ---------------------------------------------------------------------------------------------------------------

let handGeo: THREE.ShapeGeometry | null = null;
/** A unit clock-hand blade pointing +Y: a small tail, wide shoulders, tapering to a tip at (0, 1). Scale x = width, y = length. */
function handGeometry() {
  if (handGeo) return handGeo;
  const s = new THREE.Shape();
  s.moveTo(0, -0.22);
  s.lineTo(0.5, 0);
  s.lineTo(0.14, 0.6);
  s.lineTo(0, 1);
  s.lineTo(-0.14, 0.6);
  s.lineTo(-0.5, 0);
  s.closePath();
  handGeo = new THREE.ShapeGeometry(s);
  return handGeo;
}

interface HandSweep { from: number; to: number; t: number; dur: number; steps: number; ease: (x: number) => number }

/**
 * A tapered flat clock-hand blade with a dark outline, in a plane. `set(pivot, angle, length, width)` places it
 * (angle clockwise from twelve, radians); `sweep(from, to, seconds)` animates the angle (`steps` > 0 makes it tick in
 * that many jumps). The plane defaults to an upright one facing +Z (twelve = +Y); `orient(u, n)` changes it and
 * `point(pivot, dir, hint, length, width)` aims the blade along any direction. Add `group`.
 */
export class Hand {
  readonly group = new THREE.Group();
  readonly body: THREE.Mesh;
  readonly edge: THREE.Mesh;
  angle = 0;
  length = 1;
  width = 0.3;
  private bodyMat: THREE.MeshBasicMaterial;
  private edgeMat: THREE.MeshBasicMaterial;
  private pivot = new THREE.Vector3();
  private u = new THREE.Vector3(0, 1, 0);
  private n = new THREE.Vector3(0, 0, 1);
  private r = new THREE.Vector3(1, 0, 0);
  private anim: HandSweep | null = null;
  private m = new THREE.Matrix4();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(color: number = CHRONO.body, private pad = 0.06) {
    const mk = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.bodyMat = mk(color);
    this.edgeMat = mk(CHRONO.dark);
    this.body = new THREE.Mesh(handGeometry(), this.bodyMat);
    this.edge = new THREE.Mesh(handGeometry(), this.edgeMat);
    this.body.renderOrder = 12;
    this.edge.renderOrder = 11;
    this.edge.userData.ghostSkip = true;
    this.edge.position.z = -0.012;
    this.group.add(this.edge, this.body);
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
  }

  get animating() {
    return this.anim !== null;
  }

  set color(c: number) {
    this.bodyMat.color.set(c);
  }

  set alpha(a: number) {
    this.bodyMat.opacity = this.edgeMat.opacity = clamp01(a);
  }

  /** Chooses the plane: `u` is twelve, `n` the face normal (both need not be unit). */
  orient(u: THREE.Vector3, n: THREE.Vector3) {
    this.n.copy(n).normalize();
    this.u.copy(u).addScaledVector(this.n, -u.dot(this.n)).normalize();
    this.r.crossVectors(this.u, this.n).normalize();
  }

  set(pivot: THREE.Vector3, angle: number, length: number, width: number) {
    this.pivot.copy(pivot);
    this.angle = angle;
    this.length = length;
    this.width = width;
    this.v1.copy(this.u).multiplyScalar(Math.cos(angle)).addScaledVector(this.r, Math.sin(angle));
    this.layout(this.v1, this.n);
  }

  /** Re-places the blade at a new angle with the same pivot, length and width. */
  setAngle(angle: number) {
    this.set(this.pivot, angle, this.length, this.width);
  }

  /** Aims the blade along `dir`, its face turned toward `hint` as far as the plane allows. */
  point(pivot: THREE.Vector3, dir: THREE.Vector3, hint: THREE.Vector3, length: number, width: number) {
    this.pivot.copy(pivot);
    this.length = length;
    this.width = width;
    const d = this.v1.copy(dir).normalize();
    const n = this.v2.copy(hint).addScaledVector(d, -hint.dot(d));
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0).addScaledVector(d, -d.y);
    n.normalize();
    this.layout(d, n);
  }

  private layout(d: THREE.Vector3, n: THREE.Vector3) {
    const x = this.v3.crossVectors(d, n).normalize();
    this.m.makeBasis(x, d, n).setPosition(this.pivot);
    this.group.matrix.copy(this.m);
    this.group.matrixWorldNeedsUpdate = true;
    const l = Math.max(this.length, MIN_SCALE), w = Math.max(this.width, MIN_SCALE), p = this.pad;
    this.body.scale.set(w, l, 1);
    this.edge.scale.set(w + p * 2, l + p * 2, 1);
    this.edge.position.y = -p;
    this.group.visible = this.length > MIN_SCALE * 2;
  }

  /** Sweeps the angle from `from` to `to` over `seconds`; `steps` > 0 ticks it in that many jumps, `ease` 'in' speeds the ticks up. */
  sweep(from: number, to: number, seconds: number, steps = 0, ease: 'out' | 'in' | 'io' | 'lin' = 'out') {
    const f = ease === 'out' ? easeOut : ease === 'in' ? easeIn : ease === 'io' ? easeIO : clamp01;
    this.anim = { from, to, t: 0, dur: Math.max(seconds, 1e-3), steps, ease: f };
    this.setAngle(from);
  }

  stop() {
    this.anim = null;
  }

  hide() {
    this.anim = null;
    this.group.visible = false;
  }

  update(dt: number) {
    const a = this.anim;
    if (!a) return;
    a.t = Math.min(a.dur, a.t + dt);
    let p = a.ease(a.t / a.dur);
    if (a.steps > 0) p = a.t >= a.dur ? 1 : Math.floor(p * a.steps) / a.steps;
    this.setAngle(a.from + (a.to - a.from) * p);
    if (a.t >= a.dur) this.anim = null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Dial
// ---------------------------------------------------------------------------------------------------------------

export interface DialOptions {
  face?: DialFace;
  marks?: DialMarks;
  /** The two hands (default true). */
  hands?: boolean;
  /** `tick()` steps the whole face round instead of (as well as) the hands: for a ring on the ground without hands. */
  spinFace?: boolean;
  /** Draw order of the face (hands sit above it). Ground dials that overlap pick different ones. */
  order?: number;
}

const TICK_STEP = TAU / 24;

/**
 * A luminous radium clock dial: a flat disc with a canvas texture (numerals and ticks in chartreuse with a dark outline,
 * unlit and crisp) and two hands. `show(center, radius, normal, seconds)` places it and draws it in clockwise from twelve
 * over `seconds` (numerals appear one by one); `place(center, radius)` moves it; `tick(rate)` steps the hands (negative =
 * backward); `tickBack()` is one step backward; `freeze()` stops the ticking with a flash; `flash()` brightens it;
 * `crack(k)` lays cracks over it; `hide(seconds)` fades it out. `hands[0]` is the long minute hand, `hands[1]` the short
 * hour hand, in the dial's own unit-radius frame (pivot at the centre, length 1 = the dial's radius). Add `group`.
 */
export class Dial {
  readonly group = new THREE.Group();
  readonly hands: [Hand, Hand];
  /** The disc's centre, radius and normal as last placed. */
  readonly center = new THREE.Vector3();
  radius = 1;
  readonly normal = new THREE.Vector3(0, 1, 0);
  frozen = false;
  on = false;
  private face: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private crackMesh: THREE.Mesh;
  private crackMat: THREE.MeshBasicMaterial;
  private uniReveal = { value: 1 };
  private revT = 0;
  private revDur = 0;
  private fadeT = 0;
  private fadeDur = 0;
  private fadeK = 1;
  private tickRate = 0;
  private tickAcc = 0;
  private flashV = 0;
  private spin = 0;
  private u = new THREE.Vector3();
  private r = new THREE.Vector3();
  private n = new THREE.Vector3();
  private m = new THREE.Matrix4();
  private pv = new THREE.Vector3(0, 0, 0.03);

  constructor(private opts: DialOptions = {}) {
    const face = opts.face ?? 'ring', marks = opts.marks ?? 'full';
    this.mat = new THREE.MeshBasicMaterial({ map: dialTexture(face, marks), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = this.uniReveal;
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uReveal;\nvoid main() {')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float ang = atan(vMapUv.x - 0.5, vMapUv.y - 0.5) / 6.2831853;
          if (ang < 0.0) ang += 1.0;
          if (ang > uReveal) discard;`,
        );
    };
    const geo = new THREE.PlaneGeometry(2, 2);
    this.face = new THREE.Mesh(geo, this.mat);
    this.face.renderOrder = opts.order ?? 8;
    this.crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    this.crackMesh = new THREE.Mesh(geo, this.crackMat);
    this.crackMesh.position.z = 0.02;
    this.crackMesh.renderOrder = (opts.order ?? 8) + 1;
    this.crackMesh.visible = false;
    this.hands = [new Hand(CHRONO.body, 0.025), new Hand(CHRONO.body, 0.025)];
    this.group.add(this.face, this.crackMesh);
    if (opts.hands ?? true) for (const h of this.hands) this.group.add(h.group);
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    this.reset();
  }

  /** Puts the dial at `center` facing `normal`, drawing it in over `seconds` (0 = at once). */
  show(center: THREE.Vector3, radius: number, normal: THREE.Vector3, seconds = 0) {
    this.reset();
    this.on = true;
    this.group.visible = true;
    this.normal.copy(normal).normalize();
    dialFrame(this.normal, this.u, this.r, this.n);
    this.place(center, radius);
    this.revDur = seconds;
    this.revT = 0;
    this.uniReveal.value = seconds > 0 ? 0 : 1;
    this.hands[0].orient(UP, new THREE.Vector3(0, 0, 1));
    this.hands[1].orient(UP, new THREE.Vector3(0, 0, 1));
    this.hands[0].set(this.pv, 0, 0.78, 0.1);
    this.hands[1].set(this.pv, Math.PI * 0.66, 0.52, 0.13);
  }

  /** Moves and resizes the dial without changing its facing. */
  place(center: THREE.Vector3, radius = this.radius) {
    this.center.copy(center);
    this.radius = Math.max(radius, MIN_SCALE);
    const R = this.radius;
    this.m.makeBasis(this.r.clone().multiplyScalar(R), this.u.clone().multiplyScalar(R), this.n.clone().multiplyScalar(R)).setPosition(center);
    this.group.matrix.copy(this.m);
    this.group.matrixWorldNeedsUpdate = true;
  }

  /** Steps the hands `rate` times a second (negative = backward; 0 stops). */
  tick(rate: number) {
    this.tickRate = rate;
  }

  /** One step backward at once (the hit flash's "ticks backward once"). */
  tickBack() {
    this.hands[0].stop();
    this.hands[0].setAngle(this.hands[0].angle - TICK_STEP * 2);
    this.flashV = 0.6;
  }

  /** The ticking stops dead, with a flash. */
  freeze() {
    this.frozen = true;
    this.flashV = 1;
    for (const h of this.hands) h.stop();
  }

  flash(v = 1) {
    this.flashV = Math.max(this.flashV, v);
  }

  /** 0..1: cracks over the face. */
  crack(k: number) {
    this.crackMat.opacity = clamp01(k);
    this.crackMesh.visible = k > 0.01;
  }

  hide(seconds = 0.3) {
    if (!this.on) return;
    this.fadeDur = Math.max(seconds, 1e-3);
    this.fadeT = 0;
  }

  reset() {
    this.on = false;
    this.frozen = false;
    this.revDur = this.revT = 0;
    this.fadeDur = this.fadeT = 0;
    this.fadeK = 1;
    this.tickRate = this.tickAcc = this.flashV = this.spin = 0;
    this.uniReveal.value = 1;
    this.face.rotation.z = 0;
    this.crack(0);
    this.group.visible = false;
    for (const h of this.hands) h.hide();
    this.paint();
  }

  private paint() {
    const a = this.fadeK;
    this.mat.opacity = a;
    this.mat.color.setScalar(1 + this.flashV * 0.7);
    for (const h of this.hands) h.alpha = a;
    this.crackMat.color.setScalar(1);
  }

  update(dt: number) {
    if (!this.on) return;
    if (this.revDur > 0) {
      this.revT = Math.min(this.revDur, this.revT + dt);
      this.uniReveal.value = this.revT / this.revDur;
    }
    if (this.fadeDur > 0) {
      this.fadeT += dt;
      this.fadeK = 1 - clamp01(this.fadeT / this.fadeDur);
      if (this.fadeK <= 0) {
        this.on = false;
        this.group.visible = false;
        for (const h of this.hands) h.hide();
        return;
      }
    }
    this.flashV *= Math.exp(-dt * 9);
    if (!this.frozen && this.tickRate !== 0) {
      this.tickAcc += dt * Math.abs(this.tickRate);
      const sign = Math.sign(this.tickRate);
      while (this.tickAcc >= 1) {
        this.tickAcc -= 1;
        if (!this.hands[0].animating) this.hands[0].setAngle(this.hands[0].angle + sign * TICK_STEP);
        if (!this.hands[1].animating) this.hands[1].setAngle(this.hands[1].angle + sign * TICK_STEP / 12);
        if (this.opts.spinFace) {
          this.spin += sign * TAU / 60;
          this.face.rotation.z = -this.spin;
        }
      }
    }
    for (const h of this.hands) h.update(dt);
    this.paint();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Afterimage
// ---------------------------------------------------------------------------------------------------------------

/** Opacities of the echoes, nearest first: 25-40%. */
const GHOST_ALPHA = [0.4, 0.32, 0.25];
const HISTORY = 96;

let figGeo: THREE.BufferGeometry | null = null;
/** A slim timekeeper in a long coat, one merged mesh so the translucent copy has no inner overlap: about 1.9 tall, facing +Z. */
function figureGeometry() {
  if (figGeo) return figGeo;
  const coat = new THREE.CylinderGeometry(0.2, 0.46, 1.15, 10).translate(0, 0.6, 0);
  const chest = new THREE.CylinderGeometry(0.27, 0.22, 0.42, 8).translate(0, 1.32, 0);
  const head = new THREE.SphereGeometry(0.17, 10, 8).translate(0, 1.65, 0);
  const staff = new THREE.BoxGeometry(0.08, 1.95, 0.04).translate(0.46, 0.97, 0.1);
  figGeo = mergeGeometries([coat, chest, head, staff])!;
  return figGeo;
}

interface Ghost {
  root: THREE.Group;
  meshes: THREE.Mesh[];
  mat: THREE.MeshBasicMaterial;
}

/**
 * Two or three pale translucent echoes (25-40%, pale chartreuse), never more. Three modes:
 *  - `trail(object, count, spacing)`: copies of an object's meshes follow it `spacing` seconds apart (call after the
 *    object is set up; the copies take the object's shape at that moment and then follow its world matrices);
 *  - `replay(points, seconds)`: figure echoes run the path `points` (ground positions, in order) backward;
 *  - `stand(i, pos, yaw)`: a still figure echo.
 * `fade(seconds)` fades them all out; `reset()` hides them at once. Add `group`.
 */
export class Afterimage {
  readonly group = new THREE.Group();
  /** Overall opacity multiplier (1 = the 25-40% steps). */
  gain = 1;
  private ghosts: Ghost[] = [];
  private mode: 'idle' | 'trail' | 'replay' | 'stand' = 'idle';
  private k = 1;
  private fadeRate = 0;
  private time = 0;
  // trail
  private src: THREE.Mesh[] = [];
  private hist: Float32Array[] = [];
  private histT = new Float32Array(HISTORY);
  private histN = 0;
  private histHead = 0;
  private spacing = 0.05;
  // replay
  private path: THREE.Vector3[] = [];
  private pathN = 0;
  private dur = 0.3;
  private stagger = 0.06;
  private rt = 0;
  // stand
  private still: { on: boolean; a: number }[] = [];
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(public max = 3, private color: number = CHRONO.body) {
    for (let i = 0; i < HISTORY; i++) this.hist.push(new Float32Array(0));
  }

  private clearGhosts() {
    for (const gh of this.ghosts) {
      this.group.remove(gh.root);
      gh.mat.dispose();
    }
    this.ghosts.length = 0;
  }

  private addGhost(geos: { geo: THREE.BufferGeometry; auto: boolean }[]) {
    const mat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    const root = new THREE.Group();
    const meshes = geos.map(({ geo, auto }) => {
      const m = new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate = auto;
      m.renderOrder = 7;
      root.add(m);
      return m;
    });
    root.visible = false;
    this.group.add(root);
    this.ghosts.push({ root, meshes, mat });
    this.still.push({ on: false, a: 0.38 });
  }

  private figures(count: number) {
    if (this.ghosts.length === count && this.src.length === 0) return;
    this.clearGhosts();
    this.still.length = 0;
    this.src.length = 0;
    for (let i = 0; i < count; i++) this.addGhost([{ geo: figureGeometry(), auto: true }]);
  }

  /** Echoes of `object`'s meshes trail it, `spacing` seconds apart. */
  trail(object: THREE.Object3D, count = 2, spacing = 0.05) {
    this.clearGhosts();
    this.still.length = 0;
    this.src.length = 0;
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData.ghostSkip) this.src.push(mesh);
    });
    const n = Math.min(Math.max(1, count), this.max, GHOST_ALPHA.length);
    for (let i = 0; i < n; i++) this.addGhost(this.src.map((s) => ({ geo: s.geometry, auto: false })));
    for (let i = 0; i < HISTORY; i++) this.hist[i] = new Float32Array(this.src.length * 16);
    this.spacing = spacing;
    this.histN = this.histHead = 0;
    this.mode = 'trail';
    this.k = 1;
    this.fadeRate = 0;
    this.time = 0;
  }

  /** Figure echoes run the ground path `points` backward (last point first), `seconds` for the whole run. */
  replay(points: THREE.Vector3[], seconds: number, stagger = 0.06) {
    this.figures(Math.min(this.max, GHOST_ALPHA.length));
    this.pathN = Math.min(points.length, 64);
    while (this.path.length < this.pathN) this.path.push(new THREE.Vector3());
    for (let i = 0; i < this.pathN; i++) this.path[i].copy(points[i]);
    this.dur = Math.max(seconds, 1e-3);
    this.stagger = stagger;
    this.rt = 0;
    this.mode = this.pathN >= 2 ? 'replay' : 'idle';
    this.k = 1;
    this.fadeRate = 0;
  }

  /** A still figure echo number `i` at `pos`, turned `yaw`. */
  stand(i: number, pos: THREE.Vector3, yaw: number, alpha = 0.38) {
    if (this.mode !== 'stand' || this.ghosts.length < Math.min(this.max, GHOST_ALPHA.length)) {
      this.figures(Math.min(this.max, GHOST_ALPHA.length));
      this.mode = 'stand';
    }
    const gh = this.ghosts[i];
    if (!gh) return;
    gh.root.position.set(pos.x, pos.y, pos.z);
    gh.root.rotation.y = yaw;
    this.still[i].on = true;
    this.still[i].a = clamp01(alpha);
    gh.root.visible = true;
    this.k = 1;
    this.fadeRate = 0;
  }

  fade(seconds: number) {
    this.fadeRate = 1 / Math.max(seconds, 1e-3);
  }

  reset() {
    this.mode = 'idle';
    this.k = 1;
    this.fadeRate = 0;
    this.histN = 0;
    this.rt = 0;
    for (const s of this.still) s.on = false;
    for (const gh of this.ghosts) {
      gh.root.visible = false;
      gh.mat.opacity = 0;
    }
  }

  update(dt: number) {
    if (this.mode === 'idle') return;
    this.time += dt;
    if (this.fadeRate > 0) {
      this.k -= dt * this.fadeRate;
      if (this.k <= 0) {
        this.reset();
        return;
      }
    }
    const k = this.k * this.gain;
    if (this.mode === 'trail') this.updateTrail(k);
    else if (this.mode === 'replay') this.updateReplay(dt, k);
    else this.ghosts.forEach((gh, i) => {
      const s = this.still[i];
      gh.root.visible = s.on && k > 0.01;
      gh.mat.opacity = s.a * k;
    });
  }

  private updateTrail(k: number) {
    const slot = this.hist[this.histHead];
    this.src.forEach((s, i) => {
      s.updateWorldMatrix(true, false);
      s.matrixWorld.toArray(slot, i * 16);
    });
    this.histT[this.histHead] = this.time;
    this.histHead = (this.histHead + 1) % HISTORY;
    this.histN = Math.min(this.histN + 1, HISTORY);
    const oldest = this.histT[(this.histHead - this.histN + HISTORY) % HISTORY];
    this.ghosts.forEach((gh, g) => {
      const want = this.time - (g + 1) * this.spacing;
      if (want < oldest) {
        gh.root.visible = false;
        return;
      }
      let best = 0, bd = Infinity;
      for (let j = 0; j < this.histN; j++) {
        const idx = (this.histHead - 1 - j + HISTORY) % HISTORY, d = Math.abs(this.histT[idx] - want);
        if (d < bd) { bd = d; best = idx; }
        else if (this.histT[idx] < want) break;
      }
      const arr = this.hist[best];
      gh.meshes.forEach((m, i) => {
        m.matrix.fromArray(arr, i * 16);
        m.matrixWorldNeedsUpdate = true;
      });
      gh.root.visible = k > 0.01;
      gh.mat.opacity = GHOST_ALPHA[g] * k;
    });
  }

  private updateReplay(dt: number, k: number) {
    this.rt += dt;
    let live = false;
    this.ghosts.forEach((gh, g) => {
      const u = (this.rt - g * this.stagger) / this.dur;
      if (u < 0 || u > 1.05) {
        gh.root.visible = false;
        return;
      }
      live = true;
      // Backward: u 0 is the last point, u 1 the first.
      const f = (1 - clamp01(u)) * (this.pathN - 1), i = Math.min(Math.floor(f), this.pathN - 2);
      this.v1.lerpVectors(this.path[i], this.path[i + 1], f - i);
      this.v2.subVectors(this.path[i], this.path[i + 1]);
      gh.root.position.set(this.v1.x, 0, this.v1.z);
      if (this.v2.lengthSq() > 1e-6) gh.root.rotation.y = Math.atan2(this.v2.x, this.v2.z);
      gh.root.visible = true;
      gh.mat.opacity = GHOST_ALPHA[g] * k * Math.min(1, u * 8, (1.05 - u) * 8);
    });
    if (!live && this.rt > this.dur + this.stagger * this.ghosts.length + 0.1) this.reset();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FrozenMotes
// ---------------------------------------------------------------------------------------------------------------

const MOTES = 48;

/**
 * A few small pale motes (ivory and chartreuse diamonds). `drift(center, radius, count)` lets motes float slowly in a
 * radius; `freeze(center, radius, count)` adds `count` more and stops every mote dead in the air (they pop in
 * stopped); `release(seconds)` lets them float up and fade. Add `mesh`.
 */
export class FrozenMotes {
  readonly mesh: THREE.InstancedMesh;
  private pos: THREE.Vector3[] = [];
  private vel: THREE.Vector3[] = [];
  private size = new Float32Array(MOTES);
  private age = new Float32Array(MOTES);
  private live = new Uint8Array(MOTES);
  private n = 0;
  private stopped = false;
  private relT = -1;
  private relDur = 1;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0).scale(0.7, 1.2, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false }),
      MOTES,
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    const ivory = new THREE.Color(CHRONO.foil), lime = new THREE.Color(CHRONO.hot);
    for (let i = 0; i < MOTES; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.mesh.setColorAt(i, i % 3 ? ivory : lime);
    }
    this.reset();
  }

  private spawn(center: THREE.Vector3, radius: number, count: number, moving: boolean) {
    for (let c = 0; c < count && this.n < MOTES; c++) {
      const i = this.n++, a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius;
      this.pos[i].set(center.x + Math.cos(a) * r, center.y + 0.3 + Math.random() * 2.6, center.z + Math.sin(a) * r);
      if (moving) this.vel[i].set((Math.random() - 0.5) * 0.7, 0.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7);
      else this.vel[i].set(0, 0, 0);
      this.size[i] = 0.07 + Math.random() * 0.07;
      this.age[i] = 0;
      this.live[i] = 1;
    }
  }

  drift(center: THREE.Vector3, radius: number, count: number) {
    this.stopped = false;
    this.spawn(center, radius, count, true);
  }

  freeze(center: THREE.Vector3, radius: number, count: number) {
    this.spawn(center, radius, count, false);
    this.stopped = true;
    for (let i = 0; i < this.n; i++) this.vel[i].set(0, 0, 0);
  }

  release(seconds: number) {
    this.stopped = false;
    this.relT = 0;
    this.relDur = Math.max(seconds, 1e-3);
    for (let i = 0; i < this.n; i++) this.vel[i].set((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4);
  }

  reset() {
    this.n = 0;
    this.stopped = false;
    this.relT = -1;
    this.live.fill(0);
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  update(dt: number) {
    if (this.n === 0) return;
    if (this.relT >= 0) this.relT += dt;
    const fade = this.relT >= 0 ? 1 - clamp01(this.relT / this.relDur) : 1;
    if (fade <= 0) {
      this.reset();
      return;
    }
    this.mesh.visible = true;
    this.mesh.count = this.n;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (!this.stopped) this.pos[i].addScaledVector(this.vel[i], dt);
      const pop = easeOut(this.age[i] / 0.08);
      const sz = Math.max(this.size[i] * pop * (this.relT >= 0 ? fade : 1), MIN_SCALE);
      this.e.set(0, this.stopped ? i : i + this.age[i] * 0.8, 0.3 * (i % 5));
      this.q.setFromEuler(this.e);
      this.m.compose(this.pos[i], this.q, this.s.setScalar(sz));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Flakes
// ---------------------------------------------------------------------------------------------------------------

const FLAKES = 40;

/** Small flat triangular flakes of a cracked dial (ivory and chartreuse): `emit(pos, vel, size, life)` throws one; they tumble, fall and shrink. Add `mesh`. */
export class Flakes {
  readonly mesh: THREE.InstancedMesh;
  private pos: THREE.Vector3[] = [];
  private vel: THREE.Vector3[] = [];
  private rot: THREE.Vector3[] = [];
  private spin: THREE.Vector3[] = [];
  private size = new Float32Array(FLAKES);
  private life = new Float32Array(FLAKES);
  private maxLife = new Float32Array(FLAKES);
  private next = 0;
  private any = false;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();

  constructor(private gravity = 5) {
    const tri = new THREE.Shape();
    tri.moveTo(-0.5, -0.4);
    tri.lineTo(0.55, -0.2);
    tri.lineTo(0.05, 0.6);
    tri.closePath();
    this.mesh = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(tri),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }),
      FLAKES,
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    const ivory = new THREE.Color(CHRONO.foil), lime = new THREE.Color(CHRONO.body);
    for (let i = 0; i < FLAKES; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.rot.push(new THREE.Vector3());
      this.spin.push(new THREE.Vector3());
      this.mesh.setColorAt(i, i % 3 ? ivory : lime);
    }
    this.reset();
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, size = 0.3, life = 1) {
    const i = this.next;
    this.next = (this.next + 1) % FLAKES;
    this.pos[i].copy(pos);
    this.vel[i].copy(vel);
    this.rot[i].set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
    this.spin[i].set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    this.size[i] = size * (0.6 + Math.random() * 0.8);
    this.life[i] = this.maxLife[i] = life;
    this.any = true;
  }

  reset() {
    this.life.fill(0);
    this.any = false;
    this.mesh.visible = false;
    for (let i = 0; i < FLAKES; i++) {
      this.m.makeScale(MIN_SCALE, MIN_SCALE, MIN_SCALE);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.any) return;
    let live = false;
    for (let i = 0; i < FLAKES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.m.makeScale(MIN_SCALE, MIN_SCALE, MIN_SCALE);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      live = true;
      this.vel[i].y -= this.gravity * dt;
      this.vel[i].multiplyScalar(Math.exp(-dt * 0.8));
      this.pos[i].addScaledVector(this.vel[i], dt);
      if (this.pos[i].y < 0.05) { this.pos[i].y = 0.05; this.vel[i].multiplyScalar(0.2); }
      this.rot[i].addScaledVector(this.spin[i], dt);
      const k = this.life[i] / this.maxLife[i];
      this.e.set(this.rot[i].x, this.rot[i].y, this.rot[i].z);
      this.q.setFromEuler(this.e);
      this.m.compose(this.pos[i], this.q, this.s.setScalar(Math.max(this.size[i] * Math.min(1, k * 3), MIN_SCALE)));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.visible = live;
    this.any = live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
