import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, createSwordGeometry,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Wake of Ashes (reworked): the caster hoists a giant two-handed blade, drives it into the ground, and a 70 degree
 * fan of fire and holy ash tears along the floor with glowing cracks behind it and spinning blades of light inside.
 * The wave engulfs the enemy and knocks it flat; embers and ash drift down afterwards.
 */
export interface WakeOfAshesSettings {
  swordScale: number;
  waveSpeed: number;
  fanAngle: number; // degrees
  color: string;
  loop: boolean;
}

export const defaultWakeOfAshes = (): WakeOfAshesSettings => ({
  swordScale: 3,
  waveSpeed: 13,
  fanAngle: 70,
  color: '#ff9a3a',
  loop: false,
});

const RAISE = 1.1; // seconds to hoist the sword
const SLAM = 0.2; // seconds of the downswing
const IMPACT = RAISE + SLAM;
const MAX_DIST = 17;
const TAIL = 3.0; // aftermath after the wave has passed the enemy
const BLADES = 3;
const CRACKS = 15;
const SEGS = 3;
const SWORD_LEN = 0.86; // hilt position along the unit sword geometry
const THETA_UP = Math.PI + 0.4; // blade up and slightly back
const THETA_DOWN = 0.35; // blade down and slightly forward

const rng = (() => {
  let s = 1234567;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
})();

interface CrackSeg { mesh: THREE.Mesh; x: number; z: number; dx: number; dz: number; len: number; s0: number }

