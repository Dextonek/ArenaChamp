import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ghost Galleon Broadside (targeted enemies, up to 8, hero tier, ~24 s cutscene): a fog bank rolls in over the
 * arena, a spectral pirate galleon sails out of it through the air (bow and figurehead first), swings broadside
 * toward the enemies, opens eight gun ports one after another and fires two ripples of ghost-fire cannonballs (bow to
 * stern, 0.12 s apart). Then it tilts bow-down and sinks into the arena floor as if into water.
 *
 * Everything is a pure function of time t (ship pose, ports, balls, trails, fog, wake, pool); only emitter bursts, the
 * smoke balls and the hits fire when t crosses their time (like the other cutscene spells), so scrubbing works.
 *
 * The ship is built from shapes: an extruded hull with a drawn plank texture (width tapered per vertex), three masts
 * with braced yards, torn translucent sails (drawn textures with holes and glowing tears, skull on the main sail),
 * rigging, four swinging lanterns, a bone mermaid figurehead and eight real gun ports (lid, glow, barrel).
 *
 * Camera: scripted with `cinematic`, every shot placed explicitly from the caster P0, the target centroid C, the
 * hold point H of the ship and its glide heading (no auto-fit), every key clamped to at most 24 from its look-at.
 *
 * Palette: spirit white-green core (tiny cores only) | ghost green | hull wood | lantern amber | abyss.
 *
 * Timeline: 0 fog (wide, behind the caster, bell rings) | 3.0 emergence (cut, low, looking up at the fog wall) |
 * 5.4 side tracking (cut) | 7.0 turn (cut, high three-quarter; ports open) | 10.0 beat (cut, along the hull) |
 * 11.0 broadside 1 (cut, high, stern end; fires 11.3) | 12.2 impacts (cut, ground level among the enemies) |
 * 14.0 volley 2 (cut, wide, from beyond the enemies; fires 14.5) | 17.0 sinking (cut, wide from the caster side) |
 * 22.0 calm (cut, gameplay-like, letterbox out) | 24 end
 */
export interface GhostGalleonSettings {
  damage1: number;
  damage2: number;
  loop: boolean;
}

export const defaultGhostGalleon = (): GhostGalleonSettings => ({ damage1: 85, damage2: 40, loop: false });

const DURATION = 24;
const SHIP_Y = 8.5; // keel height while it flies
const PORTS = 8;
const FIRE1 = 11.3;
const FIRE2 = 14.5;
const STAGGER = 0.12;
const FLIGHT = 1.0;
const SINK0 = 17.2;
const SINK1 = 21.8;
const MAX_BALLS = 16;
const TRAIL = 9;
const BRACE = 0.95; // yaw of the square sails from the ship's cross axis, so the side camera sees their faces
const GLIDE = 0.8; // radians the bow is turned away from the broadside heading while it sails in
const FOG_DIST = 27; // fog wall distance behind the hold point along the glide heading
const PORT_X = [5.4, 4.0, 2.6, 1.2, -0.2, -1.6, -3.0, -4.4]; // bow to stern
const PORT_Y = 1.35;

// Palette.
const SPIRIT = 0xe8fff4;
const GHOST = 0x5effc0;
const GHOST_BODY = 0x2fbf86;
const AMBER = 0xffb347;
const ABYSS = 0x05080a;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const smoother = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (6 * t - 15) + 10);
};

/** Deterministic 0..1 sequence. */
function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Half width of the hull (local z) at height y and position x along the ship: narrow keel, tapered bow and stern. */
function halfW(x: number, y: number): number {
  let k = 1;
  if (x > 2.5) k = 1 - 0.93 * ss(2.5, 7.8, x);
  else if (x < -2) k = lerp(1, 0.62, ss(-2, -7.2, x));
  const bilge = 0.5 + 0.5 * ss(-0.5, 2.0, y);
  return 1.9 * k * bilge;
}

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

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Dark planks with black seams, worn lighter edges, a wale band, port frames and a name-board scroll (x, y are hull profile coordinates). */
function hullTexture(b: Bounds): THREE.CanvasTexture {
  const W = 1024, H = Math.round(1024 * ((b.y1 - b.y0) / (b.x1 - b.x0)));
  return canvasTexture(W, H, (g) => {
    const rnd = lcg(7);
    const px = (x: number) => ((x - b.x0) / (b.x1 - b.x0)) * W;
    const py = (y: number) => ((b.y1 - y) / (b.y1 - b.y0)) * H;
    g.fillStyle = '#3a2c24';
    g.fillRect(0, 0, W, H);
    // Planks.
    const rows = 30;
    const rh = H / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      let x = -rnd() * 120;
      while (x < W) {
        const len = 120 + rnd() * 160;
        const l = 0.82 + rnd() * 0.3;
        g.fillStyle = `rgb(${Math.round(58 * l)},${Math.round(44 * l)},${Math.round(36 * l)})`;
        g.fillRect(x, y, len, rh);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x + len - 2, y, 3, rh);
        // Grain.
        g.strokeStyle = 'rgba(10,6,4,0.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        const gy = y + rh * (0.3 + rnd() * 0.4);
        g.moveTo(x + 8, gy);
        g.lineTo(x + len - 12, gy + (rnd() - 0.5) * 3);
        g.stroke();
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.65)';
      g.fillRect(0, y, W, 3);
      g.fillStyle = 'rgba(122,98,78,0.22)';
      g.fillRect(0, y + 3, W, 2);
    }
    // Wale band under the deck line and a worn keel strip.
    g.fillStyle = '#1c1612';
    g.fillRect(0, py(2.55), W, py(2.0) - py(2.55));
    g.fillStyle = 'rgba(122,98,78,0.5)';
    g.fillRect(0, py(2.0) - 3, W, 3);
    g.fillStyle = '#17110d';
    g.fillRect(0, py(0.35), W, H);
    // Gun port frames (the real ports are meshes; this is the surround).
    for (const x of PORT_X) {
      const cx = px(x), cy = py(PORT_Y);
      g.lineWidth = 7;
      g.strokeStyle = '#1c1612';
      g.strokeRect(cx - 0.62 * (W / (b.x1 - b.x0)), cy - 0.6 * (W / (b.x1 - b.x0)), 1.24 * (W / (b.x1 - b.x0)), 1.2 * (W / (b.x1 - b.x0)));
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(150,122,96,0.55)';
      g.strokeRect(cx - 0.6 * (W / (b.x1 - b.x0)), cy - 0.58 * (W / (b.x1 - b.x0)), 1.2 * (W / (b.x1 - b.x0)), 1.16 * (W / (b.x1 - b.x0)));
    }
    // Name board scroll on the stern castle: aged parchment-wood with ends curled, dark runes.
    const nx = px(-6.4), ny = py(3.85), nw = px(-2.9) - nx, nh = py(2.95) - ny;
    g.fillStyle = '#6a5a40';
    g.beginPath();
    g.moveTo(nx, ny + nh * 0.15);
    g.quadraticCurveTo(nx + nw * 0.5, ny - nh * 0.15, nx + nw, ny + nh * 0.15);
    g.lineTo(nx + nw, ny + nh * 0.85);
    g.quadraticCurveTo(nx + nw * 0.5, ny + nh * 1.1, nx, ny + nh * 0.85);
    g.closePath();
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#150f0b';
    g.stroke();
    g.strokeStyle = 'rgba(21,15,11,0.85)';
    g.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      const rx = nx + nw * (0.12 + i * 0.095), ry = ny + nh * 0.5;
      g.beginPath();
      g.moveTo(rx, ry - nh * 0.22);
      g.lineTo(rx + (rnd() - 0.5) * 12, ry);
      g.lineTo(rx - 4, ry + nh * 0.22);
      g.stroke();
    }
    // Green seep along a few seams: the ghost light leaking through.
    g.strokeStyle = 'rgba(94,255,192,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = py(0.7 + rnd() * 1.4);
      g.beginPath();
      g.moveTo(rnd() * W * 0.5, y);
      g.lineTo(W * (0.5 + rnd() * 0.5), y + (rnd() - 0.5) * 6);
      g.stroke();
    }
  });
}

/** A gun port: near-black opening with a ghost-green inner glow line. */
function portTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (g) => {
    g.fillStyle = '#05080a';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#2fbf86';
    g.lineWidth = 5;
    g.strokeRect(7, 7, 50, 50);
    g.strokeStyle = 'rgba(94,255,192,0.35)';
    g.lineWidth = 3;
    g.strokeRect(13, 13, 38, 38);
  });
}

function jaggedPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rnd: () => number) {
  const n = 7;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const rr = r * (0.55 + rnd() * 0.6);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.85;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Torn ghost sail: pale-green cloth with folds, a ragged bottom, holes with glowing edges, optional skull emblem. */
function sailTexture(skull: boolean, seed: number): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = lcg(seed);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#6aa890');
    gr.addColorStop(1, '#2f5a4a');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    // Folds and seams.
    g.strokeStyle = 'rgba(10,30,24,0.4)';
    g.lineWidth = 4;
    for (let i = 1; i < 7; i++) {
      const x = (i / 7) * 256;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 10, 80, x - 10, 170, x + 4, 256);
      g.stroke();
    }
    g.strokeStyle = 'rgba(200,240,224,0.25)';
    g.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(0, i * 50);
      g.lineTo(256, i * 50 + (rnd() - 0.5) * 8);
      g.stroke();
    }
    g.strokeStyle = '#1b3a30';
    g.lineWidth = 6;
    g.strokeRect(3, 3, 250, 250);
    if (skull) {
      g.strokeStyle = '#0a1a14';
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(70, 190);
      g.lineTo(186, 110);
      g.moveTo(186, 190);
      g.lineTo(70, 110);
      g.stroke();
      g.strokeStyle = '#c8e8dc';
      g.lineWidth = 7;
      g.stroke();
      g.fillStyle = '#d8f2e6';
      g.strokeStyle = '#0a1a14';
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(128, 118, 36, 32, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillRect(108, 142, 40, 24);
      g.strokeRect(108, 142, 40, 24);
      g.fillStyle = '#05080a';
      for (const x of [112, 144]) {
        g.beginPath();
        g.ellipse(x, 116, 9, 11, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(122, 140);
      g.lineTo(134, 140);
      g.closePath();
      g.fill();
      g.strokeStyle = '#0a1a14';
      g.lineWidth = 3;
      for (const x of [118, 128, 138]) {
        g.beginPath();
        g.moveTo(x, 144);
        g.lineTo(x, 164);
        g.stroke();
      }
    }
    // Tears: stroke a glowing edge, then cut the inside out.
    const cuts: (() => void)[] = [];
    cuts.push(() => {
      g.beginPath();
      g.moveTo(-4, 262);
      g.lineTo(-4, 232 + rnd() * 10);
      for (let x = 0; x <= 260; x += 20) g.lineTo(x, 226 + rnd() * 34);
      g.lineTo(260, 262);
      g.closePath();
    });
    cuts.push(() => {
      g.beginPath();
      g.moveTo(-4, 70);
      g.lineTo(18 + rnd() * 8, 84);
      g.lineTo(6, 104);
      g.lineTo(-4, 110);
      g.closePath();
    });
    cuts.push(() => {
      g.beginPath();
      g.moveTo(260, 140);
      g.lineTo(236, 150 + rnd() * 8);
      g.lineTo(246, 176);
      g.lineTo(260, 182);
      g.closePath();
    });
    const holes: [number, number, number][] = skull
      ? [[48, 60, 15], [208, 78, 17], [40, 196, 12], [214, 210, 14]]
      : [[70, 70, 17], [196, 112, 14], [118, 190, 15]];
    for (const [cx, cy, r] of holes) cuts.push(() => jaggedPath(g, cx, cy, r, rnd));
    for (const c of cuts) {
      c();
      g.lineWidth = 8;
      g.strokeStyle = '#7ffbc4';
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    for (const c of cuts) {
      c();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/** Fog puff: several soft overlapping blobs, white (tinted by the sprite colour). */
function fogTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = lcg(11);
    // A cauliflower cloud: overlapping lobes with a firm edge (not a uniform soft disc).
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = 128 + Math.cos(a) * 52 * (0.7 + rnd() * 0.5), cy = 134 + Math.sin(a) * 40 * (0.7 + rnd() * 0.5), r = 34 + rnd() * 24;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    }
    const c = g.createRadialGradient(128, 128, 0, 128, 128, 70);
    c.addColorStop(0, 'rgba(255,255,255,0.7)');
    c.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = c;
    g.fillRect(0, 0, 256, 256);
  });
}

/** A toon flame tongue: S-shaped, dark-green base to ghost-green body, thin dark outline, a tiny pale core near the base. */
function flameTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 256, (g) => {
    const path = () => {
      g.beginPath();
      g.moveTo(34, 252);
      g.bezierCurveTo(10, 200, 50, 170, 44, 120);
      g.bezierCurveTo(40, 80, 70, 60, 84, 4);
      g.bezierCurveTo(88, 60, 112, 100, 100, 150);
      g.bezierCurveTo(94, 190, 120, 220, 94, 252);
      g.closePath();
    };
    path();
    const gr = g.createLinearGradient(0, 252, 0, 0);
    gr.addColorStop(0, '#1f8a5e');
    gr.addColorStop(0.5, '#3fd49a');
    gr.addColorStop(1, '#5effc0');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#06241a';
    g.stroke();
    // Inner lighter tongue and a tiny pale core.
    g.beginPath();
    g.moveTo(54, 240);
    g.bezierCurveTo(40, 200, 64, 170, 62, 130);
    g.bezierCurveTo(60, 160, 86, 190, 84, 226);
    g.closePath();
    g.fillStyle = '#7fffd0';
    g.fill();
    g.beginPath();
    g.ellipse(68, 226, 7, 14, 0, 0, Math.PI * 2);
    g.fillStyle = '#e8fff4';
    g.fill();
  });
}

/** Scorch decal: a jagged black splat with a thin ghost-green rim. */
function scorchTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = lcg(23);
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 120);
    gr.addColorStop(0, 'rgba(5,8,10,0.92)');
    gr.addColorStop(0.7, 'rgba(5,8,10,0.7)');
    gr.addColorStop(1, 'rgba(5,8,10,0)');
    g.fillStyle = gr;
    g.beginPath();
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? 70 + rnd() * 20 : 100 + rnd() * 22;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(47,191,134,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(128, 128, 56, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(94,255,192,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(128, 128, 84, 0.2, Math.PI * 1.6);
    g.stroke();
  });
}

/** Ghost-water pool under the sinking ship: dark teal-green with ripple lines and foam ticks. */
function poolTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const c = 256;
    const base = g.createRadialGradient(c, c, 0, c, c, 250);
    base.addColorStop(0, 'rgba(3,12,10,0.95)');
    base.addColorStop(0.7, 'rgba(6,26,20,0.85)');
    base.addColorStop(1, 'rgba(6,30,24,0)');
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    for (const [r, a, w] of [[200, 0.8, 5], [150, 0.55, 4], [100, 0.45, 3]] as const) {
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.lineWidth = w;
      g.strokeStyle = `rgba(47,191,134,${a})`;
      g.stroke();
    }
    const rnd = lcg(5);
    g.strokeStyle = 'rgba(190,255,230,0.7)';
    g.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      g.beginPath();
      g.arc(c, c, 196, a, a + 0.12);
      g.stroke();
    }
  });
}

// --- Geometry ---------------------------------------------------------------------------------------------

function hullProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-6.2, 0.6);
  s.quadraticCurveTo(-1, -0.7, 4.6, 0.3);
  s.lineTo(7.6, 2.7);
  s.lineTo(6.8, 2.75);
  s.lineTo(-2.2, 2.5);
  s.lineTo(-2.2, 4.1);
  s.lineTo(-6.9, 4.3);
  s.quadraticCurveTo(-7.2, 2.5, -6.2, 0.6);
  s.closePath();
  return s;
}

/** The mermaid figurehead profile (x forward, y up). */
function figureShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0);
  s.quadraticCurveTo(0.6, 0.25, 1.1, 0.95);
  s.quadraticCurveTo(1.6, 1.6, 1.5, 2.2);
  s.quadraticCurveTo(1.45, 2.55, 1.2, 2.62);
  s.quadraticCurveTo(0.9, 2.55, 0.92, 2.25);
  s.quadraticCurveTo(1.0, 1.8, 0.7, 1.4);
  s.quadraticCurveTo(0.2, 0.9, -0.5, 0.75);
  s.quadraticCurveTo(-0.9, 0.5, -0.7, 0.1);
  s.closePath();
  return s;
}

interface Sail {
  mesh: THREE.Mesh;
  base: Float32Array;
  w: number;
  h: number;
  seed: number;
}

interface Lantern {
  pivot: THREE.Group;
  glow: THREE.Mesh;
  halo: THREE.Sprite;
  seed: number;
}

interface PortRig {
  lid: THREE.Mesh;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  barrel: THREE.Mesh;
  x: number;
  hw: number;
}

interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

