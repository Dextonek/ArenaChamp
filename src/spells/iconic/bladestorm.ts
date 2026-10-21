import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, createSwordGeometry,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bladestorm (reworked): the warrior spins up with two huge blades into a whirlwind of steel, charges the enemy,
 * circles it twice cutting it again and again, then skids to a stop in a burst of dust.
 */
export interface BladestormSettings {
  circleRadius: number;
  circleTime: number; // seconds spent circling the enemy
  loops: number; // laps around the enemy
  spinRate: number; // rad/s at full speed
  color: string; // red accent
  loop: boolean;
}

export const defaultBladestorm = (): BladestormSettings => ({
  circleRadius: 2.9,
  circleTime: 2.4,
  loops: 2,
  spinRate: 28,
  color: '#ff4a38',
  loop: false,
});

const SPIN_UP = 0.8;
const APPROACH_END = 1.5; // the whirlwind reaches the circle here
const HIT_INTERVAL = 0.15;
const STOP_SLIDE = 0.45;
const AFTERMATH = 1.2;
const TORNADO_H = 6.5;
const RIBBONS = 44;

/** Flat swept strip lying in XZ with its head at angle 0 (+X) and a tail trailing behind the spin (alpha fades out). */
function createSweep(inner: number, outer: number, arc: number, segs: number, rgb: [number, number, number], peak: number) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const k = i / segs, a = -k * arc, c = Math.cos(a), s = Math.sin(a);
    const al = peak * Math.pow(1 - k, 2);
    pos.push(c * inner, 0, -s * inner, c * outer, 0, -s * outer);
    col.push(rgb[0], rgb[1], rgb[2], al, rgb[0], rgb[1], rgb[2], al);
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

