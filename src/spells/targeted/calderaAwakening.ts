import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Caldera Awakening (targeted ground AoE, radius 8, hero tier, ~22 s cutscene): the caster stamps, a crack races
 * across the floor and a volcano grows out of the arena: basalt columns heave up in waves and lock into a cone, the
 * crater crust heaves, cracks and bursts into a lava fountain; lava bombs arc over the enemies and land on them,
 * lava runs down the cone and along the ground cracks, an ash cloud rolls out low, then everything cools to black and
 * the cone sinks back into the floor. Heat haze is the hero distortion.
 *
 * Lava is drawn, never a glow blob: dark crust plates with thin bright cracks (a Voronoi canvas texture), and the
 * cracks on the ground / cone are ribbons with a crack texture and a shader that reveals the crack and then fills it
 * with lava along its length. Basalt is a drawn hex-column texture with an emissive crack map.
 *
 * Everything is a pure function of time t (scrubbing works); one-shot hits, bursts and smoke fire when t crosses
 * their time. The arena caster is never moved: the stamp shot frames it.
 *
 * Camera (cinematic, every shot placed explicitly from the cast context, no auto-fit, all clamped to <= 24 from the
 * look-at): 0 foot close-up | 1.4 low crack tracker | 2.5 wide from the caster's side (the cone rises) | 4.8 low near
 * the cone (rocks tumble) | 7.0 high into the crater | 8.0 wide low (eruption) | 9.3 looking up among the enemies |
 * 11.0 / 12.2 two ground-level bombardment shots | 14.0 high orbit (rivers, ash) | 18.0 gameplay-like behind the caster.
 *
 * Timeline: 0.9 stamp | 2.5 telegraph start, cone rises | 4.0 knock | 7-8 hold | 8.0 burst (impact frames, ring) |
 * 11.6 / 12.8 bomb hits | 13.5 ash rolls | 18-21.6 cooling | 22 end.
 */
export interface CalderaAwakeningSettings {
  damage: number;
  loop: boolean;
}

export const defaultCalderaAwakening = (): CalderaAwakeningSettings => ({ damage: 45, loop: false });

const DURATION = 22;
const RADIUS = 8;
const T_START = 2.5;
const T_STAMP = 0.9;
const T_KNOCK = 4.0;
const T_ERUPT = 8.0;
const T_AIM = 8.2;
const HIT1 = 11.6;
const HIT2 = 12.8;
const CRATER_Y = 5.5;
const GRAV = 12;
const BOMBS = 28;
const PUFFS = 2;
const BLOBS = 46;
const STARS = 10;
const SHOCKS = 6;
const HAZES = 10;
const ROCKS = 22;
const MAX_CAM = 24;

// Palette (core -> hot -> body -> accent -> dark).
const ORANGE = 0xff7a1a;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const UP = new THREE.Vector3(0, 1, 0);

/** Cone surface height at horizontal radius r (flat crater rim at 6, 1.5 m of fall per metre out, 0 at 5.9). */
const coneH = (r: number) => (r < 1.9 ? 6 : Math.max(0, 6 - (r - 1.9) * 1.5));

const RINGS = [
  { n: 6, r: 1.95, rad: 0.7, top: 6.0, tilt: 0.28, delay: 4.8, sink: 0.0 },
  { n: 7, r: 3.1, rad: 0.9, top: 4.2, tilt: 0.4, delay: 4.15, sink: 0.35 },
  { n: 8, r: 4.2, rad: 0.95, top: 2.55, tilt: 0.5, delay: 3.5, sink: 0.7 },
  { n: 9, r: 5.2, rad: 1.0, top: 1.05, tilt: 0.58, delay: 2.9, sink: 1.0 },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Drawn textures ---------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, data = false): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Hex-column basalt: dark rock with lighter bevel lines on the hex edges and black cracks. The glow map holds the same cracks in orange. */
function basaltTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const rnd = rng(7);
  const cracks: [number, number][][] = [];
  for (let k = 0; k < 11; k++) {
    let x = rnd() * 256, y = rnd() * 256;
    const pts: [number, number][] = [[x, y]];
    const a0 = Math.PI / 2 + (rnd() - 0.5) * 1.2;
    for (let s = 0; s < 6; s++) {
      const a = a0 + (rnd() - 0.5) * 1.1;
      x += Math.cos(a) * (14 + rnd() * 16);
      y += Math.sin(a) * (14 + rnd() * 16);
      pts.push([x, y]);
    }
    cracks.push(pts);
  }
  const facets = Array.from({ length: 26 }, () => ({ x: rnd() * 256, y: rnd() * 256, w: 20 + rnd() * 40, h: 30 + rnd() * 60, a: 0.1 + rnd() * 0.18 }));
  const strokeCracks = (g: CanvasRenderingContext2D, color: string, width: number) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    for (const pts of cracks) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  };
  const map = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#1b171a';
    g.fillRect(0, 0, 256, 256);
    for (const f of facets) {
      g.fillStyle = `rgba(74,66,74,${f.a})`;
      g.fillRect(f.x, f.y, f.w, f.h);
    }
    for (let k = 0; k < 6; k++) {
      const x = (k * 256) / 6;
      g.fillStyle = '#07050a';
      g.fillRect(x - 4, 0, 4, 256);
      g.fillStyle = 'rgba(96,86,94,0.85)';
      g.fillRect(x, 0, 3, 256);
    }
    strokeCracks(g, '#040304', 3.2);
  });
  const glow = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    strokeCracks(g, '#ff5a14', 2.0);
  });
  map.wrapS = map.wrapT = glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
  return { map, glow };
}

type LavaKind = 'crust' | 'cracked' | 'molten';

/**
 * Lava crust: a tileable Voronoi cell map. 'crust' = dark plates, thin bright cracks. 'cracked' = the same plates with
 * wide orange cracks. 'molten' = mostly lava with dark crust islands and thin yellow seams. Yellow-white only in the
 * thin seams.
 */
function lavaTexture(kind: LavaKind, seed: number): THREE.CanvasTexture {
  const S = 192;
  const rnd = rng(seed);
  const N = kind === 'cracked' ? 44 : kind === 'crust' ? 30 : 26;
  const base = Array.from({ length: N }, () => ({ x: rnd() * S, y: rnd() * S, tone: rnd(), isle: 6 + rnd() * 11, dark: rnd() < 0.45 }));
  const all: typeof base = [];
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (const b of base) all.push({ ...b, x: b.x + ox * S, y: b.y + oy * S });
  const w = kind === 'crust' ? 2.4 : kind === 'cracked' ? 4.6 : 2.0;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  const mix = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const YELLOW = [255, 217, 120], HOT = [255, 122, 26], MAGMA = [194, 38, 26];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let d1 = 1e9, d2 = 1e9, c1 = all[0];
      for (const c of all) {
        const dx = c.x - px, dy = c.y - py;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; c1 = c; } else if (d < d2) d2 = d;
      }
      const dist1 = Math.sqrt(d1), edge = Math.sqrt(d2) - dist1;
      let col: number[];
      if (kind === 'molten' && !(c1.dark && dist1 < c1.isle)) {
        col = mix(MAGMA, HOT, 0.25 + c1.tone * 0.55);
        if (edge < w) col = mix(YELLOW, HOT, edge / w);
      } else {
        col = [26 + c1.tone * 14, 18 + c1.tone * 8, 20 + c1.tone * 8];
        if (kind === 'molten') {
          if (dist1 > c1.isle - 2.5) col = mix(col, MAGMA, 0.8);
        } else {
          const glow = kind === 'cracked' ? 0.7 : 0.4;
          if (edge < w * 3.2) col = mix(col, [120, 28, 20], (1 - edge / (w * 3.2)) * glow);
          if (edge < w) {
            const t = edge / w;
            col = t < 0.3 ? YELLOW : t < 0.65 ? HOT : MAGMA;
          }
        }
      }
      const o = (py * S + px) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** A lava splat decal: black crust blob, jagged orange rim, a small hot core. Alpha cutout. */
