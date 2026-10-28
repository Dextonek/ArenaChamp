import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Taotie Bronze Maw (targeted, `ground` mode, radius 4.5): the world darkens and a violet taotie face cracks open
 * in the ground. Two halves of a giant bronze taotie mask (canvas-drawn: big eyes, horns, cloud-and-thunder spirals,
 * hard black outline, green patina) rise on either side, leaning back and toward the caster so the face reads from
 * the play camera, while violet streaks and `ctx.displace` drag every enemy in the circle into the seam, ticking
 * damage. The jaws draw back, the eyes flare violet, a dead beat, then the halves slam shut: impact frames, a violet
 * void pillar up the seam, bronze chips, short dark dust. The closed face stares for a moment, then sinks.
 *
 * Palette row: Void / shadow with a bronze object (docs/ART_BIBLE.md §2). Only the eyes glow; bronze is mid-tone.
 * Recipes: d-kler-1-singularity-accretion-pull (enemies dragged to a centre, inward streaks, speed lines),
 * i-violet-void-pillar-crystal-skirt (violet pillar from the impact, dark ring), b-bdo-sorceress-reapers-scythe
 * (dark sweeping maw, violet vs dark smoke).
 */
export interface TaotieBronzeMawSettings {
  damage: number;
  tickDamage: number;
  loop: boolean;
}

export const defaultTaotieBronzeMaw = (): TaotieBronzeMawSettings => ({ damage: 55, tickDamage: 5, loop: false });

// Timeline (seconds).
const DECAL_END = 0.7;
const RISE_START = 0.7;
const RISE_END = 1.6;
const WIND_START = 1.5;
const D = 1.8; // jaws snap shut
const CLOSE_TIME = 0.14;
const SINK_START = 2.7;
const SINK_END = 3.6;
const DURATION = 4.6;
const TICKS = [1.0, 1.45];
const RADIUS = 4.5;

const HW = 4; // half width (m)
const H = 6.5; // mask height
const BULGE = 0.9; // the seam edge stands this far in front of the outer edge
const EYE_X = 185 / 128; // eye centre in the half, metres from the seam
const EYE_Y = H - 315 / 128;

const VIOLET = 0x8a2ee0;
const VIOLET_HOT = 0xd68cff;
const VIOLET_CORE = 0xf0d8ff;
const VIOLET_DARK = 0x07030c;

const CHIPS = 28;
const STARS = 3;
const STREAKS = 3;

const OUT = '#0a0704';
const BRONZE_HI = '#c9a24a';
const BRONZE_MID = '#6a4a1a';
const BRONZE_LO = '#3a2a10';
const PATINA = '#37957a';

/** Z of the mask surface at distance |x| from the seam: the seam bulges forward like a nose ridge. */
function shellZ(x: number): number {
  return BULGE * (1 - Math.pow(Math.min(1, Math.abs(x) / HW), 1.5));
}

function spiralPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, turns: number, dir: number) {
  g.beginPath();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = dir * k * turns * Math.PI * 2;
    const rr = r * (1 - 0.88 * k);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
}

/** Square spiral (leiwen, "thunder pattern") starting at (x, y), first edge going right, side s. */
function squareSpiralPath(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y);
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const d = s / 8;
  let px = x, py = y;
  for (let i = 0; i < 13; i++) {
    const len = s - d * Math.floor(i / 2);
    px += dirs[i % 4][0] * len;
    py += dirs[i % 4][1] * len;
    g.lineTo(px, py);
  }
}

/**
 * The right half of the taotie face, drawn in canvas px with the seam at x = 0 (the caller translates to the centre
 * and mirrors for the left half). 512 px = HW metres wide, 832 px = H metres tall.
 */
