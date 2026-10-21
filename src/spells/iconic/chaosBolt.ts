import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Chaos Bolt: a heavy warlock cast. Green and orange fel flames swirl round the hands with crackling arcs, then a
 * jagged, unstable bolt of chaos launches slowly, accelerates, and leaves a twisting double-helix trail. Impact is
 * a big chaotic explosion that crushes the enemy.
 */
export interface ChaosBoltSettings {
  castTime: number; // seconds of hand-flame build-up before the launch
  flightTime: number;
  boltSize: number;
  loop: boolean;
}

export const defaultChaosBolt = (): ChaosBoltSettings => ({
  castTime: 1.3,
  flightTime: 0.9,
  boltSize: 1,
  loop: false,
});

const AFTERMATH = 2.4;
const GREEN = 0x5bff3a;
const ORANGE = 0xff7a1a;
const SHARDS = 7;
const BURN = 1.6; // seconds the fel fire keeps burning after the impact

/** Emits `rate` particles per second as a whole number of particles for this frame. */
function emit(e: Emitter, rate: number, dt: number, at: THREE.Vector3) {
  const n = rate * dt;
  const count = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
  if (count > 0) e.burst(count, at);
}

/** A set of jagged crackling lines that is regenerated every frame. */
class Arcs {
  readonly lines: THREE.LineSegments;
  private material: THREE.LineBasicMaterial;
  private positions: Float32Array;

