import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Jade Imperial Seal (targeted, single enemy): a red square outline closes round the chosen enemy while the world
 * darkens. A giant carved jade seal (3.2 m block, gold bands, coiled dragon knob) turns slowly down out of the sky,
 * hangs for a dead beat, then slams the target. Impact frames, dark ground plates round the square, a circular and
 * a square shock ring, short dust. The seal lifts and leaves a vermilion seal-script stamp burned into the ground,
 * then dissolves into rising jade motes; the stamp stays longest.
 *
 * Recipes: a-ow-doomfist-meteor-strike (landing marked by a growing ground indicator), c-ground-slam-shockwave-ring
 * (slam ring), b-ffxiv-titan-weight-of-the-land (heavy object, big flat ground breakage).
 */
export interface JadeImperialSealSettings {
  damage: number;
  loop: boolean;
}

export const defaultJadeImperialSeal = (): JadeImperialSealSettings => ({
  damage: 60,
  loop: false,
});

// Timeline (seconds).
const FOOT_END = 0.6;
const DESC_START = 0.6;
const DESC_END = 1.25;
const SLAM_START = 1.33;
const IMPACT = 1.45;
const LIFT_START = 1.6;
const LIFT_END = 2.3;
const FADE_END = 3.1;
const STAMP_FADE = 3.2;
const DURATION = 4.2;

const SIDE = 3.2; // seal footprint (m)
const BLOCK_H = 1.9;
const SKY = 12;
const HANG = 2.6; // bottom of the seal while it hangs; clears the enemy's head
const LIFT_H = 2.4;

const JADE_HOT = 0x9ff2c8;
const JADE_BODY = 0x2fbf7a;
const GOLD = 0xe8b84a;
const GOLD_DARK = 0xb98a2e;
const DARK = 0x0b2a1c;
const VERMILION = 0xc8301c;
const EMBER = 0xff7a30;

const PLATES = 8;
const MOTES = 70;

