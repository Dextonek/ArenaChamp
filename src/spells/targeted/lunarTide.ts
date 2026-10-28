import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, flashBeat, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Lunar Tide (targeted ground AoE, radius 7, hero tier, ~20 s cutscene): the caster raises a hand and the moon itself
 * comes down. A huge drawn moon (cratered canvas texture, dark maria, lit limb, a standard lit sphere below the bloom
 * threshold) rises over the far horizon and swells until it fills half the sky. Its gravity lifts the enemies off the
 * ground, rocks and curtains of water climb in rising sheets, droplets stream upward and a tide ripple runs across the
 * floor. Then a crack is drawn across the moon, light leaks out of it, one shard breaks off and falls onto the point.
 * The moon sinks back, the crack closes, pearl motes drift down and the shard stays planted, slowly dissolving.
 *
 * Everything is a pure function of the clock `time` (hits and emitter bursts fire when the clock crosses them), so
 * scrubbing works. Camera: scripted with `cinematic`, every shot placed explicitly (no auto-fit) and clamped to 24
 * from its look-at. The cutscene draws its own sky dome and a horizon skirt (main.ts hides the stage sky during a
 * cinematic) so the far-away moon can set behind a believable horizon.
 *
 * Design: pipeline/designs/lunar-tide.md.
 *
 * Timeline (seconds):
 *  0 call (close on the raised hand) | 1.8 wide over the arena (horizon brightens) | 3 moonrise (low wide, slow push) |
 *  7 pull (cut among the enemies, looking up; ticks 8.5 / 10) | 9.2 side shot, enemies against the moon |
 *  11 crack (close on the moon, dead beat 11.5-12) | 12 shard breaks off (looking up at the moon) | 12.3 ground level, slam
 *  at 12.6 (impact frames, refraction, shell) | 13.7 aftermath from the moon side | 15.2 set (wide, moon sinks) | 20.5 end
 */
export interface LunarTideSettings {
  damage: number;
  loop: boolean;
}

export const defaultLunarTide = (): LunarTideSettings => ({ damage: 80, loop: false });

const DURATION = 20.5;
const RADIUS = 7;
const T_START_TELE = 3;
const T_IMPACT = 12.6;
const T_BREAK = 12.0;
const T_TICK = [8.5, 10, T_IMPACT];
const TICK_DAMAGE = 12;
const CAM_MAX = 24;
const MOON_R = 40;

// Palette: moon white (tiny cores only) -> silver -> tide blue -> pearl accent -> night.
const SILVER = 0xb9c4d6;
const TIDE = 0x2a6fa8;
const PEARL = 0x9fe6ff;
const NIGHT = 0x04060d;

const ROCKS = 30;
const SHEETS = 8;
const RIPPLES = 4;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const UP = v3(0, 1, 0);

/** Small deterministic random generator (mulberry32). */
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

/** Stable hash of three integers to 0..1 (shared mesh corners get the same noise). */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- Drawn textures ---------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The moon, equirectangular (u = 0.5, v = 0.5 is the face toward the arena): mottled silver-blue regolith, big dark
 * maria, ringed craters with a dark outline and a paler rim, and two ray systems. Lit values stay mid-tone.
 */
function moonTexture(): THREE.CanvasTexture {
  const W = 4096, H = 2048;
  return canvasTexture(W, H, (g) => {
    const rnd = rng(11);
    const px = (lon: number) => (0.5 + lon / (Math.PI * 2)) * W;
    const py = (lat: number) => (0.5 - lat / Math.PI) * H;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#8d97aa');
    bg.addColorStop(0.5, '#a3adbf');
    bg.addColorStop(1, '#8b95a8');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Mottling.
    for (let i = 0; i < 1100; i++) {
      const r = 18 + rnd() * 90;
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
      g.fillStyle = rnd() < 0.5 ? 'rgba(60,70,92,0.07)' : 'rgba(225,232,245,0.07)';
      g.fill();
    }
    // Maria: dark irregular seas made of overlapping blobs.
    const seas: [number, number, number][] = [
      [-0.55, 0.32, 0.5], [0.25, 0.42, 0.42], [-0.05, -0.12, 0.34], [0.62, -0.18, 0.4], [-0.78, -0.35, 0.3], [0.1, -0.52, 0.26],
    ];
    for (const [lon, lat, s] of seas) {
      for (let k = 0; k < 22; k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * s * 0.7;
        const cl = lat + Math.sin(a) * d * 0.7;
        const rx = (0.1 + rnd() * 0.16) * s * 700, ry = rx * (0.55 + rnd() * 0.3);
        g.beginPath();
        g.ellipse(px(lon + Math.cos(a) * d / Math.max(Math.cos(cl), 0.3)), py(cl), rx, ry, rnd() * 3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(52,62,84,0.30)';
        g.fill();
      }
    }
    // Ray systems from two big craters.
    for (const [lon, lat] of [[0.45, -0.72], [-0.3, 0.7]]) {
      g.strokeStyle = 'rgba(225,232,246,0.13)';
      for (let k = 0; k < 26; k++) {
        const a = rnd() * Math.PI * 2, l = 160 + rnd() * 420;
        g.lineWidth = 3 + rnd() * 10;
        g.beginPath();
        g.moveTo(px(lon), py(lat));
        g.lineTo(px(lon) + Math.cos(a) * l, py(lat) + Math.sin(a) * l * 0.8);
        g.stroke();
      }
    }
    // Craters: world radius ~ pixel radius, stretched in x by 1 / cos(lat) so they read round on the sphere.
    for (let i = 0; i < 230; i++) {
      const lat = (rnd() * 2 - 1) * 1.15;
      const lon = (rnd() * 2 - 1) * Math.PI * 0.95;
      const big = rnd() < 0.12;
      const r = big ? 40 + rnd() * 70 : 9 + Math.pow(rnd(), 1.6) * 40;
      const stretch = 1 / Math.max(Math.cos(lat), 0.3);
      const cx = px(lon), cy = py(lat);
      g.beginPath();
      g.ellipse(cx, cy, r * stretch, r, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(70,80,104,0.34)';
      g.fill();
      g.lineWidth = Math.max(3, r * 0.1);
      g.strokeStyle = 'rgba(30,36,52,0.85)';
      g.stroke();
      g.beginPath();
      g.ellipse(cx - r * 0.1 * stretch, cy - r * 0.1, r * 0.9 * stretch, r * 0.9, 0, Math.PI * 1.05, Math.PI * 1.75);
      g.lineWidth = Math.max(2, r * 0.07);
      g.strokeStyle = 'rgba(214,222,238,0.7)';
      g.stroke();
      if (big) {
        g.beginPath();
        g.ellipse(cx, cy, r * 0.16 * stretch, r * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200,208,224,0.6)';
        g.fill();
      }
    }
  });
}

interface CrackPoint {
  l: number;
  p: number;
  prog: number;
}

/** The crack across the moon in (longitude, latitude, draw progress): a jagged main line and six forks. */
function makeCrack() {
  const rnd = rng(3);
  const N = 34;
  const a = { l: -0.62, p: 0.62 }, b = { l: 0.55, p: -0.58 };
  const dx = b.l - a.l, dy = b.p - a.p, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const main: CrackPoint[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const off = i === 0 || i === N - 1 ? 0 : (rnd() - 0.5) * 0.05 + (i % 2 ? 0.02 : -0.02);
    main.push({ l: a.l + dx * f + nx * off, p: a.p + dy * f + ny * off, prog: f });
  }
  const branches: CrackPoint[][] = [];
  for (const idx of [8, 15, 22, 28]) {
    const s = main[idx];
    const ang = Math.atan2(dy, dx) + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.6);
    const br: CrackPoint[] = [s];
    for (let k = 1; k <= 7; k++) {
      const prev = br[k - 1];
      const aa = ang + (rnd() - 0.5) * 0.7;
      br.push({ l: prev.l + Math.cos(aa) * 0.055, p: prev.p + Math.sin(aa) * 0.055, prog: Math.min(1, s.prog + k * 0.025) });
    }
    branches.push(br);
  }
  // Where the shard breaks off: the main line at 62 %.
  const bi = Math.round(0.62 * (N - 1));
  return { main, branches, breakL: main[bi].l, breakP: main[bi].p };
}

const CRACK = makeCrack();

/** Crack line texture: R = draw progress (so the shader can reveal it along the line), A = line coverage. */
function crackTexture(width: number, taper: boolean, alpha: number): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  return canvasTexture(W, H, (g) => {
    const px = (l: number) => (0.5 + l / (Math.PI * 2)) * W;
    const py = (p: number) => (0.5 - p / Math.PI) * H;
    g.globalAlpha = alpha;
    const draw = (pts: CrackPoint[], w0: number) => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        g.strokeStyle = `rgb(${Math.round(b.prog * 255)},0,0)`;
        g.lineWidth = taper ? w0 * (1.15 - 0.55 * b.prog) : w0;
        g.beginPath();
        g.moveTo(px(a.l), py(a.p));
        g.lineTo(px(b.l), py(b.p));
        g.stroke();
      }
    };
    if (taper) {
      draw(CRACK.main, width);
      for (const br of CRACK.branches) draw(br, width * 0.5);
    } else {
      for (const k of [1, 0.7, 0.45]) {
        draw(CRACK.main, width * k);
        for (const br of CRACK.branches) draw(br, width * 0.5 * k);
      }
    }
  }, false);
}

