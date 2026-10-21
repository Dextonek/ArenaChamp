import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { Enemy, GlowSphere, createGround, createRing, frameArena, smoothstep } from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Spinning Crane Kick (reworked): the monk coils, rises and whirls with one leg out, wrapped in jade wind
 * ribbons and swirling chi motes while a dust ring is kicked up. Each revolution the leg sweeps through the ring
 * of surrounding enemies, hitting them in sequence (flash, knockback, jade sparks). A final burst of wind
 * blows everything outward.
 */
export interface SpinningCraneKickSettings {
  spinTime: number; // seconds of whirling
  revTime: number; // seconds per full revolution at top speed
  radius: number; // enemy ring radius
  color: string;
  loop: boolean;
}

export const defaultSpinningCraneKick = (): SpinningCraneKickSettings => ({
  spinTime: 2.4,
  revTime: 0.5,
  radius: 3,
  color: '#3affa8',
  loop: false,
});

const GATHER = 0.7;
const AFTERMATH = 1.8;
const ENEMIES = 5;
const MONK_POS = new THREE.Vector3(0, 0, 0);
const TWO_PI = Math.PI * 2;

/** A helix of the given turns, rising from y = 0 to `height` with the radius easing from r0 to r1. */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private turns: number, private height: number, private r0: number, private r1: number, private phase: number) {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const a = this.phase + this.turns * TWO_PI * t;
    const r = this.r0 + (this.r1 - this.r0) * t;
    return target.set(Math.sin(a) * r, this.height * t, Math.cos(a) * r);
  }
}

interface Ribbon {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  speed: number; // rotation relative to the monk's spin
  peak: number;
}

