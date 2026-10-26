import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, LightPillar, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cinder Bow (targeted, single target): a flat disc of flame ribbons whips round the caster in a darkened world,
 * flame spikes flick up and black scraps spit out. At 1.9 s one thin golden ring (the "bow") snaps open facing
 * the target, everything holds for a dead beat, then a fan of black-red toon ribbons and a fireball streak fire
 * out. An impact frame lands on the target and a tall narrow white-yellow fire pillar erupts (the axis turns
 * from horizontal to vertical) with a cold blue-white star at its base for 3 frames. It lifts and burns the
 * enemy, collapses into licking tongues, and leaves a scorch and a grey dust swirl.
 */
export interface CinderBowSettings {
  damage: number;
  pillarHeight: number;
  loop: boolean;
}

export const defaultCinderBow = (): CinderBowSettings => ({ damage: 55, pillarHeight: 14, loop: false });

// Timeline (seconds).
const BOW_T = 1.9;
const RELEASE_T = 2.3;
const IMPACT_T = 2.45;
const COLLAPSE_T = 3.85;
const DURATION = 5.0;
const CHARGE_ARCS = 4;
const WIND_ARCS = 3;
const FAN = 5;

const hash1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class CinderBow implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CinderBowSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private spikeTimer = 0;
  private scrapTimer = 0;
  private lickTimer = 0;
  private tickTimer = 0;
  private collapsed = false;

  // Cast geometry, computed in cast().
  private dist = 8;
  private from = new THREE.Vector3(0, 0, 14);
  private bowPos = new THREE.Vector3(0, 1.5, 12);
  private impactAt = new THREE.Vector3(0, 0, -8);

  // Charge: flat flame ribbons + white wind streaks around the caster's waist.
  private flame: CrescentArc[] = [];
  private flamePlanes: THREE.Group[] = [];
  private wind: CrescentArc[] = [];
  private windPlanes: THREE.Group[] = [];
  private coreGlow = new GlowSphere(0xff8a30, { rim: false });

  // Bow ring: the single clean shape.
  private bowRoot = new THREE.Group();
  private bowRing = createRing(0xffd060, 0.94, 1, 96);
  private bowGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });

  // Release: fan of toon ribbons + fireball streak.
  private fanRoot = new THREE.Group();
  private fan: CrescentArc[] = [];
  private fanRolls: THREE.Group[] = [];
  private fireball = new GlowSphere(0xffb040, { rim: false });
  private fireballHalo = new GlowSphere(0xff5a1a);

  // Impact.
  private pillar = new LightPillar(0xffe890, 0.5);
  private pillarWide = new LightPillar(0xff6a1a, 1.1);
  private baseStar = new StarBurst({ points: 12, color: 0xcfe8ff, core: 0xffffff, additive: false });
  private baseFlash = new GlowSphere(0xffd070, { rim: false });
  private shock = createRing(0xffb050, 0.88, 1, 96);
  private shock2 = createRing(0xff5a1a, 0.92, 1, 96);
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x0a0605, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.scorchMat);
  private dustArcs: CrescentArc[] = [];
  private dustPlanes: THREE.Group[] = [];

  private spikes: Emitter;
  private scraps: Emitter;
  private trail: Emitter;
  private petals: Emitter;
  private curls: Emitter;
  private tongues: Emitter;
  private dust: Emitter;

  constructor(settings: CinderBowSettings = defaultCinderBow()) {
    this.settings = settings;
    this.screen.tint.set(0x3a1a14);
    this.screen.impactColor.set(0xffe070);
    this.screen.speedLineColor.set(0xffd890);

    for (let i = 0; i < CHARGE_ARCS; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({
        radius: 1.5 + 0.25 * i, width: 1.0, style: 'soft', edge: 0xfff2b0, mid: 0xff9a20, outer: 0xff4a10,
      });
      arc.mesh.rotation.z = (i * Math.PI * 2) / CHARGE_ARCS;
      plane.add(arc.mesh);
      this.flame.push(arc);
      this.flamePlanes.push(plane);
      this.group.add(plane);
    }
    for (let i = 0; i < WIND_ARCS; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({
        radius: 2.3 + 0.35 * i, width: 0.3, style: 'soft', edge: 0xffffff, mid: 0xe8f0ff, outer: 0xb0c0e0, sweep: Math.PI * 1.3,
      });
      arc.mesh.rotation.z = i * 2.1;
      plane.add(arc.mesh);
      this.wind.push(arc);
      this.windPlanes.push(plane);
      this.group.add(plane);
    }

    this.bowRing.mesh.rotation.set(0, 0, 0);
    this.bowRing.mesh.position.set(0, 0, 0);
    this.bowRoot.add(this.bowRing.mesh);
    this.group.add(this.bowRoot, this.bowGlint.mesh, this.coreGlow.mesh);

    for (let i = 0; i < FAN; i++) {
      const roll = new THREE.Group();
      const arc = new CrescentArc({
        radius: 2.0 + 0.25 * (i % 3), width: 1.3, style: 'toon', edge: 0xff5a1a, mid: 0x8a1a0a, outer: 0x0a0303,
        sweep: Math.PI * 1.25,
      });
      arc.mesh.rotation.y = Math.PI / 2;
      arc.mesh.rotation.z = i * 0.6;
      roll.rotation.z = (i - (FAN - 1) / 2) * 0.5;
      roll.add(arc.mesh);
      this.fan.push(arc);
      this.fanRolls.push(roll);
      this.fanRoot.add(roll);
    }
    this.group.add(this.fanRoot, this.fireball.mesh, this.fireballHalo.mesh);

    this.group.add(this.pillar.mesh, this.pillarWide.mesh, this.baseStar.mesh, this.baseFlash.mesh);
    this.group.add(this.shock.mesh, this.shock2.mesh);
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;
    this.scorch.visible = false;
    this.group.add(this.scorch);
    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({
        radius: 2.2 + 1.0 * i, width: 1.1, style: 'toon', edge: 0x9a9590, mid: 0x5e5a56, outer: 0x2a2826, sweep: Math.PI * 1.4,
      });
      arc.mesh.rotation.z = i * Math.PI;
      plane.add(arc.mesh);
      plane.rotation.x = -Math.PI / 2;
      this.dustArcs.push(arc);
      this.dustPlanes.push(plane);
      this.group.add(plane);
    }

    // Short vertical flame spikes flicking up off the charge disc.
    this.spikes = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.35, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 5, speedJitter: 0.5, spread: 14, gravity: -2, drag: 2,
      sizeStart: 0.32, sizeEnd: 0.04, colorStart: '#fff2b0', colorEnd: '#ff4a10', colorMid: '#ff9a20',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.4, spin: 0.5,
    });
    // Black burnt-paper scraps spat outward (normal blended: black is a colour).
    this.scraps = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 4.5, speedJitter: 0.6, spread: 95, gravity: 3, drag: 2,
      sizeStart: 0.34, sizeEnd: 0.14, colorStart: '#7a1a0a', colorEnd: '#0a0303', colorMid: '#1a0505',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.45, spin: 1,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.2, speed: 0.8, speedJitter: 0.8, spread: 180, gravity: -0.5, drag: 2,
      sizeStart: 0.55, sizeEnd: 0.05, colorStart: '#fff2b0', colorEnd: '#ff3a10', colorMid: '#ff9a20',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.6,
    });
    // Flame petals whipping up and out at the pillar base.
    this.petals = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 6, speedJitter: 0.6, spread: 70, gravity: -1, drag: 1.5,
      sizeStart: 0.8, sizeEnd: 0.1, colorStart: '#fff0b0', colorEnd: '#ff3a10', colorMid: '#ff9a20',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.45, erosion: 0.55, spin: 0.8,
    });
    this.curls = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.7, speed: 7, speedJitter: 0.6, spread: 100, gravity: 2, drag: 1.6,
      sizeStart: 1.0, sizeEnd: 0.5, colorStart: '#8a2a10', colorEnd: '#0a0303', colorMid: '#2a0806',
      opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.5, spin: 1,
      groundFade: 0.3,
    });
    this.tongues = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.7, speed: 4, speedJitter: 0.6, spread: 22, gravity: -2.5, drag: 1.2,
      sizeStart: 0.7, sizeEnd: 0.08, colorStart: '#fff2b0', colorEnd: '#ff3a10', colorMid: '#ff9a20',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.55, spin: 0.7,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.6, speed: 2.5, speedJitter: 0.6, spread: 85, gravity: -0.1, drag: 1.4,
      sizeStart: 1.0, sizeEnd: 2.2, colorStart: '#6c6a68', colorEnd: '#1e1d1c', colorMid: '#45433f',
      opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.spikes, this.scraps, this.trail, this.petals, this.curls, this.tongues, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const target = ctx.targetPos[0] ?? ctx.point;
    this.impactAt.copy(target).setY(0);
    this.dist = Math.max(1, Math.hypot(this.impactAt.x - ctx.from.x, this.impactAt.z - ctx.from.z));
    this.bowPos.copy(ctx.from).addScaledVector(fwd, 1.7).setY(1.5);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.impactAt).setY(1.2);

    for (let i = 0; i < CHARGE_ARCS; i++) {
      const p = this.flamePlanes[i];
      p.position.copy(ctx.from).setY(1.1);
      p.rotation.set(-Math.PI / 2 + (i % 2 ? 0.2 : -0.22), 0, (i - 1.5) * 0.08);
    }
    for (let i = 0; i < WIND_ARCS; i++) {
      const p = this.windPlanes[i];
      p.position.copy(ctx.from).setY(1.15 + 0.12 * i);
      p.rotation.set(-Math.PI / 2 + (i - 1) * 0.18, 0, 0);
    }
    this.bowRoot.position.copy(this.bowPos);
    this.bowRoot.rotation.set(0, ctx.aim, 0);
    this.fanRoot.position.copy(this.bowPos);
    this.fanRoot.rotation.set(0, ctx.aim, 0);
    this.coreGlow.mesh.position.copy(ctx.from).setY(1.1);
    for (let i = 0; i < this.dustPlanes.length; i++) this.dustPlanes[i].position.set(this.impactAt.x, 0.08 + i * 0.01, this.impactAt.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.collapsed = false;
    this.spikeTimer = 0;
    this.scrapTimer = 0;
    this.lickTimer = 0;
    this.tickTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const t = this.time;
    const ctx = this.ctx;

    // Charge emitters: spikes every 0.3 s, scraps a few times a second, until the bow snaps open.
    if (t < BOW_T) {
      this.spikeTimer += dt;
      if (this.spikeTimer >= 0.3) {
        this.spikeTimer -= 0.3;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          this.spikes.burst(14, new THREE.Vector3(this.from.x + Math.cos(a) * 1.15, 1.1, this.from.z + Math.sin(a) * 1.15));
        }
      }
      this.scrapTimer += dt;
      if (this.scrapTimer >= 0.07) {
        this.scrapTimer = 0;
        const a = Math.random() * Math.PI * 2;
        this.scraps.burst(4, new THREE.Vector3(this.from.x + Math.cos(a) * 1.2, 1.1, this.from.z + Math.sin(a) * 1.2));
      }
    }

    if (!this.impacted && t >= IMPACT_T) this.onImpact();

    if (this.impacted && t < COLLAPSE_T) {
      // Burning: flame licks at the base, a small tick hit every 0.3 s.
      this.lickTimer += dt;
      if (this.lickTimer >= 0.06) {
        this.lickTimer = 0;
        this.petals.burst(10, new THREE.Vector3(this.impactAt.x, 0.2, this.impactAt.z));
      }
      this.tickTimer += dt;
      if (this.tickTimer >= 0.3) {
        this.tickTimer -= 0.3;
        if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: 6, knock: 0, from: this.impactAt, color: '#ffb050' });
      }
    }
    if (!this.collapsed && t >= COLLAPSE_T) {
      this.collapsed = true;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + Math.random();
        this.tongues.burst(60, new THREE.Vector3(this.impactAt.x + Math.cos(a) * 0.7, 0.2, this.impactAt.z + Math.sin(a) * 0.7));
      }
      this.dust.burst(160, new THREE.Vector3(this.impactAt.x, 0.3, this.impactAt.z));
    }

    // Fireball trail.
    if (t >= RELEASE_T && t < IMPACT_T) {
      const p = this.fireballPos(THREE.MathUtils.clamp((t - RELEASE_T) / (IMPACT_T - RELEASE_T), 0, 1), new THREE.Vector3());
      this.trail.burst(16, p);
    }
    this.layout(dt);
  }

  private fireballPos(u: number, out: THREE.Vector3) {
    return out.copy(this.bowPos).lerp(new THREE.Vector3(this.impactAt.x, 1.2, this.impactAt.z), u);
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - IMPACT_T;
    const ctx = this.ctx;
    const c = this.impactAt;
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.7);

    // --- World grade: dark and warm, from the start until the hit, then released. ---
    this.screen.darken = t < IMPACT_T ? 0.5 * smoothstep(t / 0.5) : 0.5 * Math.exp(-Math.max(0, after) * 2.5);

    // --- Charge: flat flame ribbons whip round at ~2 rev/s with white wind streaks. ---
    const chargeOp = t < BOW_T ? smoothstep(t / 0.35) : 1 - smoothstep((t - BOW_T) / 0.1);
    const frozen = Math.min(t, BOW_T); // the ribbons stop with the bow
    this.flame.forEach((arc, i) => {
      arc.head = (((frozen * 2 + i / CHARGE_ARCS) % 1) * 1.35);
      arc.length = 0.5;
      arc.time = t;
      arc.erosion = 0.15;
      arc.opacity = 1.0 * chargeOp;
    });
    this.wind.forEach((arc, i) => {
      arc.head = (((frozen * 2.6 + i * 0.31) % 1) * 1.4);
      arc.length = 0.4;
      arc.time = t;
      arc.erosion = 0.2;
      arc.opacity = 0.75 * chargeOp;
    });
    this.coreGlow.mesh.scale.setScalar(1.5 + 0.2 * Math.sin(t * 25));
    this.coreGlow.opacity = 0.3 * chargeOp;

    // --- Bow: one thin golden ring snaps open in a frame, holds, vanishes at the release. ---
    const bowOn = t >= BOW_T && t < RELEASE_T;
    this.bowRing.mesh.scale.setScalar(bowOn ? 1.5 : 0.01);
    this.bowRing.material.opacity = bowOn ? 0.95 : 0;
    this.bowRing.mesh.visible = bowOn;
    const gl = StarBurst.pop(t - BOW_T, 0.1, 0.15);
    this.bowGlint.set(this.bowPos, 1.4 * gl.scale, gl.opacity, 0);

    // --- Release: fan of black-red toon ribbons + a fireball streak, with speed lines. ---
    const rel = t - RELEASE_T;
    const travel = Math.max(1, this.dist - 1.7) * 0.75;
    this.fan.forEach((arc, i) => {
      const u = rel / 0.2;
      const on = rel >= 0 && rel < 0.55;
      arc.head = Math.max(0, u) * 1.0 + 0.1 * i / FAN;
      arc.length = 0.6;
      arc.time = t;
      arc.erosion = on ? smoothstep((rel - 0.2) / 0.3) * 0.9 : 1;
      arc.opacity = on ? 1 : 0;
      arc.mesh.position.set(0, 0, travel * (1 - Math.pow(1 - THREE.MathUtils.clamp(rel / 0.25, 0, 1), 2)));
      arc.mesh.scale.setScalar(0.4 + 0.6 * THREE.MathUtils.clamp(rel / 0.15, 0, 1));
    });
    const flying = t >= RELEASE_T && t < IMPACT_T;
    const fp = this.fireballPos(THREE.MathUtils.clamp(rel / (IMPACT_T - RELEASE_T), 0, 1), new THREE.Vector3());
    this.fireball.mesh.position.copy(fp);
    this.fireball.mesh.scale.setScalar(0.7);
    this.fireball.opacity = flying ? 0.9 : 0;
    this.fireballHalo.mesh.position.copy(fp);
    this.fireballHalo.mesh.scale.setScalar(1.3);
    this.fireballHalo.opacity = flying ? 0.35 : 0;
    this.screen.speedLines = flying ? 0.6 : 0;
    this.screen.impact = impactFrameAt(t, IMPACT_T, [2], 0.05);

    // --- Impact: the axis turns vertical. Narrow white-yellow pillar + wider dim orange one behind. ---
    const H = this.settings.pillarHeight;
    if (this.impacted) {
      const rise = smoothstep(after / 0.033);
      const coll = smoothstep((t - COLLAPSE_T) / 0.3);
      const flick = 0.8 + 0.4 * hash1(Math.floor(t * 20));
      const top = H * rise * (1 - coll) + 1.2 * coll * (1 - smoothstep((t - COLLAPSE_T - 0.3) / 0.1));
      const op = 0.7 * (1 - smoothstep((t - COLLAPSE_T - 0.2) / 0.15)) * fade;
      this.pillar.set(c.x, c.z, 0, Math.max(0.05, top), op);
      this.pillar.mesh.scale.x = flick;
      this.pillar.mesh.scale.z = flick;
      const flick2 = 1 + 0.15 * hash1(Math.floor(t * 20) + 7);
      this.pillarWide.set(c.x, c.z, 0, Math.max(0.05, top * 0.78), op * 0.38);
      this.pillarWide.mesh.scale.x = flick2;
      this.pillarWide.mesh.scale.z = flick2;

      // Cool on warm: blue-white star at the base for 3 frames, right after the impact frame.
      const sp = StarBurst.pop(after - 0.05, 0.02, 0.03);
      this.baseStar.set(new THREE.Vector3(c.x, 0.9, c.z), 3.6 * sp.scale, sp.opacity, 0.3);

      this.baseFlash.mesh.position.set(c.x, 1, c.z);
      this.baseFlash.mesh.scale.setScalar(1.5 + after * 5);
      this.baseFlash.opacity = 0.7 * Math.exp(-after * 9);
      this.shock.mesh.position.set(c.x, 0.05, c.z);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.55));
      const a2 = after - 0.1;
      this.shock2.mesh.position.set(c.x, 0.06, c.z);
      this.shock2.mesh.scale.setScalar(1 + Math.max(0, a2) * 13);
      this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.8)) : 0;

      // Scorch disc.
      const sc = smoothstep((after - 0.1) / 0.3);
      this.scorch.visible = sc > 0.01;
      this.scorch.position.set(c.x, 0.03, c.z);
      this.scorch.scale.setScalar(Math.max(1e-3, 3 * sc));
      this.scorchMat.opacity = 0.6 * sc * fade;

      // Grey dust swirl keeps turning after the colour has drained.
      const dOn = smoothstep((t - COLLAPSE_T) / 0.3) * fade;
      this.dustArcs.forEach((arc, i) => {
        arc.head = ((t * 0.5 + i * 0.5) % 1) * 1.4;
        arc.length = 0.55;
        arc.time = t;
        arc.erosion = 0.35;
        arc.opacity = 0.5 * dOn;
      });

      this.shake = t < COLLAPSE_T ? 0.1 + 0.5 * Math.exp(-after * 8) : 0;

      // Lift the enemy over the pillar's life, drop at the collapse.
      if (ctx && ctx.targets[0] && t < COLLAPSE_T + 0.6) {
        const lift = 2.5 * smoothstep(after / 0.3) * (1 - smoothstep((t - COLLAPSE_T) / 0.35));
        ctx.displace(ctx.targets[0], new THREE.Vector3(0, lift, 0));
      }
    } else {
      this.pillar.set(c.x, c.z, 0, 1, 0);
      this.pillarWide.set(c.x, c.z, 0, 1, 0);
      this.baseStar.set(c, 0, 0);
      this.baseFlash.opacity = 0;
      this.shock.material.opacity = 0;
      this.shock2.material.opacity = 0;
      this.scorch.visible = false;
      this.scorchMat.opacity = 0;
      for (const arc of this.dustArcs) arc.opacity = 0;
      this.shake = flying ? 0.04 : 0;
    }
  }

  private onImpact() {
    this.impacted = true;
    this.tickTimer = 0;
    this.lickTimer = 0;
    const c = new THREE.Vector3(this.impactAt.x, 0.3, this.impactAt.z);
    this.petals.burst(300, c);
    this.curls.burst(130, c);
    this.tongues.burst(80, c);
    this.dust.burst(60, c);
    const ctx = this.ctx;
    if (ctx && ctx.targets[0]) {
      ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 3, from: this.from, color: '#ffd070' });
    }
  }
}

export const cinderBowModule: EffectModule = {
  label: 'cinder bow',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new CinderBow(),
  telegraphs(effect) {
    const e = effect as CinderBow;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [
      { shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.4 }, start: BOW_T, impact: IMPACT_T },
      { shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.2 }, start: 0.3, impact: IMPACT_T, until: COLLAPSE_T },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as CinderBow;
    if (e.ctx) frameCast(camera, controls, e.ctx, e.settings.pillarHeight);
  },
  buildGui(f, effect) {
    const s = (effect as CinderBow).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'pillarHeight', 4, 24, 0.5).name('pillar height');
  },
};