interface Slot {
  star: StarBurst;
  ring: ReturnType<typeof createRing>;
  cone: THREE.Mesh;
  cone2: THREE.Mesh;
  tongues: THREE.Mesh[];
  decal: THREE.Mesh;
  shock: ShockRefraction;
}

// --- The effect -------------------------------------------------------------------------------------------

export class GhostGalleonBroadside implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GhostGalleonSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private keys: ShotKey[] = [];
  private fired: boolean[][] = [[], []];
  private landed: boolean[][] = [[], []];
  private hitDone: boolean[][] = [[], []];
  private splashAcc = 0;
  private mistDone = [false, false, false];
  private emberDone = false;

  // Cast geometry.
  private P0 = v3(0, 0, 12);
  private C = v3();
  private F = v3(0, 0, -1);
  private R = v3(1, 0, 0);
  private H = v3();
  private gdir = v3(1, 0, 0);
  private lat = v3(0, 0, 1);
  private W = v3();
  private yawB = 0;
  private L = 9;
  private tp: THREE.Vector3[] = [];
  private LP: THREE.Vector3[] = Array.from({ length: PORTS }, () => v3());
  private tIdx: number[] = new Array(PORTS).fill(0);

  // Ship.
  private ship = new THREE.Group();
  private probe = new THREE.Object3D();
  private sails: Sail[] = [];
  private lanterns: Lantern[] = [];
  private ports: PortRig[] = [];
  private figure = new THREE.Group();

  // Ghost water, fog, wake, drips.
  private poolG = new THREE.Group();
  private pool: THREE.Mesh;
  private poolFoam: ReturnType<typeof createRing>;
  private sinkRings: ReturnType<typeof createRing>[] = [];
  private sinkShock: ShockRefraction[] = [];
  private bellRings: ReturnType<typeof createRing>[] = [];
  private fog: { s: THREE.Sprite; mat: THREE.SpriteMaterial; lat: number; h: number; d: number; size: number; base: number }[] = [];
  private wake: { s: THREE.Sprite; mat: THREE.SpriteMaterial; ph: number; off: THREE.Vector3; size: number }[] = [];
  private dripGeo = new THREE.BufferGeometry();
  private dripPos = new Float32Array(26 * 3);
  private dripSeed = Array.from({ length: 26 }, (_, i) => ({ x: -4 + ((i * 37) % 26) * 0.3, ph: (i * 0.618) % 1, per: 1.3 + ((i * 7) % 5) * 0.08 }));
  private drips: THREE.Points;

  // Cannon fire.
  private smoke = new SmokeBall({ maxBalls: 26, color: 0x2a3a34, rim: 0x4a6258, flake: '#2a3a34' });
  private muzzleStar: StarBurst[] = [];
  private muzzleShock: ShockRefraction[] = [];
  private ballCore: THREE.InstancedMesh;
  private ballTiny: THREE.InstancedMesh;
  private ballTrail: THREE.InstancedMesh;
  private ballHalo: THREE.Sprite[] = [];
  private slots: Slot[] = [];

  private haze = new HeatHaze({ width: 20, height: 7, scale: 3.5, speed: 0.8 });

  private flash: Emitter;
  private sparks: Emitter;
  private debris: Emitter;
  private embers: Emitter;
  private splash: Emitter;
  private mist: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpD = v3();
  private tmpS = v3();
  private dummy = new THREE.Object3D();

  constructor(settings: GhostGalleonSettings = defaultGhostGalleon()) {
    this.settings = settings;
    this.screen.tint.set(0x0a2a22);
    this.screen.impactColor.set(GHOST);
    this.screen.edgeTint.set(GHOST);
    this.screen.speedLineColor.set(0xbff6e0);
    this.probe.rotation.order = 'YZX';
    this.ship.rotation.order = 'YZX';

    this.buildShip();
    this.group.add(this.ship);

    // Ground water pool (aligned to the ship), foam ring, ripples, bell rings.
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.poolFoam = createRing(0xbff6e0, 0.93, 1, 64);
    this.poolG.add(this.pool, this.poolFoam.mesh);
    this.group.add(this.poolG);
    for (let k = 0; k < 3; k++) {
      const r = createRing(GHOST_BODY, 0.9, 1, 96);
      this.sinkRings.push(r);
      this.group.add(r.mesh);
      const b = createRing(GHOST, 0.94, 1, 96);
      this.bellRings.push(b);
      this.group.add(b.mesh);
    }
    for (let k = 0; k < 2; k++) {
      const sh = new ShockRefraction({ facing: 'ground', width: 0.3 });
      this.sinkShock.push(sh);
      this.group.add(sh.mesh);
    }

    // Fog wall: soft dark-green puffs in rows, tinted two ways.
    const fogTex = fogTexture();
    const rnd = lcg(31);
    // Rolling cumulus-like towers: dark green at the base, lighter green-grey toward the billowing tops.
    const lo = new THREE.Color(0x0f2c24), hi = new THREE.Color(0x6a8a7c);
    const COLS = 15;
    for (let c = 0; c < COLS; c++) {
      const top = 21 + rnd() * 9 + 3 * Math.sin(c * 1.3);
      const colLat = (c - (COLS - 1) / 2) * 3.6 + (rnd() - 0.5) * 1.5;
      for (let r = 0; r < 7; r++) {
        const h = 1.5 + r * 4.2 + (rnd() - 0.5) * 2;
        if (h > top) break;
        const f = clamp(h / top, 0, 1);
        const mat = new THREE.SpriteMaterial({
          map: fogTex, color: lo.clone().lerp(hi, f * f), transparent: true, opacity: 0, depthWrite: false, rotation: rnd() * Math.PI * 2,
        });
        const s = new THREE.Sprite(mat);
        s.frustumCulled = false;
        this.fog.push({
          s, mat, lat: colLat + (rnd() - 0.5) * 2, h, d: (rnd() - 0.5) * 8 + f * 3, size: 10 + rnd() * 5 + 3 * f, base: 0.72,
        });
        this.group.add(s);
      }
      // A bright billowing cap on every tower, so the top edge reads against the sky.
      const cap = new THREE.SpriteMaterial({ map: fogTex, color: hi.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false, rotation: rnd() * Math.PI * 2 });
      const cs = new THREE.Sprite(cap);
      cs.frustumCulled = false;
      this.fog.push({ s: cs, mat: cap, lat: colLat, h: top, d: 3, size: 11 + rnd() * 4, base: 0.8 });
      this.group.add(cs);
    }

    // Wake: soft additive green mist along the ship's own past trajectory.
    const dot = softDotTexture();
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: dot, color: GHOST, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      s.frustumCulled = false;
      this.wake.push({ s, mat, ph: i / 14, off: v3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.0, (rnd() - 0.5) * 1.2), size: 1.0 + rnd() * 0.8 });
      this.group.add(s);
    }
    this.dripGeo.setAttribute('position', new THREE.BufferAttribute(this.dripPos, 3));
    this.drips = new THREE.Points(this.dripGeo, new THREE.PointsMaterial({
      size: 0.24, map: dot, color: 0x9ff2c8, transparent: true, opacity: 0.8, depthWrite: false,
    }));
    this.drips.frustumCulled = false;
    this.group.add(this.drips);

    // Cannon fire parts.
    for (let i = 0; i < PORTS; i++) {
      const star = new StarBurst({ points: 8, inner: 0.22, jitter: 0.3, color: GHOST, core: SPIRIT });
      const sh = new ShockRefraction({ facing: 'camera', width: 0.3 });
      this.muzzleStar.push(star);
      this.muzzleShock.push(sh);
      this.group.add(star.mesh, sh.mesh);
    }
    this.group.add(this.smoke.mesh);

    const sphere = new THREE.IcosahedronGeometry(1, 1);
    // Dark iron ball with a small green ember on it and a green fire halo; a short dark trail plus a green ember streak.
    this.ballCore = new THREE.InstancedMesh(sphere, new THREE.MeshBasicMaterial({ color: 0x1a2220 }), MAX_BALLS);
    this.ballTiny = new THREE.InstancedMesh(sphere, new THREE.MeshBasicMaterial({ color: GHOST }), MAX_BALLS * 5);
    this.ballTrail = new THREE.InstancedMesh(
      sphere, new THREE.MeshBasicMaterial({ color: 0x0a1411, transparent: true, opacity: 0.8, depthWrite: false }), MAX_BALLS * TRAIL,
    );
    for (const m of [this.ballCore, this.ballTiny, this.ballTrail]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    for (let i = 0; i < MAX_BALLS; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: GHOST, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.frustumCulled = false;
      this.ballHalo.push(s);
      this.group.add(s);
    }

    // Impact slots (one per ball index; the second volley reuses them).
    const coneGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0);
    const scorch = scorchTexture();
    const flameTex = flameTexture();
    const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    for (let k = 0; k < PORTS; k++) {
      const star = new StarBurst({ points: 9, inner: 0.25, jitter: 0.3, color: GHOST_BODY, core: 0x9ff2c8, additive: false });
      const ring = createRing(GHOST, 0.9, 1, 64);
      const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: GHOST_BODY, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      const cone2 = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x7be8b0, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: scorch, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      );
      decal.rotation.x = -Math.PI / 2;
      const shock = new ShockRefraction({ facing: 'ground', width: 0.3 });
      cone.visible = false;
      cone2.visible = false;
      const tongues: THREE.Mesh[] = [];
      for (let q = 0; q < 6; q++) {
        const tg = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ map: flameTex, color: 0xdddddd, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        tg.visible = false;
        // Upright billboard: turns around Y to face the camera.
        tg.onBeforeRender = (_r, _s, cam) => {
          cam.getWorldPosition(this.tmpS);
          tg.rotation.y = Math.atan2(this.tmpS.x - tg.position.x, this.tmpS.z - tg.position.z);
        };
        tongues.push(tg);
        this.group.add(tg);
      }
      decal.visible = false;
      this.slots.push({ star, ring, cone, cone2, tongues, decal, shock });
      this.group.add(decal, ring.mesh, cone, cone2, star.mesh, shock.mesh);
    }

    this.group.add(this.haze.mesh);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.flash = em({
      maxParticles: 400, lifetime: 0.4, lifetimeJitter: 0.4, shapeSize: 0.15, speed: 5, speedJitter: 0.6, spread: 110, gravity: 1, drag: 2,
      sizeStart: 0.28, sizeEnd: 0.03, colorStart: '#bff6e0', colorEnd: '#2fbf86', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.sparks = em({
      maxParticles: 900, lifetime: 0.9, lifetimeJitter: 0.5, shapeSize: 0.3, speed: 8, speedJitter: 0.6, spread: 75, gravity: 10, drag: 0.7,
      sizeStart: 0.2, sizeEnd: 0.03, colorStart: '#7be8b0', colorEnd: '#1d6a4a', opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.debris = em({
      maxParticles: 500, lifetime: 1.2, lifetimeJitter: 0.4, shapeSize: 0.4, speed: 7, speedJitter: 0.6, spread: 70, gravity: 16, drag: 0.3,
      sizeStart: 0.26, sizeEnd: 0.16, colorStart: '#6a655a', colorEnd: '#2e2c28', opacityStart: 1, opacityEnd: 0.6, additive: false, sizeJitter: 0.5,
    });
    this.embers = em({
      maxParticles: 400, lifetime: 2.6, lifetimeJitter: 0.5, shapeSize: 2.5, speed: 2.2, speedJitter: 0.7, spread: 80, gravity: -0.5, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#ffb347', colorEnd: '#b0501a', opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.5,
    });
    this.splash = em({
      maxParticles: 1200, lifetime: 1.1, lifetimeJitter: 0.4, shapeSize: 0.6, speed: 9, speedJitter: 0.6, spread: 60, gravity: 10, drag: 0.7,
      sizeStart: 0.28, sizeEnd: 0.06, colorStart: '#bfffe6', colorEnd: '#2fbf86', opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.4, groundFade: 0.2,
    });
    this.mist = em({
      maxParticles: 300, lifetime: 3.0, lifetimeJitter: 0.4, shapeSize: 4, speed: 1.6, speedJitter: 0.6, spread: 85, gravity: -0.08, drag: 1.2,
      sizeStart: 1.8, sizeEnd: 3.8, colorStart: '#1f5a46', colorEnd: '#06140f', opacityStart: 0.3, opacityEnd: 0, additive: false, sizeJitter: 0.4,
      erosion: 0.6, spin: 0.3, groundFade: 0.3,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points);

    this.smoke.hold = 0.25;
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- The ship model ------------------------------------------------------------------------------------

  private buildShip() {
    const ship = this.ship;
    const wood = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.85, metalness: 0, emissive: 0x0a1a14, emissiveIntensity: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 0.9, metalness: 0 });

    // Hull: extruded profile, width tapered per vertex.
    const shape = hullProfile();
    const pts = shape.extractPoints(12).shape;
    const bounds: Bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const p of pts) {
      bounds.x0 = Math.min(bounds.x0, p.x);
      bounds.x1 = Math.max(bounds.x1, p.x);
      bounds.y0 = Math.min(bounds.y0, p.y);
      bounds.y1 = Math.max(bounds.y1, p.y);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, -0.5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * 2 * halfW(pos.getX(i), pos.getY(i)));
    geo.computeVertexNormals();
    const tex = hullTexture(bounds);
    tex.repeat.set(1 / (bounds.x1 - bounds.x0), 1 / (bounds.y1 - bounds.y0));
    tex.offset.set(-bounds.x0 / (bounds.x1 - bounds.x0), -bounds.y0 / (bounds.y1 - bounds.y0));
    const capMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, emissive: 0x0a1a14, emissiveIntensity: 0.35, emissiveMap: tex });
    ship.add(new THREE.Mesh(geo, [capMat, wood]));

    // Bowsprit and a dark keel beam.
    const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 4.2, 8), dark);
    sprit.rotation.z = -1.15;
    sprit.position.set(8.4, 3.5, 0);
    ship.add(sprit);

    // Masts, braced yards and sails.
    const masts: [number, number, number][] = [[0.2, 2.5, 14.0], [4.3, 2.5, 11.5], [-4.4, 4.2, 11.8]];
    const sailDefs: [number, number, number, boolean, number][] = [
      // mast index, y from, y to, skull, width
      [0, 4.6, 11.6, true, 7.6], [1, 4.2, 9.4, false, 5.6], [2, 6.1, 10.4, false, 4.8],
    ];
    masts.forEach(([x, y0, y1]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, y1 - y0, 8), dark);
      m.position.set(x, (y0 + y1) / 2, 0);
      m.rotation.z = 0.03;
      ship.add(m);
    });
    sailDefs.forEach(([mi, ya, yb, skull, w], idx) => {
      const [mx] = masts[mi];
      const g = new THREE.Group();
      g.position.set(mx, 0, 0);
      g.rotation.y = BRACE;
      const h = yb - ya;
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w + 1.0, 6), dark);
      yard.rotation.z = Math.PI / 2;
      yard.position.y = yb + 0.15;
      g.add(yard);
      const geo2 = new THREE.PlaneGeometry(w, h, 12, 10);
      const tex2 = sailTexture(skull, 40 + idx * 13);
      const mat = new THREE.MeshBasicMaterial({
        map: tex2, color: 0xc8e6d8, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02,
      });
      const sail = new THREE.Mesh(geo2, mat);
      sail.position.y = (ya + yb) / 2;
      sail.renderOrder = 3;
      g.add(sail);
      ship.add(g);
      this.sails.push({ mesh: sail, base: Float32Array.from(geo2.attributes.position.array as ArrayLike<number>), w, h, seed: idx * 1.7 });
    });

    // Rigging: thin dark lines from the mast tops to the rails and between the masts.
    const rig: number[] = [];
    const line = (a: number[], b: number[]) => rig.push(...a, ...b);
    for (const sg of [-1, 1]) {
      line([0.2, 14, 0], [-1.6, 2.5, sg * 1.7]);
      line([0.2, 14, 0], [2.2, 2.5, sg * 1.7]);
      line([4.3, 11.5, 0], [3.0, 2.5, sg * 1.5]);
      line([4.3, 11.5, 0], [5.6, 2.7, sg * 0.9]);
      line([-4.4, 11.8, 0], [-3.2, 4.2, sg * 1.5]);
      line([-4.4, 11.8, 0], [-6.2, 4.3, sg * 1.2]);
    }
    line([0.2, 14, 0], [4.3, 11.5, 0]);
    line([0.2, 14, 0], [-4.4, 11.8, 0]);
    line([4.3, 11.5, 0], [10.2, 4.4, 0]);
    const rigGeo = new THREE.BufferGeometry();
    rigGeo.setAttribute('position', new THREE.Float32BufferAttribute(rig, 3));
    ship.add(new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x0c0a08 })));

    // Figurehead: a bone mermaid on a dark backing plate, leaning out from the bow.
    const bone = new THREE.MeshStandardMaterial({ color: 0xb4b8a0, roughness: 0.8, metalness: 0, emissive: 0x1a2a22, emissiveIntensity: 0.4 });
    const fShape = figureShape();
    const outline = new THREE.Mesh(new THREE.ExtrudeGeometry(fShape, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06).scale(1.12, 1.1, 1.0).translate(-0.06, -0.12, 0), dark);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(fShape, { depth: 0.22, bevelEnabled: false }).translate(0, 0, -0.11), bone);
    this.figure.add(outline, body);
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), dark);
      rib.position.set(0.95 - i * 0.02, 1.0 + i * 0.22, 0);
      rib.rotation.z = -0.5;
      this.figure.add(rib);
    }
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: ABYSS, side: THREE.DoubleSide }));
    eye.position.set(1.2, 2.3, 0.13);
    this.figure.add(eye);
    const eye2 = eye.clone();
    eye2.position.z = -0.13;
    this.figure.add(eye2);
    this.figure.position.set(7.2, 2.1, 0);
    this.figure.rotation.z = -0.25;
    this.figure.scale.setScalar(0.9);
    ship.add(this.figure);

    // Lanterns: dark cage, tiny warm core, soft halo, swinging on a post.
    const dot = softDotTexture();
    const lanternAt: [number, number, number][] = [[-6.5, 4.4, 1.5], [-6.5, 4.4, -1.5], [5.7, 2.8, 0.75], [5.7, 2.8, -0.75]];
    lanternAt.forEach(([x, y, z], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), dark);
      post.position.set(x, y + 0.5, z);
      ship.add(post);
      const pivot = new THREE.Group();
      pivot.position.set(x + 0.2, y + 1.0, z);
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.34), dark);
      cage.position.y = -0.4;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc66a }));
      glow.position.y = -0.4;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: AMBER, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(1.3);
      halo.position.y = -0.4;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), dark);
      cord.position.y = -0.1;
      pivot.add(cord, cage, glow, halo);
      ship.add(pivot);
      this.lanterns.push({ pivot, glow, halo, seed: i * 1.3 });
    });

    // Gun ports: lid, dark opening with green glow line, barrel.
    const portTex = portTexture();
    const iron = new THREE.MeshStandardMaterial({ color: 0x1a1f1c, roughness: 0.55, metalness: 0.35 });
    const barrelGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.6, 12).rotateX(Math.PI / 2);
    const ringGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 12).rotateX(Math.PI / 2);
    for (let i = 0; i < PORTS; i++) {
      const x = PORT_X[i];
      const hw = halfW(x, PORT_Y);
      const glowMat = new THREE.MeshBasicMaterial({ map: portTex, color: 0x555555, side: THREE.DoubleSide });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.9), glowMat);
      glow.position.set(x, PORT_Y, -hw - 0.04);
      glow.rotation.y = Math.PI;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.0, 0.1), wood);
      lid.position.set(x, PORT_Y, -hw - 0.1);
      const barrel = new THREE.Mesh(barrelGeo, iron);
      barrel.rotation.x = -0.22;
      barrel.visible = false;
      const mring = new THREE.Mesh(ringGeo, iron);
      mring.position.z = -0.74;
      const breech = new THREE.Mesh(ringGeo, iron);
      breech.position.z = 0.55;
      barrel.add(mring, breech);
      ship.add(glow, lid, barrel);
      this.ports.push({ lid, glow, glowMat, barrel, x, hw });
    }
  }

  // --- Pose and world helpers ----------------------------------------------------------------------------

  /** Ship pose at time t (a pure function): glide in, turn, hold and rock, then sink bow-down. */
  private poseAt(t: number, out: Pose): Pose {
    const s = -38 * (1 - smoother((t - 2.4) / 6.1));
    const alpha = GLIDE * (1 - ss(7.0, 9.8, t));
    const sink = ss(SINK0, SINK1, t);
    out.x = this.H.x + this.gdir.x * s;
    out.z = this.H.z + this.gdir.z * s;
    out.y = SHIP_Y + 0.22 * Math.sin(t * 1.4) * (1 - sink) + (-15 - SHIP_Y) * sink;
    out.yaw = this.yawB - alpha;
    out.pitch = 0.02 * Math.sin(t * 0.9 + 1) - 0.5 * ss(SINK0 + 0.2, SINK1 - 0.6, t);
    out.roll = 0.04 * Math.sin(t * 1.1 + 2) * (1 - 0.6 * sink) + 0.05 * sink * Math.sin(t * 2.2);
    return out;
  }

  private _pose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };

  /** A ship-local point in world space at time t. */
  private toWorld(t: number, local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const p = this.poseAt(t, this._pose);
    this.probe.position.set(p.x, p.y, p.z);
    this.probe.rotation.set(p.roll, p.yaw, p.pitch);
    this.probe.updateMatrixWorld(true);
    return out.copy(local).applyMatrix4(this.probe.matrixWorld);
  }

  private fireT(v: number, k: number) {
    return (v === 0 ? FIRE1 : FIRE2) + STAGGER * k;
  }

  private landT(v: number, k: number) {
    return this.fireT(v, k) + FLIGHT;
  }

  /** Muzzle position (ship-local) with the barrel fully out. */
  private muzzleLocal(k: number, out: THREE.Vector3) {
    const p = this.ports[k];
    return out.set(p.x, PORT_Y - 0.25, -p.hw - 1.15);
  }

  /** Distance from the muzzle of ball k (volley v) to its landing point. */
  private muzzleDist(v: number, k: number): number {
    const M = this.toWorld(this.fireT(v, k), this.muzzleLocal(k, this.tmpS), this.tmpD);
    return M.distanceTo(this.LP[k]);
  }

  /** Ball position along its arc: u 0 at the muzzle, 1 at the landing point. */
  private ballAt(v: number, k: number, u: number, out: THREE.Vector3): THREE.Vector3 {
    const M = this.toWorld(this.fireT(v, k), this.muzzleLocal(k, this.tmpS), this.tmpD);
    const T = this.LP[k];
    const uu = clamp(u, 0, 1);
    out.x = lerp(M.x, T.x, uu);
    out.z = lerp(M.z, T.z, uu);
    // Parabola: y = M.y + a*u - b*u^2 with y(1) = landing height and the apex 4 above the muzzle.
    const D = Math.max(0, M.y - (T.y + 0.6));
    const a = 8 + Math.sqrt(64 + 16 * D);
    out.y = M.y + a * uu - (a + D) * uu * uu;
    return out;
  }

  // --- Cast and camera keys ------------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.tp = ctx.targetPos.length ? ctx.targetPos.map((p) => p.clone().setY(0)) : [ctx.point.clone().setY(0)];
    this.C.set(0, 0, 0);
    for (const p of this.tp) this.C.add(p);
    this.C.multiplyScalar(1 / this.tp.length);
    this.P0.copy(ctx.from).setY(0);
    this.F.copy(this.C).sub(this.P0).setY(0);
    if (this.F.lengthSq() < 1e-4) this.F.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.F.lengthSq() < 1e-4) this.F.set(0, 0, -1);
    this.F.normalize();
    this.R.set(-this.F.z, 0, this.F.x);
    const dc = this.P0.distanceTo(this.C);
    this.L = clamp(dc * 0.6, 8, 12);
    this.H.copy(this.C).addScaledVector(this.F, -this.L).setY(0);
    // Glide heading: along the broadside axis (right), bow turned slightly toward the caster side.
    this.gdir.copy(this.R).multiplyScalar(Math.cos(GLIDE)).addScaledVector(this.F, -Math.sin(GLIDE)).normalize();
    this.lat.set(-this.gdir.z, 0, this.gdir.x);
    this.W.copy(this.H).addScaledVector(this.gdir, -FOG_DIST);
    this.yawB = Math.atan2(-this.F.x, -this.F.z);

    // Landing points: ball k goes to target k % n; extra balls on the same target land beside it.
    const n = this.tp.length;
    for (let k = 0; k < PORTS; k++) {
      const ti = k % n;
      const pass = Math.floor(k / n);
      const off = pass === 0 ? 0 : (pass % 2 ? 1 : -1) * (0.7 + 0.3 * pass);
      this.tIdx[k] = ti;
      this.LP[k].copy(this.tp[ti]).addScaledVector(this.R, off).setY(0);
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.ship];
    this.buildKeys();
    this.reset();
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const { P0, C, F, R, H, gdir, lat, W, L } = this;
    const B = F.clone().negate();
    const up = (y: number) => v3(0, y, 0);
    const key = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false, ease: ShotKey['ease'] = 'inOut') => {
      const p = pos.clone();
      if (p.y < 0.7) p.y = 0.7;
      const off = p.clone().sub(target);
      if (off.length() > 24) p.copy(target).addScaledVector(off.normalize(), 24);
      keys.push({ t, position: p, target: target.clone(), fov, roll: 0, cut, ease });
    };
    const at = (base: THREE.Vector3, ...parts: [THREE.Vector3, number][]) => {
      const o = base.clone();
      for (const [v, k] of parts) o.addScaledVector(v, k);
      return o;
    };

    // 1. Fog: wide and low from behind the caster, slow push toward the arena.
    const fogLook = C.clone().lerp(W, 0.25).add(up(4));
    key(0, at(P0, [B, 9], [R, 2.5]).add(up(3.4)), fogLook, 44, true);
    key(3 - 0.001, at(P0, [B, 5.5], [R, 1.5]).add(up(2.8)), fogLook, 44, false, 'linear');

    // 2. Emergence: low, off to the side of the glide line, looking up at the fog wall as the bow pushes out.
    const wallLook = at(W, [gdir, 3]).add(up(10.5));
    key(3.0, at(W, [gdir, 12], [lat, 19]).add(up(2.6)), wallLook, 58, true);
    key(5.4 - 0.001, at(W, [gdir, 11], [lat, 16.5]).add(up(3.0)), wallLook, 58, false, 'linear');

    // 3. Side tracking: the camera moves with the ship, 18 off its path, below the hull.
    const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
    for (let t = 5.4; t <= 7.0 + 1e-6; t += 0.1) {
      this.poseAt(Math.min(t, 7.0 - 0.001), pose);
      const s = v3(pose.x, 0, pose.z);
      key(Math.min(t, 7.0 - 0.001), at(s, [lat, 18]).add(up(5.5)), s.clone().add(up(SHIP_Y + 3.5)), 50, t === 5.4, 'linear');
    }

    // 4. Turn: high three-quarter from the enemy side, the ship swings its guns toward the camera.
    const hc = H.clone().add(up(SHIP_Y + 2));
    key(7.0, at(H, [F, 19], [R, -6]).add(up(18.5)), hc, 50, true);
    key(10.0 - 0.001, at(H, [F, 16], [R, -2]).add(up(15.5)), hc, 50, false, 'inOut');

    // 5. Beat: close along the gun side from the stern end, the eight muzzles receding in depth. Held still.
    const beatLook = at(H, [R, -4], [F, 1.2]).add(up(SHIP_Y + 1.2));
    key(10.0, at(H, [R, 7.4], [F, 3.9]).add(up(SHIP_Y + 1.3)), beatLook, 52, true);
    key(11.0 - 0.001, at(H, [R, 7.0], [F, 3.9]).add(up(SHIP_Y + 1.3)), beatLook, 52, false, 'linear');

    // 6. Broadside: high from beyond the stern, the ripple of flashes runs away down the hull, the enemies at the left.
    const bsLook = at(H, [R, 1.5], [F, L * 0.55]).add(up(4.8));
    key(11.0, at(H, [R, -14.5], [F, 4.5]).add(up(13)), bsLook, 54, true);
    key(12.2 - 0.001, at(H, [R, -12.5], [F, 4.0]).add(up(12.6)), bsLook, 54, false, 'linear');

    // 7. Impacts: ground level among the enemies as the balls land.
    const hitLook = C.clone().add(up(2.2));
    key(12.2, at(C, [B, 3.5], [R, 6]).add(up(1.5)), hitLook, 64, true);
    key(14.0 - 0.001, at(C, [B, 2.5], [R, 3.5]).add(up(1.7)), hitLook, 64, false, 'inOut');

    // 8. Second volley: wide, low, from beyond the enemies looking back at the hull.
    const v2Look = at(H, [R, 1]).add(up(SHIP_Y + 2.5));
    key(14.0, at(H, [F, L + 9], [R, -4]).add(up(3.2)), v2Look, 52, true);
    key(17.0 - 0.001, at(H, [F, L + 9.5], [R, -3]).add(up(3.4)), v2Look, 52, false, 'linear');

    // 9. Sinking: wide from the caster's side, following the hull down.
    key(17.0, at(P0, [B, 5.5], [R, -7]).add(up(13)), H.clone().add(up(9)), 58, true);
    key(19.5, at(P0, [B, 5], [R, -7]).add(up(12)), H.clone().add(up(3.5)), 58, false, 'inOut');
    key(22.0 - 0.001, at(P0, [B, 4.5], [R, -6.5]).add(up(10)), H.clone().add(up(0.5)), 58, false, 'inOut');

    // 10. Calm: gameplay-like framing behind the caster.
    const calmLook = P0.clone().lerp(C, 0.6).add(up(1));
    key(22.0, at(P0, [B, 7.5], [R, 2]).add(up(5.8)), calmLook, 44, true);
    key(DURATION, at(P0, [B, 7], [R, 2]).add(up(5.6)), calmLook, 44, false, 'linear');
  }

  /** Danger zones: a circle at each target from 7 to 11. */
  telegraphSpecs(): TelegraphSpec[] {
    return this.tp.map((p) => ({ shape: { kind: 'circle', x: p.x, z: p.z, radius: 2 }, start: 7, impact: 11 }));
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
    this.shake = 0;
    this.splashAcc = 0;
    this.mistDone = [false, false, false];
    this.emberDone = false;
    for (let v = 0; v < 2; v++) {
      for (let k = 0; k < PORTS; k++) {
        this.fired[v][k] = false;
        this.landed[v][k] = false;
        this.hitDone[v][k] = false;
      }
    }
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  /** End of the timeline: everything back to neutral and hidden. */
  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
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
    this.kick *= Math.exp(-dt * 6);
    for (let v = 0; v < 2; v++) {
      for (let k = 0; k < PORTS; k++) {
        if (!this.fired[v][k] && t >= this.fireT(v, k)) this.onFire(v, k);
        if (!this.landed[v][k] && t >= this.landT(v, k)) this.onLand(v, k);
      }
    }
    if (dt > 0 && t >= 18.0 && t < 21.6) {
      // Ghost-water splashes along the waterline where the hull goes under.
      this.splashAcc += dt * 14;
      while (this.splashAcc >= 1) {
        this.splashAcc -= 1;
        const a = (Math.random() - 0.5) * 11;
        this.splash.burst(26, this.tmpA.copy(this.H).addScaledVector(this.R, a).setY(0.3));
      }
    }
    [18.6, 19.8, 21.0].forEach((mt, i) => {
      if (!this.mistDone[i] && t >= mt) {
        this.mistDone[i] = true;
        this.mist.burst(90, this.tmpA.copy(this.H).setY(0.3));
      }
    });
    if (!this.emberDone && t >= 21.4) {
      this.emberDone = true;
      this.embers.burst(160, this.tmpA.copy(this.H).setY(0.5));
    }
    this.layout();
  }

  private onFire(v: number, k: number) {
    this.fired[v][k] = true;
    this.kick = Math.max(this.kick, 0.2);
    const m = this.toWorld(this.fireT(v, k), this.muzzleLocal(k, this.tmpS), this.tmpA);
    this.flash.burst(34, m);
    this.sparks.burst(14, m);
    if (k % 2 === 0) this.smoke.trigger(this.tmpB.copy(m).addScaledVector(this.F, 0.6).setY(m.y + 0.2), 0.5, 1.2);
  }

  private onLand(v: number, k: number) {
    this.landed[v][k] = true;
    this.kick = Math.max(this.kick, 0.3);
    const lp = this.LP[k];
    this.sparks.burst(48, this.tmpA.copy(lp).setY(0.3));
    this.debris.burst(20, this.tmpA.copy(lp).setY(0.2));
    this.embers.burst(10, this.tmpA.copy(lp).setY(0.6));
    if (k % 2 === 0) this.smoke.trigger(this.tmpB.copy(lp).setY(0.8), 0.6, 1.1);
    const ctx = this.ctx;
    const ti = this.tIdx[k];
    if (ctx && ctx.targets.length && !this.hitDone[v][ti]) {
      this.hitDone[v][ti] = true;
      const from = this.H.clone();
      if (from.distanceToSquared(this.tp[ti]) < 0.09) from.set(this.tp[ti].x - 0.5, 0, this.tp[ti].z + 0.5);
      ctx.hit(ctx.targets[ti], {
        damage: v === 0 ? this.settings.damage1 : this.settings.damage2, knock: v === 0 ? 7 : 4, from, color: '#5effc0',
      });
    }
  }

  // --- Layout (pure function of time, apart from the bursts above) ---------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(22.0, 22.8, t));
      cin.active = t < 23.3;
    }
    this.layoutShip(t);
    this.layoutFog(t);
    this.layoutWake(t);
    this.layoutGround(t);
    this.layoutFire(t);
    this.layoutImpacts(t);
    this.layoutScreen(t);
  }

  private layoutShip(t: number) {
    const ship = this.ship;
    const p = this.poseAt(Math.max(t, 0), this._pose);
    const vis = t >= 2.4 && p.y > -14.6;
    ship.visible = vis;
    if (!vis) {
      this.haze.set(this.tmpA.set(0, -100, 0), 0, 0);
      return;
    }
    ship.position.set(p.x, p.y, p.z);
    ship.rotation.set(p.roll, p.yaw, p.pitch);

    // Sails billow and flutter.
    this.sails.forEach((sl) => {
      const pos = sl.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = sl.base[i * 3], y = sl.base[i * 3 + 1];
        const u = x / sl.w + 0.5, v = y / sl.h + 0.5;
        const belly = 0.75 * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(Math.PI * v));
        const flutter = 0.22 * (1 - v) * Math.sin(t * 2.1 + u * 4 + sl.seed) + 0.1 * Math.sin(t * 3.4 + v * 5 + sl.seed);
        pos.setZ(i, belly * (1 + 0.15 * Math.sin(t * 1.3 + sl.seed)) + flutter);
      }
      pos.needsUpdate = true;
    });

    // Lanterns swing.
    this.lanterns.forEach((l) => {
      l.pivot.rotation.z = 0.22 * Math.sin(t * 2.3 + l.seed);
      l.pivot.rotation.x = 0.12 * Math.sin(t * 1.9 + l.seed * 2);
      const flick = 1 + 0.12 * Math.sin(t * 9 + l.seed * 5);
      (l.halo.material as THREE.SpriteMaterial).opacity = 0.5 * flick;
      void l.glow;
    });

    // Ports: lids slide up one after another, barrels run out, glow brightens; recoil and flash on fire.
    this.ports.forEach((pr, i) => {
      const o0 = 8.2 + 0.18 * i;
      const open = ss(o0, o0 + 0.4, t);
      const ext = ss(o0 + 0.6, o0 + 1.1, t);
      const v = t >= this.fireT(1, i) ? 1 : 0;
      const a = t - this.fireT(v, i);
      const rec = a > 0 ? 0.6 * Math.exp(-a * 7) : 0;
      const fl = a > 0 ? Math.exp(-a * 9) : 0;
      pr.lid.position.y = PORT_Y + 1.0 * open;
      pr.lid.visible = open < 0.999;
      const g = 0.33 + 0.5 * open + 1.1 * fl;
      pr.glowMat.color.setScalar(g);
      pr.barrel.visible = open > 0.4;
      pr.barrel.position.set(pr.x, PORT_Y - 0.08, -pr.hw + 0.5 - 0.75 * ext + rec);
    });

    // Spectral shimmer along the keel while it sails.
    const sink = ss(SINK0, SINK1, t);
    this.haze.set(this.tmpA.set(p.x, p.y - 1.2, p.z), 0.012 * (1 - sink), Math.max(0, t), 1);
  }

  private layoutFog(t: number) {
    const roll = ss(0, 3.2, t);
    const out = ss(18, 22.5, t);
    const lat = this.lat, gd = this.gdir;
    const on = this.playing;
    const fadeIn = ss(0, 2.4, t) * (1 - out);
    for (const f of this.fog) {
      f.s.visible = on && fadeIn > 0.01;
      f.s.position.copy(this.W)
        .addScaledVector(lat, f.lat + 0.8 * Math.sin(t * 0.4 + f.h))
        .addScaledVector(gd, f.d - 14 * (1 - roll) - 18 * out + Math.max(t, 0) * 0.45);
      f.s.position.y = f.h + 0.5 * Math.sin(t * 0.5 + f.lat);
      f.s.scale.setScalar(f.size);
      f.mat.opacity = f.base * fadeIn;
    }
  }

  private layoutWake(t: number) {
    const on = this.playing;
    // Only trail while the ship is moving; a stationary ship would stack every sprite on one spot.
    const pa0 = this.poseAt(Math.max(t, 0), this._pose);
    const ax = pa0.x, az = pa0.z;
    const pb0 = this.poseAt(Math.max(t - 0.4, 0), this._pose);
    const moving = ss(0.6, 3, Math.hypot(ax - pb0.x, az - pb0.z) / 0.4);
    for (let i = 0; i < this.wake.length; i++) {
      const w = this.wake[i];
      const life = 2.0;
      const age = ((((t / life) + w.ph) % 1) + 1) % 1 * life;
      const tau = t - age;
      const live = on && tau >= 3.2 && tau < SINK0 + 0.5 && t < SINK1;
      if (!live) {
        w.s.visible = false;
        continue;
      }
      this.toWorld(tau, this.tmpS.set(-7.0, 2.2, 0), this.tmpA);
      w.s.visible = true;
      w.s.position.copy(this.tmpA).add(w.off);
      w.s.position.y += age * 0.35;
      w.s.scale.setScalar(w.size * (1 + age * 0.6));
      w.mat.opacity = 0.25 * moving * Math.sin((Math.PI * age) / life) * (1 - ss(SINK0 - 1, SINK0 + 0.5, t));
    }
    // Drips of ghost water off the keel.
    const pa = this.dripPos;
    for (let i = 0; i < this.dripSeed.length; i++) {
      const d = this.dripSeed[i];
      const ph = d.ph * d.per;
      const te = ph + Math.floor((t - ph) / d.per) * d.per;
      const age = t - te;
      let hide = !on || te < 3.6 || te > SINK0 || age > 1.6;
      if (!hide) {
        this.toWorld(te, this.tmpS.set(d.x, 0.2, 0), this.tmpA);
        this.tmpA.y -= 4.5 * age * age;
        if (this.tmpA.y < 0.05) hide = true;
      }
      if (hide) this.tmpA.set(0, -100, 0);
      pa[i * 3] = this.tmpA.x;
      pa[i * 3 + 1] = this.tmpA.y;
      pa[i * 3 + 2] = this.tmpA.z;
    }
    this.dripGeo.attributes.position.needsUpdate = true;
  }

  /** Bell rings, the sinking pool, ripples and ground refraction. */
  private layoutGround(t: number) {
    const on = this.playing;
    // Three faint bell rings at the caster's feet.
    this.bellRings.forEach((r, k) => {
      const p = (t - (0.7 + 0.8 * k)) / 1.1;
      r.mesh.position.set(this.P0.x, 0.06 + k * 0.003, this.P0.z);
      r.mesh.scale.setScalar(1 + 5 * clamp(p, 0, 1));
      r.material.opacity = on && p > 0 && p < 1 ? 0.35 * (1 - p) : 0;
    });

    // Pool under the sinking hull, aligned to it.
    this.poolG.position.set(this.H.x, 0.05, this.H.z);
    this.poolG.rotation.y = this.yawB;
    const pp = ss(18.3, 19.6, t) * (1 - ss(21.8, 23.6, t));
    const grow = 0.75 + 0.25 * ss(18.3, 20.5, t);
    this.pool.scale.set(8.4 * grow, 3.8 * grow, 1);
    (this.pool.material as THREE.MeshBasicMaterial).opacity = on ? 0.85 * pp : 0;
    this.pool.visible = on && pp > 0.005;
    const fp = ((t - 18.3) * 0.7) % 1;
    this.poolFoam.mesh.scale.set(7.2 * grow * (0.85 + 0.15 * fp), 3.1 * grow * (0.85 + 0.15 * fp), 1);
    this.poolFoam.material.opacity = on ? 0.35 * pp * (1 - fp * 0.5) : 0;

    // Expanding ripples where it enters, plus a ground refraction ring.
    this.sinkRings.forEach((r, k) => {
      const p = (t - (18.3 + 0.8 * k)) / 1.7;
      r.mesh.position.set(this.H.x, 0.07 + k * 0.003, this.H.z);
      r.mesh.scale.setScalar(2 + 9 * (1 - Math.pow(1 - clamp(p, 0, 1), 2)));
      r.material.opacity = on && p > 0 && p < 1 ? 0.5 * (1 - p) : 0;
    });
    this.sinkShock.forEach((sh, k) => {
      const p = (t - (18.4 + 1.1 * k)) / 1.3;
      const e = 1 - Math.pow(1 - clamp(p, 0, 1), 2);
      sh.set(this.tmpA.set(this.H.x, 0.05, this.H.z), 1.5 + 8 * e, on && p > 0 && p < 1 ? 0.03 * (1 - p) * (1 - p) : 0);
    });
  }

  /** Muzzle flashes, refraction, cannonballs with trails. */
  private layoutFire(t: number) {
    const on = this.playing;
    for (let k = 0; k < PORTS; k++) {
      const v = t >= this.fireT(1, k) ? 1 : 0;
      const a = t - this.fireT(v, k);
      const live = on && a >= 0 && a < 0.4;
      const m = this.toWorld(this.fireT(v, k), this.muzzleLocal(k, this.tmpS), this.tmpA);
      const pop = StarBurst.pop(a, 0.05, 0.12);
      this.muzzleStar[k].set(m, 1.3 * pop.scale, live ? pop.opacity : 0, a * 16 + k);
      const p = clamp(a / 0.3, 0, 1);
      this.muzzleShock[k].set(m, lerp(0.3, 2.5, p), live && a < 0.3 ? 0.04 * (1 - p) * (1 - p) : 0);
    }

    // Balls: indexed v * 8 + k.
    const M = this.tmpB, P = this.tmpC;
    let n = 0, nt = 0, ne = 0;
    const d = this.dummy;
    for (let v = 0; v < 2; v++) {
      for (let k = 0; k < PORTS; k++) {
        const idx = v * PORTS + k;
        const halo = this.ballHalo[idx];
        const age = t - this.fireT(v, k);
        const u = age / FLIGHT;
        if (!on || u < 0 || u >= 1) {
          halo.visible = false;
          continue;
        }
        this.ballAt(v, k, u, M);
        d.position.copy(M);
        d.scale.setScalar(0.35);
        d.updateMatrix();
        this.ballCore.setMatrixAt(n, d.matrix);
        n++;
        halo.visible = true;
        halo.position.copy(M);
        halo.scale.setScalar(1.3 + 0.15 * Math.sin(t * 30 + k));
        (halo.material as THREE.SpriteMaterial).opacity = 0.5;
        // Short trail (about 2 units): dark smoke puffs plus a green ember streak close behind the ball.
        const span = 2.0 / Math.max(6, this.muzzleDist(v, k) * 1.2);
        for (let j = 1; j <= TRAIL; j++) {
          const uj = u - j * (span / TRAIL);
          if (uj < 0) break;
          this.ballAt(v, k, uj, P);
          const wob = Math.sin(j * 2.1 + k) * 0.05 * j;
          d.position.set(P.x + wob, P.y + 0.04 * j, P.z - wob);
          d.scale.setScalar(0.3 * (1 - j / (TRAIL + 2)) + 0.08);
          d.updateMatrix();
          this.ballTrail.setMatrixAt(nt++, d.matrix);
          if (j <= 5) {
            d.position.set(P.x, P.y, P.z);
            d.scale.setScalar(0.2 * (1 - (j - 1) / 5));
            d.updateMatrix();
            this.ballTiny.setMatrixAt(ne++, d.matrix);
          }
        }
      }
    }
    this.ballCore.count = n;
    this.ballTiny.count = ne;
    this.ballTrail.count = nt;
    this.ballCore.instanceMatrix.needsUpdate = true;
    this.ballTiny.instanceMatrix.needsUpdate = true;
    this.ballTrail.instanceMatrix.needsUpdate = true;
  }

  /** Landing bursts: toon fire cones, star, ring, refraction, and the scorch decals that stay. */
  private layoutImpacts(t: number) {
    const on = this.playing;
    const fade = 1 - ss(22.4, 23.9, t);
    for (let k = 0; k < PORTS; k++) {
      const s = this.slots[k];
      const v = t >= this.landT(1, k) ? 1 : 0;
      const age = t - this.landT(v, k);
      const lp = this.LP[k];
      const landed = on && age >= 0;
      const first = on && t >= this.landT(0, k);

      // Decal: appears with the first landing, grows and darkens with the second.
      s.decal.visible = first && fade > 0.01;
      s.decal.position.set(lp.x, 0.045 + k * 0.001, lp.z);
      s.decal.scale.setScalar((1.6 + 0.35 * v) * (0.6 + 0.4 * ss(0, 0.2, t - this.landT(0, k))));
      (s.decal.material as THREE.MeshBasicMaterial).opacity = (0.75 + 0.2 * v) * fade;

      const cp = clamp(age / 0.8, 0, 1);
      const pop = StarBurst.pop(age, 0.1, 0.2);
      const last = 1;
      s.star.set(this.tmpA.set(lp.x, 1.1, lp.z), 1.15 * pop.scale, landed ? pop.opacity : 0, age * 10 + k);

      const rise = 1 - Math.exp(-Math.max(age, 0) * 14);
      const hgt = 1.6 * rise * (1 - ss(0.3, 0.8, age)) * last;
      const wid = 1.0 * (0.6 + 0.8 * cp) * last;
      s.cone.visible = landed && hgt > 0.02;
      s.cone.position.set(lp.x, 0.05, lp.z);
      s.cone.scale.set(wid, Math.max(hgt, 1e-3), wid);
      s.cone.rotation.y = k * 0.7 + age * 3;
      (s.cone.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - ss(0.5, 0.8, age));
      s.cone2.visible = s.cone.visible;
      s.cone2.position.set(lp.x, 0.06, lp.z);
      s.cone2.scale.set(wid * 0.5, Math.max(hgt * 0.72, 1e-3), wid * 0.5);
      s.cone2.rotation.y = -k * 0.5 - age * 5;
      (s.cone2.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - ss(0.4, 0.7, age));
      // Toon flame tongues rising 2-3 units, leaning outward, licking up and shrinking.
      s.tongues.forEach((tg, q) => {
        const a = (q / 6) * Math.PI * 2 + k * 0.9;
        const flick = 1 + 0.14 * Math.sin(t * 28 + q * 2.1 + k);
        const h = (2.0 + 1.0 * ((q * 7 + k) % 3) / 2) * flick * (1 - Math.exp(-Math.max(age, 0) * (11 + q))) * (1 - ss(0.35 + q * 0.04, 0.85, age));
        tg.visible = landed && h > 0.03;
        tg.position.set(lp.x + Math.cos(a) * 0.5, 0.05, lp.z + Math.sin(a) * 0.5);
        const w = (1.1 + 0.2 * (q % 2)) * (1 - ss(0.4, 0.85, age) * 0.5);
        tg.scale.set(q % 2 ? -w : w, Math.max(h, 1e-3), 1);
        (tg.material as THREE.MeshBasicMaterial).opacity = 0.92 * (1 - ss(0.55, 0.9, age));
      });
      s.cone.visible = false;
      s.cone2.visible = false;

      s.ring.mesh.position.set(lp.x, 0.08 + k * 0.002, lp.z);
      s.ring.mesh.scale.setScalar(0.8 + 3.6 * (1 - Math.pow(1 - clamp(age / 0.55, 0, 1), 3)));
      s.ring.material.opacity = landed && age < 0.6 ? 0.6 * (1 - age / 0.6) : 0;

      const sp = clamp(age / 0.5, 0, 1);
      s.shock.set(this.tmpA.set(lp.x, 0.05, lp.z), lerp(0.5, 4, 1 - Math.pow(1 - sp, 3)), landed && age < 0.5 ? 0.035 * (1 - sp) * (1 - sp) : 0);
    }
  }

  private layoutScreen(t: number) {
    const on = this.playing;
    const scr = this.screen;
    scr.darken = on ? 0.5 * ss(0, 2.2, t) * (1 - ss(18, 22.5, t)) : 0;
    const lastLand = this.landT(0, PORTS - 1);
    scr.impact = on ? impactFrameAt(t, lastLand, [1, 2], 0.04) : 0;
    scr.chroma = on ? Math.max(chromaPulse(t, lastLand, 0.55, 8), chromaPulse(t, FIRE1, 0.18, 10), chromaPulse(t, FIRE2, 0.14, 10)) : 0;
    scr.speedLines = 0;
    if (on) {
      this.toWorld(Math.max(t, 0), this.tmpS.set(0, 1.5, 0), scr.focus);
      if (t >= 12.2 && t < 14) scr.focus.copy(this.C).setY(1.2);
    }
    const sinkRumble = on && t > 18.2 && t < 21.4 ? 0.12 : 0;
    this.shake = on ? Math.max(this.kick, sinkRumble) : 0;
  }
}

export const ghostGalleonBroadsideModule: EffectModule = {
  label: 'ghost galleon broadside',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: 8 },
  create: () => new GhostGalleonBroadside(),
  telegraphs(effect) {
    return (effect as GhostGalleonBroadside).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as GhostGalleonBroadside;
    if (e.ctx) frameCast(camera, controls, e.ctx, 14);
  },
  buildGui(f, effect) {
    const s = (effect as GhostGalleonBroadside).settings;
    f.add(s, 'loop');
    f.add(s, 'damage1', 1, 200, 1).name('damage volley 1');
    f.add(s, 'damage2', 1, 200, 1).name('damage volley 2');
  },
};