function splatTexture(): THREE.CanvasTexture {
  const rnd = rng(19);
  return canvasTexture(128, 128, (g) => {
    const blob = (r: number, j: number, color: string) => {
      g.beginPath();
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (1 - j + rnd() * j * 2) * (i % 2 ? 1 : 0.86);
        const x = 64 + Math.cos(a) * rr, y = 64 + Math.sin(a) * rr;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    blob(60, 0.18, '#120d0e');
    blob(44, 0.2, '#b8321a');
    blob(32, 0.2, '#ff7a1a');
    blob(13, 0.25, '#ffd070');
  });
}

/** Orange ground light for the ash cloud: a soft radial gradient. */
function groundGlowTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,110,30,0.9)');
    gr.addColorStop(0.5, 'rgba(194,38,26,0.4)');
    gr.addColorStop(1, 'rgba(194,38,26,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}

/**
 * One crack, lying along u: a dark jagged halo band (alpha) with a thin jagged core line (green channel). The ribbon
 * shader reveals it along u and fills the core with lava. Both ends taper out.
 */
function crackLineTexture(): THREE.CanvasTexture {
  const rnd = rng(31);
  return canvasTexture(512, 64, (g) => {
    const N = 64;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 512, y = 32 - (20 + rnd() * 9);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    for (let i = N; i >= 0; i--) g.lineTo((i / N) * 512, 32 + (20 + rnd() * 9));
    g.closePath();
    g.fillStyle = '#000';
    g.fill();
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const y = 32 + (rnd() - 0.5) * 8;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.lineWidth = 8;
    g.strokeStyle = '#00ff00';
    g.stroke();
    g.globalCompositeOperation = 'destination-out';
    for (const [x0, x1] of [[0, 56], [512, 456]]) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 64);
    }
  }, true);
}

