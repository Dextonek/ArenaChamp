import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Clockwork Judgement (targeted, ground AoE): a giant brass clock face is drawn on the ground (canvas dial, real
 * gear meshes around the rim, filigree hands). The hands tick fast to 11:59 in 12 fps steps, the gears turning one
 * tooth per tick; at twelve the gears stand up as walls and topple inward, iron plates crack the dial and steam
 * bursts from the teeth. The numerals then fall away and the machine spins down.
 *
 * Materials (brass, iron) stay below the bloom threshold; the only glowing parts are the cyan hub gem, tiny tick
 * glints and the small hot star at the hit. Palette: #fff1d0 / #ffc76a / brass #b8862e / steam #7fe0e0 / iron #1a1410.
 */
export interface ClockworkJudgementSettings {
  damage: number;
  loop: boolean;
}

export const defaultClockworkJudgement = (): ClockworkJudgementSettings => ({ damage: 55, loop: false });

const HIT = 2.25; // gears land: impact frames, hit
const DURATION = 4.8;
const TICK_START = 0.8;
const TICK_END = 2.0; // hands snap to twelve
const TICKS = 14; // 12 fps steps between TICK_START and TICK_END
const GEARS = 12;
const RING_R = 4.55; // gear centre radius
const GEAR_R = 1.3; // gear tip radius
const TEETH = 10;
const FACE_R = 3.7; // dial radius (world)
const NUM_R = 2.22;
const WEDGES = 8;
const RADIUS = 5.5;

const HOT = 0xffc76a;
const CORE = 0xfff1d0;
const STEAM = 0x7fe0e0;
const IRON = 0x1a1410;

const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, g: cv.getContext('2d')! };
}

function tex(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The dial (1024²): iron outline, brass bezel with a value ramp and studs, pale brass face, ticks, inner filigree. */
function faceTexture(): THREE.CanvasTexture {
  const { cv, g } = canvas(1024, 1024);
  const C = 512;
  const disc = (r: number, fill: string | CanvasGradient) => {
    g.beginPath();
    g.arc(C, C, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  const circle = (r: number, color: string, w: number) => {
    g.beginPath();
    g.arc(C, C, r, 0, Math.PI * 2);
    g.strokeStyle = color;
    g.lineWidth = w;
    g.stroke();
  };
  disc(504, '#14100c');
  const bz = g.createRadialGradient(C, C, 400, C, C, 492);
  bz.addColorStop(0, '#6e5222');
  bz.addColorStop(0.5, '#a67c2e');
  bz.addColorStop(0.85, '#c9a24a');
  bz.addColorStop(1, '#7a5c22');
  disc(492, bz);
  circle(480, '#e0c070', 4);
  circle(406, '#14100c', 10);
  // Studs on the bezel.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = C + Math.sin(a) * 444, y = C - Math.cos(a) * 444;
    g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fillStyle = '#14100c'; g.fill();
    g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#d2ae55'; g.fill();
  }
  const face = g.createRadialGradient(C, C, 40, C, C, 400);
  face.addColorStop(0, '#dcc384');
  face.addColorStop(1, '#b08c46');
  disc(398, face);
  // Minute and hour ticks.
  g.strokeStyle = '#1a1410';
  g.lineCap = 'butt';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const hour = i % 5 === 0;
    const r0 = hour ? 338 : 366, r1 = 392;
    g.lineWidth = hour ? 13 : 5;
    g.beginPath();
    g.moveTo(C + Math.sin(a) * r0, C - Math.cos(a) * r0);
    g.lineTo(C + Math.sin(a) * r1, C - Math.cos(a) * r1);
    g.stroke();
  }
  // Inner filigree: ring, 12 petals, sunburst. The numerals are separate quads (they fall away at the end).
  circle(196, '#1a1410', 6);
  circle(207, '#8a6a2c', 3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    g.save();
    g.translate(C, C);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -110); g.lineTo(-20, -150); g.lineTo(0, -188); g.lineTo(20, -150); g.closePath();
    g.fillStyle = '#9a7632';
    g.fill();
    g.strokeStyle = '#1a1410';
    g.lineWidth = 5;
    g.stroke();
    g.restore();
  }
  g.strokeStyle = '#5a4420';
  g.lineWidth = 4;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(C + Math.sin(a) * 52, C - Math.cos(a) * 52);
    g.lineTo(C + Math.sin(a) * 100, C - Math.cos(a) * 100);
    g.stroke();
  }
  return tex(cv);
}