export class Bladestorm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BladestormSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private spinAngle = 0;
  private spinNorm = 0;
  private nextHit = 0;
  private stopped = false;
  private lastHit = -10;
  private hitStr = 1;
  private hitDir = new THREE.Vector2(0, 1);
  private dustAcc = 0;
  private pos = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  private caster = createCaster(0x8a8f98);
  private enemy = new Enemy();

  private whirl = new THREE.Group(); // follows the warrior
  private spinGroup = new THREE.Group(); // spins with the blades
  private bladeMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0aa, metalness: 0.75, roughness: 0.4, emissive: 0x501010, emissiveIntensity: 0.6,
  });
  private sweepMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private glints = [new GlowSphere(0xe8eef8, { rim: false }), new GlowSphere(0xe8eef8, { rim: false })];
  private ribbonMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  private ribbons = new THREE.InstancedMesh(createSweep(0.94, 1, 1.3, 10, [1, 0.85, 0.8], 0.5), this.ribbonMat, RIBBONS);
  private ribPhase = new Float32Array(RIBBONS);
  private ribHeight = new Float32Array(RIBBONS);
  private ribRise = new Float32Array(RIBBONS);
  private ribSpeed = new Float32Array(RIBBONS);

  private padRing = createRing(0xff3a28, 0.5, 1, 64); // red glow under the whirlwind
  private padRing2 = createRing(0xc8c0b8, 0.9, 1, 64);
  private pathRing = createRing(0xff3a28, 0.96, 1, 96);
  private dust: Emitter;
  private sparks: Emitter;

  constructor(settings: BladestormSettings = defaultBladestorm()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group, this.whirl);
    this.group.add(this.padRing.mesh, this.padRing2.mesh, this.pathRing.mesh);
    this.whirl.add(this.spinGroup, this.ribbons);
    this.ribbons.frustumCulled = false;

    const bladeGeo = createSwordGeometry();
    const arcA = createSweep(1.1, 2.5, 2.4, 14, [1, 0.9, 0.85], 0.4);
    const arcB = createSweep(1.9, 2.5, 3.4, 16, [1, 0.25, 0.15], 0.3);
    for (let i = 0; i < 2; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = i * Math.PI;
      const blade = new THREE.Mesh(bladeGeo, this.bladeMat);
      blade.scale.setScalar(2);
      blade.rotation.z = Math.PI / 2; // tip points outward (+X)
      blade.position.set(0.5, 1.3, 0);
      const a = new THREE.Mesh(arcA, this.sweepMat);
      a.position.y = 1.3;
      const b = new THREE.Mesh(arcB, this.sweepMat);
      b.position.y = 1.05;
      this.glints[i].mesh.position.set(2.5, 1.3, 0);
      this.glints[i].mesh.scale.setScalar(0.3);
      holder.add(blade, a, b, this.glints[i].mesh);
      this.spinGroup.add(holder);
    }

    for (let i = 0; i < RIBBONS; i++) {
      this.ribPhase[i] = Math.random() * Math.PI * 2;
      this.ribHeight[i] = Math.random() * TORNADO_H;
      this.ribRise[i] = 0.8 + Math.random() * 1.4;
      this.ribSpeed[i] = 0.7 + Math.random() * 0.6;
      this.ribbons.setColorAt(i, this.tmpColor.setRGB(1, 1, 1));
    }

    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 2400, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 2.2, speedJitter: 0.5, spread: 70, gravity: -0.3, drag: 1,
      sizeStart: 0.6, sizeEnd: 1.5, colorStart: '#8b7f72', colorEnd: '#4f4943',
      opacityStart: 0.55, opacityEnd: 0, additive: false,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, speed: 8, speedJitter: 0.6, spread: 110, gravity: 10, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff0d0', colorEnd: '#ff4a20',
      opacityStart: 0.85, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.dust, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    this.padRing.material.color.set(this.settings.color);
    this.pathRing.material.color.set(this.settings.color);
  }

  private get circleStart() { return APPROACH_END; }
  private get circleEnd() { return APPROACH_END + this.settings.circleTime; }
  private get stopTime() { return this.circleEnd + STOP_SLIDE; }

  get duration() {
    return this.stopTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.spinAngle = 0;
    this.spinNorm = 0;
    this.nextHit = this.circleStart + 0.1;
    this.stopped = false;
    this.lastHit = -10;
    this.hitStr = 1;
    this.hitDir.set(0, 1);
    this.dustAcc = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
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
    const s = this.settings;
    const t = this.time;

    // Spin rate: ramps up, holds, spins down after the circle.
    const spinUp = smoothstep(t / SPIN_UP);
    this.spinNorm = spinUp * (1 - smoothstep((t - this.circleEnd) / 0.4));
    this.spinAngle += s.spinRate * this.spinNorm * dt;

    this.pathPos(t, this.pos);
    while (t >= this.nextHit && this.nextHit <= this.circleEnd) { this.onHit(1); this.nextHit += HIT_INTERVAL; }
    if (!this.stopped && t >= this.stopTime) this.onStop();

    // Dust is kicked up in a ring around the whirlwind and left behind on its path.
    this.dustAcc += dt * 60 * this.spinNorm;
    while (this.dustAcc >= 1) {
      this.dustAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 0.9;
      this.dust.burst(4, new THREE.Vector3(this.pos.x + Math.cos(a) * r, 0, this.pos.z + Math.sin(a) * r));
    }
    this.layout();
    if (!this.playing) this.shake = 0;
  }

  /** Warrior position over time: spin on the spot, charge to the circle, circle the enemy, back off at the end. */
  private pathPos(t: number, out: THREE.Vector3) {
    const s = this.settings;
    const R = s.circleRadius;
    const cs = this.circleStart, ce = this.circleEnd;
    if (t < SPIN_UP) return out.copy(CASTER_POS);
    if (t < cs) {
      const u = smoothstep((t - SPIN_UP) / (cs - SPIN_UP));
      return out.set(ENEMY_POS.x, 0, CASTER_POS.z + (ENEMY_POS.z + R - CASTER_POS.z) * u);
    }
    const lap = s.loops * Math.PI * 2;
    const th = lap * THREE.MathUtils.clamp((t - cs) / (ce - cs), 0, 1);
    const rad = R + 1.4 * smoothstep((t - ce) / STOP_SLIDE);
    return out.set(ENEMY_POS.x + rad * Math.sin(th), 0, ENEMY_POS.z + rad * Math.cos(th));
  }

  private onHit(strength: number) {
    this.lastHit = this.time;
    this.hitStr = strength;
    // Direction from the warrior to the enemy: the enemy is pushed that way.
    this.hitDir.set(ENEMY_POS.x - this.pos.x, ENEMY_POS.z - this.pos.z).normalize();
    const at = new THREE.Vector3(ENEMY_POS.x - this.hitDir.x * 0.5, 1.3, ENEMY_POS.z - this.hitDir.y * 0.5);
    this.sparks.burst(Math.round(35 * strength), at);
  }

  private onStop() {
    this.stopped = true;
    this.onHit(2.4);
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.dust.burst(26, new THREE.Vector3(this.pos.x + Math.cos(a) * 2.2, 0, this.pos.z + Math.sin(a) * 2.2));
    }
    this.sparks.burst(250, new THREE.Vector3(this.pos.x, 1.3, this.pos.z));
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const fade = 1 - smoothstep((t - (this.duration - 0.6)) / 0.6);
    this.pathPos(t, this.pos);
    const p = this.pos;
    const spin = this.spinNorm;
    const sinceStop = t - this.stopTime;

    // Warrior: crouches into the spin and turns with the blades.
    const crouch = smoothstep(t / 0.5) * (1 - smoothstep((t - this.circleEnd) / 0.5));
    this.caster.group.position.copy(p);
    this.caster.group.scale.set(1, 1 - 0.14 * crouch, 1);
    this.caster.group.rotation.y = this.spinAngle;
    this.whirl.position.copy(p);
    this.spinGroup.rotation.y = this.spinAngle;
    this.sweepMat.opacity = Math.min(1, spin * 1.2);
    for (const g of this.glints) g.opacity = 0.4 * spin;
    this.bladeMat.emissiveIntensity = 0.5 + 0.5 * spin;

    // Tornado of wind arcs: rotate, rise and widen toward the top.
    const d = this.dummy;
    d.rotation.order = 'XYZ';
    const grow = 0.55 + 0.45 * smoothstep(t / SPIN_UP);
    for (let i = 0; i < RIBBONS; i++) {
      const h = (this.ribHeight[i] + t * this.ribRise[i]) % TORNADO_H;
      const rr = (0.9 + h * 0.38) * grow;
      d.position.set(0, h * grow, 0);
      d.rotation.set(0, this.ribPhase[i] + this.spinAngle * 0.6 * this.ribSpeed[i], 0);
      d.scale.set(rr, 1, rr);
      d.updateMatrix();
      this.ribbons.setMatrixAt(i, d.matrix);
      const b = Math.sin(Math.PI * h / TORNADO_H);
      this.ribbons.setColorAt(i, this.tmpColor.setRGB(b, b, b));
    }
    this.ribbons.instanceMatrix.needsUpdate = true;
    if (this.ribbons.instanceColor) this.ribbons.instanceColor.needsUpdate = true;
    this.ribbonMat.opacity = spin;

    // Ground glow under the whirlwind and the circle it runs on.
    this.padRing.mesh.position.set(p.x, 0.05, p.z);
    this.padRing.mesh.scale.setScalar(2.6);
    this.padRing.material.opacity = 0.4 * spin * fade;
    this.padRing2.mesh.position.set(p.x, 0.06, p.z);
    this.padRing2.mesh.scale.setScalar(3.2);
    this.padRing2.mesh.rotation.z = this.spinAngle * 0.2;
    this.padRing2.material.opacity = 0.25 * spin * fade;
    this.pathRing.mesh.position.set(ENEMY_POS.x, 0.04, ENEMY_POS.z);
    this.pathRing.mesh.scale.setScalar(s.circleRadius);
    this.pathRing.material.opacity =
      0.25 * smoothstep((t - this.circleStart + 0.3) / 0.4) * (1 - smoothstep((t - this.circleEnd) / 0.5)) * fade;

    // Enemy: flashes, jerks away from the blades and tilts with every hit.
    const hp = Math.exp(-(t - this.lastHit) * 9) * this.hitStr;
    this.enemy.setFlash(hp);
    this.enemy.group.position.set(this.hitDir.x * 0.3 * hp, 0, this.hitDir.y * 0.3 * hp);
    this.enemy.group.rotation.x = this.hitDir.y * 0.14 * hp;
    this.enemy.group.rotation.z = -this.hitDir.x * 0.14 * hp;

    const circling = smoothstep((t - this.circleStart) / 0.3) * (1 - smoothstep((t - this.circleEnd) / 0.3));
    this.shake = 0.05 * circling + 0.14 * Math.min(1, hp) + (sinceStop > 0 ? 0.45 * Math.exp(-sinceStop * 6) : 0);
  }
}

export const bladestormModule: EffectModule = {
  label: 'bladestorm',
  category: 'iconic',
  create: () => new Bladestorm(),
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    // Caster at z = 14 spinning up, then everything happens around the enemy at the origin.
    frameArena(camera, controls, new THREE.Vector3(0, 3, 7), 11.5);
  },
  buildGui(f, effect) {
    const b = effect as Bladestorm;
    const s = b.settings;
    f.add(s, 'loop');
    f.add(s, 'circleRadius', 1.5, 5, 0.1).name('circle radius');
    f.add(s, 'circleTime', 1, 5, 0.1).name('circle time');
    f.add(s, 'loops', 1, 4, 0.5);
    f.add(s, 'spinRate', 8, 50, 1).name('spin rate');
    f.addColor(s, 'color').onChange(() => b.applyStyle());
  },
};
