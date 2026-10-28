import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Red Lotus Inferno (targeted, ground AoE r5): a ring of fire runes burns into the ground, then a giant fire lotus
 * (two rings of 8 flat-shaded petals with a black outline and a flame fringe) rises and opens to a cup, ticking the
 * enemies inside. The petals snap shut into a tall bud, hold one dead beat, and the bud erupts as a fire pillar over
 * a black core: impact frames, a cool star at the base, petals flying off to burn to ash, a few small lit smoke
 * balls, and a black lotus scorch print that fades last.
 *
 * Recipes: i-fire-rune-burn-in-eruption, h-stylizedstation-igni-cone-burst, h-beyondfx-botw-bomb-explosion.
 */
export interface RedLotusInfernoSettings {
  damage: number;
  loop: boolean;
}

export const defaultRedLotusInferno = (): RedLotusInfernoSettings => ({ damage: 55, loop: false });

const D = 2.05; // the bud bursts
const DURATION = 4.6;
const GLYPHS = 8;
const PER_RING = 8;
const ASH = 36;
const PILLAR_H = 24;

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const easeOutBack = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
const RAD = Math.PI / 180;

// Fire / phoenix value ladder (ART_BIBLE §2); the core colour is used in the star materials.
const C_HOT = new THREE.Color(0xffc247);
const C_BODY = new THREE.Color(0xff6a1f);
const C_RED = new THREE.Color(0xa8240f);
const C_DARK = new THREE.Color(0x3a0d0a);

/** Dark red base -> orange body -> gold tip. */
function petalColor(s: number, out: THREE.Color) {
  if (s < 0.2) return out.copy(C_DARK).lerp(C_RED, s / 0.2);
  if (s < 0.55) return out.copy(C_RED).lerp(C_BODY, (s - 0.2) / 0.35);
  return out.copy(C_BODY).lerp(C_HOT, clamp01((s - 0.55) / 0.4));
}

/** Half-width of the lotus petal at height s (length 1). */
function petalWidth(s: number) {
  return Math.max(0.03 * (1 - s), 0.27 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85));
}

const curl = (y: number) => -0.16 * y * y;

function finishGeometry(pos: number[], col?: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Flat-shaded lotus petal, length 1 along +Y, base at the origin, faceted into stripes with a darker left half. */
function petalGeometry(): THREE.BufferGeometry {
  const S = 8;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const push = (x: number, y: number, shade: number) => {
    pos.push(x, y, curl(y));
    petalColor(y, c).multiplyScalar(shade);
    col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < S; i++) {
    const y0 = i / S, y1 = (i + 1) / S;
    const w0 = petalWidth(y0), w1 = petalWidth(y1);
    const stripe = i % 2 ? 0.92 : 1;
    for (const side of [-1, 1]) {
      const sh = (side < 0 ? 0.74 : 1) * stripe;
      push(0, y0, sh * 0.85); push(side * w0, y0, sh); push(side * w1, y1, sh);
      push(0, y0, sh * 0.85); push(side * w1, y1, sh); push(0, y1, sh * 0.85);
    }
  }
  return finishGeometry(pos, col);
}

/** The black outline: the same silhouette, a little fatter and longer, pushed behind. */
function outlineGeometry(): THREE.BufferGeometry {
  const S = 8;
  const pos: number[] = [];
  const pt = (side: number, s: number): [number, number, number] => {
    const y = -0.035 + s * 1.09;
    return [side * (petalWidth(s) * 1.14 + 0.025), y, curl(y) - 0.012];
  };
  for (let i = 0; i < S; i++) {
    const a = i / S, b = (i + 1) / S;
    const l0 = pt(-1, a), l1 = pt(-1, b), r0 = pt(1, a), r1 = pt(1, b);
    pos.push(...l0, ...r0, ...r1, ...l0, ...r1, ...l1);
  }
  return finishGeometry(pos);
}

/** Short flame tongues along both petal edges: orange at the edge, black (= invisible when additive) at the tip. */
function fringeGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const edge = new THREE.Color(0xff8a2f), tip = new THREE.Color(0x000000);
  const tri = (a: number[], b: number[], t: number[]) => {
    for (const [p, k] of [[a, edge], [b, edge], [t, tip]] as [number[], THREE.Color][]) {
      pos.push(p[0], p[1], curl(p[1]) + 0.01);
      col.push(k.r, k.g, k.b);
    }
  };
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const s = 0.12 + k * 0.125 + (side > 0 ? 0.05 : 0);
      const lo = s - 0.05, hi = s + 0.05;
      tri([side * petalWidth(lo) * 0.96, lo], [side * petalWidth(hi) * 0.96, hi],
        [side * (petalWidth(s) + 0.085), s + 0.13 + (k % 2) * 0.04]);
    }
  }
  // One tall tongue off the tip.
  tri([-0.05, 0.9], [0.05, 0.9], [0, 1.2]);
  return finishGeometry(pos, col);
}

