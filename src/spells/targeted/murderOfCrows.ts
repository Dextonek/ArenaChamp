import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Murder of Crows (targeted, up to six enemies, gothic horror): the world dims to grey-violet and a flock of
 * crows (drawn silhouettes with a pale-violet rim, flapping wings, tiny red eyes) bursts out of the caster's cloak
 * in a swirl, then assembles into a giant spectral raven in the sky (the birds settle on a drawn raven outline in
 * front of a dark ghost copy of it, which keeps the shape readable on a dark sky). The raven screams (wings flare,
 * a ring of feathers), holds a dead beat, then breaks apart: the crows dive on the enemies in streams, each target
 * gets three crimson crescent slashes, a short dark/light impact frame, a hard violet star and a small black smoke
 * ball. The crows scatter and fly off, feathers drift down, the frame is clean again.
 *
 * Timeline: 0-0.4 burst, 0.85-1.3 assembly, 1.3-1.55 scream, 1.55-1.62 dead beat, 1.62 dive, D = 2.0 first
 * hit (+0.08 s per further target), scatter to 4.8.
 */
export interface MurderOfCrowsSettings {
  damage: number;
  loop: boolean;
}

export const defaultMurderOfCrows = (): MurderOfCrowsSettings => ({ damage: 40, loop: false });

const MAXT = 6;
const CROWS = 60;
const FEATHERS = 170;
const D = 2.0;
const TOTAL = 4.8;
const LAUNCH = 1.62;
const DIVE = 0.38;
const SCREAM = 1.3;
const MIN = 1e-4;
const RAVEN_W = 11;
const RAVEN_H = 5.5;
const RAVEN_LIFT = 7.2;

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawn art: the crow wing-beat atlas, the raven silhouette and a soft violet haze.
// ---------------------------------------------------------------------------------------------------------------

const INK = '#12121c';
const RIM = '#b8a0d8';
const EYE = '#e0203a';

/** Raven outline, right half, relative to the centre line (x) from the head top down to the tail tip. 1024x512. */
const RAVEN_HALF: [number, number][] = [
  [0, 50], [30, 62], [40, 95], [30, 125], [44, 150],
  [120, 118], [230, 68], [340, 38], [450, 48], [506, 84], [508, 116],
  [470, 124], [492, 172], [440, 160], [456, 218], [402, 200], [408, 258], [352, 236], [342, 292], [290, 266],
  [272, 322], [216, 292], [190, 334], [130, 302], [90, 332], [52, 312],
  [50, 360], [68, 430], [40, 500], [0, 470],
];

function ravenPath(g: CanvasRenderingContext2D, cx: number) {
  g.beginPath();
  RAVEN_HALF.forEach(([x, y], i) => (i ? g.lineTo(cx + x, y) : g.moveTo(cx + x, y)));
  for (let i = RAVEN_HALF.length - 2; i >= 1; i--) g.lineTo(cx - RAVEN_HALF[i][0], RAVEN_HALF[i][1]);
  g.closePath();
}

function drawRaven(g: CanvasRenderingContext2D, glow: boolean) {
  const cx = 512;
  const beak = () => {
    g.beginPath();
    g.moveTo(cx - 15, 112);
    g.lineTo(cx, 176);
    g.lineTo(cx + 15, 112);
    g.closePath();
  };
  g.lineJoin = 'round';
  if (glow) {
    g.save();
    g.shadowColor = 'rgba(150,110,220,0.9)';
    g.shadowBlur = 34;
    g.fillStyle = INK;
    ravenPath(g, cx);
    g.fill();
    beak();
    g.fill();
    g.restore();
    g.strokeStyle = RIM;
    g.lineWidth = 9;
    ravenPath(g, cx);
    g.stroke();
    beak();
    g.stroke();
  }
  g.fillStyle = INK;
  ravenPath(g, cx);
  g.fill();
  beak();
  g.fill();
  if (glow) {
    // Feather lines on the wings and tail: a faint violet echo of the outline.
    g.strokeStyle = 'rgba(120,96,170,0.55)';
    g.lineWidth = 3;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(cx + s * 70, 150 + k * 22);
        g.lineTo(cx + s * (420 - k * 38), 120 + k * 30);
        g.stroke();
      }
    }
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(cx + k * 8, 340);
      g.lineTo(cx + k * 20, 470);
      g.stroke();
    }
  }
}

