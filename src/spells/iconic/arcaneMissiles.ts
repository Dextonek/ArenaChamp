import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep, softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Arcane Missiles (reworked): the caster channels. A nested rune sigil forms upright in front of the hands while
 * arcane motes swirl up around the caster, then glowing missiles leave the sigil one after another on curving,
 * slightly homing bezier paths, trailing sparkling ribbons, and each one bursts violet on the enemy.
 */
export interface ArcaneMissilesSettings {
  missileCount: number;
  castTime: number; // sigil formation before the first missile
  interval: number; // seconds between missiles
  flightTime: number;
  color: string;
  accent: string;
  loop: boolean;
}

export const defaultArcaneMissiles = (): ArcaneMissilesSettings => ({
  missileCount: 6,
  castTime: 0.7,
  interval: 0.3,
  flightTime: 0.75,
  color: '#b36bff',
  accent: '#ff6ad5',
  loop: false,
});

const MAX_MISSILES = 7;
const AFTERMATH = 1.2;
const MOTES = 90;
const SIGIL = new THREE.Vector3(0, 2.1, CASTER_POS.z - 1.7); // centre of the sigil, in front of the hands
const CHEST = new THREE.Vector3(0, 1.3, 0);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Missile {
  halo: GlowSphere;
  core: GlowSphere;
  curve: THREE.CubicBezierCurve3;
  start: number;
  hit: boolean;
  hitPos: THREE.Vector3;
  trailAcc: number;
}

interface SigilRing {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  spin: number;
  base: number; // static rotation offset
  scale: number;
  accent: boolean;
}

