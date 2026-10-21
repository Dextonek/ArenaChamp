import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';
import type { TelegraphSpec } from '../../effects/telegraph';

/**
 * Penance (reworked): a priest in white robes channels three volleys of holy light bolts. A halo hovers over the
 * head and a ring of light spins around the raised hands, faster with each volley; between volleys the hands gather
 * a short charge. Each volley fires three gold-white spears of light in a slight spread; every hit throws holy
 * sparks and a flash. It ends on a gentle shimmer.
 */
export interface PenanceSettings {
  volleys: number;
  volleyGap: number; // seconds between volleys
  boltSpeed: number; // seconds a bolt needs to reach the enemy
  color: string;
  loop: boolean;
}

export const defaultPenance = (): PenanceSettings => ({
  volleys: 3,
  volleyGap: 1.1,
  boltSpeed: 0.2,
  color: '#ffd978',
  loop: false,
});

const MAX_VOLLEYS = 5;
const PER_VOLLEY = 3;
const FIRST = 0.9; // first volley
const BOLT_STAGGER = 0.08;
const BOLT_LEN = 3;
const SHIMMER = 1.3;
const HANDS = new THREE.Vector3(CASTER_POS.x, 1.9, CASTER_POS.z - 0.55);
const UP = new THREE.Vector3(0, 1, 0);

interface Bolt {
  shaft: THREE.Mesh;
  head: GlowSphere;
  target: THREE.Vector3;
  fireAt: number; // seconds
  hit: boolean;
}

