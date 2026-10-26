import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, LightPillar, createRing, smoothstep } from '../../effects/common';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cataclysm Sigil (targeted, ground AoE): a huge burning sigil draws itself on the chosen ground, its pulse racing
 * faster as the countdown runs out, four satellite circles flare around it and fiery orbs gather in the sky.
 * A rock meteor in a three-layer fire shell falls on a diagonal from the caster's side, a light column marks the
 * spot, and the impact detonates: flash, triple shockwave, dust ring, sparks, bouncing rocks. Four smaller
 * satellite meteors then hit the satellite circles in turn (an aftershock rhythm) and a cracked scorch cools away.
 *
 * Recipes: b-ffxiv-bahamut-megaflare (pulsing circles, orbs), c-rookies-meteor-strike (shell, flash, sparks,
 * dust ring, rocks, scorch), a-dota-invoker-sun-strike (light column just before impact).
 */
export interface CataclysmSigilSettings {
  meteorSize: number;
  damage: number;
  satelliteDamage: number;
  loop: boolean;
}

export const defaultCataclysmSigil = (): CataclysmSigilSettings => ({
  meteorSize: 2.2,
  damage: 70,
  satelliteDamage: 25,
  loop: false,
});

const DURATION = 5.4;
const MAIN_RADIUS = 6;
const SAT_RADIUS = 2.2;
const SAT_DIST = 7;
const MAIN_FALL_START = 0.6;
const MAIN_IMPACT = 2.2;
const SAT_IMPACTS = [2.5, 2.65, 2.8, 2.95];
const SAT_FALL = 0.5;
const COLUMN_START = 1.9;
const ROCKS_MAIN = 60;
const ROCKS_SAT = 10;
const ROCKS = ROCKS_MAIN + ROCKS_SAT * 4;
const CRACKS = 22;
const METEOR_GEO_RADIUS = 2.2;

interface Meteor {
  mesh: THREE.Mesh;
  wire: THREE.Mesh;
  glow: GlowSphere;
  orb: GlowSphere;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t0: number;
  t1: number;
  radius: number;
  prev: THREE.Vector3;
  hasPrev: boolean;
}

interface Strike {
  pos: THREE.Vector3;
  t: number;
  scale: number;
  done: boolean;
  flash: GlowSphere;
  shell: GlowSphere;
  rings: { r: ReturnType<typeof createRing>; delay: number }[];
}