function drawHalf(g: CanvasRenderingContext2D) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Groove with a black edge, a patina inlay and a thin gold highlight offset up-left (light from above).
  const inlay = (path: () => void, w: number) => {
    path(); g.lineWidth = w + 6; g.strokeStyle = OUT; g.stroke();
    path(); g.lineWidth = w; g.strokeStyle = PATINA; g.stroke();
    g.save();
    g.translate(-1.5, -2.5);
    path(); g.lineWidth = Math.max(2, w * 0.35); g.strokeStyle = BRONZE_HI; g.stroke();
    g.restore();
  };

  // Horn behind the face: dark base, pale gold tip, ridges.
  const horn = new Path2D();
  horn.moveTo(170, 215);
  horn.bezierCurveTo(250, 90, 400, 110, 506, 14);
  horn.bezierCurveTo(480, 150, 400, 200, 300, 262);
  horn.closePath();
  const hg = g.createLinearGradient(170, 215, 506, 14);
  hg.addColorStop(0, BRONZE_LO);
  hg.addColorStop(0.6, BRONZE_MID);
  hg.addColorStop(1, BRONZE_HI);
  g.fillStyle = hg;
  g.fill(horn);
  g.strokeStyle = OUT;
  g.lineWidth = 8;
  g.stroke(horn);
  g.lineWidth = 4;
  for (const [x0, y0, x1, y1] of [[250, 200, 292, 150], [305, 168, 345, 118], [370, 130, 402, 88], [430, 85, 452, 50]]) {
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 12, (y0 + y1) / 2 + 12, x1, y1); g.stroke();
  }

  // Face silhouette.
  const face = new Path2D();
  face.moveTo(0, 110);
  face.bezierCurveTo(60, 100, 140, 120, 230, 170);
  face.lineTo(330, 232);
  face.bezierCurveTo(440, 262, 505, 330, 492, 432);
  face.bezierCurveTo(482, 540, 430, 640, 330, 702);
  face.bezierCurveTo(250, 772, 130, 800, 0, 808);
  face.closePath();
  const fg = g.createLinearGradient(0, 100, 0, 808);
  fg.addColorStop(0, '#80601f');
  fg.addColorStop(0.4, '#6a4a1a');
  fg.addColorStop(1, '#33240d');
  g.fillStyle = fg;
  g.fill(face);

  g.save();
  g.clip(face);
  // Patina blooms in the low, damp parts of the casting.
  for (const [x, y, r] of [[420, 640, 150], [120, 740, 140], [470, 380, 90], [40, 220, 70]]) {
    const pg = g.createRadialGradient(x, y, 4, x, y, r);
    pg.addColorStop(0, 'rgba(55,149,122,0.7)');
    pg.addColorStop(1, 'rgba(55,149,122,0)');
    g.fillStyle = pg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Forehead lozenge on the seam with a square spiral in it.
  g.beginPath();
  g.moveTo(0, 128); g.lineTo(70, 190); g.lineTo(0, 262); g.closePath();
  g.fillStyle = BRONZE_LO; g.fill();
  g.lineWidth = 7; g.strokeStyle = OUT; g.stroke();
  inlay(() => squareSpiralPath(g, 8, 166, 44), 5);

  // Heavy brow ridge over the eye.
  const brow = () => { g.beginPath(); g.moveTo(40, 232); g.quadraticCurveTo(170, 196, 345, 262); };
  brow(); g.lineWidth = 40; g.strokeStyle = OUT; g.stroke();
  brow(); g.lineWidth = 28; g.strokeStyle = '#5a3f16'; g.stroke();
  g.save(); g.translate(0, -8); brow(); g.lineWidth = 5; g.strokeStyle = BRONZE_HI; g.stroke(); g.restore();

  // Eye: black rim, gold ring, dark violet socket. The live glow mesh sits over the socket.
  g.save();
  g.translate(185, 315);
  g.rotate(-0.28);
  g.beginPath(); g.ellipse(0, 0, 120, 74, 0, 0, Math.PI * 2);
  g.fillStyle = OUT; g.fill();
  g.beginPath(); g.ellipse(0, 0, 110, 64, 0, 0, Math.PI * 2);
  g.lineWidth = 10; g.strokeStyle = BRONZE_HI; g.stroke();
  g.beginPath(); g.ellipse(0, 0, 98, 54, 0, 0, Math.PI * 2);
  g.fillStyle = '#14091f'; g.fill();
  g.restore();

  // Cloud spirals (yunwen) above and beside the eye, thunder spiral on the cheek.
  inlay(() => spiralPath(g, 345, 345, 40, 2.2, 1), 6);
  inlay(() => spiralPath(g, 440, 410, 28, 2, -1), 5);
  inlay(() => spiralPath(g, 120, 142, 26, 2, 1), 5);
  inlay(() => squareSpiralPath(g, 250, 470, 118), 7);
  inlay(() => squareSpiralPath(g, 360, 600, 74), 6);

  // Nose: a broad ridge down the seam ending in a flared nostril wing with a spiral.
  const nose = new Path2D();
  nose.moveTo(0, 330); nose.quadraticCurveTo(46, 360, 60, 470); nose.quadraticCurveTo(112, 520, 92, 566);
  nose.quadraticCurveTo(50, 592, 0, 584); nose.closePath();
  g.fillStyle = '#563c16'; g.fill(nose);
  g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(nose);
  g.strokeStyle = BRONZE_HI; g.lineWidth = 3;
  g.beginPath(); g.moveTo(10, 350); g.quadraticCurveTo(46, 380, 52, 470); g.stroke();
  inlay(() => spiralPath(g, 70, 535, 20, 1.8, 1), 4);

  // Mouth: a black band, bone fangs up and down, a wide bearded chin below.
  g.beginPath();
  g.moveTo(0, 618); g.lineTo(230, 640); g.lineTo(372, 668); g.lineTo(332, 704); g.lineTo(250, 728); g.lineTo(0, 748);
  g.closePath();
  g.fillStyle = OUT; g.fill();
  g.fillStyle = '#d8caa0';
  g.strokeStyle = OUT;
  g.lineWidth = 4;
  const fang = (x: number, y: number, w: number, h: number) => {
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y + h); g.lineTo(x + w / 2, y); g.closePath(); g.fill(); g.stroke();
  };
  fang(34, 622, 52, 70); fang(110, 630, 40, 46); fang(180, 637, 36, 40); fang(250, 648, 32, 34); fang(316, 664, 28, 26);
  fang(40, 744, 52, -70); fang(118, 738, 40, -44); fang(190, 733, 34, -38); fang(256, 727, 30, -30);
  g.strokeStyle = BRONZE_LO;
  g.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.moveTo(20, 764 + i * 8); g.quadraticCurveTo(160, 752 + i * 14, 290 - i * 36, 742 + i * 20); g.stroke();
  }
  g.restore();

  // Hard black outline over everything, then a light rim on the upper edge.
  g.strokeStyle = OUT;
  g.lineWidth = 10;
  g.stroke(face);
  g.strokeStyle = BRONZE_HI;
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(8, 118); g.bezierCurveTo(60, 108, 140, 128, 228, 178); g.stroke();
}