export class SpinningCraneKick implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpinningCraneKickSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private theta = 0; // leg direction (0 = +Z, towards +X as it grows)
  private burstDone = false;
  private hitTime = new Array<number>(ENEMIES).fill(-99);
  private hitPower = new Array<number>(ENEMIES).fill(1);
  private enemyAngle: number[] = [];
  private enemyHome: THREE.Vector3[] = [];

  private monk = new Enemy({ color: 0x3a7a6a, horns: false, eyeColor: new THREE.Color(1.6, 1.4, 0.8), facing: 0 });
  private enemies: Enemy[] = [];
  private leg: THREE.Mesh;
  private core = new GlowSphere(0x5affc0, { rim: false });
  private footGlow = new GlowSphere(0x9affd8, { rim: false });
  private ribbons: Ribbon[] = [];
  private wind = new THREE.Group();
  private gatherRing = createRing(0x3affa8, 0.9, 1, 96);
  private runeRing = createRing(0x3affa8, 0.55, 0.6, 6);
  private shock = createRing(0x7affc8, 0.9, 1, 96);
  private burstShell = new GlowSphere(0x5affc0);
  private light = new THREE.PointLight(0x4affb0, 0, 40, 1.5);
  private motes: Emitter;
  private dust: Emitter;
  private sparks: Emitter;
  private gust: Emitter;
  private tmp = new THREE.Vector3();

  constructor(settings: SpinningCraneKickSettings = defaultSpinningCraneKick()) {
    this.settings = settings;
    this.group.add(createGround(), this.monk.group, this.wind, this.light);
    this.monk.setHome(MONK_POS);

    // Leg: a capsule jutting out of the hip along the monk's facing (+Z), lifted a little.
    this.leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.5, 4, 10), this.monk.material);
    this.leg.position.set(0, 1.0, 1.0);
    this.leg.rotation.x = Math.PI / 2 - 0.2;
    this.monk.group.add(this.leg);
    this.monk.group.rotation.order = 'YXZ';

    for (let i = 0; i < ENEMIES; i++) {
      const a = (i / ENEMIES) * TWO_PI + 0.35;
      this.enemyAngle.push(a);
      const home = new THREE.Vector3(Math.sin(a) * settings.radius, 0, Math.cos(a) * settings.radius);
      this.enemyHome.push(home);
      const e = new Enemy().setHome(home);
      this.enemies.push(e);
      this.group.add(e.group);
    }

    this.group.add(this.core.mesh, this.footGlow.mesh, this.burstShell.mesh);
    this.group.add(this.gatherRing.mesh, this.runeRing.mesh, this.shock.mesh);

    // Wind ribbons: inner fast helices and two wide slow counter-rotating ones.
    const defs: [number, number, number, number, number, number, number, number][] = [
      // turns, height, r0, r1, phase, tube radius, speed, peak opacity
      [2.2, 4.6, 0.9, 1.7, 0, 0.05, 1.0, 0.45],
      [2.2, 4.6, 0.9, 1.7, TWO_PI / 3, 0.05, 1.0, 0.45],
      [2.2, 4.6, 0.9, 1.7, (TWO_PI * 2) / 3, 0.05, 1.0, 0.45],
      [1.4, 5.2, 2.0, 3.2, 1, 0.035, -0.55, 0.28],
      [1.4, 5.2, 2.0, 3.2, 1 + Math.PI, 0.035, -0.55, 0.28],
    ];
    for (const [turns, height, r0, r1, phase, tube, speed, peak] of defs) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x3affb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new HelixCurve(turns, height, r0, r1, phase), 140, tube, 6, false), material);
      this.wind.add(mesh);
      this.ribbons.push({ mesh, material, speed, peak });
    }

    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'point', shapeSize: 0, speed: 0.6, speedJitter: 0.5, spread: 180, gravity: -0.5, drag: 1,
      sizeStart: 0.2, sizeEnd: 0.03, colorStart: '#f0fff6', colorMid: '#5affb4', colorEnd: '#1a8f6a',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 3.2, speedJitter: 0.6, spread: 75, gravity: -0.4, drag: 1.4,
      sizeStart: 0.9, sizeEnd: 2.0, colorStart: '#c4d2c2', colorEnd: '#3f4d46',
      opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, groundFade: 0.3, spin: 0.5,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 7, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#f4fff8', colorEnd: '#2fe58f',
      opacityStart: 0.9, opacityEnd: 0, additive: true, erosion: 0,
    });
    this.gust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 13, speedJitter: 0.5, spread: 100, gravity: 0.5, drag: 2.2,
      sizeStart: 0.6, sizeEnd: 1.3, colorStart: '#eafff4', colorMid: '#46ffb0', colorEnd: '#0f6b55',
      opacityStart: 0.4, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    // Dust first so the bright layers draw over it.
    this.emitters.push(this.dust, this.motes, this.sparks, this.gust);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    for (const r of this.ribbons) r.material.color.set(c);
    this.gatherRing.material.color.set(c);
    this.runeRing.material.color.set(c);
    this.light.color.set(c);
    this.core.color.set(c);
    this.burstShell.color.set(c);
  }

  get duration() {
    return GATHER + this.settings.spinTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.theta = 0;
    this.burstDone = false;
    this.shake = 0;
    this.hitTime.fill(-99);
    this.hitPower.fill(1);
    this.monk.reset();
    for (const e of this.enemies) e.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** 0..1 spin speed factor over time. */
  private spinSpeed(t: number) {
    const s = this.settings;
    const burstT = GATHER + s.spinTime;
    if (t < GATHER) return 0.12 * smoothstep(t / GATHER);
    if (t < burstT) return 0.3 + 0.7 * smoothstep((t - GATHER) / (s.spinTime * 0.25));
    return Math.exp(-(t - burstT) * 4);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const s = this.settings;
    const burstT = GATHER + s.spinTime;
    const prev = this.theta;
    this.time += dt;
    if (this.time >= this.duration) {
      if (s.loop) { this.play(); return; }
      this.playing = false;
    }
    const t = this.time;
    this.theta += (TWO_PI / s.revTime) * this.spinSpeed(t) * dt;

    // The leg sweeps past each enemy once per revolution while whirling.
    if (t >= GATHER && t < burstT) {
      for (let i = 0; i < ENEMIES; i++) {
        const a = this.enemyAngle[i];
        if (Math.floor((this.theta - a) / TWO_PI) > Math.floor((prev - a) / TWO_PI)) this.onHit(i, 1);
      }
    }
    if (!this.burstDone && t >= burstT) this.onBurst();

    // Continuous chi motes and dust while whirling.
    if (t >= GATHER * 0.4 && t < burstT + 0.1) {
      const k = t < GATHER ? 0.3 : 1;
      const rise = this.monkRise(t);
      const n = Math.round(14 * k);
      for (let i = 0; i < n; i++) {
        const u = Math.random();
        const arm = Math.floor(Math.random() * 3);
        const a = this.theta * 1.2 + arm * (TWO_PI / 3) + u * TWO_PI * 2.2;
        const r = 0.9 + 1.7 * u + (Math.random() - 0.5) * 0.3;
        this.motes.burst(1, this.tmp.set(Math.sin(a) * r, rise + 4.6 * u, Math.cos(a) * r));
      }
      if (t >= GATHER) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * TWO_PI;
          this.dust.burst(1, this.tmp.set(Math.sin(a) * 2.4, 0.1, Math.cos(a) * 2.4));
        }
      }
    }
    this.layout();
  }

  private monkRise(t: number) {
    const burstT = GATHER + this.settings.spinTime;
    if (t < burstT) return 1.3 * smoothstep((t - GATHER * 0.5) / (GATHER * 0.9 + 0.4));
    return 1.3 * Math.exp(-(t - burstT) * 6);
  }

  private onHit(i: number, power: number) {
    this.hitTime[i] = this.time;
    this.hitPower[i] = power;
    const h = this.enemyHome[i];
    this.sparks.burst(power > 1 ? 60 : 24, this.tmp.set(h.x, 1.3, h.z));
    this.shake = Math.max(this.shake, 0.12 * power);
  }

  private onBurst() {
    this.burstDone = true;
    for (let i = 0; i < ENEMIES; i++) this.onHit(i, 2.2);
    this.gust.burst(700, this.tmp.set(0, 1.2, 0));
    this.dust.burst(260, this.tmp.set(0, 0.3, 0));
    this.motes.burst(200, this.tmp.set(0, 1.5, 0));
    this.shake = 0.5;
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const burstT = GATHER + s.spinTime;
    const after = t - burstT;
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);
    const spinAmt = smoothstep((t - GATHER * 0.6) / 0.6) * (t < burstT ? 1 : Math.exp(-after * 3.5));
    const rise = this.monkRise(t);

    // Monk: crouches, then rises tilted back with the leg out, spinning.
    const crouch = t < GATHER ? 0.14 * smoothstep(t / (GATHER * 0.8)) : 0;
    const g = this.monk.group;
    g.position.set(MONK_POS.x, rise, MONK_POS.z);
    g.rotation.set(-0.5 * smoothstep((t - GATHER * 0.5) / 0.5), this.theta, 0);
    g.scale.set(1, 1 - crouch, 1);
    g.updateMatrixWorld(true);
    this.leg.visible = true;

    // Glows: chi core on the belly, foot glow at the leg tip.
    this.core.mesh.position.set(MONK_POS.x, rise + 1.1, MONK_POS.z);
    const coreS = 0.3 + 0.9 * smoothstep(t / GATHER);
    this.core.mesh.scale.setScalar(coreS * (t < burstT ? 1 : 1 + after * 3));
    this.core.opacity = (t < burstT ? 0.25 + 0.15 * smoothstep(t / GATHER) : 0.4 * Math.exp(-after * 6)) * fade;
    const tip = this.tmp.set(0, 1.0, 2.1);
    g.localToWorld(tip);
    this.footGlow.mesh.position.copy(tip);
    this.footGlow.mesh.scale.setScalar(0.45);
    this.footGlow.opacity = 0.5 * smoothstep((t - GATHER) / 0.2) * (t < burstT ? 1 : Math.exp(-after * 10)) * fade;

    // Wind ribbons rise and rotate; they blow outward at the end.
    this.wind.position.set(MONK_POS.x, rise, MONK_POS.z);
    const out = t < burstT ? 1 : 1 + after * 5;
    for (const r of this.ribbons) {
      r.mesh.rotation.y = this.theta * r.speed * 1.2;
      const grow = smoothstep((t - GATHER * 0.5) / 0.9);
      r.mesh.scale.set(out, 0.15 + 0.85 * grow, out);
      r.material.opacity = r.peak * spinAmt * fade;
      r.mesh.visible = r.material.opacity > 0.004;
    }

    // Ground: gather ring contracts, rune turns under the monk, shockwave at the end.
    const gather = smoothstep(t / GATHER);
    this.gatherRing.mesh.scale.setScalar(5 - 3.4 * gather);
    this.gatherRing.material.opacity = (t < GATHER ? 0.55 * gather : 0.5 * Math.exp(-(t - GATHER) * 4)) * fade;
    this.runeRing.mesh.scale.setScalar(2.4);
    this.runeRing.mesh.rotation.z = -this.theta * 0.5;
    this.runeRing.material.opacity = 0.45 * spinAmt * fade;
    if (t >= burstT) {
      this.shock.mesh.scale.setScalar(1 + after * 20);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.7));
      this.burstShell.mesh.position.set(0, 1.2, 0);
      this.burstShell.mesh.scale.setScalar(1 + after * 11);
      this.burstShell.opacity = 0.5 * Math.exp(-after * 5);
    } else {
      this.shock.material.opacity = 0;
      this.burstShell.opacity = 0;
    }

    // Light: jade glow around the whirl.
    this.light.position.set(0, rise + 1.5, 0);
    this.light.intensity = 220 * spinAmt * fade + (t >= burstT ? 600 * Math.exp(-after * 8) : 0);

    // Enemies: flash, knockback away from the monk, always facing it.
    for (let i = 0; i < ENEMIES; i++) {
      const e = this.enemies[i];
      const age = t - this.hitTime[i];
      const p = this.hitPower[i];
      const h = this.enemyHome[i];
      const kb = age >= 0 ? 0.5 * p * Math.exp(-age * 7) : 0;
      const dir = this.tmp.set(h.x, 0, h.z).normalize();
      e.group.position.set(h.x + dir.x * kb, p > 1 && age >= 0 ? 0.4 * Math.sin(Math.min(1, age * 3) * Math.PI) : 0, h.z + dir.z * kb);
      e.group.rotation.set(-0.25 * kb, Math.atan2(-h.x, -h.z), 0);
      e.setFlash(age >= 0 ? 1.1 * Math.exp(-age * 9) : 0);
    }

    if (t < burstT) this.shake *= 0.9;
    else this.shake = Math.max(this.shake * 0.92, 0.5 * Math.exp(-after * 6));
  }
}

export const spinningCraneKickModule: EffectModule = {
  label: 'spinning crane kick',
  category: 'iconic',
  create: () => new SpinningCraneKick(),
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as SpinningCraneKick).settings;
    frameArena(camera, controls, new THREE.Vector3(0, 2.2, 0), Math.max(7.5, s.radius * 2.6));
  },
  buildGui(f, effect) {
    const k = effect as SpinningCraneKick;
    const s = k.settings;
    f.add(s, 'loop');
    f.add(s, 'spinTime', 1, 5, 0.1).name('spin time');
    f.add(s, 'revTime', 0.25, 1.2, 0.05).name('revolution time');
    f.addColor(s, 'color').onChange(() => k.applyStyle());
  },
};
