import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  LightningArc, ShockRefraction, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Taiji Thunder Seal (targeted, single enemy): the world goes dark and a 7 m taiji seal (violet light half, black
 * half, eight trigram bars) forms in the sky over the chosen enemy. It spins up slowly, slowly, then fast while
 * thin needle bolts lick down and die half-way, freezes for a dead beat, and one very thick bolt (with a black
 * copy under it) drops through its centre. The bolt lives on single frames (thick, thin, thick, thin, dashes,
 * ends) between impact frames, a ground nova of crawling arcs discharges, the seal cracks apart, and the arcs
 * evaporate into dashes while a toon smoke ring rolls out.
 *
 * Recipes: b-genshin-yae-tenko-kenshin (sky sigil → bolt), f-moa-thunder-dive-discharge (ground discharge),
 * a-dota-zeus-thundergods-wrath (pre-spark on the ground, one instant thick bolt).
 */
export interface TaijiThunderSealSettings {
  damage: number;
  loop: boolean;
}

export const defaultTaijiThunderSeal = (): TaijiThunderSealSettings => ({ damage: 70, loop: false });

const D = 2.15; // strike time
const DURATION = 4.4;
const SEAL_Y = 8;
const SEAL_R = 3.5;
const NOVA = 7;
const RIM = 4;
const FRAME = 0.04; // one "lightning frame"

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

/** Seal spin angle (radians): slow, slow, then fast (ease-in), frozen from 2.0 s (the dead beat). */
function sealSpin(t: number) {
  const tt = Math.min(t, 2.0);
  const u = Math.max(0, tt - 1.0);
  return Math.PI * 2 * (0.3 * Math.min(tt, 1.0) + 0.3 * u + 1.425 * u ** 4);
}