/** A lumpy dark rock: icosahedron with vertices pushed by a position hash, so shared corners stay joined. */
function createRockGeometry(radius: number) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h = Math.sin(Math.round(v.x * 10) * 12.9898 + Math.round(v.y * 10) * 78.233 + Math.round(v.z * 10) * 37.719) * 43758.5453;
    const n = h - Math.floor(h);
    v.multiplyScalar(0.82 + 0.4 * n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class CataclysmSigil implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CataclysmSigilSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Satellite circle centres (world, y = 0), computed in cast(). */
  readonly sats = [0, 1, 2, 3].map(() => new THREE.Vector3());
  private time = 0;
  private point = new THREE.Vector3();
  private back = new THREE.Vector3(0, 0, 1);

  // --- Sigil on the ground ---
  private outer = createRing(0xff7a1a, 0.965, 1, 128);
  private spinners = [
    { r: createRing(0xff7a1a, 0.95, 1, 6), k: 0.86, w: 1.1 },
    { r: createRing(0xffa030, 0.95, 1, 8), k: 0.72, w: -1.5 },
    { r: createRing(0xff7a1a, 0.94, 1, 5), k: 0.58, w: 2.0 },
  ];
  private starA = createRing(0xffa030, 0.955, 1, 3);
  private starB = createRing(0xffa030, 0.955, 1, 3);
  private starHex = createRing(0xff7a1a, 0.93, 1, 6);
  private satRings = [0, 1, 2, 3].map(() => ({
    outer: createRing(0xff7a1a, 0.9, 1, 64),
    inner: createRing(0xffa030, 0.88, 1, 4),
  }));
  private sky = new GlowSphere(0xff6a1a, { rim: false });
  private pillar = new LightPillar(0xffb060, 2);
  private light = new THREE.PointLight(0xff8a30, 0, 45, 2);

  // --- Meteors and strikes ---
  private rockGeo = createRockGeometry(METEOR_GEO_RADIUS);
  private meteors: Meteor[] = [];
  private strikes: Strike[] = [];

  // --- Rocks, scorch, cracks ---
  private rockMat = new THREE.MeshStandardMaterial({
    color: 0x3a2c26, roughness: 0.9, flatShading: true, emissive: 0xff5a10, emissiveIntensity: 0,
  });
  private rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.25), this.rockMat, ROCKS);
  private rockState = Array.from({ length: ROCKS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1,
  }));
  private scorchMat = new THREE.MeshBasicMaterial({
    color: 0x120c09, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), this.scorchMat);
  private crackMat = new THREE.MeshBasicMaterial({
    color: 0xffa030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.1).rotateX(-Math.PI / 2), this.crackMat, CRACKS);
  private crackSeed = Array.from({ length: CRACKS }, (_, i) => ({
    a: (i / CRACKS) * Math.PI * 2 + Math.random() * 0.2,
    len: 1.4 + Math.random() * 3.6,
    w: 0.5 + Math.random() * 1.1,
    in: 0.3 + Math.random() * 0.6,
  }));

  // --- Particles ---
  private skin: Emitter;
  private shed: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;
  private dust: Emitter;
  private column: Emitter;
  private embers: Emitter;

  constructor(settings: CataclysmSigilSettings = defaultCataclysmSigil()) {
    this.settings = settings;
    this.rocks.frustumCulled = false;
    this.cracks.frustumCulled = false;
    this.scorch.renderOrder = -1;
    this.scorch.position.y = 0.02;
    this.cracks.renderOrder = 0;

    const g = this.group;
    g.add(this.scorch, this.cracks, this.outer.mesh, this.starA.mesh, this.starB.mesh, this.starHex.mesh);
    for (const s of this.spinners) g.add(s.r.mesh);
    for (const s of this.satRings) g.add(s.outer.mesh, s.inner.mesh);
    g.add(this.sky.mesh, this.pillar.mesh, this.light, this.rocks);

    // Main meteor (index 0) and four satellites.
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(this.rockGeo, new THREE.MeshStandardMaterial({
        color: 0x2a201c, roughness: 0.85, flatShading: true, emissive: 0xff5a10, emissiveIntensity: 0.7,
      }));
      const wire = new THREE.Mesh(this.rockGeo, new THREE.MeshBasicMaterial({
        color: 0xff8a30, wireframe: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      wire.scale.setScalar(1.01);
      const glow = new GlowSphere(0xff7a1a);
      const orb = new GlowSphere(0xffa040, { rim: false });
      mesh.visible = wire.visible = false;
      const t1 = i === 0 ? MAIN_IMPACT : SAT_IMPACTS[i - 1];
      this.meteors.push({
        mesh, wire, glow, orb, start: new THREE.Vector3(), end: new THREE.Vector3(),
        t0: i === 0 ? MAIN_FALL_START : t1 - SAT_FALL, t1, radius: i === 0 ? settings.meteorSize : 0.9,
        prev: new THREE.Vector3(), hasPrev: false,
      });
      g.add(mesh, wire, glow.mesh, orb.mesh);
    }
    for (let i = 0; i < 5; i++) {
      const rings: Strike['rings'] = i === 0
        ? [0, 0.06, 0.14].map((delay, j) => ({ r: createRing(j === 1 ? 0xffa030 : j === 2 ? 0xff5a10 : 0xffe0a0, 0.9, 1, 96), delay }))
        : [{ r: createRing(0xffc070, 0.9, 1, 64), delay: 0 }];
      const st: Strike = {
        pos: new THREE.Vector3(), t: i === 0 ? MAIN_IMPACT : SAT_IMPACTS[i - 1], scale: i === 0 ? 1 : 0.42, done: false,
        flash: new GlowSphere(0xfff0b0, { rim: false }), shell: new GlowSphere(0xff7a1a), rings,
      };
      this.strikes.push(st);
      g.add(st.flash.mesh, st.shell.mesh, ...rings.map((r) => r.r.mesh));
    }

    this.skin = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.4, speed: 0.8, speedJitter: 0.6, spread: 180, gravity: 0, drag: 1.5,
      sizeStart: 1.3, sizeEnd: 0.3, colorStart: '#fff0b0', colorEnd: '#7a2008', colorMid: '#ff7a1a',
      opacityStart: 0.3, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.4, spin: 0.6,
    });
    this.shed = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.1, speed: 3.2, speedJitter: 0.7, spread: 180, gravity: 3, drag: 1.2,
      sizeStart: 0.2, sizeEnd: 0.02, colorStart: '#fff0b0', colorEnd: '#7a2008', colorMid: '#ff7a1a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    // Dark normal-blended layers: the meteor's smoke trail and the aftermath drift.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 0.8, speedJitter: 0.7, spread: 180, gravity: -0.3, drag: 1,
      sizeStart: 1.5, sizeEnd: 3.4, colorStart: '#3a2418', colorEnd: '#120c09', colorMid: '#241811',
      opacityStart: 0.45, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1600, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 15, speedJitter: 0.6, spread: 80, gravity: 14, drag: 0.9,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff0b0', colorEnd: '#ff3a10', colorMid: '#ff9a30',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 9, speedJitter: 0.6, spread: 100, gravity: -0.2, drag: 2.2,
      sizeStart: 1.2, sizeEnd: 3.5, colorStart: '#6a5240', colorEnd: '#2a2018', colorMid: '#4a382b',
      opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    this.column = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 1.6, speed: 9, speedJitter: 0.5, spread: 14, gravity: -0.1, drag: 1,
      sizeStart: 1.5, sizeEnd: 3.8, colorStart: '#4a3425', colorEnd: '#1a120d', colorMid: '#2e2018',
      opacityStart: 0.42, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.3,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 2.6, speedJitter: 0.6, spread: 45, gravity: -1.2, drag: 0.7,
      sizeStart: 0.2, sizeEnd: 0, colorStart: '#fff0b0', colorEnd: '#7a2008', colorMid: '#ff7a1a',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0.5, spin: 0.5,
    });
    this.emitters.push(this.skin, this.shed, this.smoke, this.sparks, this.dust, this.column, this.embers);
    for (const e of this.emitters) g.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return MAIN_IMPACT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    // Direction from the target toward the caster; the meteor comes from that side.
    this.back.set(ctx.from.x - this.point.x, 0, ctx.from.z - this.point.z);
    if (this.back.lengthSq() < 1e-4) this.back.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    if (this.back.lengthSq() < 1e-4) this.back.set(0, 0, 1);
    this.back.normalize();
    for (let i = 0; i < 4; i++) {
      const yaw = ctx.aim + Math.PI / 4 + (i * Math.PI) / 2;
      this.sats[i].set(this.point.x + Math.sin(yaw) * SAT_DIST, 0, this.point.z + Math.cos(yaw) * SAT_DIST);
    }
    const m0 = this.meteors[0];
    m0.radius = this.settings.meteorSize;
    m0.start.copy(this.point).addScaledVector(this.back, 25).setY(45);
    m0.end.copy(this.point).setY(m0.radius * 0.5);
    for (let i = 0; i < 4; i++) {
      const m = this.meteors[i + 1];
      m.start.copy(this.sats[i]).addScaledVector(this.back, 3).setY(14);
      m.end.copy(this.sats[i]).setY(m.radius * 0.5);
      this.strikes[i + 1].pos.copy(this.sats[i]);
    }
    this.strikes[0].pos.copy(this.point);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const e of this.emitters) e.clear();
    for (const s of this.strikes) s.done = false;
    for (const m of this.meteors) m.hasPrev = false;
    for (const r of this.rockState) { r.p.set(0, -50, 0); r.v.set(0, 0, 0); }
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    for (let i = 0; i < this.strikes.length; i++) {
      if (!this.strikes[i].done && this.time >= this.strikes[i].t) this.onStrike(i);
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - MAIN_IMPACT;
    const fade = 1 - smoothstep((t - (DURATION - 0.9)) / 0.9);
    const c = this.point;
    const counting = Math.min(1, t / MAIN_IMPACT);

    // --- Anticipation: the sigil draws itself and pulses faster as the countdown runs out. ---
    const draw = smoothstep(t / 1.6);
    const pulse = 0.78 + 0.22 * Math.sin(t * (4 + 14 * counting * counting));
    const post = t >= MAIN_IMPACT ? Math.exp(-(t - MAIN_IMPACT) * 0.9) : 1;
    const sig = draw * pulse * post * fade;
    const sc = MAIN_RADIUS * (0.55 + 0.45 * draw);
    this.outer.mesh.position.set(c.x, 0.05, c.z);
    this.outer.mesh.scale.setScalar(sc);
    this.outer.material.opacity = 0.6 * sig;
    this.spinners.forEach((sp, i) => {
      sp.r.mesh.position.set(c.x, 0.055 + i * 0.002, c.z);
      sp.r.mesh.scale.setScalar(sc * sp.k);
      sp.r.mesh.rotation.z = t * sp.w * (1 + counting);
      sp.r.material.opacity = 0.5 * sig * smoothstep((t - i * 0.2) / 0.8);
    });
    const starOp = 0.55 * sig * smoothstep((t - 0.5) / 0.9);
    this.starA.mesh.position.set(c.x, 0.06, c.z);
    this.starB.mesh.position.set(c.x, 0.062, c.z);
    this.starHex.mesh.position.set(c.x, 0.064, c.z);
    this.starA.mesh.scale.setScalar(sc * 0.78);
    this.starB.mesh.scale.setScalar(sc * 0.78);
    this.starHex.mesh.scale.setScalar(sc * 0.4);
    this.starA.mesh.rotation.z = t * 0.5;
    this.starB.mesh.rotation.z = t * 0.5 + Math.PI / 3;
    this.starHex.mesh.rotation.z = -t * 0.9;
    for (const r of [this.starA, this.starB, this.starHex]) r.material.opacity = starOp;

    for (let i = 0; i < 4; i++) {
      const sr = this.satRings[i];
      const p = this.sats[i];
      const on = smoothstep((t - 0.6 - i * 0.12) / 0.5);
      const hitAfter = t - SAT_IMPACTS[i];
      const sOp = on * (hitAfter > 0 ? Math.exp(-hitAfter * 3) : 0.35 + 0.65 * pulse) * fade;
      sr.outer.mesh.position.set(p.x, 0.05, p.z);
      sr.inner.mesh.position.set(p.x, 0.055, p.z);
      sr.outer.mesh.scale.setScalar(SAT_RADIUS * (0.7 + 0.3 * on));
      sr.inner.mesh.scale.setScalar(SAT_RADIUS * 0.62);
      sr.inner.mesh.rotation.z = -t * 2 * (1 + counting);
      sr.outer.material.opacity = 0.6 * sOp;
      sr.inner.material.opacity = 0.45 * sOp;
    }

    // The sky glows while the sigil burns.
    this.sky.mesh.position.set(c.x, 32, c.z);
    this.sky.mesh.scale.setScalar(16);
    this.sky.opacity = 0.25 * smoothstep(t / 1.6) * (t < MAIN_IMPACT ? 1 : Math.exp(-(t - MAIN_IMPACT) * 1.6)) * fade;

    // --- Light column marks the spot just before the meteor arrives. ---
    const drop = smoothstep((t - COLUMN_START) / (MAIN_IMPACT - COLUMN_START));
    const colOp = t < MAIN_IMPACT ? 0.55 * drop : 0.7 * Math.exp(-after * 3.5);
    this.pillar.set(c.x, c.z, 60 * (1 - drop), 60, colOp * fade);
    this.pillar.mesh.scale.x = 1 + (t >= MAIN_IMPACT ? after * 1.5 : 0);
    this.pillar.mesh.scale.z = this.pillar.mesh.scale.x;

    // The caster burns up with the countdown.
    if (this.ctx) {
      const glow = smoothstep(t / 1.6) * (1 - smoothstep((t - 1.8) / 0.5));
      this.ctx.caster.material.emissive.setRGB(0.8 * glow * pulse, 0.3 * glow * pulse, 0.04 * glow);
    }

    // --- Meteors: main plus four satellites; orbs gather above the satellite circles first. ---
    let fall = 0;
    this.meteors.forEach((m, i) => {
      const spanned = (t - m.t0) / (m.t1 - m.t0);
      const flying = spanned >= 0 && spanned < 1;
      const orbOn = i > 0 ? smoothstep((t - 0.6 - (i - 1) * 0.12) / (m.t0 - 0.6)) : 0;
      m.orb.mesh.position.copy(m.start);
      m.orb.mesh.scale.setScalar(0.3 + 1.1 * orbOn + 0.12 * Math.sin(t * 18));
      m.orb.opacity = t < m.t0 ? 0.4 * orbOn * fade : 0;
      m.mesh.visible = m.wire.visible = flying;
      m.glow.opacity = flying ? 0.38 : 0;
      if (!flying) { m.hasPrev = false; return; }
      const e = i === 0 ? spanned * spanned : Math.pow(spanned, 1.6);
      const p = m.mesh.position.lerpVectors(m.start, m.end, e);
      const k = m.radius / METEOR_GEO_RADIUS;
      m.mesh.scale.setScalar(k);
      m.wire.position.copy(p);
      m.wire.scale.setScalar(k * 1.01);
      m.mesh.rotation.set(t * 1.6 + i, t * 2.3, t * 0.9);
      m.wire.rotation.copy(m.mesh.rotation);
      m.glow.mesh.position.copy(p);
      m.glow.mesh.scale.setScalar(m.radius * (1.55 + 0.1 * Math.sin(t * 40)));
      fall = Math.max(fall, i === 0 ? 0.05 + 0.4 * e : 0.12);
      if (dt > 0) this.shell(m, p, i === 0 ? 1 : 0.4);
    });

    // --- Strikes: flash, burst shell, staggered shock rings, light. ---
    let boom = 0;
    let lightAt: THREE.Vector3 | null = null;
    let lightK = 0;
    for (const st of this.strikes) {
      const a = t - st.t;
      const k = st.scale;
      if (a < 0 || !st.done) {
        st.flash.opacity = 0;
        st.shell.opacity = 0;
        for (const r of st.rings) r.r.material.opacity = 0;
        continue;
      }
      st.flash.mesh.position.set(st.pos.x, 1.2 * k + 0.4, st.pos.z);
      st.flash.mesh.scale.setScalar((2 + a * 5) * k * 1.6);
      st.flash.opacity = 0.85 * Math.exp(-a * 20);
      st.shell.mesh.position.set(st.pos.x, 1 * k, st.pos.z);
      st.shell.mesh.scale.setScalar((1 + a * 11) * k * 1.4);
      st.shell.opacity = 0.5 * Math.exp(-a * 4.5) * fade;
      st.rings.forEach((r, j) => {
        const ra = a - r.delay;
        r.r.mesh.position.set(st.pos.x, 0.07 + j * 0.01, st.pos.z);
        r.r.mesh.scale.setScalar((1 + Math.max(0, ra) * (24 - j * 4)) * k * 1.3);
        r.r.material.opacity = ra > 0 ? Math.max(0, 0.7 * (1 - ra / (0.75 + j * 0.15))) * fade : 0;
      });
      boom = Math.max(boom, (k > 0.9 ? 0.9 : 0.35) * Math.exp(-a * (k > 0.9 ? 5 : 9)));
      const lk = k * Math.exp(-a * 7);
      if (lk > lightK) { lightK = lk; lightAt = st.pos; }
    }
    this.shake = Math.max(boom, t < MAIN_IMPACT ? fall * 0.15 : 0);
    if (lightAt) this.light.position.set(lightAt.x, 4, lightAt.z);
    this.light.intensity = 260 * lightK * fade;

    // --- Aftermath: scorch decal, cooling ember cracks, rising embers, drifting smoke. ---
    const cool = THREE.MathUtils.clamp(after / 2.5, 0, 1);
    const scorchIn = smoothstep(after / 0.25);
    this.scorch.position.set(c.x, 0.02, c.z);
    this.scorch.scale.setScalar(5 * (0.7 + 0.3 * scorchIn));
    this.scorchMat.opacity = 0.78 * scorchIn * fade;
    this.crackMat.color.setRGB(1, 0.55 - 0.3 * cool, 0.12 - 0.08 * cool);
    this.crackMat.color.lerp(new THREE.Color(0x7a2008), cool * 0.7);
    this.crackMat.opacity = after > 0 ? 0.75 * smoothstep(after / 0.15) * (1 - 0.85 * cool) * fade : 0;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const grow = smoothstep(after / 0.5);
    this.crackSeed.forEach((cs, i) => {
      const len = cs.len * grow;
      const rad = cs.in + len / 2;
      q.setFromAxisAngle(up, -cs.a);
      pos.set(c.x + Math.cos(cs.a) * rad, 0.045, c.z + Math.sin(cs.a) * rad);
      scl.set(Math.max(0.001, len), 1, cs.w);
      this.cracks.setMatrixAt(i, m4.compose(pos, q, scl));
    });
    this.cracks.instanceMatrix.needsUpdate = true;

    if (dt > 0 && after > 0.3 && t < DURATION - 1) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 4.5;
      const at = new THREE.Vector3(c.x + Math.cos(a) * d, 0.2, c.z + Math.sin(a) * d);
      if (Math.random() < dt * 40) this.embers.burst(1 + Math.floor(Math.random() * 2), at);
      if (Math.random() < dt * 8) this.smoke.burst(2, at);
    }

    // --- Rocks: ballistic with a damped bounce, settling on the ground. ---
    const m = new THREE.Matrix4();
    const rq = new THREE.Quaternion();
    const rs = new THREE.Vector3();
    let rockHeat = 0;
    for (let i = 0; i < ROCKS; i++) {
      const r = this.rockState[i];
      if (dt > 0 && r.p.y > -10) {
        r.v.y -= 18 * dt;
        r.p.addScaledVector(r.v, dt);
        r.r.set(r.r.x + r.w.x * dt, r.r.y + r.w.y * dt, r.r.z + r.w.z * dt);
        const floor = 0.2 * r.s;
        if (r.p.y < floor) {
          r.p.y = floor;
          if (Math.abs(r.v.y) < 2) { r.v.set(0, 0, 0); r.w.set(0, 0, 0); } else {
            r.v.y = -r.v.y * 0.35;
            r.v.x *= 0.7; r.v.z *= 0.7;
            r.w.multiplyScalar(0.6);
          }
        }
      }
      if (r.p.y > -10) rockHeat = 1;
      m.compose(r.p, rq.setFromEuler(r.r), rs.setScalar(Math.max(1e-4, r.s * fade))); // never 0: NaN normals → black frame
      this.rocks.setMatrixAt(i, m);
    }
    this.rocks.instanceMatrix.needsUpdate = true;
    this.rockMat.emissiveIntensity = rockHeat * 0.8 * Math.exp(-Math.max(0, after) * 0.9);
  }

  /** Burning shell around a falling meteor: hot skin, shed embers, a long dark smoke trail. */
  private shell(m: Meteor, p: THREE.Vector3, k: number) {
    const from = m.hasPrev ? m.prev : p;
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const at = new THREE.Vector3().lerpVectors(from, p, i / steps);
      this.skin.burst(Math.ceil(6 * k), at);
      this.shed.burst(Math.ceil(5 * k), at);
      this.smoke.burst(Math.ceil(3 * k), at);
    }
    m.prev.copy(p);
    m.hasPrev = true;
  }

  private onStrike(i: number) {
    const st = this.strikes[i];
    st.done = true;
    const p = st.pos;
    const ctx = this.ctx;
    const s = this.settings;
    if (i === 0) {
      this.sparks.burst(900, p);
      this.embers.burst(260, p);
      this.column.burst(320, p);
      const at = new THREE.Vector3();
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2;
        this.dust.burst(24, at.set(p.x + Math.cos(a) * 1.6, 0.3, p.z + Math.sin(a) * 1.6));
      }
      this.launchRocks(0, ROCKS_MAIN, p, 1);
      if (ctx) ctx.targets.forEach((e) => ctx.hit(e, { damage: s.damage, knock: 10, from: p }));
    } else {
      this.sparks.burst(220, p);
      this.embers.burst(50, p);
      const at = new THREE.Vector3();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        this.dust.burst(14, at.set(p.x + Math.cos(a) * 0.8, 0.3, p.z + Math.sin(a) * 0.8));
      }
      this.launchRocks(ROCKS_MAIN + (i - 1) * ROCKS_SAT, ROCKS_SAT, p, 0.5);
      if (ctx) {
        ctx.targets.forEach((e, j) => {
          const tp = ctx.targetPos[j];
          if (tp && Math.hypot(tp.x - p.x, tp.z - p.z) <= SAT_RADIUS) {
            ctx.hit(e, { damage: s.satelliteDamage, knock: 5, from: p });
          }
        });
      }
    }
  }

  private launchRocks(first: number, count: number, p: THREE.Vector3, power: number) {
    for (let j = 0; j < count; j++) {
      const r = this.rockState[first + j];
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 9) * power;
      r.p.set(p.x, 0.5, p.z);
      r.v.set(Math.cos(a) * sp, (6 + Math.random() * 9) * power, Math.sin(a) * sp);
      r.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      r.s = (0.5 + Math.random() * 1.1) * (power > 0.9 ? 1.3 : 0.8);
    }
  }
}

export const cataclysmSigilModule: EffectModule = {
  label: 'cataclysm sigil',
  category: 'targeted',
  targeting: { mode: 'ground', radius: MAIN_RADIUS },
  create: () => new CataclysmSigil(),
  telegraphs(effect) {
    const e = effect as CataclysmSigil;
    if (!e.ctx) return [];
    const c = e.ctx.point;
    return [
      { shape: { kind: 'circle', x: c.x, z: c.z, radius: MAIN_RADIUS }, start: 0.1, impact: MAIN_IMPACT, until: 3.4 },
      ...e.sats.map((p, i) => ({
        shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: SAT_RADIUS }, start: 0.6, impact: SAT_IMPACTS[i],
      })),
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.55, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as CataclysmSigil;
    if (e.ctx) frameCast(camera, controls, e.ctx, 20);
  },
  buildGui(f, effect) {
    const e = effect as CataclysmSigil;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'meteorSize', 1, 4, 0.1).name('meteor size');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'satelliteDamage', 1, 100, 1).name('satellite damage');
  },
};
