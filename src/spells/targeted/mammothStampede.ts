import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mammoth Stampede (targeted, single enemy, ice-age spirit): frost motes swirl together behind the caster into a
 * drawn, translucent woolly-mammoth spirit (seen from behind: shaggy rump, big ears, tusks curving out to the
 * sides, raised trunk) flanked by two calves. It rears, stamps once, holds a dead beat, then charges along the
 * caster -> target line, leaving frost hoof prints that ring out, a frost streak and a snow plume. Short
 * dark / light impact frames on the hit, tusk toss on the enemy, ice shards, then it runs on and dissolves
 * into snow while the prints frost over and fade.
 *
 * Palette (frost row): core #f0f8ff, hot #9ad8ff, body #3a6a9a, accent amber #ffb03a, dark #0e141c.
 */
export interface MammothStampedeSettings {
  damage: number;
  loop: boolean;
}

export const defaultMammothStampede = (): MammothStampedeSettings => ({ damage: 60, loop: false });

// Timeline (seconds).
const STOMP = 0.95; // the stamp
const CHARGE = 1.2; // charge starts (dead beat 1.05..1.2)
const HIT = 1.95; // contact with the target
const END = 4.5;

const START_AHEAD = 2.5; // the mammoth forms this far in front of the caster
const OVERRUN = 9; // how far past the contact point it runs on
const BOARD = 5.6; // sprite quad size (m): the drawn mammoth is ~5.4 m tall
const MOTES = 150;
const PRINTS = 22;
const SHARDS = 30;
const GHOSTS = 3;

const TUNDRA = 0x0e141c;
const SPIRIT = 0x9ad8ff;
const FROST = 0xf0f8ff;

/** Small seeded random so the drawn fur is the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * The mammoth, drawn from behind and slightly above (3/4 rear): head dome and raised trunk peeking over a shaggy
 * back, big ears either side, tusks curving out and up, a short tail on the rump, four feet. Hard edges, black
 * outline, a value ramp from a pale rim down to tundra dark. Everything stays below the bloom threshold.
 */
function mammothTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const dark = '#0e141c';
  const rnd = rng(7);

  // Fill a path, outline it black, and add a pale rim along its upper edge (value ramp: light on top).
  const shape = (path: Path2D, fill: CanvasGradient | string, y0: number, y1: number, rim = true) => {
    g.fillStyle = fill;
    g.fill(path);
    g.strokeStyle = dark;
    g.lineWidth = 8;
    g.stroke(path);
    if (!rim) return;
    g.save();
    g.clip(path);
    const rg = g.createLinearGradient(0, y0, 0, y1);
    rg.addColorStop(0, 'rgba(154,216,255,0.95)');
    rg.addColorStop(1, 'rgba(154,216,255,0)');
    g.strokeStyle = rg;
    g.lineWidth = 14;
    g.stroke(path);
    g.restore();
  };
  const vgrad = (y0: number, y1: number, stops: [number, string][]) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  const furStrokes = (clip: Path2D, n: number, x0: number, x1: number, y0: number, y1: number, len: number) => {
    g.save();
    g.clip(clip);
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      const l = len * (0.6 + 0.6 * rnd());
      const dx = (x - 256) * 0.16;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + dx * 0.4, y + l * 0.5, x + dx, y + l);
      g.strokeStyle = 'rgba(14,20,28,0.55)';
      g.lineWidth = 4;
      g.stroke();
      g.beginPath();
      g.moveTo(x + 5, y + 2);
      g.quadraticCurveTo(x + 5 + dx * 0.4, y + l * 0.45, x + 5 + dx, y + l * 0.8);
      g.strokeStyle = 'rgba(154,216,255,0.3)';
      g.lineWidth = 2;
      g.stroke();
    }
    g.restore();
  };

  // --- Feet (behind the fur skirt): dark pads with cream nails. ---
  for (const fx of [100, 317]) {
    const foot = new Path2D();
    foot.moveTo(fx, 430);
    foot.lineTo(fx + 96, 430);
    foot.lineTo(fx + 100, 490);
    foot.quadraticCurveTo(fx + 98, 508, fx + 70, 508);
    foot.lineTo(fx + 26, 508);
    foot.quadraticCurveTo(fx - 4, 508, fx - 4, 490);
    foot.closePath();
    shape(foot, vgrad(430, 508, [[0, '#2c5078'], [1, '#14243a']]), 430, 480, false);
    g.fillStyle = '#b9ccd0';
    g.strokeStyle = dark;
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(fx + 20 + k * 30, 498, 10, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // --- Raised trunk (behind the head dome): ridged, curling at the tip. ---
  const trunkPath = () => {
    g.beginPath();
    g.moveTo(256, 170);
    g.bezierCurveTo(256, 100, 262, 52, 294, 34);
    g.bezierCurveTo(322, 20, 350, 36, 344, 66);
    g.bezierCurveTo(341, 84, 322, 84, 320, 70);
  };
  trunkPath();
  g.strokeStyle = dark;
  g.lineWidth = 54;
  g.stroke();
  trunkPath();
  g.strokeStyle = '#4a7eae';
  g.lineWidth = 40;
  g.stroke();
  trunkPath();
  g.strokeStyle = 'rgba(14,20,28,0.5)';
  g.lineWidth = 40;
  g.setLineDash([3, 15]);
  g.stroke();
  g.setLineDash([]);
  g.save();
  g.translate(-9, 0);
  trunkPath();
  g.strokeStyle = 'rgba(154,216,255,0.75)';
  g.lineWidth = 7;
  g.stroke();
  g.restore();

  // --- Ears: big flaps either side of the head, a darker lining, fur on the rim. ---
  const ear = (mirror: boolean) => {
    g.save();
    if (mirror) { g.translate(512, 0); g.scale(-1, 1); }
    const p = new Path2D();
    p.moveTo(214, 112);
    p.bezierCurveTo(150, 66, 66, 104, 56, 176);
    p.bezierCurveTo(48, 240, 120, 276, 208, 232);
    p.closePath();
    shape(p, vgrad(70, 270, [[0, '#4f86b6'], [0.5, '#3a6a9a'], [1, '#1c3a5a']]), 80, 200);
    const inner = new Path2D();
    inner.moveTo(206, 126);
    inner.bezierCurveTo(158, 96, 98, 126, 92, 178);
    inner.bezierCurveTo(88, 224, 140, 246, 200, 216);
    inner.closePath();
    g.fillStyle = 'rgba(14,32,54,0.6)';
    g.fill(inner);
    furStrokes(p, 9, 70, 200, 110, 190, 46);
    g.restore();
  };
  ear(false);
  ear(true);

  // --- Tusks: thick ivory curves sweeping out to the sides and up, amber glint on the tips. ---
  const tusk = (mirror: boolean) => {
    g.save();
    if (mirror) { g.translate(512, 0); g.scale(-1, 1); }
    const P = [[216, 196], [92, 244], [8, 146], [78, 30]];
    const at = (u: number) => {
      const k = 1 - u;
      const x = k * k * k * P[0][0] + 3 * k * k * u * P[1][0] + 3 * k * u * u * P[2][0] + u * u * u * P[3][0];
      const y = k * k * k * P[0][1] + 3 * k * k * u * P[1][1] + 3 * k * u * u * P[2][1] + u * u * u * P[3][1];
      return [x, y, 14 - 10 * u];
    };
    for (const pass of [0, 1]) {
      g.fillStyle = pass === 0 ? dark : '#c4d4d8';
      for (let i = 0; i <= 48; i++) {
        const [x, y, r] = at(i / 48);
        g.beginPath();
        g.arc(x, y, pass === 0 ? r + 3.5 : r, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Shaded underside and a thin light edge along the upper side.
    for (let i = 0; i <= 48; i += 2) {
      const [x, y, r] = at(i / 48);
      g.fillStyle = 'rgba(58,106,154,0.55)';
      g.beginPath();
      g.arc(x + r * 0.3, y + r * 0.35, r * 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(232,244,248,0.7)';
      g.beginPath();
      g.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffb03a';
    g.beginPath();
    g.arc(P[3][0], P[3][1] - 2, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  tusk(false);
  tusk(true);

  // --- Head dome with a shaggy forelock. ---
  const head = new Path2D();
  head.moveTo(192, 244);
  head.bezierCurveTo(182, 150, 210, 92, 256, 86);
  head.bezierCurveTo(302, 92, 330, 150, 320, 244);
  head.closePath();
  shape(head, vgrad(86, 244, [[0, '#5d96c6'], [0.45, '#3a6a9a'], [1, '#1c3a5a']]), 90, 190);
  furStrokes(head, 10, 205, 308, 100, 200, 54);
  g.fillStyle = '#4a7eae';
  g.strokeStyle = dark;
  g.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    const x = 226 + i * 15;
    g.beginPath();
    g.moveTo(x - 9, 100);
    g.lineTo(x + 2, 66 - (i % 2) * 8);
    g.lineTo(x + 10, 100);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // --- Body: a big shaggy back and rump, hem of fur spikes. ---
  const body = new Path2D();
  body.moveTo(34, 440);
  body.bezierCurveTo(26, 360, 64, 290, 150, 264);
  body.bezierCurveTo(190, 252, 225, 248, 256, 248);
  body.bezierCurveTo(287, 248, 322, 252, 362, 264);
  body.bezierCurveTo(448, 290, 486, 360, 478, 440);
  for (let x = 478; x > 34; x -= 22) {
    body.lineTo(x - 6, 484 - rnd() * 8);
    body.lineTo(x - 22, 438 + rnd() * 6);
  }
  body.closePath();
  shape(body, vgrad(248, 484, [[0, '#4f86b6'], [0.3, '#3a6a9a'], [0.75, '#22436a'], [1, '#14243a']]), 252, 400);
  furStrokes(body, 30, 44, 470, 268, 380, 110);
  // Spine / rump cleft and a short tail with a tuft: the "seen from behind" cue.
  g.beginPath();
  g.moveTo(256, 262);
  g.quadraticCurveTo(250, 350, 256, 424);
  g.strokeStyle = 'rgba(14,20,28,0.7)';
  g.lineWidth = 6;
  g.stroke();
  g.beginPath();
  g.moveTo(256, 410);
  g.quadraticCurveTo(262, 440, 254, 466);
  g.strokeStyle = dark;
  g.lineWidth = 14;
  g.stroke();
  g.strokeStyle = '#2c5078';
  g.lineWidth = 7;
  g.stroke();
  g.fillStyle = dark;
  g.beginPath();
  g.ellipse(254, 474, 13, 17, 0.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2c5078';
  g.beginPath();
  g.ellipse(254, 474, 8, 12, 0.1, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hoof print: dark depression with a pale rim and three toe notches at the front (canvas bottom = travel direction). */
function hoofTexture(frost: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (!frost) {
    g.fillStyle = '#0e141c';
    g.beginPath();
    g.ellipse(64, 62, 38, 48, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#6aa8d8';
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = '#3a6a9a';
    g.lineWidth = 5;
    for (const x of [44, 64, 84]) {
      g.beginPath();
      g.moveTo(x, 84);
      g.lineTo(x, 108);
      g.stroke();
    }
  } else {
    g.strokeStyle = '#cfe8f8';
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
      g.lineTo(64 + Math.cos(a) * (46 + (i % 2) * 12), 64 + Math.sin(a) * (46 + (i % 2) * 12));
      g.stroke();
    }
    g.fillStyle = 'rgba(154,216,255,0.35)';
    g.beginPath();
    g.ellipse(64, 64, 34, 42, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Frost streak on the ground: canvas top = tail (transparent), bottom = head (solid); crystal flecks, ragged edges. */
function streakTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  const rnd = rng(31);
  const fade = g.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, 'rgba(154,216,255,0)');
  fade.addColorStop(0.55, 'rgba(154,216,255,0.35)');
  fade.addColorStop(1, 'rgba(184,226,250,0.8)');
  g.fillStyle = fade;
  g.beginPath();
  g.moveTo(10, 0);
  for (let y = 0; y <= 256; y += 16) g.lineTo(18 + rnd() * 10, y);
  for (let y = 256; y >= 0; y -= 16) g.lineTo(110 - rnd() * 10, y);
  g.closePath();
  g.fill();
  // Dark core stripe underneath the frost so it reads against the pale snow.
  const core = g.createLinearGradient(0, 0, 0, 256);
  core.addColorStop(0, 'rgba(14,20,28,0)');
  core.addColorStop(1, 'rgba(14,20,28,0.35)');
  g.fillStyle = core;
  g.fillRect(48, 0, 32, 256);
  g.strokeStyle = 'rgba(224,242,255,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 38; i++) {
    const x = 20 + rnd() * 88;
    const y = 90 + rnd() * 160;
    const l = 8 + rnd() * 16;
    const a = (rnd() - 0.5) * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Board {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  lean: number;
}

export class MammothStampede implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MammothStampedeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private stomped = false;
  private smokeDone = false;
  private prevD = 0;

  // Cast geometry, computed in plan().
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private aim = Math.PI;
  private start = new THREE.Vector3(0, 0, 11.5);
  private hitPt = new THREE.Vector3(0, 1.2, 0);
  private hitFrom = new THREE.Vector3(0, 0, 3);
  private dHit = 10;
  private spacing = 1.8;
  private printCount = 8;

  // Sprites.
  private texture = mammothTexture();
  private boardGeo = new THREE.PlaneGeometry(BOARD, BOARD).translate(0, BOARD / 2, 0);
  private main: Board;
  private calves: Board[] = [];
  private ghosts: Board[] = [];
  private shadowMat = new THREE.MeshBasicMaterial({
    map: softDotTexture(), color: 0x05080c, transparent: true, opacity: 0, depthWrite: false,
  });
  private shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.shadowMat);

  // Ground.
  private rune = createRing(SPIRIT, 0.86, 1, 6);
  private runeInner = createRing(FROST, 0.9, 0.93, 64);
  private stompRing = createRing(SPIRIT, 0.88, 1, 96);
  private streakMat = new THREE.MeshBasicMaterial({
    map: streakTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.streakMat);
  private printGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private printDarkTex = hoofTexture(false);
  private printFrostTex = hoofTexture(true);
  private prints = Array.from({ length: PRINTS }, () => ({
    dark: new THREE.Mesh(this.printGeo, new THREE.MeshBasicMaterial({ map: this.printDarkTex, transparent: true, opacity: 0, depthWrite: false })),
    frost: new THREE.Mesh(this.printGeo, new THREE.MeshBasicMaterial({ map: this.printFrostTex, transparent: true, opacity: 0, depthWrite: false })),
    ring: createRing(SPIRIT, 0.84, 1, 40),
    d: 0, side: 1, appeared: -1, jitter: 0,
  }));

  // Formation motes.
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({
    a: Math.random() * Math.PI * 2, r: 2.2 + Math.random() * 2.8, y: Math.random() * 4.5, d: Math.random() * 0.45,
  }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.2, map: softDotTexture(), color: 0xbfe6ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);

  // Impact.
  private impactStar = new StarBurst({ points: 12, color: SPIRIT, core: FROST, additive: false });
  private impactGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xdff2ff, core: 0xffffff });
  private shockGround = createRing(SPIRIT, 0.9, 1, 96);
  private shockLine = createRing(0xbfe6ff, 0.9, 1, 96);
  private halo = new GlowSphere(SPIRIT, { rim: false });
  private shardMat = new THREE.MeshBasicMaterial({ color: SPIRIT, transparent: true, opacity: 0.9, depthWrite: false });
  private shardDarkMat = new THREE.MeshBasicMaterial({ color: TUNDRA, transparent: true, opacity: 0.85, depthWrite: false });
  private shardGeo = new THREE.OctahedronGeometry(1);
  private shards = new THREE.InstancedMesh(this.shardGeo, this.shardMat, SHARDS);
  private shardsDark = new THREE.InstancedMesh(this.shardGeo, this.shardDarkMat, SHARDS);
  private shardState = Array.from({ length: SHARDS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1,
  }));
  private smoke = new SmokeBall({ color: TUNDRA, rim: 0x2a3a52, flake: '#0e141c', maxBalls: 4 });

  private snow: Emitter;
  private frost: Emitter;
  private plume: Emitter;
  private sparks: Emitter;
  private flakes: Emitter;

  constructor(settings: MammothStampedeSettings = defaultMammothStampede()) {
    this.settings = settings;
    this.screen.tint.set(0x2a4a7a);
    this.screen.impactColor.set(SPIRIT);
    this.screen.speedLineColor.set(0xd8f0ff);

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.shards.frustumCulled = false;
    this.shardsDark.frustumCulled = false;

    this.main = this.makeBoard(0.8);
    for (let i = 0; i < 2; i++) this.calves.push(this.makeBoard(0.55));
    for (let i = 0; i < GHOSTS; i++) {
      const b = this.makeBoard(0.3);
      b.mat.color.set(0x8ac8f4);
      this.ghosts.push(b);
    }

    this.shadow.visible = false;
    this.streak.visible = false;
    this.streak.frustumCulled = false;
    this.group.add(this.shadow, this.streak, this.rune.mesh, this.runeInner.mesh, this.stompRing.mesh);
    for (const p of this.prints) {
      p.dark.visible = false;
      p.frost.visible = false;
      p.dark.position.y = 0.05;
      p.frost.position.y = 0.055;
      this.group.add(p.dark, p.frost, p.ring.mesh);
    }
    this.group.add(this.motes, this.impactStar.mesh, this.impactGlint.mesh);
    this.group.add(this.shockGround.mesh, this.shockLine.mesh, this.halo.mesh, this.shardsDark, this.shards, this.smoke.mesh);

    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 3.5, speed: 2.2, speedJitter: 0.6, spread: 110, gravity: 0.5, drag: 0.5,
      sizeStart: 0.13, sizeEnd: 0.04, colorStart: '#f0f8ff', colorEnd: '#9ad8ff',
      opacityStart: 0.55, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.frost = new Emitter({
      ...defaultSettings(), maxParticles: 1600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.7, speed: 1.6, speedJitter: 0.7, spread: 100, gravity: 0.3, drag: 1.4,
      sizeStart: 0.5, sizeEnd: 0.08, colorStart: '#d8f0ff', colorEnd: '#3a6a9a',
      opacityStart: 0.35, opacityEnd: 0, additive: true, colorMid: '#9ad8ff', sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    // Dark-blue normal-blended snow plume so the pale layers have something to read against.
    this.plume = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 2.4, speedJitter: 0.6, spread: 75, gravity: -0.1, drag: 1.3,
      sizeStart: 0.9, sizeEnd: 2.2, colorStart: '#a8c8e0', colorEnd: '#2a4260',
      opacityStart: 0.32, opacityEnd: 0, additive: false, colorMid: '#5a82a8', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 11, speedJitter: 0.6, spread: 90, gravity: 10, drag: 1,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#f0f8ff', colorEnd: '#3a8acf',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.flakes = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 5, speedJitter: 0.7, spread: 85, gravity: 2.2, drag: 1.1,
      sizeStart: 0.34, sizeEnd: 0.1, colorStart: '#e8f4ff', colorEnd: '#6a8aaa',
      opacityStart: 0.8, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.3, spin: 0.5, groundFade: 0.2,
    });
    this.emitters.push(this.snow, this.frost, this.plume, this.sparks, this.flakes, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);

    this.plan();
    this.reset();
  }

  /** A camera-facing (yaw only, so it stays upright) sprite of the mammoth. */
  private makeBoard(opacity: number): Board {
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.boardGeo, mat);
    const board: Board = { mesh, mat, lean: 0 };
    const camPos = new THREE.Vector3();
    const wPos = new THREE.Vector3();
    const parentQ = new THREE.Quaternion();
    const yawQ = new THREE.Quaternion();
    const rollQ = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const back = new THREE.Vector3(0, 0, 1);
    mesh.onBeforeRender = (_r, _s, camera) => {
      camera.getWorldPosition(camPos);
      mesh.getWorldPosition(wPos);
      yawQ.setFromAxisAngle(up, Math.atan2(camPos.x - wPos.x, camPos.z - wPos.z));
      mesh.parent?.getWorldQuaternion(parentQ);
      mesh.quaternion.copy(parentQ.invert().multiply(yawQ));
      mesh.quaternion.multiply(rollQ.setFromAxisAngle(back, board.lean));
      mesh.updateMatrixWorld(true);
    };
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.userData.maxOpacity = opacity;
    this.group.add(mesh);
    return board;
  }

  get duration() {
    return END;
  }

  get impactTime() {
    return HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.plan();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  /** Everything that depends on the cast: line, start point, contact distance, print layout. */
  private plan() {
    const ctx = this.ctx;
    const from = ctx?.from ?? new THREE.Vector3(0, 0, 14);
    this.aim = ctx?.aim ?? Math.PI;
    this.fwd.set(Math.sin(this.aim), 0, Math.cos(this.aim));
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.start.copy(from).addScaledVector(this.fwd, START_AHEAD).setY(0);
    const target = ctx?.targetPos[0] ?? ctx?.point ?? new THREE.Vector3(0, 0, 0);
    this.hitPt.copy(target).setY(1.2);
    this.hitFrom.copy(target).addScaledVector(this.fwd, -1.6).setY(0);
    const along = new THREE.Vector3().subVectors(target, from).dot(this.fwd);
    this.dHit = Math.max(along - START_AHEAD - 1.4, 2.5);
    const total = this.dHit + OVERRUN;
    this.spacing = Math.max(1.8, total / PRINTS);
    this.printCount = Math.min(PRINTS, Math.floor(total / this.spacing));
    this.prints.forEach((p, i) => {
      p.d = (i + 1) * this.spacing;
      p.side = i % 2 === 0 ? -1 : 1;
      p.jitter = (((i * 37) % 11) / 11 - 0.5) * 0.3;
      p.appeared = -1;
    });
    this.screen.focus.copy(this.hitPt);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.stomped = false;
    this.smokeDone = false;
    this.prevD = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const s of this.shardState) s.p.set(0, -50, 0);
    for (const p of this.prints) p.appeared = -1;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.stomped && this.time >= STOMP) this.onStomp();
    if (!this.impacted && this.time >= HIT) this.onImpact();
    if (!this.smokeDone && this.time >= HIT + 0.25) {
      this.smokeDone = true;
      this.smoke.trigger(new THREE.Vector3(this.hitFrom.x, 0.8, this.hitFrom.z), 0.9, 0.9);
    }
    this.layout(dt);
  }

  /** Distance run along the line at time t: still, accelerating charge, then an ease-out run-on. */
  private pathDist(t: number) {
    if (t < CHARGE) return 0;
    if (t < HIT) return this.dHit * Math.pow((t - CHARGE) / (HIT - CHARGE), 1.6);
    return this.dHit + OVERRUN * (1 - Math.exp(-(t - HIT) * 3.2));
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - HIT;
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);
    const fwd = this.fwd;
    const S = this.start;
    const d = this.pathDist(t);
    const moving = t >= CHARGE && after < 1.4;

    // --- Screen: cold darkening, focus lines during the charge, short impact frames on the hit. ---
    this.screen.darken = (t < HIT ? 0.55 * smoothstep(t / 0.6) : 0.55 * Math.exp(-Math.max(0, after - 0.1) * 2.2)) * fade;
    this.screen.speedLines = t < HIT ? 0.6 * smoothstep((t - CHARGE) / 0.3) : Math.max(0, 0.6 - after * 5);
    this.screen.impact = impactFrameAt(t, HIT, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, HIT, 0.55);

    // --- Mammoth: forms from motes, rears and stamps, holds, charges, runs on, dissolves. ---
    const form = smoothstep((t - 0.1) / 0.75);
    const dissolve = 1 - smoothstep((after - 0.3) / 1.0);
    const grow = 0.55 + 0.45 * smoothstep(t / 0.9);
    const rear = t > STOMP - 0.1 && t < STOMP + 0.1 ? Math.sin(((t - (STOMP - 0.1)) / 0.2) * Math.PI) : 0;
    const bobAt = (dist: number) => (moving ? 0.28 * Math.abs(Math.sin((Math.PI * dist) / this.spacing)) : 0);
    const place = (b: Board, dist: number, side: number, back: number, scale: number, alpha: number, bob: number, lean: number) => {
      const dd = Math.max(0, dist - back);
      b.mesh.position.set(S.x + fwd.x * dd + this.right.x * side, bob, S.z + fwd.z * dd + this.right.z * side);
      b.mesh.scale.set(scale, scale * (1 + 0.04 * (bob > 0 ? 1 : 0)), 1);
      b.mat.opacity = Math.max(0, alpha);
      b.mesh.visible = b.mat.opacity > 0.004;
      b.lean = lean;
    };
    const mainBob = bobAt(d) + 0.4 * rear * (1 - smoothstep((t - STOMP) / 0.05));
    const lean = moving ? 0.035 * Math.sin((Math.PI * d) / this.spacing) : 0;
    place(this.main, d, 0, 0, grow, this.main.mesh.userData.maxOpacity * form * dissolve * fade, mainBob, lean);
    this.calves.forEach((b, i) => {
      const side = (i === 0 ? -1 : 1) * 3.4;
      const f2 = smoothstep((t - 0.3) / 0.7);
      place(b, d, side, 2.2, grow * 0.62, b.mesh.userData.maxOpacity * f2 * dissolve * fade, bobAt(d - 2.2 + i), -lean);
    });
    this.ghosts.forEach((b, i) => {
      const on = smoothstep((t - CHARGE) / 0.15) * (1 - smoothstep((after - 0.5) / 0.4));
      place(b, d, 0, 1.6 * (i + 1), 1, (b.mesh.userData.maxOpacity / (i + 1)) * on * fade * form, 0, 0);
    });
    const mp = this.main.mesh.position;
    this.shadow.position.set(mp.x, 0.03, mp.z);
    this.shadow.scale.set(4.8, 1, 3.2);
    this.shadowMat.opacity = 0.5 * form * dissolve * fade;
    this.shadow.visible = this.shadowMat.opacity > 0.004;

    // --- Formation motes swirl in, a hex rune under the spot, the stomp ring. ---
    const formT = Math.min(1, t / 0.85);
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const k = THREE.MathUtils.clamp((formT - m.d) / (1 - m.d), 0, 1);
      const r = m.r * (1 - k * k);
      const a = m.a + k * 5;
      this.motePos[i * 3] = S.x + Math.cos(a) * r;
      this.motePos[i * 3 + 1] = 0.3 + m.y * (1 - 0.5 * k);
      this.motePos[i * 3 + 2] = S.z + Math.sin(a) * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = t < 1.0 ? 0.6 * smoothstep(t / 0.2) * (1 - smoothstep((t - 0.75) / 0.25)) : 0;
    this.rune.mesh.position.set(S.x, 0.05, S.z);
    this.rune.mesh.scale.setScalar(1.5 + 2.2 * smoothstep(t / 0.8));
    this.rune.mesh.rotation.z = t * 1.6;
    this.rune.material.opacity = (t < STOMP ? 0.5 * smoothstep(t / 0.3) : 0.5 * Math.exp(-(t - STOMP) * 5)) * fade;
    this.runeInner.mesh.position.set(S.x, 0.055, S.z);
    this.runeInner.mesh.scale.setScalar(3.2 * smoothstep(t / 0.8));
    this.runeInner.material.opacity = this.rune.material.opacity * 0.8;
    const sAge = t - STOMP;
    this.stompRing.mesh.position.set(S.x, 0.06, S.z);
    this.stompRing.mesh.scale.setScalar(1 + Math.max(0, sAge) * 14);
    this.stompRing.material.opacity = sAge > 0 ? Math.max(0, 0.65 * (1 - sAge / 0.5)) : 0;

    // --- Snow wind gusts while it forms. ---
    if (dt > 0 && t < 0.9) this.snow.burst(Math.ceil(dt * 120), new THREE.Vector3(S.x, 0.3, S.z));

    // --- Charge: frost streak, snow plume, hoof prints with their small shockwaves. ---
    if (moving && dt > 0) {
      const steps = Math.max(1, Math.ceil((d - this.prevD) / 0.7));
      for (let k = 1; k <= steps; k++) {
        const dd = this.prevD + ((d - this.prevD) * k) / steps;
        const x = S.x + fwd.x * dd, z = S.z + fwd.z * dd;
        this.frost.burst(6, new THREE.Vector3(x - fwd.x * 0.8, 0.5, z - fwd.z * 0.8));
        this.plume.burst(2, new THREE.Vector3(x - fwd.x * 1.2 + (Math.random() - 0.5) * 2, 0.4, z - fwd.z * 1.2 + (Math.random() - 0.5) * 2));
      }
    }
    this.prevD = d;
    const len = Math.max(0.01, d - 0.5);
    const streakOn = t >= CHARGE;
    this.streak.visible = streakOn;
    this.streak.position.set(S.x + fwd.x * len * 0.5, 0.04, S.z + fwd.z * len * 0.5);
    this.streak.rotation.y = this.aim;
    this.streak.scale.set(3.4, 1, len);
    this.streakMat.opacity = streakOn ? 0.85 * smoothstep((t - CHARGE) / 0.1) * (1 - smoothstep((after - 0.9) / 1.8)) * fade : 0;

    this.prints.forEach((p, i) => {
      const live = i < this.printCount;
      if (live && p.appeared < 0 && d >= p.d && t >= CHARGE) p.appeared = t;
      const age = p.appeared < 0 ? -1 : t - p.appeared;
      if (!live || age < 0) {
        p.dark.visible = p.frost.visible = false;
        p.ring.material.opacity = 0;
        return;
      }
      const x = S.x + fwd.x * p.d + this.right.x * p.side * 0.95;
      const z = S.z + fwd.z * p.d + this.right.z * p.side * 0.95;
      for (const m of [p.dark, p.frost]) {
        m.position.x = x;
        m.position.z = z;
        m.rotation.y = this.aim + p.jitter;
        m.scale.set(1.25, 1, 1.65);
      }
      (p.dark.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.min(1, age / 0.05) * (1 - smoothstep((age - 1.4) / 1.8)) * fade;
      (p.frost.material as THREE.MeshBasicMaterial).opacity = 0.7 * smoothstep((age - 0.15) / 0.6) * (1 - smoothstep((age - 2.0) / 1.6)) * fade;
      p.dark.visible = (p.dark.material as THREE.MeshBasicMaterial).opacity > 0.004;
      p.frost.visible = (p.frost.material as THREE.MeshBasicMaterial).opacity > 0.004;
      p.ring.mesh.position.set(x, 0.06, z);
      p.ring.mesh.scale.setScalar(0.5 + age * 4);
      p.ring.material.opacity = age < 0.35 ? 0.5 * (1 - age / 0.35) * fade : 0;
    });

    // --- Impact: stars, ground and line-facing shockwaves, halo, ice shards, tusk toss, snow burst. ---
    const hp = this.hitPt;
    const popAge = after - 0.08;
    const pop = StarBurst.pop(popAge);
    this.impactStar.set(hp, 4.6 * pop.scale, pop.opacity, 0.3);
    const gl = StarBurst.pop(popAge - 0.06, 0.05, 0.22);
    this.impactGlint.set(new THREE.Vector3(hp.x, hp.y + 1.6, hp.z), 1.4 * gl.scale, gl.opacity, t * 2);
    this.shockGround.mesh.position.set(hp.x, 0.06, hp.z);
    this.shockGround.mesh.scale.setScalar(1 + Math.max(0, after) * 22);
    this.shockGround.material.opacity = after > 0 ? Math.max(0, 0.7 * (1 - after / 0.6)) : 0;
    this.shockLine.mesh.rotation.set(0, this.aim, 0);
    this.shockLine.mesh.position.set(hp.x, hp.y, hp.z);
    this.shockLine.mesh.scale.setScalar(1 + Math.max(0, after) * 11);
    this.shockLine.material.opacity = after > 0 ? Math.max(0, 0.6 * (1 - after / 0.4)) : 0;
    this.halo.mesh.position.copy(hp);
    this.halo.mesh.scale.setScalar(1.4 + Math.max(0, after) * 5);
    this.halo.opacity = after > 0 ? 0.3 * Math.exp(-after * 9) : 0;
    this.shake = after > 0 ? 0.7 * Math.exp(-after * 6)
      : sAge > 0 && sAge < 0.5 ? 0.3 * Math.exp(-sAge * 8)
      : moving && t < HIT ? 0.05 : 0;

    // Tusks toss the enemy up and let it fall (offset resets on the next cast).
    const ctx = this.ctx;
    if (ctx && this.impacted && after < 1.0 && ctx.targets[0]) {
      const x = Math.min(1, Math.max(0, after / 0.7));
      ctx.displace(ctx.targets[0], new THREE.Vector3(0, 3.2 * 4 * x * (1 - x), 0));
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (dt > 0 && sh.p.y > -10) {
        sh.v.y -= 20 * dt;
        sh.p.addScaledVector(sh.v, dt);
        if (sh.p.y < 0.1) { sh.p.y = 0.1; sh.v.multiplyScalar(0); sh.w.multiplyScalar(0); }
        sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
      }
      const k = Math.max(1e-4, sh.s * (1 - smoothstep((after - 0.9) / 0.8)) * fade);
      q.setFromEuler(sh.r);
      m4.compose(sh.p, q, sc.set(0.16 * k, 0.55 * k, 0.16 * k));
      this.shards.setMatrixAt(i, m4);
      m4.compose(sh.p, q, sc.set(0.24 * k, 0.7 * k, 0.24 * k));
      this.shardsDark.setMatrixAt(i, m4);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.shardsDark.instanceMatrix.needsUpdate = true;

    // --- Run-on dissolve: the body sheds snow as it fades. ---
    if (dt > 0 && after > 0.25 && after < 1.4) {
      const pos = this.main.mesh.position;
      for (let i = 0; i < 4; i++) {
        this.flakes.burst(3, new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 3.5, 0.5 + Math.random() * 4.5, pos.z + (Math.random() - 0.5) * 3.5,
        ));
      }
    }
  }

  private onStomp() {
    this.stomped = true;
    const S = this.start;
    this.plume.burst(70, new THREE.Vector3(S.x, 0.3, S.z));
    this.frost.burst(90, new THREE.Vector3(S.x, 0.3, S.z));
    this.shake = 0.3;
  }

  private onImpact() {
    this.impacted = true;
    const hp = this.hitPt;
    this.sparks.burst(380, hp);
    this.flakes.burst(320, new THREE.Vector3(hp.x, 0.4, hp.z));
    this.frost.burst(120, new THREE.Vector3(hp.x, 0.6, hp.z));
    for (const sh of this.shardState) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      sh.p.set(hp.x, 0.5, hp.z);
      // Biased forward along the charge so the burst follows the mammoth's momentum.
      sh.v.set(Math.cos(a) * sp + this.fwd.x * 6, 6 + Math.random() * 9, Math.sin(a) * sp + this.fwd.z * 6);
      sh.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      sh.s = 0.7 + Math.random() * 0.8;
    }
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 8, from: this.hitFrom, color: '#bfe6ff' }));
  }
}

export const mammothStampedeModule: EffectModule = {
  label: 'mammoth stampede',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new MammothStampede(),
  telegraphs(effect) {
    const e = effect as MammothStampede;
    const ctx = e.ctx;
    const t = ctx?.targetPos[0] ?? ctx?.point;
    if (!ctx || !t) return [];
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: t.x, z2: t.z, width: 3.6 }, start: 0.1, impact: e.impactTime,
    }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as MammothStampede;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as MammothStampede).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
