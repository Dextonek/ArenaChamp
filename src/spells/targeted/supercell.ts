import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  HeatHaze, LightningArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx,
  createCinematic, createScreenFx, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Supercell (targeted ground AoE, radius 8, hero tier, ~20 s cutscene): the sky turns slate, a rotating wall cloud
 * lowers under a huge anvil, a funnel lowers and touches down at the point as a tornado of dust and debris that pulls
 * the enemies in and spins them up, lightning crawls through the clouds, everything hangs for a dead beat, then one
 * cloud-to-ground bolt runs down the funnel's core, flings the enemies outward and hail rains down while the storm
 * ropes out and the clouds break.
 *
 * Clouds are drawn toon sprites (hard value bands: light top, mid, dark underside, deep base, dark outline) stacked
 * in four layers (anvil, updraught tower, base sheet, rotating wall cloud + collar). The funnel is a twisting tapered
 * tube with a scrolling drawn streak texture and dark rims. Debris are instanced planks, rocks and drawn shards.
 * Everything is a pure function of time t (scrubbing works); one-shot hits, bursts and smoke fire when t crosses
 * their time.
 *
 * Camera (cinematic, every shot placed explicitly from the cast context, no auto-fit, all clamped to <= 24 from the
 * look-at, all kept >= 9.5 from the funnel axis and away from the caster): 0 wide low, the sky darkens | 3.0 looking
 * up under the wall cloud | 5.2 wide on the anvil with flashes | 7.0 side view, the funnel touches down | 9.0 ground
 * level behind the enemies as they are lifted | 11.0 high orbit around the funnel | 13.0 hold, other side, slow
 * push | 14.0 wide strike | 15.0 low from the left, hail | 16.0 wide clearing | 18.0 behind the caster.
 *
 * Timeline: 0.3 letterbox | 3 telegraph | 5.6 funnel starts to lower | 8.0 touchdown | 10, 11, 12 ticks | 13.5-14.0
 * dead beat | 14.0 strike (impact frames, refraction, flings) | 14.3-15.8 hail | 16.4 ropes out | 18.8 letterbox out |
 * 20 end.
 */
export interface SupercellSettings {
  tickDamage: number;
  strikeDamage: number;
  loop: boolean;
}

export const defaultSupercell = (): SupercellSettings => ({ tickDamage: 15, strikeDamage: 75, loop: false });

const DURATION = 20;
const RADIUS = 8;
const T_START = 3;
const T_IMPACT = 9;
const T_TOUCH = 8.0;
const T_STRIKE = 14.0;
const T_IMP = 14.12; // impact frames, blast and refraction come right after the first bolt
const TICKS = [10, 11, 12];
const H = 12.8; // funnel top (cloud base) height
const MAX_CAM = 24;
const SEG = 28;
const RING = 26;
const HAIL = 80;
const FALL = 0.42;
const SHOCKS = 6;

// Palette: lightning white (cores) -> storm violet -> cloud slate -> hail cyan -> storm dark.
const VIOLET = 0x8a7cff;
const CORE = 0xf4f6ff;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));

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

/** Lightning flashes in the clouds: time, level (0 wall cloud, 1 anvil, 2 both), strength. None in the dead beat. */
const FLASHES: { t: number; k: 0 | 1 | 2; s: number }[] = [
  { t: 0.9, k: 1, s: 0.5 }, { t: 1.7, k: 0, s: 0.6 }, { t: 2.3, k: 1, s: 0.6 }, { t: 3.2, k: 0, s: 0.7 },
  { t: 3.7, k: 0, s: 0.7 }, { t: 4.1, k: 2, s: 0.8 }, { t: 4.5, k: 0, s: 0.8 }, { t: 4.9, k: 0, s: 0.8 },
  { t: 5.3, k: 1, s: 0.9 }, { t: 5.7, k: 1, s: 0.9 }, { t: 6.1, k: 2, s: 1 }, { t: 6.5, k: 1, s: 0.9 },
  { t: 6.85, k: 1, s: 1 }, { t: 7.5, k: 0, s: 0.8 }, { t: 8.45, k: 1, s: 0.8 }, { t: 9.3, k: 0, s: 0.7 },
  { t: 10.2, k: 0, s: 0.8 }, { t: 10.7, k: 1, s: 0.8 }, { t: 11.5, k: 0, s: 0.8 }, { t: 12.3, k: 2, s: 0.9 },
  { t: 12.8, k: 0, s: 0.7 },
];

// --- Drawn textures ---------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

type Palette = [string, string, string, string]; // light top, mid, dark underside, deep base
const PAL_DARK: Palette = ['#7e88a1', '#4a5266', '#262c3d', '#0d0f17'];
const PAL_LIT: Palette = ['#b4bdd3', '#7e88a1', '#4a5266', '#262c3d'];
const PAL_DUST: Palette = ['#a08e76', '#76664f', '#4a3f34', '#2b2520'];

/** A toon cloud: overlapping puffs with hard value bands (light top, dark underside), a flat base and a dark outline. */
function cloudTexture(seed: number, pal: Palette): THREE.CanvasTexture {
  const rnd = rng(seed);
  const puffs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const r = 24 + rnd() * 16;
    puffs.push({ x: 36 + (i * 184) / 7 + (rnd() - 0.5) * 10, y: 106 - r * 0.55 - rnd() * 10, r });
  }
  for (let i = 0; i < 4; i++) {
    const r = 20 + rnd() * 14;
    puffs.push({ x: 70 + rnd() * 116, y: 66 + rnd() * 14, r });
  }
  return canvasTexture(256, 160, (g) => {
    g.save();
    g.beginPath();
    g.rect(0, 0, 256, 120);
    g.clip();
    g.fillStyle = '#07080c';
    g.strokeStyle = '#07080c';
    g.lineWidth = 10;
    for (const p of puffs) {
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.stroke();
      g.fill();
    }
    const gr = g.createLinearGradient(0, 14, 0, 120);
    const stops: [number, string][] = [[0, pal[0]], [0.34, pal[0]], [0.34, pal[1]], [0.62, pal[1]], [0.62, pal[2]], [0.84, pal[2]], [0.84, pal[3]], [1, pal[3]]];
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr;
    for (const p of puffs) {
      g.beginPath();
      g.arc(p.x, p.y, p.r - 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  });
}

interface Ell { x: number; y: number; rx: number; ry: number }

interface ToonOpts {
  /** Fraction (0..1) of the shape's height kept from the top: the rest is cut with a gently wavy flat base. */
  keepTop?: number;
  /** Fraction (0..1) of the shape's height cut away from the top: a wavy flat-topped anvil. */
  cutTop?: number;
  /** Light from one side: +1 left, -1 right. */
  light?: 1 | -1;
  /** Lighter rim along the lower edge (the wall cloud). */
  rim?: boolean;
  /** Up to three sparse, slightly curved striation lines (the drum only). */
  striae?: number;
}

/**
 * A big toon cloud mass from ellipses. The shape is fitted into the canvas with 7 % transparent padding on every
 * side, so no quad edge is ever visible; flat bases and tops are wavy cuts, never ruler-straight. Three soft value
 * bands (light top, mid, dark underside), a thin dark outline, optional side light, rim and striae.
 */
function toonCloud(w: number, h: number, pal: Palette, src: Ell[], o: ToonOpts = {}): THREE.CanvasTexture {
  // Fit the ellipses into the padded box.
  const padX = w * 0.07, padY = h * 0.07;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const e of src) {
    x0 = Math.min(x0, e.x - e.rx); x1 = Math.max(x1, e.x + e.rx);
    y0 = Math.min(y0, e.y - e.ry); y1 = Math.max(y1, e.y + e.ry);
  }
  const kx = (w - 2 * padX - 6) / (x1 - x0), ky = (h - 2 * padY - 6) / (y1 - y0);
  const ells = src.map((e) => ({ x: padX + 3 + (e.x - x0) * kx, y: padY + 3 + (e.y - y0) * ky, rx: e.rx * kx, ry: e.ry * ky }));
  const top = padY + 3, bot = h - padY - 3, hh = bot - top;
  const yCutTop = top + (o.cutTop ?? 0) * hh;
  const yCutBot = top + (o.keepTop ?? 1) * hh;
  return canvasTexture(w, h, (g) => {
    // Wavy clip: flat-ish base / top with lumps.
    const wave = (x: number, ph: number) => Math.sin(x * 0.04 + ph) * h * 0.012 + Math.sin(x * 0.115 + ph * 2) * h * 0.007;
    g.save();
    g.beginPath();
    g.moveTo(0, yCutTop + wave(0, 1));
    for (let x = 0; x <= w; x += 8) g.lineTo(x, (o.cutTop ? yCutTop : 0) + (o.cutTop ? wave(x, 1) : 0));
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, (o.keepTop !== undefined ? yCutBot + wave(x, 2) : h));
    g.closePath();
    g.clip();
    const path = (e: Ell, grow: number) => {
      g.beginPath();
      g.ellipse(e.x, e.y, e.rx + grow, e.ry + grow, 0, 0, Math.PI * 2);
    };
    g.fillStyle = '#07080c';
    for (const e of ells) { path(e, 2.5); g.fill(); }
    const b0 = o.cutTop ? yCutTop : top, b1 = o.keepTop !== undefined ? yCutBot : bot;
    const gr = g.createLinearGradient(0, b0, 0, b1);
    const stops: [number, string][] = [[0, pal[0]], [0.2, pal[0]], [0.4, pal[1]], [0.58, pal[1]], [0.8, pal[2]], [1, pal[2]]];
    for (const [s, c] of stops) gr.addColorStop(s, c);
    g.fillStyle = gr;
    for (const e of ells) { path(e, 0); g.fill(); }
    g.globalCompositeOperation = 'source-atop';
    const n = Math.min(3, o.striae ?? 0);
    if (n) {
      g.strokeStyle = 'rgba(7,8,12,0.4)';
      g.lineWidth = 3;
      for (let i = 0; i < n; i++) {
        const y = b0 + (b1 - b0) * (0.34 + i * 0.17);
        g.beginPath();
        g.moveTo(w * 0.1, y);
        g.bezierCurveTo(w * 0.35, y + 9, w * 0.65, y - 9, w * 0.9, y + 4);
        g.stroke();
      }
    }
    if (o.light) {
      const lg = g.createLinearGradient(o.light > 0 ? 0 : w, 0, o.light > 0 ? w * 0.65 : w * 0.35, 0);
      lg.addColorStop(0, 'rgba(200,208,230,0.4)');
      lg.addColorStop(1, 'rgba(200,208,230,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
    }
    if (o.rim) {
      const rg = g.createLinearGradient(0, b1 - h * 0.1, 0, b1);
      rg.addColorStop(0, 'rgba(150,160,200,0)');
      rg.addColorStop(1, 'rgba(150,160,200,0.5)');
      g.fillStyle = rg;
      g.fillRect(0, b1 - h * 0.1, w, h * 0.1);
    }
    g.restore();
  });
}