/** One half of the taiji (mode 0: additive light half + glowing S-curve edge; mode 1: solid dark half). */
function taijiMaterial(mode: 0 | 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: mode === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uMode: { value: mode },
      uOpacity: { value: 0 },
      uBody: { value: new THREE.Color(0x9b6bff) },
      uHot: { value: new THREE.Color(0xe6dcff) },
      uDark: { value: new THREE.Color(0x120a24) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uMode, uOpacity; uniform vec3 uBody, uHot, uDark; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float aa = 0.012;
        float disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
        if (disc <= 0.0) discard;
        float d1 = length(p - vec2(0.0, 0.5));
        float d2 = length(p - vec2(0.0, -0.5));
        // Right half light, top bulge light, bottom bulge dark, then the two small eyes inverted.
        float lt = step(0.0, p.x);
        lt = mix(lt, 1.0, 1.0 - smoothstep(0.5 - aa, 0.5, d1));
        lt = mix(lt, 0.0, 1.0 - smoothstep(0.5 - aa, 0.5, d2));
        lt = mix(lt, 0.0, 1.0 - smoothstep(0.12 - aa, 0.12, d1));
        lt = mix(lt, 1.0, 1.0 - smoothstep(0.12 - aa, 0.12, d2));
        // Distance to the S-curve (only the arcs that are real boundaries) and to the outer rim.
        float e = min(p.x < 0.0 ? abs(d1 - 0.5) : 9.0, p.x > 0.0 ? abs(d2 - 0.5) : 9.0);
        float edge = exp(-e * 45.0) + exp(-abs(r - 0.985) * 70.0);
        if (uMode < 0.5) {
          vec3 col = mix(uBody, uHot, clamp(edge, 0.0, 1.0));
          float a = (lt * 0.45 + clamp(edge, 0.0, 1.0) * 0.5) * disc * uOpacity;
          gl_FragColor = vec4(col, a);
        } else {
          gl_FragColor = vec4(uDark, (1.0 - lt) * disc * uOpacity);
        }
      }`,
  });
}

/** Trigram bar pieces: 8 trigrams x 3 lines, solid or broken in two. */
interface Piece { g: number; theta: number; r: number; off: number; len: number }
function trigramPieces(): Piece[] {
  const out: Piece[] = [];
  for (let g = 0; g < 8; g++) {
    const theta = (g / 8) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const r = 4.15 + k * 0.3;
      if ((g >> k) & 1) out.push({ g, theta, r, off: 0, len: 0.95 });
      else {
        out.push({ g, theta, r, off: -0.28, len: 0.4 });
        out.push({ g, theta, r, off: 0.28, len: 0.4 });
      }
    }
  }
  return out;
}

const DASHES = [[0.04, 0.14], [0.24, 0.33], [0.46, 0.55], [0.66, 0.74], [0.84, 0.91], [0.95, 1.0]];

export class TaijiThunderSeal implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TaijiThunderSealSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private struck = false;
  private smokeDone = false;
  private lastFrame = -2;
  private sputter = 0;
  private spit = 0;

  // Cast geometry.
  private ground = new THREE.Vector3();
  private top = new THREE.Vector3(0, SEAL_Y, 0);
  /** Seal orientation: face tilted ~55 degrees from straight down toward the caster. */
  private sealQuat = new THREE.Quaternion();

  // Seal.
  private sealGroup = new THREE.Group();
  private spinGroup = new THREE.Group();
  private baguaGroup = new THREE.Group();
  private lightMat = taijiMaterial(0);
  private darkMat = taijiMaterial(1);
  private lightMesh: THREE.Mesh;
  private darkMesh: THREE.Mesh;
  private pieces = trigramPieces();
  private bars: THREE.InstancedMesh;
  private ringMain = createRing(0xffffff, 0.965, 1, 128);

  // Lightning.
  private rim: LightningArc[] = [];
  private needles: LightningArc[] = [];
  private bolt = new LightningArc({ width: 0.55, segments: 18, jitter: 0.09, branches: 5, rerollEvery: 1e9, dropChance: 0, core: 0xffffff, glow: 0x6a45c0 });
  private boltBlack = new LightningArc({ width: 1.2, segments: 18, jitter: 0.09, branches: 5, rerollEvery: 1e9, dropChance: 0, core: 0x120a24, glow: 0x05040a });
  private boltThin = new LightningArc({ width: 0.24, segments: 18, jitter: 0.09, branches: 2, rerollEvery: 1e9, dropChance: 0, core: 0xffffff, glow: 0xe6dcff });
  private dashes: LightningArc[] = [];
  private nova: LightningArc[] = [];

  // Ground and impact.
  private spark = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x5fe3ff, core: 0xffffff });
  private star = new StarBurst({ points: 12, color: 0x5fe3ff, core: 0xffffff, additive: false });
  private flash = new GlowSphere(0xe6dcff, { rim: false });
  private lockRing = createRing(0x9b6bff, 0.93, 1, 96);
  private shock = createRing(0x9b6bff, 0.9, 1, 128);
  private refract = new ShockRefraction({ facing: 'ground' });
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.scorchMat);
  private smoke = new SmokeBall({ color: 0x1a1626, rim: 0x4a3f66, flake: '#2a2236', maxBalls: 4 });
  private haze: Emitter;
  private sparks: Emitter;

  constructor(settings: TaijiThunderSealSettings = defaultTaijiThunderSeal()) {
    this.settings = settings;
    this.screen.tint.set(0x120a24);
    this.screen.impactColor.set(0x9b6bff);
    this.screen.speedLineColor.set(0xe6dcff);

    // Seal: a flat disc facing down (local XY plane turned horizontal), spin about its local Z.
    const discGeo = new THREE.CircleGeometry(SEAL_R, 96);
    this.darkMesh = new THREE.Mesh(discGeo, this.darkMat);
    this.lightMesh = new THREE.Mesh(discGeo, this.lightMat);
    this.darkMesh.renderOrder = 1;
    this.lightMesh.renderOrder = 2;
    this.lightMesh.position.z = 0.02;
    this.spinGroup.add(this.darkMesh, this.lightMesh);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x9b6bff });
    this.bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMat, this.pieces.length);
    this.bars.frustumCulled = false;
    this.baguaGroup.add(this.bars);
    this.tilt(0);
    this.sealGroup.add(this.spinGroup, this.baguaGroup);
    this.sealGroup.visible = false;
    this.group.add(this.sealGroup, this.ringMain.mesh);

    for (let i = 0; i < RIM; i++) {
      const a = new LightningArc({ width: 0.12, segments: 6, jitter: 0.08, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0.1 });
      this.rim.push(a);
      this.group.add(a.mesh);
    }
    for (let i = 0; i < 2; i++) {
      const a = new LightningArc({ width: 0.08, segments: 12, jitter: 0.07, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0 });
      this.needles.push(a);
      this.group.add(a.mesh);
    }
    (this.boltBlack.mesh.material as THREE.ShaderMaterial).blending = THREE.NormalBlending;
    this.boltBlack.mesh.renderOrder = 3;
    this.bolt.mesh.renderOrder = 4;
    this.boltThin.mesh.renderOrder = 4;
    this.group.add(this.boltBlack.mesh, this.bolt.mesh, this.boltThin.mesh);
    for (let i = 0; i < DASHES.length; i++) {
      const a = new LightningArc({ width: 0.22, segments: 3, jitter: 0.12, branches: 0, core: 0xffffff, glow: 0x9b6bff, rerollEvery: 1e9, dropChance: 0 });
      a.mesh.renderOrder = 4;
      this.dashes.push(a);
      this.group.add(a.mesh);
    }
    for (let i = 0; i < NOVA; i++) {
      const a = new LightningArc({ width: 0.2, segments: 10, jitter: 0.1, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0.2 });
      this.nova.push(a);
      this.group.add(a.mesh);
    }

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;
    this.scorch.visible = false;
    this.group.add(this.spark.mesh, this.star.mesh, this.flash.mesh, this.lockRing.mesh, this.shock.mesh, this.scorch, this.smoke.mesh, this.refract.mesh);

    // Storm haze: dark, normal-blended, eroded, gathering over the target.
    this.haze = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 3, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0, drag: 0.8,
      sizeStart: 2.6, sizeEnd: 4.2, colorStart: '#2a1a40', colorEnd: '#120a24',
      opacityStart: 0.3, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 10, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#5fe3ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#9b6bff', sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.haze, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  private tilt(aim: number) {
    const k = (55 * Math.PI) / 180;
    // Normal of the seal face: mostly down, leaning back toward the caster (opposite the caster -> target direction).
    const n = new THREE.Vector3(-Math.sin(aim) * Math.sin(k), -Math.cos(k), -Math.cos(aim) * Math.sin(k));
    this.sealQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this.sealGroup.quaternion.copy(this.sealQuat);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.tilt(ctx.aim);
    this.ground.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.top.set(this.ground.x, SEAL_Y, this.ground.z);
    this.sealGroup.position.copy(this.top);
    this.screen.silhouettes = [...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.top);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.struck = false;
    this.smokeDone = false;
    this.lastFrame = -2;
    this.sputter = 0;
    this.spit = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of [this.haze, this.sparks]) e.update(dt);
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
    const g = this.ground;
    if (dt > 0) {
      // Storm haze gathers above the target.
      if (t < D - 0.1) this.haze.burst(t < 0.5 ? 4 : 2, new THREE.Vector3(g.x, SEAL_Y + 1, g.z));
      // Cyan pre-spark sputters on the ground where the bolt will land.
      if (t < D) {
        this.sputter += dt;
        if (this.sputter > 0.12) { this.sputter = 0; this.sparks.burst(4, new THREE.Vector3(g.x, 0.2, g.z)); }
      } else if (t < D + 0.8) {
        // Discharge spits along the ground.
        this.spit += dt;
        if (this.spit > 0.06) {
          this.spit = 0;
          const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
          this.sparks.burst(8, new THREE.Vector3(g.x + Math.cos(a) * r, 0.15, g.z + Math.sin(a) * r));
        }
      }
    }
    if (!this.struck && t >= D) this.onStrike();
    if (!this.smokeDone && t >= D + 0.6) this.onSmoke();
    const all: LightningArc[] = [...this.rim, ...this.needles, this.bolt, this.boltBlack, this.boltThin, ...this.dashes, ...this.nova];
    for (const a of all) a.update(dt);
    this.layout(dt);
    if (ended) clearScreenFx(this.screen);
  }

  private pair(a: THREE.Vector3, b: THREE.Vector3, seed: number) {
    this.bolt.setEnds(a, b);
    this.boltBlack.setEnds(a, b);
    // Same seed and options: the black copy follows exactly the bright path, only wider.
    seeded(seed, () => this.bolt.reroll());
    seeded(seed, () => this.boltBlack.reroll());
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - D;
    const struck = t >= D;
    const ctx = this.ctx;
    const g = this.ground;
    const top = this.top;
    const hasCtx = !!ctx;

    // --- 1. World darkens and holds until the strike, then releases. ---
    this.screen.darken = hasCtx ? (t < D ? 0.8 * smoothstep(t / 0.5) : 0.8 * Math.exp(-Math.max(0, after - 0.5) * 2.2)) : 0;
    this.screen.speedLines = hasCtx
      ? (t < D ? 0.8 * smoothstep((t - 1.0) / 0.8) : Math.max(0, 0.8 - after * 8))
      : 0;
    this.screen.impact = hasCtx ? impactFrameAt(t, D, [0, 1, 2, 0, 1, 2, 0], FRAME) : 0;

    // --- 2. The seal forms with overshoot, spins up, cracks apart after the strike. ---
    const formU = (t - 0.5) / 0.5;
    const sc = formU <= 0 ? 0 : formU < 0.7 ? 1.08 * smoothstep(formU / 0.7) : 1.08 - 0.08 * smoothstep((formU - 0.7) / 0.3);
    const sealFade = struck ? 1 - smoothstep((after - 0.2) / 0.7) : 1;
    const spin = sealSpin(t);
    const showSeal = hasCtx && sc > 0.001 && sealFade > 0.002;
    this.sealGroup.visible = showSeal;
    this.spinGroup.rotation.z = spin;
    this.spinGroup.scale.setScalar(Math.max(1e-4, sc));
    const split = struck ? smoothstep(after / 0.4) : 0;
    this.lightMesh.position.x = split * 1.0;
    this.darkMesh.position.x = -split * 1.0;
    const pulse = 0.85 + 0.15 * Math.sin(t * 9);
    this.lightMat.uniforms.uOpacity.value = sealFade * (t < D ? pulse : 1);
    this.darkMat.uniforms.uOpacity.value = 0.95 * sealFade;
    this.ringMain.mesh.position.copy(top);
    this.ringMain.mesh.quaternion.copy(this.sealQuat);
    this.ringMain.mesh.scale.setScalar(Math.max(1e-4, (SEAL_R + 0.12) * sc));
    this.ringMain.material.opacity = showSeal ? 0.8 * sealFade : 0;

    // Trigram bars pop in one by one, ~0.04 s apart, and counter-rotate slowly.
    this.baguaGroup.rotation.z = -spin * 0.35;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.pieces.forEach((pc, i) => {
      const age = t - (0.75 + pc.g * 0.04);
      const k = Math.max(1e-4, Math.min(1, age / 0.06)) * (age > 0 ? sealFade : 0);
      const c = Math.cos(pc.theta), sn = Math.sin(pc.theta);
      p.set(c * pc.r - sn * pc.off, sn * pc.r + c * pc.off, 0);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), pc.theta + Math.PI / 2);
      s.set(Math.max(1e-4, pc.len * k), Math.max(1e-4, 0.14 * k), Math.max(1e-4, 0.06 * k));
      m.compose(p, q, s);
      this.bars.setMatrixAt(i, m);
    });
    this.bars.instanceMatrix.needsUpdate = true;

    // --- 3. Rim arcs crawl round the seal (more frequent as it spins up); needles lick down and die half-way. ---
    const rimOn = hasCtx && t >= 0.6 && t < 2.0;
    const rate = 0.35 + 0.55 * smoothstep((t - 0.6) / 1.4);
    const a0 = new THREE.Vector3(), b0 = new THREE.Vector3();
    this.rim.forEach((arc, i) => {
      if (!rimOn || hash(Math.floor(t * 24) + i * 13.7) > rate) { arc.opacity = 0; return; }
      const th = (i * Math.PI) / 2 + spin * 0.35 + t * 1.5;
      const R = SEAL_R * 1.02 * Math.max(sc, 0.01);
      a0.set(Math.cos(th) * R, Math.sin(th) * R, 0).applyQuaternion(this.sealQuat).add(top);
      b0.set(Math.cos(th + 0.7) * R, Math.sin(th + 0.7) * R, 0).applyQuaternion(this.sealQuat).add(top);
      arc.setEnds(a0, b0);
      arc.opacity = 0.9;
    });
    const cyc = Math.floor((t - 1.0) / 0.3);
    const ph = t - 1.0 - cyc * 0.3;
    const needleOn = hasCtx && t >= 1.0 && t < 2.0 && ph < 0.14;
    this.needles.forEach((arc, i) => {
      if (!needleOn || cyc % 2 !== i) { arc.opacity = 0; return; }
      const ang = cyc * 2.4;
      a0.set(top.x + Math.cos(ang) * 1.6, SEAL_Y - 0.1, top.z + Math.sin(ang) * 1.6);
      b0.set(g.x, 1.0, g.z);
      b0.lerpVectors(a0, b0, 0.4 + 0.2 * hash(cyc));
      arc.setEnds(a0, b0);
      arc.opacity = 0.9;
    });

    // --- 4. Ground cues: lock ring, cyan pre-spark glint. ---
    this.lockRing.mesh.position.set(g.x, 0.05, g.z);
    this.lockRing.mesh.scale.setScalar(2.2);
    this.lockRing.mesh.rotation.z = t * 0.8;
    this.lockRing.material.opacity = !hasCtx ? 0 : t < D
      ? 0.45 * smoothstep((t - 0.5) / 0.4) * (0.8 + 0.2 * Math.sin(t * 14))
      : 0.7 * Math.exp(-after * 8);
    const sparkOn = hasCtx && t < D && hash(Math.floor(t * 25) + 3.3) < 0.55 + 0.4 * smoothstep(t / D);
    this.spark.set(new THREE.Vector3(g.x, 0.25, g.z), 0.5 + 0.5 * hash(Math.floor(t * 25)), sparkOn ? 0.9 : 0, t * 3);

    // --- 5. The strike: one thick bolt that lives on single frames. ---
    const f = struck && hasCtx ? Math.floor(after / FRAME) : -1;
    const a = new THREE.Vector3(top.x, SEAL_Y - 0.2, top.z);
    const b = new THREE.Vector3(g.x, 0.3, g.z);
    const thick = f === 0 || f === 3;
    const thin = f === 1 || f === 2 || f === 4 || f === 5;
    if (f !== this.lastFrame) {
      this.lastFrame = f;
      if (f >= 0) {
        this.pair(a, b, 11 + f * 7);
        this.boltThin.setEnds(a, b);
        this.boltThin.reroll();
        DASHES.forEach((_d, i) => this.dashes[i].reroll());
      }
    }
    this.bolt.opacity = thick ? 0.85 : 0;
    this.boltBlack.opacity = thick ? 0.9 : 0;
    this.boltThin.opacity = thin ? 1 : 0;
    const dashMode = f >= 6 && f <= 8 ? 1 : f >= 9 && f <= 11 ? 2 : 0;
    this.dashes.forEach((arc, i) => {
      const keep = dashMode === 1 || (dashMode === 2 && (i === 0 || i === DASHES.length - 1));
      if (!keep) { arc.opacity = 0; return; }
      const shift = dashMode === 1 ? 0.025 * (f - 6) : 0;
      const [u0, u1] = DASHES[i];
      const shorten = dashMode === 2 ? 0.5 : 1;
      p.lerpVectors(a, b, Math.min(1, u0 + shift));
      s.lerpVectors(a, b, Math.min(1, u0 + shift + (u1 - u0) * shorten));
      arc.setEnds(p, s);
      arc.opacity = dashMode === 2 ? 0.8 : 1;
    });

    // Cool accent star at the target for two strobe frames only; a flash under it.
    const starOn = f === 0 || f === 3;
    this.star.set(new THREE.Vector3(g.x, 1.2, g.z), 3.4, starOn ? 1 : 0, f * 0.4);
    this.flash.mesh.position.set(g.x, 1.0, g.z);
    this.flash.mesh.scale.setScalar(2.2 + after * 6);
    this.flash.opacity = struck && hasCtx ? 0.3 * Math.exp(-after * 14) : 0;

    // --- 6. Discharge: arcs crawl out along the ground, then die into dashes and ends. ---
    this.nova.forEach((arc, i) => {
      if (!struck || !hasCtx || after > 1.9) { arc.opacity = 0; return; }
      const ang = (i / NOVA) * Math.PI * 2 + 0.3;
      const grow = smoothstep(after / 0.55);
      const far = 2 + 4 * grow;
      const dieE = smoothstep((after - 0.75) / 0.85);
      const near = Math.min(far - 0.4, 0.4 + dieE * 5.6);
      a0.set(g.x + Math.cos(ang) * near, 0.2, g.z + Math.sin(ang) * near);
      b0.set(g.x + Math.cos(ang) * far, 0.2, g.z + Math.sin(ang) * far);
      arc.setEnds(a0, b0);
      arc.opacity = 0.95 * (1 - smoothstep((after - 1.5) / 0.4));
    });
    this.shock.mesh.position.set(g.x, 0.06, g.z);
    this.shock.mesh.scale.setScalar(Math.max(1e-4, Math.min(8, 0.5 + Math.max(0, after) * 16)));
    this.shock.material.opacity = struck && hasCtx ? Math.max(0, 0.7 * (1 - after / 0.7)) : 0;
    // Screen distortion on the nova ring (same radius as the shock ring), decays over 0.5 s.
    const rp = after / 0.5;
    this.refract.set(g, Math.min(8, 0.5 + Math.max(0, after) * 16), struck && hasCtx && rp < 1 ? 0.045 * (1 - rp) * (1 - rp) : 0);
    this.scorch.position.set(g.x, 0.03, g.z);
    this.scorch.scale.setScalar(2.4);
    this.scorchMat.opacity = struck && hasCtx ? 0.85 * (1 - smoothstep((after - 1.2) / 0.6)) : 0;
    this.scorch.visible = this.scorchMat.opacity > 0.002;

    this.shake = struck ? Math.exp(-after * 5) : t > 1.0 && t < 2.0 ? 0.03 * (t - 1.0) : 0;
  }

  private onStrike() {
    this.struck = true;
    const g = this.ground;
    this.sparks.burst(260, new THREE.Vector3(g.x, 0.4, g.z));
    const ctx = this.ctx;
    const e = ctx?.targets[0];
    if (ctx && e) ctx.hit(e, { damage: this.settings.damage, knock: 3, from: ctx.from });
  }

  private onSmoke() {
    this.smokeDone = true;
    const g = this.ground;
    for (let k = 0; k < 4; k++) {
      const an = (k / 4) * Math.PI * 2 + 0.4;
      this.smoke.trigger(new THREE.Vector3(g.x + Math.cos(an) * 2.5, 0.6, g.z + Math.sin(an) * 2.5), 1.2, 1.0);
    }
  }
}

export const taijiThunderSealModule: EffectModule = {
  label: 'taiji thunder seal',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new TaijiThunderSeal(),
  telegraphs(effect) {
    const e = effect as TaijiThunderSeal;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.2 }, start: 0.5, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as TaijiThunderSeal;
    if (e.ctx) frameCast(camera, controls, e.ctx, SEAL_Y + 3);
  },
  buildGui(f, effect) {
    const s = (effect as TaijiThunderSeal).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
