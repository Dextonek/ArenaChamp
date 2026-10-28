import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, mergeParts, smoothstep } from '../../effects/common';
import {
  LightningArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thunder God Drums (targeted, ground AoE, 5.5 m): the world goes dark and a ring of eight floating war drums
 * (black lacquer barrels, gold rims and studs, one violet glowing drumhead each) fades in over the area, tilted
 * toward the caster so the heads face the camera. They roll in order round the ring, faster and faster: each beat
 * flashes its head, pops a ripple off it and drops a bolt (with a black under-copy) onto a ground spark, with small
 * branching arcs and a scorch left behind. Dead beat: the ring stops and the drums tilt in toward the centre.
 * Then all eight beat at once: violet impact frames, eight bolts converge on the centre (living on single frames
 * like the Taiji seal), a cyan star for two frames, a ground discharge and a toon smoke ring. The drums drift up
 * and fade body first, leaving gold rims, and the bolts evaporate into dashes.
 *
 * Recipes: a-dota-zeus-thundergods-wrath (instant thick bolts, ground pre-spark), c-electric-blast-branching-ground
 * (branching arcs along the ground after each bolt), f-moa-storm-call (a storm channel with an escalating rhythm).
 */
export interface ThunderGodDrumsSettings {
  damage: number;
  loop: boolean;
}

export const defaultThunderGodDrums = (): ThunderGodDrumsSettings => ({ damage: 45, loop: false });

const D = 2.6; // all eight beat at once
const DURATION = 4.8;
const DRUMS = 8;
const RING_Y = 7;
const RING_R = 4;
const AREA_R = 5.5;
const DRUM_S = 1.45;
const POOL = 3; // bolt slots reused by the roll
const FRAME = 0.04; // one "lightning frame"
const TAU = Math.PI * 2;
const SPARK_LEAD = 0.14;

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Runs fn with a deterministic Math.random, so two LightningArcs with equal options roll the same path. */
function seeded(seed: number, fn: () => void) {
  const orig = Math.random;
  let s = (seed * 2654435761) >>> 0 || 1;
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  try { fn(); } finally { Math.random = orig; }
}

/** Ring spin angle: slow, accelerating with the roll, easing to a stop in the dead beat. */
function spinAngle(t: number) {
  const a = Math.min(t, 2.4);
  const u = Math.max(0, a - 0.6);
  let ang = 0.5 * a + 0.45 * u * u;
  if (t > 2.4) {
    const s = THREE.MathUtils.clamp((t - 2.4) / 0.2, 0, 1);
    ang += (0.5 + 0.9 * u) * 0.2 * (s - (s * s) / 2);
  }
  return ang;
}

/** The roll: beat times starting at 0.65 s, gaps shrinking from 0.30 s to 0.12 s. */
function beatTimes(): number[] {
  const out: number[] = [];
  let t = 0.65;
  while (t < 2.34) {
    out.push(t);
    t += 0.3 - 0.18 * smoothstep((t - 0.65) / 1.7);
  }
  return out;
}

/** Drumhead: hard edges, black outline, a value ramp from black through violet to a pale three-comma crest. */
function drumHeadTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const disc = (r: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(256, 256, r, 0, TAU);
    g.fill();
  };
  disc(252, '#07030c'); // black outline
  disc(238, '#2a1660');
  disc(214, '#120a24'); // dark band
  disc(202, '#4a2aa8');
  disc(166, '#07030c');
  disc(158, '#7a4df0');
  disc(128, '#9b6bff');
  // Cyan rivet dots, a small accent on the dark band.
  g.fillStyle = '#5fe3ff';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    g.beginPath();
    g.arc(256 + Math.cos(a) * 226, 256 + Math.sin(a) * 226, 5, 0, TAU);
    g.fill();
  }
  // Three-comma crest (stroke the union first, then fill it).
  const u = (a: number, r: number, c = 256) => ({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU - Math.PI / 2;
    const h = u(a, 66);
    const hr = 38;
    const b1 = { x: h.x + Math.cos(a + Math.PI / 2) * hr, y: h.y + Math.sin(a + Math.PI / 2) * hr };
    const tip = u(a + 1.55, 112);
    const ctl = u(a + 0.95, 128);
    const b2 = { x: h.x + Math.cos(a + 0.2) * hr, y: h.y + Math.sin(a + 0.2) * hr };
    const ctl2 = u(a + 0.7, 62);
    const p = new Path2D();
    p.arc(h.x, h.y, hr, 0, TAU);
    p.moveTo(b1.x, b1.y);
    p.quadraticCurveTo(ctl.x, ctl.y, tip.x, tip.y);
    p.quadraticCurveTo(ctl2.x, ctl2.y, b2.x, b2.y);
    p.closePath();
    g.strokeStyle = '#07030c';
    g.lineWidth = 12;
    g.stroke(p);
    g.fillStyle = '#e6dcff';
    g.fill(p);
  }
  disc(20, '#07030c');
  disc(12, '#5fe3ff');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Studs on the barrel: three rows of small gold spheres, merged into one geometry shared by all drums. */
function studGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rows: [number, number, number][] = [[0.3, 0.59, 18], [-0.3, 0.59, 18], [0, 0.68, 14]];
  for (const [y, r, n] of rows) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const s = new THREE.SphereGeometry(0.05, 6, 4);
      s.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      parts.push(s);
    }
  }
  return mergeParts(parts);
}