export class Penance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PenanceSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private shimmerAcc = 0;
  private caster = createCaster(0xd9d2c0);
  private enemy = new Enemy();
  private halo = createRing(0xffe6a0, 0.88, 1, 64);
  private haloGlow = new GlowSphere(0xffe6a0, { rim: false });
  private handRing = createRing(0xffe6a0, 0.82, 1, 6);
  private handRing2 = createRing(0xfff2c8, 0.9, 1, 64);
  private handGlow = new GlowSphere(0xfff0c0, { rim: false });
  private boltMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.5, 1.35, 0.9), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private bolts: Bolt[] = [];
  private flash = new GlowSphere(0xffe6a0);
  private sparks: Emitter;
  private shimmer: Emitter;
  private dir = new THREE.Vector3();
  private head = new THREE.Vector3();

  constructor(settings: PenanceSettings = defaultPenance()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.halo.mesh, this.haloGlow.mesh, this.handRing.mesh, this.handRing2.mesh, this.handGlow.mesh);
    this.group.add(this.flash.mesh);

    const shaftGeo = new THREE.CylinderGeometry(0.035, 0.07, 1, 8, 1, true);
    shaftGeo.translate(0, 0.5, 0); // base at the head, extends back along +Y
    for (let i = 0; i < MAX_VOLLEYS * PER_VOLLEY; i++) {
      const shaft = new THREE.Mesh(shaftGeo, this.boltMat);
      const head = new GlowSphere(0xfff0c0);
      this.group.add(shaft, head.mesh);
      this.bolts.push({ shaft, head, target: new THREE.Vector3(), fireAt: 0, hit: false });
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.15, speed: 6, speedJitter: 0.6, spread: 90, gravity: 6, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff6d8', colorEnd: '#ffb83a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.shimmer = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 0.7, speedJitter: 0.5, spread: 25, gravity: -0.4, drag: 0.6,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: '#ffcf6a',
      opacityStart: 0.4, opacityEnd: 0, additive: true,
      colorMid: '#ffe08a', sizeJitter: 0.4, erosion: 0.4, spin: 0.3,
    });
    this.emitters.push(this.sparks, this.shimmer);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.halo.material.color.set(c);
    this.handRing.material.color.set(c);
    this.flash.color.set(c);
    this.sparks.settings.colorEnd = c;
    this.sparks.applyStyle();
    this.shimmer.settings.colorEnd = c;
    this.shimmer.applyStyle();
  }

  private get volleys() {
    return THREE.MathUtils.clamp(Math.round(this.settings.volleys), 1, MAX_VOLLEYS);
  }

  private volleyTime(k: number) {
    return FIRST + k * this.settings.volleyGap;
  }

  get duration() {
    return this.volleyTime(this.volleys - 1) + PER_VOLLEY * BOLT_STAGGER + this.settings.boltSpeed + SHIMMER;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shimmerAcc = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    // Schedule each volley's bolts: a slight fan of aim points on the enemy.
    for (let k = 0; k < MAX_VOLLEYS; k++) {
      for (let j = 0; j < PER_VOLLEY; j++) {
        const b = this.bolts[k * PER_VOLLEY + j];
        const side = j - 1;
        b.fireAt = this.volleyTime(k) + j * BOLT_STAGGER;
        b.hit = false;
        b.target.set(side * 0.55 + Math.sin(k * 3.1 + j) * 0.12, 1.25 + Math.cos(k * 2.3 + j * 1.7) * 0.35, ENEMY_POS.z);
      }
    }
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
    const t = this.time;
    const fly = this.settings.boltSpeed;
    for (let i = 0; i < this.volleys * PER_VOLLEY; i++) {
      const b = this.bolts[i];
      if (!b.hit && t >= b.fireAt + fly) {
        b.hit = true;
        this.sparks.burst(90, b.target);
        this.shake = Math.max(this.shake, 0.18);
      }
    }
    this.shake *= 0.86;
    // Gentle shimmer once the last bolt has landed.
    const lastHit = this.volleyTime(this.volleys - 1) + PER_VOLLEY * BOLT_STAGGER + fly;
    if (t > lastHit) {
      const k = 1 - smoothstep((t - lastHit) / SHIMMER);
      this.shimmerAcc += 70 * k * dt;
      while (this.shimmerAcc >= 1) {
        this.shimmerAcc -= 1;
        const around = Math.random() < 0.5;
        const c = around ? ENEMY_POS : CASTER_POS;
        this.shimmer.burst(1, this.tmpPoint(c.x, 0.4 + Math.random() * 1.6, c.z));
      }
    }
    this.layout();
  }

  private tmpPoint(x: number, y: number, z: number) {
    return this.head.set(x + (Math.random() - 0.5) * 1.5, y, z + (Math.random() - 0.5) * 1.5);
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const n = this.volleys;
    const total = this.duration;
    const fly = s.boltSpeed;
    const fade = 1 - smoothstep((t - (total - 0.7)) / 0.7);
    const lastFire = this.volleyTime(n - 1);
    const channel = smoothstep(t / 0.6) * (1 - smoothstep((t - (lastFire + 0.9)) / 0.8));

    // Caster: soft holy glow on the robes while channelling.
    this.caster.material.emissive.setRGB(0.18 * channel, 0.15 * channel, 0.08 * channel);

    // Halo hovering over the head; bobs gently.
    const bob = 0.08 * Math.sin(t * 2.4);
    const haloOp = smoothstep(t / 0.7) * fade;
    this.halo.mesh.position.set(CASTER_POS.x, 3.05 + bob, CASTER_POS.z);
    this.halo.mesh.scale.setScalar(0.6);
    this.halo.mesh.rotation.z = t * 0.5;
    this.halo.material.opacity = 0.65 * haloOp;
    this.haloGlow.mesh.position.set(CASTER_POS.x, 3.05 + bob, CASTER_POS.z);
    this.haloGlow.mesh.scale.setScalar(0.9);
    this.haloGlow.opacity = 0.2 * haloOp;

    // Ring of light around the hands, facing the enemy. Spin rate climbs with every volley.
    const w0 = 2.5, w1 = 2.5 + 5 * n;
    const angle = w0 * t + 0.5 * ((w1 - w0) / lastFire) * Math.min(t, lastFire) * Math.min(t, lastFire)
      + (t > lastFire ? w1 * (t - lastFire) : 0);
    const ringOp = channel * fade;
    this.handRing.mesh.position.copy(HANDS);
    this.handRing.mesh.rotation.set(0, 0, angle);
    this.handRing.mesh.scale.setScalar(0.9);
    this.handRing.material.opacity = 0.55 * ringOp;
    this.handRing2.mesh.position.copy(HANDS);
    this.handRing2.mesh.position.z -= 0.1;
    this.handRing2.mesh.rotation.set(0, 0, -angle * 0.7);
    this.handRing2.mesh.scale.setScalar(0.55);
    this.handRing2.material.opacity = 0.4 * ringOp;

    // Charge between volleys: the hand glow swells before each volley and snaps down as it fires.
    let charge = 0;
    for (let k = 0; k < n; k++) {
      const tv = this.volleyTime(k);
      const c = smoothstep((t - (tv - 0.5)) / 0.5);
      const rel = t - tv;
      const release = rel > 0 ? Math.exp(-rel * 7) : 1;
      charge = Math.max(charge, c * (rel < 0 ? 1 : release));
      if (rel > 0 && rel < PER_VOLLEY * BOLT_STAGGER) charge = Math.max(charge, 0.7);
    }
    this.handGlow.mesh.position.copy(HANDS);
    this.handGlow.mesh.scale.setScalar(0.3 + 0.55 * charge);
    this.handGlow.opacity = 0.6 * charge * fade;

    // Bolts: thin spears of light with glow heads, fired in a slight spread.
    let flash = 0;
    for (let i = 0; i < MAX_VOLLEYS * PER_VOLLEY; i++) {
      const b = this.bolts[i];
      const active = i < n * PER_VOLLEY;
      const u = active ? (t - b.fireAt) / fly : -1;
      const flying = u >= 0 && u < 1;
      b.shaft.visible = flying;
      b.head.mesh.visible = flying;
      if (flying) {
        // Origin spread across the hands so the three bolts fan out slightly.
        const spreadX = (i % PER_VOLLEY - 1) * 0.25;
        this.head.set(HANDS.x + spreadX, HANDS.y + Math.sin(i * 1.9) * 0.15, HANDS.z);
        this.dir.subVectors(b.target, this.head);
        const dist = this.dir.length();
        this.dir.divideScalar(dist);
        const pos = this.head.clone().addScaledVector(this.dir, dist * u);
        b.head.mesh.position.copy(pos);
        b.head.mesh.scale.setScalar(0.4);
        b.head.opacity = 0.9;
        const len = Math.min(BOLT_LEN, dist * u);
        b.shaft.position.copy(pos);
        // Shaft extends from the head back toward the hands, i.e. along -dir.
        b.shaft.quaternion.setFromUnitVectors(UP, this.dir.clone().negate());
        b.shaft.scale.set(1, len, 1);
      }
      const after = t - (b.fireAt + fly);
      if (active && after >= 0) flash = Math.max(flash, Math.exp(-after * 10));
    }
    this.boltMat.opacity = 0.9 * fade;

    // Hit flash on the enemy.
    this.enemy.setFlash(flash * 0.9);
    this.flash.mesh.position.set(ENEMY_POS.x, 1.3, ENEMY_POS.z);
    this.flash.mesh.scale.setScalar(1 + 0.8 * (1 - flash));
    this.flash.opacity = 0.4 * flash;
  }
}

