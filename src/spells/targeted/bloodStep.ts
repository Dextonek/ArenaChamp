import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodPool, BloodSigil, BloodTendril, BloodThorns, ShockRefraction, StarBurst,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Blood Step (blood kit, W: a 5 m blink that leaves a wounding strip). A bone sigil draws itself under Vesper's feet,
 * she slides 5 m toward the aim in 0.18 s (`ctx.moveCaster`) and the blood she leaves on the ground runs along the path
 * as a thin ribbon that freezes into a double row of crystal thorns. Whoever steps into the strip while it stands (up
 * to 3.9 s after the cast, inside the duel's 4.2 s window) is cut once: damage, a slow, thorns burst under them. At
 * the end the thorns shatter into dark flakes and the pools dry. Built from `sentFrom` and `point` so both screens of a
 * network duel lay the same strip; the victim's client decides the hit with its own hero's live position. See
 * pipeline/designs/kit-shapes-v3.md.
 */
export interface BloodStepSettings {
  damage: number;
  /** Seconds of slow on a hit (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultBloodStep = (): BloodStepSettings => ({ damage: 30, slow: 1.8, loop: false });

// Timeline (seconds).
const DASH_T = 0.08;
const DASH_LEN = 0.18;
const THORN_T = 0.2;
const STRIP_END = 3.9; // the strip stops wounding (inside the duel's 4.2 s window)
const DURATION = 4.6;
const DISTANCE = 5;
const HALF_W = 0.9; // half width of the wound zone and the telegraph
const MAX_HITS = 6;

export class BloodStep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BloodStepSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where she blinked from, and where the blink would end unobstructed (the telegraph's line). */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private land = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private time = 0;
  private flags = { sigil: false, dashed: false, strip: false, shattered: false, dried: false };
  private hitDone: boolean[] = [];
  private pops: { at: THREE.Vector3; age: number }[] = [];

  private sigilA = new BloodSigil({ color: 0xf2dcb4 });
  private sigilB = new BloodSigil({ color: 0xf2dcb4 });
  private poolA = new BloodPool();
  private poolB = new BloodPool();
  private ribbon = new BloodTendril({ segments: 24 });
  private thorns = new BloodThorns({ maxSpikes: 48, maxFlakes: 200 });
  private crowns = new BloodThorns({ maxSpikes: 24, maxFlakes: 80 });
  private drops = new BloodDrops({ maxSplats: 10 });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: BloodStepSettings = defaultBloodStep()) {
    this.settings = settings;
    this.ribbon.width = 0.2;
    this.ribbon.bead = 0;
    this.ribbon.wobble = 0.01;
    this.ribbon.setPoints(this.pts);
    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.2;
    this.thorns.gravity = -14;
    this.group.add(
      this.sigilA.mesh, this.sigilB.mesh, this.poolA.mesh, this.poolB.mesh, this.ribbon.mesh, this.thorns.mesh,
      this.crowns.mesh, this.drops.mesh, this.star.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return THORN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens lay the strip from where she really stood and the aim point (`from` is where she is drawn online).
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.lengthSq() < 0.09) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.fwd.copy(this.v1).normalize();
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.want.copy(this.start).addScaledVector(this.fwd, DISTANCE);
    this.land.copy(this.want);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hitDone = [];
    this.pops.length = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.land.copy(this.want);
    this.sigilA.reset();
    this.sigilB.reset();
    this.poolA.reset();
    this.poolB.reset();
    this.ribbon.reset();
    this.thorns.reset();
    this.crowns.reset();
    this.drops.reset();
    this.star.set(this.start, 0, 0);
    this.shock.set(this.start, 0, 0);
  }

  /** Distance from ground point p to the strip (the segment start..land). */
  private stripDist(p: THREE.Vector3) {
    const ax = this.land.x - this.start.x, az = this.land.z - this.start.z;
    const l2 = ax * ax + az * az || 1;
    const k = THREE.MathUtils.clamp(((p.x - this.start.x) * ax + (p.z - this.start.z) * az) / l2, 0, 1);
    return Math.hypot(p.x - (this.start.x + ax * k), p.z - (this.start.z + az * k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
    this.thorns.update(dt);
    this.crowns.update(dt);
    this.poolA.update(dt);
    this.poolB.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.sigil) {
      f.sigil = true;
      this.poolA.place(this.start);
      this.poolA.spread(0.9, 0.25);
      this.drops.spray(this.v1.copy(this.start).setY(0.3), this.up, 8, 3.5, 0.6);
    }
    if (!f.dashed && t >= DASH_T) {
      f.dashed = true;
      this.land.copy(ctx?.moveCaster ? ctx.moveCaster(this.want, DASH_LEN) : this.want).setY(0);
      this.poolB.place(this.land);
      this.poolB.spread(0.8, 0.3);
      this.shake = 0.12;
    }
    if (!f.strip && t >= THORN_T) {
      f.strip = true;
      this.laySpikes();
      this.drops.spray(this.v1.copy(this.land).setY(0.3), this.up, 10, 4.5, 0.7);
    }
    // Whoever is in the strip is cut once, on their live position (the victim's client judges its own hero).
    if (f.strip && t < STRIP_END && ctx) {
      for (let i = 0; i < Math.min(MAX_HITS, ctx.targets.length); i++) {
        if (this.hitDone[i]) continue;
        const e = ctx.targets[i];
        if (this.stripDist(e.group.position) > HALF_W) continue;
        this.hitDone[i] = true;
        ctx.hit(e, { damage: this.settings.damage, knock: 0, color: BLOOD_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
        this.v2.copy(e.group.position).setY(0);
        this.crowns.erupt(this.v2, 0.7, 6, 0.9, { tilt: 0.4, stagger: 0.06, grow: 0.12 });
        this.drops.spray(this.v1.copy(this.v2).setY(1), this.up, 10, 5, 0.8);
        this.pops.push({ at: this.v2.clone().setY(1.1), age: 0 });
        this.shake = Math.max(this.shake, 0.2);
      }
    }
    if (!f.shattered && t >= STRIP_END) {
      f.shattered = true;
      this.thorns.shatter(3, 4, 0.5);
      this.crowns.shatter(3, 4, 0.5);
    }
    if (!f.dried && t >= STRIP_END - 0.3) {
      f.dried = true;
      this.poolA.dry(0.3, 0.5);
      this.poolB.dry(0.3, 0.5);
      this.drops.splats.fadeOutAll(0.5);
    }

    this.layout(dt);
  }

  /** Two rows of crystal thorns along the path, leaning outward, growing out from the start to the landing. */
  private laySpikes() {
    const len = this.start.distanceTo(this.land);
    if (len < 0.2) return;
    const step = 0.5;
    const base = new THREE.Vector3(), dir = new THREE.Vector3();
    for (let s = 0.2, n = 0; s <= len; s += step, n++) {
      for (const sg of [-1, 1]) {
        base.copy(this.start).addScaledVector(this.fwd, s).addScaledVector(this.side, sg * (0.3 + 0.12 * Math.random()));
        dir.set(0, 1, 0).addScaledVector(this.side, sg * (0.25 + 0.2 * Math.random())).addScaledVector(this.fwd, (Math.random() - 0.5) * 0.3);
        const h = (0.55 + 0.5 * Math.random()) * (n % 2 === 0 ? 1 : 0.75);
        this.thorns.spike(base, dir, h, h * 0.22, 0.16, (s / len) * 0.25);
      }
    }
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;

    // --- Sigils: draw on at the start, a small one at the landing, both fade as the thorns rise. ---
    this.sigilA.set(this.v1.copy(this.start).setY(0.04), this.up, 1.0, t * 0.8);
    this.sigilA.reveal = smoothstep(t / 0.15);
    this.sigilA.opacity = 1 - smoothstep((t - 0.45) / 0.45);
    if (f.dashed) {
      const k = t - DASH_T;
      this.sigilB.set(this.v1.copy(this.land).setY(0.04), this.up, 0.7, -t * 0.8);
      this.sigilB.reveal = smoothstep(k / 0.15);
      this.sigilB.opacity = 1 - smoothstep((k - 0.35) / 0.4);
    }

    // --- The ribbon of blood on the ground: runs out with the dash, then freezes into the thorns and is gone. ---
    if (f.dashed) {
      this.pts[0].copy(this.start).setY(0.12);
      this.pts[2].copy(this.land).setY(0.12);
      this.pts[1].lerpVectors(this.pts[0], this.pts[2], 0.5).addScaledVector(this.side, 0.15);
      this.ribbon.head = smoothstep((t - DASH_T) / DASH_LEN);
      this.ribbon.tail = smoothstep((t - THORN_T) / 0.4);
      this.ribbon.update(t);
    } else {
      this.ribbon.mesh.visible = false;
    }

    // --- Pops where someone was cut. ---
    let any = false;
    for (const p of this.pops) {
      const sp = StarBurst.pop(p.age, 0, 0.03);
      if (sp.opacity > 0) {
        any = true;
        this.star.set(p.at, 0.9 * sp.scale, sp.opacity, 0.2);
      }
      p.age += dt;
    }
    if (!any) this.star.set(this.start, 0, 0);
    const gp = THREE.MathUtils.clamp((t - DASH_T) / 0.3, 0, 1);
    this.shock.set(this.land, f.dashed ? 0.4 + 1.8 * gp : 0, f.dashed ? 0.02 * (1 - gp) * (1 - gp) : 0);
    this.shake *= Math.exp(-dt * 10);
  }
}

export const bloodStepModule: EffectModule = {
  label: 'blood step',
  category: 'hero: blood',
  // Aimed at a spot (the blink goes toward it, 5 m at most); `radius` also decides which enemies are in `targets` on the hero's own screen.
  targeting: { mode: 'ground', radius: 5.5 },
  create: () => new BloodStep(),
  telegraphs(effect) {
    const e = effect as BloodStep;
    if (!e.ctx) return [];
    // The strip is armed once the thorns stand and wounds until it ends; the hits are decided on the live position.
    return [{
      shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.want.x, z2: e.want.z, width: HALF_W * 2 },
      start: 0, impact: THORN_T, until: STRIP_END,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BloodStep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BloodStep).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
