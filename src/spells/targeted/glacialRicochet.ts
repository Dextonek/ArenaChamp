import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  GlowSphere, LightPillar, createRing, mergeParts, smoothstep, softDotTexture,
} from '../../effects/common';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/** Lit instances must never get a zero scale: a singular matrix gives NaN normals, which bloom spreads to a black frame. */
const MIN_SCALE = 1e-4;
const MIN_VEC = new THREE.Vector3(MIN_SCALE, MIN_SCALE, MIN_SCALE);

/**
 * Glacial Ricochet (targeted, chain of enemies): cold mist swirls around the caster while a spiky frost orb
 * grows above their hands. The orb is hurled at the first enemy and ricochets from target to target, each hop
 * faster and each hit bigger. A frost-lightning tether flickers ahead of every arrival; every hit erupts a
 * crown of ice spikes, a ring, shards and sparks. The last hit shatters the orb in a big burst.
 */
export interface GlacialRicochetSettings {
  chargeTime: number;
  hopTime: number;
  hopSpeedup: number;
  orbSize: number;
  damage: number;
  damageStep: number;
  color: string;
  loop: boolean;
}

export const defaultGlacialRicochet = (): GlacialRicochetSettings => ({
  chargeTime: 0.8,
  hopTime: 0.42,
  hopSpeedup: 0.85,
  orbSize: 1,
  damage: 22,
  damageStep: 6,
  color: '#8fd8ff',
  loop: false,
});

const MAX_TARGETS = 7;
const MIN_HOP = 0.2;
const AFTERMATH = 1.4;
const TETHER_WINDOW = 0.12;
const SPIKES = 8;
const SHARDS = 180;
const MOTES = 120;
const BOLTS = 3;
const SEGS = 10;
const CHEST = 1.1;

interface Spike { pos: THREE.Vector3; quat: THREE.Quaternion; height: number; width: number; delay: number }
interface Shard { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; age: number; live: boolean }

const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
};

/** A spiky ice orb: a small icosahedron with a cone on every vertex. */
function createSpikyOrbGeometry(): THREE.BufferGeometry {
  const core = new THREE.IcosahedronGeometry(0.3, 0);
  const parts: THREE.BufferGeometry[] = [core];
  const pos = core.attributes.position;
  const seen: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    if (seen.some((s) => s.distanceToSquared(v) < 1e-4)) continue;
    seen.push(v);
    const cone = new THREE.ConeGeometry(0.1, 0.5, 5).translate(0, 0.25 + 0.2, 0);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v));
    parts.push(cone);
  }
  return mergeParts(parts);
}