export class ArcaneMissiles implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ArcaneMissilesSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private count = 6;
  private enemyFlash = 0;
  private hitPulse = 0;
  private fireFlash = 0;
  private burstT = 99; // time since the last impact flash

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xd9a8ff, { rim: false });
  private burst = new GlowSphere(0xb36bff);
  private mark = createRing(0xb36bff, 0.2, 1, 48); // arcane scorch on the ground under the enemy
  private rings: SigilRing[] = [];
  private missiles: Missile[] = [];

  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = new Float32Array(MOTES * 3); // phase, radius, rise offset
  private moteGeo = new THREE.BufferGeometry();
  private moteMat: THREE.PointsMaterial;
  private motes: THREE.Points;

  private trail: Emitter;
  private glints: Emitter;
  private sparks: Emitter;
  private puff: Emitter;
  private smoke: Emitter; // dark violet smoke behind the bright hits

  private v = new THREE.Vector3();

  constructor(settings: ArcaneMissilesSettings = defaultArcaneMissiles()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.handGlow.mesh, this.burst.mesh, this.mark.mesh);

    // Nested sigil: circle, pentagon, hexagram (two triangles), inner circle. Upright, facing the enemy (-Z).
    const defs: [number, number, number, number, number, number, boolean][] = [
      // inner, outer, segments, spin, base, scale, accent
      [0.92, 1, 96, 0.5, 0, 1, false],
      [0.8, 0.86, 5, -1.0, 0, 1, true],
      [0.55, 0.61, 3, 1.6, 0, 1, false],
      [0.55, 0.61, 3, 1.6, Math.PI / 3, 1, true],
      [0.28, 0.33, 64, -0.7, 0, 1, false],
    ];
    for (const [inner, outer, seg, spin, base, scale, accent] of defs) {
      const r = createRing(0xffffff, inner, outer, seg);
      r.mesh.rotation.set(0, 0, 0); // RingGeometry lies in XY, so it already faces +/-Z
      this.rings.push({ mesh: r.mesh, material: r.material, spin, base, scale, accent });
      this.group.add(r.mesh);
    }

    for (let i = 0; i < MAX_MISSILES; i++) {
      const m: Missile = {
        halo: new GlowSphere(0xb36bff), core: new GlowSphere(0xffe6ff, { rim: false }),
        curve: new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()),
        start: 0, hit: false, hitPos: new THREE.Vector3(), trailAcc: 0,
      };
      this.group.add(m.halo.mesh, m.core.mesh);
      this.missiles.push(m);
    }

    // Motes circling the caster on rising spirals.
    for (let i = 0; i < MOTES; i++) {
      this.moteSeed[i * 3] = rand(0, Math.PI * 2);
      this.moteSeed[i * 3 + 1] = rand(0.8, 1.9);
      this.moteSeed[i * 3 + 2] = Math.random();
    }
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.moteMat = new THREE.PointsMaterial({
      size: 0.24, map: softDotTexture(), color: 0xff9be8, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.motes = new THREE.Points(this.moteGeo, this.moteMat);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 2500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 0.08, speed: 0.5, speedJitter: 0.6, spread: 180, gravity: 0, drag: 1.5,
      sizeStart: 0.3, sizeEnd: 0.02, colorStart: '#ffd0f4', colorMid: '#ff9be8', colorEnd: '#7a3cff',
      opacityStart: 0.45, opacityEnd: 0, additive: true,
      sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.glints = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.15, speed: 1.6, speedJitter: 0.6, spread: 180, gravity: 1.5, drag: 1,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#c77dff',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.1, speed: 8, speedJitter: 0.6, spread: 180, gravity: 8, drag: 0.9,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fbe6ff', colorEnd: '#a45cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.puff = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.2, speed: 3, speedJitter: 0.5, spread: 180, gravity: -0.5, drag: 1.6,
      sizeStart: 0.4, sizeEnd: 1.3, colorStart: '#f0d0ff', colorMid: '#d79bff', colorEnd: '#5a2a9e',
      opacityStart: 0.35, opacityEnd: 0, additive: true,
      sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.4, speedJitter: 0.5, spread: 180, gravity: -0.3, drag: 1.4,
      sizeStart: 0.5, sizeEnd: 1.6, colorStart: '#6a4a9a', colorMid: '#3a2468', colorEnd: '#150c28',
      opacityStart: 0.3, opacityEnd: 0, additive: false,
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    // Dark smoke (normal blending) first so the additive layers draw over it.
    this.emitters.push(this.smoke, this.trail, this.glints, this.sparks, this.puff);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const s = this.settings;
    for (const r of this.rings) r.material.color.set(r.accent ? s.accent : s.color);
    this.burst.color.set(s.color);
    this.mark.material.color.set(s.color);
    this.handGlow.color.set(s.color).lerp(new THREE.Color(0xffffff), 0.4);
    for (const m of this.missiles) m.halo.color.set(s.color);
    this.moteMat.color.set(s.accent);
    const hot = (hex: string) => '#' + new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.5).getHexString();
    this.trail.settings.colorStart = hot(s.accent);
    this.trail.settings.colorMid = s.accent;
    this.trail.settings.colorEnd = s.color;
    this.puff.settings.colorStart = hot(s.accent);
    this.puff.settings.colorMid = s.accent;
    this.puff.settings.colorEnd = s.color;
    this.trail.applyStyle();
    this.puff.applyStyle();
  }

  get duration() {
    const s = this.settings;
    return s.castTime + (this.count - 1) * s.interval + s.flightTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    const s = this.settings;
    this.count = THREE.MathUtils.clamp(Math.round(s.missileCount), 1, MAX_MISSILES);
    this.time = 0;
    this.enemyFlash = this.hitPulse = this.fireFlash = 0;
    this.burstT = 99;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = this.missiles[i];
      m.hit = false;
      m.trailAcc = 0;
      m.start = s.castTime + i * s.interval;
      // Launch from around the sigil, arc out sideways, then pull in toward the enemy (the late control point is
      // closer to the line, which gives the slight homing feel).
      const p0 = SIGIL.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), 0));
      m.hitPos.set(rand(-0.3, 0.3), CHEST.y + rand(-0.4, 0.4), rand(-0.2, 0.2));
      const side = (Math.random() < 0.5 ? -1 : 1);
      const p1 = p0.clone().lerp(m.hitPos, 0.3).add(new THREE.Vector3(side * rand(2.5, 5), rand(1.5, 4), 0));
      const p2 = p0.clone().lerp(m.hitPos, 0.7).add(new THREE.Vector3(-side * rand(0.8, 2.5), rand(-0.5, 1.5), 0));
      m.curve.v0.copy(p0);
      m.curve.v1.copy(p1);
      m.curve.v2.copy(p2);
      m.curve.v3.copy(m.hitPos);
      m.halo.opacity = 0;
      m.core.opacity = 0;
    }
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
    this.enemyFlash *= Math.exp(-dt * 8);
    this.hitPulse *= Math.exp(-dt * 10);
    this.fireFlash *= Math.exp(-dt * 8);
    this.shake *= Math.exp(-dt * 9);
    this.burstT += dt;
    const s = this.settings;
    for (let i = 0; i < this.count; i++) {
      const m = this.missiles[i];
      if (!m.hit && this.time >= m.start + s.flightTime) this.onHit(m);
      if (this.time >= m.start && this.time < m.start + dt + 0.0001) this.fireFlash = 1;
    }
    this.layout(dt);
  }

  private onHit(m: Missile) {
    m.hit = true;
    this.enemyFlash = 1;
    this.hitPulse = 1;
    this.burstT = 0;
    this.shake = Math.min(this.shake + 0.15, 0.35);
    this.sparks.burst(110, m.hitPos);
    this.puff.burst(40, m.hitPos);
    this.smoke.burst(14, m.hitPos);
    this.glints.burst(30, m.hitPos);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const active = this.playing ? 1 : 0;
    const fireEnd = s.castTime + (this.count - 1) * s.interval + 0.2;
    const form = smoothstep(t / s.castTime) * active;
    const sustain = 1 - smoothstep((t - fireEnd) / 0.5);
    const amt = form * sustain;

    // Sigil: nested rings counter-rotating, standing upright in front of the caster's hands.
    const size = 1.7 * (0.3 + 0.7 * form) + 0.1 * this.fireFlash;
    for (const r of this.rings) {
      r.mesh.position.copy(SIGIL);
      r.mesh.rotation.set(0, 0, r.base + t * r.spin);
      r.mesh.scale.setScalar(Math.max(0.001, size * r.scale));
      r.material.opacity = (0.45 + 0.15 * this.fireFlash) * amt;
    }
    this.handGlow.mesh.position.copy(SIGIL);
    this.handGlow.mesh.scale.setScalar((0.25 + 0.1 * Math.sin(t * 14)) * (0.4 + 0.6 * form) + 0.2 * this.fireFlash);
    this.handGlow.opacity = 0.5 * amt;

    // Motes spiralling up around the caster during the channel.
    const p = this.motePos;
    for (let i = 0; i < MOTES; i++) {
      const ph = this.moteSeed[i * 3], rad = this.moteSeed[i * 3 + 1], off = this.moteSeed[i * 3 + 2];
      const rise = (off + t * 0.35) % 1;
      const a = ph + t * (1.8 + 0.5 / rad);
      const rr = rad * (0.75 + 0.25 * Math.sin(rise * Math.PI));
      p[i * 3] = CASTER_POS.x + Math.cos(a) * rr;
      p[i * 3 + 1] = 0.1 + rise * 3.4;
      p[i * 3 + 2] = CASTER_POS.z + Math.sin(a) * rr;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = 0.5 * smoothstep(t / 0.5) * sustain * active;

    // Missiles: bezier flight, head glow, trail bursts along the path.
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = this.missiles[i];
      const u = (t - m.start) / s.flightTime;
      if (i >= this.count || !this.playing || u < 0 || u >= 1) {
        m.halo.opacity = 0;
        m.core.opacity = 0;
        continue;
      }
      const e = Math.pow(u, 1.5); // eases in, then accelerates onto the target
      m.curve.getPoint(e, this.v);
      m.halo.mesh.position.copy(this.v);
      m.core.mesh.position.copy(this.v);
      m.halo.mesh.scale.setScalar(0.5 + 0.06 * Math.sin(t * 40 + i));
      m.core.mesh.scale.setScalar(0.26);
      m.halo.opacity = 0.55;
      m.core.opacity = 0.9;
      m.trailAcc += dt * 140;
      const n = Math.floor(m.trailAcc);
      m.trailAcc -= n;
      if (n > 0) this.trail.burst(n, this.v);
      if (dt > 0 && Math.random() < dt * 40) this.glints.burst(1, this.v);
    }

    // Impact flash shell + enemy reaction (flash, tiny recoil).
    this.burst.mesh.position.set(CHEST.x, CHEST.y, CHEST.z);
    this.burst.mesh.scale.setScalar(0.7 + this.burstT * 9);
    this.burst.opacity = this.burstT < 1 ? 0.55 * Math.exp(-this.burstT * 9) : 0;
    this.mark.mesh.position.set(ENEMY_POS.x, 0.04, ENEMY_POS.z);
    this.mark.mesh.scale.setScalar(2.2);
    this.mark.material.opacity = this.burstT < 4 ? 0.3 * Math.exp(-this.burstT * 1.1) : 0;
    this.enemy.setFlash(Math.min(this.enemyFlash, 0.9));
    this.enemy.group.position.z = -0.25 * this.hitPulse;
  }
}