/** Hard-edged canvas glyph atlas (4x2): black outline, white fill (tinted by the material), thin core line. */
function glyphAtlas(): THREE.CanvasTexture {
  const cell = 128;
  const cv = document.createElement('canvas');
  cv.width = cell * 4; cv.height = cell * 2;
  const g = cv.getContext('2d');
  if (g) {
    g.lineCap = 'square';
    g.lineJoin = 'miter';
    for (let i = 0; i < GLYPHS; i++) {
      const ox = (i % 4) * cell, oy = Math.floor(i / 4) * cell;
      const segs: number[][] = [[0.5, 0.1, 0.5, 0.9]];
      if (i & 1) segs.push([0.5, 0.3, 0.2, 0.15], [0.5, 0.3, 0.8, 0.15]);
      else segs.push([0.2, 0.3, 0.8, 0.3]);
      if (i & 2) segs.push([0.5, 0.65, 0.22, 0.88]); else segs.push([0.25, 0.62, 0.75, 0.62]);
      if (i & 4) segs.push([0.5, 0.65, 0.78, 0.88]);
      segs.push([0.12, 0.1 + 0.05 * (i % 3), 0.12, 0.9], [0.88, 0.1, 0.88, 0.9 - 0.05 * (i % 3)]);
      const pass = (w: number, style: string) => {
        g.strokeStyle = style; g.lineWidth = w;
        g.beginPath();
        for (const s of segs) { g.moveTo(ox + s[0] * cell, oy + s[1] * cell); g.lineTo(ox + s[2] * cell, oy + s[3] * cell); }
        g.stroke();
      };
      pass(17, '#000000');
      pass(9, '#ffffff');
      pass(2.5, '#fff4d6');
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The black lotus scorch print: 16 petals, black fill, ember-red edge and veins. */
function scorchTexture(): THREE.CanvasTexture {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d');
  if (g) {
    g.translate(size / 2, size / 2);
    const petal = (angle: number, len: number, wid: number) => {
      g.save();
      g.rotate(angle);
      g.beginPath();
      g.moveTo(0, -len * 0.08);
      g.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len * 0.75, 0, -len);
      g.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.3, 0, -len * 0.08);
      g.closePath();
      g.fillStyle = '#050202'; g.fill();
      g.lineWidth = 7; g.strokeStyle = '#7a1a10'; g.stroke();
      g.beginPath(); g.moveTo(0, -len * 0.2); g.lineTo(0, -len * 0.82);
      g.lineWidth = 3; g.strokeStyle = '#a8240f'; g.stroke();
      g.restore();
    };
    for (let i = 0; i < PER_RING; i++) petal((i / PER_RING) * Math.PI * 2, 244, 86);
    for (let i = 0; i < PER_RING; i++) petal(((i + 0.5) / PER_RING) * Math.PI * 2, 168, 62);
    g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2);
    g.fillStyle = '#050202'; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#7a1a10'; g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Petal {
  yaw: THREE.Group;
  pivot: THREE.Group;
  body: THREE.Mesh;
  fringe: THREE.Mesh;
  inner: boolean;
  phase: number;
}

interface Ash {
  p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3;
  size: number; age: number; live: boolean; landed: boolean;
}

export class RedLotusInferno implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RedLotusInfernoSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ticked = [false, false];
  private burstDone = false;
  private smokeDone = false;
  private c = new THREE.Vector3();

  // Ground: runes, rings, centre disc, scorch print.
  private glyphs: { holder: THREE.Group; mat: THREE.MeshBasicMaterial }[] = [];
  private runeRing = createRing(0xff6a1f, 0.95, 1, 96);
  private runeRing2 = createRing(0xffc247, 0.97, 1, 6);
  private discMat = new THREE.MeshBasicMaterial({ color: 0x1a0605, transparent: true, opacity: 0, depthWrite: false });
  private disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), this.discMat);
  private scorchMat = new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.scorchMat);
  private shock = createRing(0xff8a2f, 0.9, 1, 96);
  private refract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 8, height: 8, scale: 4 });

  // Lotus.
  private lotus = new THREE.Group();
  private petals: Petal[] = [];
  private fringeMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });

  // Eruption.
  private pillar = new LightPillar(0xff6a1f, 1.3);
  private coreMat = new THREE.MeshBasicMaterial({ color: 0x1a0605, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), this.coreMat);
  private baseStar = new StarBurst({ points: 9, inner: 0.3, color: 0xffc247, core: 0xfff4d6, additive: false });
  private coolStar = new StarBurst({ points: 6, inner: 0.22, color: 0xbfe8ff, core: 0xffffff, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffc247, core: 0xfff4d6 });
  private smoke = new SmokeBall({ color: 0x120605, rim: 0x8a2a10, flake: 0x2a0d08, maxBalls: 6 });
  private ashMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private ash: THREE.InstancedMesh;
  private ashState: Ash[] = Array.from({ length: ASH }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
    size: 1, age: 0, live: false, landed: false,
  }));
  private embers: Emitter;
  private sparks: Emitter;
  private cinders: Emitter;

  constructor(settings: RedLotusInfernoSettings = defaultRedLotusInferno()) {
    this.settings = settings;
    this.screen.tint.set(0x4a2418);
    this.screen.impactColor.set(0xff6a1f);
    this.screen.speedLineColor.set(0xffc247);
    this.screen.edgeTint.set(0xff4f8b);

    // Runes.
    const atlas = glyphAtlas();
    const plane = new THREE.PlaneGeometry(1.15, 1.15);
    for (let i = 0; i < GLYPHS; i++) {
      const tex = atlas.clone();
      tex.needsUpdate = true;
      tex.repeat.set(0.25, 0.5);
      tex.offset.set((i % 4) * 0.25, 0.5 - Math.floor(i / 4) * 0.5);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x7a1a10, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      const holder = new THREE.Group();
      holder.add(mesh);
      this.group.add(holder);
      this.glyphs.push({ holder, mat });
    }
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.03;
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.035;
    this.runeRing.mesh.position.y = 0.05;
    this.runeRing2.mesh.position.y = 0.055;
    this.shock.mesh.position.y = 0.07;
    this.group.add(this.disc, this.scorch, this.runeRing.mesh, this.runeRing2.mesh, this.shock.mesh, this.refract.mesh, this.haze.mesh);

    // Lotus petals.
    const fill = petalGeometry(), line = outlineGeometry(), fringe = fringeGeometry();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x050202, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < PER_RING; i++) {
        const yaw = new THREE.Group();
        yaw.rotation.y = ((i + ring * 0.5) / PER_RING) * Math.PI * 2;
        const pivot = new THREE.Group();
        const body = new THREE.Mesh(fill, bodyMat);
        const fr = new THREE.Mesh(fringe, this.fringeMat);
        body.add(new THREE.Mesh(line, lineMat), fr);
        pivot.add(body);
        yaw.add(pivot);
        this.lotus.add(yaw);
        this.petals.push({ yaw, pivot, body, fringe: fr, inner: ring === 1, phase: i * 0.8 + ring * 1.7 });
      }
    }
    this.lotus.visible = false;
    this.group.add(this.lotus);

    // Eruption.
    this.core.renderOrder = 1;
    this.pillar.mesh.renderOrder = 2;
    this.core.visible = false;
    this.ash = new THREE.InstancedMesh(fill, this.ashMat, ASH);
    this.ash.frustumCulled = false;
    this.ash.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.pillar.mesh, this.core, this.baseStar.mesh, this.coolStar.mesh, this.glint.mesh, this.smoke.mesh, this.ash);

    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 2.2, speedJitter: 0.6, spread: 50, gravity: -2.2, drag: 0.6,
      sizeStart: 0.17, sizeEnd: 0, colorStart: '#ffc247', colorEnd: '#a8240f', colorMid: '#ff6a1f',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3, spin: 0.5,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 12, speedJitter: 0.6, spread: 80, gravity: 10, drag: 1.1,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffc247', colorEnd: '#a8240f',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small dark flakes: ash in the air, normal-blended.
    this.cinders = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 4, speedJitter: 0.6, spread: 90, gravity: 1.5, drag: 1.2,
      sizeStart: 0.28, sizeEnd: 0.06, colorStart: '#2a0d08', colorEnd: '#0a0303',
      opacityStart: 0.75, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.45, spin: 1.2, groundFade: 0.2,
    });
    this.emitters.push(this.embers, this.sparks, this.cinders, this.smoke.emitter);
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
    this.c.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.c).setY(1.5);
    this.lotus.position.copy(this.c);
    GLYPH_ANGLES.forEach((a, i) => {
      const h = this.glyphs[i].holder;
      h.position.set(this.c.x + Math.sin(a) * 4.0, 0, this.c.z + Math.cos(a) * 4.0);
      h.rotation.y = a;
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.ticked = [false, false];
    this.burstDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const a of this.ashState) { a.live = false; a.p.set(0, -50, 0); }
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const ctx = this.ctx;
    const t = this.time;
    if (ctx) {
      [1.0, 1.4].forEach((tt, i) => {
        if (!this.ticked[i] && t >= tt) {
          this.ticked[i] = true;
          for (const e of ctx.targets) ctx.hit(e, { damage: 6, knock: 0, from: this.c });
        }
      });
    }
    if (!this.burstDone && t >= D) this.onBurst();
    if (!this.smokeDone && t >= D + 0.12) this.onSmoke();
    // Embers rise off the open lotus; none during the dead beat.
    if (dtSafe(dt) && t > 0.85 && t < 1.95) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 3.4;
        this.embers.burst(1, new THREE.Vector3(this.c.x + Math.sin(a) * r, 0.5 + Math.random() * 0.6, this.c.z + Math.cos(a) * r));
      }
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const c = this.c;
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.7);
    const bursted = t >= D;

    // --- World grade: dim for the build-up, a touch darker as it closes, release after the hit. ---
    this.screen.darken = !bursted
      ? (0.65 + 0.15 * smoothstep((t - 1.6) / 0.4)) * smoothstep(t / 0.5)
      : 0.8 * Math.exp(-after * 1.1) * fade;

    // --- Fire runes burn in one by one (dark red -> orange), the rings draw in behind them. ---
    const runeOut = bursted ? Math.exp(-after * 7) : 1;
    this.glyphs.forEach((g, i) => {
      const k = clamp01((t - 0.05 - i * 0.065) / 0.14);
      g.mat.opacity = k * 0.95 * runeOut;
      g.mat.color.copy(new THREE.Color(0x7a1a10)).lerp(C_BODY, clamp01((t - 0.2 - i * 0.065) / 0.3));
    });
    const ringK = smoothstep(t / 0.6);
    this.runeRing.mesh.position.set(c.x, 0.05, c.z);
    this.runeRing.mesh.scale.setScalar(Math.max(1e-3, 5 * ringK));
    this.runeRing.mesh.rotation.z = t * 0.5;
    this.runeRing.material.opacity = 0.6 * ringK * runeOut;
    this.runeRing2.mesh.position.set(c.x, 0.055, c.z);
    this.runeRing2.mesh.scale.setScalar(Math.max(1e-3, 3.3 * ringK));
    this.runeRing2.mesh.rotation.z = -t * 0.8;
    this.runeRing2.material.opacity = 0.5 * ringK * runeOut;
    this.disc.position.set(c.x, 0.03, c.z);
    this.discMat.opacity = 0.9 * smoothstep((t - 0.3) / 0.4) * (bursted ? Math.exp(-after * 3) : 1);

    // --- The lotus: rise and open (0.7-1.1), ripple, snap shut into a bud (1.6-1.95), hold, burst. ---
    this.lotus.visible = t >= 0.7 && !bursted;
    const open = smoothstep((t - 0.7) / 0.5);
    const grow = easeOutBack((t - 0.7) / 0.45);
    const shut = Math.pow(clamp01((t - 1.6) / 0.35), 2.2);
    const shiver = t > 1.95 ? 0.012 * Math.sin(t * 90) : 0;
    this.fringeMat.opacity = 0.95 * open * (1 - shut) * (t > 1.93 ? 0 : 1);
    for (const p of this.petals) {
      const maxAng = (p.inner ? 24 : 46) * RAD;
      const r0 = p.inner ? 0.6 : 1.0;
      const len = p.inner ? 3.4 : 4.4;
      const ripple = Math.sin(t * 5.5 + p.phase) * 0.07 * open * (1 - shut);
      const ang = THREE.MathUtils.lerp(5 * RAD, maxAng, open) + ripple;
      const closed = (p.inner ? 2 : 7) * RAD;
      p.pivot.position.z = THREE.MathUtils.lerp(r0, 0.3, shut);
      p.pivot.rotation.x = THREE.MathUtils.lerp(ang, closed, shut) + shiver;
      const lenK = Math.max(0.02, grow) * len * THREE.MathUtils.lerp(1, p.inner ? 1.38 : 1.27, shut);
      const widK = THREE.MathUtils.lerp(1, 0.78, shut);
      p.body.scale.set(Math.max(1e-3, lenK * widK), Math.max(1e-3, lenK), Math.max(1e-3, lenK));
      const flick = 1 + 0.14 * Math.sin(t * 17 + p.phase * 3);
      p.fringe.scale.set(1, flick, 1);
    }

    // --- Eruption: black core under a fire pillar that collapses to a line + star. ---
    if (bursted) {
      const up = 1 - Math.pow(1 - Math.min(1, after / 0.14), 3);
      const col = smoothstep((after - 0.55) / 0.7);
      const h = Math.max(0.05, PILLAR_H * up * (1 - 0.82 * col));
      const rad = Math.max(0.05, 1 - 0.86 * col);
      const pop = 0.8 * (1 - smoothstep((after - 1.1) / 0.45));
      this.pillar.set(c.x, c.z, 0, h, pop);
      this.pillar.mesh.scale.x = rad;
      this.pillar.mesh.scale.z = rad;
      const coreA = 0.9 * (1 - smoothstep((after - 0.8) / 0.4));
      this.coreMat.opacity = coreA;
      this.core.visible = coreA > 0.01;
      this.core.position.set(c.x, h / 2, c.z);
      this.core.scale.set(Math.max(1e-3, 0.55 * rad), Math.max(1e-3, h), Math.max(1e-3, 0.55 * rad));

      // Stars: cool one for 2 frames, a hard gold one, a glint riding the collapsing line.
      const hot = StarBurst.pop(after, 0.07, 0.2);
      this.baseStar.set(new THREE.Vector3(c.x, 1.3, c.z), 5.5 * hot.scale, hot.opacity, 0.2);
      const cool = StarBurst.pop(after, 0.012, 0.03);
      this.coolStar.set(new THREE.Vector3(c.x, 0.9, c.z), 3.2 * cool.scale, cool.opacity, 0.5);
      const gl = StarBurst.pop(after - 0.8, 0.12, 0.3);
      this.glint.set(new THREE.Vector3(c.x, h + 0.3, c.z), 1.5 * gl.scale, gl.opacity, t * 2);

      this.shock.mesh.position.set(c.x, 0.07, c.z);
      this.shock.mesh.scale.setScalar(Math.max(1e-3, 1 + after * 16));
      this.shock.material.opacity = Math.max(0, 0.75 * (1 - after / 0.5));

      const rp = clamp01(after / 0.5);
      this.refract.set(c, Math.max(1e-3, 1 + after * 16), after < 0.5 ? 0.05 * (1 - rp) * (1 - rp) : 0);
      // Heat shimmer over the fire pillar, fading as it collapses.
      this.haze.set(c, 0.016 * (1 - smoothstep((after - 0.4) / 1.6)) * fade, t, 1.5);

      this.screen.impact = impactFrameAt(t, D, [1, 2]);
      this.screen.chroma = chromaPulse(t, D);
      this.screen.speedLines = Math.max(0, 0.9 - after * 5);
      this.shake = 0.9 * Math.exp(-after * 6);
    } else {
      this.pillar.set(c.x, c.z, 0, 1, 0);
      this.core.visible = false;
      this.baseStar.set(c, 0, 0);
      this.coolStar.set(c, 0, 0);
      this.glint.set(c, 0, 0);
      this.shock.material.opacity = 0;
      this.refract.set(c, 0, 0);
      this.haze.set(c, 0, t, 1);
      this.screen.impact = 0;
      this.screen.chroma = 0;
      // Implode: focus lines pull in over the close.
      this.screen.speedLines = t > 1.6 ? 0.9 * smoothstep((t - 1.6) / 0.35) : 0;
      this.shake = t > 1.6 ? 0.05 * (1 - shut) + 0.03 : 0;
    }

    // --- Scorch print: appears on the burst, fades last. ---
    this.scorch.position.set(c.x, 0.035, c.z);
    this.scorchMat.opacity = bursted ? 0.9 * smoothstep(after / 0.15) * fade : 0;

    // --- Ash petals: fly off outward, tumble, burn to ash, land. ---
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    for (let i = 0; i < ASH; i++) {
      const a = this.ashState[i];
      if (a.live && dt > 0) {
        a.age += dt;
        a.v.y -= 15 * dt;
        a.v.x *= 1 - 0.8 * dt; a.v.z *= 1 - 0.8 * dt;
        a.p.addScaledVector(a.v, dt);
        if (a.p.y < 0.08) { a.p.y = 0.08; a.v.set(0, 0, 0); a.w.set(0, 0, 0); a.landed = true; }
        a.r.set(a.r.x + a.w.x * dt, a.r.y + a.w.y * dt, a.r.z + a.w.z * dt);
      }
      const burn = clamp01((a.age - 0.1) / 1.0);
      col.copy(C_HOT).lerp(C_BODY, clamp01(burn * 2)).lerp(C_DARK, clamp01(burn * 2 - 0.6));
      this.ash.setColorAt(i, col);
      const sc = a.live ? Math.max(1e-4, a.size * (1 - smoothstep((a.age - 1.8) / 0.8)) * fade) : 1e-4;
      m.compose(a.p, q.setFromEuler(a.r), new THREE.Vector3().setScalar(sc));
      this.ash.setMatrixAt(i, m);
    }
    this.ash.instanceMatrix.needsUpdate = true;
    if (this.ash.instanceColor) this.ash.instanceColor.needsUpdate = true;
  }

  private onBurst() {
    this.burstDone = true;
    const c = this.c;
    this.sparks.burst(520, new THREE.Vector3(c.x, 0.6, c.z));
    this.embers.burst(160, new THREE.Vector3(c.x, 0.8, c.z));
    this.cinders.burst(90, new THREE.Vector3(c.x, 0.6, c.z));
    this.ashState.forEach((a, i) => {
      const ang = (i / ASH) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.8 + Math.random() * 2.4;
      const sp = 4 + Math.random() * 7;
      a.p.set(c.x + Math.sin(ang) * r, 0.5 + Math.random() * 1.5, c.z + Math.cos(ang) * r);
      a.v.set(Math.sin(ang) * sp, 5 + Math.random() * 9, Math.cos(ang) * sp);
      a.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      a.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      a.size = 1.0 + Math.random() * 0.9;
      a.age = 0; a.live = true; a.landed = false;
    });
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 6, from: c });
  }

  private onSmoke() {
    this.smokeDone = true;
    const c = this.c;
    this.smoke.trigger(new THREE.Vector3(c.x, 0.8, c.z), 1.2, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      this.smoke.trigger(new THREE.Vector3(c.x + Math.sin(a) * 2.6, 0.6, c.z + Math.cos(a) * 2.6), 0.9, 0.8);
    }
  }
}

const GLYPH_ANGLES = Array.from({ length: GLYPHS }, (_, i) => (i / GLYPHS) * Math.PI * 2 + Math.PI / 8);
const dtSafe = (dt: number) => dt > 0;

export const redLotusInfernoModule: EffectModule = {
  label: 'red lotus inferno',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 5 },
  create: () => new RedLotusInferno(),
  telegraphs(effect) {
    const e = effect as RedLotusInferno;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: 5 }, start: 0.7, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as RedLotusInferno;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as RedLotusInferno).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