const CRACK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const CRACK_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uShow, uLava, uHeat, uGlow, uAlpha, uTime;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(uMap, vUv);
    float show = 1.0 - smoothstep(uShow - 0.03, uShow, vUv.x);
    float lava = 1.0 - smoothstep(uLava - 0.05, uLava, vUv.x);
    float core = s.g;
    float flick = 0.88 + 0.12 * sin(vUv.x * 60.0 - uTime * 3.0);
    float hot = lava * uHeat * flick;
    vec3 dark = vec3(0.055, 0.043, 0.05);
    vec3 c = mix(vec3(0.76, 0.15, 0.10), vec3(1.0, 0.48, 0.10), smoothstep(0.2, 0.9, core));
    c = mix(c, vec3(1.0, 0.82, 0.45), smoothstep(0.78, 1.0, core) * hot * 0.8);
    float k = clamp(core * (uGlow + hot), 0.0, 1.0);
    float a = s.a * show * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(dark, c, k), a);
  }`;

function crackMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map }, uShow: { value: 0 }, uLava: { value: 0 }, uHeat: { value: 1 }, uGlow: { value: 0.1 },
      uAlpha: { value: 1 }, uTime: { value: 0 },
    },
    vertexShader: CRACK_VERT,
    fragmentShader: CRACK_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** A flat-ish ribbon along `pts` (u = 0..1 along, v = 0..1 across), width from `widthAt(s)`. */
function ribbonGeo(pts: THREE.Vector3[], widthAt: (s: number) => number): THREE.BufferGeometry {
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx: number[] = [];
  const tan = v3(), side = v3();
  for (let i = 0; i < n; i++) {
    tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    side.crossVectors(tan, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const s = i / (n - 1), w = widthAt(s) / 2;
    const a = i * 2;
    pos.set([pts[i].x - side.x * w, pts[i].y - side.y * w, pts[i].z - side.z * w], a * 3);
    pos.set([pts[i].x + side.x * w, pts[i].y + side.y * w, pts[i].z + side.z * w], (a + 1) * 3);
    uv.set([s, 0, s, 1], a * 2);
    if (i < n - 1) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A jagged horizontal path from p0 along unit `dir`. */
function jagged(rnd: () => number, p0: THREE.Vector3, dir: THREE.Vector3, len: number, step: number, jit: number, y: number) {
  const perp = v3(-dir.z, 0, dir.x);
  const n = Math.max(2, Math.round(len / step));
  const out: THREE.Vector3[] = [];
  let off = 0;
  for (let i = 0; i <= n; i++) {
    off = off * 0.6 + (rnd() - 0.5) * jit;
    out.push(p0.clone().addScaledVector(dir, (len * i) / n).addScaledVector(perp, off).setY(y));
  }
  return out;
}

// --- The effect -------------------------------------------------------------------------------------------

interface Rib {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  kind: 'stamp' | 'main' | 'branch' | 'river';
  k: number;
  pts: THREE.Vector3[];
  front: number;
}

interface Bomb {
  launchT: number;
  landT: number;
  flight: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  vy: number;
  size: number;
  target: number;
  spin: THREE.Vector3;
}

interface AshBall {
  t: number;
  pos: THREE.Vector3;
  size: number;
  near: boolean;
}

export class CalderaAwakening implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CalderaAwakeningSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private keys: ShotKey[] = [];

  // Cast geometry.
  private C = v3();
  private S = v3();
  private fwd = v3(0, 0, -1);
  private back = v3(0, 0, 1);
  private right = v3(1, 0, 0);
  private avg = v3();

  // Events.
  private stamped = false;
  private ringDust = [false, false, false, false];
  private knocked = false;
  private erupted = false;
  private aimed = false;
  private landed: boolean[] = new Array(BOMBS).fill(false);
  private ashDone = 0;

  private plan: Bomb[] = [];
  private ash: AshBall[] = [];

  // Scene parts.
  private visuals = new THREE.Group();
  private coneG = new THREE.Group();
  private slabs: { mesh: THREE.Mesh; th: number; ring: number; top: number; hs: number; spin: number; jit: number; tilt: number }[] = [];
  private slabMat: THREE.MeshStandardMaterial;
  private capMat = new THREE.MeshStandardMaterial({ color: 0x1b171a, roughness: 1, flatShading: true });
  private capHot = new THREE.MeshStandardMaterial({ color: 0x1b171a, roughness: 1, flatShading: true, emissive: 0x7a1c08, emissiveIntensity: 0 });
  private filler: THREE.Mesh;
  private mound: THREE.Mesh;
  private rocks: { mesh: THREE.Mesh; th: number; r0: number; rEnd: number; t0: number; size: number; spin: THREE.Vector3 }[] = [];
  private craterMats: THREE.MeshBasicMaterial[] = [];
  private craters: THREE.Mesh[] = [];
  private crustTex: THREE.CanvasTexture;
  private crackedTex: THREE.CanvasTexture;
  private moltenTex: THREE.CanvasTexture;
  private column: THREE.Mesh;
  private columnMat: THREE.MeshBasicMaterial;
  private blobs: THREE.InstancedMesh;
  private blobSeed: { f: number; per: number; vy: number; h: number; a: number; size: number }[];
  private bombMesh: THREE.InstancedMesh;
  private trailMesh: THREE.InstancedMesh;
  private coreMesh: THREE.InstancedMesh;
  private splats: THREE.InstancedMesh;
  private splatYaw: number[];
  private stars: StarBurst[] = [];
  private bigStar = new StarBurst({ points: 12, inner: 0.3, color: ORANGE, core: 0xfff3c0, additive: false });
  private dustRing: THREE.Mesh;
  private groundGlow: THREE.Mesh;
  private light = new THREE.PointLight(ORANGE, 0, 14, 2);
  private crackTex = crackLineTexture();
  private ribs: Rib[] = [];
  private ribGroup = new THREE.Group();

  // Distortion.
  private hazeCrater = new HeatHaze({ width: 9, height: 10, scale: 3 });
  private hazeCone = new HeatHaze({ width: 16, height: 7, scale: 3 });
  private hazeStamp = new HeatHaze({ width: 3, height: 2.5, scale: 3 });
  private hazeCracks = Array.from({ length: 6 }, () => new HeatHaze({ width: 4, height: 3, scale: 3 }));
  private hazeImpacts = Array.from({ length: HAZES }, () => new HeatHaze({ width: 3, height: 4, scale: 3 }));
  private shockBurst = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shockPulse = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private shockStamp = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shockImpacts = Array.from({ length: SHOCKS }, () => new ShockRefraction({ facing: 'ground', width: 0.3 }));

  // Particles.
  private plain: Emitter[] = [];
  private dust: Emitter;
  private embers: Emitter;
  private bits: Emitter;
  private smoke = new SmokeBall({ color: 0x2a2426, rim: 0x3a3236, flake: 0x2a2426, maxBalls: 12 });
  private ashNear = new SmokeBall({ color: 0x3c3842, rim: 0xa04a1c, flake: 0x3c3842, maxBalls: 28 });
  private ashFar = new SmokeBall({ color: 0x3c3842, rim: 0x5a5560, flake: 0x3c3842, maxBalls: 28 });

  private m4 = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private ea = new THREE.Euler();
  private pa = v3();
  private pb = v3();
  private pc = v3();
  private sc = v3();
  private col = new THREE.Color();

  constructor(settings: CalderaAwakeningSettings = defaultCalderaAwakening()) {
    this.settings = settings;
    this.screen.tint.set(0x3a2024);
    this.screen.impactColor.set(ORANGE);
    this.screen.edgeTint.set(0xff5a14);
    this.screen.speedLineColor.set(0xffd08a);
    this.group.add(this.visuals);

    const { map, glow } = basaltTextures();
    this.slabMat = new THREE.MeshStandardMaterial({
      map, emissiveMap: glow, emissive: 0xff5a14, emissiveIntensity: 0, roughness: 0.92, metalness: 0, flatShading: true,
    });
    this.crustTex = lavaTexture('crust', 5);
    this.crackedTex = lavaTexture('cracked', 6);
    this.moltenTex = lavaTexture('molten', 8);

    // Basalt cone: a filler frustum (so the gaps between columns are rock, not sky), the columns and a floor mound.
    const fillMap = map.clone();
    fillMap.repeat.set(5, 1);
    fillMap.needsUpdate = true;
    const fillGlow = glow.clone();
    fillGlow.repeat.set(5, 1);
    fillGlow.needsUpdate = true;
    const fillMat = this.slabMat.clone();
    fillMat.map = fillMap;
    fillMat.emissiveMap = fillGlow;
    this.filler = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 4.9, 5.4, 20, 1).translate(0, 2.7, 0), fillMat);
    this.mound = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.slabMat);
    this.coneG.add(this.filler, this.mound);

    const colGeo = new THREE.CylinderGeometry(0.92, 1, 1, 6, 1).translate(0, 0.5, 0);
    const rnd = rng(23);
    RINGS.forEach((rg, ri) => {
      for (let i = 0; i < rg.n; i++) {
        const mesh = new THREE.Mesh(colGeo, [this.slabMat, ri === 0 ? this.capHot : this.capMat, this.capMat]);
        mesh.castShadow = true;
        const top = rg.top + (rnd() - 0.5) * 0.5;
        this.slabs.push({
          mesh, th: (i / rg.n) * Math.PI * 2 + ri * 0.4 + (rnd() - 0.5) * 0.15, ring: ri, top,
          hs: top + 2.4, spin: rnd() * Math.PI, jit: rnd(), tilt: rg.tilt + (rnd() - 0.5) * 0.08,
        });
        this.coneG.add(mesh);
      }
    });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < ROCKS; i++) {
      const mesh = new THREE.Mesh(rockGeo, this.slabMat);
      this.rocks.push({
        mesh, th: rnd() * Math.PI * 2, r0: 1.8 + rnd() * 2.6, rEnd: 6.0 + rnd() * 1.6, t0: 4.6 + rnd() * 2.3,
        size: 0.18 + rnd() * 0.2, spin: v3(rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2),
      });
      this.coneG.add(mesh);
    }
    this.visuals.add(this.coneG);

    // Crater: three crust discs that cross-fade (crust -> cracked -> molten).
    const discGeo = new THREE.CircleGeometry(1.35, 32);
    for (const [tex, y] of [[this.crustTex, 0], [this.crackedTex, 0.01], [this.moltenTex, 0.02]] as const) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const m = new THREE.Mesh(discGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.userData.dy = y;
      this.craterMats.push(mat);
      this.craters.push(m);
      this.visuals.add(m);
    }

    // Fountain: a molten column at the burst, then toon lava blobs on ballistic arcs.
    this.columnMat = new THREE.MeshBasicMaterial({ map: this.moltenTex.clone(), side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    this.columnMat.map!.repeat.set(2, 3);
    this.columnMat.map!.needsUpdate = true;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, 1, 14, 1, true).translate(0, 0.5, 0), this.columnMat);
    this.column.frustumCulled = false;
    this.visuals.add(this.column);
    this.blobs = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.moltenTex }), BLOBS,
    );
    this.blobs.frustumCulled = false;
    this.blobSeed = Array.from({ length: BLOBS }, () => ({
      f: T_ERUPT + rnd() * 0.4, per: 2.3 + rnd() * 0.7, vy: rnd(), h: rnd(), a: rnd() * Math.PI * 2, size: 0.6 + rnd() * 0.6,
    }));
    const blobCols = [new THREE.Color(1, 0.78, 0.55), new THREE.Color(0.9, 0.5, 0.35), new THREE.Color(0.28, 0.19, 0.17)];
    for (let i = 0; i < BLOBS; i++) this.blobs.setColorAt(i, blobCols[i % 3 === 2 ? 2 : i % 2]);
    this.visuals.add(this.blobs);

    // Lava bombs: tumbling crust rocks, ember tails and dark smoke trails.
    this.bombMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ map: this.crustTex }), BOMBS);
    this.coreMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xff8a24 }), BOMBS);
    this.trailMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x2a2426 }), BOMBS * PUFFS);
    for (const m of [this.bombMesh, this.coreMesh, this.trailMesh]) {
      m.frustumCulled = false;
      this.visuals.add(m);
    }

    // Splat decals where bombs land (alpha cutout, tinted by heat).
    const splatMat = new THREE.MeshBasicMaterial({ map: splatTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.splats = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), splatMat, BOMBS);
    this.splats.frustumCulled = false;
    for (let i = 0; i < BOMBS; i++) this.splats.setColorAt(i, this.col.set(0xffffff));
    this.splatYaw = Array.from({ length: BOMBS }, () => rnd() * Math.PI * 2);
    this.visuals.add(this.splats);

    for (let i = 0; i < STARS; i++) {
      const s = new StarBurst({ points: 9, inner: 0.3, color: ORANGE, core: 0xfff3c0, additive: false });
      this.stars.push(s);
      this.visuals.add(s.mesh);
    }
    this.visuals.add(this.bigStar.mesh);

    // Stamp dust ring and the ground light under the ash.
    this.dustRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0x6b5a50, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.dustRing.rotation.x = -Math.PI / 2;
    this.groundGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ map: groundGlowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.visuals.add(this.dustRing, this.groundGlow, this.ribGroup, this.light);

    // Distortion meshes.
    const dm = [this.hazeCrater, this.hazeCone, this.hazeStamp, ...this.hazeCracks, ...this.hazeImpacts];
    for (const h of dm) this.group.add(h.mesh);
    for (const s of [this.shockBurst, this.shockPulse, this.shockStamp, ...this.shockImpacts]) this.group.add(s.mesh);

    // Particles and smoke.
    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      this.plain.push(e);
      return e;
    };
    this.dust = em({
      maxParticles: 500, lifetime: 1.6, lifetimeJitter: 0.4, shapeSize: 0.8, speed: 3.2, speedJitter: 0.6, spread: 85, gravity: -0.1, drag: 1.4,
      sizeStart: 0.8, sizeEnd: 1.9, colorStart: '#8a7468', colorEnd: '#3a3030', opacityStart: 0.5, opacityEnd: 0, additive: false,
      sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.2,
    });
    this.embers = em({
      maxParticles: 900, lifetime: 1.5, lifetimeJitter: 0.4, shapeSize: 0.5, speed: 9, speedJitter: 0.6, spread: 70, gravity: 8, drag: 0.4,
      sizeStart: 0.16, sizeEnd: 0.04, colorStart: '#ffb040', colorEnd: '#c2261a', opacityStart: 1, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.bits = em({
      maxParticles: 600, lifetime: 1.0, lifetimeJitter: 0.4, shapeSize: 0.3, speed: 6, speedJitter: 0.6, spread: 80, gravity: 14, drag: 0.3,
      sizeStart: 0.24, sizeEnd: 0.08, colorStart: '#2a1a18', colorEnd: '#0e0b0d', opacityStart: 1, opacityEnd: 0.4, additive: false, sizeJitter: 0.5,
    });
    this.smoke.hold = 0.2;
    this.ashNear.hold = 1.4;
    this.ashFar.hold = 1.4;
    for (const s of [this.smoke, this.ashNear, this.ashFar]) {
      this.group.add(s.mesh);
      this.emitters.push(s.emitter);
    }

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return T_ERUPT;
  }

  // --- Cast, ribbons, bomb plan and camera -----------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.C.copy(ctx.point).setY(0);
    this.S.copy(ctx.from).setY(0);
    this.fwd.copy(this.C).sub(this.S).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.back.copy(this.fwd).negate();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.avg.set(0, 0, 0);
    if (ctx.targetPos.length) {
      for (const p of ctx.targetPos) this.avg.add(p);
      this.avg.multiplyScalar(1 / ctx.targetPos.length).setY(0);
    } else this.avg.copy(this.C).addScaledVector(this.back, 3);
    this.buildRibbons();
    this.buildPlan();
    this.buildKeys();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.coneG];
    this.reset();
  }

  private buildRibbons() {
    for (const r of this.ribs) {
      this.ribGroup.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mat.dispose();
    }
    this.ribs = [];
    const rnd = rng(41);
    const C = this.C;
    const add = (kind: Rib['kind'], k: number, pts: THREE.Vector3[], width: number) => {
      const mat = crackMaterial(this.crackTex);
      const mesh = new THREE.Mesh(ribbonGeo(pts, (s) => width * (0.75 + 0.25 * Math.sin(Math.PI * s))), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.ribGroup.add(mesh);
      this.ribs.push({ mesh, mat, kind, k, pts, front: 0 });
    };

    // Stamp crack: from the caster's foot toward the cone base, plus a thin twin.
    const foot = this.S.clone().addScaledVector(this.fwd, 0.6);
    const len = Math.max(4, this.S.distanceTo(C) - 0.6 - 4.8);
    add('stamp', 0, jagged(rnd, foot, this.fwd, len, 0.8, 0.5, 0.045), 0.95);
    add('stamp', 1, jagged(rnd, foot.clone().addScaledVector(this.right, 0.45), this.fwd, len * 0.85, 0.8, 0.6, 0.047), 0.5);

    // Radial ground cracks from the cone to radius 9, each with a short branch.
    const N = 13;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 + (rnd() - 0.5) * 0.18;
      const dir = v3(Math.cos(a), 0, Math.sin(a));
      const r1 = 8.6 + rnd() * 0.8;
      const p0 = C.clone().addScaledVector(dir, 3.5);
      add('main', k, jagged(rnd, p0, dir, r1 - 3.5, 0.7, 0.55, 0.04 + k * 0.0005), 0.8 + rnd() * 0.3);
      const bs = 5.6 + rnd() * 1.6, ba = a + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.3);
      const bdir = v3(Math.cos(ba), 0, Math.sin(ba));
      add('branch', k, jagged(rnd, C.clone().addScaledVector(dir, bs), bdir, 2.0 + rnd() * 0.9, 0.6, 0.4, 0.042), 0.5);
    }

    // Lava rivers down the cone from the crater rim.
    for (let k = 0; k < 6; k++) {
      const th = (k / 6) * Math.PI * 2 + 0.35 + (rnd() - 0.5) * 0.3;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const s = i / 14, r = 1.7 + s * 3.9;
        const a = th + Math.sin(s * 5 + k) * 0.08;
        pts.push(C.clone().add(v3(Math.cos(a) * r, coneH(r) + 0.55, Math.sin(a) * r)));
      }
      add('river', k, pts, 0.75);
    }
  }

  /** Ballistic arcs: two bombs per target (landing at HIT1 / HIT2), the rest at random spots around the cone. */
  private buildPlan() {
    const rnd = rng(77);
    const ctx = this.ctx;
    const crater = this.C.clone().setY(6.0);
    const plan: Bomb[] = [];
    const make = (launchT: number, to: THREE.Vector3, size: number, target: number, landT?: number) => {
      const from = crater.clone().add(v3((rnd() - 0.5) * 1.0, 0, (rnd() - 0.5) * 1.0));
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const flight = 2.2 + dist * 0.06;
      const lt = landT ?? launchT + flight;
      const t0 = lt - flight;
      plan.push({
        launchT: t0, landT: lt, flight, from, to: to.clone(), vy: (to.y - from.y + 0.5 * GRAV * flight * flight) / flight,
        size, target, spin: v3(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4),
      });
    };
    const landPoint = (x: number, z: number) => {
      const r = Math.hypot(x - this.C.x, z - this.C.z);
      return v3(x, r < 5.4 ? coneH(r) + 0.3 : 0.3, z);
    };
    const nT = Math.min(ctx ? ctx.targets.length : 0, 8);
    for (let i = 0; i < nT; i++) {
      const p = ctx!.targetPos[i];
      for (const h of [HIT1, HIT2]) {
        const to = landPoint(p.x + (rnd() - 0.5) * 0.6, p.z + (rnd() - 0.5) * 0.6);
        make(0, to, 1.15, i, h + 0.08 * i);
      }
    }
    while (plan.length < BOMBS) {
      const a = rnd() * Math.PI * 2, r = 5.8 + rnd() * 5.7;
      make(8.3 + rnd() * 2.2, landPoint(this.C.x + Math.cos(a) * r, this.C.z + Math.sin(a) * r), 0.85 + rnd() * 0.3, -1);
    }
    this.plan = plan;

    // Ash: rings of low smoke balls rolling outward from 13.5 s.
    const ash: AshBall[] = [];
    for (let w = 0; w < 13; w++) {
      const t = 13.5 + 0.28 * w, r = 6 + 2.3 * (t - 13.5);
      for (let j = 0; j < 5; j++) {
        const a = ((j + w * 0.37 + rnd() * 0.5) / 5) * Math.PI * 2;
        const size = 1.7 + rnd() * 0.7;
        ash.push({ t, pos: v3(this.C.x + Math.cos(a) * r, size * 0.3, this.C.z + Math.sin(a) * r), size, near: r < 8.5 });
      }
    }
    this.ash = ash;
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, S = this.S, fwd = this.fwd, back = this.back, right = this.right;
    const at = (base: THREE.Vector3, b: number, r: number, y: number) =>
      base.clone().addScaledVector(back, b).addScaledVector(right, r).add(v3(0, y, 0));
    const key = (t: number, position: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false) =>
      keys.push({ t, position, target, fov, roll: 0, cut, ease: 'linear' });

    // 1. Foot close-up: the stamp (the caster is only framed, never moved).
    const footLook = S.clone().addScaledVector(fwd, 1.1).add(v3(0, 0.55, 0));
    key(0, at(S, 3.5, 1.8, 1.2), footLook, 44, true);
    key(1.4 - 0.001, at(S, 3.0, 1.5, 1.2), footLook, 44);

    // 2. Low tracking shot behind the head of the crack as it races into the point.
    const dist = Math.max(4, S.distanceTo(C) - 0.6 - 4.8);
    for (let t = 1.4; t < 2.5 - 1e-6; t += 0.1) {
      const head = S.clone().addScaledVector(fwd, 0.6 + dist * clamp((t - 0.95) / 1.55, 0, 1));
      key(t, at(head, 3.4, 1.3, 0.6), head.clone().addScaledVector(fwd, 3.2).add(v3(0, 0.2, 0)), 58, t === 1.4);
    }

    // 3. Wide from the caster's side: the floor bulges and the columns lock into the cone.
    key(2.5, at(C, 13.5, 7.5, 4.6), C.clone().add(v3(0, 3.0, 0)), 50, true);
    key(4.8 - 0.001, at(C, 12.5, 9.5, 4.2), C.clone().add(v3(0, 3.0, 0)), 50);

    // 4. Low near the cone: rocks tumble down the slope.
    key(4.8, at(C, 9.0, 9.4, 2.5), C.clone().add(v3(0, 3.5, 0)), 46, true);
    key(7.0 - 0.001, at(C, 7.0, 11.0, 2.5), C.clone().add(v3(0, 3.5, 0)), 46);

    // 5. High, looking down into the crater.
    const crater = C.clone().add(v3(0, 5.2, 0));
    key(7.0, at(C, 5.0, 1.5, 13.0), crater, 48, true);
    key(T_ERUPT - 0.001, at(C, 4.2, 1.0, 11.2), crater, 48);

    // 6. Wide, low: the eruption (the whole fountain fits at ~21 m with fov 56 inside the letterbox).
    key(T_ERUPT, at(C, 20, 5, 1.8), C.clone().add(v3(0, 7.5, 0)), 56, true);
    key(9.3 - 0.001, at(C, 18.5, 4, 2.2), C.clone().add(v3(0, 7.5, 0)), 56);

    // 7. Looking up from among the enemies: bombs arcing overhead.
    // Among / behind the enemies, outside the cone, looking up past them at the bombs and the fountain.
    const out = this.avg.clone().sub(C).setY(0);
    if (out.lengthSq() < 1) out.copy(back);
    out.normalize();
    const behind = Math.max(9.5, this.avg.distanceTo(C) + 3);
    const lp = C.clone().addScaledVector(out, behind).add(v3(0, 0.8, 0));
    const lp2 = C.clone().addScaledVector(out, behind - 0.8).add(v3(0, 0.9, 0));
    const mid = C.clone().add(v3(0, 9, 0));
    key(9.3, lp, mid, 68, true);
    key(11.0 - 0.001, lp2, mid, 68);

    // 8. Two ground-level bombardment shots that frame the targets and the cone behind them.
    let rho = 0;
    for (const p of this.ctx?.targetPos ?? []) rho = Math.max(rho, Math.hypot(p.x - this.avg.x, p.z - this.avg.z));
    const d = clamp(7 + rho * 1.4, 9, 18);
    const M = this.avg.clone().lerp(C, 0.35).add(v3(0, 1.5, 0));
    key(11.0, at(M, 2.0, d, 1.5), M, 50, true);
    key(12.2 - 0.001, at(M, 2.0, d - 1.2, 1.5), M, 50);
    key(12.2, at(M, d * 0.95, -d * 0.35, 1.7), M, 50, true);
    key(14.0 - 0.001, at(M, d * 0.85, -d * 0.35, 1.7), M, 50);

    // 9. High orbit around the point: rivers, the ash roll.
    const look = C.clone().add(v3(0, 1.5, 0));
    for (let t = 14; t < 18 - 1e-6; t += 0.25) {
      const a = (t - 14) * 0.22;
      const pos = C.clone().addScaledVector(back, Math.cos(a) * 17).addScaledVector(right, Math.sin(a) * 17).add(v3(0, 11.5, 0));
      key(t, pos, look, 50, t === 14);
    }

    // 10. Gameplay-like framing behind the caster for the cooling.
    const gl = S.clone().lerp(C, 0.72).add(v3(0, 2.2, 0));
    key(18, at(S, 7.0, 1.8, 4.0), gl, 46, true);
    key(DURATION, at(S, 8.5, 1.8, 4.2), gl, 46);

    for (const k of keys) {
      if (k.position.y < 0.45) k.position.y = 0.45;
      if (k.t < 7 || k.t >= 8) {
        // Stay outside the cone (radius 5 plus tilted columns) while it exists.
        const ho = k.position.clone().sub(C).setY(0);
        if (ho.length() < 8) {
          if (ho.lengthSq() < 1e-4) ho.copy(back);
          ho.setLength(8);
          k.position.x = C.x + ho.x;
          k.position.z = C.z + ho.z;
        }
      }
      const off = k.position.clone().sub(k.target);
      if (off.length() > MAX_CAM) k.position.copy(k.target).addScaledVector(off.normalize(), MAX_CAM);
    }
  }

  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: T_START, impact: T_ERUPT }];
  }

  // --- Play / reset ----------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.stamped = false;
    this.ringDust.fill(false);
    this.knocked = false;
    this.erupted = false;
    this.aimed = false;
    this.landed.fill(false);
    this.ashDone = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    for (const s of [this.smoke, this.ashNear, this.ashFar]) s.clear();
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.reset();
  }

  update(dt: number) {
    for (const e of this.plain) e.update(dt);
    this.smoke.update(dt);
    this.ashNear.update(dt);
    this.ashFar.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const t = this.time;
    this.kick *= Math.exp(-dt * 4.5);
    this.events(t, dt);
    this.layout();
  }

  // --- One-shot events (fire when t crosses them) ------------------------------------------------------------

  private events(t: number, dt: number) {
    const C = this.C;
    if (!this.stamped && t >= T_STAMP) {
      this.stamped = true;
      this.kick = Math.max(this.kick, 0.5);
      this.dust.burst(45, this.pa.copy(this.S).addScaledVector(this.fwd, 0.5).setY(0.2));
    }
    RINGS.forEach((rg, i) => {
      if (this.ringDust[i] || t < rg.delay + 0.5) return;
      this.ringDust[i] = true;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i;
        this.dust.burst(14, this.pa.set(C.x + Math.cos(a) * rg.r, 0.3, C.z + Math.sin(a) * rg.r));
      }
    });
    const ctx = this.ctx;
    if (!this.knocked && t >= T_KNOCK) {
      this.knocked = true;
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          if (Math.hypot(ctx.targetPos[i].x - C.x, ctx.targetPos[i].z - C.z) <= RADIUS + 0.5) {
            ctx.hit(e, { damage: 15, knock: 6, from: this.safeFrom(ctx.targetPos[i]), color: '#ff7a1a' });
          }
        });
      }
    }
    if (!this.erupted && t >= T_ERUPT) {
      this.erupted = true;
      this.kick = Math.max(this.kick, 0.8);
      this.embers.burst(220, this.pa.copy(C).setY(CRATER_Y + 0.5));
      this.bits.burst(80, this.pa.copy(C).setY(CRATER_Y + 0.5));
    }
    if (!this.aimed && t >= T_AIM) {
      // Aim the bombs at where the enemies stand now (the knock at 4 s moved them).
      this.aimed = true;
      if (ctx) {
        for (const b of this.plan) {
          if (b.target < 0) continue;
          const g = ctx.targets[b.target]?.group.position;
          if (!g || !Number.isFinite(g.x + g.z)) continue;
          const r = Math.hypot(g.x - C.x, g.z - C.z);
          b.to.set(g.x + (b.to.x - ctx.targetPos[b.target].x), r < 5.4 ? coneH(r) + 0.3 : 0.3, g.z + (b.to.z - ctx.targetPos[b.target].z));
          b.vy = (b.to.y - b.from.y + 0.5 * GRAV * b.flight * b.flight) / b.flight;
        }
      }
    }
    if (dt > 0 && t > T_ERUPT + 0.1 && t < 13.5) this.embers.burst(3, this.pa.copy(C).setY(CRATER_Y + 0.5));
    this.plan.forEach((b, i) => {
      if (this.landed[i] || t < b.landT) return;
      this.landed[i] = true;
      this.onLand(b);
    });
    while (this.ashDone < this.ash.length && t >= this.ash[this.ashDone].t) {
      const a = this.ash[this.ashDone++];
      (a.near ? this.ashNear : this.ashFar).trigger(a.pos, a.size, 2.6);
    }
  }

  private onLand(b: Bomb) {
    this.kick = Math.max(this.kick, b.target >= 0 ? 0.32 : 0.15);
    const p = this.pa.copy(b.to);
    this.bits.burst(26, p);
    this.embers.burst(14, p);
    this.smoke.trigger(this.pb.copy(b.to).setY(b.to.y + 0.3), 0.45, 0.8);
    const ctx = this.ctx;
    if (ctx && b.target >= 0 && ctx.targets[b.target]) {
      ctx.hit(ctx.targets[b.target], { damage: this.settings.damage, knock: 5, from: this.safeFrom(this.pc.copy(b.to)), color: '#ff7a1a' });
    }
  }

  private safeFrom(p: THREE.Vector3): THREE.Vector3 {
    const from = this.C.clone();
    if (from.distanceToSquared(p) < 0.09) from.set(p.x - 0.5, 0, p.z + 0.5);
    return from;
  }

  // --- Layout (pure function of time) ---------------------------------------------------------------------

  private bombPos(b: Bomb, tau: number, out: THREE.Vector3) {
    const s = tau / b.flight;
    out.x = lerp(b.from.x, b.to.x, s);
    out.z = lerp(b.from.z, b.to.z, s);
    out.y = b.from.y + b.vy * tau - 0.5 * GRAV * tau * tau;
    return out;
  }

  private hideAll() {
    this.visuals.visible = false;
    this.light.intensity = 0;
    const z = v3(0, -50, 0);
    for (const h of [this.hazeCrater, this.hazeCone, this.hazeStamp, ...this.hazeCracks, ...this.hazeImpacts]) h.set(z, 0, 0);
    for (const s of [this.shockBurst, this.shockPulse, this.shockStamp, ...this.shockImpacts]) s.set(z, 1, 0);
    this.shake = 0;
  }

  private layout() {
    const on = this.playing;
    if (!on) { this.hideAll(); return; }
    this.visuals.visible = true;
    const t = this.time;
    const C = this.C;
    const cin = this.cinematic;

    sampleShots(this.keys, t, cin);
    cin.letterbox = ss(0.3, 0.8, t) * (1 - ss(18.0, 18.8, t));
    cin.active = true;

    const hot = t < 14 ? 0.15 + 0.85 * ss(3.5, 8.0, t) : Math.max(0.1, 1 - 0.9 * ss(16.5, 20.8, t));
    this.slabMat.emissiveIntensity = 1.1 * hot;
    this.capHot.emissiveIntensity = 0.5 * hot;
    (this.filler.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 * hot;

    this.layoutCone(t);
    this.layoutCrater(t);
    this.layoutFountain(t);
    this.layoutBombs(t);
    this.layoutRibbons(t);
    this.layoutStamp(t);
    this.layoutDistortion(t);

    // Ash light on the ground, and the lava light.
    const gg = ss(12.5, 14.5, t) * (1 - ss(17, 20.5, t));
    this.groundGlow.position.set(C.x, 0.07, C.z);
    this.groundGlow.scale.setScalar(9);
    (this.groundGlow.material as THREE.MeshBasicMaterial).opacity = 0.22 * gg;
    this.groundGlow.visible = gg > 0.01;
    this.light.position.set(C.x, 7, C.z);
    this.light.intensity = 40 * hot * ss(5, 8, t) + (t > T_ERUPT ? 80 * Math.exp(-(t - T_ERUPT) * 2.2) : 0);

    // Screen layer.
    const scr = this.screen;
    scr.darken = 0.28 * ss(0.4, 2.5, t) * (1 - ss(17, 20, t));
    scr.impact = impactFrameAt(t, T_ERUPT, [1, 2], 0.04);
    scr.chroma = chromaPulse(t, T_ERUPT, 0.5, 8);
    scr.speedLines = t >= T_ERUPT ? 0.45 * (1 - ss(T_ERUPT, T_ERUPT + 0.6, t)) : 0;
    scr.focus.copy(C).setY(CRATER_Y);

    // Shake: stamp / rising waves, dead beat 6.9-8.0, eruption, bombardment.
    const base = Math.max(
      0.22 * ss(3.0, 3.4, t) * (1 - ss(6.4, 6.9, t)),
      t >= T_ERUPT ? 0.25 * (1 - ss(10, 11.5, t)) : 0,
      t >= 11 && t < 14 ? 0.08 : 0,
    );
    this.shake = Math.max(base, this.kick);
  }

  /** Basalt columns heave up in waves (outer ring first), rocks tumble, and the cone sinks back at the end. */
  private layoutCone(t: number) {
    const C = this.C;
    const rise0 = ss(1.8, 3.0, t) * (1 - ss(4.4, 5.5, t));
    this.coneG.visible = t > 1.7;
    this.mound.position.set(C.x, -1.25 + 1.25 * rise0, C.z);
    this.mound.scale.set(5.4, 1.1, 5.4);
    const fillUp = ss(3.0, 5.0, t) * (1 - ss(19.4, 21.6, t));
    this.filler.position.set(C.x, -5.6 + 5.6 * fillUp, C.z);
    this.filler.visible = fillUp > 0.01;
    this.mound.visible = rise0 > 0.01;

    for (const s of this.slabs) {
      const rg = RINGS[s.ring];
      const p = clamp((t - rg.delay - s.jit * 0.3) / 0.95, 0, 1);
      // Ease out with a little overshoot, then settle.
      const rise = p >= 1 ? 1 : 1 - Math.pow(1 - p, 3) + 0.06 * Math.sin(p * Math.PI);
      const sink = ss(18.4 + rg.sink, 20.6 + rg.sink, t);
      const tilt = s.tilt + 0.3 * Math.sin(Math.PI * sink) * (0.5 + s.jit);
      const baseFinal = s.top - s.hs * Math.cos(s.tilt);
      const hideY = -s.hs - 0.8;
      const y = lerp(lerp(hideY, baseFinal, rise), hideY, sink);
      const rb = rg.r + s.hs * Math.sin(s.tilt);
      const shiver = (rise < 1 && rise > 0 ? 0.04 : 0) * Math.sin(t * 40 + s.spin * 9);
      s.mesh.position.set(C.x + Math.cos(s.th) * (rb + shiver), y, C.z + Math.sin(s.th) * (rb + shiver));
      this.qa.setFromAxisAngle(this.pa.set(-Math.sin(s.th), 0, Math.cos(s.th)), tilt);
      this.qb.setFromAxisAngle(UP, s.spin);
      s.mesh.quaternion.copy(this.qa).multiply(this.qb);
      s.mesh.scale.set(rg.rad, s.hs, rg.rad);
      s.mesh.visible = rise > 0.001 && sink < 0.999;
    }

    for (const rk of this.rocks) {
      const tau = t - rk.t0;
      const sink = ss(19.2, 20.8, t);
      rk.mesh.visible = tau > 0 && sink < 0.99;
      if (!rk.mesh.visible) continue;
      const e = 1 - Math.exp(-1.6 * tau);
      const r = lerp(rk.r0, rk.rEnd, e);
      const bounce = Math.abs(Math.sin(tau * 7)) * 0.35 * Math.exp(-tau * 0.8);
      const y = (r < 5.2 ? coneH(r) + rk.size : rk.size) + bounce - sink * 1.2;
      rk.mesh.position.set(C.x + Math.cos(rk.th) * r, y, C.z + Math.sin(rk.th) * r);
      rk.mesh.rotation.set(rk.spin.x * tau * (1 - e), rk.spin.y * tau * (1 - e), rk.spin.z * tau * (1 - e));
      rk.mesh.scale.setScalar(rk.size);
    }
  }

  /** Crater crust: plates that heave and crack at 7-8, burst at 8, then molten until it crusts over. */
  private layoutCrater(t: number) {
    const C = this.C;
    const [crust, cracked, molten] = this.craterMats;
    const rim = ss(4.8, 5.6, t);
    crust.opacity = rim * (1 - ss(6.8, 7.2, t) + ss(17.0, 19.0, t));
    cracked.opacity = ss(6.8, 7.2, t) * (1 - ss(T_ERUPT - 0.05, T_ERUPT, t));
    molten.opacity = ss(T_ERUPT - 0.01, T_ERUPT, t) * (1 - ss(17.0, 19.0, t));
    // Cooling: the crust darkens to black, cracks stay faintly red (via the colour multiplier).
    const cool = 1 - ss(17.5, 20.5, t);
    this.col.setRGB(lerp(0.22, 1, cool), lerp(0.12, 1, cool * cool), lerp(0.1, 1, cool * cool), THREE.SRGBColorSpace);
    for (const m of this.craterMats) m.color.copy(this.col);
    const sinkY = ss(19.4, 21.6, t) * 6;
    const heave = 0.35 * ss(7.0, 7.9, t) * (1 - ss(T_ERUPT, T_ERUPT + 0.2, t)) + 0.06 * ss(7.0, 8.0, t) * Math.sin(t * 24);
    this.craters.forEach((m, i) => {
      m.position.set(C.x, CRATER_Y + (m.userData.dy as number) + heave - sinkY, C.z);
      m.visible = this.craterMats[i].opacity > 0.01;
      this.craterMats[i].map!.offset.set(t * 0.02, t * 0.012);
    });
  }

  /** Lava fountain: the burst column, then blobs on ballistic arcs that fall back into the crater. */
  private layoutFountain(t: number) {
    const C = this.C;
    const ac = t - T_ERUPT;
    const H = ac < 0 ? 0 : 15 * (1 - Math.pow(1 - clamp(ac / 0.35, 0, 1), 2)) * (1 - ss(10.5, 12.5, t));
    const wid = lerp(1, 0.55, ss(8.4, 11.5, t));
    this.column.visible = H > 0.05;
    this.column.position.set(C.x, CRATER_Y, C.z);
    this.column.scale.set(wid, Math.max(H, 1e-3), wid);
    this.column.rotation.y = t * 1.5;
    this.columnMat.map!.offset.y = -t * 1.6;
    this.columnMat.opacity = 0.95 * (1 - ss(11.5, 12.5, t));

    this.blobSeed.forEach((b, i) => {
      let hide = t < b.f;
      const pos = this.pa, sc = this.sc;
      if (!hide) {
        const te = b.f + Math.floor((t - b.f) / b.per) * b.per;
        const age = t - te;
        const env = te < 11 ? 1 : lerp(1, 0.35, ss(11, 14.6, te));
        if (te > 14.6) hide = true;
        else {
          const vy = (13 + 4 * b.vy) * env, hs = (0.8 + 2.2 * b.h) * env;
          const y = CRATER_Y + vy * age - 0.5 * 13 * age * age;
          const x = C.x + Math.cos(b.a) * hs * age, z = C.z + Math.sin(b.a) * hs * age;
          if (y < coneH(Math.hypot(x - C.x, z - C.z)) + 0.1 && age > 0.2) hide = true;
          pos.set(x, y, z);
        }
      }
      if (hide) pos.set(0, -100, 0);
      sc.setScalar(hide ? 1e-4 : b.size * (0.8 + 0.2 * Math.sin(t * 5 + i)));
      this.m4.compose(pos, this.qa.identity(), sc);
      this.blobs.setMatrixAt(i, this.m4);
    });
    this.blobs.instanceMatrix.needsUpdate = true;
    this.blobs.visible = t >= T_ERUPT;
  }

  /** Bombs, ember tails, smoke trails, splats, stars. */
  private layoutBombs(t: number) {
    const hide = (mesh: THREE.InstancedMesh, i: number) => {
      this.m4.compose(this.pa.set(0, -100, 0), this.qa.identity(), this.sc.setScalar(1e-4));
      mesh.setMatrixAt(i, this.m4);
    };
    this.plan.forEach((b, i) => {
      const tau = t - b.launchT;
      if (tau < 0 || tau > b.flight) {
        hide(this.bombMesh, i);
        hide(this.coreMesh, i);
      } else {
        this.bombPos(b, tau, this.pa);
        this.ea.set(b.spin.x * tau, b.spin.y * tau, b.spin.z * tau);
        this.qa.setFromEuler(this.ea);
        this.m4.compose(this.pa, this.qa, this.sc.setScalar(0.5 * b.size));
        this.bombMesh.setMatrixAt(i, this.m4);
        this.bombPos(b, Math.max(0, tau - 0.05), this.pb);
        this.pb.sub(this.pa).normalize().multiplyScalar(0.4 * b.size).add(this.pa);
        this.m4.compose(this.pb, this.qb.identity(), this.sc.setScalar(0.3 * b.size));
        this.coreMesh.setMatrixAt(i, this.m4);
      }
      for (let k = 0; k < PUFFS; k++) {
        const tk = tau - (k + 1) * 0.12;
        const idx = i * PUFFS + k;
        if (tau < 0 || tk < 0 || tk > b.flight) { hide(this.trailMesh, idx); continue; }
        this.bombPos(b, tk, this.pa);
        // Small, and shrunk to nothing when close to the camera (perspective would make it a huge disc).
        const near = clamp((this.pa.distanceTo(this.cinematic.position) - 2) / 3, 0, 1);
        const pr = (0.5 - 0.12 * k) * Math.min(1, b.size) * near;
        this.m4.compose(this.pa, this.qb.identity(), this.sc.setScalar(Math.max(pr, 1e-4)));
        this.trailMesh.setMatrixAt(idx, this.m4);
      }
      // Splat decal: pops in at landing, cools from orange to black, sinks away at the end.
      const age = t - b.landT;
      const ground = b.to.y < 0.4;
      if (age < 0 || !ground) hide(this.splats, i);
      else {
        const sz = (1.1 + 0.5 * b.size) * (1 - Math.exp(-age * 18));
        this.qa.setFromAxisAngle(UP, this.splatYaw[i]).multiply(this.qb.setFromAxisAngle(this.sc.set(1, 0, 0), -Math.PI / 2));
        this.pa.set(b.to.x, 0.03 + i * 0.0008 - 0.4 * ss(19, 20.5, t), b.to.z);
        this.m4.compose(this.pa, this.qa, this.sc.set(sz, sz, 1));
        this.splats.setMatrixAt(i, this.m4);
        const c = 1 - ss(0.2, 3.5, age);
        this.splats.setColorAt(i, this.col.setRGB(lerp(0.3, 1, c), lerp(0.2, 1, c * c), lerp(0.2, 1, c * c)));
      }
    });
    for (const m of [this.bombMesh, this.coreMesh, this.trailMesh, this.splats]) m.instanceMatrix.needsUpdate = true;
    if (this.splats.instanceColor) this.splats.instanceColor.needsUpdate = true;

    // Stars: the latest landing mapped to each star slot.
    this.stars.forEach((s, j) => {
      let best = -1;
      this.plan.forEach((b, i) => { if (i % STARS === j && b.landT <= t && (best < 0 || b.landT > this.plan[best].landT)) best = i; });
      const b = best >= 0 ? this.plan[best] : null;
      const age = b ? t - b.landT : -1;
      const pop = StarBurst.pop(age, 0.1, 0.16);
      if (!b || pop.opacity <= 0) { s.set(this.pa.set(0, -100, 0), 1, 0); return; }
      s.set(this.pa.copy(b.to).add(v3(0, 0.7, 0)), (b.target >= 0 ? 3.2 : 2.2) * pop.scale, pop.opacity, best);
    });
    const pop = StarBurst.pop(t - T_ERUPT, 0.04, 0.16);
    this.bigStar.set(this.pa.copy(this.C).setY(CRATER_Y + 1.0), 2 * pop.scale, t >= T_ERUPT ? pop.opacity : 0, 0.2);
  }

  /** Crack ribbons: ground cracks reveal while the cone rises, lava runs down them from 9.4 s; rivers run down the cone. */
  private layoutRibbons(t: number) {
    const cool = 1 - 0.88 * ss(17.8, 20.6, t);
    const fade = 1 - ss(20.6, 21.8, t);
    const glow = 0.1 + 0.25 * ss(3.5, 8.0, t);
    for (const r of this.ribs) {
      const u = r.mat.uniforms;
      u.uTime.value = t;
      if (r.kind === 'stamp') {
        const p = clamp((t - 0.95 - r.k * 0.1) / 1.55, 0, 1);
        u.uShow.value = p * 1.04;
        u.uLava.value = p * 1.06;
        u.uHeat.value = (1 - 0.55 * ss(2.6, 5, t)) * cool;
        u.uGlow.value = 0.12 + (glow - 0.1);
        u.uAlpha.value = fade;
        r.front = p;
      } else if (r.kind === 'river') {
        const p = clamp((t - 8.25 - r.k * 0.12) / 1.6, 0, 1);
        u.uShow.value = p * 1.04;
        u.uLava.value = p * 1.06;
        u.uHeat.value = cool;
        u.uGlow.value = 0.2;
        u.uAlpha.value = 1 - ss(17.6, 18.6, t);
        r.front = p;
      } else {
        const off = r.kind === 'branch' ? 0.5 : 0;
        const show = clamp((t - 3.0 - off - r.k * 0.05) / 2.0, 0, 1);
        const run = clamp((t - 9.4 - off - (r.k % 5) * 0.12) / 6.8, 0, 1);
        u.uShow.value = show * 1.04;
        u.uLava.value = (1 - Math.pow(1 - run, 1.5)) * 1.06;
        u.uHeat.value = cool;
        u.uGlow.value = glow;
        u.uAlpha.value = fade;
        r.front = run;
      }
      r.mesh.visible = u.uShow.value > 0.001 && u.uAlpha.value > 0.01;
    }
  }

  /** Stamp: the dust ring at the foot. */
  private layoutStamp(t: number) {
    const p = clamp((t - T_STAMP) / 0.9, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);
    this.dustRing.visible = t >= T_STAMP && p < 1;
    this.dustRing.position.copy(this.S).addScaledVector(this.fwd, 0.4).setY(0.06);
    this.dustRing.scale.setScalar(0.4 + 3.2 * e);
    (this.dustRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - p);
  }

  /** Heat haze (hero) over the crater, the cone, the lava cracks and every bomb impact, plus the refraction rings. */
  private layoutDistortion(t: number) {
    const C = this.C;
    const pa = this.pa;
    const fade = 1 - ss(17.5, 20.0, t);
    const heat = ss(2.5, 6.5, t) * fade;
    this.hazeCrater.set(pa.set(C.x, CRATER_Y, C.z), 0.02 * heat * (1 + 0.25 * ss(6.8, 8, t) * (1 - ss(8, 8.5, t))), t);
    this.hazeCone.set(pa.set(C.x, 0.3, C.z), 0.012 * heat, t);
    // Stamp crack head.
    const stampRib = this.ribs.find((r) => r.kind === 'stamp');
    if (stampRib) {
      const sp = stampRib.front;
      const head = pa.copy(this.S).addScaledVector(this.fwd, 0.6 + Math.max(4, this.S.distanceTo(C) - 5.4) * sp).setY(0.1);
      this.hazeStamp.set(head, 0.012 * (sp > 0 && sp < 1 ? 1 : 0) * (1 - ss(2.5, 3.0, t)), t);
    } else this.hazeStamp.set(pa.set(0, -50, 0), 0, t);
    // Lava cracks: one haze on every other main crack, riding its flow front.
    const mains = this.ribs.filter((r) => r.kind === 'main');
    this.hazeCracks.forEach((h, i) => {
      const r = mains[i * 2];
      if (!r || r.front <= 0.02) { h.set(pa.set(0, -50, 0), 0, t); return; }
      const f = clamp(r.front * 1.05, 0.05, 1) * (r.pts.length - 1);
      const k = Math.min(r.pts.length - 2, Math.floor(f));
      pa.copy(r.pts[k]).lerp(r.pts[k + 1], f - k);
      h.set(pa, 0.012 * fade, t);
    });
    // Bomb impacts: haze for 1.5 s, a small refraction ring for 0.4 s.
    this.hazeImpacts.forEach((h, k) => {
      let best = -1;
      this.plan.forEach((b, i) => { if (i % HAZES === k && b.landT <= t && (best < 0 || b.landT > this.plan[best].landT)) best = i; });
      const age = best >= 0 ? t - this.plan[best].landT : 9;
      if (age >= 1.5) { h.set(pa.set(0, -50, 0), 0, t); return; }
      h.set(pa.copy(this.plan[best].to).setY(0.1), 0.012 * ss(0, 0.08, age) * (1 - ss(0.9, 1.5, age)), t);
    });
    this.shockImpacts.forEach((s, k) => {
      let best = -1;
      this.plan.forEach((b, i) => { if (i % SHOCKS === k && b.landT <= t && (best < 0 || b.landT > this.plan[best].landT)) best = i; });
      const age = best >= 0 ? t - this.plan[best].landT : 9;
      if (age >= 0.4) { s.set(pa.set(0, -50, 0), 1, 0); return; }
      const p = age / 0.4;
      s.set(pa.copy(this.plan[best].to).setY(0.05), 0.5 + 2.7 * (1 - Math.pow(1 - p, 3)), 0.03 * (1 - p) * (1 - p));
    });
    // The burst: a big ground ring, then camera-facing pulses every 0.8 s while it erupts.
    const after = t - T_ERUPT;
    const pb = clamp(after / 1.2, 0, 1);
    this.shockBurst.set(pa.set(C.x, 0.05, C.z), 1 + 13 * (1 - Math.pow(1 - pb, 3)), after >= 0 && pb < 1 ? 0.06 * (1 - pb) * (1 - pb) : 0);
    const pk = Math.floor((t - 8.4) / 0.8);
    const pp = (t - 8.4 - pk * 0.8) / 0.8;
    this.shockPulse.set(pa.set(C.x, CRATER_Y + 1.5, C.z), 2 + 5 * pp, pk >= 0 && pk < 5 ? 0.03 * (1 - pp) * (1 - pp) : 0);
    const ps = clamp((t - T_STAMP) / 0.6, 0, 1);
    this.shockStamp.set(pa.copy(this.S).addScaledVector(this.fwd, 0.4).setY(0.05), 0.4 + 3.6 * (1 - Math.pow(1 - ps, 3)), t >= T_STAMP && ps < 1 ? 0.025 * (1 - ps) * (1 - ps) : 0);
  }
}

export const calderaAwakeningModule: EffectModule = {
  label: 'caldera awakening',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CalderaAwakening(),
  telegraphs(effect) {
    return (effect as CalderaAwakening).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as CalderaAwakening;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as CalderaAwakening).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
