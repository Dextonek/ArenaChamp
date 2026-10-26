import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  LightningArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Violet Severance (targeted, single target): the caster gathers a violet flare at the hand while thin rings
 * contract into it and motes are sucked in, then the beam LENGTH snaps out in 0.3 s and keeps going 6 m past the
 * target, cutting through it and scorching a line into the ground behind it. The point of the spell is the beam
 * MATERIAL: one channel duration drives three copies of one shape, each a custom shader.
 *   1. dark under-beam (normal blend, drawn first): the black outline that makes the beam read on any background;
 *   2. scrolling streak core (additive): stretched value noise scrolling toward the target, end-fade mask, sine
 *      pinch across, UV distortion, white -> violet colour ramp;
 *   3. eroded electric copy (additive, alpha clip): same shader, higher clip, more distortion, faster scroll.
 * Length 0 -> 1 in the first 10 % of the channel, width 1 -> 0 in the last 10 %. Stretched sparks stream along it,
 * flashes repeat at the source, two thin lightning arcs crawl on it, the target gets a flickering star and a spray
 * of sparks, and the channel ends in a cut: hit frames, silhouettes, smoke and a long glowing scorch line.
 *
 * Structure copied from starbreakerLance.ts (docs/TARGETED_SPELL_BRIEF.md).
 */
export interface VioletSeveranceSettings {
  /** Half-width of the bright core in world units (the under-beam is 1.5x, the electric copy ~1.8x). */
  beamWidth: number;
  tickDamage: number;
  cutDamage: number;
  loop: boolean;
}

export const defaultVioletSeverance = (): VioletSeveranceSettings => ({
  beamWidth: 0.5,
  tickDamage: 7,
  cutDamage: 45,
  loop: false,
});

const WIND_UP = 0.7;
const CHANNEL = 3;
const BEAM_END = WIND_UP + CHANNEL; // 3.7: width has shrunk to 0
const CUT = 3.6; // u = 0.97
const DURATION = 4.2;
const TICK = 0.3;
const FIRST_TICK = 0.8;
const TICKS = 10; // 0.8 .. 3.5
const BEYOND = 6; // the beam ends this far past the target
const RINGS = 3;
const MOTES = 90;
const ARCS = 2;
const STREAKS = 220;

// --- Beam material -------------------------------------------------------------------------------------------

const BEAM_VERT = /* glsl */ `
  uniform vec3 uA, uB; uniform float uHalfW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Ribbon from a to b that always turns its flat side to the camera (pivot at the source a).
    vec3 a = (modelMatrix * vec4(uA, 1.0)).xyz;
    vec3 b = (modelMatrix * vec4(uB, 1.0)).xyz;
    vec3 side = cross(b - a, cameraPosition - a);
    float sl = length(side);
    side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
    vec3 w = mix(a, b, uv.y) + side * (uv.x - 0.5) * 2.0 * uHalfW;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime, uScroll, uDistort, uClip, uOpacity, uLength, uDark, uSeed, uBase, uGain, uSharp;
  uniform vec3 uHot, uMid, uEdge;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float y = vUv.y;                       // 0 at the source, 1 at the head
    float c = vUv.x * 2.0 - 1.0;           // -1..1 across
    // Sine pinch: narrow at both ends of the ribbon.
    float pinch = 0.3 + 0.7 * sqrt(max(sin(3.14159265 * y), 0.0));
    // End-fade mask along the length: 0 -> 1 -> 0.6 -> 0.
    float mask = smoothstep(0.0, 0.05, y) * mix(1.0, 0.6, smoothstep(0.35, 0.85, y)) * (1.0 - smoothstep(0.85, 1.0, y));
    // Noise space is anchored to world distance from the source, so growing the beam never swims the pattern.
    float along = y * uLength * 0.35;
    vec2 q = vec2(along, c);
    // UV distortion: uv += (noise(uv * k + t * 3) - 0.5) * amount.
    vec2 d = vec2(noise(q * 3.0 + vec2(uTime * 3.0, uSeed)), noise(q * 3.0 + vec2(17.0 - uTime * 2.4, uSeed * 1.7 + 5.0)));
    float pc = c + (d.y - 0.5) * uDistort * 2.5;
    along += (d.x - 0.5) * uDistort * 2.0;
    float ap = abs(pc) / pinch;

    if (uDark > 0.5) {
      // Under-beam: near-black violet, slow drifting mottling, hard-ish edge so it doubles as an outline.
      float n = noise(vec2(along * 0.8 - uTime * 1.2, pc * 2.0));
      float a = (1.0 - smoothstep(0.55, 1.0, ap)) * mask * uOpacity;
      gl_FragColor = vec4(mix(uEdge, uMid, n), a);
      return;
    }

    float prof = 1.0 - smoothstep(0.0, 1.0, ap);
    float sc = uTime * uScroll;            // scrolls toward the target (+along)
    float st = 0.6 * noise(vec2((along - sc) * 1.4, pc * 3.5)) + 0.4 * noise(vec2((along - sc * 1.4) * 3.0 + 9.0, pc * 7.0));
    float s = mix(st, smoothstep(0.35, 0.85, st), uSharp);
    float v = prof * (uBase + uGain * s);
    if (v < uClip) discard;                // alpha clip: erodes the electric copy into tendrils
    float a = clamp(v, 0.0, 1.0) * smoothstep(uClip, uClip + 0.12, v) * mask * uOpacity;
    vec3 col = mix(uEdge, uMid, smoothstep(0.08, 0.55, v));
    col = mix(col, uHot, smoothstep(0.7, 1.1, v + 0.15 * prof * prof));
    gl_FragColor = vec4(col, a);
  }`;