export const penanceModule: EffectModule = {
  label: 'penance',
  category: 'iconic',
  create: () => new Penance(),
  telegraphs(effect) {
    const s = (effect as Penance).settings;
    const n = THREE.MathUtils.clamp(Math.round(s.volleys), 1, MAX_VOLLEYS);
    const zones: TelegraphSpec[] = [];
    // Each volley: three narrow lanes from the caster's hands to the enemy, readable during the charge.
    for (let k = 0; k < n; k++) {
      const tv = FIRST + k * s.volleyGap;
      for (let j = 0; j < PER_VOLLEY; j++) {
        zones.push({
          shape: { kind: 'line', x1: HANDS.x, z1: HANDS.z, x2: (j - 1) * 0.55, z2: ENEMY_POS.z, width: 0.8 },
          start: Math.max(0, tv - 0.5), impact: tv + j * BOLT_STAGGER + s.boltSpeed,
        });
      }
    }
    return zones;
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 2.5, 9), 12);
  },
  buildGui(f, effect) {
    const p = effect as Penance;
    const s = p.settings;
    f.add(s, 'loop');
    f.add(s, 'volleys', 1, 5, 1).name('volleys');
    f.add(s, 'volleyGap', 0.6, 2.5, 0.05).name('volley gap');
    f.add(s, 'boltSpeed', 0.08, 0.6, 0.01).name('bolt flight time');
    f.addColor(s, 'color').onChange(() => p.applyStyle());
  },
};