export const arcaneMissilesModule: EffectModule = {
  label: 'arcane missiles',
  category: 'iconic',
  create: () => new ArcaneMissiles(),
  telegraphs(effect) {
    const s = (effect as ArcaneMissiles).settings;
    const count = THREE.MathUtils.clamp(Math.round(s.missileCount), 1, MAX_MISSILES);
    const first = s.castTime + s.flightTime;
    const last = s.castTime + (count - 1) * s.interval + s.flightTime;
    return [
      // The volley's path from the caster to the enemy (the missiles arc sideways, hence the width).
      { shape: { kind: 'line', x1: CASTER_POS.x, z1: CASTER_POS.z, x2: ENEMY_POS.x, z2: ENEMY_POS.z, width: 3 }, start: 0.2, impact: first, until: last },
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 1.5 }, start: 0.2, impact: first, until: last },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14, enemy at the origin; the missiles arc through the gap.
    frameArena(camera, controls, new THREE.Vector3(0, 2.5, 7), 11);
  },
  buildGui(f, effect) {
    const a = effect as ArcaneMissiles;
    const s = a.settings;
    f.add(s, 'loop');
    f.add(s, 'missileCount', 3, 7, 1).name('missiles');
    f.add(s, 'castTime', 0.2, 2, 0.05).name('cast time');
    f.add(s, 'interval', 0.1, 0.8, 0.01);
    f.add(s, 'flightTime', 0.3, 1.5, 0.05).name('flight time');
    f.addColor(s, 'color').onChange(() => a.applyStyle());
    f.addColor(s, 'accent').onChange(() => a.applyStyle());
  },
};