interface BeamLayerOptions {
  dark?: boolean;
  hot: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  edge: THREE.ColorRepresentation;
  scroll: number;
  distort: number;
  clip: number;
  base: number;
  gain: number;
  sharp: number;
  seed: number;
  order: number;
}

/** One shader copy of the beam: a camera-facing ribbon from a to b (unit plane, positioned in the vertex shader). */
class BeamLayer {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private geo = new THREE.PlaneGeometry(1, 1, 1, 1);

  constructor(o: BeamLayerOptions) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: o.dark ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3(0, 0, 1) }, uHalfW: { value: 0.1 },
        uTime: { value: 0 }, uScroll: { value: o.scroll }, uDistort: { value: o.distort }, uClip: { value: o.clip },
        uOpacity: { value: 0 }, uLength: { value: 1 }, uDark: { value: o.dark ? 1 : 0 }, uSeed: { value: o.seed },
        uBase: { value: o.base }, uGain: { value: o.gain }, uSharp: { value: o.sharp },
        uHot: { value: new THREE.Color(o.hot) }, uMid: { value: new THREE.Color(o.mid) }, uEdge: { value: new THREE.Color(o.edge) },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = o.order;
    this.mesh.visible = false;
  }

  /** Beam from a to b (group-local), half-width in world units; opacity 0 hides it. */
  place(a: THREE.Vector3, b: THREE.Vector3, halfW: number, opacity: number, time: number) {
    const u = this.material.uniforms;
    (u.uA.value as THREE.Vector3).copy(a);
    (u.uB.value as THREE.Vector3).copy(b);
    const len = a.distanceTo(b);
    u.uHalfW.value = halfW;
    u.uOpacity.value = opacity;
    u.uTime.value = time;
    u.uLength.value = len;
    this.mesh.visible = opacity > 0.002 && halfW > 1e-3 && len > 0.02;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}

// --- Ground scorch strip -------------------------------------------------------------------------------------