  constructor(color: number, private arcs: number, private segs: number) {
    this.positions = new Float32Array(arcs * segs * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
  }

  update(from: THREE.Vector3, reach: number, opacity: number) {
    this.material.opacity = opacity;
    this.lines.visible = opacity > 0.01;
    if (!this.lines.visible) return;
    const p = this.positions;
    let k = 0;
    for (let a = 0; a < this.arcs; a++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      const len = reach * (0.5 + Math.random() * 0.8);
      let prev = from.clone();
      for (let s = 1; s <= this.segs; s++) {
        const next = from.clone().addScaledVector(dir, (len * s) / this.segs);
        next.x += (Math.random() - 0.5) * 0.25; next.y += (Math.random() - 0.5) * 0.25; next.z += (Math.random() - 0.5) * 0.25;
        p[k++] = prev.x; p[k++] = prev.y; p[k++] = prev.z;
        p[k++] = next.x; p[k++] = next.y; p[k++] = next.z;
        prev = next;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export class ChaosBolt implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ChaosBoltSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster(0x4a2a5a);
  private enemy = new Enemy();
  private handL = new THREE.Vector3(-0.55, 1.8, CASTER_POS.z - 0.4);
  private handR = new THREE.Vector3(0.55, 1.8, CASTER_POS.z - 0.4);
  private start = new THREE.Vector3(0, 2.1, CASTER_POS.z - 0.8);
  private end = new THREE.Vector3(0, 1.3, 0.2);
  private boltPos = new THREE.Vector3();
  private lastBoltPos = new THREE.Vector3();
  private arcsG = new Arcs(GREEN, 6, 5);
  private arcsO = new Arcs(ORANGE, 6, 5);
  private core = new GlowSphere(0xa6ff5a, { rim: false });
  private halo = new GlowSphere(ORANGE);
  private shardMats = [
    new THREE.MeshStandardMaterial({ color: 0x103008, emissive: GREEN, emissiveIntensity: 1, transparent: true }),
    new THREE.MeshStandardMaterial({ color: 0x301408, emissive: ORANGE, emissiveIntensity: 1, transparent: true }),
  ];
  private shards: THREE.Mesh[] = [];
  private bursts: { sphere: GlowSphere; delay: number; speed: number; peak: number; y: number }[] = [];
  private shockG = createRing(GREEN, 0.9, 1, 96);
  private shockO = createRing(ORANGE, 0.85, 0.95, 96);
  private scorch = createRing(0x7bff3a, 0.2, 1, 48);
  private handFlameG: Emitter;
  private handFlameO: Emitter;
  private trailG: Emitter;
  private trailO: Emitter;
  private fireG: Emitter;
  private fireO: Emitter;
  private smoke: Emitter;
  private sparksG: Emitter;
  private sparksO: Emitter;

  constructor(settings: ChaosBoltSettings = defaultChaosBolt()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.arcsG.lines, this.arcsO.lines, this.core.mesh, this.halo.mesh);
    this.group.add(this.shockG.mesh, this.shockO.mesh, this.scorch.mesh);

    const shardGeo = new THREE.OctahedronGeometry(1, 0);
    for (let i = 0; i < SHARDS; i++) {
      const m = new THREE.Mesh(shardGeo, this.shardMats[i % 2]);
      this.shards.push(m);
      this.group.add(m);
    }
    const plan = [
      { delay: 0, speed: 16, peak: 5, y: 1.3 },
      { delay: 0.05, speed: 14, peak: 4.4, y: 1.0 },
      { delay: 0.12, speed: 11, peak: 6.2, y: 1.8 },
      { delay: 0.2, speed: 9, peak: 5, y: 1.2 },
    ];
    plan.forEach((p, i) => {
      const sphere = new GlowSphere(i % 2 === 0 ? GREEN : ORANGE);
      this.bursts.push({ sphere, ...p });
      this.group.add(sphere.mesh);
    });

    const flame = (a: string, m: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 1.2, speedJitter: 0.5, spread: 180, gravity: -2.5, drag: 1,
      sizeStart: 0.35, sizeEnd: 0.02, colorStart: a, colorMid: m, colorEnd: b, opacityStart: 0.5, opacityEnd: 0, additive: true,
      sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.handFlameG = flame('#b8ff7a', '#3ad020', '#1f9a10');
    this.handFlameO = flame('#ffd070', '#ff7a1a', '#ff3a00');

    const trail = (a: string, m: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 2000, rate: 0, lifetime: 0.6, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 0.08, speed: 0.4, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1,
      sizeStart: 0.4, sizeEnd: 0.04, colorStart: a, colorMid: m, colorEnd: b, opacityStart: 0.5, opacityEnd: 0, additive: true,
      sizeJitter: 0.4, erosion: 0.4, spin: 0.3,
    });
    this.trailG = trail('#c8ff80', '#4ad828', '#1a8a10');
    this.trailO = trail('#ffc060', '#ff7a1a', '#d02800');

    const fire = (a: string, m: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 1000, rate: 0, lifetime: 1, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 3, speed: 3, speedJitter: 0.6, spread: 35, gravity: -2, drag: 0.8,
      sizeStart: 0.7, sizeEnd: 0.05, colorStart: a, colorMid: m, colorEnd: b, opacityStart: 0.4, opacityEnd: 0, additive: true,
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    this.fireG = fire('#b0ff70', '#3ad020', '#1a8a10');
    this.fireO = fire('#ffb040', '#ff6a10', '#c82400');

    const sparks = (a: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 13, speedJitter: 0.6, spread: 180, gravity: 12, drag: 0.7,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: a, colorEnd: b, opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.sparksG = sparks('#e8ffb0', '#3acc20');
    this.sparksO = sparks('#fff0b0', '#ff7a10');

    // Dark fel smoke behind the bright explosion (normal blending, so it comes first).
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 3, speedJitter: 0.5, spread: 180, gravity: -0.4, drag: 1.2,
      sizeStart: 1.0, sizeEnd: 3.2, colorStart: '#4a5a3a', colorMid: '#2a3220', colorEnd: '#0e100a',
      opacityStart: 0.35, opacityEnd: 0, additive: false,
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });

    this.emitters.push(
      this.smoke, this.handFlameG, this.handFlameO, this.trailG, this.trailO, this.fireG, this.fireO, this.sparksG, this.sparksO,
    );
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return this.settings.castTime + this.settings.flightTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.boltPos.copy(this.start);
    this.lastBoltPos.copy(this.start);
    for (const e of this.emitters) e.clear();
    this.fireG.settings.rate = 0;
    this.fireO.settings.rate = 0;
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const impactTime = this.settings.castTime + this.settings.flightTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout();
    this.emitContinuous(dt);
  }

  /** Per-frame emitters that follow moving things: hand flames and the helix trail. */
  private emitContinuous(dt: number) {
    const s = this.settings;
    const t = this.time;
    if (t < s.castTime + 0.2) {
      const build = smoothstep(t / s.castTime);
      const a = t * 9;
      for (const [hand, sign] of [[this.handL, 1], [this.handR, -1]] as const) {
        const o = new THREE.Vector3(Math.cos(a * sign) * 0.35, Math.sin(a * sign * 1.3) * 0.25, Math.sin(a * sign) * 0.35).add(hand);
        emit(this.handFlameG, 70 * build, dt, o);
        const o2 = new THREE.Vector3(Math.cos(a * sign + Math.PI) * 0.35, Math.sin(a * sign * 1.3 + 2) * 0.25, Math.sin(a * sign + Math.PI) * 0.35).add(hand);
        emit(this.handFlameO, 70 * build, dt, o2);
      }
    }
    if (t > s.castTime && !this.impacted) {
      // Double helix: two streams offset by sin/cos around the path, half a turn apart.
      const ang = t * 20;
      const r = 0.55 * s.boltSize;
      const gOff = new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, 0).add(this.boltPos);
      const oOff = new THREE.Vector3(Math.cos(ang + Math.PI) * r, Math.sin(ang + Math.PI) * r, 0).add(this.boltPos);
      emit(this.trailG, 260, dt, gOff);
      emit(this.trailO, 260, dt, oOff);
    }
    if (this.impacted && t - (s.castTime + s.flightTime) < BURN) {
      const k = 1 - (t - (s.castTime + s.flightTime)) / BURN;
      this.fireG.settings.rate = 140 * k;
      this.fireO.settings.rate = 140 * k;
    } else {
      this.fireG.settings.rate = 0;
      this.fireO.settings.rate = 0;
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;
    const cast = smoothstep(t / s.castTime);
    const flying = t >= s.castTime && !this.impacted;

    // Crackling fel arcs on the hands while the cast builds.
    const arcOp = t < s.castTime + 0.15 ? 0.7 * cast : 0;
    this.arcsG.update(this.handL, 0.9, arcOp);
    this.arcsO.update(this.handR, 0.9, arcOp);

    // Bolt: forms between the hands, hangs there, launches slowly and accelerates.
    const form = smoothstep((t - s.castTime * 0.5) / (s.castTime * 0.5));
    const u = THREE.MathUtils.clamp((t - s.castTime) / s.flightTime, 0, 1);
    const p = Math.pow(u, 2.4);
    this.lastBoltPos.copy(this.boltPos);
    this.boltPos.lerpVectors(this.start, this.end, p);
    this.boltPos.y += Math.sin(u * Math.PI) * 0.5;
    const alive = (this.impacted ? 0 : 1) * form;
    const size = s.boltSize * (0.6 + 0.4 * form);

    this.core.mesh.position.copy(this.boltPos);
    this.core.mesh.scale.setScalar(0.55 * size * (1 + 0.15 * Math.sin(t * 40)));
    this.core.opacity = 0.6 * alive;
    this.halo.mesh.position.copy(this.boltPos);
    this.halo.mesh.scale.setScalar(1.0 * size);
    this.halo.opacity = 0.3 * alive;
    this.halo.color.set(Math.floor(t * 12) % 2 === 0 ? ORANGE : GREEN);

    for (let i = 0; i < SHARDS; i++) {
      const m = this.shards[i];
      const f = 20 + i * 3.7;
      m.position.set(
        this.boltPos.x + Math.sin(t * f + i) * 0.28 * size,
        this.boltPos.y + Math.cos(t * f * 1.3 + i * 2) * 0.28 * size,
        this.boltPos.z + Math.sin(t * f * 0.7 + i * 5) * 0.28 * size,
      );
      m.rotation.set(t * (4 + i), t * (6 - i * 0.7) + i, t * (3 + i * 1.3));
      m.scale.set(0.12 * size, 0.12 * size, (0.5 + 0.35 * (i % 3)) * size);
      m.visible = alive > 0.01;
    }
    for (const m of this.shardMats) m.opacity = alive;
    this.shardMats[0].emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 30);
    this.shardMats[1].emissiveIntensity = 0.7 + 0.3 * Math.cos(t * 30);

    // Impact: interleaved green / orange bursts, shockwaves, scorch.
    if (this.impacted) {
      for (const b of this.bursts) {
        const a = Math.max(0, after - b.delay);
        b.sphere.mesh.position.set(ENEMY_POS.x, b.y, ENEMY_POS.z);
        b.sphere.mesh.scale.setScalar(0.8 + a * b.speed);
        b.sphere.opacity = a > 0 ? Math.min(0.55, b.peak * 0.1) * Math.exp(-a * 4.5) : 0;
      }
      this.shockG.mesh.scale.setScalar(1 + after * 20);
      this.shockG.material.opacity = Math.max(0, 0.7 * (1 - after / 0.8));
      this.shockO.mesh.scale.setScalar(1 + Math.max(0, after - 0.12) * 16);
      this.shockO.material.opacity = after > 0.12 ? Math.max(0, 0.6 * (1 - (after - 0.12) / 0.8)) : 0;
      this.scorch.mesh.scale.setScalar(3.2);
      this.scorch.material.opacity = 0.35 * Math.exp(-after * 0.9);
      this.shake = 1.0 * Math.exp(-after * 4.5);
      this.enemy.setFlash(1.2 * Math.exp(-after * 5));
      this.enemy.setCrush(0.85 * smoothstep(after / 0.15) * (1 - smoothstep((after - 1.4) / 0.8)));
    } else {
      for (const b of this.bursts) b.sphere.opacity = 0;
      this.shockG.material.opacity = 0;
      this.shockO.material.opacity = 0;
      this.scorch.material.opacity = 0;
      this.shake = flying ? 0.04 * smoothstep(u) : 0;
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(ENEMY_POS.x, 0.4, ENEMY_POS.z);
    this.sparksG.burst(450, at);
    this.sparksO.burst(450, at);
    this.fireG.burst(220, at);
    this.fireO.burst(220, at);
    this.smoke.burst(300, at);
  }
}

export const chaosBoltModule: EffectModule = {
  label: 'chaos bolt',
  category: 'iconic',
  create: () => new ChaosBolt(),
  telegraphs(effect) {
    const s = (effect as ChaosBolt).settings;
    const impact = s.castTime + s.flightTime;
    return [
      // The bolt's flight path.
      { shape: { kind: 'line', x1: 0, z1: CASTER_POS.z - 0.8, x2: ENEMY_POS.x, z2: ENEMY_POS.z, width: 1.2 * s.boltSize }, start: 0.3, impact },
      // The explosion.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 7 }, start: 0.3, impact },
      // The fel fire keeps burning on the ground.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 3.2 }, start: 0.3, impact, until: impact + BURN },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 2.5, 7), 11);
  },
  buildGui(f, effect) {
    const s = (effect as ChaosBolt).settings;
    f.add(s, 'loop');
    f.add(s, 'castTime', 0.4, 3, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.3, 2, 0.05).name('flight time');
    f.add(s, 'boltSize', 0.5, 2.5, 0.05).name('bolt size');
  },
};
