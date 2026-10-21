import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, createSwordGeometry,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Divine Storm (reworked): the caster spins up holding a huge glowing sword, a golden whirlwind of ring blades
 * and rising motes forms around it, holy rings burst outward. The storm sweeps to the enemy, hits it again and
 * again, returns, and ends with a radial burst.
 */
export interface DivineStormSettings {
  swordScale: number;
  spinSpeed: number; // rad/s at full spin
  hitInterval: number; // seconds between hits on the enemy
  color: string;
  loop: boolean;
}

export const defaultDivineStorm = (): DivineStormSettings => ({
  swordScale: 2.5,
  spinSpeed: 22,
  hitInterval: 0.15,
  color: '#ffcf6a',
  loop: false,
});

const SPIN_UP = 0.9;
const OUT = [0.8, 1.7]; // travel to the enemy
const HIT = [1.7, 2.9]; // storm rages on the enemy
const BACK = [2.9, 3.7]; // travel home
const FINAL = 3.8; // radial burst
const AFTERMATH = 1.1;
const STORM_END_Z = 3.4;
const MOTES = 700;
const COLUMN_H = 5.5;
const BLADES = 3;
const HOLY_RINGS = 4;
const CHEST = new THREE.Vector3(0.4, 1.5, 0);

export class DivineStorm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DivineStormSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private lastHit = -1;
  private finalDone = false;

  private caster = createCaster();
  private enemy = new Enemy();
  private swordMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.7, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.7,
  });
  private sword = new THREE.Mesh(createSwordGeometry(), this.swordMat);
  private bladeMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private blades: THREE.Group[] = [];
  private holy = Array.from({ length: HOLY_RINGS }, () => createRing(0xffd27a, 0.88, 1, 64));
  private core = new GlowSphere(0xffd27a, { rim: false });
  private finalBurst = new GlowSphere(0xffd27a);
  private finalRing = createRing(0xffe2a0, 0.9, 1, 96);
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    color: 0xffd98a, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes: THREE.Points;
  private moteAngle = new Float32Array(MOTES);
  private moteSpin = new Float32Array(MOTES);
  private moteRise = new Float32Array(MOTES);
  private movePhase = new Float32Array(MOTES);
  private moteRad = new Float32Array(MOTES);
  private sparks: Emitter;
  private embers: Emitter;

  constructor(settings: DivineStormSettings = defaultDivineStorm()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    // The sword is a child of the caster, held out sideways: it swings around as the caster spins.
    this.sword.rotation.z = Math.PI / 2; // tip points +X, hilt toward the caster
    this.caster.group.add(this.sword);

    for (let i = 0; i < BLADES; i++) {
      const g = new THREE.Group();
      const r = 1.9 + i * 0.55;
      const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.28, 40, 1, 0, 2.3), this.bladeMat);
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      this.blades.push(g);
      this.group.add(g);
    }
    for (const r of this.holy) this.group.add(r.mesh);
    this.group.add(this.core.mesh, this.finalBurst.mesh, this.finalRing.mesh);

    const pos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      this.moteAngle[i] = Math.random() * Math.PI * 2;
      this.moteSpin[i] = 5 + Math.random() * 6;
      this.moteRise[i] = 0.25 + Math.random() * 0.35;
      this.movePhase[i] = Math.random();
      this.moteRad[i] = 0.7 + Math.random() * 0.6;
    }
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(this.moteGeo, this.moteMat);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 2500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 9, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.85, opacityEnd: 0, additive: true,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.8, speed: 1.2, speedJitter: 0.5, spread: 180, gravity: -1.2, drag: 0.5,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.sparks, this.embers);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.swordMat.emissive.set(c);
    this.bladeMat.color.set(c);
    this.core.color.set(c);
    this.finalBurst.color.set(c);
    this.embers.settings.colorEnd = c;
    this.embers.applyStyle();
  }

  get duration() {
    return FINAL + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.lastHit = -1;
    this.finalDone = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** Storm centre z at time t. */
  private stormZ(t: number) {
    if (t < OUT[0]) return CASTER_POS.z;
    if (t < OUT[1]) return THREE.MathUtils.lerp(CASTER_POS.z, STORM_END_Z, smoothstep((t - OUT[0]) / (OUT[1] - OUT[0])));
    if (t < BACK[0]) return STORM_END_Z;
    if (t < BACK[1]) return THREE.MathUtils.lerp(STORM_END_Z, CASTER_POS.z, smoothstep((t - BACK[0]) / (BACK[1] - BACK[0])));
    return CASTER_POS.z;
  }

  /** Integrated spin angle: linear ramp-up, then constant speed. */
  private spinAngle(t: number) {
    const w = this.settings.spinSpeed;
    const end = BACK[1] + 0.1;
    const tt = Math.min(t, end);
    const a = tt < SPIN_UP ? (w * tt * tt) / (2 * SPIN_UP) : (w * SPIN_UP) / 2 + w * (tt - SPIN_UP);
    // After the storm ends the caster winds down to a stop.
    const extra = t > end ? Math.min(t - end, 0.3) : 0;
    return a + w * (extra - (extra * extra) / 0.6);
  }

  /** Whirlwind strength, 0..1. */
  private strength(t: number) {
    return smoothstep(t / SPIN_UP) * (1 - smoothstep((t - (BACK[1] - 0.05)) / 0.3));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const t = this.time;
    const k = this.strength(t);
    const sz = this.stormZ(t);

    // Repeated hits on the enemy.
    if (t >= HIT[0] && t < HIT[1]) {
      const idx = Math.floor((t - HIT[0]) / this.settings.hitInterval);
      if (idx !== this.lastHit) {
        this.lastHit = idx;
        this.sparks.burst(120, CHEST);
        this.shake = 0.3;
      }
    }
    // Embers shed by the whirlwind.
    if (k > 0.05) this.embers.burst(Math.ceil(700 * dt * k), new THREE.Vector3(0, 1.5, sz));
    if (!this.finalDone && t >= FINAL) this.onFinal();
    this.layout();
  }

  private layout() {
    const t = this.time;
    const s = this.settings;
    const k = this.strength(t);
    const sz = this.stormZ(t);
    const fade = 1 - smoothstep((t - (this.duration - 0.6)) / 0.6);

    // Caster spins in place (moving with the storm) holding the big sword out sideways.
    this.caster.group.position.set(CASTER_POS.x, 0, sz);
    this.caster.group.rotation.y = this.spinAngle(t);
    this.sword.scale.setScalar(s.swordScale);
    this.sword.position.set(0.5 + 0.98 * s.swordScale - 0.15, 1.7, 0);
    this.swordMat.emissiveIntensity = 0.5 + 0.5 * k;

    // Ring blades: spin at different rates around the caster.
    for (let i = 0; i < this.blades.length; i++) {
      const g = this.blades[i];
      g.position.set(CASTER_POS.x, 0.6 + i * 0.9 + 0.15 * Math.sin(t * 6 + i), sz);
      g.rotation.y = t * (9 + i * 3) * (i % 2 ? -1 : 1) + i * 2;
      g.scale.setScalar(0.7 + 0.3 * k);
      g.visible = k > 0.02;
    }
    this.bladeMat.opacity = 0.4 * k * fade;

    // Column of motes: orbit and rise, widening toward the top.
    const posAttr = this.moteGeo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < MOTES; i++) {
      const h01 = (this.movePhase[i] + t * this.moteRise[i]) % 1;
      const a = this.moteAngle[i] + t * this.moteSpin[i];
      const r = (0.8 + 1.5 * h01) * this.moteRad[i] * (0.4 + 0.6 * k);
      arr[i * 3] = CASTER_POS.x + Math.cos(a) * r;
      arr[i * 3 + 1] = h01 * COLUMN_H;
      arr[i * 3 + 2] = sz + Math.sin(a) * r;
    }
    posAttr.needsUpdate = true;
    this.moteMat.opacity = 0.5 * k * fade;

    // Core glow around the caster.
    this.core.mesh.position.set(CASTER_POS.x, 1.5, sz);
    this.core.mesh.scale.setScalar(1.6);
    this.core.opacity = 0.2 * k * fade;

    // Holy rings burst outward from the storm, staggered.
    for (let i = 0; i < this.holy.length; i++) {
      const p = (t * 1.6 + i / this.holy.length) % 1;
      const r = this.holy[i];
      r.mesh.position.set(CASTER_POS.x, 0.05, sz);
      r.mesh.scale.setScalar(1.2 + 6.5 * p);
      r.material.opacity = 0.45 * (1 - p) * k * fade;
    }

    // Enemy: flash pulses with every hit and shudders while the storm is on it.
    if (t >= HIT[0] && t < HIT[1] + 0.4) {
      const ph = (t - HIT[0]) % s.hitInterval;
      const on = t < HIT[1] ? 1 : Math.exp(-(t - HIT[1]) * 8);
      this.enemy.setFlash(1.1 * Math.exp(-ph * 14) * on);
      const jitter = 0.18 * on;
      this.enemy.group.position.set(ENEMY_POS.x + Math.sin(t * 90) * jitter, 0, ENEMY_POS.z - 0.3 * on);
      this.enemy.group.rotation.x = -0.12 * on;
    } else {
      this.enemy.setFlash(0);
      this.enemy.group.position.copy(ENEMY_POS);
      this.enemy.group.rotation.x = 0;
    }

    // Final radial burst at the caster's home.
    const after = t - FINAL;
    if (this.finalDone) {
      this.finalBurst.mesh.position.set(CASTER_POS.x, 1.5, CASTER_POS.z);
      this.finalBurst.mesh.scale.setScalar(1 + after * 12);
      this.finalBurst.opacity = 0.55 * Math.exp(-after * 4.5);
      this.finalRing.mesh.position.set(CASTER_POS.x, 0.05, CASTER_POS.z);
      this.finalRing.mesh.scale.setScalar(1 + after * 28);
      this.finalRing.material.opacity = Math.max(0, 0.8 * (1 - after / 0.8));
      this.shake = Math.max(this.shake, 0.5 * Math.exp(-after * 7));
    } else {
      this.finalBurst.opacity = 0;
      this.finalRing.material.opacity = 0;
      this.shake *= 0.85;
    }
  }

  private onFinal() {
    this.finalDone = true;
    this.sparks.burst(900, new THREE.Vector3(CASTER_POS.x, 1.5, CASTER_POS.z));
    this.embers.burst(300, new THREE.Vector3(CASTER_POS.x, 1.5, CASTER_POS.z));
  }
}

export const divineStormModule: EffectModule = {
  label: 'divine storm',
  category: 'paladin',
  create: () => new DivineStorm(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14, storm travels to z = 3.4, enemy at 0.
    frameArena(camera, controls, new THREE.Vector3(0, 2, 7), 11);
  },
  buildGui(f, effect) {
    const e = effect as DivineStorm;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'swordScale', 1, 5, 0.1).name('sword scale');
    f.add(s, 'spinSpeed', 6, 40, 0.5).name('spin speed');
    f.add(s, 'hitInterval', 0.08, 0.4, 0.01).name('hit interval');
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