/** Drawn variants of the big cloud forms: base slab (x2), wall-cloud drum, anvil top, tower column, puff. */
function slabTexture(seed: number): THREE.CanvasTexture {
  const rnd = rng(seed);
  const ells: Ell[] = [];
  for (let i = 0; i < 12; i++) ells.push({ x: 24 + (i * 464) / 11 + (rnd() - 0.5) * 16, y: 150 - rnd() * 50, rx: 44 + rnd() * 30, ry: 22 + rnd() * 18 });
  return toonCloud(512, 256, PAL_DARK, ells, { keepTop: 0.82 });
}

function drumTexture(): THREE.CanvasTexture {
  const rnd = rng(23);
  const ells: Ell[] = [{ x: 256, y: 135, rx: 236, ry: 66 }];
  for (let i = 0; i < 5; i++) ells.push({ x: 90 + i * 80 + (rnd() - 0.5) * 20, y: 92 + rnd() * 10, rx: 50 + rnd() * 20, ry: 30 + rnd() * 10 });
  return toonCloud(512, 256, PAL_DARK, ells, { rim: true, striae: 3 });
}

function anvilTopTexture(): THREE.CanvasTexture {
  const rnd = rng(31);
  const ells: Ell[] = [];
  for (let i = 0; i < 9; i++) ells.push({ x: 40 + i * 54, y: 105 + (rnd() - 0.5) * 16, rx: 60 + rnd() * 26, ry: 34 + rnd() * 12 });
  for (let i = 0; i < 12; i++) ells.push({ x: 20 + i * 42 + rnd() * 16, y: 148 + rnd() * 10, rx: 14 + rnd() * 8, ry: 12 + rnd() * 6 });
  return toonCloud(512, 192, PAL_LIT, ells, { cutTop: 0.16, light: 1 });
}

function columnTexture(): THREE.CanvasTexture {
  const rnd = rng(47);
  const ells: Ell[] = [];
  for (let i = 0; i < 7; i++) ells.push({ x: 128 + (rnd() - 0.5) * 36, y: 350 - i * 46, rx: 62 - i * 3 + rnd() * 14, ry: 42 + rnd() * 10 });
  return toonCloud(256, 384, PAL_LIT, ells, { light: 1 });
}

function puffTexture(seed: number): THREE.CanvasTexture {
  const rnd = rng(seed);
  const ells: Ell[] = [];
  for (let i = 0; i < 9; i++) ells.push({ x: 60 + rnd() * 392, y: 90 + rnd() * 80, rx: 36 + rnd() * 34, ry: 28 + rnd() * 24 });
  return toonCloud(512, 256, PAL_LIT, ells, { keepTop: 0.85, light: 1 });
}


/** Funnel skin: grey-brown dust with slanted light and dark streaks, dark flecks (debris) and hard dark bands. */
function streakTexture(): THREE.CanvasTexture {
  const rnd = rng(11);
  const tex = canvasTexture(256, 512, (g) => {
    g.fillStyle = '#6a6258';
    g.fillRect(0, 0, 256, 512);
    for (let k = 0; k < 90; k++) {
      const x = rnd() * 256, y = rnd() * 512, len = 60 + rnd() * 180;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(40,34,30,0.7)' : 'rgba(150,138,118,0.6)';
      g.lineWidth = 3 + rnd() * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len * 0.35, y + len);
      g.stroke();
    }
    for (let k = 0; k < 40; k++) {
      const x = rnd() * 256, y = rnd() * 512, s = 4 + rnd() * 9;
      g.fillStyle = '#16120f';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + s, y + s * 0.4);
      g.lineTo(x + s * 0.3, y + s * 1.3);
      g.closePath();
      g.fill();
    }
    for (let k = 0; k < 7; k++) {
      g.fillStyle = 'rgba(20,17,15,0.55)';
      g.fillRect(rnd() * 256, 0, 5 + rnd() * 8, 512);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A small jagged debris shard with a dark outline (alpha cutout). */
function shardTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (g) => {
    g.beginPath();
    g.moveTo(8, 40);
    g.lineTo(26, 6);
    g.lineTo(34, 24);
    g.lineTo(56, 22);
    g.lineTo(40, 56);
    g.lineTo(22, 46);
    g.closePath();
    g.fillStyle = '#8f8a80';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#14110f';
    g.stroke();
    g.beginPath();
    g.moveTo(26, 12);
    g.lineTo(32, 26);
    g.lineTo(18, 36);
    g.closePath();
    g.fillStyle = '#b2ab9c';
    g.fill();
  });
}