const SCORCH_VERT = /* glsl */ `
  varying vec2 vA;
  void main() {
    vA = vec2(position.x * 2.0, position.z + 0.5);   // across -1..1, along 0 (target) .. 1 (beam end)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SCORCH_FRAG = /* glsl */ `
  uniform float uOpacity, uGlow, uLen, uSeed, uTime;
  uniform vec3 uDark, uGlowC;
  varying vec2 vA;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float n = noise(vec2(vA.y * uLen * 1.3 + uSeed, vA.x * 2.5 + uTime * 0.6));
    float ax = abs(vA.x) + (n - 0.5) * 0.4;
    float w = 1.0 - smoothstep(0.55, 1.0, ax);
    float along = smoothstep(0.0, 0.06, vA.y) * (1.0 - smoothstep(0.7, 1.0, vA.y));
    // Glowing edge of the burn, hottest where the noise is high.
    float rim = smoothstep(0.3, 0.7, ax) * (1.0 - smoothstep(0.75, 1.0, ax));
    vec3 col = mix(uDark, uGlowC, clamp(rim * uGlow * (0.55 + 0.9 * n), 0.0, 1.0));
    gl_FragColor = vec4(col, w * along * uOpacity);
  }`;

// --- Stretched sparks ----------------------------------------------------------------------------------------

interface Streak {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  width: number;
  gravity: number;
  alive: boolean;
}

/** Streak-shaped sparks: camera-facing quads from the head back along the velocity, shrinking and fading. */
class StreakField {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private positions = new Float32Array(STREAKS * 4 * 3);
  private colors = new Float32Array(STREAKS * 4 * 3);
  private alphas = new Float32Array(STREAKS * 4);
  private uvs = new Float32Array(STREAKS * 4 * 2);
  private sparks: Streak[] = Array.from({ length: STREAKS }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 1, width: 0.05, gravity: 0, alive: false,
  }));
  private cursor = 0;
  private hot = new THREE.Color(0xfff0ff);
  private cool = new THREE.Color(0xc070ff);
  private camLocal = new THREE.Vector3();
  private col = new THREE.Color();

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('aCol', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute('aA', new THREE.BufferAttribute(this.alphas, 1));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    const index: number[] = [];
    for (let i = 0; i < STREAKS; i++) {
      const v = i * 4;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      // uv.x across, uv.y along (0 head, 1 tail).
      this.uvs.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8);
    }
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 aCol; attribute float aA; varying vec3 vCol; varying float vA; varying vec2 vUv;
        void main() { vUv = uv; vCol = aCol; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vA; varying vec2 vUv;
        void main() {
          float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
          float a = vA * smoothstep(0.0, 0.6, across) * (1.0 - vUv.y * vUv.y);
          gl_FragColor = vec4(vCol, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.onBeforeRender = (_r, _s, camera) => this.build(camera);
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, life: number, width: number, gravity = 0) {
    const s = this.sparks[this.cursor];
    this.cursor = (this.cursor + 1) % STREAKS;
    s.p.copy(p);
    s.v.copy(v);
    s.age = 0;
    s.life = life;
    s.width = width;
    s.gravity = gravity;
    s.alive = true;
  }

  clear() {
    for (const s of this.sparks) s.alive = false;
    this.positions.fill(0);
    this.alphas.fill(0);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aA.needsUpdate = true;
  }

  update(dt: number) {
    for (const s of this.sparks) {
      if (!s.alive) continue;
      s.age += dt;
      if (s.age >= s.life) { s.alive = false; continue; }
      s.v.y -= s.gravity * dt;
      s.p.addScaledVector(s.v, dt);
    }
  }

  private build(camera: THREE.Camera) {
    this.camLocal.setFromMatrixPosition(camera.matrixWorld);
    this.mesh.worldToLocal(this.camLocal);
    const side = new THREE.Vector3(), dir = new THREE.Vector3(), toCam = new THREE.Vector3(), tail = new THREE.Vector3();
    for (let i = 0; i < STREAKS; i++) {
      const s = this.sparks[i];
      const o = i * 12;
      if (!s.alive) {
        this.positions.fill(0, o, o + 12);
        this.alphas.fill(0, i * 4, i * 4 + 4);
        continue;
      }
      const speed = s.v.length();
      if (speed < 1e-4) { this.positions.fill(0, o, o + 12); this.alphas.fill(0, i * 4, i * 4 + 4); continue; }
      dir.copy(s.v).divideScalar(speed);
      const k = s.age / s.life;
      // Stretch with speed; shrink big -> small over the life.
      const len = THREE.MathUtils.clamp(speed * 0.045, 0.15, 1.4) * (1 - 0.5 * k);
      tail.copy(s.p).addScaledVector(dir, -len);
      toCam.subVectors(this.camLocal, s.p);
      side.crossVectors(dir, toCam);
      if (side.lengthSq() < 1e-10) side.set(0, 1, 0);
      side.normalize().multiplyScalar((s.width * (1 - k)) / 2 + 0.002);
      this.positions.set([
        s.p.x - side.x, s.p.y - side.y, s.p.z - side.z,
        s.p.x + side.x, s.p.y + side.y, s.p.z + side.z,
        tail.x - side.x, tail.y - side.y, tail.z - side.z,
        tail.x + side.x, tail.y + side.y, tail.z + side.z,
      ], o);
      this.col.copy(this.hot).lerp(this.cool, k);
      for (let q = 0; q < 4; q++) {
        this.colors[i * 12 + q * 3] = this.col.r;
        this.colors[i * 12 + q * 3 + 1] = this.col.g;
        this.colors[i * 12 + q * 3 + 2] = this.col.b;
      }
      this.alphas.fill(0.9 * Math.sqrt(1 - k), i * 4, i * 4 + 4);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true;
    this.geo.attributes.aA.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}

export class VioletSeverance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VioletSeveranceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Ground point where the beam ends (6 m past the target); the telegraph line runs caster -> here. */
  readonly lineEnd = new THREE.Vector3(0, 0, -6);
  private time = 0;
  private cut = false;
  private nextTick = 0;
  private lastTickAt = -1;
  private sparkAcc = 0;
  private hitSparkAcc = 0;
  private smokeAcc = 0;
  private emberAcc = 0;

  // Cast geometry, computed in cast() from the context.
  private hand = new THREE.Vector3(0, 1.5, 14);
  private dir = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private tgtFeet = new THREE.Vector3(0, 0, 0);
  private tgtChest = new THREE.Vector3(0, 1.4, 0);
  private tgtDist = 14; // hand -> target along the beam
  private fullLen = 20;
  // Scratch.
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  // Beam copies (drawn in order: dark, electric, core).
  private under = new BeamLayer({
    dark: true, hot: 0x2a0618, mid: 0x2a0618, edge: 0x14040c, scroll: 0, distort: 0.1, clip: 0, base: 0, gain: 0, sharp: 0,
    seed: 3, order: 1,
  });
  private electric = new BeamLayer({
    hot: 0xe0f0ff, mid: 0x4a9aff, edge: 0x2a5ac0, scroll: 9, distort: 0.25, clip: 0.55, base: 0.05, gain: 1.6, sharp: 0,
    seed: 11, order: 2,
  });
  private core = new BeamLayer({
    hot: 0xffffff, mid: 0xc070ff, edge: 0x6a20c0, scroll: 6, distort: 0.15, clip: 0.05, base: 0.45, gain: 0.75, sharp: 1,
    seed: 7, order: 3,
  });
  private arcs = Array.from({ length: ARCS }, () => new LightningArc({
    width: 0.09, segments: 18, jitter: 0.03, branches: 1, rerollEvery: 0.08, dropChance: 0.08, core: 0xe0f0ff, glow: 0x4a9aff,
  }));
  private streaks = new StreakField();

  // Hand / source.
  private flare = new StarBurst({ points: 4, inner: 0.2, jitter: 0.1, color: 0xc070ff, core: 0xffffff, additive: false });
  private ringG = new THREE.Group();
  private rings = Array.from({ length: RINGS }, () => createRing(0xc070ff, 0.9, 1, 64));
  private handGlow = new GlowSphere(0xc070ff, { rim: false });
  private releaseFlash = new GlowSphere(0xf0d8ff, { rim: false });
  private srcFlash = new GlowSphere(0xc070ff, { rim: false });
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({
    dir: new THREE.Vector3().randomDirection(), r: 1.6 + Math.random() * 2.4, d: Math.random() * 0.45,
  }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.14, map: softDotTexture(), color: 0xc070ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);

  // Target end.
  private hitStar = new StarBurst({ points: 6, inner: 0.3, color: 0xc070ff, core: 0xffffff, additive: false });
  private hitGlow = new GlowSphere(0xc070ff, { rim: false });
  private hitRing = createRing(0xc070ff, 0.86, 1, 64);
  private cutStar = new StarBurst({ points: 9, color: 0xc070ff, core: 0xffffff, additive: false });
  private cutGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
  private cutFlash = new GlowSphere(0xf0d8ff, { rim: false });
  private shock = createRing(0xe0c0ff, 0.9, 1, 96);
  private smoke = new SmokeBall({ color: 0x14040c, rim: 0x4a1a5a, flake: 0x2a0618, maxBalls: 3 });

  // Scorch line.
  private scorchGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private scorchMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
    uniforms: {
      uOpacity: { value: 0 }, uGlow: { value: 1 }, uLen: { value: 1 }, uSeed: { value: 5 }, uTime: { value: 0 },
      uDark: { value: new THREE.Color(0x1a0612) }, uGlowC: { value: new THREE.Color(0xc070ff) },
    },
    vertexShader: SCORCH_VERT,
    fragmentShader: SCORCH_FRAG,
  });
  private scorch = new THREE.Mesh(this.scorchGeo, this.scorchMat);

  private embers: Emitter;
  private smokeP: Emitter;

  constructor(settings: VioletSeveranceSettings = defaultVioletSeverance()) {
    this.settings = settings;
    this.screen.tint.set(0x2a1550);
    this.screen.impactColor.set(0xd8b0ff);
    this.screen.speedLineColor.set(0xe0c0ff);

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.scorch.visible = false;
    this.scorch.frustumCulled = false;
    this.scorch.renderOrder = 0;
    // Rings stand upright, facing along the beam: the group is aimed with lookAt (+Z = beam), rings lie in XY.
    for (const r of this.rings) {
      r.mesh.rotation.set(0, 0, 0);
      r.mesh.position.set(0, 0, 0);
      this.ringG.add(r.mesh);
    }
    this.hitRing.material.color.set(0xc070ff);

    this.group.add(this.scorch, this.under.mesh, this.electric.mesh, this.core.mesh);
    for (const a of this.arcs) this.group.add(a.mesh);
    this.group.add(this.streaks.mesh, this.ringG, this.motes, this.flare.mesh, this.handGlow.mesh);
    this.group.add(this.releaseFlash.mesh, this.srcFlash.mesh, this.hitStar.mesh, this.hitGlow.mesh, this.hitRing.mesh);
    this.group.add(this.cutStar.mesh, this.cutGlint.mesh, this.cutFlash.mesh, this.shock.mesh, this.smoke.mesh);

    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.35, speed: 1.5, speedJitter: 0.6, spread: 55, gravity: -0.7, drag: 0.8,
      sizeStart: 0.2, sizeEnd: 0, colorStart: '#fff0ff', colorEnd: '#6a20c0',
      opacityStart: 0.45, opacityEnd: 0, additive: true, colorMid: '#c070ff', sizeJitter: 0.5, erosion: 0.5, spin: 0.5,
    });
    // Dark normal-blended puffs so the bright layers have something to read against.
    this.smokeP = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.1, speedJitter: 0.6, spread: 35, gravity: -0.5, drag: 1.1,
      sizeStart: 0.6, sizeEnd: 1.6, colorStart: '#3a1a4a', colorEnd: '#14040c',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#2a0618', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.embers, this.smokeP, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  /** When the beam is released (end of the anticipation). */
  get releaseTime() {
    return WIND_UP;
  }

  get beamEndTime() {
    return BEAM_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const tgt = ctx.targetPos[0] ?? ctx.point;
    this.tgtFeet.copy(tgt).setY(0);
    // Hand at chest height, 0.8 in front of the caster, facing the target.
    this.hand.copy(ctx.from).addScaledVector(fwd, 0.8).setY(1.5);
    const dx = tgt.x - this.hand.x, dz = tgt.z - this.hand.z;
    const d = Math.hypot(dx, dz);
    // A target standing on the caster would give a zero direction: fall back to the aim.
    if (d > 0.3) this.dir.set(dx / d, 0, dz / d); else this.dir.copy(fwd);
    this.tgtDist = Math.max(0.3, d);
    this.fullLen = this.tgtDist + BEYOND;
    this.side.set(-this.dir.z, 0, this.dir.x);
    this.tgtChest.set(this.hand.x + this.dir.x * this.tgtDist, 1.4, this.hand.z + this.dir.z * this.tgtDist);
    this.lineEnd.copy(this.hand).addScaledVector(this.dir, this.fullLen).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hand);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.cut = false;
    this.nextTick = 0;
    this.lastTickAt = -1;
    this.sparkAcc = 0;
    this.hitSparkAcc = 0;
    this.smokeAcc = 0;
    this.emberAcc = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.streaks.clear();
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.embers.update(dt);
    this.smokeP.update(dt);
    this.smoke.update(dt);
    this.streaks.update(dt);
    for (const a of this.arcs) a.update(dt);
    if (!this.playing) return;
    this.time += dt;
    let ended = false;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      ended = true;
    }
    // Ticks: one hit each, safe against long frames.
    while (this.nextTick < TICKS && this.time >= FIRST_TICK + TICK * this.nextTick) {
      this.onTick(FIRST_TICK + TICK * this.nextTick);
      this.nextTick++;
    }
    if (!this.cut && this.time >= CUT) this.onCut();
    this.layout(dt);
    if (ended) clearScreenFx(this.screen);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const rel = t - WIND_UP;
    const u = rel / CHANNEL;
    const fade = 1 - smoothstep((t - (DURATION - 0.3)) / 0.3);
    const hand = this.hand, dir = this.dir, side = this.side;
    // One channel duration drives every layer: length 0 -> 1 in the first 10 %, width 1 -> 0 in the last 10 %.
    const lenK = rel < 0 ? 0 : smoothstep(u / 0.1);
    const widthK = rel < 0 ? 0 : 1 - smoothstep((u - 0.9) / 0.1);
    const head = this.fullLen * lenK;
    const channeling = rel >= 0 && t < BEAM_END;
    const beamOn = head > 0.02 && widthK > 0.005;
    const hitOn = beamOn && head > this.tgtDist;
    const after = t - CUT;

    // --- Anticipation: thin rings contract into the hand (slow, slow, fast), motes are sucked in, flare grows. ---
    const wind = THREE.MathUtils.clamp(t / WIND_UP, 0, 1);
    this.ringG.position.copy(hand);
    this.ringG.lookAt(this.a.copy(hand).add(dir));
    this.rings.forEach((r, i) => {
      const k = Math.pow(THREE.MathUtils.clamp(t / (WIND_UP * 0.92) - i * 0.07, 0, 1), 3);
      r.mesh.scale.setScalar(2.4 * (1 - k) + 0.12 * k);
      r.mesh.rotation.z = t * (i % 2 ? -3 : 3);
      r.material.opacity = t < WIND_UP ? 0.45 * smoothstep(t / 0.12) * (1 - Math.pow(k, 6)) : 0;
    });
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const k = THREE.MathUtils.clamp((wind - m.d) / (1 - m.d), 0, 1);
      const r = m.r * (1 - k * k * k);
      this.motePos[i * 3] = hand.x + m.dir.x * r;
      this.motePos[i * 3 + 1] = hand.y + m.dir.y * r;
      this.motePos[i * 3 + 2] = hand.z + m.dir.z * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = t < WIND_UP ? 0.5 * smoothstep(t / 0.2) : 0;

    // Source flare: grows (ease-in), flickers while channelling, closes in the aftermath.
    let flareSize = 0.2 + 0.9 * wind * wind * wind;
    let flareOp = t < 0.05 ? 0 : 1;
    if (rel >= 0) flareSize = (1.1 + 0.25 * Math.sin(t * 40)) * (t < BEAM_END ? 1 : Math.pow(1 - THREE.MathUtils.clamp((t - BEAM_END) / (DURATION - BEAM_END), 0, 1), 2));
    if (flareSize < 0.02) flareOp = 0;
    this.flare.set(hand, flareSize, flareOp * fade, t * 3);
    this.handGlow.mesh.position.copy(hand);
    this.handGlow.mesh.scale.setScalar(0.3 + 0.5 * wind);
    this.handGlow.opacity = (t < WIND_UP ? 0.4 * wind * wind : channeling ? 0.3 : 0.3 * Math.max(0, 1 - (t - BEAM_END) / 0.5)) * fade;

    // Release: big flash, then repeated soft flashes at the source (every 0.25 s, 0.15 s life).
    this.releaseFlash.mesh.position.copy(hand);
    this.releaseFlash.mesh.scale.setScalar(2 + Math.max(0, rel) * 6);
    this.releaseFlash.opacity = rel >= 0 ? 0.45 * Math.exp(-rel * 9) : 0;
    const ph = rel >= 0 && rel < CHANNEL ? rel % 0.25 : 1;
    this.srcFlash.mesh.position.copy(hand);
    if (ph < 0.15) {
      this.srcFlash.mesh.scale.setScalar(2.5 + 2.5 * (ph / 0.15));
      this.srcFlash.opacity = 0.3 * (1 - ph / 0.15);
    } else {
      this.srcFlash.opacity = 0;
    }

    // --- The beam: three shader copies of one shape. ---
    this.b.copy(hand).addScaledVector(dir, head);
    const pulse = 1 + 0.1 * Math.sin(t * Math.PI * 2 * 7);
    const coreW = s.beamWidth * widthK * pulse;
    this.under.place(hand, this.b, coreW * 2.1, beamOn ? 0.85 : 0, t);
    this.electric.place(hand, this.b, coreW * 1.8, beamOn ? 0.45 : 0, t);
    this.core.place(hand, this.b, coreW, beamOn ? 0.5 : 0, t);

    // Two thin lightning arcs crawl along the beam, one each side.
    this.arcs.forEach((arc, i) => {
      if (!beamOn || head < 0.5) { arc.opacity = 0; return; }
      const sg = i === 0 ? 1 : -1;
      this.a.copy(hand).addScaledVector(side, sg * 0.2).addScaledVector(this.up, i * 0.12);
      this.c.copy(this.a).addScaledVector(dir, head);
      arc.setEnds(this.a, this.c);
      arc.opacity = 0.5 * widthK;
    });

    // Stretched sparks stream along the beam toward the target; the target end sprays them back at the caster.
    if (dt > 0 && beamOn) {
      this.sparkAcc += 90 * dt;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const sp = 20 + Math.random() * 20;
        this.a.copy(hand).addScaledVector(dir, Math.random() * head)
          .addScaledVector(side, (Math.random() - 0.5) * 0.7).addScaledVector(this.up, (Math.random() - 0.5) * 0.7);
        this.c.copy(dir).multiplyScalar(sp)
          .addScaledVector(side, (Math.random() - 0.5) * 3).addScaledVector(this.up, (Math.random() - 0.5) * 3);
        this.streaks.spawn(this.a, this.c, 0.2 + Math.random() * 0.25, 0.06 + Math.random() * 0.05);
      }
      if (hitOn) {
        this.hitSparkAcc += 70 * dt;
        while (this.hitSparkAcc >= 1) {
          this.hitSparkAcc -= 1;
          const sp = 7 + Math.random() * 10;
          this.c.copy(dir).multiplyScalar(-sp)
            .addScaledVector(side, (Math.random() - 0.5) * 7).addScaledVector(this.up, Math.random() * 5);
          this.streaks.spawn(this.tgtChest, this.c, 0.3 + Math.random() * 0.3, 0.06 + Math.random() * 0.04, 9);
        }
      }
    }

    // --- Target end: flickering star, glow, a small ground ring on every hit. ---
    const flick = hitOn ? 0.3 + 0.7 * widthK : 0;
    this.hitStar.set(this.tgtChest, 1.3 * (0.8 + 0.4 * Math.random()) * flick, flick > 0 ? 1 : 0, Math.random() * 6.28);
    this.hitGlow.mesh.position.copy(this.tgtChest);
    this.hitGlow.mesh.scale.setScalar(1.1 + 0.3 * Math.random());
    this.hitGlow.opacity = 0.3 * flick * fade;
    const tickAge = t - this.lastTickAt;
    this.hitRing.mesh.position.set(this.tgtFeet.x, 0.05, this.tgtFeet.z);
    if (this.lastTickAt >= 0 && tickAge < 0.3) {
      this.hitRing.mesh.scale.setScalar(0.6 + tickAge * 7);
      this.hitRing.material.opacity = 0.5 * (1 - tickAge / 0.3);
    } else {
      this.hitRing.material.opacity = 0;
    }

    // --- Scorch line on the ground from the target to the beam end: grows with the beam, glows, goes dark. ---
    const slen = THREE.MathUtils.clamp(head - this.tgtDist, 0, BEYOND);
    if (slen > 0.05) {
      const yaw = Math.atan2(dir.x, dir.z);
      this.scorch.visible = true;
      this.scorch.position.copy(this.tgtFeet).addScaledVector(dir, slen / 2).setY(0.03);
      this.scorch.rotation.set(0, yaw, 0);
      this.scorch.scale.set(1.3, 1, slen);
      const u2 = this.scorchMat.uniforms;
      u2.uLen.value = slen;
      u2.uTime.value = t;
      u2.uGlow.value = (t < CUT ? 1 : Math.exp(-after * 2.2)) * (0.85 + 0.15 * Math.sin(t * 30));
      u2.uOpacity.value = 0.85 * fade;
    } else {
      this.scorch.visible = false;
    }
    // Dark puffs rise along the line while it burns; embers drift from it after the cut.
    if (dt > 0 && slen > 0.5) {
      const pointOnLine = (out: THREE.Vector3, y: number) =>
        out.copy(this.tgtFeet).addScaledVector(dir, Math.random() * slen).addScaledVector(side, (Math.random() - 0.5) * 0.9).setY(y);
      if (t < BEAM_END + 0.3) {
        this.smokeAcc += 14 * dt;
        while (this.smokeAcc >= 1) { this.smokeAcc -= 1; this.smokeP.burst(1, pointOnLine(this.a, 0.15)); }
      }
      if (t >= CUT - 0.2) {
        this.emberAcc += 45 * dt;
        while (this.emberAcc >= 1) { this.emberAcc -= 1; this.embers.burst(1, pointOnLine(this.a, 0.1)); }
      }
    }

    // --- The cut: flash, star + glint pop, shock ring, hit frames. ---
    this.cutFlash.mesh.position.copy(this.tgtChest);
    this.shock.mesh.position.set(this.tgtFeet.x, 0.06, this.tgtFeet.z);
    if (this.cut) {
      this.cutFlash.mesh.scale.setScalar(1.5 + after * 5);
      this.cutFlash.opacity = 0.55 * Math.exp(-after * 12);
      const pop = StarBurst.pop(after - 0.02, 0.1, 0.22);
      this.cutStar.set(this.tgtChest, 3.4 * pop.scale, pop.opacity, 0.4);
      const g = StarBurst.pop(after - 0.1, 0.05, 0.25);
      this.cutGlint.set(this.a.copy(this.tgtChest).setY(2.8), 1.0 * g.scale, g.opacity, t * 2);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.6));
    } else {
      this.cutFlash.opacity = 0;
      this.cutStar.set(this.tgtChest, 0, 0);
      this.cutGlint.set(this.tgtChest, 0, 0);
      this.shock.material.opacity = 0;
    }

    // --- Screen: the world darkens in the build-up and releases after the cut; impact frames at the cut. ---
    this.screen.darken = t < CUT ? 0.5 * smoothstep(t / 0.5) : 0.5 * Math.exp(-after * 4);
    this.screen.impact = impactFrameAt(t, CUT, [1, 2]);
    const lines = t < WIND_UP ? 0.5 * smoothstep((t - 0.35) / 0.35) : 0;
    this.screen.speedLines = lines;
    this.screen.focus.copy(hand);

    // --- Shake: release 0.3, 0.08 per tick, 0.5 on the cut. ---
    const tickShake = this.lastTickAt >= 0 ? 0.08 * Math.exp(-(t - this.lastTickAt) * 12) : 0;
    this.shake = Math.max(
      rel >= 0 ? 0.3 * Math.exp(-rel * 8) : 0,
      tickShake,
      this.cut ? 0.5 * Math.exp(-after * 6) : 0,
    );
  }

  private onTick(at: number) {
    this.lastTickAt = at;
    const ctx = this.ctx;
    const target = ctx?.targets[0];
    if (ctx && target) ctx.hit(target, { damage: this.settings.tickDamage, knock: 0.4, from: this.hand, color: '#e0b8ff' });
  }

  private onCut() {
    this.cut = true;
    const c = this.tgtChest;
    const v = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      v.randomDirection();
      v.y = Math.abs(v.y) * 0.8;
      v.multiplyScalar(8 + Math.random() * 12);
      v.addScaledVector(this.dir, 4);
      this.streaks.spawn(c, v, 0.35 + Math.random() * 0.4, 0.07 + Math.random() * 0.05, 9);
    }
    this.embers.burst(120, c);
    this.smokeP.burst(30, v.copy(this.tgtFeet).setY(0.4));
    this.smoke.trigger(v.copy(this.tgtFeet).setY(1), 1.5, 1.3);
    const ctx = this.ctx;
    const target = ctx?.targets[0];
    if (ctx && target) ctx.hit(target, { damage: this.settings.cutDamage, knock: 7, from: this.hand, color: '#f0d8ff' });
  }

  dispose() {
    this.under.dispose();
    this.electric.dispose();
    this.core.dispose();
    this.streaks.dispose();
    this.scorchGeo.dispose();
    this.scorchMat.dispose();
    this.moteGeo.dispose();
    this.moteMat.dispose();
    for (const r of [...this.rings, this.hitRing, this.shock]) {
      r.mesh.geometry.dispose();
      r.material.dispose();
    }
    for (const e of this.emitters) e.dispose();
  }
}

export const violetSeveranceModule: EffectModule = {
  label: 'violet severance',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new VioletSeverance(),
  telegraphs(effect) {
    const e = effect as VioletSeverance;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: e.lineEnd.x, z2: e.lineEnd.z, width: 1.4 },
      start: 0.05, impact: e.releaseTime, until: e.beamEndTime,
    }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as VioletSeverance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const v = effect as VioletSeverance;
    const s = v.settings;
    f.add(s, 'loop');
    f.add(s, 'beamWidth', 0.1, 0.8, 0.01).name('beam width');
    f.add(s, 'tickDamage', 1, 30, 1).name('tick damage');
    f.add(s, 'cutDamage', 1, 150, 1).name('cut damage');
  },
};
