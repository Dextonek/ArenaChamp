import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rain of Fire: a dark rune circle opens high above the enemy area and dozens of fel-green / orange meteors rain
 * down at staggered times onto random spots. Each landing splashes fire and leaves a scorch; the ground becomes a
 * burning field and the enemy flashes with the nearby hits.
 */
export interface RainOfFireSettings {
  meteors: number;
  areaRadius: number;
  rainTime: number; // seconds the rain keeps landing
  height: number; // rune height above the ground
  loop: boolean;
}

export const defaultRainOfFire = (): RainOfFireSettings => ({
  meteors: 44,
  areaRadius: 6,
  rainTime: 3.2,
  height: 22,
  loop: false,
});

const AFTERMATH = 0.9;
const OPEN = 0.7; // rune opening time
const GREEN = 0x5bff3a;
const ORANGE = 0xff7a1a;

interface Meteor {
  start: THREE.Vector3;
  end: THREE.Vector3;
  t0: number;
  fall: number;
  green: boolean;
  nearEnemy: boolean;
  landed: boolean;
  spin: number;
  size: number;
}

function emit(e: Emitter, rate: number, dt: number, at: THREE.Vector3) {
  const n = rate * dt;
  const count = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
  if (count > 0) e.burst(count, at);
}

export class RainOfFire implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RainOfFireSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private meteors: Meteor[] = [];
  private pos: THREE.Vector3[] = [];
  private active: boolean[] = [];

  private caster = createCaster(0x4a2a5a);
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0x7bff4a, { rim: false });
  private runeDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: 0x07030c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private runeOuter = createRing(GREEN, 0.93, 1, 96);
  private runeMid = createRing(GREEN, 0.7, 0.74, 6);
  private runeInner = createRing(ORANGE, 0.45, 0.5, 64);
  private runeStar = createRing(ORANGE, 0.2, 0.3, 4);
  private heads: GlowSphere[] = [];
  private rocks: THREE.InstancedMesh;
  private scorches: THREE.InstancedMesh;
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
  private dummy = new THREE.Object3D();
  private trailG: Emitter;
  private trailO: Emitter;
  private splashG: Emitter;
  private splashO: Emitter;
  private sparks: Emitter;
  private fieldG: Emitter;
  private fieldO: Emitter;

  constructor(settings: RainOfFireSettings = defaultRainOfFire()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group, this.handGlow.mesh);
    this.runeDisc.rotation.x = -Math.PI / 2;
    this.group.add(this.runeDisc, this.runeOuter.mesh, this.runeMid.mesh, this.runeInner.mesh, this.runeStar.mesh);

    const n = settings.meteors;
    for (let i = 0; i < n; i++) {
      const h = new GlowSphere(i % 2 === 0 ? ORANGE : GREEN, { rim: false });
      this.heads.push(h);
      this.group.add(h.mesh);
      this.pos.push(new THREE.Vector3());
      this.active.push(false);
    }
    this.rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.8, emissive: 0x7a2a08, emissiveIntensity: 0.8 }),
      n,
    );
    this.rocks.frustumCulled = false;
    this.scorches = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), this.scorchMat, n);
    this.scorches.frustumCulled = false;
    this.group.add(this.rocks, this.scorches);

    const trail = (a: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.35, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 0.1, speed: 0.5, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1,
      sizeStart: 0.4, sizeEnd: 0.04, colorStart: a, colorEnd: b, opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.trailG = trail('#c8ff80', '#1a8a10');
    this.trailO = trail('#ffc060', '#d02800');

    const splash = (a: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 4.5, speedJitter: 0.6, spread: 70, gravity: 4, drag: 1.2,
      sizeStart: 0.5, sizeEnd: 0.05, colorStart: a, colorEnd: b, opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.splashG = splash('#c8ff80', '#1a8a10');
    this.splashO = splash('#ffc060', '#d02800');

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, speed: 8, speedJitter: 0.6, spread: 60, gravity: 14, drag: 0.7,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#fff0b0', colorEnd: '#ff7a10', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });

    const field = (a: string, b: string): Emitter => new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: settings.areaRadius, speed: 1.6, speedJitter: 0.6, spread: 15, gravity: -1.5, drag: 0.8,
      sizeStart: 0.55, sizeEnd: 0.05, colorStart: a, colorEnd: b, opacityStart: 0.3, opacityEnd: 0, additive: true,
    });
    this.fieldG = field('#b0ff70', '#1a8a10');
    this.fieldO = field('#ffb040', '#c82400');

    this.emitters.push(this.trailG, this.trailO, this.splashG, this.splashO, this.sparks, this.fieldG, this.fieldO);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return this.settings.rainTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  /** Rolls a fresh random meteor plan for this run. */
  private plan() {
    const s = this.settings;
    const runeR = s.areaRadius * 0.9;
    this.meteors = [];
    for (let i = 0; i < s.meteors; i++) {
      const nearEnemy = i % 6 === 0;
      const a = Math.random() * Math.PI * 2;
      const r = (nearEnemy ? 1.4 : s.areaRadius) * Math.sqrt(Math.random());
      const end = new THREE.Vector3(ENEMY_POS.x + Math.cos(a) * r, 0.1, ENEMY_POS.z + Math.sin(a) * r);
      const sa = Math.random() * Math.PI * 2;
      const sr = runeR * Math.sqrt(Math.random());
      const start = new THREE.Vector3(Math.cos(sa) * sr, s.height, Math.sin(sa) * sr);
      const fall = 0.6 + Math.random() * 0.3;
      const t0 = OPEN * 0.7 + Math.random() * Math.max(0.1, s.rainTime - fall - OPEN * 0.7);
      this.meteors.push({
        start, end, t0, fall, green: Math.random() < 0.45, nearEnemy, landed: false,
        spin: 2 + Math.random() * 6, size: 0.3 + Math.random() * 0.25,
      });
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.plan();
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.fieldG.settings.rate = 0;
    this.fieldO.settings.rate = 0;
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
    this.layout();
    this.spawnEffects(dt);
  }

  /** Trails behind falling meteors, splash on landing, and the burning field. */
  private spawnEffects(dt: number) {
    const t = this.time;
    this.meteors.forEach((m, i) => {
      if (this.active[i]) emit(m.green ? this.trailG : this.trailO, 90, dt, this.pos[i]);
      if (!m.landed && t >= m.t0 + m.fall) {
        m.landed = true;
        const at = m.end.clone();
        at.y = 0.2;
        (m.green ? this.splashG : this.splashO).burst(26, at);
        (m.green ? this.splashO : this.splashG).burst(8, at);
        this.sparks.burst(14, at);
      }
    });
    const landed = this.meteors.reduce((n, m) => n + (m.landed ? 1 : 0), 0);
    const burn = (landed / this.meteors.length) * (1 - smoothstep((t - (this.duration - 0.6)) / 0.6));
    const origin = new THREE.Vector3(ENEMY_POS.x, 0.1, ENEMY_POS.z);
    emit(this.fieldG, 70 * burn, dt, origin);
    emit(this.fieldO, 90 * burn, dt, origin);
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);
    const open = smoothstep(t / OPEN);

    // Caster: arms raised, a green glow in the hand while the circle opens.
    this.handGlow.mesh.position.set(0.45, 2.4, 14 - 0.3);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.3 * open);
    this.handGlow.opacity = 0.5 * open * fade;

    // Rune cluster: a dark disc with fel-lit rings, high above the area, facing down.
    const runeR = s.areaRadius * 0.95 * (0.3 + 0.7 * open);
    const rune = (r: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }, scale: number, rot: number, op: number) => {
      r.mesh.position.set(ENEMY_POS.x, s.height, ENEMY_POS.z);
      r.mesh.rotation.set(Math.PI / 2, 0, rot);
      r.mesh.scale.setScalar(runeR * scale);
      r.material.opacity = op * open * fade;
    };
    rune(this.runeOuter, 1, t * 0.4, 0.5);
    rune(this.runeMid, 0.85, -t * 0.7, 0.45);
    rune(this.runeInner, 0.6, t * 1.1, 0.45);
    rune(this.runeStar, 0.9, -t * 0.5, 0.4);
    this.runeDisc.position.set(ENEMY_POS.x, s.height - 0.05, ENEMY_POS.z);
    this.runeDisc.rotation.set(Math.PI / 2, 0, 0);
    this.runeDisc.scale.setScalar(runeR);
    (this.runeDisc.material as THREE.MeshBasicMaterial).opacity = 0.55 * open * fade;

    // Meteors.
    let flash = 0;
    let rumble = 0;
    const d = this.dummy;
    this.meteors.forEach((m, i) => {
      const u = (t - m.t0) / m.fall;
      const on = u >= 0 && u < 1;
      this.active[i] = on;
      const head = this.heads[i];
      if (on) {
        const k = u * u; // accelerates toward the ground
        this.pos[i].lerpVectors(m.start, m.end, k);
        head.mesh.position.copy(this.pos[i]);
        head.mesh.scale.setScalar(m.size * 2.2);
        head.opacity = 0.5;
        d.position.copy(this.pos[i]);
        d.rotation.set(t * m.spin, t * m.spin * 0.7, 0);
        d.scale.setScalar(m.size);
      } else {
        head.opacity = 0;
        d.position.set(0, -50, 0);
        d.scale.setScalar(0.0001);
      }
      d.updateMatrix();
      this.rocks.setMatrixAt(i, d.matrix);

      // Scorch dot appears at the landing spot and fades with the field.
      const since = t - (m.t0 + m.fall);
      if (since >= 0) {
        d.position.set(m.end.x, 0.03, m.end.z);
        d.rotation.set(-Math.PI / 2, 0, 0);
        d.scale.setScalar(m.size * 2.4 * smoothstep(since / 0.15) * (m.nearEnemy ? 1.3 : 1));
        rumble = Math.max(rumble, 0.1 * Math.exp(-since * 10));
        if (m.nearEnemy) flash = Math.max(flash, Math.exp(-since * 8));
      } else {
        d.position.set(0, -50, 0);
        d.scale.setScalar(0.0001);
      }
      d.updateMatrix();
      this.scorches.setMatrixAt(i, d.matrix);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
    this.scorches.instanceMatrix.needsUpdate = true;
    this.scorchMat.opacity = 0.6 * fade;

    this.shake = Math.min(0.25, rumble);
    this.enemy.setFlash(1.1 * flash);
  }
}

export const rainOfFireModule: EffectModule = {
  label: 'rain of fire',
  category: 'iconic',
  create: () => new RainOfFire(),
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as RainOfFire).settings;
    frameArena(camera, controls, new THREE.Vector3(0, s.height * 0.4, 5), Math.max(12, s.height * 0.6));
  },
  buildGui(f, effect) {
    const s = (effect as RainOfFire).settings;
    f.add(s, 'loop');
    f.add(s, 'rainTime', 1.5, 8, 0.1).name('rain time');
    f.add(s, 'height', 10, 40, 0.5).name('rune height');
  },
};