/** Deterministic pseudo-random for the hand-drawn canvases. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Carved side face (512 × 304): value ramp light jade (top) to dark jade (bottom), a recessed panel of key-fret rows. */
function sideTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 304;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const grad = g.createLinearGradient(0, 0, 0, 304);
  grad.addColorStop(0, '#58b98a');
  grad.addColorStop(0.5, '#34906a');
  grad.addColorStop(1, '#17543a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 304);

  // Recessed panel with a dark edge and a light bevel on its lower edge.
  const panel = g.createLinearGradient(0, 70, 0, 232);
  panel.addColorStop(0, '#2c7f5c');
  panel.addColorStop(1, '#1d6246');
  g.fillStyle = panel;
  g.fillRect(28, 70, 456, 162);
  g.strokeStyle = '#0b2a1c';
  g.lineWidth = 6;
  g.strokeRect(28, 70, 456, 162);
  g.strokeStyle = '#8fe0b4';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(32, 236); g.lineTo(488, 236); g.lineTo(488, 74); g.stroke();

  // Two rows of key frets (square spirals).
  const fret = [[0, 1], [0, 0], [1, 0], [1, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25], [0.75, 0.5]];
  const draw = (x0: number, y0: number, u: number) => {
    for (const pass of [{ c: '#8fe0b4', w: 3, dy: 3 }, { c: '#0b2a1c', w: 7, dy: 0 }]) {
      g.strokeStyle = pass.c;
      g.lineWidth = pass.w;
      g.beginPath();
      fret.forEach(([fx, fy], i) => {
        const x = x0 + fx * u, y = y0 + fy * u + pass.dy;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
    }
  };
  const u = 50;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) draw(48 + i * 52, 86 + row * 68, u);
  }
  // Dark outline round the whole face.
  g.strokeStyle = '#0b2a1c';
  g.lineWidth = 10;
  g.strokeRect(0, 0, 512, 304);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Top face (256²): mid jade, an inset carved border and a round recess where the dragon coils. */
function topTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 180);
  grad.addColorStop(0, '#5fbb90');
  grad.addColorStop(1, '#36906a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#0b2a1c';
  g.lineWidth = 6;
  g.strokeRect(24, 24, 208, 208);
  g.strokeStyle = '#8fe0b4';
  g.lineWidth = 2;
  g.strokeRect(30, 30, 196, 196);
  g.fillStyle = '#2b8160';
  g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#0b2a1c';
  g.lineWidth = 6;
  g.stroke();
  g.strokeStyle = '#0b2a1c';
  g.lineWidth = 10;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The stamp mark (512²), painted white so the material colour can run from hot ember to vermilion: a solid square
 * with a gap-line frame and four blocky seal-script glyphs cut out of it, worn by a few chips.
 */
function stampTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d')!;
  const rnd = lcg(7);
  g.fillStyle = '#ffffff';
  g.fillRect(6, 6, 500, 500);
  g.globalCompositeOperation = 'destination-out';
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  g.lineWidth = 9;
  g.strokeRect(34, 34, 444, 444);

  const chars: number[][][][] = [
    [[[.1, .2], [.9, .2]], [[.2, .48], [.8, .48]], [[.5, .2], [.5, .62]], [[.5, .62], [.2, .9]], [[.5, .62], [.8, .9]]],
    [[[.15, .15], [.85, .15], [.85, .5], [.15, .5], [.15, .15]], [[.5, .5], [.5, .9]], [[.2, .7], [.8, .7]]],
    [[[.15, .2], [.85, .2]], [[.5, .1], [.5, .4]], [[.2, .4], [.8, .4], [.8, .85]], [[.2, .4], [.2, .85]], [[.2, .62], [.8, .62]]],
    [[[.15, .2], [.15, .85]], [[.15, .2], [.5, .2], [.5, .55]], [[.15, .55], [.5, .55]], [[.7, .15], [.7, .9]], [[.7, .15], [.9, .15]]],
  ];
  const cell = 200, ox = 56, oy = 56;
  g.lineWidth = 28;
  chars.forEach((strokes, k) => {
    const cx = ox + (k % 2) * (cell + 4), cy = oy + Math.floor(k / 2) * (cell + 4);
    for (const s of strokes) {
      g.beginPath();
      s.forEach(([px, py], i) => {
        const x = cx + (px + (rnd() - 0.5) * 0.04) * cell, y = cy + (py + (rnd() - 0.5) * 0.04) * cell;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
    }
  });
  // Ink wear: small chips.
  for (let i = 0; i < 160; i++) {
    g.beginPath();
    g.arc(10 + rnd() * 492, 10 + rnd() * 492, 1.5 + rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class JadeImperialSeal implements Effect {
  readonly group = new THREE.Group();
  readonly settings: JadeImperialSealSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private center = new THREE.Vector3();
  /** World yaw of the square: the stamp's top edge points away from the caster. */
  private yaw0 = 0;

  // Ground: footprint, shadow, scorch, stamp.
  private footRing = createRing(VERMILION, 0.93, 1, 4);
  private footFill = new THREE.Mesh(
    new THREE.PlaneGeometry(SIDE, SIDE),
    new THREE.MeshBasicMaterial({ color: 0x8a1a10, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x020a06, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(SIDE * 1.3, SIDE * 1.3),
    new THREE.MeshBasicMaterial({ color: 0x04100a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private stampMat = new THREE.MeshBasicMaterial({
    map: stampTexture(), color: VERMILION, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private stamp = new THREE.Mesh(new THREE.PlaneGeometry(SIDE, SIDE), this.stampMat);
  private emberRing = createRing(EMBER, 0.95, 1, 4);

  // The seal.
  private seal = new THREE.Group();
  private sealMats: (THREE.Material & { opacity: number })[] = [];
  private sealEdges: THREE.LineSegments;
  private knobEyes: THREE.MeshBasicMaterial;

  // Impact.
  private corners: StarBurst[] = [];
  private shock = createRing(JADE_HOT, 0.9, 1, 96);
  private shockSquare = createRing(GOLD, 0.93, 1, 4);
  private refract = new ShockRefraction({ facing: 'ground' });
  private plates: THREE.InstancedMesh;
  private plateSeed = Array.from({ length: PLATES }, (_, i) => ({
    a: (i / PLATES) * Math.PI * 2 + 0.2 + (Math.random() - 0.5) * 0.3,
    size: 0.7 + Math.random() * 0.4, tilt: 0.7 + Math.random() * 0.4, push: 0.5 + Math.random() * 0.4,
  }));

  // Dissolve motes.
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({
    x: (Math.random() - 0.5) * SIDE * 0.9, y: Math.random() * BLOCK_H, z: (Math.random() - 0.5) * SIDE * 0.9,
    d: Math.random() * 0.5, v: 0.5 + Math.random() * 0.9, w: Math.random() * Math.PI * 2,
  }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.2, map: softDotTexture(), color: JADE_HOT, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);

  private trail: Emitter;
  private sparks: Emitter;
  private dust: Emitter;
  private leaf: Emitter;

  constructor(settings: JadeImperialSealSettings = defaultJadeImperialSeal()) {
    this.settings = settings;
    this.screen.tint.set(0x1d4a3a);
    this.screen.impactColor.set(JADE_BODY);
    this.screen.speedLineColor.set(0xe6fff6);

    // --- Ground layers. Ring "4 segments" is a diamond; spun 45° it is the axis-aligned square. ---
    const half = (SIDE / 2 + 0.12) * Math.SQRT2;
    for (const r of [this.footRing, this.shockSquare, this.emberRing]) r.mesh.scale.setScalar(half);
    for (const m of [this.footFill, this.shadow, this.scorch, this.stamp]) m.rotation.order = 'YXZ';
    for (const m of [this.footFill, this.shadow, this.scorch, this.stamp]) m.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.footFill.renderOrder = 1;
    this.scorch.renderOrder = 2;
    this.stamp.renderOrder = 3;
    this.emberRing.mesh.renderOrder = 4;
    this.group.add(
      this.shadow, this.footFill, this.scorch, this.stamp, this.footRing.mesh, this.emberRing.mesh,
      this.shock.mesh, this.shockSquare.mesh, this.refract.mesh,
    );

    // --- The seal: dark hull outline, carved block, gold bands, rim lines, dragon knob. ---
    const track = <T extends THREE.Material & { opacity: number }>(m: T): T => {
      m.transparent = true;
      this.sealMats.push(m);
      return m;
    };
    const sideTex = sideTexture();
    const topTex = topTexture();
    const carved = (map: THREE.Texture) => track(new THREE.MeshStandardMaterial({
      map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0,
    }));
    const sideMat = carved(sideTex);
    const topMat = carved(topTex);
    const bottomMat = track(new THREE.MeshBasicMaterial({ color: DARK }));
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(SIDE, BLOCK_H, SIDE),
      [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat],
    );
    block.position.y = BLOCK_H / 2;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(SIDE + 0.24, BLOCK_H + 0.16, SIDE + 0.24),
      track(new THREE.MeshBasicMaterial({ color: 0x04120b, side: THREE.BackSide })),
    );
    hull.position.y = BLOCK_H / 2 + 0.02;
    const goldMat = track(new THREE.MeshStandardMaterial({
      color: GOLD_DARK, emissive: 0x7a5a14, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.25,
    }));
    const band = (h: number, y: number, extra: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(SIDE + extra, h, SIDE + extra), goldMat);
      m.position.y = y;
      return m;
    };
    this.sealEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(SIDE + 0.02, BLOCK_H + 0.02, SIDE + 0.02)),
      track(new THREE.LineBasicMaterial({ color: JADE_HOT })),
    );
    this.sealEdges.position.y = BLOCK_H / 2;
    this.seal.add(hull, block, band(0.3, 0.17, 0.14), band(0.24, BLOCK_H - 0.12, 0.1), this.sealEdges);

    // Dragon knob: a gold lotus base, three jade coils, a raised neck and head with gold horns, facing +Z.
    const knob = new THREE.Group();
    const jade = track(new THREE.MeshStandardMaterial({
      color: 0x3fae7c, emissive: 0x145a3c, emissiveIntensity: 0.45, roughness: 0.5, metalness: 0,
    }));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.16, 24), goldMat);
    base.position.y = 0.08;
    knob.add(base);
    for (const [r, tube, y] of [[0.56, 0.18, 0.32], [0.46, 0.16, 0.58], [0.34, 0.14, 0.8]]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28), jade);
      coil.rotation.x = Math.PI / 2;
      coil.position.y = y;
      knob.add(coil);
    }
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 8, 16, Math.PI), jade);
    neck.position.set(0, 0.86, 0.25);
    neck.rotation.set(0, Math.PI / 2, 0);
    knob.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), jade);
    skull.scale.set(1, 0.85, 1.2);
    skull.position.set(0, 1.18, 0.52);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.3), jade);
    snout.position.set(0, 1.12, 0.8);
    knob.add(skull, snout);
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.38, 6), goldMat);
      horn.position.set(sx * 0.13, 1.4, 0.42);
      horn.rotation.x = -0.7;
      knob.add(horn);
    }
    this.knobEyes = track(new THREE.MeshBasicMaterial({ color: 0xffd060 }));
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.knobEyes);
      eye.position.set(sx * 0.15, 1.24, 0.7);
      knob.add(eye);
    }
    knob.position.y = BLOCK_H;
    knob.scale.setScalar(1.15);
    this.seal.add(knob);
    this.seal.visible = false;
    this.group.add(this.seal);

    // --- Impact. ---
    for (let i = 0; i < 4; i++) {
      const s = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: JADE_HOT, core: 0xffffff });
      this.corners.push(s);
      this.group.add(s.mesh);
    }
    const tri = new THREE.Shape();
    tri.moveTo(-1.2, 0); tri.lineTo(1.2, 0); tri.lineTo(0, 3.5); tri.closePath();
    this.plates = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(tri),
      new THREE.MeshBasicMaterial({ color: DARK, side: THREE.DoubleSide }),
      PLATES,
    );
    this.plates.frustumCulled = false;
    this.group.add(this.plates);

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 0.4, speedJitter: 0.8, spread: 180, gravity: 0, drag: 1.5,
      sizeStart: 0.22, sizeEnd: 0.02, colorStart: '#f2fff6', colorEnd: '#2fbf7a',
      opacityStart: 0.4, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 9, speedJitter: 0.6, spread: 80, gravity: 10, drag: 1.4,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#f2fff6', colorEnd: '#2fbf7a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short, dark: it must never swallow the stamp.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 3, speedJitter: 0.6, spread: 70, gravity: -0.1, drag: 1.8,
      sizeStart: 0.5, sizeEnd: 1.3, colorStart: '#3a5a50', colorEnd: '#0b2a1c',
      opacityStart: 0.32, opacityEnd: 0, additive: false, colorMid: '#1d3a34', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.leaf = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 1.4, speedJitter: 0.6, spread: 180, gravity: 1.2, drag: 1.2,
      sizeStart: 0.16, sizeEnd: 0.04, colorStart: '#fff2c0', colorEnd: '#e8b84a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3, spin: 0.8,
    });
    this.emitters.push(this.trail, this.sparks, this.dust, this.leaf);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const target = ctx.targetPos[0] ?? ctx.point;
    this.center.copy(target).setY(0);
    this.yaw0 = Number.isFinite(ctx.aim) ? ctx.aim - Math.PI : 0;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.seal];
    const c = this.center;
    for (const r of [this.footRing, this.shockSquare, this.emberRing]) r.mesh.rotation.z = Math.PI / 4 + this.yaw0;
    this.footRing.mesh.position.set(c.x, 0.05, c.z);
    this.emberRing.mesh.position.set(c.x, 0.07, c.z);
    this.shockSquare.mesh.position.set(c.x, 0.06, c.z);
    this.shock.mesh.position.set(c.x, 0.08, c.z);
    for (const m of [this.footFill, this.shadow, this.scorch, this.stamp]) m.rotation.y = this.yaw0;
    this.footFill.position.set(c.x, 0.03, c.z);
    this.shadow.position.set(c.x, 0.02, c.z);
    this.scorch.position.set(c.x, 0.025, c.z);
    this.stamp.position.set(c.x, 0.04, c.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
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
    if (!this.impacted && this.time >= IMPACT) this.onImpact();
    this.layout(dt);
  }

  /** Height of the seal's bottom face above the ground at time t. */
  private sealY(t: number): number {
    if (t < DESC_START) return SKY;
    if (t < SLAM_START) {
      const p = THREE.MathUtils.clamp((t - DESC_START) / (DESC_END - DESC_START), 0, 1);
      const ease = 1 - Math.pow(1 - p, 2.2);
      return SKY - (SKY - HANG) * ease + (p >= 1 ? 0.03 * Math.sin((t - DESC_END) * 14) : 0);
    }
    if (t < IMPACT) {
      const q = (t - SLAM_START) / (IMPACT - SLAM_START);
      return HANG * (1 - q * q);
    }
    const lift = smoothstep((t - LIFT_START) / (LIFT_END - LIFT_START));
    return LIFT_H * lift + 0.5 * smoothstep((t - LIFT_END) / 1.2);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - IMPACT;
    const c = this.center;
    const yaw = this.yaw0;

    // --- Layer 1: the world darkens for the build-up and drains while the seal lifts. ---
    this.screen.darken = 0.6 * smoothstep(t / 0.6) * (1 - smoothstep((t - 2.0) / 1.0));

    // --- Layer 2: red footprint square closes in round the target and fills from its edge. ---
    const foot = smoothstep(t / FOOT_END);
    const pulse = t > 0.9 && t < IMPACT ? 0.12 * Math.sin((t - 0.9) * 18) : 0;
    const footOp = t < IMPACT ? (0.7 * smoothstep(t / 0.25) + pulse) : Math.max(0, 1 * Math.exp(-after * 9));
    this.footRing.mesh.scale.setScalar((SIDE / 2 + 0.12) * Math.SQRT2 * (1.5 - 0.5 * foot));
    this.footRing.material.opacity = footOp;
    const fillOp = t < IMPACT ? 0.22 * smoothstep((t - 0.2) / 0.9) : 0;
    this.footFill.material.opacity = fillOp;
    this.footFill.scale.setScalar(Math.max(0.05, foot));

    // --- Layers 3-4: the seal descends, turning to align with the square, shadow growing under it. ---
    const sy = this.sealY(t);
    const prog = THREE.MathUtils.clamp((t - DESC_START) / (DESC_END - DESC_START), 0, 1);
    const alignE = 1 - Math.pow(1 - prog, 2);
    const lift = smoothstep((t - LIFT_START) / (LIFT_END - LIFT_START));
    const sealOp = smoothstep((t - 0.55) / 0.15) * (1 - smoothstep((t - LIFT_END) / (FADE_END - LIFT_END)));
    const squash = after >= 0 && t < LIFT_START ? 1 - 0.06 * Math.exp(-after * 14) : 1;
    this.seal.position.set(c.x, sy, c.z);
    this.seal.rotation.set(0.1 * (1 - alignE) * Math.sin(t * 5), yaw + 1.4 * (1 - alignE) + 0.25 * lift, 0);
    this.seal.scale.set(1, squash, 1);
    this.seal.visible = sealOp > 0.01;
    for (const m of this.sealMats) m.opacity = sealOp;
    (this.sealEdges.material as THREE.LineBasicMaterial).opacity = sealOp * 0.7;
    this.knobEyes.color.set(0xffd060).lerp(new THREE.Color(0xffffff), Math.exp(-Math.max(0, after) * 6) * (after >= 0 ? 1 : 0));

    const sh = t < IMPACT ? SIDE * (0.5 + 0.6 * smoothstep((t - DESC_START) / (SLAM_START - DESC_START))) : SIDE * 1.15;
    this.shadow.scale.set(sh, sh, 1);
    this.shadow.material.opacity = 0.55 * smoothstep((t - DESC_START) / 0.6) * (1 - smoothstep((t - LIFT_START) / 0.7));

    // Jade qi sheds from the falling seal.
    if (dt > 0 && t > DESC_START && t < DESC_END + 0.05) {
      for (let i = 0; i < 2; i++) {
        this.trail.burst(1, new THREE.Vector3(
          c.x + (Math.random() - 0.5) * SIDE, sy + Math.random() * BLOCK_H, c.z + (Math.random() - 0.5) * SIDE,
        ));
      }
    }

    // --- Layer 5: impact. Impact frames (dark → light), corner glints, rings. ---
    this.screen.impact = impactFrameAt(t, IMPACT, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, IMPACT, 0.5, 12);
    this.screen.edgeTint.set(JADE_BODY);
    this.screen.speedLines = t < 1.0 ? 0 : t < IMPACT ? Math.min(0.45, (t - 1.0) * 1.8) : Math.max(0, 0.45 - after * 4);
    this.screen.focus.set(c.x, 1.4, c.z);

    this.corners.forEach((star, i) => {
      const a = yaw + Math.PI / 4 + (i * Math.PI) / 2;
      const r = (SIDE / 2) * Math.SQRT2;
      const pop = StarBurst.pop(after - 0.02, 0.06, 0.16);
      star.set(new THREE.Vector3(c.x + Math.sin(a) * r, 0.35, c.z + Math.cos(a) * r), 1.5 * pop.scale, pop.opacity, i);
    });

    const se = 1 - Math.pow(1 - THREE.MathUtils.clamp((after - 0.03) / 0.5, 0, 1), 3);
    this.shock.mesh.scale.setScalar(2.4 + 8 * se);
    this.shock.material.opacity = after > 0.03 && after < 0.53 ? 0.8 * (1 - (after - 0.03) / 0.5) : 0;
    // Screen distortion on the slam: same radius as the round shock ring, decays over 0.5 s.
    const rd = (after - 0.03) / 0.5;
    this.refract.set(c, 2.4 + 8 * se, after > 0.03 && rd < 1 ? 0.04 * (1 - rd) * (1 - rd) : 0);
    const qe = 1 - Math.pow(1 - THREE.MathUtils.clamp((after - 0.08) / 0.4, 0, 1), 3);
    this.shockSquare.mesh.scale.setScalar((SIDE / 2 + 0.12) * Math.SQRT2 + 5 * qe);
    this.shockSquare.material.opacity = after > 0.08 && after < 0.48 ? 0.7 * (1 - (after - 0.08) / 0.4) : 0;

    this.updatePlates(after);

    // --- Layer 6: the stamp burned into the ground, revealed as the seal lifts. ---
    const stampOp = after < 0 ? 0 : Math.min(1, after / 0.04) * (1 - smoothstep((t - STAMP_FADE) / (DURATION - STAMP_FADE)));
    this.stampMat.opacity = stampOp;
    const heat = after < 0 ? 1 : Math.exp(-Math.max(0, t - LIFT_START) * 2.2);
    this.stampMat.color.set(VERMILION).lerp(new THREE.Color(EMBER), heat * 0.8);
    this.stamp.visible = stampOp > 0.003;
    this.scorch.material.opacity = (after < 0 ? 0 : Math.min(1, after / 0.1) * 0.5) * (1 - smoothstep((t - STAMP_FADE) / (DURATION - STAMP_FADE)));
    this.emberRing.material.opacity = after < 0 ? 0 : 0.5 * Math.exp(-Math.max(0, t - LIFT_START) * 2) * (t > LIFT_START ? 1 : 0.6);

    // --- Layer 7: the seal dissolves into rising jade motes. ---
    const t0 = LIFT_END;
    const baseY = this.sealY(t0);
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const age = t - t0 - m.d;
      if (age < 0) {
        this.motePos[i * 3 + 1] = -50;
        continue;
      }
      this.motePos[i * 3] = c.x + m.x * (1 + 0.15 * age) + Math.sin(age * 2 + m.w) * 0.15;
      this.motePos[i * 3 + 1] = baseY + m.y + age * m.v;
      this.motePos[i * 3 + 2] = c.z + m.z * (1 + 0.15 * age) + Math.cos(age * 2 + m.w) * 0.15;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = 0.6 * smoothstep((t - t0) / 0.2) * (1 - smoothstep((t - 3.4) / 0.7));
    this.motes.visible = this.moteMat.opacity > 0.003;

    this.shake = after >= 0 ? 1.0 * Math.exp(-after * 6) : t > DESC_START && t < SLAM_START ? 0.02 : 0;
  }

  private updatePlates(after: number) {
    const c = this.center;
    const m = new THREE.Matrix4();
    const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3();
    for (let i = 0; i < PLATES; i++) {
      const s = this.plateSeed[i];
      if (after < 0) {
        m.compose(pos.set(0, -10, 0), q.identity(), sc.setScalar(1e-4));
        this.plates.setMatrixAt(i, m);
        continue;
      }
      // Distance from the centre to the square's edge along this (square-local) direction, plus a push outward.
      const local = s.a;
      const edge = (SIDE / 2) / Math.max(Math.abs(Math.cos(local)), Math.abs(Math.sin(local)));
      const r = edge + s.push;
      const a = local - this.yaw0;
      const grow = Math.min(1, after / 0.12);
      const phi = s.tilt * (1 - Math.pow(1 - Math.min(1, after / 0.3), 2));
      const sink = 2.4 * smoothstep((after - 0.7) / 1.1);
      const scale = Math.max(1e-4, s.size * (0.3 + 0.7 * grow) * (1 - smoothstep((after - 1.5) / 0.3)));
      qYaw.setFromAxisAngle(up, -a - Math.PI / 2);
      axis.set(-Math.sin(a), 0, Math.cos(a));
      qTilt.setFromAxisAngle(axis, phi);
      q.copy(qTilt).multiply(qYaw).multiply(qFlat);
      pos.set(c.x + Math.cos(a) * r, 0.02 - sink, c.z + Math.sin(a) * r);
      m.compose(pos, q, sc.setScalar(scale));
      this.plates.setMatrixAt(i, m);
    }
    this.plates.instanceMatrix.needsUpdate = true;
  }

  private onImpact() {
    this.impacted = true;
    const c = this.center;
    // Dust and sparks leave from the four corners, away from the stamp.
    for (let i = 0; i < 4; i++) {
      const a = this.yaw0 + Math.PI / 4 + (i * Math.PI) / 2;
      const r = (SIDE / 2) * Math.SQRT2;
      const p = new THREE.Vector3(c.x + Math.sin(a) * r, 0.3, c.z + Math.cos(a) * r);
      this.dust.burst(24, p);
      this.sparks.burst(50, p);
    }
    this.sparks.burst(80, new THREE.Vector3(c.x, 0.2, c.z).addScaledVector(new THREE.Vector3(Math.sin(this.yaw0), 0, Math.cos(this.yaw0)), SIDE / 2));
    this.leaf.burst(90, new THREE.Vector3(c.x, 0.6, c.z));
    const ctx = this.ctx;
    if (!ctx) return;
    // Knock away from a point on the caster's side of the target; never exactly on it.
    const away = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim)).multiplyScalar(-1);
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i] ?? c;
      const from = new THREE.Vector3(tp.x + away.x, 0, tp.z + away.z);
      if (from.distanceToSquared(tp) < 0.09) from.set(tp.x - 0.5, 0, tp.z + 0.5);
      ctx.hit(e, { damage: this.settings.damage, knock: 3, from });
    });
  }
}

export const jadeImperialSealModule: EffectModule = {
  label: 'jade imperial seal',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new JadeImperialSeal(),
  telegraphs(effect) {
    const e = effect as JadeImperialSeal;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2 }, start: FOOT_END, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as JadeImperialSeal;
    if (e.ctx) frameCast(camera, controls, e.ctx, SKY);
  },
  buildGui(f, effect) {
    const s = (effect as JadeImperialSeal).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