/** Full mask texture (1024 × 832): the right half mirrored onto the left. Outside the silhouette is transparent. */
function maskTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 832;
  const g = cv.getContext('2d')!;
  g.save(); g.translate(512, 0); drawHalf(g); g.restore();
  g.save(); g.translate(512, 0); g.scale(-1, 1); drawHalf(g); g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The face as ground cracks (white line art on transparent, tinted by the material): rims, eyes, brow, nose, mouth. */
function decalTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d')!;
  g.translate(256, 256);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.beginPath(); g.arc(0, 0, 244, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 226, 0, Math.PI * 2); g.stroke();
  // Radial cracks.
  g.lineWidth = 4;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1;
    g.beginPath();
    g.moveTo(Math.cos(a) * 226, Math.sin(a) * 226);
    g.lineTo(Math.cos(a + 0.05) * 205, Math.sin(a + 0.05) * 205);
    g.lineTo(Math.cos(a - 0.03) * 188, Math.sin(a - 0.03) * 188);
    g.stroke();
  }
  // Face drawn top = up, both sides mirrored.
  const half = (s: number) => {
    g.save();
    g.scale(s, 1);
    g.lineWidth = 7;
    g.beginPath(); g.ellipse(88, -34, 58, 32, -0.28, 0, Math.PI * 2); g.stroke(); // eye
    g.beginPath(); g.ellipse(88, -34, 26, 14, -0.28, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(8, -82); g.quadraticCurveTo(90, -104, 168, -66); g.stroke(); // brow
    g.beginPath(); g.moveTo(112, -106); g.bezierCurveTo(150, -170, 190, -170, 214, -176); g.stroke(); // horn
    g.beginPath(); g.moveTo(6, -30); g.quadraticCurveTo(26, 20, 30, 56); g.quadraticCurveTo(52, 76, 30, 92); g.stroke(); // nose
    g.beginPath(); g.moveTo(8, 118); g.lineTo(60, 124); g.lineTo(40, 146); g.lineTo(100, 140); g.lineTo(84, 160); g.lineTo(150, 150); g.stroke(); // mouth
    spiralPath(g, 150, 30, 26, 2.2, 1); g.stroke();
    spiralPath(g, 112, 86, 18, 2, -1); g.stroke();
    g.restore();
  };
  half(1);
  half(-1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dark soft disc for the scorched ground under the decal. */
function scorchTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(7,3,12,0.9)');
  gr.addColorStop(0.7, 'rgba(7,3,12,0.7)');
  gr.addColorStop(1, 'rgba(7,3,12,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

/** One half of the mask: a plane bent so the seam edge bulges forward, UVs picking its half of the texture. */
function halfGeometry(side: 1 | -1): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(HW, H, 24, 1);
  geo.translate(side * HW / 2, H / 2, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, shellZ(x));
    uv.setXY(i, 0.5 + 0.5 * x / HW, y / H);
  }
  geo.computeVertexNormals();
  return geo;
}

export class TaotieBronzeMaw implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TaotieBronzeMawSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private tickIdx = 0;
  private center = new THREE.Vector3();
  /** World yaw of the mask: its local +Z (the face) points at the caster. */
  private yaw0 = 0;
  private lastOff: THREE.Vector3[] = [];
  private cleared = false;

  // Ground: scorch, glowing face decal, shock ring, dark ring.
  private scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(RADIUS * 2.3, RADIUS * 2.3),
    new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, opacity: 0, depthWrite: false }),
  );
  private decalMat = new THREE.MeshBasicMaterial({
    map: decalTexture(), color: VIOLET, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  private decal = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 2.2, RADIUS * 2.2), this.decalMat);
  private shock = createRing(VIOLET_HOT, 0.9, 1, 96);
  private darkRing = createRing(VIOLET_DARK, 0.86, 1, 96);

  // Pull streaks: toon crescents spiralling inward along the ground.
  private streakPlane = new THREE.Group();
  private streaks: CrescentArc[] = [];

  // The mask: rig (lean, sink, squash) -> two hinge pivots -> shell + eye.
  private rig = new THREE.Group();
  private pivots: THREE.Group[] = [];
  private shellMat = new THREE.MeshStandardMaterial({
    map: maskTexture(), emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0.2,
    roughness: 0.6, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  private eyeMat = new THREE.MeshBasicMaterial({ color: VIOLET_HOT });
  private pupilMat = new THREE.MeshBasicMaterial({ color: 0x07030c });
  private eyes: THREE.Mesh[] = [];

  // Impact.
  private pillar = new LightPillar(VIOLET, 0.6);
  private stars: StarBurst[] = [];
  private chipMat = new THREE.MeshStandardMaterial({ color: 0x7a5a24, roughness: 0.7, metalness: 0 });
  private chips = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.2), this.chipMat, CHIPS);
  private chipState = Array.from({ length: CHIPS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
  }));

  private sparks: Emitter;
  private dust: Emitter;
  private embers: Emitter;

  constructor(settings: TaotieBronzeMawSettings = defaultTaotieBronzeMaw()) {
    this.settings = settings;
    this.screen.tint.set(0x1a1030);
    this.screen.impactColor.set(VIOLET);
    this.screen.speedLineColor.set(VIOLET_HOT);
    this.screen.edgeTint.set(VIOLET);
    this.shellMat.emissiveMap = this.shellMat.map;

    // --- Ground layers (flat, lying on the floor). ---
    for (const m of [this.scorch, this.decal]) m.rotation.order = 'YXZ';
    this.scorch.rotation.x = -Math.PI / 2;
    this.decal.rotation.x = -Math.PI / 2;
    this.scorch.renderOrder = 1;
    this.decal.renderOrder = 3;
    this.darkRing.mesh.renderOrder = 2;
    this.darkRing.material.blending = THREE.NormalBlending;
    this.group.add(this.scorch, this.decal, this.shock.mesh, this.darkRing.mesh);

    // --- Pull streaks. ---
    for (let i = 0; i < STREAKS; i++) {
      const arc = new CrescentArc({
        radius: RADIUS * 0.95, width: 1.2, style: 'toon', edge: VIOLET_HOT, mid: 0xa14cf0, outer: 0x2a0a4a, sweep: Math.PI * 1.1,
      });
      arc.mesh.rotation.z = (i * Math.PI * 2) / STREAKS;
      this.streakPlane.add(arc.mesh);
      this.streaks.push(arc);
    }
    this.streakPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.streakPlane);

    // --- The mask. ---
    const eyeGeo = new THREE.CircleGeometry(1, 28);
    for (const side of [-1, 1] as const) {
      const pivot = new THREE.Group();
      const shell = new THREE.Mesh(halfGeometry(side), this.shellMat);
      const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
      eye.scale.set(0.62, 0.34, 1);
      eye.position.set(side * EYE_X, EYE_Y, shellZ(EYE_X) + 0.05);
      eye.rotation.z = -side * 0.28;
      const pupil = new THREE.Mesh(eyeGeo, this.pupilMat);
      pupil.scale.set(0.14, 0.9, 1);
      pupil.position.z = 0.01;
      eye.add(pupil);
      pivot.add(shell, eye);
      this.rig.add(pivot);
      this.pivots.push(pivot);
      this.eyes.push(eye);
    }
    this.rig.rotation.order = 'YXZ';
    this.rig.visible = false;
    this.group.add(this.rig);

    // --- Impact. ---
    this.group.add(this.pillar.mesh);
    for (let i = 0; i < STARS; i++) {
      const s = new StarBurst({ points: 4, inner: 0.14, jitter: 0, color: VIOLET_HOT, core: VIOLET_CORE, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
    }
    this.chips.frustumCulled = false;
    this.group.add(this.chips);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 9, speedJitter: 0.6, spread: 100, gravity: 10, drag: 1.4,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#f0d8ff', colorEnd: '#8a2ee0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short, dark: the face must stay readable.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3, speedJitter: 0.6, spread: 75, gravity: -0.1, drag: 1.8,
      sizeStart: 0.4, sizeEnd: 1.0, colorStart: '#4a3a30', colorEnd: '#1a1210',
      opacityStart: 0.3, opacityEnd: 0, additive: false, colorMid: '#2e2420', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 1.4, speedJitter: 0.6, spread: 60, gravity: -1.2, drag: 0.8,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#f0d8ff', colorEnd: '#2a0a4a',
      opacityStart: 0.4, opacityEnd: 0, additive: true, colorMid: '#8a2ee0', sizeJitter: 0.5, erosion: 0.5, spin: 0.5,
    });
    this.emitters.push(this.sparks, this.dust, this.embers);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    // Face toward the caster: local +Z = from the centre toward ctx.from.
    this.yaw0 = Number.isFinite(ctx.aim) ? ctx.aim + Math.PI : 0;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.rig];
    const c = this.center;
    this.rig.position.set(c.x, 0, c.z);
    this.rig.rotation.y = this.yaw0;
    for (const m of [this.scorch, this.decal]) { m.position.set(c.x, 0.03, c.z); m.rotation.y = this.yaw0; }
    this.scorch.position.y = 0.025;
    this.decal.position.y = 0.04;
    this.shock.mesh.position.set(c.x, 0.07, c.z);
    this.darkRing.mesh.position.set(c.x, 0.05, c.z);
    this.streakPlane.position.set(c.x, 0.08, c.z);
    this.screen.focus.set(c.x, 2, c.z);
    this.lastOff = [];
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.tickIdx = 0;
    this.shake = 0;
    this.cleared = false;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    for (const s of this.chipState) s.p.set(0, -50, 0);
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    while (this.tickIdx < TICKS.length && this.time >= TICKS[this.tickIdx]) this.onTick(this.tickIdx++);
    if (!this.impacted && this.time >= D) this.onImpact();
    this.layout(dt);
  }

  /** Local-frame helpers: +Z toward the caster, +X to the mask's right. */
  private axes() {
    const s = Math.sin(this.yaw0), c = Math.cos(this.yaw0);
    return { zl: new THREE.Vector3(s, 0, c), xl: new THREE.Vector3(c, 0, -s) };
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - D;
    const c = this.center;

    // --- Layer 1: the world darkens; it releases while the closed mask stares. ---
    this.screen.darken = 0.8 * smoothstep(t / 0.6) * (1 - smoothstep((t - 2.1) / 1.2));

    // --- Layer 2: the face decal cracks open in violet over 0.7 s, scorch under it, edges fade last. ---
    const grow = smoothstep(t / DECAL_END);
    const decalFade = 1 - smoothstep((t - 2.9) / 1.5);
    const flicker = t < D ? 0.04 * Math.sin(t * 22) : 0;
    this.decalMat.opacity = Math.max(0, (0.45 * grow + flicker) * decalFade);
    this.decal.visible = this.decalMat.opacity > 0.003;
    this.decal.scale.setScalar(0.7 + 0.3 * grow - 0.12 * (1 - decalFade));
    this.scorch.material.opacity = 0.7 * smoothstep(t / 0.8) * (1 - smoothstep((t - 3.1) / 1.4));
    this.scorch.visible = this.scorch.material.opacity > 0.003;

    // --- Layer 3: the two halves rise, draw back, slam. ---
    const r = smoothstep((t - RISE_START) / (RISE_END - RISE_START));
    const rise = 1 - Math.pow(1 - THREE.MathUtils.clamp((t - RISE_START) / (RISE_END - RISE_START), 0, 1), 2.2);
    const wind = smoothstep((t - WIND_START) / (D - WIND_START - 0.05));
    let spread = THREE.MathUtils.lerp(5.4, 3.6, r) + 0.6 * wind;
    let tilt = THREE.MathUtils.lerp(0.95, 0.5, r) + 0.18 * wind;
    if (aw > 0) {
      const u = Math.min(1, aw / CLOSE_TIME);
      const e = u * u;
      spread *= 1 - e;
      tilt *= 1 - e;
    }
    const sink = smoothstep((t - SINK_START) / (SINK_END - SINK_START));
    const y = -(H + 0.4) * (1 - rise) - (H + 0.4) * sink;
    const squash = aw >= 0 ? 1 - 0.04 * Math.exp(-aw * 14) : 1;
    this.rig.visible = t > RISE_START - 0.02 && sink < 0.999;
    this.rig.position.set(c.x, y, c.z);
    this.rig.rotation.set(0.17 * (1 - 0.3 * sink), this.yaw0, 0);
    this.rig.scale.set(1, squash, 1);
    this.pivots.forEach((p, i) => {
      const side = i === 0 ? -1 : 1;
      p.position.x = side * spread;
      p.rotation.z = -side * tilt;
    });
    // Eyes: violet from the first rise, a hard flare in the dead beat and on the slam, then dimming.
    const flare = smoothstep((t - 1.6) / 0.06) * (t < D ? 1 : Math.exp(-Math.max(0, aw) * 2.2));
    const lit = smoothstep((t - 0.9) / 0.4) * (1 - smoothstep((t - 3.0) / 0.6));
    this.eyeMat.color.set(VIOLET).lerp(new THREE.Color(VIOLET_HOT), Math.max(lit * 0.7, flare)).lerp(new THREE.Color(VIOLET_CORE), flare * 0.35);
    for (const e of this.eyes) e.scale.set(0.62 * (1 + 0.18 * flare), 0.34 * (1 + 0.18 * flare), 1);
    this.eyeMat.opacity = 1;
    this.shellMat.emissiveIntensity = 0.2;

    // --- Layer 4: violet streaks wind inward along the ground (the pull). ---
    this.streaks.forEach((arc, i) => {
      const live = t > 0.85 && t < 1.65;
      const p = ((t - 0.85) * 0.85 + i / STREAKS) % 1;
      arc.head = 0.1 + 1.1 * p;
      arc.length = 0.55;
      arc.time = t;
      arc.opacity = live ? 0.85 * Math.sin(Math.PI * p) * smoothstep((t - 0.85) / 0.2) * (1 - smoothstep((t - 1.5) / 0.15)) : 0;
      arc.mesh.scale.setScalar(Math.max(1e-3, 1 - 0.8 * p));
      arc.mesh.rotation.z = (i * Math.PI * 2) / STREAKS + p * 2.2;
    });
    this.screen.speedLines = t < 0.9 ? 0 : t < 1.65 ? 0.5 * smoothstep((t - 0.9) / 0.4) : 0;

    // --- Layer 5: enemies are dragged to the seam, behind the mask plane. ---
    this.pullEnemies(t);

    // --- Layer 6: impact. Frames, pillar, stars, shock ring, chips. ---
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.6, 10);
    const { zl } = this.axes();
    if (aw >= 0) {
      this.pillar.set(c.x - zl.x * 0.3, c.z - zl.z * 0.3, 0, 16, 0.45 * Math.exp(-aw * 3) * (1 - smoothstep((t - 3.0) / 0.8)));
    } else {
      this.pillar.set(c.x, c.z, 0, 16, 0);
    }
    this.rig.updateMatrixWorld(true);
    const wp = new THREE.Vector3();
    this.stars.forEach((star, i) => {
      const pop = StarBurst.pop(aw - 0.02, 0.06, 0.16);
      if (i === 0) wp.set(c.x + zl.x * 1.3, 2.4, c.z + zl.z * 1.3);
      else this.eyes[i - 1].getWorldPosition(wp).addScaledVector(zl, 0.3);
      star.set(wp, (i === 0 ? 3.4 : 1.4) * pop.scale, pop.opacity, i * 0.5);
    });
    const se = 1 - Math.pow(1 - THREE.MathUtils.clamp(aw / 0.55, 0, 1), 3);
    this.shock.mesh.scale.setScalar(2 + 10 * se);
    this.shock.material.opacity = aw > 0 && aw < 0.55 ? 0.7 * (1 - aw / 0.55) : 0;
    const de = 1 - Math.pow(1 - THREE.MathUtils.clamp(aw / 0.9, 0, 1), 3);
    this.darkRing.mesh.scale.setScalar(1.5 + 6 * de);
    this.darkRing.material.opacity = aw > 0 ? 0.6 * (1 - smoothstep(aw / 1.6)) : 0;
    this.updateChips(dt);

    // --- Layer 7: violet embers rise from the seam while the face stares, then drift off. ---
    if (dt > 0 && aw > 0.15 && t < 3.4 && !this.cleared) {
      this.embers.burst(2, new THREE.Vector3(c.x + (Math.random() - 0.5) * 2.4, 0.3 + Math.random() * 2.5, c.z - zl.z * 0.2 + zl.x * (Math.random() - 0.5) * 2));
    }

    this.shake = aw >= 0
      ? 1.0 * Math.exp(-aw * 6)
      : t > RISE_START && t < RISE_END ? 0.05 * (0.6 + 0.4 * Math.sin(t * 40)) : t >= WIND_START ? 0.06 : 0;
  }

  private pullEnemies(t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const aw = t - D;
    if (aw > 0.8) {
      if (!this.cleared) {
        this.cleared = true;
        const zero = new THREE.Vector3();
        for (const e of ctx.targets) ctx.displace(e, zero);
      }
      return;
    }
    const { zl, xl } = this.axes();
    const c = this.center;
    const pull = smoothstep((t - 0.75) / 0.85);
    const k = aw > 0 ? Math.exp(-aw * 14) : 1;
    const n = ctx.targets.length;
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i];
      if (!tp) return;
      const xs = (i - (n - 1) / 2) * 0.9;
      const zs = -(0.8 + 0.7 * (i % 2));
      const off = this.lastOff[i] ?? (this.lastOff[i] = new THREE.Vector3());
      off.set(
        (c.x + xl.x * xs + zl.x * zs - tp.x) * pull * k,
        (0.25 * pull + 0.08 * pull * Math.sin(t * 9 + i)) * k,
        (c.z + xl.z * xs + zl.z * zs - tp.z) * pull * k,
      );
      ctx.displace(e, off);
    });
  }

  private updateChips(dt: number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < CHIPS; i++) {
      const s = this.chipState[i];
      if (dt > 0 && s.p.y > -10) {
        s.v.y -= 22 * dt;
        s.p.addScaledVector(s.v, dt);
        if (s.p.y < 0.1) { s.p.y = 0.1; s.v.set(0, 0, 0); s.w.multiplyScalar(0); }
        s.r.set(s.r.x + s.w.x * dt, s.r.y + s.w.y * dt, s.r.z + s.w.z * dt);
      }
      const fade = 1 - smoothstep((this.time - 3.0) / 0.6);
      // Never a zero scale on a lit instance.
      m.compose(s.p, q.setFromEuler(s.r), sc.setScalar(Math.max(1e-4, (0.6 + (i % 5) * 0.25) * fade)));
      this.chips.setMatrixAt(i, m);
    }
    this.chips.instanceMatrix.needsUpdate = true;
  }

  private onTick(_i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    // Knock 0: they flinch in place while being dragged.
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.tickDamage, knock: 0, from: this.center, color: '#d68cff' }));
  }

  private onImpact() {
    this.impacted = true;
    const c = this.center;
    const { zl, xl } = this.axes();
    const seam = new THREE.Vector3(c.x + zl.x * BULGE, 0.4, c.z + zl.z * BULGE);
    this.sparks.burst(260, seam.clone().setY(1.6));
    this.dust.burst(70, seam.clone().setY(0.3));
    this.embers.burst(120, seam.clone().setY(2));
    for (const s of this.chipState) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const sp = 3 + Math.random() * 6;
      s.p.set(seam.x, 0.3 + Math.random() * 4, seam.z);
      s.v.set(
        xl.x * side * sp + zl.x * (2 + Math.random() * 4),
        4 + Math.random() * 6,
        xl.z * side * sp + zl.z * (2 + Math.random() * 4),
      );
      s.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    }
    const ctx = this.ctx;
    if (!ctx) return;
    // Knock away from a point on the caster's side of the seam; never on top of an enemy.
    const from = new THREE.Vector3(c.x + zl.x * 2, 0, c.z + zl.z * 2);
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 3, from, color: '#d68cff' }));
  }
}

export const taotieBronzeMawModule: EffectModule = {
  label: 'taotie bronze maw',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TaotieBronzeMaw(),
  telegraphs(effect) {
    const e = effect as TaotieBronzeMaw;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: RISE_START, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as TaotieBronzeMaw;
    if (e.ctx) frameCast(camera, controls, e.ctx, H + 1);
  },
  buildGui(f, effect) {
    const s = (effect as TaotieBronzeMaw).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 30, 1).name('tick damage');
  },
};
