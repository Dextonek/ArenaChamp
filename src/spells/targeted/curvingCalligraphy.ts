import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { INK, INK_CSS, InkBleed, Seal, Splatter, Stroke } from '../../effects/parts/ink';
import { arcPoints, arcShot, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Final Calligraphy (ink kit, R, reworked: one giant brushstroke that curves). `aim: 'arc'`: the cast brings a bend
 * (`ctx.bend`) and the stroke is launched with `arcShot(from, point, bend, SPEED)`, so it flies a circular arc that
 * bows round a pillar and curls back onto the cursor. A big bolt (radius 0.9, 16 m/s, up to 16 m) carries a thick wet
 * stroke head; behind it a ribbon of ink is painted along the path actually flown, stays a moment, and dries out. On a
 * hit: big damage, a blind, a seal stamp and an ink burst. No ground circle. A network duel has no bolts: the spell then
 * shows only the sweep and the arc drawn in. Hits land within about 1.4 s of the cast; clean by 3 s.
 */
export interface CurvingCalligraphySettings {
  damage: number;
  blindSeconds: number;
  knock: number;
}

export const defaultCurvingCalligraphy = (): CurvingCalligraphySettings => ({ damage: 130, blindSeconds: 2, knock: 3 });

const WINDUP = 0.3;
const SPEED = 16;
const MAX_CHORD = 15; // the longest chord; the arc is a little longer, about 16
const RADIUS = 0.9;
const BOLT_Y = 1.1;
const STROKE_W = 2.0;
const HIST = 48; // points kept of the flown path (Stroke samples)
const TELE_SEGS = 8;

export class CurvingCalligraphy implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CurvingCalligraphySettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. */
  ctx: CastContext | null = null;
  /** The planned arc as line segments, for the telegraph. */
  segs: TelegraphShape[] = [];
  /** Seconds until the planned arc has been flown. */
  flightEnd = WINDUP + 1;
  private time = 0;
  private fired = false;
  private ended = false;
  private hitDone = false;
  private sweepGone = false;
  private swept = false;
  private goneAt = -1;
  private starAge = 9;
  private fadeAt = -1;
  private bolt: Projectile | null = null;
  private launch = new THREE.Vector3();
  private aimDir = new THREE.Vector3(0, 0, 1);
  private plan: THREE.Vector3[] = [];
  private flown: THREE.Vector3[] = [];
  private lastPush = new THREE.Vector3();
  private starPos = new THREE.Vector3();
  private shot = { dir: new THREE.Vector3(0, 0, 1), curve: 0, range: 0 };

  private sweep = new Stroke({ taper: 0.5 });
  private trail = new Stroke({ taper: 0.8, samples: HIST, order: 7 });
  private splat = new Splatter(24);
  private bleed = new InkBleed();
  private seal = new Seal(1);
  private star = new StarBurst({ points: 12, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private samples: THREE.Vector3[] = Array.from({ length: HIST }, () => new THREE.Vector3());

  constructor(settings: CurvingCalligraphySettings = defaultCurvingCalligraphy()) {
    this.settings = settings;
    this.group.add(this.bleed.mesh, this.seal.mesh, this.sweep.mesh, this.trail.mesh, this.splat.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return 3;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const from = ctx.from;
    // The aim point limited to the longest chord; below a minimum the shot is a short straight flick.
    const target = this.v1.set(ctx.point.x - from.x, 0, ctx.point.z - from.z);
    const chord = Math.min(MAX_CHORD, Math.max(3, target.length()));
    if (target.lengthSq() < 1e-6) target.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    target.setLength(chord).add(from).setY(0);
    const a = arcShot(from, target, ctx.bend ?? 0, SPEED);
    this.shot.dir.copy(a.dir);
    this.shot.curve = a.curve;
    this.shot.range = a.range;
    this.launch.copy(from).setY(0);
    this.aimDir.copy(a.dir);
    this.plan = arcPoints(from, target, ctx.bend ?? 0, TELE_SEGS);
    this.segs = [];
    for (let i = 0; i < this.plan.length - 1; i++) {
      const p = this.plan[i], q = this.plan[i + 1];
      this.segs.push({ kind: 'line', x1: p.x, z1: p.z, x2: q.x, z2: q.z, width: RADIUS * 2 });
    }
    this.flightEnd = WINDUP + a.range / SPEED;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.ended = false;
    this.hitDone = false;
    this.sweepGone = false;
    this.swept = false;
    this.goneAt = -1;
    this.starAge = 9;
    this.fadeAt = -1;
    this.bolt = null;
    this.flown.length = 0;
    this.sweep.reset();
    this.trail.reset();
    this.splat.reset();
    this.bleed.reset();
    this.seal.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sweep.update(dt);
    this.trail.update(dt);
    this.splat.update(dt);
    this.bleed.update(dt);
    this.seal.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- 0..0.3: the brush sweeps a fat arc round her, the start of the stroke. ---
    if (!this.swept && ctx) {
      this.swept = true;
      const base = Math.atan2(this.aimDir.x, this.aimDir.z);
      for (let i = 0; i < 4; i++) {
        const a = base + 1.9 - i * 0.62, r = 1.2 - i * 0.1;
        this.path[i].set(ctx.from.x + Math.sin(a) * r, 1.0 + i * 0.12, ctx.from.z + Math.cos(a) * r);
      }
      this.sweep.paint(this.path, 1.0, WINDUP);
    }
    if (!this.sweepGone && t >= WINDUP) {
      this.sweepGone = true;
      this.sweep.dissolve(0.4);
    }

    // --- Fire: the curving bolt. A network duel has no bolts, so the planned arc is painted in instead. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.launch.clone(), dir: this.shot.dir.clone(), speed: SPEED, range: this.shot.range, radius: RADIUS,
          curve: this.shot.curve,
          hit: { damage: s.damage, knock: s.knock, color: INK_CSS.hot, status: { kind: 'blind', seconds: s.blindSeconds } },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
        this.lastPush.copy(this.launch);
        this.flown.push(this.launch.clone().setY(BOLT_Y));
        this.shake = 0.1;
      } else {
        for (const p of this.plan) this.flown.push(p.clone().setY(BOLT_Y));
        this.drawTrail();
        this.trail.dissolve(1.2);
        this.goneAt = t;
        this.ended = true;
      }
    }

    // --- The wet stroke rides the bolt and records the path flown; it is redrawn along the whole path every frame. ---
    const b = this.bolt;
    if (b && !this.ended) {
      if (b.alive) {
        if (b.pos.distanceTo(this.lastPush) > 0.3) {
          this.lastPush.copy(b.pos);
          this.flown.push(this.v2.copy(b.pos).setY(BOLT_Y).clone());
        }
        this.drawTrail(b.pos);
        if (Math.random() < dt * 14) {
          this.v1.copy(b.pos).setY(BOLT_Y);
          this.v2.set(-b.dir.z + (Math.random() - 0.5), 0.5, b.dir.x + (Math.random() - 0.5));
          this.splat.fling(this.v1, this.v2, 1, 2.5, { size: 0.1, spread: 0.5, up: 0.4, life: 0.6 });
        }
      } else {
        this.ended = true;
        this.flown.push(this.v2.copy(b.pos).setY(BOLT_Y).clone());
        this.drawTrail();
        // The stroke stays a moment, then dries and flakes away.
        this.trail.dissolve(1.0);
        this.goneAt = t;
        if (!this.hitDone) {
          this.v2.copy(b.dir).setY(0.1);
          this.splat.fling(this.v1.copy(b.pos).setY(BOLT_Y), this.v2, 6, 5, { size: 0.16, spread: 0.5, up: 0.6, life: 0.7 });
        }
      }
    }

    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.04);
    this.star.set(this.starPos, 2.2 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 10);
    if (this.fadeAt >= 0 && t >= this.fadeAt) {
      this.fadeAt = -1;
      this.bleed.fade(0.6);
      this.seal.fade(0.6);
    }

    const busy = this.sweep.busy || this.trail.busy || this.splat.busy || this.bleed.busy || this.seal.busy;
    if ((this.goneAt >= 0 && t >= this.goneAt + 0.4 && !busy) || t >= 4) {
      this.playing = false;
      this.reset();
    }
  }

  /** Resamples the flown path into the trail ribbon, head (the bolt) first so the fat end leads and the tail dries out. */
  private drawTrail(head?: THREE.Vector3) {
    const pts = this.flown;
    if (pts.length < 1) return;
    const total = pts.length + (head ? 1 : 0);
    const at = (i: number, out: THREE.Vector3) => {
      // i counts from the head: 0 = the bolt (or the last recorded point).
      const k = total - 1 - i;
      return k >= pts.length ? out.copy(head!).setY(BOLT_Y) : out.copy(pts[k]);
    };
    const n = Math.min(HIST, Math.max(2, total));
    for (let j = 0; j < n; j++) at(Math.round((j / (n - 1)) * (total - 1)), this.samples[j]);
    this.trail.set(this.samples.slice(0, n), STROKE_W, 1);
  }

  /** The hit: a seal stamps the ground under the target, ink bursts, a vermilion star. */
  private onHit(at: THREE.Vector3) {
    this.hitDone = true;
    this.starPos.set(at.x, 1.3, at.z);
    this.starAge = 0;
    this.v1.copy(at).setY(0);
    this.bleed.spread(this.v1, 2.0, 0.3);
    this.seal.stamp(this.v1, 2.0);
    this.v2.copy(this.aimDir).multiplyScalar(-1).setY(0.6);
    this.splat.fling(this.starPos, this.v2, 12, 6, { size: 0.18, spread: 1.6, up: 1.5, life: 1.0 });
    this.fadeAt = this.time + 0.9;
    this.shake = 0.5;
  }
}

export const curvingCalligraphyModule: EffectModule = {
  label: 'final calligraphy',
  category: 'hero: ink',
  // Aimed at a spot (the cursor sets where the arc ends); `radius` only sizes the aim marker. Arc aim comes from the kit.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CurvingCalligraphy(),
  telegraphs(effect) {
    const e = effect as CurvingCalligraphy;
    if (!e.ctx) return [];
    // Armed at the launch and shown until the stroke has passed; the bolt's hit is the dodge check.
    return e.segs.map((shape) => ({ shape, start: 0, impact: WINDUP, until: e.flightEnd }));
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CurvingCalligraphy;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as CurvingCalligraphy).settings;
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'blindSeconds', 0, 2, 0.1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