interface Beat {
  t: number;
  drum: number;
  slot: number;
  done: boolean;
  spot: THREE.Vector3;
  ang: number[];
}

interface Slot {
  bolt: LightningArc;
  black: LightningArc;
  thin: LightningArc;
  ground: LightningArc[];
  glint: StarBurst;
  key: number;
}

interface FinalBolt {
  bolt: LightningArc;
  black: LightningArc;
  thin: LightningArc;
}

interface Drum {
  g: THREE.Group;
  headMat: THREE.MeshBasicMaterial;
  ripple: ReturnType<typeof createRing>;
}

const DASH_U: [number, number][] = [[0.1, 0.24], [0.36, 0.5], [0.62, 0.76], [0, 0.08], [0.92, 1], [0.02, 0.09]];
const NOVA = 8;

export class ThunderGodDrums implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThunderGodDrumsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private struck = false;
  private smokeDone = false;
  private finalKey = -2;
  private center = new THREE.Vector3();
  private ringQuat = new THREE.Quaternion();
  private beats: Beat[] = beatTimes().map((t, i) => ({
    t, drum: i % DRUMS, slot: i % POOL, done: false, spot: new THREE.Vector3(), ang: [0, 0, 0],
  }));

  // Drums.
  private ring = new THREE.Group();
  private drums: Drum[] = [];
  private headW: THREE.Vector3[] = Array.from({ length: DRUMS }, () => new THREE.Vector3());
  private lacquer = new THREE.MeshStandardMaterial({
    color: 0x1c1b18, metalness: 0.3, roughness: 0.3, emissive: 0x000000, emissiveIntensity: 0,
    transparent: true, side: THREE.DoubleSide,
  });
  private gold = new THREE.MeshStandardMaterial({
    color: 0xa8873c, metalness: 0.35, roughness: 0.5, emissive: 0x000000, emissiveIntensity: 0, transparent: true,
  });

  // Roll bolts.
  private slots: Slot[] = [];
  private scorches: THREE.Mesh[] = [];
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false });

  // Final strike.
  private finals: FinalBolt[] = [];
  private nova: LightningArc[] = [];
  private centerGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x5fe3ff, core: 0xe6dcff });
  private darkStar = new StarBurst({ points: 12, color: 0x07030c, core: 0x2a1660, additive: false });
  private star = new StarBurst({ points: 12, color: 0x5fe3ff, core: 0xe6dcff, additive: false });
  private areaRing = createRing(0x9b6bff, 0.985, 1, 128);
  private diamond = createRing(0x9b6bff, 0.93, 1, 4);
  private shock = createRing(0x9b6bff, 0.9, 1, 128);
  private refract = new ShockRefraction({ facing: 'ground' });
  private shock2 = createRing(0x5fe3ff, 0.96, 1, 128);
  private bigScorchMat = new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false });
  private bigScorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.bigScorchMat);
  private smoke = new SmokeBall({ color: 0x1a1626, rim: 0x4a3f66, flake: '#2a2236', maxBalls: 6 });
  private haze: Emitter;
  private sparks: Emitter;
  private allArcs: LightningArc[] = [];

  constructor(settings: ThunderGodDrumsSettings = defaultThunderGodDrums()) {
    this.settings = settings;
    this.screen.tint.set(0x120a24);
    this.screen.impactColor.set(0x9b6bff);
    this.screen.speedLineColor.set(0xe6dcff);
    this.screen.edgeTint.set(0x5fe3ff);

    // --- Drums: lacquer barrel, gold rims / band / studs, one glowing head. ---
    const barrel = new THREE.LatheGeometry([
      new THREE.Vector2(0.54, -0.36), new THREE.Vector2(0.6, -0.24), new THREE.Vector2(0.66, -0.1),
      new THREE.Vector2(0.67, 0), new THREE.Vector2(0.66, 0.1), new THREE.Vector2(0.6, 0.24), new THREE.Vector2(0.54, 0.36),
    ], 32);
    const rimGeo = new THREE.TorusGeometry(0.55, 0.055, 8, 40);
    rimGeo.rotateX(Math.PI / 2);
    const bandGeo = new THREE.TorusGeometry(0.675, 0.03, 6, 40);
    bandGeo.rotateX(Math.PI / 2);
    const studs = studGeometry();
    const bottomGeo = new THREE.CircleGeometry(0.56, 32);
    bottomGeo.rotateX(Math.PI / 2);
    bottomGeo.translate(0, -0.35, 0);
    const headGeo = new THREE.CircleGeometry(0.57, 48);
    headGeo.rotateX(-Math.PI / 2);
    headGeo.translate(0, 0.375, 0);
    const headTex = drumHeadTexture();
    const rippleGeo = new THREE.RingGeometry(0.9, 1, 48);
    for (let i = 0; i < DRUMS; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(barrel, this.lacquer), new THREE.Mesh(bottomGeo, this.lacquer));
      const top = new THREE.Mesh(rimGeo, this.gold);
      top.position.y = 0.36;
      const bot = new THREE.Mesh(rimGeo, this.gold);
      bot.position.y = -0.36;
      g.add(top, bot, new THREE.Mesh(bandGeo, this.gold), new THREE.Mesh(studs, this.gold));
      const headMat = new THREE.MeshBasicMaterial({
        map: headTex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.renderOrder = 2;
      g.add(head);
      const ripple = createRing(0xe6dcff, 0.9, 1, 48);
      ripple.mesh.geometry = rippleGeo;
      ripple.mesh.position.y = 0.4;
      g.add(ripple.mesh);
      g.visible = false;
      this.ring.add(g);
      this.drums.push({ g, headMat, ripple });
    }
    this.group.add(this.ring);

    // --- Roll bolt pool: bright + black copy + thin frame + branching ground arcs + spark glint. ---
    const mk = (width: number, core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, segs: number, branches: number, black = false) => {
      const a = new LightningArc({ width, segments: segs, jitter: 0.09, branches, rerollEvery: 1e9, dropChance: 0, core, glow });
      if (black) {
        (a.mesh.material as THREE.ShaderMaterial).blending = THREE.NormalBlending;
        a.mesh.renderOrder = 3;
      } else a.mesh.renderOrder = 4;
      this.allArcs.push(a);
      this.group.add(a.mesh);
      return a;
    };
    for (let s = 0; s < POOL; s++) {
      const ground: LightningArc[] = [];
      for (let k = 0; k < 3; k++) {
        const a = new LightningArc({ width: 0.16, segments: 8, jitter: 0.1, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.05, dropChance: 0.15 });
        a.mesh.renderOrder = 4;
        this.allArcs.push(a);
        this.group.add(a.mesh);
        ground.push(a);
      }
      const glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x5fe3ff, core: 0xe6dcff });
      this.group.add(glint.mesh);
      this.slots.push({
        black: mk(0.78, 0x120a24, 0x05040a, 14, 3, true),
        bolt: mk(0.34, 0xffffff, 0x6a45c0, 14, 3),
        thin: mk(0.14, 0xffffff, 0xe6dcff, 14, 1),
        ground, glint, key: -1,
      });
    }
    for (let i = 0; i < this.beats.length; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), this.scorchMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.03;
      m.visible = false;
      this.scorches.push(m);
      this.group.add(m);
    }

    // --- Final strike: eight converging bolts (each on single frames), ground nova. ---
    for (let i = 0; i < DRUMS; i++) {
      this.finals.push({
        black: mk(1.1, 0x120a24, 0x05040a, 16, 4, true),
        bolt: mk(0.5, 0xffffff, 0x6a45c0, 16, 4),
        thin: mk(0.22, 0xffffff, 0xe6dcff, 16, 1),
      });
    }
    for (let i = 0; i < NOVA; i++) {
      const a = new LightningArc({ width: 0.2, segments: 10, jitter: 0.1, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0.2 });
      a.mesh.renderOrder = 4;
      this.allArcs.push(a);
      this.nova.push(a);
      this.group.add(a.mesh);
    }

    this.bigScorch.rotation.x = -Math.PI / 2;
    this.bigScorch.position.y = 0.03;
    this.bigScorch.visible = false;
    this.darkStar.mesh.renderOrder = 5;
    this.star.mesh.renderOrder = 6;
    this.group.add(
      this.bigScorch, this.areaRing.mesh, this.diamond.mesh, this.shock.mesh, this.shock2.mesh,
      this.centerGlint.mesh, this.darkStar.mesh, this.star.mesh, this.smoke.mesh, this.refract.mesh,
    );

    // Storm haze: dark, normal-blended, eroded, gathering over the area.
    this.haze = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 3.5, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0, drag: 0.8,
      sizeStart: 2.6, sizeEnd: 4.2, colorStart: '#2a1a40', colorEnd: '#120a24',
      opacityStart: 0.26, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 10, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#e6dcff', colorEnd: '#5fe3ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#9b6bff', sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.haze, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    // Ring plane normal: mostly up, leaning ~40 degrees toward the caster so the drumheads face the camera.
    const k = (40 * Math.PI) / 180;
    const n = new THREE.Vector3(-Math.sin(ctx.aim) * Math.sin(k), Math.cos(k), -Math.cos(ctx.aim) * Math.sin(k));
    this.ringQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.ring.quaternion.copy(this.ringQuat);
    // Random spots in the area, spread out so consecutive bolts do not stack.
    const placed: THREE.Vector3[] = [];
    for (const b of this.beats) {
      let best = new THREE.Vector3();
      let bestD = -1;
      for (let tries = 0; tries < 8; tries++) {
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * (AREA_R - 1);
        const p = new THREE.Vector3(this.center.x + Math.cos(a) * r, 0, this.center.z + Math.sin(a) * r);
        const dmin = placed.slice(-3).reduce((m, q) => Math.min(m, q.distanceTo(p)), 99);
        if (dmin > bestD) { bestD = dmin; best = p; }
      }
      placed.push(best);
      b.spot.copy(best);
      b.ang = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.center.x, 1, this.center.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.struck = false;
    this.smokeDone = false;
    this.finalKey = -2;
    this.shake = 0;
    for (const b of this.beats) b.done = false;
    for (const s of this.slots) s.key = -1;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.haze.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    let ended = false;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      ended = true;
    }
    const t = this.time;
    const c = this.center;
    if (dt > 0 && this.ctx && t < D - 0.1) this.haze.burst(t < 0.5 ? 4 : 2, new THREE.Vector3(c.x, RING_Y + 3, c.z));
    for (const b of this.beats) if (!b.done && t >= b.t) this.onBeat(b);
    if (!this.struck && t >= D) this.onStrike();
    if (!this.smokeDone && t >= D + 0.35) this.onSmoke();
    for (const a of this.allArcs) a.update(dt);
    this.layout(dt);
    if (ended) clearScreenFx(this.screen);
  }

  private pair(bright: LightningArc, black: LightningArc, a: THREE.Vector3, b: THREE.Vector3, seed: number) {
    bright.setEnds(a, b);
    black.setEnds(a, b);
    // Same seed and options: the black copy follows exactly the bright path, only wider.
    seeded(seed, () => bright.reroll());
    seeded(seed, () => black.reroll());
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - D;
    const struck = t >= D;
    const ctx = this.ctx;
    const has = !!ctx;
    const c = this.center;
    const tmp = new THREE.Vector3();

    // --- 1. World: darkens, holds until the strike, releases. Speed lines pull in during the dead beat. ---
    this.screen.darken = has ? (t < D ? 0.8 * smoothstep(t / 0.6) : 0.8 * Math.exp(-Math.max(0, after - 0.5) * 2.2)) : 0;
    this.screen.speedLines = has ? (t < D ? 0.8 * smoothstep((t - 2.2) / 0.4) : Math.max(0, 0.8 - after * 8)) : 0;
    this.screen.impact = has ? impactFrameAt(t, D, [1, 2], 0.04) : 0;
    this.screen.chroma = has ? chromaPulse(t, D, 0.6, 9) : 0;

    // --- 2. Drums. ---
    const inFade = smoothstep(t / 0.45);
    const bodyOp = inFade * (1 - smoothstep((after - 0.2) / 0.7));
    const goldOp = inFade * (1 - smoothstep((after - 1.2) / 0.7));
    const headOp = inFade * (1 - smoothstep((after - 0.1) / 0.6));
    this.lacquer.opacity = bodyOp;
    this.gold.opacity = goldOp;
    const spin = spinAngle(t);
    const inw = smoothstep((t - 2.4) / 0.15);
    const R = RING_R * (1 - 0.1 * inw);
    const lift = 2.2 * smoothstep(after / 1.6);
    this.ring.position.set(c.x, RING_Y + lift, c.z);
    this.ring.visible = has && t > 0 && goldOp > 0.003;
    const dir = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const charge = smoothstep((t - 2.4) / 0.2);
    for (let i = 0; i < DRUMS; i++) {
      const dr = this.drums[i];
      const th = (i / DRUMS) * TAU + spin;
      const ct = Math.cos(th), st = Math.sin(th);
      // Heads face up (toward the camera, since the ring leans to the caster); in the dead beat they tilt in.
      dir.set(ct * 0.15 * (1 - inw) - ct * 0.7 * inw, 1 * (1 - inw) + 0.7 * inw, st * 0.15 * (1 - inw) - st * 0.7 * inw).normalize();
      let lastT = -9;
      for (const b of this.beats) if (t >= b.t && b.drum === i) lastT = b.t;
      if (t >= D) lastT = D;
      const age = t - lastT;
      const fl = lastT > -8 ? Math.exp(-age * 9) : 0;
      const appear = THREE.MathUtils.clamp((t - i * 0.04) / 0.45, 0, 1);
      const sc = Math.max(1e-4, DRUM_S * (0.4 + 0.6 * smoothstep(appear)) * (1 + 0.07 * Math.sin(Math.PI * appear)) * (1 + 0.1 * fl));
      pos.set(ct * R, 0, st * R).addScaledVector(dir, -0.14 * fl * DRUM_S);
      dr.g.position.copy(pos);
      dr.g.quaternion.setFromUnitVectors(up, dir);
      dr.g.scale.setScalar(sc);
      dr.g.visible = has && appear > 0.001;
      dr.headMat.opacity = headOp;
      dr.headMat.color.setScalar(0.5 + 0.9 * fl + 0.45 * charge * (0.8 + 0.2 * Math.sin(t * 40)));
      // Ripple popping off the head.
      const ra = lastT > -8 ? age : 9;
      dr.ripple.mesh.scale.setScalar(Math.max(1e-4, 0.55 + ra * 3.2));
      dr.ripple.material.opacity = ra < 0.3 ? 0.55 * (1 - ra / 0.3) : 0;
      // Head centre in world space (bolt origin).
      this.headW[i].copy(pos).addScaledVector(dir, 0.4 * sc).applyQuaternion(this.ringQuat).add(this.ring.position);
    }

    // --- 3. Ground telegraph: area ring, diamond that implodes in the dead beat. ---
    const areaOp = has ? (t < D ? 0.4 * smoothstep((t - 0.5) / 0.4) : 0.7 * Math.exp(-after * 8)) : 0;
    this.areaRing.mesh.position.set(c.x, 0.05, c.z);
    this.areaRing.mesh.scale.setScalar(AREA_R);
    this.areaRing.material.opacity = areaOp;
    this.diamond.mesh.position.set(c.x, 0.05, c.z);
    this.diamond.mesh.rotation.z = t * 0.9;
    this.diamond.mesh.scale.setScalar(Math.max(1e-4, 3.4 * (1 - 0.75 * charge)));
    this.diamond.material.opacity = has ? (t < D ? (0.25 + 0.4 * charge) * smoothstep((t - 0.6) / 0.4) : 0.6 * Math.exp(-after * 10)) : 0;

    // --- 4. The roll: spark on the ground, bolt on single frames, branching arcs, scorch. ---
    const a0 = new THREE.Vector3(), b0 = new THREE.Vector3();
    this.slots.forEach((sl, si) => {
      let bi = -1;
      this.beats.forEach((b, j) => { if (b.slot === si && t >= b.t - SPARK_LEAD) bi = j; });
      const b = bi >= 0 ? this.beats[bi] : null;
      const bAge = b ? t - b.t : -9;
      // Pre-spark.
      const glintOn = has && b && bAge < 0;
      sl.glint.set(
        tmp.set(b?.spot.x ?? 0, 0.25, b?.spot.z ?? 0),
        0.5 + 0.5 * ((bAge + SPARK_LEAD) / SPARK_LEAD), glintOn ? 0.9 : 0, t * 6,
      );
      // Bolt frames: thick, thin, thick, thin.
      const f = has && b && bAge >= 0 && bAge < FRAME * 4 ? Math.floor(bAge / FRAME) : -1;
      const key = f >= 0 ? bi * 10 + f : -1;
      if (f >= 0) {
        a0.copy(this.headW[b!.drum]);
        b0.set(b!.spot.x, 0.2, b!.spot.z);
        if (key !== sl.key) {
          this.pair(sl.bolt, sl.black, a0, b0, 5 + bi * 31 + f * 7);
          sl.thin.setEnds(a0, b0);
          sl.thin.reroll();
        } else {
          sl.bolt.setEnds(a0, b0);
          sl.black.setEnds(a0, b0);
          sl.thin.setEnds(a0, b0);
        }
      }
      sl.key = key;
      const thick = f === 0 || f === 2;
      sl.bolt.opacity = thick ? 0.85 : 0;
      sl.black.opacity = thick ? 0.9 : 0;
      sl.thin.opacity = f === 1 || f === 3 ? 1 : 0;
      // Branching ground arcs crawl out from the hit and die.
      sl.ground.forEach((arc, k) => {
        if (!has || !b || bAge < 0 || bAge > 0.34) { arc.opacity = 0; return; }
        const ang = b.ang[k];
        const far = 0.5 + 1.9 * smoothstep(bAge / 0.15);
        const near = 0.2 + 1.2 * smoothstep((bAge - 0.12) / 0.2);
        a0.set(b.spot.x + Math.cos(ang) * near, 0.15, b.spot.z + Math.sin(ang) * near);
        b0.set(b.spot.x + Math.cos(ang) * far, 0.15, b.spot.z + Math.sin(ang) * far);
        arc.setEnds(a0, b0);
        arc.opacity = 0.9 * (1 - smoothstep((bAge - 0.2) / 0.14));
      });
    });
    const scorchFade = has ? 1 - smoothstep((after - 1.5) / 0.7) : 0;
    this.scorchMat.opacity = 0.8 * scorchFade;
    this.beats.forEach((b, i) => {
      const m = this.scorches[i];
      m.visible = has && b.done && scorchFade > 0.002;
      m.position.set(b.spot.x, 0.03, b.spot.z);
      m.scale.setScalar(0.55 + 0.25 * hash(i * 3.1));
    });

    // --- 5. Dead beat glint, then the converging strike on single frames. ---
    this.centerGlint.set(
      tmp.set(c.x, 0.3, c.z), 0.5 + 1.1 * charge, has && t >= 2.4 && t < D + 0.08 ? 0.9 : 0, t * 2,
    );
    const fb = has && t >= D + 0.08 ? Math.floor((t - D - 0.08) / FRAME) : -1;
    const fkey = fb < 12 ? fb : -1;
    const fresh = fkey !== this.finalKey;
    this.finalKey = fkey;
    const thickF = fkey === 0 || fkey === 3;
    const thinF = fkey === 1 || fkey === 2 || fkey === 4 || fkey === 5;
    const dashF = fkey >= 6;
    this.finals.forEach((fbolt, i) => {
      const th = (i / DRUMS) * TAU;
      b0.set(c.x + Math.cos(th) * 0.3, 0.2, c.z + Math.sin(th) * 0.3);
      a0.copy(this.headW[i]);
      if (fkey >= 0 && fresh) {
        if (fkey <= 5) {
          this.pair(fbolt.bolt, fbolt.black, a0, b0, 101 + i * 13 + fkey * 7);
          fbolt.thin.setEnds(a0, b0);
          fbolt.thin.reroll();
        }
      } else if (fkey >= 0 && fkey <= 5) {
        fbolt.bolt.setEnds(a0, b0);
        fbolt.black.setEnds(a0, b0);
        fbolt.thin.setEnds(a0, b0);
      }
      fbolt.bolt.opacity = thickF ? 0.85 : 0;
      fbolt.black.opacity = thickF ? 0.9 : 0;
      if (dashF && fkey < 12) {
        // Energy evaporating: one dash per frame, then only the ends of the path.
        const [u0, u1] = DASH_U[fkey - 6];
        const p = new THREE.Vector3().lerpVectors(a0, b0, u0);
        const q = new THREE.Vector3().lerpVectors(a0, b0, u1);
        fbolt.thin.setEnds(p, q);
        fbolt.thin.opacity = fkey < 9 ? 1 : 0.8;
      } else fbolt.thin.opacity = thinF ? 1 : 0;
    });
    // Cyan star for two strobe frames only, a black star behind it (black is a colour).
    this.star.set(tmp.set(c.x, 1.2, c.z), 3.4, thickF ? 1 : 0, fkey * 0.4);
    this.darkStar.set(tmp.set(c.x, 1.2, c.z), 4.4, fkey >= 0 && fkey <= 5 ? 0.9 : 0, fkey * 0.3 + 0.2);

    // --- 6. Ground discharge, rings, scorch. ---
    const ga = t - D - 0.08;
    this.nova.forEach((arc, i) => {
      if (!struck || !has || ga < 0 || ga > 1.9) { arc.opacity = 0; return; }
      const ang = (i / NOVA) * TAU + 0.3;
      const far = 2 + (AREA_R - 1.5) * smoothstep(ga / 0.55);
      const dieE = smoothstep((ga - 0.7) / 0.85);
      const near = Math.min(far - 0.4, 0.4 + dieE * (AREA_R - 0.4));
      a0.set(c.x + Math.cos(ang) * near, 0.2, c.z + Math.sin(ang) * near);
      b0.set(c.x + Math.cos(ang) * far, 0.2, c.z + Math.sin(ang) * far);
      arc.setEnds(a0, b0);
      arc.opacity = 0.95 * (1 - smoothstep((ga - 1.5) / 0.4));
    });
    this.shock.mesh.position.set(c.x, 0.06, c.z);
    this.shock.mesh.scale.setScalar(Math.max(1e-4, Math.min(AREA_R + 1, 0.5 + Math.max(0, after) * 16)));
    this.shock.material.opacity = struck && has ? Math.max(0, 0.7 * (1 - after / 0.7)) : 0;
    const a2 = after - 0.1;
    this.shock2.mesh.position.set(c.x, 0.07, c.z);
    this.shock2.mesh.scale.setScalar(Math.max(1e-4, Math.min(AREA_R + 2, 0.5 + Math.max(0, a2) * 12)));
    this.shock2.material.opacity = struck && has && a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.8)) : 0;
    // Screen distortion: one ground ring, reused. Small pulse at each roll beat, big one on the strike (same radius as the shock ring).
    if (struck && has) {
      const rp = after / 0.5;
      this.refract.set(c, Math.min(AREA_R + 1, 0.5 + Math.max(0, after) * 16), rp < 1 ? 0.045 * (1 - rp) * (1 - rp) : 0);
    } else {
      let last: Beat | null = null;
      for (const b of this.beats) if (t >= b.t) last = b;
      const bp = last && has ? (t - last.t) / 0.3 : 1;
      this.refract.set(last ? last.spot : c, 0.55 + Math.max(0, bp) * 2, bp < 1 ? 0.02 * (1 - bp) * (1 - bp) : 0);
    }
    this.bigScorch.position.set(c.x, 0.03, c.z);
    this.bigScorch.scale.setScalar(3);
    this.bigScorchMat.opacity = struck && has ? 0.85 * (1 - smoothstep((after - 1.6) / 0.6)) : 0;
    this.bigScorch.visible = this.bigScorchMat.opacity > 0.002;

    // --- 7. Shake: a tick per beat, none in the dead beat, big on the strike. ---
    let sh = 0;
    for (const b of this.beats) if (t >= b.t) sh = Math.max(sh, 0.07 * Math.exp(-(t - b.t) * 14));
    this.shake = struck ? 0.9 * Math.exp(-after * 5) : sh;
  }

  private onBeat(b: Beat) {
    b.done = true;
    this.sparks.burst(30, new THREE.Vector3(b.spot.x, 0.25, b.spot.z));
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (p && Math.hypot(p.x - b.spot.x, p.z - b.spot.z) <= 1.5) ctx.hit(e, { damage: 8, knock: 1, from: b.spot });
    });
  }

  private onStrike() {
    this.struck = true;
    const c = this.center;
    this.sparks.burst(300, new THREE.Vector3(c.x, 0.4, c.z));
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 5, from: c }));
  }

  private onSmoke() {
    this.smokeDone = true;
    const c = this.center;
    for (let k = 0; k < 5; k++) {
      const an = (k / 5) * TAU + 0.4;
      this.smoke.trigger(new THREE.Vector3(c.x + Math.cos(an) * 2.6, 0.5, c.z + Math.sin(an) * 2.6), 0.9, 0.8);
    }
  }
}

export const thunderGodDrumsModule: EffectModule = {
  label: 'thunder god drums',
  category: 'targeted',
  targeting: { mode: 'ground', radius: AREA_R },
  create: () => new ThunderGodDrums(),
  telegraphs(effect) {
    const e = effect as ThunderGodDrums;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: AREA_R }, start: 0.6, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThunderGodDrums;
    if (e.ctx) frameCast(camera, controls, e.ctx, RING_Y + 4);
  },
  buildGui(f, effect) {
    const s = (effect as ThunderGodDrums).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