export class WakeOfAshes implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WakeOfAshesSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private hitDone = false;
  private fanBuilt = -1;
  private impactPos = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  private caster = createCaster();
  private enemy = new Enemy();
  private swordMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.7, roughness: 0.35, emissive: 0xffa040, emissiveIntensity: 0.7, transparent: true,
  });
  private swordPivot = new THREE.Group();
  private sword = new THREE.Mesh(createSwordGeometry(), this.swordMat);
  private swordGlow = new GlowSphere(0xffb060, { rim: false });
  private fanMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 0.5, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  private fan = new THREE.Mesh(new THREE.BufferGeometry(), this.fanMat);
  private bladeMat = new THREE.MeshBasicMaterial({
    color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private blades: THREE.Group[] = [];
  private crackMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 0.5, 0.08), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private cracks: CrackSeg[] = [];
  private flash = new GlowSphere(0xffb060);
  private shock = createRing(0xffc070, 0.88, 1, 96);
  private fire: Emitter;
  private holy: Emitter;
  private embers: Emitter;
  private ash: Emitter;

  constructor(settings: WakeOfAshesSettings = defaultWakeOfAshes()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    this.sword.position.y = -SWORD_LEN * 3; // hilt sits at the pivot
    this.swordPivot.add(this.sword);
    this.group.add(this.swordPivot, this.swordGlow.mesh, this.fan, this.flash.mesh, this.shock.mesh);

    for (let i = 0; i < BLADES; i++) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 24, 1, 0, 2.2), this.bladeMat);
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      this.blades.push(g);
      this.group.add(g);
    }

    // Glowing ground cracks: wandering 3-segment paths radiating from the impact point (local to the impact).
    const segGeo = new THREE.PlaneGeometry(1, 0.16).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    for (let i = 0; i < CRACKS; i++) {
      let ang = THREE.MathUtils.degToRad(-42 + (84 * (i + rng() * 0.6)) / CRACKS);
      let x = 0, z = 0, s = 0.3 + rng() * 0.6;
      for (let j = 0; j < SEGS; j++) {
        ang += (rng() - 0.5) * 0.5;
        const len = 2.2 + rng() * 2.6;
        const dx = Math.sin(ang), dz = -Math.cos(ang);
        const mesh = new THREE.Mesh(segGeo, this.crackMat);
        mesh.rotation.y = -Math.atan2(dz, dx);
        this.cracks.push({ mesh, x, z, dx, dz, len, s0: s });
        this.group.add(mesh);
        x += dx * len; z += dz * len; s += len;
      }
    }

    this.fire = new Emitter({
      ...defaultSettings(), maxParticles: 2200, rate: 0, lifetime: 0.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 3.5, speedJitter: 0.6, spread: 35, gravity: -2.5, drag: 0.7,
      sizeStart: 0.95, sizeEnd: 0.2, colorStart: '#ffc060', colorEnd: '#b82a00',
      opacityStart: 0.32, opacityEnd: 0, additive: true,
    });
    this.holy = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 3, speedJitter: 0.6, spread: 60, gravity: -1.5, drag: 0.6,
      sizeStart: 0.2, sizeEnd: 0, colorStart: '#fff6d8', colorEnd: '#ffd36b',
      opacityStart: 0.7, opacityEnd: 0, additive: true,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'box', shapeSize: 0.5, speed: 1.4, speedJitter: 0.7, spread: 120, gravity: -0.6, drag: 0.7,
      sizeStart: 0.12, sizeEnd: 0, colorStart: '#ffd080', colorEnd: '#ff4a10',
      opacityStart: 0.8, opacityEnd: 0, additive: true,
    });
    this.ash = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 3, lifetimeJitter: 0.4,
      shape: 'box', shapeSize: 0.5, speed: 1.2, speedJitter: 0.7, spread: 150, gravity: 0.15, drag: 0.8,
      sizeStart: 0.24, sizeEnd: 0.1, colorStart: '#b8aea2', colorEnd: '#3a3430',
      opacityStart: 0.5, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.fire, this.holy, this.embers, this.ash);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = new THREE.Color(this.settings.color);
    this.swordMat.emissive.copy(c);
    this.swordGlow.color.copy(c);
    this.flash.color.copy(c);
    this.fire.settings.colorStart = '#' + c.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString();
    this.fire.applyStyle();
  }

  private get hitTime() {
    return IMPACT + this.impactPos.distanceTo(ENEMY_POS) / this.settings.waveSpeed;
  }

  get duration() {
    return this.hitTime + TAIL;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.hitDone = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.impactPos.set(0, 0, CASTER_POS.z - 1.9);
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** Distance the wave front has travelled from the impact point. */
  private dist(t: number) {
    return THREE.MathUtils.clamp((t - IMPACT) * this.settings.waveSpeed, 0, MAX_DIST);
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
    if (!this.impacted && t >= IMPACT) this.onImpact();
    if (this.impacted) this.emitWave(dt);
    if (!this.hitDone && t >= this.hitTime) this.onEnemyHit();
    this.layout();
  }

  private emitWave(dt: number) {
    const t = this.time;
    const d = this.dist(t);
    const half = THREE.MathUtils.degToRad(this.settings.fanAngle / 2);
    if (d < MAX_DIST - 0.01) {
      // Wall of flame along the widening front arc.
      const n = Math.ceil(1100 * dt);
      for (let i = 0; i < n; i++) {
        const phi = (Math.random() * 2 - 1) * half;
        const r = Math.max(0.2, d - Math.random() * 1.6);
        this.tmp.set(this.impactPos.x + Math.sin(phi) * r, 0.15, this.impactPos.z - Math.cos(phi) * r);
        this.fire.burst(1, this.tmp);
        if (i % 4 === 0) this.holy.burst(1, this.tmp);
      }
    }
    // Ash and embers settle over the whole scorched fan for a while after.
    if (t > IMPACT + 0.3 && t < this.duration - 0.8) {
      const n = Math.ceil(240 * dt);
      for (let i = 0; i < n; i++) {
        const phi = (Math.random() * 2 - 1) * half;
        const r = Math.random() * Math.min(d, MAX_DIST);
        this.tmp.set(this.impactPos.x + Math.sin(phi) * r, 0.2, this.impactPos.z - Math.cos(phi) * r);
        (i % 2 ? this.embers : this.ash).burst(1, this.tmp);
      }
    }
    // The enemy burns while engulfed.
    if (this.hitDone && t < this.hitTime + 1.0) {
      this.tmp.set(ENEMY_POS.x, 0.4, ENEMY_POS.z);
      this.fire.burst(Math.ceil(500 * dt), this.tmp);
    }
  }

  private layout() {
    const t = this.time;
    const s = this.settings;
    const after = t - IMPACT;
    const d = this.dist(t);
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const half = THREE.MathUtils.degToRad(s.fanAngle / 2);

    // Sword: hoisted back and up, then driven into the ground in front of the caster.
    let theta: number;
    if (t < RAISE) theta = -(2 * Math.PI - THETA_UP) * smoothstep(t / RAISE);
    else if (t < IMPACT) theta = THREE.MathUtils.lerp(THETA_UP, THETA_DOWN, Math.pow((t - RAISE) / SLAM, 2.2));
    else theta = THETA_DOWN;
    const scale = s.swordScale;
    const reach = SWORD_LEN * scale;
    this.sword.scale.setScalar(scale);
    this.sword.position.y = -reach;
    this.swordPivot.rotation.set(theta, 0, 0);
    this.swordPivot.position.set(0, reach * Math.cos(THETA_DOWN), this.impactPos.z + reach * Math.sin(THETA_DOWN));
    const charge = smoothstep(t / RAISE);
    this.swordMat.emissiveIntensity = this.impacted ? 0.7 + 1.5 * Math.exp(-after * 3) : 0.5 + 0.9 * charge;
    this.swordMat.opacity = 1 - smoothstep((after - 1.6) / 0.8);
    this.sword.visible = this.swordMat.opacity > 0.01;
    // Soft glow along the raised blade.
    this.tmp.set(0, -Math.cos(theta), -Math.sin(theta)).multiplyScalar(reach * 0.55).add(this.swordPivot.position);
    this.swordGlow.mesh.position.copy(this.tmp);
    this.swordGlow.mesh.scale.setScalar(1.3 + 0.6 * charge);
    this.swordGlow.opacity = (this.impacted ? 0.3 * Math.exp(-after * 4) : 0.3 * charge) * fade;

    // Caster rears back while hoisting, drops into the swing.
    const lean = t < RAISE ? smoothstep(t / RAISE) : t < IMPACT ? 1 - (t - RAISE) / SLAM : 0;
    this.caster.group.rotation.x = 0.18 * lean - (this.impacted ? 0.2 * Math.exp(-after * 5) : 0);
    this.caster.setFlash(0.35 * charge * (this.impacted ? 0 : 1));

    // Fan wedge on the ground: the flame wall's footprint, scaled to the front distance.
    if (this.fanBuilt !== s.fanAngle) {
      this.fan.geometry.dispose();
      this.fan.geometry = new THREE.RingGeometry(0.62, 1, 32, 1, Math.PI / 2 - half, half * 2);
      this.fanBuilt = s.fanAngle;
    }
    this.fan.rotation.x = -Math.PI / 2;
    this.fan.position.set(this.impactPos.x, 0.05, this.impactPos.z);
    this.fan.scale.setScalar(Math.max(d, 0.001));
    const waveLive = this.impacted && d < MAX_DIST - 0.01 ? 1 : this.impacted ? Math.max(0, 1 - (after - MAX_DIST / s.waveSpeed) / 0.6) : 0;
    this.fanMat.opacity = 0.3 * waveLive * fade;
    this.fan.visible = this.fanMat.opacity > 0.005;

    // Spinning blades of light inside the wave.
    for (let i = 0; i < this.blades.length; i++) {
      const phi = half * (i - 1) * 0.65;
      const r = Math.max(0, d - 1.8 - i * 0.5);
      const g = this.blades[i];
      g.position.set(this.impactPos.x + Math.sin(phi) * r, 0.9 + 0.15 * i, this.impactPos.z - Math.cos(phi) * r);
      g.rotation.y = t * 14 * (i % 2 ? -1 : 1) + i * 2;
      g.scale.setScalar(1.1 + 0.2 * i);
      g.visible = waveLive > 0 && d > 1.5;
    }
    this.bladeMat.opacity = 0.4 * waveLive * fade;

    // Ground cracks: spread outward with the wave, then cool slowly.
    const heat = this.impacted ? 0.85 * (1 - 0.65 * smoothstep(after / 3.5)) : 0;
    this.crackMat.opacity = heat * fade;
    for (const c of this.cracks) {
      const prog = THREE.MathUtils.clamp((d * 1.1 - c.s0) / c.len, 0, 1);
      c.mesh.visible = prog > 0 && this.crackMat.opacity > 0.005;
      c.mesh.position.set(this.impactPos.x + c.x, 0.06, this.impactPos.z + c.z);
      c.mesh.scale.set(c.len * prog, 1, 1);
    }

    // Impact flash + shockwave.
    if (this.impacted) {
      this.flash.mesh.position.set(this.impactPos.x, 0.8, this.impactPos.z);
      this.flash.mesh.scale.setScalar(1 + after * 9);
      this.flash.opacity = 0.55 * Math.exp(-after * 5);
      this.shock.mesh.position.set(this.impactPos.x, 0.05, this.impactPos.z);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.6 * (1 - after / 0.7));
      this.shake = Math.max(0, 0.5 * Math.exp(-after * 6));
    } else {
      this.flash.opacity = 0;
      this.shock.material.opacity = 0;
    }

    // Enemy: engulfed, flashes, then is knocked flat and gets back up at the end.
    if (this.hitDone) {
      const a = t - this.hitTime;
      const fall = smoothstep(a / 0.35) * (1 - smoothstep((t - (this.duration - 1.0)) / 0.7));
      this.enemy.setFlash(1.5 * Math.exp(-a * 3));
      this.enemy.group.position.set(ENEMY_POS.x, 0.5 * fall, ENEMY_POS.z - 1.6 * fall);
      this.enemy.group.rotation.x = -1.35 * fall;
      this.shake = Math.max(this.shake, 0.4 * Math.exp(-a * 5));
    }
  }

  private onImpact() {
    this.impacted = true;
    this.fire.burst(300, this.impactPos);
    this.embers.burst(200, this.impactPos);
  }

  private onEnemyHit() {
    this.hitDone = true;
    this.tmp.set(ENEMY_POS.x, 1.2, ENEMY_POS.z);
    this.fire.burst(500, this.tmp);
    this.holy.burst(250, this.tmp);
    this.embers.burst(250, this.tmp);
    this.ash.burst(300, this.tmp);
  }
}

export const wakeOfAshesModule: EffectModule = {
  label: 'wake of ashes',
  category: 'paladin',
  create: () => new WakeOfAshes(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Impact at z ~ 12, wave runs to the enemy at 0 and beyond.
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 6), 12);
  },
  buildGui(f, effect) {
    const e = effect as WakeOfAshes;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'swordScale', 1.5, 6, 0.1).name('sword scale');
    f.add(s, 'waveSpeed', 6, 30, 0.5).name('wave speed');
    f.add(s, 'fanAngle', 30, 120, 1).name('fan angle');
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