/** Crack web over the dial: black cracks with a gold edge, from the centre outward. */
function crackTexture(): THREE.CanvasTexture {
  const { cv, g } = canvas(1024, 1024);
  const rnd = lcg(11);
  const C = 512;
  const lines: number[][][] = [];
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: number[][] = [[x, y]];
    let px = x, py = y;
    const steps = Math.max(3, Math.round(len / 45));
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.7;
      px += Math.cos(a) * (len / steps);
      py += Math.sin(a) * (len / steps);
      pts.push([px, py]);
      if (depth < 2 && i > 0 && rnd() < 0.35) branch(px, py, a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.4, depth + 1);
    }
    lines.push(pts);
  };
  for (let k = 0; k < 9; k++) branch(C, C, (k / 9) * Math.PI * 2 + rnd() * 0.4, 420 + rnd() * 60, 0);
  g.lineJoin = 'miter';
  for (const [color, w] of [['#d2ae55', 16], ['#0e0b08', 8]] as const) {
    g.strokeStyle = color;
    g.lineWidth = w;
    for (const pts of lines) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
    }
  }
  return tex(cv);
}

function numeralTexture(text: string): THREE.CanvasTexture {
  const { cv, g } = canvas(256, 128);
  g.font = `bold ${text.length > 3 ? 70 : 88}px Georgia, "Times New Roman", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = '#ecd9a0';
  g.lineWidth = 12;
  g.strokeText(text, 128, 68);
  g.fillStyle = '#1a1410';
  g.fillText(text, 128, 68);
  return tex(cv);
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function gearGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const p = (Math.PI * 2) / TEETH;
  const root = GEAR_R * 0.8;
  for (let i = 0; i < TEETH; i++) {
    const a = i * p;
    const pts: [number, number][] = [
      [root, a - 0.27 * p], [GEAR_R, a - 0.14 * p], [GEAR_R, a + 0.14 * p], [root, a + 0.27 * p],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.27, 0, Math.PI * 2, true);
  s.holes.push(hole);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.17, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -0.15);
  return geo;
}

/** A filigree clock hand pointing +Y: counterweight tail, thin stem, spade, tip. */
function handGeometry(len: number, wid: number, back: number, spade: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -back - 0.12);
  s.lineTo(-wid * 1.1, -back * 0.55);
  s.lineTo(-wid * 0.5, 0);
  s.lineTo(-wid * 0.5, len * 0.5);
  s.lineTo(-spade, len * 0.66);
  s.lineTo(-wid * 0.45, len * 0.76);
  s.lineTo(0, len);
  s.lineTo(wid * 0.45, len * 0.76);
  s.lineTo(spade, len * 0.66);
  s.lineTo(wid * 0.5, len * 0.5);
  s.lineTo(wid * 0.5, 0);
  s.lineTo(wid * 1.1, -back * 0.55);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
}

function wedgeGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.4);
  s.lineTo(-0.55, 1.2);
  s.lineTo(-1.0, 3.2);
  s.lineTo(1.0, 3.2);
  s.lineTo(0.55, 1.2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
}

interface GearRig {
  pivot: THREE.Group;
  tilt: THREE.Group;
  spin: THREE.Group;
  phi: number;
  dir: number;
  steamed: boolean;
}

export class ClockworkJudgement implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ClockworkJudgementSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private tickHit = [false, false];
  private steamAcc = 0;
  private smokeDone = false;
  private center = new THREE.Vector3();
  private yaw = Math.PI; // clock group yaw: dial 'up' (XII) points from the caster toward the target
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  // --- Structure: clock (centred, yawed) > face (lies on the ground, local +Y = XII, +Z = up). ---
  private clock = new THREE.Group();
  private face = new THREE.Group();

  private groundMat = new THREE.MeshBasicMaterial({ color: IRON, transparent: true, opacity: 0, depthWrite: false });
  private faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, opacity: 0, depthWrite: false });
  private crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false });
  private numerals: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; a: number }[] = [];

  private ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, metalness: 0.4, roughness: 0.6, emissive: 0x2a2218, emissiveIntensity: 0.35, transparent: true });
  private brassMat = new THREE.MeshStandardMaterial({ color: 0x9a7430, metalness: 0.35, roughness: 0.5, emissive: 0x9a7430, emissiveIntensity: 0.3, transparent: true });
  private gearMats = [
    new THREE.MeshStandardMaterial({ color: 0x95702c, metalness: 0.35, roughness: 0.5, emissive: 0x95702c, emissiveIntensity: 0.3, transparent: true }),
    new THREE.MeshStandardMaterial({ color: 0x7a5a24, metalness: 0.35, roughness: 0.55, emissive: 0x7a5a24, emissiveIntensity: 0.3, transparent: true }),
  ];
  private gearOutlineMat = new THREE.MeshStandardMaterial({ color: 0x14100c, metalness: 0.2, roughness: 0.7, emissive: 0x14100c, emissiveIntensity: 0.4, transparent: true });
  private wedgeMat = new THREE.MeshStandardMaterial({ color: 0x3a3128, metalness: 0.5, roughness: 0.55, emissive: 0x3a3128, emissiveIntensity: 0.35, transparent: true });
  private gemMat = new THREE.MeshBasicMaterial({ color: STEAM, transparent: true, opacity: 0 });

  private minuteHand = new THREE.Group();
  private hourHand = new THREE.Group();
  private hub = new THREE.Group();
  private gem: THREE.Mesh;
  private gears: GearRig[] = [];
  private wedges: { g: THREE.Group; phi: number; k: number }[] = [];

  private stars: StarBurst;
  private glints: StarBurst[] = [];
  private xiiGlint: StarBurst;
  private ring = createRing(HOT, 0.93, 1, 96);
  private shock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private smoke = new SmokeBall({ color: 0x2a2018, rim: 0x4a3a2c, flake: 0x2a2018, maxBalls: 3 });
  private steam: Emitter;
  private sparks: Emitter;
  private dust: Emitter;

  constructor(settings: ClockworkJudgementSettings = defaultClockworkJudgement()) {
    this.settings = settings;
    this.screen.tint.set(0x6a5a4a);
    this.screen.impactColor.set(HOT);
    this.screen.speedLineColor.set(HOT);
    this.screen.edgeTint.set(STEAM);

    this.clock.add(this.face);
    this.face.rotation.x = -Math.PI / 2;
    this.group.add(this.clock);

    // Ground plate (dark iron shadow under the dial) and the dial.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(RADIUS + 0.7, 64), this.groundMat);
    ground.position.z = 0.02;
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(FACE_R * 2 * 1.024, FACE_R * 2 * 1.024), this.faceMat);
    faceMesh.position.z = 0.05;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(FACE_R * 2 * 1.024, FACE_R * 2 * 1.024), this.crackMat);
    crack.position.z = 0.3;
    this.face.add(ground, faceMesh, crack);

    // Numerals: separate upright quads so they can fall away at the end.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ map: numeralTexture(ROMAN[i]), transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), mat);
      mesh.position.set(Math.sin(a) * NUM_R, Math.cos(a) * NUM_R, 0.09);
      this.face.add(mesh);
      this.numerals.push({ mesh, mat, a });
    }

    // Hands (iron with a brass inlay) and the hub with the one glowing gem.
    const mh = new THREE.Mesh(handGeometry(3.2, 0.09, 0.6, 0.22), this.ironMat);
    const mInlay = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.5, 0.02), this.brassMat);
    mInlay.position.set(0, 1.0, 0.06);
    this.minuteHand.add(mh, mInlay);
    this.minuteHand.position.z = 0.2;
    const hh = new THREE.Mesh(handGeometry(2.1, 0.13, 0.45, 0.3), this.ironMat);
    const hInlay = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.02), this.brassMat);
    hInlay.position.set(0, 0.7, 0.06);
    this.hourHand.add(hh, hInlay);
    this.hourHand.position.z = 0.16;
    const hubRim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 24), this.ironMat);
    hubRim.rotation.x = Math.PI / 2;
    const hubGold = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 24), this.brassMat);
    hubGold.rotation.x = Math.PI / 2;
    this.gem = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), this.gemMat);
    this.gem.position.z = 0.08;
    this.hub.add(hubRim, hubGold, this.gem);
    this.hub.position.z = 0.24;
    this.face.add(this.hourHand, this.minuteHand, this.hub);

    // Gears: pivot (rim contact point, aimed outward) > tilt (topples about the tangent) > spin.
    const gGeo = gearGeometry();
    for (let i = 0; i < GEARS; i++) {
      const pivot = new THREE.Group();
      const tilt = new THREE.Group();
      const holder = new THREE.Group();
      const spin = new THREE.Group();
      holder.position.y = GEAR_R;
      const body = new THREE.Mesh(gGeo, this.gearMats[i % 2]);
      const outline = new THREE.Mesh(gGeo, this.gearOutlineMat);
      outline.scale.set(1.1, 1.1, 1.05);
      outline.position.z = -0.01;
      spin.add(outline, body);
      holder.add(spin);
      tilt.add(holder);
      pivot.add(tilt);
      pivot.visible = false;
      this.face.add(pivot);
      this.gears.push({ pivot, tilt, spin, phi: (i / GEARS) * Math.PI * 2, dir: i % 2 ? 1 : -1, steamed: false });
    }

    // Iron plates that crack the dial, an iris of wedges.
    const wGeo = wedgeGeometry();
    for (let k = 0; k < WEDGES; k++) {
      const g = new THREE.Group();
      const trim = new THREE.Mesh(wGeo, this.brassMat);
      trim.scale.set(1.08, 1.08, 1);
      trim.position.z = -0.02;
      const body = new THREE.Mesh(wGeo, this.wedgeMat);
      body.scale.set(0.94, 0.94, 1);
      body.position.z = 0.03;
      g.add(trim, body);
      g.visible = false;
      this.face.add(g);
      this.wedges.push({ g, phi: (k / WEDGES) * Math.PI * 2 + 0.2, k });
    }

    // Crisp stars (normal blended for the impact so it stays a hard shape; tiny additive glints for ticks).
    this.stars = new StarBurst({ points: 8, inner: 0.3, color: HOT, core: CORE, additive: false });
    this.xiiGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: STEAM, core: 0xd8ffff });
    this.group.add(this.stars.mesh, this.xiiGlint.mesh);
    for (let i = 0; i < 3; i++) {
      const gl = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: STEAM, core: 0xd8ffff });
      this.glints.push(gl);
      this.group.add(gl.mesh);
    }
    this.group.add(this.ring.mesh, this.smoke.mesh, this.shock.mesh);

    // Steam: small, soft, pale cyan-grey, normal blended.
    this.steam = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.15, speed: 1.4, speedJitter: 0.6, spread: 70, gravity: -0.5, drag: 1.4,
      sizeStart: 0.3, sizeEnd: 0.8, colorStart: '#cfecec', colorEnd: '#7fb0b0', colorMid: '#a8d0d0',
      opacityStart: 0.32, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 8, speedJitter: 0.6, spread: 90, gravity: 10, drag: 1.2,
      sizeStart: 0.09, sizeEnd: 0.02, colorStart: '#ffe2a0', colorEnd: '#b8862e',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.6, speed: 2.5, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.4,
      sizeStart: 0.7, sizeEnd: 1.5, colorStart: '#4a4036', colorEnd: '#1a1410', colorMid: '#2e271f',
      opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.3, groundFade: 0.3,
    });
    this.emitters.push(this.steam, this.sparks, this.dust, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    // Dial 'up' (XII) points from the caster toward the clock, so the numerals read upright from behind the caster.
    this.yaw = ctx.aim + Math.PI;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.tickHit = [false, false];
    this.steamAcc = 0;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const g of this.gears) g.steamed = false;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    this.stepEvents(dt);
    this.layout(dt);
  }

  /** Face-local point (x right, y toward XII, z up) to world. */
  private toWorld(x: number, y: number, z: number, out: THREE.Vector3) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(this.center.x + x * c - y * s, z + 0.06, this.center.z - x * s - y * c);
  }

  /** One-shot events: steam puffs as gears lock in, two small damage ticks, the big hit, drifting steam. */
  private stepEvents(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    this.gears.forEach((g, i) => {
      if (!g.steamed && t >= 0.05 + i * 0.04 + 0.3) {
        g.steamed = true;
        this.toWorld(Math.sin(g.phi) * RING_R, Math.cos(g.phi) * RING_R, 0.4, this.tmp);
        this.steam.burst(9, this.tmp);
      }
    });
    [1.2, 1.7].forEach((ts, i) => {
      if (!this.tickHit[i] && t >= ts) {
        this.tickHit[i] = true;
        if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: 6, knock: 0, from: this.center, color: '#ffe2a0' });
      }
    });
    if (!this.impacted && t >= HIT) {
      this.impacted = true;
      const p = this.tmp2.copy(this.center).setY(0.6);
      this.sparks.burst(220, p);
      this.dust.burst(60, p);
      for (const g of this.gears) {
        // Steam jets from the teeth where each gear lands.
        this.toWorld(Math.sin(g.phi) * (RING_R - GEAR_R * 1.2), Math.cos(g.phi) * (RING_R - GEAR_R * 1.2), 0.5, this.tmp);
        this.steam.burst(16, this.tmp);
      }
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 3, from: this.center });
    }
    const after = t - HIT;
    if (!this.smokeDone && after >= 0.15) {
      this.smokeDone = true;
      // Small iron-brown puff at the back edge of the dial; the steam jets carry the burst.
      this.toWorld(0, FACE_R * 0.85, 0.7, this.tmp);
      this.smoke.trigger(this.tmp, 0.9, 0.8);
    }
    if (after > 0.2 && after < 2.0 && dt > 0) {
      this.steamAcc += dt * 12;
      while (this.steamAcc >= 1) {
        this.steamAcc -= 1;
        const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3;
        this.toWorld(Math.sin(a) * r, Math.cos(a) * r, 0.5, this.tmp);
        this.steam.burst(1, this.tmp);
      }
    }
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - HIT;
    const D = HIT;
    const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
    this.clock.position.set(this.center.x, 0.06, this.center.z);
    this.clock.rotation.y = this.yaw;

    // --- Screen: darken through the build, release after the hit; focus lines on the topple; impact frames. ---
    this.screen.darken = t < D ? 0.6 * smoothstep(t / 0.5) : 0.6 * Math.exp(-Math.max(0, after - 0.1) * 2.2);
    this.screen.speedLines = t < D ? 0.5 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.5 - after * 3);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = 0.45 * chromaPulse(t, D, 1, 10);

    // --- Draw-in: dial scales/fades up, hands and numerals follow. ---
    const reveal = smoothstep(t / 0.7);
    const detail = smoothstep((t - 0.3) / 0.4);
    const dialFade = 1 - smoothstep((t - 3.3) / 1.1);
    const handFade = 1 - smoothstep((t - (D + 0.5)) / 0.7);
    this.faceMat.opacity = reveal * dialFade;
    this.groundMat.opacity = 0.55 * reveal * dialFade;
    this.face.scale.setScalar(0.85 + 0.15 * reveal);
    this.ironMat.opacity = detail * handFade;
    this.brassMat.opacity = detail * Math.max(handFade, 1 - smoothstep((t - 3.5) / 1.1));
    this.gemMat.opacity = detail * handFade;
    for (const m of [this.minuteHand, this.hourHand, this.hub]) m.visible = detail * handFade > 0.01;

    // --- Tick-tock: 12 fps steps, each tick snaps quickly; hands race to 11:59, then snap to twelve. ---
    const tt = (t - TICK_START) * 12;
    const n = Math.floor(clamp01(tt / TICKS) * TICKS);
    const tickPos = tt < 0 ? 0 : tt >= TICKS ? TICKS : n + smoothstep((tt - n) * 3);
    const p = tickPos / TICKS;
    const e = 1 - Math.pow(1 - p, 2.4);
    const snap = smoothstep((t - TICK_END) / 0.06);
    const minAng = THREE.MathUtils.lerp(e * (Math.PI * 4 - 0.105), Math.PI * 4, snap);
    const hourAng = THREE.MathUtils.lerp(Math.PI / 2 + e * (Math.PI * 1.5 - 0.03), Math.PI * 2, snap);
    this.minuteHand.rotation.z = -minAng;
    this.hourHand.rotation.z = -hourAng;
    const sinceTick = tt >= 0 && tt < TICKS ? (tt - n) / 12 : 99;
    const gemPulse = (tt >= 0 && tt < TICKS ? Math.exp(-sinceTick * 18) : 0) + (t > TICK_END && t < D ? 0.5 : 0);
    this.gem.scale.setScalar(1 + 0.6 * Math.min(1, gemPulse));
    this.gemMat.color.setHex(STEAM).multiplyScalar(0.8 + 0.2 * Math.min(1, gemPulse));

    // Tick glints at the minute-hand tip (pool of 3), and the cold glint on XII at the dead beat.
    const nowTick = tt >= 0 ? Math.min(TICKS - 1, Math.floor(tt)) : -1;
    const tipLen = 3.2;
    this.glints.forEach((gl, j) => {
      if (nowTick < 0 || t > TICK_END) { gl.set(this.tmp.set(0, -50, 0), 0, 0); return; }
      const m = nowTick - ((((nowTick - j) % 3) + 3) % 3);
      const pop = m >= 0 ? StarBurst.pop(t - (TICK_START + m / 12), 0.03, 0.08) : { scale: 0, opacity: 0 };
      this.toWorld(Math.sin(minAng) * tipLen, Math.cos(minAng) * tipLen, 0.35, this.tmp);
      gl.set(this.tmp, 0.7 * pop.scale, 0.9 * pop.opacity, m * 0.8);
    });
    const xp = StarBurst.pop(t - TICK_END, 0.2, 0.12);
    this.toWorld(0, tipLen, 0.4, this.tmp);
    this.xiiGlint.set(this.tmp, 1.2 * xp.scale, 0.95 * xp.opacity, 0);

    // --- Numerals: draw in, then fall away after the hit. ---
    this.numerals.forEach((nu, i) => {
      const tau = t - (D + 0.4 + i * 0.03);
      const fall = tau > 0 ? tau : 0;
      nu.mat.opacity = detail * (tau > 0 ? clamp01(1 - tau / 0.8) : 1) * (1 - smoothstep((t - 3.3) / 1.1));
      nu.mesh.visible = nu.mat.opacity > 0.01;
      const out = 1 + 0.3 * fall;
      nu.mesh.position.set(Math.sin(nu.a) * NUM_R * out, Math.cos(nu.a) * NUM_R * out, 0.09 + 3 * fall - 7 * fall * fall + 0.2 * (fall > 0 ? 1 : 0));
      nu.mesh.rotation.z = fall * (i % 2 ? 2.2 : -2.2);
    });

    // --- Gears: roll in and lock, tick one tooth per tick, stand up as walls, topple inward, spin down. ---
    const standT = clamp01((t - (D - 0.25)) / 0.18);
    const stand = 1 - Math.pow(1 - standT, 2);
    const slamU = clamp01((t - (D - 0.07)) / 0.07);
    const gearFade = 1 - smoothstep((t - 3.9) / 0.8);
    this.gearMats[0].opacity = this.gearMats[1].opacity = this.gearOutlineMat.opacity = gearFade;
    this.gears.forEach((g, i) => {
      const lockT = 0.05 + i * 0.04;
      const k = smoothstep((t - lockT) / 0.3);
      const dist = RING_R - GEAR_R + Math.pow(1 - k, 2) * 4;
      g.pivot.visible = k > 0.001 && gearFade > 0.01;
      g.pivot.position.set(Math.sin(g.phi) * dist, Math.cos(g.phi) * dist, 0);
      g.pivot.rotation.z = -g.phi;
      const shudder = standT > 0 && slamU === 0 ? 0.025 * Math.sin(t * 70 + i) : 0;
      const tau = stand * (Math.PI / 2) + slamU * slamU * (Math.PI / 2) + shudder;
      g.tilt.rotation.x = tau;
      const flip = smoothstep((tau - Math.PI / 2) / (Math.PI / 2));
      const bounce = after > 0 ? 0.22 * Math.exp(-after * 9) * Math.abs(Math.sin(after * 20)) : 0;
      g.pivot.position.z = 0.2 + (i % 2) * 0.45 * flip + 0.25 * flip + bounce;
      const spinDown = after > 0 ? 6 * (1 - Math.exp(-after * 1.5)) / 1.5 : 0;
      g.spin.rotation.z = g.dir * (tickPos * ((Math.PI * 2) / TEETH) + (1 - k) * -3 + spinDown)
        + (i % 2) * (Math.PI / TEETH);
    });

    // --- Iron plates slam onto the dial (an iris of wedges), then the dial cracks. ---
    const wedgeFade = 1 - smoothstep((t - 3.5) / 1.1);
    this.wedgeMat.opacity = wedgeFade;
    this.wedges.forEach((w) => {
      const s0 = D - 0.04 + w.k * 0.004;
      const u = clamp01((t - s0) / 0.06);
      w.g.visible = t >= s0 && wedgeFade > 0.01;
      w.g.rotation.z = -w.phi;
      w.g.position.z = 0.1 + 1.5 * (1 - u) * (1 - u);
      w.g.rotation.x = (1 - u) * 0.4 * (w.k % 2 ? 1 : -1);
    });
    this.crackMat.opacity = t >= D ? dialFade : 0;
    this.crackMat.visible = t >= D;

    // --- Impact: hard gold star with a small warm core, one thin brass ring on the ground. ---
    this.toWorld(0, 0, 1.4, this.tmp);
    const sp = StarBurst.pop(after, 0.1, 0.2);
    this.stars.set(this.tmp, 3.4 * sp.scale, sp.opacity, 0.2);
    this.toWorld(0, 0, 0.1, this.tmp);
    this.ring.mesh.position.copy(this.tmp);
    this.ring.mesh.scale.setScalar(1 + Math.max(0, after) * 12);
    this.ring.material.opacity = after > 0 ? Math.max(0, 0.6 * (1 - after / 0.5)) : 0;

    // Refraction ring riding the brass ring as the gears topple (0.5 s).
    const sq = clamp01(after / 0.5);
    this.shock.set(this.tmp.set(this.center.x, 0, this.center.z), 1 + Math.max(0, after) * 12, after > 0 && sq < 1 ? 0.04 * (1 - sq) * (1 - sq) : 0);

    // --- Shake: a low rumble while the gears stand, a hard hit on the topple. ---
    this.shake = after > 0 ? 0.55 * Math.exp(-after * 7) : standT > 0 ? 0.03 : 0;
  }
}

export const clockworkJudgementModule: EffectModule = {
  label: 'clockwork judgement',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ClockworkJudgement(),
  telegraphs(effect) {
    const e = effect as ClockworkJudgement;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0.1, impact: HIT }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as ClockworkJudgement;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ClockworkJudgement).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