/** Mask of the raven for placing the crows: a list of points (metres in the raven plane, centre = 0). */
function ravenSlots(count: number, rand: () => number): [number, number][] {
  const W = 1024, H = 512;
  const out: [number, number][] = [];
  let data: Uint8ClampedArray | null = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (g) {
      drawRaven(g, false);
      data = g.getImageData(0, 0, W, H).data;
    }
  } catch { data = null; }
  const toM = (px: number, py: number): [number, number] => [(px / W - 0.5) * RAVEN_W, (0.5 - py / H) * RAVEN_H];
  let minD = 52;
  let tries = 0;
  while (out.length < count && tries < 12000) {
    tries++;
    if (tries % 1500 === 0) minD *= 0.8;
    const px = rand() * W, py = rand() * H;
    if (data && data[(Math.floor(py) * W + Math.floor(px)) * 4 + 3] < 128) continue;
    let ok = true;
    for (const o of out) {
      const ox = (o[0] / RAVEN_W + 0.5) * W, oy = (0.5 - o[1] / RAVEN_H) * H;
      if (Math.hypot(ox - px, oy - py) < minD) { ok = false; break; }
    }
    if (ok) out.push(toM(px, py));
  }
  while (out.length < count) out.push([(rand() - 0.5) * RAVEN_W * 0.8, (rand() - 0.5) * RAVEN_H * 0.6]);
  return out;
}

function ravenTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 512;
  const g = cv.getContext('2d');
  if (g) {
    drawRaven(g, true);
    // Eyes: two tiny red points.
    g.fillStyle = EYE;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(512 + s * 15, 90, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hazeTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(120,100,170,0.62)');
    gr.addColorStop(0.55, 'rgba(90,72,140,0.34)');
    gr.addColorStop(1, 'rgba(60,46,100,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Four wing-beat frames of a side-view crow (facing +x) in a 4x1 atlas: up, mid, down, mid. */
function crowAtlas(): THREE.Texture {
  const cell = 128;
  const cv = document.createElement('canvas');
  cv.width = cell * 4;
  cv.height = cell;
  const g = cv.getContext('2d');
  if (g) {
    const tips: [number, number][] = [[46, 6], [14, 30], [40, 124], [14, 104]];
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (let f = 0; f < 4; f++) {
      g.save();
      g.translate(f * cell, 0);
      g.beginPath();
      g.rect(0, 0, cell, cell);
      g.clip();
      const shapes: (() => void)[] = [];
      // Wing: leading curve to the tip, then back to the root through three feather notches.
      const [tx, ty] = tips[f];
      shapes.push(() => {
        const ax = 74, ay = 62, bx = 42, by = 68;
        const nx = -(ty - ay), ny = tx - ax;
        const nl = Math.hypot(nx, ny) || 1;
        g.beginPath();
        g.moveTo(ax, ay);
        g.quadraticCurveTo((ax + tx) / 2 + (nx / nl) * 9, (ay + ty) / 2 + (ny / nl) * 9, tx, ty);
        for (let k = 1; k <= 3; k++) {
          const u = k / 4;
          const px = tx + (bx - tx) * u, py = ty + (by - ty) * u;
          g.lineTo(px + (nx / nl) * 5, py + (ny / nl) * 5);
          g.lineTo(px + (bx - tx) * 0.1 - (nx / nl) * 4, py + (by - ty) * 0.1 - (ny / nl) * 4);
        }
        g.lineTo(bx, by);
        g.closePath();
      });
      shapes.push(() => { g.beginPath(); g.ellipse(58, 70, 27, 13, -0.1, 0, Math.PI * 2); });
      shapes.push(() => { g.beginPath(); g.arc(88, 60, 11, 0, Math.PI * 2); });
      shapes.push(() => { g.beginPath(); g.moveTo(96, 54); g.lineTo(117, 63); g.lineTo(96, 67); g.closePath(); });
      shapes.push(() => {
        g.beginPath();
        g.moveTo(38, 66); g.lineTo(4, 60); g.lineTo(11, 71); g.lineTo(4, 83); g.lineTo(38, 76);
        g.closePath();
      });
      // Rim first (centred on the edge, so half of it is outside), then the ink over it.
      g.strokeStyle = RIM;
      g.lineWidth = 6;
      for (const s of shapes) { s(); g.stroke(); }
      g.fillStyle = INK;
      for (const s of shapes) { s(); g.fill(); }
      g.fillStyle = EYE;
      g.beginPath();
      g.arc(91, 58, 3.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** The flock: one instanced camera-facing quad per crow, turned toward its heading on screen. */
class CrowFlock {
  readonly mesh: THREE.Mesh;
  private pos: THREE.InstancedBufferAttribute;
  private vel: THREE.InstancedBufferAttribute;
  private data: THREE.InstancedBufferAttribute;

  constructor(count: number) {
    const base = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.vel = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iVel', this.vel);
    geo.setAttribute('iData', this.data);
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uMap: { value: crowAtlas() } },
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec3 iVel; attribute vec3 iData;
        varying vec2 vUv; varying float vA; varying float vF;
        void main() {
          vec4 c0 = viewMatrix * modelMatrix * vec4(iPos, 1.0);
          vec4 c1 = viewMatrix * modelMatrix * vec4(iPos + iVel, 1.0);
          vec2 d = c1.xy - c0.xy;
          float l = length(d);
          d = l > 1e-6 ? d / l : vec2(1.0, 0.0);
          vec2 p = position.xy;
          if (d.x < 0.0) p.y = -p.y;
          c0.xy += vec2(p.x * d.x - p.y * d.y, p.x * d.y + p.y * d.x) * iData.x;
          gl_Position = projectionMatrix * c0;
          vUv = uv; vA = iData.z; vF = iData.y;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv; varying float vA; varying float vF;
        void main() {
          vec4 c = texture2D(uMap, vec2((vUv.x + floor(vF + 0.5)) * 0.25, vUv.y));
          float a = c.a * vA;
          if (a < 0.04) discard;
          gl_FragColor = vec4(c.rgb, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  set(i: number, p: THREE.Vector3, v: THREE.Vector3, size: number, frame: number, alpha: number) {
    this.pos.setXYZ(i, p.x, p.y, p.z);
    this.vel.setXYZ(i, v.x, v.y, v.z);
    this.data.setXYZ(i, size, frame, alpha);
  }

  hide(i: number) {
    this.data.setXYZ(i, MIN, 0, 0);
  }

  flush() {
    this.pos.needsUpdate = true;
    this.vel.needsUpdate = true;
    this.data.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Feathers (instanced debris with flutter, landing and a fade).
// ---------------------------------------------------------------------------------------------------------------

function featherGeometry(): THREE.BufferGeometry {
  const B = [0, 0, 0], R = [0.07, 0.2, 0], T = [0, 0.52, 0.04], L = [-0.07, 0.2, 0], C = [0, 0.2, 0.01];
  const dark = new THREE.Color(0x0e0e16), rim = new THREE.Color(0x8a76b4);
  const pos: number[] = [];
  const col: number[] = [];
  for (const tri of [[C, B, R], [C, R, T], [C, T, L], [C, L, B]]) {
    tri.forEach((v, i) => {
      pos.push(v[0], v[1], v[2]);
      const k = i === 0 ? dark : rim;
      col.push(k.r, k.g, k.b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

interface Piece {
  p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3;
  size: number; age: number; life: number; seed: number; live: boolean; landed: boolean;
}

class Feathers {
  readonly mesh: THREE.InstancedMesh;
  private pieces: Piece[];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(private count: number) {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(featherGeometry(), mat, count);
    this.mesh.frustumCulled = false;
    this.pieces = Array.from({ length: count }, () => ({
      p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
      size: 1, age: 0, life: 1, seed: Math.random() * 6.28, live: false, landed: false,
    }));
  }

  clear() {
    for (const p of this.pieces) { p.live = false; p.landed = false; p.p.set(0, -50, 0); }
    this.next = 0;
    this.write();
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number) {
    const p = this.pieces[this.next];
    this.next = (this.next + 1) % this.count;
    p.p.copy(pos);
    p.v.copy(vel);
    p.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.size = size;
    p.age = 0;
    p.life = life;
    p.live = true;
    p.landed = false;
  }

  step(dt: number) {
    if (dt <= 0) return;
    for (const p of this.pieces) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      if (p.landed) continue;
      p.v.y -= 3.2 * dt;
      p.v.x += Math.sin(p.age * 6 + p.seed) * 5 * dt;
      p.v.z += Math.cos(p.age * 5 + p.seed) * 5 * dt;
      p.v.multiplyScalar(Math.exp(-1.5 * dt));
      p.p.addScaledVector(p.v, dt);
      p.r.set(p.r.x + p.w.x * dt, p.r.y + p.w.y * dt, p.r.z + p.w.z * dt);
      if (p.p.y < 0.05) {
        p.p.y = 0.05;
        p.landed = true;
        p.v.set(0, 0, 0);
        p.r.set(-Math.PI / 2, 0, p.seed);
      }
    }
  }

  write() {
    for (let i = 0; i < this.count; i++) {
      const p = this.pieces[i];
      const k = p.live ? 1 - smoothstep((p.age - (p.life - 0.5)) / 0.5) : 0;
      if (k < 0.02) this.m.compose(p.p, this.q.identity(), this.s.setScalar(MIN));
      else this.m.compose(p.p, this.q.setFromEuler(p.r), this.s.setScalar(Math.max(MIN, p.size * k)));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------

interface Crow {
  spawn: number;
  arrive: number;
  /** Raven-plane slot (metres) and a little depth. */
  su: number; sv: number; sd: number;
  ctrl: THREE.Vector3;
  tgt: number;
  launch: number;
  dur: number;
  hitOff: THREE.Vector3;
  side: number;
  scatter: THREE.Vector3;
  size: number;
  phase: number;
}

interface Slashes {
  group: THREE.Group;
  arcs: CrescentArc[];
  holders: THREE.Group[];
}

export class MurderOfCrows implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MurderOfCrowsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private cloak = new THREE.Vector3(0, 1.7, 14);
  private centre = new THREE.Vector3(0, RAVEN_LIFT, 8);
  private cam = new THREE.Vector3(0, 6, 28);
  private right = new THREE.Vector3(1, 0, 0);
  private normal = new THREE.Vector3(0, 0, 1);
  private tPos: THREE.Vector3[] = [new THREE.Vector3()];
  private tEnemy: (CastContext['targets'][number] | undefined)[] = [undefined];
  private hitAt: number[] = [D];
  private hitDone: boolean[] = [];
  private hit2Done: boolean[] = [];
  private smokeDone: boolean[] = [];
  private spillAcc = 0;
  private screamDone = false;

  private crows: Crow[] = [];
  private flock: CrowFlock;
  private feathers: Feathers;
  private ghost: THREE.Mesh;
  private ghostMat: THREE.MeshBasicMaterial;
  private haze: THREE.Mesh;
  private hazeMat: THREE.MeshBasicMaterial;
  private eyes: StarBurst[] = [];
  private screamRing = createRing(0xb8a0d8, 0.93, 1, 96);
  private casterRing = createRing(0x8a6cc0, 0.9, 1, 64);
  private slashes: Slashes[] = [];
  private stars: StarBurst[] = [];
  private rings: ReturnType<typeof createRing>[] = [];
  private smoke = new SmokeBall({ color: 0x14141f, rim: 0xb8a0d8, flake: 0x1a1a2a, maxBalls: MAXT });
  private mist: Emitter;

  constructor(settings: MurderOfCrowsSettings = defaultMurderOfCrows()) {
    this.settings = settings;
    this.screen.tint.set(0x2a2438);
    this.screen.impactColor.set(0xcfc0e6);
    this.screen.speedLineColor.set(0xb8a0d8);
    this.screen.edgeTint.set(0x6a3aa8);
    this.screen.keepHue.set(0xe0203a);

    // Backdrop haze + ghost raven (both camera-yawed planes), then the flock on top.
    this.hazeMat = new THREE.MeshBasicMaterial({
      map: hazeTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    this.haze = new THREE.Mesh(new THREE.PlaneGeometry(RAVEN_W * 1.5, RAVEN_W * 1.5), this.hazeMat);
    this.haze.renderOrder = 1;
    this.ghostMat = new THREE.MeshBasicMaterial({
      map: ravenTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    this.ghost = new THREE.Mesh(new THREE.PlaneGeometry(RAVEN_W, RAVEN_H), this.ghostMat);
    this.ghost.renderOrder = 2;
    this.haze.visible = false;
    this.ghost.visible = false;

    this.flock = new CrowFlock(CROWS);
    // The flock's draw call tells us where the camera is, so the raven can face it from any view.
    this.flock.mesh.onBeforeRender = (_r, _s, camera) => { this.cam.setFromMatrixPosition(camera.matrixWorld); };
    this.feathers = new Feathers(FEATHERS);

    const rand = rng(7);
    const slots = ravenSlots(CROWS, rand);
    for (let i = 0; i < CROWS; i++) {
      this.crows.push({
        spawn: rand() * 0.4, arrive: 0.85 + rand() * 0.45,
        su: slots[i][0], sv: slots[i][1], sd: (rand() - 0.5) * 0.6,
        ctrl: new THREE.Vector3(), tgt: 0, launch: LAUNCH, dur: DIVE,
        hitOff: new THREE.Vector3((rand() - 0.5) * 0.9, 0.9 + rand() * 0.9, (rand() - 0.5) * 0.9),
        side: rand() < 0.5 ? -1 : 1, scatter: new THREE.Vector3(),
        size: 0.58 + rand() * 0.2, phase: rand(),
      });
    }

    for (let i = 0; i < 2; i++) {
      const eye = new StarBurst({ points: 4, inner: 0.14, jitter: 0, color: 0xe0203a, core: 0xff8a95, additive: false });
      this.eyes.push(eye);
      this.group.add(eye.mesh);
    }

    for (let i = 0; i < MAXT; i++) {
      const g = new THREE.Group();
      const holders: THREE.Group[] = [];
      const arcs: CrescentArc[] = [];
      for (let k = 0; k < 3; k++) {
        const r = 1.5 + k * 0.28;
        const arc = new CrescentArc({
          radius: r, width: 0.5 - k * 0.06, sweep: Math.PI * 0.9, style: 'toon',
          edge: 0xff9aa6, mid: 0xe0203a, outer: 0x4a0a14,
        });
        // Centre the arc's midpoint on the holder's origin.
        arc.mesh.position.set(-0.156 * r, -0.988 * r, 0);
        const holder = new THREE.Group();
        holder.add(arc.mesh);
        g.add(holder);
        holders.push(holder);
        arcs.push(arc);
      }
      this.group.add(g);
      this.slashes.push({ group: g, arcs, holders });
      const star = new StarBurst({ points: 8, inner: 0.3, jitter: 0.25, color: 0xb8a0d8, core: 0xe8e4dc, additive: false });
      this.stars.push(star);
      const ring = createRing(0xb8a0d8, 0.88, 1, 64);
      this.rings.push(ring);
      this.group.add(star.mesh, ring.mesh);
    }

    this.mist = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.4, speedJitter: 0.6, spread: 180, gravity: -0.3, drag: 1.2,
      sizeStart: 0.7, sizeEnd: 1.7, colorStart: '#2a2438', colorEnd: '#0a0810',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#1a1626', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.emitters.push(this.mist, this.smoke.emitter);
    this.group.add(this.mist.points);
    this.group.add(
      this.haze, this.ghost, this.flock.mesh, this.feathers.mesh, this.smoke.mesh,
      this.screamRing.mesh, this.casterRing.mesh,
    );

    this.plan(new THREE.Vector3(0, 0, 14), Math.PI, [new THREE.Vector3()], [undefined]);
    this.reset();
  }

  get impactTime() {
    return D;
  }

  get duration() {
    return TOTAL;
  }

  get targetPositions(): readonly THREE.Vector3[] {
    return this.tPos;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    const en = ctx.targetPos.length ? ctx.targets : [];
    const count = Math.min(MAXT, pts.length);
    // Nearest to the caster first, so the dives land in a clear front-to-back order.
    const order = Array.from({ length: count }, (_, i) => i)
      .sort((a, b) => pts[a].distanceToSquared(ctx.from) - pts[b].distanceToSquared(ctx.from));
    this.plan(ctx.from, ctx.aim, order.map((i) => pts[i]), order.map((i) => en[i]));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.reset();
  }

  /** Derives every cast-dependent position and the per-crow flight plan. */
  private plan(from: THREE.Vector3, aim: number, pts: THREE.Vector3[], en: (CastContext['targets'][number] | undefined)[]) {
    this.from.copy(from);
    this.fwd.set(Math.sin(aim), 0, Math.cos(aim));
    this.cloak.copy(from).setY(1.7);
    this.centre.copy(from).addScaledVector(this.fwd, 6).setY(RAVEN_LIFT);
    this.tPos = pts.map((p) => p.clone());
    this.tEnemy = en.slice();
    const n = this.tPos.length;
    this.hitAt = this.tPos.map((_, k) => LAUNCH + DIVE + k * 0.08);
    this.hitDone = this.tPos.map(() => false);
    this.hit2Done = this.tPos.map(() => false);
    this.smokeDone = this.tPos.map(() => false);
    this.screen.focus.set(0, 0, 0);
    for (const p of this.tPos) this.screen.focus.add(p);
    this.screen.focus.divideScalar(n).setY(1.2);

    const rand = rng(11);
    const perTarget: number[] = this.tPos.map(() => 0);
    this.crows.forEach((c, i) => {
      const a = rand() * Math.PI * 2;
      c.ctrl.set(from.x + Math.cos(a) * (3 + rand() * 2.5), 4 + rand() * 4, from.z + Math.sin(a) * (3 + rand() * 2.5));
      c.tgt = i % n;
      const rank = perTarget[c.tgt]++;
      // The first crow of every target is the lead (arrives exactly on the hit); the rest follow in a stream.
      c.launch = LAUNCH + c.tgt * 0.08 + (rank === 0 ? 0 : 0.03 + rand() * 0.4);
      c.dur = DIVE + (rank === 0 ? 0 : rand() * 0.12);
      const outward = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize().multiplyScalar(5 + rand() * 3);
      outward.addScaledVector(this.fwd, 2 + rand() * 3);
      c.scatter.set(outward.x, 3 + rand() * 3, outward.z);
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.spillAcc = 0;
    this.screamDone = false;
    this.shake = 0;
    this.hitDone = this.tPos.map(() => false);
    this.hit2Done = this.tPos.map(() => false);
    this.smokeDone = this.tPos.map(() => false);
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.feathers.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.mist.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= TOTAL) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    this.feathers.step(dt);
    this.events(dt);
    this.layout(dt);
  }

  /** Time-triggered one-shots: cloak spill, scream, hits, smoke. */
  private events(dt: number) {
    const t = this.time;
    // Black feathers and ink spill from the caster's cloak while the flock bursts out.
    if (t < 0.55) {
      this.spillAcc += dt * 40;
      while (this.spillAcc >= 1) {
        this.spillAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        this.feathers.spawn(
          this.cloak, new THREE.Vector3(Math.cos(a) * 3, 2 + Math.random() * 3, Math.sin(a) * 3),
          0.9 + Math.random() * 0.5, 2.2 + Math.random(),
        );
        if (Math.random() < 0.4) this.mist.burst(2, this.cloak);
      }
    }
    if (!this.screamDone && t >= SCREAM) {
      this.screamDone = true;
      const head = this.slotWorld(0, 1.78, 0, new THREE.Vector3());
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2 + Math.random() * 0.2;
        const sp = 4 + Math.random() * 4;
        const v = new THREE.Vector3()
          .addScaledVector(this.right, Math.cos(a) * sp).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(a) * sp);
        this.feathers.spawn(head, v, 0.9 + Math.random() * 0.5, 2.6 + Math.random());
      }
    }
    this.tPos.forEach((p, k) => {
      const ht = this.hitAt[k];
      if (!this.hitDone[k] && t >= ht) {
        this.hitDone[k] = true;
        const e = this.tEnemy[k];
        const ctx = this.ctx;
        if (ctx && e) ctx.hit(e, { damage: this.settings.damage, knock: 2, from: this.cloak, color: '#d8c8f0' });
        for (let i = 0; i < 9; i++) {
          const a = Math.random() * Math.PI * 2;
          this.feathers.spawn(
            p.clone().setY(1.2), new THREE.Vector3(Math.cos(a) * 4, 2 + Math.random() * 4, Math.sin(a) * 4),
            0.8 + Math.random() * 0.5, 2 + Math.random(),
          );
        }
      }
      if (!this.hit2Done[k] && t >= ht + 0.55) {
        this.hit2Done[k] = true;
        const e = this.tEnemy[k];
        const ctx = this.ctx;
        if (ctx && e) ctx.hit(e, { damage: Math.round(this.settings.damage * 0.4), knock: 1, from: this.cloak, color: '#d8c8f0' });
      }
      if (!this.smokeDone[k] && t >= ht + 0.15) {
        this.smokeDone[k] = true;
        this.smoke.trigger(p.clone().setY(1), 1.5, 1.2);
      }
    });
  }

  /** World position of a raven-plane point (u right, v up, d toward the camera). */
  private slotWorld(u: number, v: number, d: number, out: THREE.Vector3) {
    return out.copy(this.centre).addScaledVector(this.right, u).addScaledVector(new THREE.Vector3(0, 1, 0), v)
      .addScaledVector(this.normal, d);
  }

  private bez(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, u: number, out: THREE.Vector3) {
    const k = 1 - u;
    return out.set(
      k * k * a.x + 2 * k * u * b.x + u * u * c.x,
      k * k * a.y + 2 * k * u * b.y + u * u * c.y,
      k * k * a.z + 2 * k * u * b.z + u * u * c.z,
    );
  }

  /** Crow position at time t (pure function of time, so scrubbing works). Returns the alpha, 0 when hidden. */
  private crowAt(c: Crow, t: number, out: THREE.Vector3, tmp: THREE.Vector3[]): number {
    if (t < c.spawn) return 0;
    const slot = this.slotWorld(c.su, c.sv, c.sd, tmp[0]);
    const tgt = this.tPos[c.tgt] ?? this.tPos[0];
    const hit = tmp[1].copy(tgt).add(c.hitOff);
    const fadeIn = clamp01((t - c.spawn) / 0.08);
    if (t < c.arrive) {
      this.bez(this.cloak, c.ctrl, slot, smoothstep((t - c.spawn) / (c.arrive - c.spawn)), out);
      return fadeIn;
    }
    if (t < c.launch) {
      out.copy(slot);
      out.y += Math.sin(t * 3 + c.phase * 6) * 0.07;
      return 1;
    }
    const arriveT = c.launch + c.dur;
    if (t < arriveT) {
      const u = Math.pow((t - c.launch) / c.dur, 1.6);
      const mid = tmp[2].copy(slot).lerp(hit, 0.5);
      mid.y += 2.2;
      mid.addScaledVector(this.right, c.side * 2.4);
      this.bez(slot, mid, hit, u, out);
      return 1;
    }
    const tau = t - arriveT;
    out.copy(hit).addScaledVector(c.scatter, tau);
    out.y += tau * tau * 1.5;
    return 1 - smoothstep((tau - 0.7) / 1.1);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const tmp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

    // --- Camera-facing basis for the raven plane. ---
    const camLocal = this.group.worldToLocal(this.cam.clone());
    this.normal.set(camLocal.x - this.centre.x, 0, camLocal.z - this.centre.z);
    if (this.normal.lengthSq() < 1e-4) this.normal.set(0, 0, 1);
    this.normal.normalize();
    this.right.set(this.normal.z, 0, -this.normal.x);
    const basis = new THREE.Matrix4().makeBasis(this.right, new THREE.Vector3(0, 1, 0), this.normal);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis);

    // --- Screen: moderate darken (<= 0.5), a little colour drain, focus lines on the dive, short impact frames. ---
    const env = t < D + 0.3 ? smoothstep(t / 0.5) : Math.exp(-(t - D - 0.3) * 1.8);
    this.screen.darken = 0.46 * env;
    this.screen.desaturate = 0.25 * env;
    this.screen.speedLines = t < LAUNCH ? 0 : t < D + 0.1 ? 0.7 * smoothstep((t - LAUNCH) / 0.35) : Math.max(0, 0.7 - (t - D - 0.1) * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = Math.max(chromaPulse(t, SCREAM, 0.5, 8), chromaPulse(t, D, 0.8, 9));

    // --- Raven: haze + ghost fade in as the crows land, flare on the scream, vanish as it breaks. ---
    const build = smoothstep((t - 0.7) / 0.6);
    const scream = t > SCREAM ? Math.exp(-(t - SCREAM) * 6) : 0;
    const breakFade = 1 - smoothstep((t - LAUNCH) / 0.22);
    const flare = t > SCREAM ? 1 + 0.12 * Math.sin(Math.min(1, (t - SCREAM) / 0.25) * Math.PI) : 1;
    this.ghostMat.opacity = 0.82 * build * breakFade;
    this.hazeMat.opacity = 0.7 * build * (1 - smoothstep((t - LAUNCH) / 0.5));
    this.ghost.visible = this.ghostMat.opacity > 0.01;
    this.haze.visible = this.hazeMat.opacity > 0.01;
    this.ghost.quaternion.copy(q);
    this.haze.quaternion.copy(q);
    this.ghost.position.copy(this.centre).addScaledVector(this.normal, -0.6);
    this.haze.position.copy(this.centre).addScaledVector(this.normal, -1.4);
    this.ghost.scale.setScalar(flare);
    this.haze.scale.setScalar(1 + 0.15 * scream);

    // Eyes glint red from the moment the raven forms; flare on the scream.
    const eyeOn = smoothstep((t - 1.05) / 0.25) * breakFade;
    this.eyes.forEach((eye, i) => {
      const p = this.slotWorld((i ? 1 : -1) * 0.17 * flare, 1.78 * flare, 0.7, tmp[0]);
      eye.set(p, (0.55 + 0.5 * scream) * flare, eyeOn, 0);
    });

    // Scream ring (vertical, in the raven plane) and a violet pulse under the caster at the burst.
    const sa = t - SCREAM;
    this.screamRing.mesh.quaternion.copy(q);
    this.slotWorld(0, 1.78, 0.8, this.screamRing.mesh.position);
    this.screamRing.mesh.scale.setScalar(1 + Math.max(0, sa) * 14);
    this.screamRing.material.opacity = sa > 0 ? Math.max(0, 0.5 * (1 - sa / 0.5)) : 0;
    this.casterRing.mesh.position.set(this.from.x, 0.05, this.from.z);
    this.casterRing.mesh.scale.setScalar(1 + t * 8);
    this.casterRing.material.opacity = t < 0.5 ? 0.45 * (1 - t / 0.5) : 0;

    // --- The flock. ---
    const vel = new THREE.Vector3();
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    for (let i = 0; i < CROWS; i++) {
      const c = this.crows[i];
      const a = this.crowAt(c, t, p0, tmp);
      if (a <= 0.001) { this.flock.hide(i); continue; }
      const holding = t >= c.arrive && t < c.launch;
      if (holding) {
        // Heading follows the raven outline: wing crows point out along the wing, body crows up.
        const hu = c.su, hv = c.sv - 0.4;
        vel.set(0, 0, 0).addScaledVector(this.right, hu).addScaledVector(new THREE.Vector3(0, 1, 0), hv);
        if (vel.lengthSq() < 1e-4) vel.set(0, 1, 0);
      } else {
        this.crowAt(c, t + 0.03, p1, tmp);
        vel.copy(p1).sub(p0);
      }
      const diving = t >= c.launch && t < c.launch + c.dur;
      const rate = holding ? (t > SCREAM - 0.1 && t < SCREAM + 0.3 ? 12 : 6) : 10;
      const frame = Math.floor((((t * rate + c.phase * 4) % 4) + 4) % 4);
      this.flock.set(i, p0, vel, c.size * (diving ? 1.2 : 1) * (holding ? flare : 1), frame, a);
    }
    this.flock.flush();
    this.feathers.write();

    // --- Per-target payoff: crimson slashes, hard violet star, ground ring. ---
    this.slashes.forEach((s, k) => {
      const p = this.tPos[k];
      const ht = this.hitAt[k];
      const a = t - ht;
      s.group.visible = !!p && k < this.tPos.length;
      const star = this.stars[k];
      const ring = this.rings[k];
      if (!p || a < 0 || a > 1.4) {
        s.arcs.forEach((arc) => { arc.opacity = 0; });
        star.set(tmp[0].set(0, 0, 0), 0, 0);
        ring.material.opacity = 0;
        return;
      }
      s.group.position.copy(p).setY(1.3);
      s.group.quaternion.copy(q);
      const angles = [-0.95, 0.35, 1.45];
      s.arcs.forEach((arc, j) => {
        const aj = a - j * 0.07;
        s.holders[j].rotation.z = angles[j] + (k % 2 ? 0.25 : -0.1);
        arc.head = clamp01(aj / 0.16) * 1.15;
        arc.length = 0.85;
        arc.time = t;
        arc.erosion = smoothstep((aj - 0.18) / 0.45);
        arc.opacity = aj < 0 ? 0 : 1 - smoothstep((aj - 0.35) / 0.25);
      });
      const pop = StarBurst.pop(a - 0.02);
      star.set(tmp[0].copy(p).setY(1.3), 2.6 * pop.scale, pop.opacity, k * 0.6);
      ring.mesh.position.set(p.x, 0.05, p.z);
      ring.mesh.scale.setScalar(1 + Math.max(0, a) * 15);
      ring.material.opacity = Math.max(0, 0.55 * (1 - a / 0.5));
    });

    // --- Shake: small rumble while the raven builds, a kick on the scream, the hit and the dives. ---
    this.shake = after > 0 && after < 1.2 ? 0.55 * Math.exp(-after * 6)
      : t > SCREAM && t < SCREAM + 0.4 ? 0.12 * Math.exp(-(t - SCREAM) * 6)
      : t > 0.5 && t < LAUNCH ? 0.03 : 0;
    if (dt > 0 && t < 0.4) this.shake = 0.05;
  }
}

export const murderOfCrowsModule: EffectModule = {
  label: 'murder of crows',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new MurderOfCrows(),
  telegraphs(effect) {
    const e = effect as MurderOfCrows;
    if (!e.ctx) return [];
    return e.targetPositions.map((p, k) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.9 }, start: 0.2, impact: D + k * 0.08,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as MurderOfCrows;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as MurderOfCrows).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
