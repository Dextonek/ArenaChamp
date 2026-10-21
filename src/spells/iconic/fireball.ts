import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Fireball (reworked): flames spiral into the mage's hand, a roiling fireball forms, streaks to the enemy
 * leaving a thick fire-and-smoke trail, and detonates in a fiery blast with a smoke plume and scorch mark.
 * The enemy is left burning for a moment.
 */
export interface FireballSettings {
  size: number; // fireball radius
  castTime: number; // seconds of gathering before launch
  flightTime: number;
  color: string; // outer flame colour
  loop: boolean;
}

export const defaultFireball = (): FireballSettings => ({
  size: 0.85,
  castTime: 1.1,
  flightTime: 0.75,
  color: '#ff6a10',
  loop: false,
});

const AFTERMATH = 2.6;
const SPIRAL_N = 280;
const HAND = new THREE.Vector3(0.4, 1.7, -0.6);
const TARGET = new THREE.Vector3(ENEMY_POS.x, 1.3, ENEMY_POS.z);

export class Fireball implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FireballSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster(0x3a4fa5);
  private enemy = new Enemy();

  // Inward spiral of flames at the hand.
  private spiralPos = new Float32Array(SPIRAL_N * 3);
  private spiralSeed = new Float32Array(SPIRAL_N * 4); // angle, radius, height, speed
  private spiralMat = new THREE.PointsMaterial({
    color: 0xffa030, size: 0.16, map: softDotTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private spiral: THREE.Points;

  // The fireball itself: white-yellow core, turbulent icosahedron layers, soft outer glow.
  private ball = new THREE.Group();
  private core = new GlowSphere(0xfff0b0, { rim: false });
  private halo = new GlowSphere(0xff7a1a);
  private layers: THREE.Mesh[] = [];
  private layerMats: THREE.MeshStandardMaterial[] = [];

  private burst = new GlowSphere(0xff8a20);
  private flash = new GlowSphere(0xffe0a0, { rim: false });
  private shock = createRing(0xff9a30, 0.88, 1, 96);
  private ember = createRing(0xff5a14, 0.0, 1, 48);
  private scorch = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0, depthWrite: false }),
  );

  private trailFire: Emitter;
  private trailSmoke: Emitter;
  private embers: Emitter;
  private blastFire: Emitter;
  private plume: Emitter;
  private flames: Emitter;
  private trailAcc = 0;

  constructor(settings: FireballSettings = defaultFireball()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    this.spiral = new THREE.Points(new THREE.BufferGeometry(), this.spiralMat);
    this.spiral.geometry.setAttribute('position', new THREE.BufferAttribute(this.spiralPos, 3));
    this.spiral.frustumCulled = false;
    for (let i = 0; i < SPIRAL_N; i++) {
      this.spiralSeed[i * 4] = Math.random() * Math.PI * 2;
      this.spiralSeed[i * 4 + 1] = 0.8 + Math.random() * 2.2;
      this.spiralSeed[i * 4 + 2] = (Math.random() - 0.5) * 2.2;
      this.spiralSeed[i * 4 + 3] = 0.6 + Math.random() * 0.8;
    }

    const layerCols = [0xff6a10, 0xff3a05, 0xffa020];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x401000, emissive: layerCols[i], emissiveIntensity: 0.9, roughness: 0.8,
        flatShading: true, transparent: true, opacity: [0.8, 0.6, 0.5][i],
      });
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
      this.layers.push(m);
      this.layerMats.push(mat);
      this.ball.add(m);
    }
    this.ball.add(this.core.mesh, this.halo.mesh);
    this.core.mesh.scale.setScalar(0.7);
    this.halo.mesh.scale.setScalar(1.5);
    this.core.mesh.visible = true;

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;
    this.group.add(this.spiral, this.ball, this.burst.mesh, this.flash.mesh);
    this.group.add(this.shock.mesh, this.ember.mesh, this.scorch);

    const base = defaultSettings();
    this.trailFire = new Emitter({
      ...base, maxParticles: 900, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.4,
      speed: 1.2, speedJitter: 0.5, spread: 180, gravity: -2, drag: 1, sizeStart: 0.9, sizeEnd: 0.1,
      colorStart: '#ffd060', colorEnd: '#ff3000', opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ff8a1a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.trailSmoke = new Emitter({
      ...base, maxParticles: 700, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.4,
      speed: 0.8, speedJitter: 0.5, spread: 180, gravity: -1.2, drag: 0.8, sizeStart: 0.5, sizeEnd: 1.6,
      colorStart: '#3a3430', colorEnd: '#15110f', opacityStart: 0.35, opacityEnd: 0, additive: false,
      colorMid: '#2a2623', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.embers = new Emitter({
      ...base, maxParticles: 600, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5, shape: 'sphere', shapeSize: 0.5,
      speed: 2.5, speedJitter: 0.6, spread: 180, gravity: -0.8, drag: 0.8, sizeStart: 0.1, sizeEnd: 0.02,
      colorStart: '#ffe0a0', colorEnd: '#ff6a10', opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.blastFire = new Emitter({
      ...base, maxParticles: 1000, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.5,
      speed: 9, speedJitter: 0.6, spread: 180, gravity: -1, drag: 1.6, sizeStart: 1.2, sizeEnd: 0.2,
      colorStart: '#ffc050', colorEnd: '#e02a00', opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ff7a10', sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.plume = new Emitter({
      ...base, maxParticles: 600, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.8,
      speed: 3.5, speedJitter: 0.5, spread: 35, gravity: -0.8, drag: 0.8, sizeStart: 1.2, sizeEnd: 3,
      colorStart: '#2a2522', colorEnd: '#0e0c0b', opacityStart: 0.45, opacityEnd: 0, additive: false,
      colorMid: '#1c1815', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.flames = new Emitter({
      ...base, maxParticles: 300, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.45,
      originY: 1.0, speed: 1.5, speedJitter: 0.5, spread: 30, gravity: -3, drag: 0.6, sizeStart: 0.45, sizeEnd: 0.05,
      colorStart: '#ffcf50', colorEnd: '#ff2a00', opacityStart: 0.6, opacityEnd: 0, additive: true,
      colorMid: '#ff8a1a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    // Smoke (normal blending) first so the additive fire draws over it.
    this.emitters.push(this.trailSmoke, this.plume, this.trailFire, this.embers, this.blastFire, this.flames);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    this.layerMats[0].emissive.set(this.settings.color);
    this.halo.color.set(this.settings.color);
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
    this.trailAcc = 0;
    this.caster.reset();
    this.enemy.reset();
    this.flames.settings.rate = 0;
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
    const impactTime = s.castTime + s.flightTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout();

    // Trail: fire + smoke + embers shed along the path every frame while flying.
    if (this.time >= s.castTime && !this.impacted) {
      this.trailAcc += dt * 220;
      const n = Math.floor(this.trailAcc);
      this.trailAcc -= n;
      const p = this.ball.position;
      this.trailFire.burst(n, p);
      this.trailSmoke.burst(Math.ceil(n * 0.4), p);
      this.embers.burst(Math.ceil(n * 0.25), p);
    }
    // Flames licking at the enemy for about a second after the hit.
    const after = this.time - impactTime;
    this.flames.settings.rate = this.impacted && after > 0.15 && after < 1.5 ? 90 : 0;
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;
    const fly = THREE.MathUtils.clamp((t - s.castTime) / s.flightTime, 0, 1);
    const hand = this.caster.group.position.clone().add(HAND);

    // Flames spiral inward to the hand during the cast.
    const gather = 1 - smoothstep((t - s.castTime) / 0.15);
    this.spiralMat.opacity = 0.8 * gather * smoothstep(t / 0.2);
    this.spiral.visible = this.spiralMat.opacity > 0.01;
    for (let i = 0; i < SPIRAL_N; i++) {
      const a0 = this.spiralSeed[i * 4], r0 = this.spiralSeed[i * 4 + 1];
      const h0 = this.spiralSeed[i * 4 + 2], sp = this.spiralSeed[i * 4 + 3];
      const p = (t * 0.9 * sp + a0) % 1;
      const r = r0 * Math.pow(1 - p, 1.3);
      const a = a0 * 5 + p * 7;
      this.spiralPos[i * 3] = hand.x + Math.cos(a) * r;
      this.spiralPos[i * 3 + 1] = hand.y + h0 * (1 - p);
      this.spiralPos[i * 3 + 2] = hand.z + Math.sin(a) * r;
    }
    this.spiral.geometry.attributes.position.needsUpdate = true;

    // The fireball: grows in the hand, then streaks to the enemy on a low arc.
    const grow = smoothstep((t - s.castTime * 0.3) / (s.castTime * 0.7));
    const e = Math.pow(fly, 1.6);
    this.ball.position.copy(hand).lerp(TARGET, e);
    this.ball.position.y += Math.sin(Math.PI * e) * 1.2;
    const r = s.size * (0.05 + 0.95 * grow);
    this.ball.scale.setScalar(r);
    this.ball.visible = !this.impacted && grow > 0.01;
    this.core.opacity = 0.7;
    this.halo.opacity = 0.25;
    for (let i = 0; i < 3; i++) {
      const m = this.layers[i];
      const wob = 1 + 0.07 * Math.sin(t * (11 + i * 4) + i * 2);
      m.scale.setScalar([1, 0.86, 1.12][i] * wob);
      m.position.set(0.07 * Math.sin(t * 9 + i), 0.07 * Math.cos(t * 7 + i * 2), 0.07 * Math.sin(t * 8 + i * 3));
      m.rotation.set(t * (2 + i), t * (3 - i * 0.7), t * (1.4 + i * 1.3));
    }

    // Caster pulse while gathering.
    this.caster.material.emissive.setRGB(0.5 * gather * grow, 0.15 * gather * grow, 0);

    // Impact visuals.
    if (this.impacted) {
      const c = new THREE.Vector3(TARGET.x, 1.2, TARGET.z);
      this.burst.mesh.position.copy(c);
      this.burst.mesh.scale.setScalar(1 + after * 9);
      this.burst.opacity = 0.55 * Math.exp(-after * 3.5);
      this.flash.mesh.position.copy(c);
      this.flash.mesh.scale.setScalar(1.2 + after * 5);
      this.flash.opacity = 0.6 * Math.exp(-after * 9);
      this.shock.mesh.scale.setScalar(0.5 + after * 18);
      this.shock.material.opacity = Math.max(0, 0.7 * (1 - after / 0.5));
      this.ember.mesh.scale.setScalar(3.2);
      this.ember.material.opacity = 0.3 * Math.exp(-after * 1.2) * (1 - smoothstep((t - (this.duration - 0.8)) / 0.8));
      const sc = 1 - smoothstep((t - (this.duration - 1)) / 1);
      this.scorch.scale.setScalar(2.8);
      (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0.55 * smoothstep(after / 0.2) * sc;
      this.shake = 0.6 * Math.exp(-after * 6);

      // Enemy: white flash, then a flickering orange burn.
      this.enemy.setFlash(1.2 * Math.exp(-after * 5));
      const burn = after > 0.2 && after < 1.6 ? (0.35 + 0.15 * Math.sin(t * 40)) * (1 - smoothstep((after - 1.1) / 0.5)) : 0;
      this.enemy.material.emissive.r += burn * 2.2;
      this.enemy.material.emissive.g += burn * 0.5;
    } else {
      this.burst.opacity = 0;
      this.flash.opacity = 0;
      this.shock.material.opacity = 0;
      this.ember.material.opacity = 0;
      (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(TARGET.x, 1.2, TARGET.z);
    this.blastFire.burst(650, at);
    this.plume.burst(260, new THREE.Vector3(TARGET.x, 0.6, TARGET.z));
    this.embers.burst(300, at);
    this.trailSmoke.burst(120, at);
  }
}

export const fireballModule: EffectModule = {
  label: 'fireball',
  category: 'iconic',
  create: () => new Fireball(),
  telegraphs(effect) {
    const s = (effect as Fireball).settings;
    const impact = s.castTime + s.flightTime;
    const start = Math.min(0.3, s.castTime * 0.4);
    return [
      // Flight path from the mage's hand to the enemy.
      {
        shape: {
          kind: 'line', x1: CASTER_POS.x + HAND.x, z1: CASTER_POS.z + HAND.z, x2: ENEMY_POS.x, z2: ENEMY_POS.z, width: 1.2,
        },
        start, impact,
      },
      // Explosion at the enemy.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 3.5 }, start, impact },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 2, 7), 11);
  },
  buildGui(f, effect) {
    const fb = effect as Fireball;
    const s = fb.settings;
    f.add(s, 'loop');
    f.add(s, 'size', 0.3, 2, 0.05).name('fireball size');
    f.add(s, 'castTime', 0.4, 3, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.3, 2, 0.05).name('flight time');
    f.addColor(s, 'color').onChange(() => fb.applyStyle());
  },
};
