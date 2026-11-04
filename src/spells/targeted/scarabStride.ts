import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandRibbon, ScarabSwarm } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Scarab Stride (sand kit v5, E: a 6 m dash). Sefu skitters 6 m toward the aim in 0.5 s (`ctx.moveCaster`, the engine's ease-out
 * dash, from `DASH`) as a stream of gold and turquoise scarabs that pour off him and run low along the path, over a thin ribbon
 * of ochre sand. He is NOT untouchable. The telegraph is the dash line (1.4 m wide: the bite's reach each side), shown as he
 * starts, so an enemy can step off it: 0.7 m sideways is enough inside the 0.5 s. Passing through the enemy bites once,
 * judged each frame by the live enemy position against the path he has swept (`projectile: true`: the sweep is the check, as
 * in `forgeCharge.ts`): `bite` (30) now, then `poison` (30) as two ticks of half of it, 1 s and 2 s after the bite (also
 * `projectile`, the enemy has left the line by then). A turquoise star hangs over a poisoned enemy. No hit lands on a pass
 * that misses. The poison runs to about 2.5 s after the cast; clean by 3.0 s.
 * Network duels: the dealer's screen has no `moveCaster` (his client streams the dash), so the path is computed from
 * `sentFrom` and the aim point, eased like the engine's dash, and the victim's client judges the bite on its own hero.
 */
export interface ScarabStrideSettings {
  /** Damage of the bite as he passes through. */
  bite: number;
  /** Poison damage in all, in two equal ticks. */
  poison: number;
  loop: boolean;
}

export const defaultScarabStride = (): ScarabStrideSettings => ({ bite: 30, poison: 30, loop: false });

// Timeline (seconds).
const DASH = 0.5;
const TICKS = [1.0, 2.0]; // seconds after the bite
const DURATION = 3.0;

const DIST = 6;
const BITE_R = 0.7; // how close the path passes to the enemy's centre to bite
const GRAINS = 0.34;

/** The engine's dash easing (`Arena.stepDash`): ease-out cubic. */
const ease = (k: number) => 1 - (1 - k) ** 3;

export class ScarabStride implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ScarabStrideSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The dash's path on the ground, from `sentFrom` and the aim point only. */
  readonly start = new THREE.Vector3();
  readonly end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private time = 0;
  private prevK = 0;
  private go = false;
  private biteAt = -1;
  private bitten: Enemy | null = null;
  private ticks = 0;
  private burstAt = -1;
  private flashPos = new THREE.Vector3();

  private swarm = new ScarabSwarm(48);
  private trail = new SandRibbon(24, 8, 8);
  private dust = new Dust(8, 20);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private poisonStar = new StarBurst({ points: 6, inner: 0.25, color: SAND.accent, core: 0xe8fffc, additive: false });
  private ring = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: ScarabStrideSettings = defaultScarabStride()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.trail.shed = 0;
    this.dust.life = 0.5;
    this.group.add(this.trail.mesh, this.swarm.mesh, this.dust.mesh, this.pop.mesh, this.poisonStar.mesh, this.ring.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DASH;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    // Always the full 6 m along the aim (the point only gives the direction).
    this.end.copy(this.start).addScaledVector(this.dir, DIST);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.start).addScaledVector(this.dir, DIST * 0.5).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
    // The real dash (nothing on the other player's screen: the hero streams in as moves); the engine clamps it into the ring.
    const reached = this.ctx?.moveCaster?.(this.v1.copy(this.end), DASH);
    if (reached) this.end.copy(reached).setY(0);
    this.go = true;
    this.dust.puff(this.v1.copy(this.start).setY(0.3), 0.7);
    this.swarm.burst(this.v1.copy(this.start).setY(0.4), 8, 2.5, 0.7);
    this.shake = 0.12;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.prevK = 0;
    this.go = false;
    this.biteAt = -1;
    this.bitten = null;
    this.ticks = 0;
    this.burstAt = -1;
    clearScreenFx(this.screen);
    this.swarm.reset();
    this.trail.reset();
    this.dust.reset();
    this.pop.set(this.end, 1e-3, 0);
    this.poisonStar.set(this.end, 1e-3, 0);
    this.ring.set(this.end, 0, 0);
  }

  /** Where he is along the path at dash progress k (0..1), on the ground. */
  private at(k: number, out: THREE.Vector3) {
    return out.copy(this.start).lerp(this.end, ease(k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.trail.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // --- The dash: a stream of scarabs off him, the bite where he passes through the enemy. ---
    if (this.go && this.prevK < 1) {
      const k = THREE.MathUtils.clamp(t / DASH, 0, 1);
      const prev = this.at(this.prevK, this.v1);
      const cur = this.at(k, this.v2);
      this.prevK = k;
      this.swarm.scuttle(cur, this.v3.copy(this.dir).negate(), 2, 0.55);
      if (this.biteAt < 0 && ctx) this.tryBite(ctx, prev, cur, t);
      if (k >= 1) {
        this.dust.puff(this.v1.copy(this.end).setY(0.3), 0.6);
        this.swarm.burst(this.v1.copy(this.end).setY(0.4), 6, 2.2, 0.6);
      }
    }

    // --- Poison: a tick 1 s and 2 s after the bite, each a small scarab spray on the enemy. ---
    if (this.biteAt >= 0 && ctx && this.bitten) {
      while (this.ticks < TICKS.length && t >= this.biteAt + TICKS[this.ticks]) {
        this.ticks++;
        const p = this.bitten.group.position;
        ctx.hit(this.bitten, {
          damage: this.settings.poison / TICKS.length, knock: 0, color: SAND_CSS.accent, from: this.start.clone(), projectile: true,
        });
        this.swarm.burst(this.v1.set(p.x, 0.9, p.z), 5, 2.4, 0.7);
        this.burstAt = t;
        this.flashPos.set(p.x, 1.2, p.z);
        this.shake = Math.max(this.shake, 0.08);
      }
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  /** The enemy nearest the swept path this frame, within `BITE_R`, is bitten (once). */
  private tryBite(ctx: CastContext, a: THREE.Vector3, b: THREE.Vector3, t: number) {
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
    let best: Enemy | null = null, bestD = Infinity;
    for (const e of ctx.targets) {
      const p = e.group.position;
      const u = l2 > 1e-9 ? THREE.MathUtils.clamp(((p.x - a.x) * ex + (p.z - a.z) * ez) / l2, 0, 1) : 0;
      const d = Math.hypot(p.x - (a.x + ex * u), p.z - (a.z + ez * u));
      if (d > BITE_R || d >= bestD) continue;
      best = e;
      bestD = d;
    }
    if (!best) return;
    this.bitten = best;
    this.biteAt = t;
    const p = best.group.position;
    this.flashPos.set(p.x, 1.1, p.z);
    this.burstAt = t;
    this.swarm.burst(this.v3.set(p.x, 0.9, p.z), 10, 3.2, 0.8);
    this.dust.puff(this.v3.set(p.x, 0.3, p.z), 0.6);
    this.shake = Math.max(this.shake, 0.22);
    ctx.hit(best, { damage: this.settings.bite, knock: 0, color: SAND_CSS.body, from: this.start.clone(), projectile: true });
  }

  private layout(t: number) {
    // --- A thin ribbon of ochre sand along the path he has run, fading from the start. ---
    if (this.go) {
      const k = THREE.MathUtils.clamp(t / DASH, 0, 1);
      const head = Math.max(ease(k), 0.02);
      const fade = smoothstep((t - DASH - 0.1) / 0.4);
      this.trail.setFunction((u, out) => out.lerpVectors(this.start, this.end, u).setY(0.12), GRAINS, head, Math.min(fade * head, head - 0.02), t);
    }
    // --- The bite's star and ring, and the poison star that hangs over the enemy. ---
    if (this.burstAt >= 0) {
      const a = t - this.burstAt;
      const sp = StarBurst.pop(a, 0.02, 0.06);
      this.pop.set(this.flashPos, 1.0 * sp.scale + 1e-3, sp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.ring.set(this.v1.set(this.flashPos.x, 0, this.flashPos.z), 0.4 + 1.6 * g, 0.03 * (1 - g) * (1 - g));
    }
    if (this.biteAt >= 0 && this.bitten && this.ticks < TICKS.length) {
      const p = this.bitten.group.position;
      const pulse = 0.5 + 0.5 * Math.sin(t * 14);
      this.v1.set(p.x, 2.5, p.z);
      this.poisonStar.set(this.v1, 0.45 + 0.15 * pulse, 0.95, t * 4);
    } else this.poisonStar.set(this.end, 1e-3, 0);
  }
}

export const scarabStrideModule: EffectModule = {
  label: 'scarab stride',
  category: 'hero: sand',
  // A dash along the aim: the point only gives the direction (the stride is always 6 m). The radius is the AI's reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new ScarabStride(),
  telegraphs(effect) {
    const e = effect as ScarabStride;
    if (!e.ctx) return [];
    // The dash line, shown as he starts. `impact` is 0.02 so the cast root does not outlast the dash's first frame.
    return [{
      shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.end.x, z2: e.end.z, width: BITE_R * 2 },
      start: 0, impact: 0.02, until: DASH + 0.05,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ScarabStride;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ScarabStride).settings;
    f.add(s, 'loop');
    f.add(s, 'bite', 1, 100, 1);
    f.add(s, 'poison', 0, 100, 1);
  },
};