/** A water curtain: smooth blue body, wavy lighter bands, dark ink lines, a soft pearl foam gradient on the tip. */
function waterTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = rng(31);
    const body = g.createLinearGradient(0, 0, 0, 256);
    body.addColorStop(0, '#3f88bd');
    body.addColorStop(1, '#1d4f7e');
    g.fillStyle = body;
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 7; k++) {
      const y0 = 40 + k * 28 + rnd() * 10;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = y0 + Math.sin(x * 0.045 + k * 1.7) * 7;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(120,190,226,0.45)';
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(10,36,64,0.55)';
      g.translate(0, 6);
      g.stroke();
      g.translate(0, -6);
    }
    const foam = g.createLinearGradient(0, 0, 0, 52);
    foam.addColorStop(0, 'rgba(176,226,244,0.95)');
    foam.addColorStop(1, 'rgba(176,226,244,0)');
    g.fillStyle = foam;
    g.fillRect(0, 0, 256, 52);
    // Alpha: fade in at the base and at the two side edges.
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,0.95)');
    v.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 256, 256);
    const h = g.createLinearGradient(0, 0, 256, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.1, 'rgba(0,0,0,1)');
    h.addColorStop(0.9, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, 256, 256);
  });
}

/** Ground impact decal: a soot disc with black radial cracks that leak a thin pearl line. */
function groundCrackTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const rnd = rng(17);
    const soot = g.createRadialGradient(256, 256, 0, 256, 256, 240);
    soot.addColorStop(0, 'rgba(4,6,13,0.92)');
    soot.addColorStop(0.55, 'rgba(4,6,13,0.7)');
    soot.addColorStop(1, 'rgba(4,6,13,0)');
    g.fillStyle = soot;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 13; i++) {
      const a0 = (i / 13) * Math.PI * 2 + rnd() * 0.3;
      let x = 256, y = 256, a = a0;
      const pts: [number, number][] = [[x, y]];
      const segs = 6 + Math.floor(rnd() * 3);
      for (let k = 0; k < segs; k++) {
        a += (rnd() - 0.5) * 0.7;
        const l = 24 + rnd() * 26;
        x += Math.cos(a) * l;
        y += Math.sin(a) * l;
        pts.push([x, y]);
      }
      for (const [w, col] of [[11, '#04060d'], [3, '#8fd8ee']] as const) {
        g.beginPath();
        pts.forEach(([qx, qy], j) => (j ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
        g.lineWidth = w;
        g.strokeStyle = col;
        g.stroke();
      }
    }
  });
}

// --- Shaders ----------------------------------------------------------------------------------------------

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Night gradient, sparse tiny stars, and a silver glow along the horizon in the moon's direction.
const skyFragment = /* glsl */ `
  uniform vec3 uTop, uHorizon, uGlow, uGlowDir;
  uniform float uGlowAmt;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
    vec3 d = normalize(vDir) * 85.0;
    vec3 cell = floor(d);
    float st = step(0.9965, hash(cell)) * (1.0 - smoothstep(0.0, 0.38, length(fract(d) - 0.5)));
    col += vec3(0.75, 0.82, 0.95) * st * smoothstep(0.02, 0.2, h) * 0.8;
    vec3 flatDir = normalize(vec3(vDir.x, 0.0, vDir.z) + vec3(1e-5));
    float along = pow(max(dot(flatDir, uGlowDir), 0.0), 5.0);
    col += uGlow * uGlowAmt * along * (1.0 - smoothstep(0.0, 0.5, max(h, 0.0))) * step(-0.02, h);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const crackVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Black crack core, pearl light leaking from it. Revealed along the line by uProg (the textures store progress in R).
const crackFragment = /* glsl */ `
  uniform sampler2D uCrack, uLeak;
  uniform vec3 uPearl;
  uniform float uProg, uGlow;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uCrack, vUv);
    vec4 l = texture2D(uLeak, vUv);
    float a1 = c.a * step(c.r, uProg);
    float a2 = l.a * step(l.r, uProg);
    if (a1 + a2 < 0.01) discard;
    vec3 col = mix(uPearl * uGlow, vec3(0.01, 0.015, 0.03), a1);
    gl_FragColor = vec4(col, max(a1, a2 * 0.9));
    #include <colorspace_fragment>
  }
