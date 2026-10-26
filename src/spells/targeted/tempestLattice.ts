import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tempest Lattice (targeted, up to 6 enemies): the world dims to a cold blue, a bolt hops from the caster through
 * every chosen enemy in order (one hop per 0.15 s, each enemy flashing as it is reached) and closes back on the
 * first into a crackling cage. The lines then pull inward over a tightening ground spiral with focus lines, three
 * silhouette impact frames freeze the moment, and a spiky star bursts on every enemy with a smoke shockwave, a
 * dark disc, and black smoke balls that break into flakes before the screen is clean again.
 *
 * Recipes: d-kler-3-lightning-chain-cage, d-kler-3-cage-detonation-impact-frame.
 */
export interface TempestLatticeSettings {
  hop: number;
  hold: number;
  damage: number;
  loop: boolean;
}

export const defaultTempestLattice = (): TempestLatticeSettings => ({ hop: 0.15, hold: 1.2, damage: 45, loop: false });

const MAX = 6;
const CHAIN_START = 0.35;
const IMPLODE = 0.35;
const FRAMES = 0.15; // three impact frames before the star bursts
const R_MAX = 14;

export class TempestLattice implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TempestLatticeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private count = 3;
  private arrived: boolean[] = [];
  private hitDone = false;
  private smokeDone = false;
  private spitTimer = 0;
  private fleckTimer = 0;
  private hand = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private spread = 3;
  private nodes: THREE.Vector3[] = Array.from({ length: MAX }, () => new THREE.Vector3());
  private vis: THREE.Vector3[] = Array.from({ length: MAX }, () => new THREE.Vector3());

  // Two strands per link: caster -> t0, t0 -> t1 ... t(n-1) -> t0 closes the cage.
  private strandA: LightningArc[] = [];
  private strandB: LightningArc[] = [];
  private flashes: GlowSphere[] = [];
  private nodeStars: StarBurst[] = [];
  private bigStars: StarBurst[] = [];
  private glints: StarBurst[] = [];
  private scorch: THREE.Mesh[] = [];
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0, depthWrite: false });
  private spiral: CrescentArc[] = [];
  private spiralPlane = new THREE.Group();
  private handGlow = new GlowSphere(0x7ab0ff, { rim: false });
  private lockRing = createRing(0xffffff, 0.93, 1, 96);
  private smokeRing = createRing(0xe8eef8, 0.7, 1, 96);
  private rimRing = createRing(0x3a8aff, 0.94, 1, 96);
  private discMat = new THREE.MeshBasicMaterial({ color: 0x0a1a5a, transparent: true, opacity: 0, depthWrite: false });
  private disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), this.discMat);
  private smoke = new SmokeBall();
  private sparks: Emitter;
  private motes: Emitter;
  private flecks: Emitter;

  constructor(settings: TempestLatticeSettings = defaultTempestLattice()) {
    this.settings = settings;
    this.screen.tint.set(0x1e2a5a);
    this.screen.impactColor.set(0x3aa8ff);
    this.screen.speedLineColor.set(0xbff4ff);

    for (let i = 0; i < MAX + 2; i++) {
      const a = new LightningArc({ width: 0.3, core: 0xffffff, glow: 0x5a6cff, rerollEvery: 0.04, dropChance: 0.15 });
      const b = new LightningArc({ width: 0.15, jitter: 0.2, core: 0xe6d0ff, glow: 0xb46cff, rerollEvery: 0.05, dropChance: 0.15 });
      this.strandA.push(a);
      this.strandB.push(b);
      this.group.add(a.mesh, b.mesh);
    }
    for (let i = 0; i < MAX; i++) {
      const flash = new GlowSphere(0x5a9cff, { rim: false });
      const ns = new StarBurst({ points: 6, color: 0x8af4ff, core: 0xffffff, additive: false });
      const big = new StarBurst({ points: 12, color: 0xbff4ff, core: 0xffffff, additive: false });
      const glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
      const sc = new THREE.Mesh(new THREE.CircleGeometry(0.7 + 0.1 * (i % 3), 20), this.scorchMat);
      sc.rotation.x = -Math.PI / 2;
      sc.visible = false;
      this.flashes.push(flash);
      this.nodeStars.push(ns);
      this.bigStars.push(big);
      this.glints.push(glint);
      this.scorch.push(sc);
      this.group.add(flash.mesh, ns.mesh, big.mesh, glint.mesh, sc);
    }
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({
        radius: 4.5 - i * 0.7, width: 1.1, style: 'toon', edge: 0xffffff, mid: 0x8ac8ff, outer: 0x141a24, sweep: Math.PI * 1.2,
      });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.spiral.push(arc);
      this.spiralPlane.add(arc.mesh);
    }
    this.spiralPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.spiralPlane);

    this.smokeRing.material.blending = THREE.NormalBlending;
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.visible = false;
    this.group.add(this.handGlow.mesh, this.lockRing.mesh, this.smokeRing.mesh, this.rimRing.mesh, this.disc, this.smoke.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.45, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 11, speedJitter: 0.6, spread: 100, gravity: 8, drag: 2.5,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#4a8cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0, colorMid: '#9ad0ff',
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.2, speed: 5, speedJitter: 0.6, spread: 180, gravity: -0.5, drag: 1.4,
      sizeStart: 0.2, sizeEnd: 0.02, colorStart: '#e6d0ff', colorEnd: '#5a2cff',
      opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.4, spin: 0.5, colorMid: '#b46cff',
    });
    // Dark normal-blended flecks: black is a colour.
    this.flecks = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 3.5, speedJitter: 0.7, spread: 180, gravity: 5, drag: 1.2,
      sizeStart: 0.14, sizeEnd: 0.05, colorStart: '#1a2030', colorEnd: '#05070a',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.3, spin: 1,
    });
    this.emitters.push(this.sparks, this.motes, this.flecks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  /** Detonation start (first impact frame). */
  get detTime() {
    return this.chainEnd() + this.settings.hold;
  }

  get duration() {
    return this.detTime + 2.0;
  }

  /** When the bolt reaches target i. */
  arriveTime(i: number) {
    return CHAIN_START + this.settings.hop * (i + 1);
  }

  /** When the cage is closed (last link finished). */
  closeTime() {
    return this.count >= 3 ? CHAIN_START + this.settings.hop * (this.count + 1) : this.arriveTime(this.count - 1) + 0.1;
  }

  private chainEnd() {
    return this.closeTime();
  }

  /** Centroid and spread radius of the cast, for the telegraph. */
  get cageCenter() {
    return this.centroid;
  }

  get cageRadius() {
    return this.spread + 1.5;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const pts = (ctx.targetPos.length ? ctx.targetPos : [ctx.point]).slice(0, MAX);
    this.count = pts.length;
    this.hand.copy(ctx.from).setY(2.4);
    this.centroid.set(0, 0, 0);
    pts.forEach((p, i) => { this.nodes[i].copy(p).setY(1.3); this.centroid.add(p); });
    this.centroid.divideScalar(pts.length).setY(0);
    this.spread = 0;
    for (const p of pts) this.spread = Math.max(this.spread, Math.hypot(p.x - this.centroid.x, p.z - this.centroid.z));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
    this.spiralPlane.position.copy(this.centroid).setY(0.06);
    this.spiralPlane.scale.setScalar(Math.max(0.3, this.cageRadius / 4.5));
    for (let i = 0; i < MAX; i++) {
      const sc = this.scorch[i];
      sc.position.set(this.nodes[i].x, 0.03, this.nodes[i].z);
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.arrived = Array.from({ length: MAX }, () => false);
    this.hitDone = false;
    this.smokeDone = false;
    this.spitTimer = 0;
    this.fleckTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.motes.update(dt);
    this.flecks.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const t = this.time;
    const D = this.detTime;
    const ctx = this.ctx;

    // Black flecks spit off the caster during the anticipation.
    if (t < CHAIN_START + 0.3) {
      this.fleckTimer += dt;
      while (this.fleckTimer > 0.06) { this.fleckTimer -= 0.06; this.flecks.burst(5, this.hand); }
    }
    // Hop arrivals: flash + hit confirm.
    for (let i = 0; i < this.count; i++) {
      if (this.arrived[i] || t < this.arriveTime(i)) continue;
      this.arrived[i] = true;
      this.sparks.burst(40, this.nodes[i]);
      const e = ctx?.targets[i];
      if (ctx && e) ctx.hit(e, { damage: 12, knock: 0.5, from: ctx.from });
    }
    // Hold: sparks spit at random nodes / points on edges.
    if (t > this.closeTime() && t < D) {
      this.spitTimer += dt;
      while (this.spitTimer > 0.1) {
        this.spitTimer -= 0.1;
        const a = this.nodes[Math.floor(Math.random() * this.count)];
        const b = this.nodes[Math.floor(Math.random() * this.count)];
        this.sparks.burst(14, new THREE.Vector3().lerpVectors(a, b, Math.random()));
      }
    }
    if (!this.hitDone && t >= D + FRAMES) this.onHit();
    if (!this.smokeDone && t >= D + 0.3) this.onSmoke();
    for (let i = 0; i < this.strandA.length; i++) { this.strandA[i].update(dt); this.strandB[i].update(dt); }
    this.layout(dt);
  }

  private layout(_dt: number) {
    const t = this.time;
    const D = this.detTime;
    const H = D + FRAMES;
    const n = this.count;
    const hop = Math.max(0.02, this.settings.hop);
    const after = t - H;
    const ctx = this.ctx;
    const hasCtx = ctx !== null;

    // 1. World grade: dark blue first, held through the lattice, released after the burst.
    const dim = 0.85 * smoothstep(t / 0.35);
    this.screen.darken = t < D + 0.3 ? dim : dim * (1 - smoothstep((t - D - 0.3) / 0.8));

    // 2. Blue glow gathers around the caster, then hands the work to the bolt.
    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.3 + 0.6 * smoothstep(t / CHAIN_START));
    this.handGlow.opacity = (hasCtx ? 1 : 0) * (t < this.closeTime() ? 0.5 * smoothstep(t / 0.3) : 0.5 * Math.exp(-(t - this.closeTime()) * 6));

    // 3. Implode: nodes pulled 25% toward the centroid, spiral contracts, focus lines.
    const imp = smoothstep((t - (D - IMPLODE)) / IMPLODE);
    const impActive = t > D - IMPLODE && t < H;
    for (let i = 0; i < MAX; i++) {
      this.vis[i].copy(this.nodes[i]);
      this.vis[i].x += (this.centroid.x - this.vis[i].x) * 0.25 * imp;
      this.vis[i].z += (this.centroid.z - this.vis[i].z) * 0.25 * imp;
    }
    this.spiral.forEach((arc, i) => {
      arc.head = 0.2 + imp * 1.0;
      arc.length = 0.6;
      arc.time = t;
      arc.opacity = impActive ? 1 : 0;
      arc.mesh.scale.setScalar(Math.max(1e-3, 1 - 0.85 * imp));
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3 + imp * 2.5;
    });
    this.screen.speedLines = t < D ? 0.9 * imp : Math.max(0, 0.9 - (t - D) * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2, 1]);

    // 4. Lightning links, revealed hop by hop; link k runs A -> B.
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const closing = n >= 3;
    const links = n + (closing ? 1 : 0);
    const alive = hasCtx && t < H;
    for (let k = 0; k < this.strandA.length; k++) {
      const sa = this.strandA[k], sb = this.strandB[k];
      if (!alive || k >= links) { sa.opacity = 0; sb.opacity = 0; continue; }
      const startT = CHAIN_START + hop * k;
      const prog = THREE.MathUtils.clamp((t - startT) / hop, 0, 1);
      if (prog <= 0) { sa.opacity = 0; sb.opacity = 0; continue; }
      tmpA.copy(k === 0 ? this.hand : this.vis[k - 1]);
      tmpB.copy(k < n ? this.vis[k] : this.vis[0]);
      tmpB.sub(tmpA).multiplyScalar(prog).add(tmpA);
      if (tmpA.distanceToSquared(tmpB) < 0.01) { sa.opacity = 0; sb.opacity = 0; continue; }
      sa.setEnds(tmpA, tmpB);
      sb.setEnds(tmpA, tmpB);
      const hold = t > this.closeTime();
      sa.opacity = hold ? 0.85 : 1;
      sb.opacity = hold ? 0.7 : 0.8;
    }

    // 5. Per-node pieces: arrival flash + small star, scorch mark, detonation star + glint.
    for (let i = 0; i < MAX; i++) {
      const used = i < n && hasCtx;
      const at = t - this.arriveTime(i);
      const p = this.nodes[i];
      const fl = this.flashes[i];
      if (used && at > 0) {
        const steady = t < D ? 0.12 : 0;
        fl.mesh.position.copy(p);
        fl.mesh.scale.setScalar(1.4 + 0.5 * Math.min(1, at * 6));
        fl.opacity = 0.7 * Math.exp(-at * 8) + steady;
        const pop = StarBurst.pop(at, 0.05, 0.12);
        this.nodeStars[i].set(p, 1.4 * pop.scale, pop.opacity, i * 0.7);
      } else {
        fl.opacity = 0;
        this.nodeStars[i].set(p, 0, 0);
      }
      const sc = this.scorch[i];
      const scorchOn = used && at > 0.1;
      sc.visible = scorchOn;
      if (scorchOn) sc.scale.setScalar(Math.max(1e-3, Math.min(1, (at - 0.1) * 4)));
      const pop = StarBurst.pop(after - i * 0.02, 0.15, 0.25);
      if (used && pop.opacity > 0) {
        this.bigStars[i].set(new THREE.Vector3(p.x, 1.3, p.z), 3.4 * pop.scale, pop.opacity, i * 0.5);
        const g = StarBurst.pop(after - 0.08 - i * 0.02, 0.05, 0.25);
        this.glints[i].set(new THREE.Vector3(p.x, 3.2, p.z), 1.0 * g.scale, g.opacity, t * 2);
      } else {
        this.bigStars[i].set(p, 0, 0);
        this.glints[i].set(p, 0, 0);
      }
    }
    this.scorchMat.opacity = hasCtx && t > CHAIN_START ? 0.55 * (after > 0 ? Math.exp(-after * 1.4) : 1) : 0;

    // 6. Lock pulse on the caster when the cage closes.
    const lk = t - this.closeTime();
    this.lockRing.mesh.position.set(this.hand.x, 0.05, this.hand.z);
    this.lockRing.mesh.scale.setScalar(Math.max(1e-3, 1 + Math.max(0, lk) * 14));
    this.lockRing.material.opacity = hasCtx && lk > 0 && lk < 0.4 ? 0.7 * (1 - lk / 0.4) : 0;

    // 7. Detonation: white smoke torus + dark blue disc with a bright rim.
    const u = THREE.MathUtils.clamp(after / 0.5, 0, 1);
    const r = Math.max(1e-3, R_MAX * (1 - Math.pow(1 - u, 3)));
    const c = this.centroid;
    this.smokeRing.mesh.position.set(c.x, 0.07, c.z);
    this.smokeRing.mesh.scale.setScalar(r);
    this.smokeRing.material.opacity = hasCtx && after > 0 ? 0.8 * Math.max(0, 1 - Math.max(0, after - 0.15) / 0.6) : 0;
    this.rimRing.mesh.position.set(c.x, 0.06, c.z);
    this.rimRing.mesh.scale.setScalar(r * 0.97);
    this.rimRing.material.opacity = hasCtx && after > 0 ? 0.6 * Math.max(0, 1 - after / 0.8) : 0;
    this.disc.position.set(c.x, 0.05, c.z);
    this.disc.scale.setScalar(r * 0.96);
    this.disc.visible = hasCtx && after > 0 && after < 1.4;
    this.discMat.opacity = after > 0 ? 0.8 * Math.max(0, 1 - Math.max(0, after - 0.3) / 1.0) : 0;

    // 8. Shake: light during the chain, heavy on the first normal frame after the impact frames.
    this.shake = after > 0 ? 0.9 * Math.exp(-after * 7)
      : t > CHAIN_START && t < D ? 0.03 + 0.05 * imp : 0;
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const c = this.centroid;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      const at = new THREE.Vector3(p.x, 1.3, p.z);
      this.sparks.burst(240, at);
      this.motes.burst(60, at);
      // Knock away from the cage centre; a lone / central target is knocked away from the caster instead.
      const from = new THREE.Vector3(c.x, 0, c.z);
      if (Math.hypot(p.x - c.x, p.z - c.z) < 0.5) {
        const away = new THREE.Vector3(p.x - ctx.from.x, 0, p.z - ctx.from.z);
        if (away.lengthSq() < 1e-4) away.set(0, 0, -1);
        from.copy(p).addScaledVector(away.normalize(), -1);
      }
      ctx.hit(e, { damage: this.settings.damage, knock: 8, from, color: '#bff4ff' });
    });
  }

  private onSmoke() {
    this.smokeDone = true;
    for (let i = 0; i < this.count; i++) {
      const p = this.nodes[i];
      this.smoke.trigger(new THREE.Vector3(p.x, 1, p.z), 1.5, 1.2);
    }
  }
}

export const tempestLatticeModule: EffectModule = {
  label: 'tempest lattice',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX },
  create: () => new TempestLattice(),
  telegraphs(effect) {
    const e = effect as TempestLattice;
    const ctx = e.ctx;
    if (!ctx) return [];
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    const out = pts.slice(0, MAX).map((p, i) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.6 }, start: 0.1, impact: e.arriveTime(i),
    }));
    const c = e.cageCenter;
    out.push({ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: e.cageRadius }, start: e.closeTime(), impact: e.detTime + FRAMES });
    return out;
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as TempestLattice;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as TempestLattice).settings;
    f.add(s, 'loop');
    f.add(s, 'hop', 0.05, 0.5, 0.01).name('hop time');
    f.add(s, 'hold', 0.4, 3, 0.05).name('cage hold');
    f.add(s, 'damage', 1, 150, 1);
  },
};

