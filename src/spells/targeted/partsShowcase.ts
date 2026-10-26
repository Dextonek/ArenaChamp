import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Parts showcase: one short spell that exercises every part of the kit in the order the reference videos use
 * them. World darkens → wind crescents whirl around the caster → lightning locks onto each target → implode with
 * focus lines → dark/light impact frames with silhouettes → star bursts + hits → black smoke balls → clean exit.
 * Read it as the usage example for `src/effects/parts`.
 */
export interface PartsShowcaseSettings {
  impactTime: number;
  damage: number;
  loop: boolean;
}

export const defaultPartsShowcase = (): PartsShowcaseSettings => ({ impactTime: 2.0, damage: 42, loop: false });

const MAX = 4;
const WIND = 6;

export class PartsShowcase implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PartsShowcaseSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitDone = false;
  private smokeDone = false;
  private hand = new THREE.Vector3();
  private centroid = new THREE.Vector3();

  private wind: CrescentArc[] = [];
  private windPlanes: THREE.Group[] = [];
  private implode: CrescentArc[] = [];
  private implodePlane = new THREE.Group();
  private arcs: LightningArc[] = [];
  private stars: StarBurst[] = [];
  private glints: StarBurst[] = [];
  private smoke = new SmokeBall();
  private handGlow = new GlowSphere(0xbff4ff, { rim: false });
  private ring = createRing(0x8af4ff, 0.92, 1, 96);
  private sparks: Emitter;

  constructor(settings: PartsShowcaseSettings = defaultPartsShowcase()) {
    this.settings = settings;
    this.screen.tint.set(0x2a3a7a);
    this.screen.impactColor.set(0x4af0ff);

    for (let i = 0; i < WIND; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1.7 + 0.3 * (i % 3), width: 0.9, style: 'soft', edge: 0xffffff, mid: 0xbff4ea, outer: 0x2a8a8a });
      plane.add(arc.mesh);
      this.windPlanes.push(plane);
      this.wind.push(arc);
      this.group.add(plane);
    }
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({ radius: 4.5 - i * 0.7, width: 1.6, style: 'toon', edge: 0xfff0fa, mid: 0xff7ac0, outer: 0x3a0a3a, sweep: Math.PI * 1.2 });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.implodePlane.add(arc.mesh);
      this.implode.push(arc);
    }
    this.implodePlane.rotation.x = -Math.PI / 2;
    this.group.add(this.implodePlane);
    for (let i = 0; i < MAX; i++) {
      const arc = new LightningArc({ width: 0.34, core: 0xffffff, glow: 0x5aa8ff });
      this.arcs.push(arc);
      // Normal blending keeps the star crisp and hard-edged instead of blooming into a blob.
      const star = new StarBurst({ points: 11, color: 0x6ae8ff, core: 0xffffff, additive: false });
      this.stars.push(star);
      const glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
      this.glints.push(glint);
      this.group.add(arc.mesh, star.mesh, glint.mesh);
    }
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 11, speedJitter: 0.6, spread: 100, gravity: 8, drag: 2.2,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#4a8cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.smoke.mesh, this.handGlow.mesh, this.ring.mesh);
    this.reset();
  }

  get duration() {
    return this.settings.impactTime + 2.2;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.hand.copy(ctx.from).setY(2.4);
    this.centroid.set(0, 0, 0);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    for (const p of pts) this.centroid.add(p);
    this.centroid.divideScalar(pts.length).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
    for (let i = 0; i < WIND; i++) {
      const plane = this.windPlanes[i];
      plane.position.copy(ctx.from).setY(1.3);
      plane.rotation.set(Math.PI / 2 + (i - 2.5) * 0.35, (i * Math.PI) / 3, 0);
    }
    this.implodePlane.position.copy(this.centroid).setY(0.06);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const ti = this.settings.impactTime;
    if (!this.hitDone && this.time >= ti + 0.1) this.onHit();
    if (!this.smokeDone && this.time >= ti + 0.3) this.onSmoke();
    for (const a of this.arcs) a.update(dt);
    this.layout(dt);
  }

  private layout(_dt: number) {
    const t = this.time;
    const ti = this.settings.impactTime;
    const ctx = this.ctx;
    const targets = ctx?.targetPos ?? [];
    const after = t - ti;

    // 1. World darkens during the build-up and releases after the hit.
    this.screen.darken = t < ti ? 0.85 * smoothstep(t / 0.6) : 0.85 * Math.exp(-Math.max(0, after - 0.1) * 3);

    // 2. Soft wind crescents whirl around the caster (repeat sweeps, then erode away).
    this.wind.forEach((arc, i) => {
      const cyc = (t * 1.4 + i * 0.17) % 1;
      arc.head = cyc * 1.35;
      arc.length = 0.35;
      arc.time = t;
      arc.erosion = smoothstep((t - 1.2) / 0.5);
      arc.opacity = t < 1.7 ? 0.8 * smoothstep(t / 0.3) : 0;
    });
    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.3 + 0.4 * smoothstep(t / 1));
    this.handGlow.opacity = t < ti ? 0.5 * smoothstep(t / 0.5) : 0.5 * Math.exp(-after * 8);

    // 3. Lightning from the hand to each target, flickering, until the hit.
    this.arcs.forEach((arc, i) => {
      const p = targets[i];
      if (!p || t < 0.6 + i * 0.12 || t > ti + 0.15) { arc.opacity = 0; return; }
      arc.setEnds(this.hand, p.clone().setY(1.3));
      arc.opacity = 0.9;
    });

    // 4. Implode: toon crescents contract onto the centroid with focus lines, then vanish on the hit.
    const imp = smoothstep((t - (ti - 0.45)) / 0.45);
    this.implode.forEach((arc, i) => {
      arc.head = 0.2 + imp * 1.0;
      arc.length = 0.6;
      arc.time = t;
      arc.opacity = t > ti - 0.45 && t < ti ? 1 : 0;
      arc.mesh.scale.setScalar(Math.max(1e-3, 1 - 0.85 * imp));
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3 + imp * 2.5;
    });
    this.screen.speedLines = t < ti ? 0.9 * imp : Math.max(0, 0.9 - after * 4);

    // 5. Impact frames: dark (cyan silhouettes) then light (black silhouettes), 3 frames each.
    this.screen.impact = impactFrameAt(t, ti, [1, 2]);

    // 6. Star bursts on each target, a 4-point glint above, a ring.
    this.stars.forEach((star, i) => {
      const p = targets[i];
      const pop = StarBurst.pop(after - 0.1 - i * 0.02);
      if (!p || pop.opacity === 0) { star.set(new THREE.Vector3(), 0, 0); return; }
      star.set(p.clone().setY(1.2), 2.4 * pop.scale, pop.opacity, i * 0.7);
      const g = StarBurst.pop(after - 0.18 - i * 0.02, 0.05, 0.25);
      this.glints[i].set(p.clone().setY(2.9), 0.9 * g.scale, g.opacity, t * 2);
    });
    this.ring.mesh.position.copy(this.centroid).setY(0.05);
    this.ring.mesh.scale.setScalar(1 + Math.max(0, after - 0.1) * 26);
    this.ring.material.opacity = after > 0.1 ? Math.max(0, 0.8 * (1 - (after - 0.1) / 0.5)) : 0;

    this.shake = after > 0.1 ? 0.8 * Math.exp(-(after - 0.1) * 7) : t > 0.6 && t < ti ? 0.04 : 0;
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      this.sparks.burst(220, p.clone().setY(1.2));
      ctx.hit(e, { damage: this.settings.damage, knock: 5, from: this.centroid });
    });
  }

  private onSmoke() {
    this.smokeDone = true;
    for (const p of this.ctx?.targetPos ?? []) this.smoke.trigger(p.clone().setY(1), 1.5, 1.2);
  }
}

export const partsShowcaseModule: EffectModule = {
  label: 'parts showcase',
  category: 'parts kit',
  targeting: { mode: 'enemies', maxTargets: MAX },
  create: () => new PartsShowcase(),
  telegraphs(effect) {
    const e = effect as PartsShowcase;
    return (e.ctx?.targetPos ?? []).map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.8 }, start: 0.1, impact: e.settings.impactTime + 0.1,
    }));
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as PartsShowcase;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as PartsShowcase).settings;
    f.add(s, 'loop');
    f.add(s, 'impactTime', 0.8, 4, 0.05).name('impact time');
    f.add(s, 'damage', 1, 150, 1);
  },
};