`;

// --- The effect -------------------------------------------------------------------------------------------

interface Rock {
  ang: number;
  rad: number;
  size: THREE.Vector3;
  t0: number;
  h: number;
  ph: number;
  spin: THREE.Vector3;
  delay: number;
}

interface Sheet {
  mesh: THREE.Mesh;
  k: number;
  a: number;
  rad: number;
  H: number;
  t0: number;
  ph: number;
}

export class LunarTide implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LunarTideSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitsFired = [false, false, false];
  private dropTick = 0;
  private boomDone = false;
  private motesDone = false;
  private smokeDone = false;
  private keys: ShotKey[] = [];

  // Cast geometry. back points from the point toward the caster (the moon is the other way), right is across the shot.
  private C = v3();
  private P0 = v3(0, 0, 12);
  private back = v3(0, 0, 1);
  private right = v3(1, 0, 0);
  private fwdA = v3(0, 0, 1);
  private rightA = v3(-1, 0, 0);
  private S0 = v3();
  private lifts: number[] = [];

  // Sky and horizon.
  private skyU = {
    uTop: { value: new THREE.Color(0x070b18) }, uHorizon: { value: new THREE.Color(0x101a2c) },
    uGlow: { value: new THREE.Color(0x8fa6c8) }, uGlowDir: { value: v3(0, 0, -1) }, uGlowAmt: { value: 0 },
  };
  private sky: THREE.Mesh;
  private skirt: THREE.Mesh;

  // Moon.
  private moonGroup = new THREE.Group();
  private moonMat: THREE.MeshStandardMaterial;
  private crackMat: THREE.ShaderMaterial;
  private crackMesh: THREE.Mesh;
  private halo: THREE.Sprite;
  private moonSun = new THREE.DirectionalLight(0xcfd8ea, 0);
  private moonLight = new THREE.PointLight(0xa8bcdc, 0, 70, 1.5);
  private flashLight = new THREE.PointLight(0xbfeaff, 0, 60, 1.5);
  private lens = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private haze = new HeatHaze({ width: 4, height: 6, scale: 3 });

  // Caster hand.
  private arm: THREE.Mesh;
  private cuff: THREE.Mesh;
  private palm: THREE.Mesh;
  private handStar = new StarBurst({ points: 4, inner: 0.16, jitter: 0.1, color: PEARL, core: 0xf4f1e6 });

  // Pull: rocks, water, ripples.
  private rocks: Rock[] = [];
  private rockMesh: THREE.InstancedMesh;
  private rockInk: THREE.InstancedMesh;
  private sheets: Sheet[] = [];
  private ripples = Array.from({ length: RIPPLES }, () => createRing(PEARL, 0.95, 1, 96));
  private tideShock = new ShockRefraction({ facing: 'ground', width: 0.3 });

  // Shard.
  private shard = new THREE.Group();
  private shardMat: THREE.MeshStandardMaterial;
  private shardHullMat: THREE.MeshBasicMaterial;
  private shardLen = 8;
  private trailOuter: THREE.Mesh;
  private trailInner: THREE.Mesh;
  private trailOuterMat: THREE.MeshBasicMaterial;
  private trailInnerMat: THREE.MeshBasicMaterial;
  private breakStar = new StarBurst({ points: 8, inner: 0.22, color: PEARL, core: 0xf4f1e6 });

  // Impact.
  private bigShock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shell: THREE.Mesh;
  private shellMat: THREE.MeshBasicMaterial;
  private inkRing: THREE.Mesh;
  private inkMat: THREE.MeshBasicMaterial;
  private pearlRing = createRing(PEARL, 0.9, 1, 96);
  private decal: THREE.Mesh;
  private decalMat: THREE.MeshBasicMaterial;
  private impactStar = new StarBurst({ points: 10, inner: 0.28, color: TIDE, core: SILVER });
  private smoke = new SmokeBall({ color: 0x080a14, rim: 0x2a3550, flake: '#0a0c18', maxBalls: 3 });

  private drops: Emitter;
  private splash: Emitter;
  private motes: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = v3();
  private tmpE = new THREE.Euler();
  private colTmp = new THREE.Color();

  constructor(settings: LunarTideSettings = defaultLunarTide()) {
    this.settings = settings;
    this.screen.tint.set(0x1a2848);
    this.screen.impactColor.set(0xcfe2f2);
    this.screen.edgeTint.set(PEARL);
    this.screen.speedLineColor.set(0xdff4ff);
    this.screen.keepHue.set(PEARL);
    this.screen.whiteColor.set(0xe6f4ff);

    // Sky dome and the horizon skirt that lets the moon set (main.ts hides the stage sky during a cinematic).
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: this.skyU,
        vertexShader: skyVertex, fragmentShader: skyFragment,
      }),
    );
    this.sky.renderOrder = -5;
    this.sky.frustumCulled = false;
    this.skirt = new THREE.Mesh(
      new THREE.RingGeometry(55, 240, 64),
      new THREE.MeshBasicMaterial({ color: 0x04070f, fog: false, side: THREE.DoubleSide }),
    );
    this.skirt.rotation.x = -Math.PI / 2;
    this.skirt.frustumCulled = false;
    this.group.add(this.sky, this.skirt);

    // The moon: a lit sphere (map + a soft emissive of the same map so the night side is not black).
    const moonTex = moonTexture();
    this.moonMat = new THREE.MeshStandardMaterial({
      map: moonTex, color: 0xffffff, emissive: 0xffffff, emissiveMap: moonTex, emissiveIntensity: 0.3, roughness: 1, metalness: 0, fog: false,
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.moonMat);
    moon.frustumCulled = false;
    this.crackMat = new THREE.ShaderMaterial({
      uniforms: {
        uCrack: { value: crackTexture(4, true, 1) }, uLeak: { value: crackTexture(18, false, 0.4) },
        uPearl: { value: new THREE.Color(PEARL) }, uProg: { value: 0 }, uGlow: { value: 1 },
      },
      vertexShader: crackVertex, fragmentShader: crackFragment, transparent: true, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.crackMesh = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 48), this.crackMat);
    this.crackMesh.frustumCulled = false;
    this.moonGroup.add(moon, this.crackMesh);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color: 0x6f94c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.group.add(this.moonGroup, this.halo, this.moonSun, this.moonLight, this.flashLight, this.lens.mesh, this.haze.mesh);

    // The caster's raised arm (the arena figure has no pose controls): a sleeve, a cuff, a palm and a pearl glint.
    const sleeve = new THREE.CylinderGeometry(0.1, 0.13, 0.82, 10);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3524, roughness: 0.5, metalness: 0.4 });
    this.arm = new THREE.Mesh(sleeve, armMat);
    this.cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10), armMat);
    this.palm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), armMat);
    for (const m of [this.arm, this.cuff, this.palm]) {
      m.visible = false;
      this.group.add(m);
    }
    this.group.add(this.handStar.mesh);

    this.rockMesh = this.buildRocks();
    this.rockInk = new THREE.InstancedMesh(
      this.rockMesh.geometry, new THREE.MeshBasicMaterial({ color: NIGHT, side: THREE.BackSide, fog: false }), ROCKS,
    );
    this.rockInk.frustumCulled = false;
    this.group.add(this.rockMesh, this.rockInk);

    const waterTex = waterTexture();
    const rs = rng(23);
    const sheetGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true, 0, 1.4).translate(0, 0.5, 0);
    for (let i = 0; i < SHEETS; i++) {
      const mesh = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({
        map: waterTex, color: 0xe0e8f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false,
      }));
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);
      this.sheets.push({
        mesh, k: i, a: (i / SHEETS) * Math.PI * 2 + rs() * 0.4, rad: 0.9 + rs() * 0.5, H: 1.5 + rs() * 1.5,
        t0: 7.0 + i * 0.13 + rs() * 0.15, ph: rs() * 6.28,
      });
    }
    for (const r of this.ripples) {
      r.mesh.visible = false;
      this.group.add(r.mesh);
    }
    this.group.add(this.tideShock.mesh, this.bigShock.mesh);

    // The shard: an elongated, jagged faceted rock (tip at the local origin, body along +Y) with a pearl hull.
    const shardGeo = this.buildShardGeometry();
    this.shardMat = new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05, emissive: 0x0a1624, transparent: true, fog: false,
    });
    this.shardHullMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PEARL), side: THREE.BackSide, transparent: true, fog: false,
    });
    const hullGeo = shardGeo.clone().translate(0, -this.shardLen / 2, 0).scale(1.035, 1.01, 1.035).translate(0, this.shardLen / 2, 0);
    this.shard.add(new THREE.Mesh(shardGeo, this.shardMat), new THREE.Mesh(hullGeo, this.shardHullMat));
    this.shard.visible = false;
    this.group.add(this.shard);
    const trailGeo = new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, 0.5, 0);
    this.trailOuterMat = new THREE.MeshBasicMaterial({ color: SILVER, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.trailInnerMat = new THREE.MeshBasicMaterial({ color: SILVER, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.trailOuter = new THREE.Mesh(trailGeo, this.trailOuterMat);
    this.trailInner = new THREE.Mesh(trailGeo, this.trailInnerMat);
    for (const t of [this.trailOuter, this.trailInner]) {
      t.visible = false;
      t.frustumCulled = false;
      this.group.add(t);
    }
    this.group.add(this.breakStar.mesh);

    // Impact: silver toon shell, ink ring, pearl ring, ground decal, star, small dark smoke.
    this.shellMat = new THREE.MeshBasicMaterial({ color: SILVER, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.shellMat);
    this.inkMat = new THREE.MeshBasicMaterial({ color: NIGHT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.inkRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), this.inkMat);
    this.inkRing.rotation.x = -Math.PI / 2;
    this.decalMat = new THREE.MeshBasicMaterial({
      map: groundCrackTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.decalMat);
    this.decal.rotation.x = -Math.PI / 2;
    for (const o of [this.shell, this.inkRing, this.pearlRing.mesh, this.decal]) {
      o.visible = false;
      o.frustumCulled = false;
      this.group.add(o);
    }
    this.group.add(this.impactStar.mesh, this.smoke.mesh);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.drops = em({
      maxParticles: 700, lifetime: 2.0, lifetimeJitter: 0.4, shape: 'cone', shapeSize: 0.5, speed: 4.5, speedJitter: 0.5, spread: 14,
      gravity: -1.8, drag: 0.5, sizeStart: 0.22, sizeEnd: 0.08, colorStart: '#bfeeff', colorEnd: '#2a6fa8', opacityStart: 0.95, opacityEnd: 0,
      additive: false, sizeJitter: 0.5,
    });
    this.splash = em({
      maxParticles: 500, lifetime: 1.6, lifetimeJitter: 0.4, shapeSize: 0.8, speed: 11, speedJitter: 0.6, spread: 75, gravity: 9, drag: 0.3,
      sizeStart: 0.3, sizeEnd: 0.08, colorStart: '#dff6ff', colorEnd: '#2a6fa8', opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.motes = em({
      maxParticles: 400, lifetime: 4.2, lifetimeJitter: 0.4, shapeSize: 9, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0.35,
      drag: 1.0, sizeStart: 0.16, sizeEnd: 0.05, colorStart: '#9fe6ff', colorEnd: '#2a6fa8', opacityStart: 0.8, opacityEnd: 0, additive: true,
      sizeJitter: 0.5,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points);
    this.smoke.hold = 0.3;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- Construction helpers ------------------------------------------------------------------------------

  private buildRocks(): THREE.InstancedMesh {
    const r = rng(41);
    const base = new THREE.IcosahedronGeometry(1, 0);
    const p = base.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 0.78 + 0.44 * hash3(Math.round(p.getX(i) * 6), Math.round(p.getY(i) * 6), Math.round(p.getZ(i) * 6));
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n);
    }
    base.computeVertexNormals();
    for (let i = 0; i < ROCKS; i++) {
      const s = 0.4 + Math.pow(r(), 1.7) * 0.95;
      this.rocks.push({
        ang: r() * Math.PI * 2, rad: 1.6 + Math.sqrt(r()) * 5.4, size: v3(s * (0.8 + r() * 0.5), s * (0.6 + r() * 0.5), s * (0.8 + r() * 0.5)),
        t0: 7.0 + r() * 1.6, h: 2.2 + r() * 6.2, ph: r() * 6.28, spin: v3((r() - 0.5) * 0.9, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9), delay: 0,
      });
      this.rocks[i].delay = this.rocks[i].rad / 20;
    }
    const mesh = new THREE.InstancedMesh(
      base, new THREE.MeshStandardMaterial({ color: 0x3b4560, roughness: 0.9, metalness: 0.05, flatShading: true, fog: false }), ROCKS,
    );
    mesh.frustumCulled = false;
    return mesh;
  }

  /** A jagged spike: an icosphere stretched along Y, tapered to a tip at the origin, with noisy facets and per-face colours. */
  private buildShardGeometry(): THREE.BufferGeometry {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = [Math.round(x * 4), Math.round(y * 4), Math.round(z * 4)] as const;
      const n1 = hash3(k[0], k[1], k[2]), n2 = hash3(k[2] + 7, k[0] - 3, k[1] + 11);
      const w = y < 0 ? 0.08 + 0.92 * Math.pow(1 + y, 0.85) : 1 - 0.25 * y;
      let ny = y * 4.4;
      if (y > 0.5) ny += (n2 - 0.5) * 1.0;
      p.setXYZ(i, x * 1.15 * w + (n1 - 0.5) * 0.38 * w, ny, z * 0.78 * w + (n2 - 0.5) * 0.3 * w);
    }
    g.computeBoundingBox();
    const minY = g.boundingBox!.min.y;
    g.translate(0, -minY, 0);
    this.shardLen = g.boundingBox!.max.y - minY;
    const colors = new Float32Array(p.count * 3);
    const dark = new THREE.Color(0x2c3446), lite = new THREE.Color(0x98a4b8), vein = new THREE.Color(0x6fb5d6);
    for (let f = 0; f < p.count; f += 3) {
      const h = hash3(f, 5, 9);
      const col = h > 0.92 ? vein : this.colTmp.copy(dark).lerp(lite, h);
      for (let j = 0; j < 3; j++) colors.set([col.r, col.g, col.b], (f + j) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }

  // --- Moon geometry helpers ------------------------------------------------------------------------------

  /** Radius, distance and centre height of the moon at time t (rises 3-7, swells to 3-11, sags a little, sinks 15-19.6). */
  private moonAt(t: number, out: THREE.Vector3): { R: number } {
    const sw = ss(3, 11, t);
    const R = MOON_R * (0.62 + 0.38 * sw);
    const dist = lerp(120, 85, sw);
    const rest = lerp(52, 48, ss(7, 12, t));
    const yc0 = lerp(-R - 3, rest, ss(3, 7, t));
    const yc = lerp(yc0, -R - 3, ss(15.2, 19.6, t));
    out.copy(this.C).addScaledVector(this.back, -dist).setY(yc);
    return { R };
  }

  /** World point on the moon's surface at (longitude, latitude) of its drawn texture (centre = the face toward the arena). */
  private moonSurface(t: number, lon: number, lat: number, lift = 1): THREE.Vector3 {
    const c = v3();
    const { R } = this.moonAt(t, c);
    return c
      .addScaledVector(this.back, R * lift * Math.cos(lat) * Math.cos(lon))
      .addScaledVector(UP, R * lift * Math.sin(lat))
      .addScaledVector(this.right, R * lift * Math.cos(lat) * Math.sin(lon));
  }

  // --- Cast, path and camera keys ------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.C.copy(ctx.point).setY(0);
    this.P0.copy(ctx.from).setY(0);
    this.back.copy(this.P0).sub(this.C).setY(0);
    if (this.back.lengthSq() < 1e-4) this.back.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    if (this.back.lengthSq() < 1e-4) this.back.set(0, 0, 1);
    this.back.normalize();
    // right = (back.z, 0, -back.x): (right, up, back) is right-handed and right is screen-right looking along -back.
    this.right.set(this.back.z, 0, -this.back.x);
    this.fwdA.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.rightA.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.S0.copy(this.moonSurface(T_BREAK, CRACK.breakL, CRACK.breakP));
    this.skyU.uGlowDir.value.copy(this.back).negate();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.shard];
    this.lifts = ctx.targets.map((_, i) => 2.2 + 0.9 * (i % 3));
    this.buildKeys();
    this.reset();
  }

  /** Arm direction at raise amount u: from hanging out-and-down to straight up with a slight lean forward. */
  private armDir(u: number): THREE.Vector3 {
    const th = lerp(-1.35, 1.4, u);
    return v3().addScaledVector(this.rightA, Math.cos(th)).addScaledVector(UP, Math.sin(th)).addScaledVector(this.fwdA, 0.22).normalize();
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, back = this.back, right = this.right;
    const at = (base: THREE.Vector3, b: number, r: number, y: number) =>
      base.clone().addScaledVector(back, b).addScaledVector(right, r).add(v3(0, y, 0));
    const key = (t: number, position: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false) =>
      keys.push({ t, position, target, fov, roll: 0, cut, ease: 'linear' });
    const E = 0.001;
    /** A look-at point 22 along the line from the camera to a (very distant) subject. */
    const aimAt = (pos: THREE.Vector3, subject: THREE.Vector3, d = 22) => pos.clone().addScaledVector(subject.clone().sub(pos).normalize(), d);
    const mid = (t: number) => {
      const c = v3();
      const { R } = this.moonAt(t, c);
      return c.addScaledVector(UP, R * 0.05);
    };

    // 1. Call: low wide, the caster silhouetted against the night sky with the arm raised. Slow push.
    const look1 = this.P0.clone().add(v3(0, 2.0, 0));
    key(0, this.P0.clone().addScaledVector(back, 3).addScaledVector(right, 4).setY(0.8), look1, 76, true);
    key(1.8 - E, this.P0.clone().addScaledVector(back, 2.5).addScaledVector(right, 3.6).setY(0.8), look1, 76);

    // 2. Wide over the arena from behind the caster: the horizon brightens silver.
    const look2 = at(C, -8, 0, 5.5);
    key(1.8, at(C, 12.5, 4.5, 3.0), look2, 60, true);
    key(3 - E, at(C, 11, 3.5, 3.4), look2, 60);

    // 3. Moonrise: low wide, the moon behind the enemies. Slow push, the horizon at the lower third.
    key(3, at(C, 12, -3, 1.6), at(C, -9, 0, 9.0), 62, true);
    key(7 - E, at(C, 10, -2, 1.9), at(C, -9, 0, 9.5), 62);

    // 4. Pull A: among the enemies (outside the prop ring), looking up at the floating figures.
    key(7, at(C, 10.5, 3, 0.9), at(C, -1, 0, 5.5), 66, true);
    key(9.2 - E, at(C, 9.6, 2.5, 1.0), at(C, -1, 0, 5.8), 66);

    // 5. Pull B: a side shot, the floating enemies silhouetted against the moon.
    key(9.2, at(C, 11, 9, 1.0), at(C, -1, 0, 4.5), 56, true);
    key(11 - E, at(C, 10.5, 6.5, 1.1), at(C, -1, 0, 4.7), 56);

    // 6. Crack: close on the moon (it nearly fills the frame), a tiny push through the dead beat.
    const p6 = at(C, 9, 0, 3.5);
    key(11, p6, aimAt(p6, mid(11)), 46, true);
    key(T_BREAK - E, p6.clone().addScaledVector(back, -0.4), aimAt(p6, mid(T_BREAK)), 42);

    // 7. Break: low, looking up the moon's face as the shard leaves the crack and light spills out.
    const p7 = at(C, 8.5, -4, 1.8);
    key(T_BREAK, p7, aimAt(p7, this.S0.clone().add(v3(0, 6, 0))), 52, true);
    key(12.3 - E, at(C, 9, -4, 2.0), aimAt(at(C, 9, -4, 2.0), this.S0.clone().add(v3(0, 22, 0))), 54);

    // 8. Slam: ground level, the point and the enemies in frame, the shard comes down out of the sky.
    key(12.3, at(C, 13, 7, 1.3), C.clone().add(v3(0, 5.5, 0)), 62, true);
    key(13.7 - E, at(C, 12, 6.5, 1.5), C.clone().add(v3(0, 4.5, 0)), 62);

    // 9. Aftermath: from the moon side, the planted shard a silhouette, enemies dropping, water crashing down.
    key(13.7, at(C, -9, -8, 1.6), C.clone().add(v3(0, 3.6, 0)), 56, true);
    key(15.2 - E, at(C, -10, -7, 1.9), C.clone().add(v3(0, 3.9, 0)), 56);

    // 10. Set: wide, low, the moon sinking behind the horizon; the letterbox leaves.
    key(15.2, at(C, 12, -3, 1.8), at(C, -9, 0, 9.0), 62, true);
    key(DURATION, at(C, 15, -3, 2.4), at(C, -9, 0, 9.0), 62);

    // Never further than CAM_MAX from the look-at, never under the floor.
    for (const k of keys) {
      const off = k.position.clone().sub(k.target);
      if (off.length() > CAM_MAX) k.position.copy(k.target).addScaledVector(off.normalize(), CAM_MAX);
      if (k.position.y < 0.6) k.position.y = 0.6;
    }
  }

  /** Danger zone: the shard's landing circle. */
  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: T_START_TELE, impact: T_IMPACT }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private zeroLifts() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) ctx.displace(e, this.tmpA.set(0, 0, 0));
  }

  private reset() {
    this.time = 0;
    this.hitsFired = [false, false, false];
    this.dropTick = 0;
    this.boomDone = false;
    this.motesDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.zeroLifts();
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.time = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.zeroLifts();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const t = this.time;
    for (let i = 0; i < 3; i++) {
      if (!this.hitsFired[i] && t >= T_TICK[i]) this.onHit(i);
    }
    // Droplet columns streaming upward every 0.14 s while the pull lasts.
    while (7.0 + this.dropTick * 0.14 <= t && 7.0 + this.dropTick * 0.14 <= 12.5) {
      const r = rng(1000 + this.dropTick);
      const a = r() * Math.PI * 2, rad = 1.2 + Math.sqrt(r()) * 6;
      this.drops.burst(14, this.tmpA.set(this.C.x + Math.cos(a) * rad, 0.2, this.C.z + Math.sin(a) * rad));
      this.dropTick++;
    }
    if (!this.boomDone && t >= T_IMPACT) {
      this.boomDone = true;
      this.splash.burst(260, this.tmpA.set(this.C.x, 0.6, this.C.z));
    }
    if (!this.smokeDone && t >= T_IMPACT + 0.1) {
      this.smokeDone = true;
      this.smoke.trigger(this.tmpA.set(this.C.x, 0.4, this.C.z), 1.6, 1.3);
    }
    if (!this.motesDone && t >= 15.6) {
      this.motesDone = true;
      this.motes.burst(170, this.tmpA.set(this.C.x, 14, this.C.z));
    }
    this.layout();
  }

  private inRange(): number[] {
    const ctx = this.ctx;
    if (!ctx) return [];
    const out: number[] = [];
    ctx.targets.forEach((_, i) => {
      if (Math.hypot(ctx.targetPos[i].x - this.C.x, ctx.targetPos[i].z - this.C.z) <= RADIUS + 0.5) out.push(i);
    });
    return out;
  }

  private onHit(i: number) {
    this.hitsFired[i] = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const final = i === 2;
    for (const j of this.inRange()) {
      const from = this.C.clone();
      if (from.distanceToSquared(ctx.targetPos[j]) < 0.09) from.set(ctx.targetPos[j].x - 0.5, 0, ctx.targetPos[j].z + 0.5);
      ctx.hit(ctx.targets[j], {
        damage: final ? this.settings.damage : TICK_DAMAGE, knock: final ? 9 : 0, from, color: '#9fe6ff',
      });
    }
  }

  // --- Layout (pure function of time, apart from emitter bursts) -----------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    const c = this.C;

    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.8, t) * (1 - ss(19.5, 20.3, t));
      cin.active = t < 20.3;
    }

    this.layoutSky(t);
    this.layoutMoon(t);
    this.layoutHand(t);
    this.layoutLifts(t);
    this.layoutRocks(t);
    this.layoutSheets(t);
    this.layoutRipples(t);
    this.layoutShard(t);
    this.layoutImpact(t);

    // Screen layer.
    const scr = this.screen;
    scr.darken = on ? 0.34 * ss(0.2, 2.0, t) * (1 - ss(16, 19.5, t)) + 0.14 * ss(10.6, 11.2, t) * (1 - ss(13.5, 14.5, t)) : 0;
    scr.desaturate = on ? 0.5 * ss(10.9, 11.3, t) * (1 - ss(T_BREAK, T_BREAK + 0.25, t)) : 0;
    scr.impact = on ? impactFrameAt(t, T_IMPACT, [1, 2], 0.04) : 0;
    scr.chroma = on ? chromaPulse(t, T_IMPACT, 0.6, 7) : 0;
    scr.speedLines = on && t >= T_IMPACT ? Math.max(0, 0.4 - (t - T_IMPACT) * 3) : 0;
    if (on) {
      const fb = flashBeat(t, T_IMPACT + 0.08, 0.03, 0.08, 0.1);
      scr.exposure = fb.exposure;
      scr.whiteout = 0;
      void fb.whiteout;
      scr.focus.set(c.x, t >= T_IMPACT ? 1.5 : 6, c.z);
    }

    let sh = 0;
    if (on) {
      sh = 0.04 * ss(3, 4, t) * (1 - ss(6.5, 7, t));
      sh = Math.max(sh, 0.05 * ss(7, 8, t) * (1 - ss(11, 11.4, t)));
      for (let i = 0; i < 2; i++) {
        const a = t - T_TICK[i];
        if (a >= 0 && a < 0.8) sh = Math.max(sh, 0.14 * Math.exp(-a * 4));
      }
      sh = Math.max(sh, 0.1 * ss(11, 11.1, t) * (1 - ss(11.5, 11.8, t)));
      if (t >= T_IMPACT) sh = Math.max(sh, 0.8 * Math.exp(-(t - T_IMPACT) * 3.2));
    }
    this.shake = sh;
  }

  private tmpCol(hex: number) {
    return this.colTmp.setHex(hex);
  }

  private layoutSky(t: number) {
    const on = this.playing;
    const u = this.skyU;
    const s1 = on ? ss(0, 2.5, t) : 0;
    u.uTop.value.setHex(0x070b18).lerp(this.tmpCol(0x03050c), s1);
    u.uHorizon.value.setHex(0x101a2c).lerp(this.tmpCol(0x0a1220), s1);
    u.uGlowAmt.value = on ? 0.9 * ss(1.2, 3.2, t) * (1 - 0.5 * ss(6, 8, t)) * (1 - ss(15, 19.5, t)) : 0;
    this.sky.visible = on;
    this.sky.position.copy(this.C);
    this.skirt.visible = on;
    this.skirt.position.set(this.C.x, -0.08, this.C.z);
  }

  private layoutMoon(t: number) {
    const on = this.playing;
    const c = this.tmpB;
    const { R } = this.moonAt(Math.max(t, 0), c);
    const presence = on ? ss(3.0, 3.6, t) * (1 - ss(19.2, 19.7, t)) : 0;
    this.moonGroup.visible = presence > 0.01;
    this.moonGroup.position.copy(c);
    this.moonGroup.scale.setScalar(R);
    this.tmpM.makeBasis(this.back, UP, this.tmpC.copy(this.back).cross(UP));
    this.moonGroup.quaternion.setFromRotationMatrix(this.tmpM);

    // Crack: drawn 11-11.5, a held dead beat, leaks harder after the break, closes 15.4-18.8.
    const prog = on ? ss(11.0, 11.5, t) * (1 - ss(15.4, 18.8, t)) : 0;
    this.crackMat.uniforms.uProg.value = prog;
    this.crackMat.uniforms.uGlow.value = 0.8 + 0.35 * ss(T_BREAK - 0.05, T_BREAK + 0.1, t) * (1 - ss(T_BREAK + 0.1, 14.5, t));
    this.crackMesh.visible = prog > 0.002;

    // Soft halo behind the limb.
    this.halo.position.copy(c).addScaledVector(this.back, -R * 0.6);
    this.halo.scale.setScalar(R * 2.7);
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.3 * presence;

    // Moonlight on the arena: a silver key from the moon's side, a point light over the point, a flash at the slam.
    const sunDir = this.tmpA.copy(this.back).multiplyScalar(0.55).addScaledVector(this.right, 0.7).addScaledVector(UP, 0.5).normalize();
    this.moonSun.position.copy(sunDir).multiplyScalar(100);
    this.moonSun.intensity = on ? 2.2 * ss(2.5, 6, t) * (1 - ss(15.5, 19.5, t)) : 0;
    this.moonLight.position.set(this.C.x, 14, this.C.z);
    this.moonLight.intensity = on ? 9 * ss(5, 8, t) * (1 - ss(13.5, 16, t)) : 0;
    const a = t - T_IMPACT;
    this.flashLight.position.set(this.C.x, 3, this.C.z);
    this.flashLight.intensity = on && a >= 0 ? 50 * Math.exp(-a * 6) : 0;

    // Distortion: a wide lens around the limb, haze under the floating enemies.
    this.lens.set(c, R * 1.15, 0.04 * presence);
    const hz = on ? ss(7.5, 8.5, t) * (1 - ss(12.4, 12.6, t)) : 0;
    this.haze.set(this.tmpA.set(this.C.x, 0.6, this.C.z), 0.012 * hz, Math.max(t, 0), 2.4);
  }

  private layoutHand(t: number) {
    const on = this.playing && this.ctx !== null;
    const u = on ? ss(0.15, 1.4, t) * (1 - ss(5.6, 6.6, t)) : 0;
    const vis = on && t >= 0.1 && t < 6.8;
    for (const m of [this.arm, this.cuff, this.palm]) m.visible = vis;
    const sh = this.tmpA.copy(this.P0).add(v3(0, 1.5, 0)).addScaledVector(this.rightA, 0.5);
    const dir = this.armDir(u);
    this.tmpQ.setFromUnitVectors(UP, dir);
    this.arm.quaternion.copy(this.tmpQ);
    this.cuff.quaternion.copy(this.tmpQ);
    this.arm.position.copy(sh).addScaledVector(dir, 0.41);
    this.cuff.position.copy(sh).addScaledVector(dir, 0.8);
    this.palm.position.copy(sh).addScaledVector(dir, 0.92);
    const glint = on ? ss(0.9, 1.6, t) * (1 - ss(5.8, 6.6, t)) : 0;
    this.handStar.set(this.tmpB.copy(sh).addScaledVector(dir, 1.08), 0.55 * (0.9 + 0.1 * Math.sin(t * 9)), 0.9 * glint, t * 0.5);
  }

  /** Enemies float 2-4 up from 7 s (a slow sway), and drop as the shard lands. */
  private layoutLifts(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    ctx.targets.forEach((e, i) => {
      const f = ss(7.0 + 0.15 * i, 8.6 + 0.15 * i, t) * (1 - ss(T_IMPACT - 0.05, T_IMPACT + 0.2, t));
      const bob = 0.2 * Math.sin(1.6 * t + i * 1.7) * f;
      ctx.displace(e, this.tmpA.set(0.12 * Math.sin(t * 0.9 + i) * f, this.lifts[i] * f + bob, 0.12 * Math.cos(t * 0.8 + i) * f));
    });
  }

  private layoutRocks(t: number) {
    const on = this.playing;
    const dissolve = ss(15.0, 17.5, t);
    for (let i = 0; i < ROCKS; i++) {
      const d = this.rocks[i];
      const grow = on ? ss(d.t0 - 0.4, d.t0 + 0.4, t) * (1 - dissolve) : 0;
      const floorY = d.size.y * 0.6;
      const tt = Math.min(t, T_IMPACT);
      const rise = ss(d.t0, d.t0 + 2.0, tt);
      const yUp = floorY + d.h * rise + 0.3 * Math.sin(tt * 1.3 + d.ph) * rise;
      let y = yUp;
      if (t > T_IMPACT + d.delay) {
        const tf = t - T_IMPACT - d.delay;
        y = Math.max(floorY, yUp - 8 * tf * tf);
      }
      this.tmpA.set(this.C.x + Math.cos(d.ang) * d.rad, y, this.C.z + Math.sin(d.ang) * d.rad);
      const air = y > floorY + 0.05 ? 1 : 0;
      const sp = Math.min(t, T_IMPACT + d.delay + 0.6);
      this.tmpQ.setFromEuler(this.tmpE.set(sp * d.spin.x * air + d.ph, sp * d.spin.y * air, sp * d.spin.z * air));
      this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.copy(d.size).multiplyScalar(grow + 1e-4));
      this.rockMesh.setMatrixAt(i, this.tmpM);
      this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.copy(d.size).multiplyScalar((grow + 1e-4) * 1.09));
      this.rockInk.setMatrixAt(i, this.tmpM);
    }
    this.rockMesh.instanceMatrix.needsUpdate = true;
    this.rockInk.instanceMatrix.needsUpdate = true;
  }

  /** Modest, translucent ribbons of water looping around each floating enemy; faded out near the active camera. */
  private layoutSheets(t: number) {
    const on = this.playing && this.ctx !== null;
    const ctx = this.ctx;
    const collapse = ss(T_IMPACT, T_IMPACT + 0.45, t);
    const fadeOut = 1 - ss(12.9, 14.2, t);
    for (const s of this.sheets) {
      const n = ctx ? ctx.targets.length : 0;
      const ex = n ? ctx!.targetPos[s.k % n].x : this.C.x;
      const ez = n ? ctx!.targetPos[s.k % n].z : this.C.z;
      const lift = n ? this.lifts[s.k % n] : 2.5;
      const rise = on ? ss(s.t0, s.t0 + 1.4, t) : 0;
      const h = s.H * rise * (1 - collapse);
      this.tmpA.set(ex, 0, ez);
      const camD = this.cinematic.active ? this.tmpA.setY(lift).distanceTo(this.cinematic.position) : 99;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = on ? 0.55 * fadeOut * ss(4, 6, camD) : 0;
      s.mesh.visible = h > 0.02 && mat.opacity > 0.01;
      const rad = s.rad * (1 + 0.7 * collapse);
      s.mesh.position.set(ex, lift * 0.55 * rise * (1 - collapse) + 0.2 * Math.sin(t * 1.5 + s.ph), ez);
      s.mesh.rotation.y = s.a + 0.6 * Math.sin(Math.max(t, 0) * 1.1 + s.ph);
      s.mesh.scale.set(rad, Math.max(h, 1e-3), rad);
    }
  }

  /** Tide ripples: pearl rings running out across the floor with a faint refraction on the leading one. */
  private layoutRipples(t: number) {
    const on = this.playing;
    const env = on ? ss(6.8, 7.6, t) * (1 - ss(12.3, 12.6, t)) : 0;
    let lead = 0, leadR = 1;
    this.ripples.forEach((r, k) => {
      const ph = (((t - 6.8) * 0.26 + k / RIPPLES) % 1 + 1) % 1;
      const rad = 1 + 13 * ph;
      r.mesh.visible = env > 0.01;
      r.mesh.position.set(this.C.x, 0.05, this.C.z);
      r.mesh.scale.setScalar(rad);
      r.material.opacity = 0.5 * env * Math.pow(1 - ph, 1.2) * ss(0, 0.08, ph);
      if (k === 0) { lead = env * Math.pow(1 - ph, 1.5) * ss(0, 0.08, ph); leadR = rad; }
    });
    this.tideShock.set(this.tmpA.set(this.C.x, 0.05, this.C.z), leadR, 0.014 * lead);
  }

  /** The shard: breaks off the crack at T_BREAK, falls on a steep arc (accelerating) and plants itself at the point. */
  private layoutShard(t: number) {
    const on = this.playing;
    const a = t - T_BREAK;
    const fall = clamp(a / (T_IMPACT - T_BREAK), 0, 1);
    const s = Math.pow(fall, 1.7);
    const live = on && a >= 0;
    const tip = this.tmpA, dir = this.tmpB;
    if (t < T_IMPACT) {
      const P0 = this.S0, P2 = this.tmpC.copy(this.C).setY(-0.5);
      const P1 = v3().copy(this.C).addScaledVector(this.back, -30).add(v3(0, 80, 0));
      const k0 = (1 - s) * (1 - s), k1 = 2 * s * (1 - s), k2 = s * s;
      tip.set(0, 0, 0).addScaledVector(P0, k0).addScaledVector(P1, k1).addScaledVector(P2, k2);
      dir.set(0, 0, 0).addScaledVector(P1.clone().sub(P0), 2 * (1 - s)).addScaledVector(P2.clone().sub(P1), 2 * s);
      if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0);
      dir.normalize();
    } else {
      const settle = Math.exp(-(t - T_IMPACT) * 9) * Math.sin((t - T_IMPACT) * 38);
      tip.set(this.C.x, -0.8 + 0.18 * settle, this.C.z);
      dir.copy(this.right).multiplyScalar(0.13).add(v3(0, -1, 0)).normalize();
    }
    // Local +Y (the shard's body) points back along the way it came.
    this.tmpQ.setFromUnitVectors(UP, this.tmpS.copy(dir).negate());
    this.shard.position.copy(tip);
    this.shard.quaternion.copy(this.tmpQ);
    const dis = on ? ss(15.2, 19.8, t) : 0;
    const sc = lerp(3.0, 1.0, s) * (1 - 0.35 * dis);
    this.shard.scale.set(sc * (1 - 0.3 * dis), sc, sc * (1 - 0.3 * dis));
    this.shard.visible = live && dis < 0.995;
    this.shardMat.opacity = 1 - ss(0.45, 1, dis);
    this.shardHullMat.opacity = (0.85 + 0.15 * Math.sin(t * 6)) * (1 - ss(0.2, 0.8, dis));

    // Trail: two cones behind the falling shard, gone a moment after the slam.
    const tr = live && t < T_IMPACT + 0.25 ? clamp(a / 0.12, 0, 1) * (1 - ss(T_IMPACT, T_IMPACT + 0.25, t)) : 0;
    const L = 8 + 46 * s;
    for (const [mesh, w] of [[this.trailOuter, 1.4], [this.trailInner, 0.6]] as const) {
      mesh.visible = tr > 0.01;
      mesh.position.copy(tip);
      mesh.quaternion.copy(this.tmpQ);
      mesh.scale.set(w * sc * 0.9, L * 0.55, w * sc * 0.9);
    }
    this.trailOuterMat.opacity = 0.25 * tr;
    this.trailInnerMat.opacity = 0.45 * tr;

    // A pearl star where the shard leaves the moon.
    const pop = StarBurst.pop(a, 0.2, 0.3);
    this.breakStar.set(this.S0, live ? 18 * pop.scale : 0, live ? pop.opacity : 0, a * 0.8);
  }

  /** The slam: big ground refraction ring, silver shell, ink ring, pearl ring, star, scorched crack decal. */
  private layoutImpact(t: number) {
    const on = this.playing;
    const a = t - T_IMPACT;
    const c = this.C;
    const live = on && a >= 0;

    const p1 = clamp(a / 0.45, 0, 1);
    this.shell.visible = live && a < 0.6;
    this.shell.position.set(c.x, 0, c.z);
    this.shell.scale.setScalar(1.2 + 4.6 * (1 - Math.pow(1 - p1, 3)));
    this.shellMat.opacity = live ? 0.5 * Math.pow(1 - clamp(a / 0.4, 0, 1), 1.5) : 0;

    const p2 = clamp(a / 0.6, 0, 1);
    this.inkRing.visible = live && a < 0.7;
    this.inkRing.position.set(c.x, 0.06, c.z);
    this.inkRing.scale.setScalar(1 + 10 * (1 - Math.pow(1 - p2, 3)));
    this.inkMat.opacity = live ? 0.8 * (1 - p2) : 0;

    const p3 = clamp(a / 0.7, 0, 1);
    this.pearlRing.mesh.visible = live && a < 0.8;
    this.pearlRing.mesh.position.set(c.x, 0.07, c.z);
    this.pearlRing.mesh.scale.setScalar(1 + 12 * (1 - Math.pow(1 - p3, 3)));
    this.pearlRing.material.opacity = live ? 0.85 * (1 - p3) : 0;

    const dec = live ? ss(0, 0.2, a) * (1 - ss(15.5, 19.8, t)) : 0;
    this.decal.visible = dec > 0.01;
    this.decal.position.set(c.x, 0.045, c.z);
    this.decal.scale.setScalar(12 * ss(0, 0.25, Math.max(a, 0)) + 1e-3);
    this.decalMat.opacity = dec;

    const pop = StarBurst.pop(a, 0.14, 0.22);
    this.impactStar.set(this.tmpA.set(c.x, 1.8, c.z), live ? 2 * pop.scale : 0, live ? pop.opacity : 0, a * 0.5);

    // The big ground refraction ring (radius 1 -> 14, strength 0.06 -> 0).
    const pb = clamp(a / 0.7, 0, 1);
    this.bigShock.set(this.tmpA.set(c.x, 0.05, c.z), 1 + 13 * (1 - Math.pow(1 - pb, 3)), live && a < 0.7 ? 0.06 * (1 - pb) * (1 - pb) : 0);
  }
}

export const lunarTideModule: EffectModule = {
  label: 'lunar tide',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new LunarTide(),
  telegraphs(effect) {
    return (effect as LunarTide).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as LunarTide;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as LunarTide).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