export class GlacialRicochet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GlacialRicochetSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Feet positions of the chain (or the aim point when no enemy is in range) and the time each hop lands. */
  waypoints: THREE.Vector3[] = [];
  arrivals: number[] = [];

  private time = 0;
  private hitsDone = 0;
  private hitTimes: number[] = [];
  private hitShake = 0;
  private frame = 0;

  private hand = new THREE.Vector3();
  private chests: THREE.Vector3[] = [];

  // Anticipation
  private casterRune = createRing(0x8fd8ff, 0.86, 1, 6);
  private casterRune2 = createRing(0xe0f8ff, 0.5, 0.56, 6);
  private handGlow = new GlowSphere(0xe0f8ff, { rim: false });
  private muzzle = new GlowSphere(0xffffff, { rim: false });
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({ a: Math.random() * Math.PI * 2, r: 1.6 + Math.random() * 2.4, y: Math.random() * 2.4, d: Math.random() * 0.4 }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.14, map: softDotTexture(), color: 0xe0f8ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);

  // Orb
  private orbMat = new THREE.MeshStandardMaterial({
    color: 0xcdeeff, metalness: 0.2, roughness: 0.3, emissive: 0x58b8f0, emissiveIntensity: 0.7, flatShading: true,
  });
  private orb = new THREE.Mesh(createSpikyOrbGeometry(), this.orbMat);
  private orbGlow = new GlowSphere(0x6ad0ff, { rim: false });

  // Tether (frost lightning)
  private tetherPos = new Float32Array(BOLTS * SEGS * 2 * 3);
  private tetherGeo = new THREE.BufferGeometry();
  private tetherMat = new THREE.LineBasicMaterial({
    color: 0xcfeeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private tether = new THREE.LineSegments(this.tetherGeo, this.tetherMat);
  private tetherJag = Array.from({ length: BOLTS * (SEGS + 1) }, () => ({ a: 0, b: 0 }));
  private tetherDrop = new Array<boolean>(BOLTS * SEGS).fill(false);
  private tetherSkip = false;

  // Per-hit
  private hitRings = Array.from({ length: MAX_TARGETS }, () => createRing(0xdff6ff, 0.8, 1, 64));
  private frostDiscs = Array.from({ length: MAX_TARGETS }, () => createRing(0x9fdcff, 0, 1, 48));
  private hitFlash = new GlowSphere(0xe0f8ff, { rim: false });
  private spikeMat = new THREE.MeshStandardMaterial({
    color: 0x7fc4e8, metalness: 0.1, roughness: 0.25, emissive: 0x3ab0ff, emissiveIntensity: 0.4,
  });
  private spikeMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 1, 6).translate(0, 0.5, 0), this.spikeMat, MAX_TARGETS * SPIKES);
  private spikes: Spike[] = Array.from({ length: MAX_TARGETS * SPIKES }, () => ({
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), height: 0, width: 1, delay: 0,
  }));
  private lastHitT = -10;

  private shardMat = new THREE.MeshStandardMaterial({
    color: 0xcfeaff, roughness: 0.2, metalness: 0.1, emissive: 0x58b8f0, emissiveIntensity: 0.4, flatShading: true,
  });
  private shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.2), this.shardMat, SHARDS);
  private shardState: Shard[] = Array.from({ length: SHARDS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 1, age: 0, live: false,
  }));
  private shardCursor = 0;

  // Final shatter
  private shatterFlash = new GlowSphere(0xffffff, { rim: false });
  private shatterShell = new GlowSphere(0x6ad0ff);
  private shockA = createRing(0xe0f8ff, 0.9, 1, 96);
  private shockB = createRing(0x58b8f0, 0.94, 1, 96);
  private pillar = new LightPillar(0x8fd8ff, 0.9);

  private mist: Emitter;
  private trail: Emitter;
  private sparks: Emitter;
  private wisps: Emitter;
  private snow: Emitter;
  private cloud: Emitter;
  private mistAcc = 0;
  private trailAcc = 0;
  private snowAcc = 0;

  private tmpP = new THREE.Vector3();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(settings: GlacialRicochetSettings = defaultGlacialRicochet()) {
    this.settings = settings;
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.tetherGeo.setAttribute('position', new THREE.BufferAttribute(this.tetherPos, 3));
    for (const o of [this.motes, this.shards, this.spikeMesh, this.tether]) o.frustumCulled = false;
    this.group.add(this.casterRune.mesh, this.casterRune2.mesh, this.handGlow.mesh, this.muzzle.mesh, this.motes);
    this.group.add(this.orb, this.orbGlow.mesh, this.tether);
    for (const r of this.hitRings) this.group.add(r.mesh);
    for (const r of this.frostDiscs) this.group.add(r.mesh);
    this.group.add(this.hitFlash.mesh, this.spikeMesh, this.shards);
    this.group.add(this.shatterFlash.mesh, this.shatterShell.mesh, this.shockA.mesh, this.shockB.mesh, this.pillar.mesh);

    this.mist = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.3, speed: 0.6, speedJitter: 0.7, spread: 180, gravity: -0.1, drag: 2,
      sizeStart: 0.8, sizeEnd: 1.8, colorStart: '#6a7f9a', colorEnd: '#1c2430',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#3a4a60', sizeJitter: 0.4, erosion: 0.6, spin: 0.5,
      groundFade: 0.3,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.16, speed: 0.6, speedJitter: 0.8, spread: 180, gravity: 0.3, drag: 2,
      sizeStart: 0.45, sizeEnd: 0.04, colorStart: '#ffffff', colorEnd: '#1a5ac0',
      opacityStart: 0.45, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.4, erosion: 0.5, spin: 0.6,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 9, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#4a8ad0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.wisps = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.1, speed: 1.4, speedJitter: 0.6, spread: 50, gravity: -0.5, drag: 0.9,
      sizeStart: 0.35, sizeEnd: 0.05, colorStart: '#d0f0ff', colorEnd: '#4a8ad0',
      opacityStart: 0.35, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.5, erosion: 0.55, spin: 0.5,
    });
    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'box', shapeSize: 1.2, speed: 0.4, speedJitter: 0.8, spread: 180, gravity: 0.7, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.05, colorStart: '#ffffff', colorEnd: '#bfe8ff',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0,
    });
    // Dark normal-blended cloud so the bright hits have something to read against.
    this.cloud = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 3, speedJitter: 0.6, spread: 75, gravity: -0.1, drag: 1.5,
      sizeStart: 0.8, sizeEnd: 2, colorStart: '#7f93ad', colorEnd: '#1c2430',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#46566c', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.mist, this.trail, this.sparks, this.wisps, this.snow, this.cloud);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    for (const r of [this.casterRune, this.shockB]) r.material.color.set(c);
    this.orbMat.emissive.set(c);
    this.shatterShell.color.set(c);
    this.trail.settings.colorMid = c;
    this.wisps.settings.colorMid = c;
    this.trail.applyStyle();
    this.wisps.applyStyle();
  }

  private get count() {
    return this.waypoints.length;
  }

  private get lastArrival() {
    return this.arrivals[this.count - 1] ?? this.settings.chargeTime;
  }

  get duration() {
    return this.lastArrival + AFTERMATH;
  }

  get impactTime() {
    return this.lastArrival;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = this.settings;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(fwd, 0.5).setY(2.7);
    const src = ctx.targetPos.length > 0 ? ctx.targetPos : [ctx.point];
    this.waypoints = src.slice(0, MAX_TARGETS).map((p) => p.clone().setY(0));
    this.chests = this.waypoints.map((p) => p.clone().setY(CHEST));
    this.arrivals = [];
    let t = s.chargeTime;
    let hop = s.hopTime;
    for (let i = 0; i < this.waypoints.length; i++) {
      t += Math.max(MIN_HOP, hop);
      this.arrivals.push(t);
      hop *= s.hopSpeedup;
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitsDone = 0;
    this.hitTimes = [];
    this.lastHitT = -10;
    this.hitShake = 0;
    this.shake = 0;
    this.mistAcc = this.trailAcc = this.snowAcc = 0;
    for (const e of this.emitters) e.clear();
    for (const sh of this.shardState) { sh.live = false; sh.p.set(0, -50, 0); }
    this.shardCursor = 0;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    while (this.hitsDone < this.count && this.time >= this.arrivals[this.hitsDone]) this.onHit(this.hitsDone);
    this.layout(dt);
  }

  /** Position on hop `hop` at u in 0..1: a slight arc, easing into speed. */
  private pathAt(hop: number, u: number, out: THREE.Vector3) {
    const a = hop === 0 ? this.hand : this.chests[hop - 1];
    const b = this.chests[hop];
    const e = u * (0.55 + 0.45 * u);
    const peak = 1.5 + 0.15 * a.distanceTo(b);
    out.lerpVectors(a, b, e);
    out.y += peak * Math.sin(Math.PI * u);
    return out;
  }

  private spawnShards(c: THREE.Vector3, n: number, speed: number, sizeMul = 1) {
    for (let i = 0; i < n; i++) {
      const sh = this.shardState[this.shardCursor];
      this.shardCursor = (this.shardCursor + 1) % SHARDS;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      sh.p.set(c.x, Math.max(0.3, c.y), c.z);
      sh.v.set(Math.cos(a) * sp, 3 + Math.random() * speed * 0.7, Math.sin(a) * sp);
      sh.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      sh.size = (0.5 + Math.random() * 0.7) * sizeMul;
      sh.age = 0;
      sh.live = true;
    }
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const n = this.count;
    const last = this.lastArrival;
    const after = t - last;
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);
    const from = this.ctx?.from ?? this.tmpA.set(0, 0, 0);
    if (dt > 0) this.frame++;

    // --- Anticipation: rune, mist, inward motes, growing orb. ---
    const charge = smoothstep(t / s.chargeTime);
    const released = t >= s.chargeTime;
    this.casterRune.mesh.position.set(from.x, 0.05, from.z);
    this.casterRune.mesh.scale.setScalar(1.2 + 1.5 * charge);
    this.casterRune.mesh.rotation.z = t * 2.5;
    this.casterRune.material.opacity = (released ? 0.6 * Math.exp(-(t - s.chargeTime) * 4) : 0.55 * charge) * fade;
    this.casterRune2.mesh.position.set(from.x, 0.06, from.z);
    this.casterRune2.mesh.scale.setScalar(1.2 + 1.5 * charge);
    this.casterRune2.mesh.rotation.z = -t * 3.5;
    this.casterRune2.material.opacity = this.casterRune.material.opacity * 0.7;

    if (dt > 0 && !released) {
      this.mistAcc += dt * 260 * (0.3 + charge);
      const k = Math.floor(this.mistAcc);
      this.mistAcc -= k;
      if (k > 0) this.mist.burst(k, this.tmpB.set(from.x, 0.5, from.z));
    }

    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const k = THREE.MathUtils.clamp((t / s.chargeTime - m.d) / (1 - m.d), 0, 1);
      const r = m.r * (1 - k * k);
      const a = m.a + k * 5;
      this.motePos[i * 3] = this.hand.x + Math.cos(a) * r;
      this.motePos[i * 3 + 1] = this.hand.y + (m.y - 1.2) * (1 - k);
      this.motePos[i * 3 + 2] = this.hand.z + Math.sin(a) * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = released ? 0 : 0.7 * smoothstep(t / 0.25);

    this.muzzle.mesh.position.copy(this.hand);
    this.muzzle.mesh.scale.setScalar(1 + (t - s.chargeTime) * 4);
    this.muzzle.opacity = released ? 0.8 * Math.exp(-(t - s.chargeTime) * 14) : 0;

    // --- The orb: held above the hand, then ricocheting hop by hop. ---
    const p = this.tmpP;
    let hop = -1;
    let orbOn = true;
    let orbScale = s.orbSize;
    if (!released) {
      p.copy(this.hand);
      orbScale = s.orbSize * (0.2 + 0.8 * charge);
    } else {
      for (let k = 0; k < n; k++) if (t < this.arrivals[k]) { hop = k; break; }
      if (hop < 0) {
        orbOn = false;
      } else {
        const start = hop === 0 ? s.chargeTime : this.arrivals[hop - 1];
        const u = THREE.MathUtils.clamp((t - start) / (this.arrivals[hop] - start), 0, 1);
        this.pathAt(hop, u, p);
        orbScale = s.orbSize * Math.pow(1.12, hop);
      }
    }
    const pulse = 1 + 0.06 * Math.sin(t * 30);
    this.orb.visible = orbOn && orbScale > 0.01;
    this.orb.position.copy(p);
    this.orb.scale.setScalar(orbScale * pulse);
    this.orb.rotation.set(t * 3, t * Math.PI * 8, 0);
    this.orbMat.emissiveIntensity = 0.6 + 0.4 * charge + 1.8 * Math.exp(-(t - this.lastHitT) * 10);
    this.orbGlow.mesh.position.copy(p);
    this.orbGlow.mesh.scale.setScalar(orbScale * 1.7);
    this.orbGlow.opacity = orbOn ? (released ? 0.4 : 0.35 * charge) * fade : 0;
    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.3 + 0.6 * charge);
    this.handGlow.opacity = released ? 0 : 0.3 * charge;

    if (dt > 0 && released && hop >= 0) {
      this.trailAcc += dt * 900;
      const k = Math.floor(this.trailAcc);
      this.trailAcc -= k;
      if (k > 0) this.trail.burst(k, p);
    }

    // --- Frost-lightning tether: flickers from the orb to the next target just before each arrival. ---
    let tetherOn = false;
    if (released && hop >= 0) {
      const tl = this.arrivals[hop] - t;
      if (tl <= TETHER_WINDOW) {
        const w = 1 - tl / TETHER_WINDOW;
        tetherOn = this.layoutTether(p, this.chests[hop], w);
      }
    }
    this.tether.visible = tetherOn;
    this.tetherMat.opacity = tetherOn ? 0.9 * fade : 0;

    // --- Per-hit: ring, frost disc, flash, spike crowns. ---
    this.hitFlash.mesh.visible = false;
    for (let h = 0; h < MAX_TARGETS; h++) {
      const ring = this.hitRings[h];
      const disc = this.frostDiscs[h];
      if (h >= this.hitsDone) { ring.material.opacity = 0; disc.material.opacity = 0; continue; }
      const c = this.waypoints[h];
      const age = t - this.hitTimes[h];
      ring.mesh.position.set(c.x, 0.07, c.z);
      ring.mesh.scale.setScalar(0.6 + age * 11);
      ring.material.opacity = Math.max(0, 0.8 * (1 - age / 0.35)) * fade;
      const sink = smoothstep((t - (last + 0.2 + h * 0.1)) / 0.4);
      disc.mesh.position.set(c.x, 0.03, c.z);
      disc.mesh.scale.setScalar(2.3 * smoothstep(age / 0.5) * (1 - sink * 0.3));
      disc.material.opacity = 0.2 * (1 - sink) * fade;
    }
    if (this.hitsDone > 0) {
      const age = t - this.lastHitT;
      const c = this.chests[this.hitsDone - 1];
      this.hitFlash.mesh.position.copy(c);
      this.hitFlash.mesh.scale.setScalar(1.1 + age * 6);
      this.hitFlash.opacity = 0.8 * Math.exp(-age * 18);
    }

    this.spikeMat.emissiveIntensity = 0.4 + 1.6 * Math.exp(-(t - this.lastHitT) * 6);
    const m = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    for (let h = 0; h < MAX_TARGETS; h++) {
      const sink = smoothstep((t - (last + 0.2 + h * 0.1)) / 0.4);
      for (let k = 0; k < SPIKES; k++) {
        const i = h * SPIKES + k;
        const sp = this.spikes[i];
        if (h >= this.hitsDone) { m.makeScale(MIN_SCALE, MIN_SCALE, MIN_SCALE); this.spikeMesh.setMatrixAt(i, m); continue; }
        const grow = easeOutBack((t - this.hitTimes[h] - sp.delay) / 0.08);
        const g = Math.max(0, t - this.hitTimes[h] - sp.delay) > 0 ? grow : 0;
        sc.set(sp.width * (1 - sink * 0.5), sp.height * g * (1 - sink), sp.width * (1 - sink * 0.5)).max(MIN_VEC);
        m.compose(sp.pos, sp.quat, sc);
        this.spikeMesh.setMatrixAt(i, m);
      }
    }
    this.spikeMesh.instanceMatrix.needsUpdate = true;

    // --- Final shatter: flash, shell, double ring, pillar. ---
    if (this.hitsDone >= n && n > 0) {
      const c = this.chests[n - 1];
      this.shatterFlash.mesh.position.copy(c);
      this.shatterFlash.mesh.scale.setScalar(1.8 + after * 5);
      this.shatterFlash.opacity = 0.95 * Math.exp(-after * 11);
      this.shatterShell.mesh.position.copy(c);
      this.shatterShell.mesh.scale.setScalar(1 + after * 11);
      this.shatterShell.opacity = 0.55 * Math.exp(-after * 4);
      this.shockA.mesh.position.set(c.x, 0.08, c.z);
      this.shockA.mesh.scale.setScalar(1 + after * 20);
      this.shockA.material.opacity = Math.max(0, 0.8 * (1 - after / 0.6));
      const a2 = after - 0.12;
      this.shockB.mesh.position.set(c.x, 0.09, c.z);
      this.shockB.mesh.scale.setScalar(1 + Math.max(0, a2) * 13);
      this.shockB.material.opacity = a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.9)) : 0;
      this.pillar.set(c.x, c.z, 0, 20, 0.45 * Math.exp(-after * 3) * fade);
      this.shardMat.emissiveIntensity = 0.4 + 0.8 * Math.exp(-after * 2);
    } else {
      this.shatterFlash.opacity = 0;
      this.shatterShell.opacity = 0;
      this.shockA.material.opacity = 0;
      this.shockB.material.opacity = 0;
      this.pillar.set(0, 0, 0, 1, 0);
    }

    // Camera shake: a kick per hit, decaying quickly.
    this.shake = this.hitShake * Math.exp(-(t - this.lastHitT) * 8);

    // Aftermath: snow drifts down over the chain.
    if (dt > 0 && n > 0 && after > 0 && after < 1.1) {
      this.snowAcc += dt * 140;
      const k = Math.floor(this.snowAcc);
      this.snowAcc -= k;
      for (let i = 0; i < k; i++) {
        const w = this.waypoints[Math.floor(Math.random() * n)];
        this.snow.burst(1, this.tmpB.set(w.x + (Math.random() - 0.5) * 3, 3.5 + Math.random() * 1.5, w.z + (Math.random() - 0.5) * 3));
      }
    }

    // --- Shards (instanced, gravity), shrinking after a while on the ground. ---
    const q = new THREE.Quaternion();
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (sh.live && dt > 0) {
        sh.age += dt;
        if (sh.p.y > 0.1 || sh.v.y > 0) {
          sh.v.y -= 20 * dt;
          sh.p.addScaledVector(sh.v, dt);
          sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
          if (sh.p.y < 0.1) { sh.p.y = 0.1; sh.v.set(0, 0, 0); sh.w.set(0, 0, 0); }
        }
      }
      const vis = sh.live ? sh.size * (1 - smoothstep((sh.age - 1.6) / 0.7)) : 0;
      m.compose(sh.p, q.setFromEuler(sh.r), sc.setScalar(Math.max(vis, MIN_SCALE)));
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
  }

  /** Builds the jagged tether from a to b. Returns false on a dropped (flicker) frame or a zero-length link. */
  private layoutTether(a: THREE.Vector3, b: THREE.Vector3, w: number): boolean {
    const dir = this.tmpA.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return false;
    dir.divideScalar(len);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();

    // Reroll the jitter every 2 frames; some frames drop out entirely for a high-contrast flicker.
    if (this.frame % 2 === 0) {
      for (const j of this.tetherJag) { j.a = (Math.random() - 0.5) * 2; j.b = (Math.random() - 0.5) * 2; }
      for (let i = 0; i < this.tetherDrop.length; i++) {
        const bolt = Math.floor(i / SEGS);
        this.tetherDrop[i] = bolt > 0 && Math.random() < 0.3;
      }
      this.tetherSkip = Math.random() < 0.15;
    }
    if (this.tetherSkip) return false;

    const amp = Math.min(1.6, 0.25 + len * 0.1);
    const pt = new THREE.Vector3();
    const prev = new THREE.Vector3();
    for (let bolt = 0; bolt < BOLTS; bolt++) {
      // Branches (bolts 1+) fade out before the trunk.
      const branchOn = bolt === 0 || w < 0.65;
      for (let sgm = 0; sgm <= SEGS; sgm++) {
        const f = sgm / SEGS;
        const jag = this.tetherJag[bolt * (SEGS + 1) + sgm];
        // Straight near the orb, more distortion toward the far end.
        const k = amp * f * Math.sin(Math.PI * f) * (bolt === 0 ? 0.7 : 1.3);
        pt.copy(a).addScaledVector(dir, len * f).addScaledVector(right, jag.a * k).addScaledVector(up, jag.b * k);
        if (sgm > 0) {
          const o = (bolt * SEGS + (sgm - 1)) * 6;
          const hidden = !branchOn || this.tetherDrop[bolt * SEGS + sgm - 1];
          const e = hidden ? prev : pt;
          this.tetherPos[o] = prev.x; this.tetherPos[o + 1] = prev.y; this.tetherPos[o + 2] = prev.z;
          this.tetherPos[o + 3] = e.x; this.tetherPos[o + 4] = e.y; this.tetherPos[o + 5] = e.z;
        }
        prev.copy(pt);
      }
    }
    this.tetherGeo.attributes.position.needsUpdate = true;
    return true;
  }

  private onHit(i: number) {
    this.hitsDone = i + 1;
    const s = this.settings;
    const t = this.arrivals[i];
    this.hitTimes[i] = t;
    this.lastHitT = t;
    const isLast = i === this.count - 1;
    const c = this.waypoints[i];
    const chest = this.chests[i];

    // Ice-spike crown: a tall centre spike plus a ring of shorter ones, tilted outward.
    const up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < SPIKES; k++) {
      const sp = this.spikes[i * SPIKES + k];
      const centre = k === 0;
      const a = (k / (SPIKES - 1)) * Math.PI * 2 + Math.random() * 0.4;
      const r = centre ? 0 : 0.8 + Math.random() * 0.5;
      sp.pos.set(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
      const tilt = centre ? 0 : 0.2 + Math.random() * 0.2;
      const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      sp.quat.setFromUnitVectors(up, dir);
      sp.height = centre ? 3 : 1.5 + Math.random() * 0.9;
      sp.width = centre ? 1.5 : 0.9 + Math.random() * 0.4;
      sp.delay = centre ? 0 : 0.01 + k * 0.012;
    }

    this.spawnShards(chest, 14, 8);
    this.sparks.burst(isLast ? 500 : 160, chest);
    this.cloud.burst(isLast ? 140 : 40, c);
    this.hitShake = isLast ? 0.5 : 0.18;

    if (isLast) {
      this.spawnShards(chest, 40, 12, 1.3);
      this.wisps.burst(220, c);
      this.cloud.burst(80, c);
      this.snow.burst(120, this.tmpB.set(c.x, 3, c.z));
    } else {
      this.wisps.burst(30, c);
    }

    const ctx = this.ctx;
    const target = ctx?.targets[i];
    if (ctx && target) {
      let damage = s.damage + s.damageStep * i;
      if (isLast) damage = Math.max(40, damage + 12);
      ctx.hit(target, { damage, knock: isLast ? 6 : 3, from: chest, color: '#8fd8ff' });
    }
  }
}

export const glacialRicochetModule: EffectModule = {
  label: 'glacial ricochet',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX_TARGETS },
  create: () => new GlacialRicochet(),
  telegraphs(effect) {
    const e = effect as GlacialRicochet;
    if (!e.ctx) return [];
    return e.waypoints.map((c, i) => ({
      shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: 1.8 },
      start: 0.1,
      impact: e.arrivals[i],
    }));
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as GlacialRicochet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const g = effect as GlacialRicochet;
    const s = g.settings;
    f.add(s, 'loop');
    f.add(s, 'chargeTime', 0.3, 2.5, 0.05).name('charge time');
    f.add(s, 'hopTime', 0.2, 1.2, 0.01).name('first hop time');
    f.add(s, 'hopSpeedup', 0.6, 1, 0.01).name('hop speed-up');
    f.add(s, 'orbSize', 0.4, 2.5, 0.05).name('orb size');
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'damageStep', 0, 20, 1).name('damage per hop');
    f.addColor(s, 'color').onChange(() => g.applyStyle());
  },
};