const FUNNEL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const FUNNEL_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uScroll, uAlpha;
  uniform vec3 uDark;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vec2 q = vec2(vUv.x * 2.0 + vUv.y * 1.3 - uScroll * 0.4, vUv.y * 3.0 + uScroll * 0.8);
    vec3 col = texture2D(uMap, q).rgb;
    float rim = 1.0 - abs(dot(normalize(vN), normalize(vView)));
    // Two hard toon bands: body and dark edges.
    float edge = step(0.6, rim);
    col = mix(col, uDark, edge * 0.75);
    float a = uAlpha * mix(0.55, 0.9, edge) * smoothstep(0.0, 0.1, vUv.y);
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }`;

// --- The effect -------------------------------------------------------------------------------------------

type CloudKind = 'anvil' | 'tower' | 'base' | 'wall' | 'collar';

interface Cloud {
  sp: THREE.Sprite;
  kind: CloudKind;
  ba: number;
  br: number;
  by: number;
  sx: number;
  sy: number;
  shade: number;
  dl: number;
}

interface Debris {
  kind: 0 | 1 | 2; // plank, rock, shard
  slot: number;
  h0: number;
  k: number;
  w: number;
  ph: number;
  rs: number;
  sz: number;
  spin: THREE.Vector3;
  fv: number;
  fvy: number;
}

interface Stone {
  x: number;
  z: number;
  land: number;
  ph: number;
}

export class Supercell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SupercellSettings;
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
  private touched = false;
  private tickDone = [false, false, false];
  private struck = false;
  private dustStep = 0;
  private hailDone = 0;
  private displaced = false;

  private hail: Stone[] = [];
  private spinTab = new Float32Array(Math.ceil(DURATION / 0.02) + 2);

  // Scene parts.
  private visuals = new THREE.Group();
  private clouds: Cloud[] = [];
  private dustSprites: THREE.Sprite[] = [];
  private funnel: THREE.Mesh;
  private funnelMat: THREE.ShaderMaterial;
  private funnelPos: Float32Array;
  private funnelAttr: THREE.BufferAttribute;
  private debris: Debris[] = [];
  private planks: THREE.InstancedMesh;
  private rocks: THREE.InstancedMesh;
  private shards: THREE.InstancedMesh;
  private hailMesh: THREE.InstancedMesh;
  private wallArcs = Array.from({ length: 4 }, () => new LightningArc({ width: 0.5, segments: 10, jitter: 0.14, branches: 2, rerollEvery: 0.05, core: CORE, glow: VIOLET }));
  private anvilArcs = Array.from({ length: 4 }, () => new LightningArc({ width: 1.4, segments: 10, jitter: 0.14, branches: 2, rerollEvery: 0.05, core: CORE, glow: VIOLET }));
  // The strike bolt: a violet glow sheath (0.6) and a thin bright core (0.15), re-rolled with a shared seed.
  private bolt = new LightningArc({ width: 0.6, segments: 18, jitter: 0.07, branches: 6, rerollEvery: 1e9, dropChance: 0, core: 0xb8afff, glow: VIOLET });
  private boltCore = new LightningArc({ width: 0.15, segments: 18, jitter: 0.07, branches: 6, rerollEvery: 1e9, dropChance: 0, core: CORE, glow: 0xdcd8ff });
  private boltSeed = -1;
  private anvilCenter = v3(0, 0, -16);
  private crawlers = Array.from({ length: 5 }, () => new LightningArc({ width: 0.14, segments: 8, jitter: 0.12, branches: 1, rerollEvery: 0.05, core: CORE, glow: VIOLET }));
  private allArcs = [...this.wallArcs, ...this.anvilArcs, this.bolt, this.boltCore, ...this.crawlers];
  private star = new StarBurst({ points: 8, inner: 0.3, color: VIOLET, core: CORE, additive: false });
  private blastRing: THREE.Mesh;
  private blastDark: THREE.Mesh;
  private light = new THREE.PointLight(0xc8d0e8, 0, 40, 2);

  // Distortion.
  private hazes = Array.from({ length: 3 }, () => new HeatHaze({ width: 6, height: 5, scale: 3 }));
  private shockStrike = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private shockGround = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shockTouch = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shockHail = Array.from({ length: SHOCKS }, () => new ShockRefraction({ facing: 'ground', width: 0.3 }));

  // Particles.
  private plain: Emitter[] = [];
  private dust: Emitter;
  private bits: Emitter;
  private ice: Emitter;
  private smoke = new SmokeBall({ color: 0x1c2030, rim: 0x4a5266, flake: 0x1c2030, maxBalls: 10 });

  private m4 = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private ea = new THREE.Euler();
  private pa = v3();
  private pb = v3();
  private sc = v3();
  private flashCol = new THREE.Color(VIOLET);

  constructor(settings: SupercellSettings = defaultSupercell()) {
    this.settings = settings;
    this.screen.tint.set(0x5a6070);
    this.screen.impactColor.set(VIOLET);
    this.screen.edgeTint.set(VIOLET);
    this.group.add(this.visuals);

    // Spin integral (the funnel's rotation speed over time, slowing to a hang in the hold).
    let acc = 0;
    for (let i = 0; i < this.spinTab.length; i++) {
      this.spinTab[i] = acc;
      acc += this.spinRate(i * 0.02) * 0.02;
    }

    const rnd = rng(5);
    const slabTex = [1, 2].map((s) => slabTexture(s * 17));
    const drumTex = drumTexture();
    const anvilTex = anvilTopTexture();
    const columnTex = columnTexture();
    const puffTex = [5, 6].map((s) => puffTexture(s * 13));
    const dustTex = [7, 8].map((s) => cloudTexture(s * 17, PAL_DUST));

    // --- Clouds: three readable masses (flat base, rotating wall cloud, towering anvil) ----------------------
    const addCloud = (kind: CloudKind, tex: THREE.Texture, br: number, by: number, sx: number, sy: number, shade: number, ba = rnd() * Math.PI * 2) => {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.visuals.add(sp);
      this.clouds.push({ sp, kind, ba, br, by, sx, sy, shade, dl: rnd() });
    };
    // (a) Flat dark base overhead: eight huge slabs.
    for (let i = 0; i < 8; i++) {
      const sx = 30 + rnd() * 10;
      addCloud('base', slabTex[i % 2], i === 0 ? 0 : 7 + (i % 3) * 5, 14 + rnd() * 1.4, sx, sx * 0.42, 0.7, i * 0.9);
    }
    // (b) Lowered wall cloud: a drum of five big dark discs with a lighter rim, plus two collar discs.
    for (let i = 0; i < 5; i++) {
      const sx = 15 + rnd() * 5;
      addCloud('wall', drumTex, 4.5, 10.8 + rnd() * 0.6, sx, sx * 0.5, 0.85, (i / 5) * Math.PI * 2);
    }
    for (let i = 0; i < 2; i++) addCloud('collar', drumTex, 0.8, 12.2, 13, 6.5, 0.85, i * Math.PI);
    // (c) Towering anvil in the distance (beyond the point), flat spreading top, lit from the left.
    const tops: [number, number, number][] = [[0, 0, 27.5], [9, 1.6, 28.2], [9, 4.7, 27]];
    for (const [br, ba, by] of tops) addCloud('anvil', anvilTex, br, by, 36 + rnd() * 6, 11.5, 1, ba);
    [16, 19.5, 23, 26].forEach((by, i) => { const sx = 11 + rnd() * 2; addCloud('anvil', columnTex, i * 0.6, by, sx, sx * 1.5, 0.95, rnd() * 6); });
    for (let i = 0; i < 2; i++) addCloud('anvil', puffTex[i], 8, 22 + i * 2, 20, 10, 0.95, i * 3.1);

    // Dust sprites: two blast rings and the skirt at the funnel's foot.
    for (let i = 0; i < 38; i++) {
      const mat = new THREE.SpriteMaterial({ map: dustTex[i % 2], transparent: true, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.visuals.add(sp);
      this.dustSprites.push(sp);
    }

    // --- Funnel -------------------------------------------------------------------------------------------
    const nv = (SEG + 1) * RING;
    this.funnelPos = new Float32Array(nv * 3);
    const nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx: number[] = [];
    for (let j = 0; j < RING; j++) {
      for (let i = 0; i <= SEG; i++) {
        const k = j * (SEG + 1) + i, a = (i / SEG) * Math.PI * 2;
        nrm.set([Math.cos(a), 0, Math.sin(a)], k * 3);
        uv.set([i / SEG, j / (RING - 1)], k * 2);
        if (j < RING - 1 && i < SEG) {
          const c = k + SEG + 1;
          idx.push(k, c, k + 1, k + 1, c, c + 1);
        }
      }
    }
    const fg = new THREE.BufferGeometry();
    this.funnelAttr = new THREE.BufferAttribute(this.funnelPos, 3);
    fg.setAttribute('position', this.funnelAttr);
    fg.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    fg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    fg.setIndex(idx);
    this.funnelMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: streakTexture() }, uScroll: { value: 0 }, uAlpha: { value: 0 }, uDark: { value: new THREE.Color(0x1b1814) } },
      vertexShader: FUNNEL_VERT,
      fragmentShader: FUNNEL_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.funnel = new THREE.Mesh(fg, this.funnelMat);
    this.funnel.frustumCulled = false;
    this.funnel.visible = false;
    this.visuals.add(this.funnel);

    // --- Debris -------------------------------------------------------------------------------------------
    const planksN = 16, rocksN = 18, shardsN = 22;
    this.planks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 1, flatShading: true }), planksN,
    );
    this.rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x5d5a58, roughness: 1, flatShading: true }), rocksN,
    );
    this.shards = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shardTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), shardsN,
    );
    for (const m of [this.planks, this.rocks, this.shards]) {
      m.frustumCulled = false;
      this.visuals.add(m);
    }
    const mkDebris = (kind: 0 | 1 | 2, n: number, size: [number, number]) => {
      for (let i = 0; i < n; i++) {
        this.debris.push({
          kind, slot: i, h0: 0.08 + rnd() * 0.92, k: rnd(), w: 0.8 + rnd() * 1.2, ph: rnd() * Math.PI * 2,
          rs: 4 + rnd() * 5, sz: size[0] + rnd() * (size[1] - size[0]), spin: v3(rnd() * 3 - 1.5, rnd() * 3 - 1.5, rnd() * 3 - 1.5),
          fv: 8 + rnd() * 8, fvy: 2 + rnd() * 6,
        });
      }
    };
    mkDebris(0, planksN, [0.8, 1.4]);
    mkDebris(1, rocksN, [0.22, 0.42]);
    mkDebris(2, shardsN, [0.4, 0.8]);

    // Hail stones.
    this.hailMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0x9fd4e8 }), HAIL);
    this.hailMesh.frustumCulled = false;
    this.visuals.add(this.hailMesh);

    // Strike: lightning, star, toon blast rings (violet edge over a dark ring: black is a colour).
    for (const a of this.allArcs) {
      a.mesh.renderOrder = 5;
      (a.mesh.material as THREE.ShaderMaterial).depthTest = false; // drawn in front of the cloud sprites
      this.visuals.add(a.mesh);
    }
    this.visuals.add(this.star.mesh);
    const ringMat = (color: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.blastRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), ringMat(0xb4a8ff));
    this.blastDark = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.93, 64), ringMat(0x07080c));
    for (const r of [this.blastRing, this.blastDark]) {
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.visuals.add(r);
    }
    this.visuals.add(this.light);

    // Distortion meshes.
    for (const h of this.hazes) this.group.add(h.mesh);
    for (const s of [this.shockStrike, this.shockGround, this.shockTouch, ...this.shockHail]) this.group.add(s.mesh);

    // Particles.
    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      this.plain.push(e);
      return e;
    };
    this.dust = em({
      maxParticles: 600, lifetime: 1.6, lifetimeJitter: 0.4, shapeSize: 0.8, speed: 3.0, speedJitter: 0.6, spread: 85, gravity: -0.1, drag: 1.4,
      sizeStart: 0.8, sizeEnd: 1.8, colorStart: '#8a7a68', colorEnd: '#3a342e', opacityStart: 0.5, opacityEnd: 0, additive: false,
      sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.2,
    });
    this.bits = em({
      maxParticles: 400, lifetime: 1.0, lifetimeJitter: 0.4, shapeSize: 0.3, speed: 6, speedJitter: 0.6, spread: 80, gravity: 14, drag: 0.3,
      sizeStart: 0.2, sizeEnd: 0.07, colorStart: '#2a2622', colorEnd: '#0e0c0a', opacityStart: 1, opacityEnd: 0.4, additive: false, sizeJitter: 0.5,
    });
    this.ice = em({
      maxParticles: 400, lifetime: 0.7, lifetimeJitter: 0.4, shapeSize: 0.15, speed: 3.2, speedJitter: 0.6, spread: 80, gravity: 9, drag: 0.5,
      sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#bfefff', colorEnd: '#6a8aa0', opacityStart: 1, opacityEnd: 0, additive: false, sizeJitter: 0.4,
    });
    this.smoke.hold = 0.35;
    this.group.add(this.smoke.mesh);
    this.emitters.push(this.smoke.emitter);

    this.buildHail();
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return T_STRIKE;
  }

  // --- Cast, hail plan and camera ----------------------------------------------------------------------------

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
    } else this.avg.copy(this.C);
    this.anvilCenter.copy(this.C).addScaledVector(this.fwd, 16);
    this.buildHail();
    this.buildKeys();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.reset();
  }

  /** Stones: the first ones aim at the enemies, the rest scatter over the radius. Landing times 14.3-15.8. */
  private buildHail() {
    const rnd = rng(88);
    const ctx = this.ctx;
    const nT = Math.min(ctx ? ctx.targetPos.length : 0, 6);
    const stones: Stone[] = [];
    for (let i = 0; i < HAIL; i++) {
      let x: number, z: number;
      if (i < nT * 4) {
        const p = ctx!.targetPos[i % nT];
        x = p.x + (rnd() - 0.5) * 2.6;
        z = p.z + (rnd() - 0.5) * 2.6;
      } else {
        const a = rnd() * Math.PI * 2, r = 9 * Math.sqrt(rnd());
        x = this.C.x + Math.cos(a) * r;
        z = this.C.z + Math.sin(a) * r;
      }
      stones.push({ x, z, land: T_STRIKE + 0.3 + FALL + rnd() * 1.5, ph: rnd() * Math.PI * 2 });
    }
    stones.sort((a, b) => a.land - b.land);
    this.hail = stones;
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, S = this.S, back = this.back, right = this.right;
    const at = (base: THREE.Vector3, b: number, r: number, y: number) =>
      base.clone().addScaledVector(back, b).addScaledVector(right, r).add(v3(0, y, 0));
    const up = (y: number) => C.clone().add(v3(0, y, 0));
    const key = (t: number, position: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false, ease: ShotKey['ease'] = 'inOut') =>
      keys.push({ t, position, target, fov, roll: 0, cut, ease });

    // 1. Wide and low: the sky darkens, the cloud base rolls in (the caster is only a small silhouette).
    key(0, at(C, 20, 10, 2.2), up(9), 58, true);
    key(3 - 0.001, at(C, 18, 9, 2.8), up(10.5), 58);

    // 2. Looking up under the wall cloud as it rotates, lightning crawling inside.
    key(3, at(C, 10, 8, 1.3), up(12.5), 64, true);
    key(5.2 - 0.001, at(C, 10.5, 7, 1.2), up(13), 62);

    // 3. Wide on the anvil from the left, flashes inside; the funnel stub shows at the bottom.
    key(5.2, at(C, 15, -10, 2.4), up(17.5), 64, true);
    key(7 - 0.001, at(C, 14, -11, 3.0), up(19), 64);

    // 4. Side view: the funnel lowers and touches down, the dust skirt explodes out.
    key(7, at(C, 2, 13.5, 3.2), up(5.5), 52, true);
    key(9 - 0.001, at(C, 5.5, 12.5, 2.4), up(5.5), 52);

    // 5. Ground level behind the enemies (the funnel is behind them): they are pulled in and lifted.
    const out = this.avg.clone().sub(C).setY(0);
    if (out.lengthSq() < 1 || !this.ctx || !this.ctx.targetPos.length) out.copy(right);
    out.normalize();
    const side = v3(-out.z, 0, out.x);
    const M = C.clone().addScaledVector(out, 2).add(v3(0, 3.2, 0));
    key(9, C.clone().addScaledVector(out, 12.5).add(v3(0, 1.5, 0)), M, 56, true);
    key(11 - 0.001, C.clone().addScaledVector(out, 11.5).addScaledVector(side, 3).add(v3(0, 1.8, 0)), M, 56);

    // 6. High orbit around the funnel (outside it, below the cloud ring).
    for (let t = 11; t < 13 - 1e-6; t += 0.25) {
      const a = 1.0 + 0.35 * (t - 11);
      const pos = C.clone().addScaledVector(back, Math.cos(a) * 14).addScaledVector(right, Math.sin(a) * 14).add(v3(0, 7.5, 0));
      key(t, pos, up(5), 56, t === 11, 'linear');
    }
    key(13 - 0.001, C.clone().addScaledVector(back, Math.cos(1.7) * 14).addScaledVector(right, Math.sin(1.7) * 14).add(v3(0, 7.5, 0)), up(5), 56, false, 'linear');

    // 7. The hold from the other side, a slow push in; the dead beat sits at its end.
    key(13, at(C, 9, -10.5, 1.8), up(5.2), 50, true);
    key(T_STRIKE - 0.001, at(C, 8, -9.2, 1.8), up(5.2), 50);

    // 8. Strike: wide, the bolt, the blast, the enemies flung outward.
    key(T_STRIKE, at(C, 17, 11, 4.2), up(7.5), 62, true);
    key(15 - 0.001, at(C, 15.5, 10, 4.0), up(7.5), 62);

    // 9. Low from the left: hail among the enemies.
    key(15, at(C, 5, -15, 1.4), up(3), 54, true);
    key(16 - 0.001, at(C, 6, -14, 1.7), up(3), 54);

    // 10. Wide: the funnel ropes out, the clouds break.
    key(16, at(C, 20, -6, 7), up(8.5), 58, true);
    key(18 - 0.001, at(C, 21, -4, 9.5), up(10.5), 58);

    // 11. Gameplay-like framing behind the caster for the clearing.
    const gl = S.clone().lerp(C, 0.72).add(v3(0, 2.2, 0));
    key(18, at(S, 7, 1.8, 4), gl, 46, true);
    key(DURATION, at(S, 8.5, 1.8, 4.2), gl, 46);

    // Keep every camera away from the caster, the enemies' start spots and the funnel axis; clamp to the look-at.
    const push = (k: ShotKey, p: THREE.Vector3, minD: number) => {
      const o = k.position.clone().sub(p).setY(0);
      if (o.length() >= minD) return;
      if (o.lengthSq() < 1e-4) o.copy(right);
      o.setLength(minD);
      k.position.x = p.x + o.x;
      k.position.z = p.z + o.z;
    };
    for (const k of keys) {
      for (let pass = 0; pass < 2; pass++) {
        push(k, S, 4.5);
        for (const p of this.ctx?.targetPos ?? []) push(k, p, 3);
        push(k, C, 9.5);
      }
      if (k.position.y < 0.6) k.position.y = 0.6;
      const off = k.position.clone().sub(k.target);
      if (off.length() > MAX_CAM) k.position.copy(k.target).addScaledVector(off.normalize(), MAX_CAM);
    }
  }

  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: T_START, impact: T_IMPACT }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.touched = false;
    this.tickDone.fill(false);
    this.struck = false;
    this.boltSeed = -1;
    this.dustStep = 0;
    this.hailDone = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.reset();
  }

  update(dt: number) {
    for (const e of this.plain) e.update(dt);
    this.smoke.update(dt);
    if (this.playing) {
      this.time += dt;
      if (this.time >= DURATION) {
        if (this.settings.loop) { this.play(); } else this.finish();
      } else {
        this.kick *= Math.exp(-dt * 5);
        this.events(this.time);
        this.layout();
      }
    }
    for (const a of this.allArcs) a.update(dt);
  }

  // --- One-shot events (fire when t crosses them) ------------------------------------------------------------

  private events(t: number) {
    const C = this.C;
    if (!this.touched && t >= T_TOUCH) {
      this.touched = true;
      this.kick = Math.max(this.kick, 0.5);
      this.dust.burst(120, this.pa.copy(C).setY(0.4));
      this.bits.burst(30, this.pa.copy(C).setY(0.4));
    }
    TICKS.forEach((tt, i) => {
      if (this.tickDone[i] || t < tt) return;
      this.tickDone[i] = true;
      this.kick = Math.max(this.kick, 0.25);
      this.hitAll(this.settings.tickDamage, 0);
    });
    if (!this.struck && t >= T_STRIKE) {
      this.struck = true;
      this.kick = Math.max(this.kick, 1.0);
      this.hitAll(this.settings.strikeDamage, 11);
      this.dust.burst(110, this.pa.copy(C).setY(0.4));
      this.bits.burst(60, this.pa.copy(C).setY(0.4));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        this.smoke.trigger(this.pb.set(C.x + Math.cos(a) * 3.2, 0.5, C.z + Math.sin(a) * 3.2), 0.9 + (k % 2) * 0.35, 0.9);
      }
    }
    // Dust ticks every 0.1 s: wind over the arena, then the foot of the funnel.
    while (this.dustStep * 0.1 <= t) {
      const ts = this.dustStep * 0.1;
      const r = rng(1000 + this.dustStep);
      if (ts >= 0.6 && ts < 7.5) {
        const a = r() * Math.PI * 2, d = 8 + r() * 8;
        this.dust.burst(5, this.pa.set(C.x + Math.cos(a) * d, 0.3, C.z + Math.sin(a) * d));
      } else if (ts >= T_TOUCH && ts < 13.5) {
        const a = r() * Math.PI * 2, d = 1.5 + r() * 1.5;
        this.dust.burst(8, this.pa.set(C.x + Math.cos(a) * d, 0.3, C.z + Math.sin(a) * d));
      }
      this.dustStep++;
    }
    while (this.hailDone < this.hail.length && t >= this.hail[this.hailDone].land) {
      const s = this.hail[this.hailDone++];
      this.ice.burst(4, this.pa.set(s.x, 0.2, s.z));
      this.kick = Math.max(this.kick, 0.04);
    }
  }

  private hitAll(damage: number, knock: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      ctx.hit(e, { damage, knock, from: this.safeFrom(ctx.targetPos[i]), color: '#6a6290' });
    });
  }

  private safeFrom(p: THREE.Vector3): THREE.Vector3 {
    const from = this.C.clone();
    if (from.distanceToSquared(p) < 0.09) from.set(p.x - 0.5, 0, p.z + 0.5);
    return from;
  }

  // --- Layout (pure function of time) ------------------------------------------------------------------------

  private spinRate(t: number) {
    return (0.5 * ss(6, 8, t) + 1.4 * ss(8.6, 11, t)) * (1 - 0.88 * ss(12.8, 13.7, t));
  }

  /** Accumulated spin angle of the vortex at time t. */
  private spin(t: number) {
    const f = clamp(t, 0, DURATION) / 0.02;
    const i = Math.floor(f);
    return lerp(this.spinTab[i], this.spinTab[Math.min(i + 1, this.spinTab.length - 1)], f - i);
  }

  /** Wall cloud rotation angle. */
  private wallTheta(t: number) {
    const x = (t - 3) / 6;
    const integral = t < 3 ? 0 : x <= 1 ? 6 * (x * x * x - (x * x * x * x) / 2) : 3 + (t - 9);
    return 0.35 * t + 0.25 * integral;
  }

  /** Funnel width multiplier. */
  private funnelW(t: number) {
    return (0.5 + 0.5 * ss(7.6, 9.8, t)) * (1 - 0.48 * ss(12.8, 13.8, t)) * (1 - 0.55 * ss(16, 18.8, t));
  }

  /** Funnel radius at height y (touch = 1 adds the flare at the foot). */
  private funnelR(y: number, touch: number) {
    const hf = clamp(y / H, 0, 1);
    return 0.85 + 4.2 * Math.pow(hf, 2.2) + touch * 0.9 * Math.exp(-y * 0.9);
  }

  private flashAt(t: number) {
    let f = 0;
    for (const e of FLASHES) {
      const d = t - e.t;
      if (d >= 0 && d < 0.6) f = Math.max(f, e.s * Math.exp(-d / 0.11) * (d > 0.07 && d < 0.11 ? 0.5 : 1));
    }
    const ds = t - T_STRIKE;
    if (ds >= 0 && ds < 1.5) f = Math.max(f, Math.exp(-ds / 0.25));
    return f;
  }

  private hideAll() {
    this.visuals.visible = false;
    this.light.intensity = 0;
    const z = v3(0, -50, 0);
    for (const h of this.hazes) h.set(z, 0, 0);
    for (const s of [this.shockStrike, this.shockGround, this.shockTouch, ...this.shockHail]) s.set(z, 1, 0);
    for (const a of this.allArcs) a.opacity = 0;
    this.shake = 0;
    this.restoreEnemies();
  }

  private restoreEnemies() {
    if (!this.displaced) return;
    this.displaced = false;
    const ctx = this.ctx;
    if (!ctx) return;
    const zero = v3();
    for (const e of ctx.targets) ctx.displace(e, zero);
  }

  private layout() {
    if (!this.playing) { this.hideAll(); return; }
    this.visuals.visible = true;
    const t = this.time;
    const cin = this.cinematic;

    sampleShots(this.keys, t, cin);
    cin.letterbox = ss(0.3, 0.8, t) * (1 - ss(18.0, 18.8, t));
    cin.active = true;

    const flash = this.flashAt(t);
    this.layoutClouds(t, flash);
    this.layoutDust(t);
    this.layoutFunnel(t);
    this.layoutDebris(t);
    this.layoutEnemies(t);
    this.layoutLightning(t);
    this.layoutHail(t);
    this.layoutBlast(t);
    this.layoutDistortion(t);

    this.light.position.set(this.C.x, 11, this.C.z);
    this.light.intensity = 14 * flash;

    // Screen layer: a cold slate world, short impact frames and a chroma pulse at the strike.
    const scr = this.screen;
    const dead = ss(13.2, 13.5, t) * (1 - ss(T_STRIKE, T_STRIKE + 0.05, t));
    scr.darken = (0.5 * ss(0.3, 2.8, t) + 0.08 * dead) * (1 - ss(16.6, 19.4, t));
    scr.impact = impactFrameAt(t, T_IMP, [1, 2], 0.04);
    scr.chroma = chromaPulse(t, T_IMP, 0.55, 8);
    scr.speedLines = 0;
    scr.focus.set(this.C.x, 4, this.C.z);

    // Shake: wind, vortex, the dead beat is still, the strike, hail ticks.
    const base = Math.max(
      0.04 * ss(3, 7, t) * (1 - ss(13, 13.5, t)),
      0.1 * ss(8, 9, t) * (1 - ss(12.8, 13.4, t)),
    );
    this.shake = Math.max(base, this.kick);
  }

  /** Toon cloud sprites: anvil, tower, base sheet, wall cloud and collar. */
  private layoutClouds(t: number, flash: number) {
    const C = this.C, cam = this.cinematic.position;
    const th = this.wallTheta(t);
    const A = this.anvilCenter;
    // Live in-cloud flashes light whole masses from inside: each lights the sprites near its arc.
    const lights: { c: THREE.Vector3; v: number }[] = [];
    FLASHES.forEach((e, i) => {
      const d = t - e.t;
      if (d < 0 || d >= 0.6) return;
      const v = e.s * Math.exp(-d / 0.14) * (d > 0.08 && d < 0.12 ? 0.6 : 1);
      const ends = this.flashEnds(i);
      if (ends.wall) lights.push({ c: ends.wall[0].clone().lerp(ends.wall[1], 0.5), v });
      if (ends.anvil) lights.push({ c: ends.anvil[0].clone().lerp(ends.anvil[1], 0.5), v });
    });
    for (const c of this.clouds) {
      let x: number, z: number, y: number, op: number, k = 1;
      switch (c.kind) {
        case 'anvil': {
          const r = c.br * (0.85 + 0.15 * ss(0, 7, t));
          x = A.x + Math.cos(c.ba) * r;
          z = A.z + Math.sin(c.ba) * r;
          y = c.by;
          op = ss(0.4, 3.2, t);
          break;
        }
        case 'base': {
          const ang = c.ba + 0.05 * t, r = c.br * (1.4 - 0.4 * ss(0, 3.6, t));
          x = C.x + Math.cos(ang) * r;
          z = C.z + Math.sin(ang) * r;
          y = c.by + 1.2 * (1 - ss(0, 3.6, t));
          op = 0.3 + 0.7 * ss(0, 2.8, t);
          break;
        }
        case 'wall': {
          const ang = c.ba + th, r = c.br * (0.8 + 0.2 * ss(1.5, 5, t));
          x = C.x + Math.cos(ang) * r;
          z = C.z + Math.sin(ang) * r;
          y = c.by + 2.2 * (1 - ss(1.5, 5.5, t));
          op = ss(1.2, 3.6, t);
          k = 0.6 + 0.4 * ss(1.2, 3.6, t);
          break;
        }
        default: {
          const ang = c.ba + th * 0.7;
          x = C.x + Math.cos(ang) * c.br;
          z = C.z + Math.sin(ang) * c.br;
          y = c.by + 2.2 * (1 - ss(1.5, 5.5, t));
          op = ss(1.4, 3.8, t);
          k = 0.6 + 0.4 * ss(1.4, 3.8, t);
        }
      }
      // Clearing: each sprite thins out and drifts away on its own delay.
      const brk = 1 - ss(16.3 + c.dl * 2.0, 17.8 + c.dl * 2.2, t);
      y += 1.5 * (1 - brk);
      c.sp.position.set(x, y, z);
      const near = ss(c.sx * 0.35, c.sx * 0.35 + 8, c.sp.position.distanceTo(cam));
      const mat = c.sp.material;
      mat.opacity = 0.97 * op * brk * near;
      c.sp.visible = mat.opacity > 0.01;
      c.sp.scale.set(c.sx * k, c.sy * k, 1);
      let f = flash * 0.3;
      for (const l of lights) f += l.v * (1 - ss(c.sx * 0.4, c.sx * 1.1 + 10, c.sp.position.distanceTo(l.c)));
      f = clamp(f, 0, 1);
      mat.color.setScalar(c.shade).lerp(this.flashCol, f * 0.6).multiplyScalar(1 + 0.4 * f);
    }
  }

  /** Dust sprites: two expanding blast rings (touchdown, strike) and the skirt at the funnel's foot. */
  private layoutDust(t: number) {
    const C = this.C, cam = this.cinematic.position;
    const place = (sp: THREE.Sprite, x: number, y: number, z: number, size: number, op: number, shade: number) => {
      sp.position.set(x, y, z);
      sp.scale.set(size, size * 0.75, 1);
      const o = op * ss(2.5, 6, sp.position.distanceTo(cam));
      sp.material.opacity = o;
      sp.material.color.setScalar(shade);
      sp.visible = o > 0.01;
    };
    const rings: [number, number][] = [[T_TOUCH, 8.5], [T_STRIKE, 12]];
    rings.forEach(([tb, rmax], s) => {
      for (let j = 0; j < 14; j++) {
        const sp = this.dustSprites[s * 14 + j];
        const tau = t - tb;
        const p = clamp(tau / 1.4, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const ang = (j / 14) * Math.PI * 2 + s * 0.3;
        const r = 1.2 + (rmax - 1.2) * e;
        place(sp, C.x + Math.cos(ang) * r, 0.7 + 0.8 * e, C.z + Math.sin(ang) * r, 2.6 + 2.2 * e, tau < 0 ? 0 : 0.9 * (1 - ss(0.5, 1, p)), 0.9);
      }
    });
    const W = this.funnelW(t);
    const spin = this.spin(t);
    const skirt = ss(8.2, 9.0, t) * (1 - 0.5 * ss(12.8, 13.7, t)) * (1 - ss(16.4, 18.6, t));
    for (let j = 0; j < 10; j++) {
      const sp = this.dustSprites[28 + j];
      const ang = (j / 10) * Math.PI * 2 + spin * 1.3;
      const r = (2.0 + 0.9 * Math.sin(j * 2.1)) * (0.75 + 0.25 * W);
      place(sp, C.x + Math.cos(ang) * r, 0.6 + 0.25 * (j % 3), C.z + Math.sin(ang) * r, 2.4 + 0.4 * (j % 3), 0.8 * skirt, 0.85);
    }
  }

  /** The tapered, twisting funnel: lowers from the wall cloud, touches down, thins in the hold, ropes out and lifts. */
  private layoutFunnel(t: number) {
    const C = this.C;
    const reach = ss(5.6, 8.0, t) * (1 - 0.55 * ss(16.4, 19.0, t));
    const touch = ss(0.93, 1, reach);
    const W = this.funnelW(t);
    const vis = ss(5.6, 6.3, t) * (1 - ss(18.4, 19.7, t));
    const amp = (0.75 + 1.8 * ss(15.5, 19, t)) * (1 - 0.5 * ss(13, 13.8, t));
    const oy = 6;
    for (let j = 0; j < RING; j++) {
      const s = j / (RING - 1);
      const y = Math.max(H - s * reach * H, 0.02);
      const hf = clamp(y / H, 0, 1);
      const taper = lerp(0.2 + 0.8 * (1 - ss(0.7, 1, s)), 1, touch);
      const r = this.funnelR(y, touch) * W * taper;
      const gain = Math.pow(hf, 1.3) * amp;
      const ox = (Math.sin(y * 0.42 - t * 1.4) * 0.9 + Math.sin(y * 0.85 + t * 2.3) * 0.28) * gain;
      const oz = Math.cos(y * 0.37 - t * 1.1) * 0.8 * gain;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const rr = r * (1 + 0.08 * Math.sin(a * 3 + y * 1.1 - t * 2.5));
        this.funnelPos.set([ox + Math.cos(a) * rr, y - oy, oz + Math.sin(a) * rr], (j * (SEG + 1) + i) * 3);
      }
    }
    this.funnelAttr.needsUpdate = true;
    this.funnel.position.set(C.x, oy, C.z);
    this.funnelMat.uniforms.uAlpha.value = 0.8 * vis;
    this.funnelMat.uniforms.uScroll.value = this.spin(t) * 0.8 + t * 0.3;
    this.funnel.visible = vis > 0.01;
  }

  /** Debris: pulled in from the ground, rising into the orbit, hanging, then flung outward at the strike. */
  private layoutDebris(t: number) {
    const C = this.C;
    const tt = Math.min(t, T_STRIKE);
    const tau = Math.max(0, t - T_STRIKE);
    const W = this.funnelW(tt);
    const vis = ss(7.4, 8.2, t) * (1 - ss(17, 18, t));
    const sp = this.spin(tt);
    const rise = ss(8, 10.6, tt);
    const kk = ss(7.6, 10.2, tt);
    const hang = ss(12.8, 13.6, tt);
    for (const d of this.debris) {
      const y0 = d.h0 * 9 * rise + 0.25 + (0.2 * Math.sin(tt * 2.2 + d.ph) + 0.25 * hang * Math.sin(tt * 1.7 + d.ph)) * rise;
      const fr = this.funnelR(Math.min(y0, H), 1) * Math.sqrt(W) * (1.1 + d.k * 0.5) + 0.5;
      let r = lerp(d.rs, fr, kk);
      const th = sp * d.w + d.ph;
      let y = Math.max(y0, 0.15);
      if (tau > 0) {
        r += (d.fv * (1 - Math.exp(-1.6 * tau))) / 1.6;
        y = Math.max(0.15, y0 + d.fvy * tau - 7 * tau * tau);
      }
      const rot = sp * 1.2 + Math.min(tau, 1.2) * 3;
      this.ea.set(d.spin.x * rot, d.spin.y * rot, d.spin.z * rot);
      this.qa.setFromEuler(this.ea);
      const scale = Math.max(d.sz * vis, 1e-4);
      this.m4.compose(this.pa.set(C.x + Math.cos(th) * r, y - 0.35 * ss(17, 18, t), C.z + Math.sin(th) * r), this.qa, this.sc.setScalar(scale));
      const mesh = d.kind === 0 ? this.planks : d.kind === 1 ? this.rocks : this.shards;
      mesh.setMatrixAt(d.slot, this.m4);
    }
    for (const m of [this.planks, this.rocks, this.shards]) m.instanceMatrix.needsUpdate = true;
  }

  /** The enemies are pulled in, lifted and spun, hang, then thrown outward at the strike (the hit's knockback carries on). */
  private layoutEnemies(t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (t >= 16) { this.restoreEnemies(); return; }
    const C = this.C;
    ctx.targets.forEach((e, i) => {
      const p0 = ctx.targetPos[i];
      const dx = p0.x - C.x, dz = p0.z - C.z;
      const r0 = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx);
      const orbit = (tt: number, out: THREE.Vector3) => {
        const r = lerp(r0, 2.9 + (i % 3) * 0.8, ss(8.6, 10.8, tt));
        const ang = a0 + this.spin(tt) * (0.55 + 0.1 * (i % 4));
        const lift = (2.2 + (i % 4) * 0.9) * ss(9.2, 12.4, tt) + 0.25 * Math.sin(tt * 2 + i) * ss(10, 12, tt);
        return out.set(C.x + Math.cos(ang) * r - p0.x, lift, C.z + Math.sin(ang) * r - p0.z);
      };
      const off = orbit(Math.min(t, T_STRIKE), this.pa);
      if (t >= T_STRIKE) {
        const tau = t - T_STRIKE;
        const p = clamp(tau / 0.7, 0, 1);
        const e1 = 1 - (1 - p) * (1 - p);
        const q = clamp(tau / 0.9, 0, 1);
        off.x *= 1 - e1;
        off.z *= 1 - e1;
        off.y = off.y * (1 - q) + 2.5 * Math.sin(Math.PI * q);
      }
      ctx.displace(e, off);
    });
    this.displaced = true;
  }

  /** Endpoints of the in-cloud arcs of flash i (wall cloud level and/or anvil level); a pure function of i. */
  private flashEnds(i: number): { wall?: [THREE.Vector3, THREE.Vector3]; anvil?: [THREE.Vector3, THREE.Vector3] } {
    const e = FLASHES[i], C = this.C, A = this.anvilCenter, r = rng(i * 31 + 5);
    const out: { wall?: [THREE.Vector3, THREE.Vector3]; anvil?: [THREE.Vector3, THREE.Vector3] } = {};
    if (e.k !== 1) {
      const a1 = r() * Math.PI * 2 + this.wallTheta(e.t), rr = 3.5 + r() * 3;
      const a2 = a1 + 0.9 + r() * 0.8, rr2 = 5 + r() * 5;
      out.wall = [
        v3(C.x + Math.cos(a1) * rr, 11.4 + r() * 1.6, C.z + Math.sin(a1) * rr),
        v3(C.x + Math.cos(a2) * rr2, 11.6 + r() * 1.6, C.z + Math.sin(a2) * rr2),
      ];
    }
    if (e.k !== 0) {
      const a1 = r() * Math.PI * 2, rr = 4 + r() * 8;
      const a2 = a1 + 0.7 + r() * 0.6, rr2 = 8 + r() * 9;
      out.anvil = [
        v3(A.x + Math.cos(a1) * rr, 24 + r() * 3.5, A.z + Math.sin(a1) * rr),
        v3(A.x + Math.cos(a2) * rr2, 23 + r() * 3.5, A.z + Math.sin(a2) * rr2),
      ];
    }
    return out;
  }

  /** Re-rolls the two bolt arcs with the same seed so the thin core runs exactly inside the glow sheath. */
  private seededBolt(seed: number) {
    const orig = Math.random;
    for (const a of [this.bolt, this.boltCore]) {
      Math.random = rng(seed);
      a.reroll();
    }
    Math.random = orig;
  }

  /** Crawling lightning in the clouds, the strike bolt (three strikes), the ground crawlers. */
  private layoutLightning(t: number) {
    const C = this.C;
    for (const a of [...this.wallArcs, ...this.anvilArcs]) a.opacity = 0;
    FLASHES.forEach((e, i) => {
      const d = t - e.t;
      if (d < 0 || d >= 0.3) return;
      const o = 1 - d / 0.3;
      const ends = this.flashEnds(i);
      if (ends.wall) {
        const arc = this.wallArcs[i % 4];
        arc.setEnds(ends.wall[0], ends.wall[1]);
        arc.opacity = o;
      }
      if (ends.anvil) {
        const arc = this.anvilArcs[i % 4];
        arc.setEnds(ends.anvil[0], ends.anvil[1]);
        arc.opacity = o;
      }
    });

    // The strike: a thick jagged bolt from the cloud base straight down the funnel core to the point. Violet glow
    // sheath (0.6) around a thin bright core (0.15); strikes at +0, +0.22 and +0.36 (about 4 frames each), with the
    // impact frames between the first two.
    const p = t - T_STRIKE;
    const win = (a: number, b: number) => p >= a && p < b;
    const hit = win(0, 0.07) || win(0.22, 0.29) || win(0.36, 0.43);
    const tail = p >= 0 && p < 0.6 ? 0.25 * (1 - p / 0.6) : 0;
    this.bolt.setEnds(this.pa.set(C.x, 14.5, C.z), this.pb.set(C.x, 0.1, C.z));
    this.boltCore.setEnds(this.pa, this.pb);
    const seed = p < 0.22 ? 7001 : p < 0.36 ? 7002 : 7003;
    if (seed !== this.boltSeed) {
      this.boltSeed = seed;
      this.seededBolt(seed);
    }
    this.bolt.opacity = hit ? 1 : tail;
    this.boltCore.opacity = hit ? 1 : 0;
    const q = t - T_IMP;
    this.crawlers.forEach((c, k) => {
      const a = (k / this.crawlers.length) * Math.PI * 2 + 0.4;
      const len = 5 + (k % 3) * 1.3;
      c.setEnds(this.pa.set(C.x, 0.2, C.z), this.pb.set(C.x + Math.cos(a) * len, 0.2, C.z + Math.sin(a) * len));
      c.opacity = q < 0 || q > 0.35 ? 0 : 1 - q / 0.35;
    });

    // A small star where the bolt lands, with the impact frames (2 frames to full size, then gone).
    const pop = StarBurst.pop(q, 0.05, 0.1);
    this.star.set(this.pa.set(C.x, 1.2, C.z), 2.4 * pop.scale, q >= 0 ? pop.opacity : 0, 0.2);
  }

  /** Hail: hard pale stones falling for 1.5 s, one small bounce, then they lie and melt away. */
  private layoutHail(t: number) {
    const fade = 1 - ss(16.6, 17.4, t);
    this.hail.forEach((s, i) => {
      const f = (t - (s.land - FALL)) / FALL;
      let y = -100, sx = 1e-4, sy = 1e-4, tilt = 0;
      if (f >= 0 && f < 1) {
        y = 0.15 + (1 - f) * 16;
        sx = 0.17;
        sy = 0.42;
      } else if (f >= 1) {
        const age = t - s.land;
        y = 0.15 + (age < 0.3 ? 0.4 * Math.sin(Math.PI * (age / 0.3)) : 0);
        sx = 0.17 * fade;
        sy = 0.42 * fade;
        tilt = 1.3;
      }
      const lean = f >= 0 && f < 1 ? (1 - f) * 1.2 : 0;
      this.ea.set(0, s.ph, tilt);
      this.qa.setFromEuler(this.ea);
      this.m4.compose(this.pa.set(s.x + lean, y, s.z), this.qa, this.sc.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sx, 1e-4)));
      this.hailMesh.setMatrixAt(i, this.m4);
    });
    this.hailMesh.instanceMatrix.needsUpdate = true;
  }

  /** Toon blast at the strike: a dark ring under a thin violet one, expanding along the ground. */
  private layoutBlast(t: number) {
    const C = this.C;
    const p = clamp((t - T_IMP) / 0.7, 0, 1);
    const on = t >= T_STRIKE && p < 1;
    const e = 1 - Math.pow(1 - p, 3);
    const rad = 1 + 11 * e;
    const op = 1 - ss(0.35, 1, p);
    this.blastRing.visible = this.blastDark.visible = on;
    this.blastRing.position.set(C.x, 0.09, C.z);
    this.blastDark.position.set(C.x, 0.08, C.z);
    this.blastRing.scale.setScalar(rad);
    this.blastDark.scale.setScalar(rad);
    (this.blastRing.material as THREE.MeshBasicMaterial).opacity = op;
    (this.blastDark.material as THREE.MeshBasicMaterial).opacity = op * 0.9;
  }

  /** Heat haze along the funnel (air turbulence), the strike refraction and small ones for the hail and touchdown. */
  private layoutDistortion(t: number) {
    const C = this.C, pa = this.pa;
    const vis = ss(6.2, 8.4, t) * (1 - ss(18.4, 19.7, t));
    const thin = 1 - 0.4 * ss(12.8, 13.7, t);
    [0.1, 3.8, 7.4].forEach((y, k) => this.hazes[k].set(pa.set(C.x, y, C.z), 0.015 * vis * thin, t));

    const after = t - T_IMP;
    const ps = clamp(after / 1.1, 0, 1);
    this.shockStrike.set(pa.set(C.x, 1.5, C.z), 1 + 15 * (1 - Math.pow(1 - ps, 3)), after >= 0 && ps < 1 ? 0.07 * (1 - ps) * (1 - ps) : 0);
    const pg = clamp(after / 1.0, 0, 1);
    this.shockGround.set(pa.set(C.x, 0.05, C.z), 1 + 13 * (1 - Math.pow(1 - pg, 3)), after >= 0 && pg < 1 ? 0.05 * (1 - pg) * (1 - pg) : 0);
    const pt = clamp((t - T_TOUCH) / 0.9, 0, 1);
    this.shockTouch.set(pa.set(C.x, 0.05, C.z), 1 + 7 * (1 - Math.pow(1 - pt, 3)), t >= T_TOUCH && pt < 1 ? 0.03 * (1 - pt) * (1 - pt) : 0);

    // Hail landings: the latest stone in each slot rings for 0.3 s.
    this.shockHail.forEach((s, k) => {
      let best = -1;
      this.hail.forEach((h, i) => { if (i % SHOCKS === k && h.land <= t && (best < 0 || h.land > this.hail[best].land)) best = i; });
      const age = best >= 0 ? t - this.hail[best].land : 9;
      if (age >= 0.3) { s.set(pa.set(0, -50, 0), 1, 0); return; }
      const p = age / 0.3;
      s.set(pa.set(this.hail[best].x, 0.05, this.hail[best].z), 0.3 + 1.3 * p, 0.025 * (1 - p) * (1 - p));
    });
  }
}

export const supercellModule: EffectModule = {
  label: 'supercell',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Supercell(),
  telegraphs(effect) {
    return (effect as Supercell).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as Supercell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 14);
  },
  buildGui(f, effect) {
    const s = (effect as Supercell).settings;
    f.add(s, 'loop');
    f.add(s, 'tickDamage', 1, 100, 1);
    f.add(s, 'strikeDamage', 1, 300, 1);
  },
};
