import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { INK, INK_CSS, InkBleed, Seal, Splatter, Stroke } from '../../effects/parts/ink';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Brushstroke (ink kit, Q: a splitting skillshot). Shiori sweeps the big brush: a fat wet arc paints in at her side over
 * the first 0.2 s. At 0.2 the stroke is fired (`ctx.projectile`, splitting into 3 child bolts at max range). The bolt is a
 * flying stroke head (fat, sumi black, indigo rim) trailing a ribbon that dries out behind it, flinging a drop now and
 * then. On a hit it bursts in splatter on a small paper bleed with a tiny seal; at max range it flicks into three
 * splatter drops and the three children fly on as short strokes. Clean by about 1.6 s. See pipeline/designs/kit-ink.md.
 */
export interface BrushstrokeSettings {
  damage: number;
  knock: number;
  splitDamage: number;
}

export const defaultBrushstroke = (): BrushstrokeSettings => ({ damage: 45, knock: 2, splitDamage: 12 });

const WINDUP = 0.2;
const SPEED = 20;
const RANGE = 12;
const RADIUS = 0.45;
const MUZZLE = 0.8;
const BOLT_Y = 1.1;
const TRAIL = 3.2;
const STROKE_W = 0.8;
const KID_W = 0.5;
const KID_TRAIL = 1.1;
const FLICK_DEG = [-20, 0, 20];

export class Brushstroke implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BrushstrokeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private fired = false;
  private sweepGone = false;
  private swept = false;
  private ended = false;
  private hitDone = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private dripT = 0;
  private starAge = 9;
  private fadeAt = -1;
  private kidGone = [false, false, false];

  private dir = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);
  private lastPos = new THREE.Vector3();
  private starPos = new THREE.Vector3();

  // Camera-facing ribbons: they never go edge-on, whatever the flight direction.
  private sweep = new Stroke({ taper: 0.5 });
  private head = new Stroke({ taper: 0.55 });
  private kids = [0, 1, 2].map(() => new Stroke({ taper: 0.5, samples: 12 }));
  private splat = new Splatter(24);
  private bleed = new InkBleed();
  private seal = new Seal(1);
  private star = new StarBurst({ points: 8, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: BrushstrokeSettings = defaultBrushstroke()) {
    this.settings = settings;
    this.group.add(
      this.bleed.mesh, this.seal.mesh, this.sweep.mesh, this.head.mesh, ...this.kids.map((k) => k.mesh), this.splat.mesh, this.star.mesh,
    );
    this.reset();
  }

  get duration() {
    return 1.6;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return WINDUP + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.dir.z, 0, -this.dir.x);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.sweepGone = false;
    this.swept = false;
    this.ended = false;
    this.hitDone = false;
    this.goneAt = -1;
    this.bolt = null;
    this.dripT = 0;
    this.starAge = 9;
    this.fadeAt = -1;
    this.kidGone = [false, false, false];
    this.sweep.reset();
    this.head.reset();
    for (const k of this.kids) k.reset();
    this.splat.reset();
    this.bleed.reset();
    this.seal.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sweep.update(dt);
    this.head.update(dt);
    for (const k of this.kids) k.update(dt);
    this.splat.update(dt);
    this.bleed.update(dt);
    this.seal.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- 0..0.2: the brush sweeps; a fat wet arc paints in from her side round to the muzzle. ---
    if (!this.swept && ctx) {
      this.swept = true;
      for (let i = 0; i < 4; i++) {
        const a = ctx.aim + (1.75 - i * 0.58) * 1, r = 1.05 - i * 0.08;
        this.path[i].set(ctx.from.x + Math.sin(a) * r, 1.0 + i * 0.12, ctx.from.z + Math.cos(a) * r);
      }
      this.sweep.paint(this.path, STROKE_W, WINDUP);
    }
    if (!this.sweepGone && t >= WINDUP) {
      this.sweepGone = true;
      this.sweep.dissolve(0.4);
    }

    // --- Fire. A network duel has no bolts (the context leaves `projectile` out): the spell then shows only the sweep. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      if (ctx?.projectile) {
        const from = this.v1.copy(ctx.from).addScaledVector(this.dir, MUZZLE);
        this.bolt = ctx.projectile({
          from, dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: INK_CSS.hot },
          split: { count: 3, spreadDeg: 40, at: 'end', hit: { damage: s.splitDamage, knock: 1, color: INK_CSS.hot }, range: 4 },
        });
        this.bolt.onHit((_target, at, b) => this.onHit(at, b === this.bolt));
        this.lastPos.copy(from);
        this.shake = 0.05;
      } else {
        this.goneAt = t;
      }
    }

    // --- The stroke head rides the bolt: fat in front, a ribbon drying out behind it. ---
    const b = this.bolt;
    if (b) {
      if (b.alive) {
        this.lastPos.copy(b.pos);
        const len = Math.min(TRAIL, Math.max(0.6, b.pos.distanceTo(this.v3.copy(ctx?.from ?? b.pos).addScaledVector(this.dir, MUZZLE)) + 0.6));
        this.ribbon(this.head, b.pos, b.dir, len, STROKE_W, t * 5);
        this.dripT += dt;
        while (this.dripT >= 0.22) {
          this.dripT -= 0.22;
          this.v1.copy(b.pos).addScaledVector(b.dir, -len * (0.3 + Math.random() * 0.5));
          this.v2.copy(b.dir).multiplyScalar(-1).addScaledVector(this.side, Math.random() - 0.5);
          this.splat.fling(this.v1, this.v2, 1, 1.6, { size: 0.06, spread: 0.4, up: 0.4, life: 0.5 });
        }
      } else if (!this.ended) {
        this.ended = true;
        this.head.dissolve(this.hitDone ? 0.3 : 0.25);
        // A bolt that ended without a hit flicks into three drops, one down each child's line.
        if (!this.hitDone) {
          for (const deg of FLICK_DEG) {
            const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
            this.v2.set(this.dir.x * c - this.dir.z * sn, 0.1, this.dir.x * sn + this.dir.z * c);
            this.splat.fling(this.lastPos, this.v2, 1, 6, { size: 0.15, spread: 0.1, up: 0.6, life: 0.6 });
          }
        }
      }
      this.fanKids(t);
    }

    // --- The hit accent: a small vermilion star for two frames. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.03);
    this.star.set(this.starPos, 0.95 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if (this.fadeAt >= 0 && t >= this.fadeAt) {
      this.fadeAt = -1;
      this.bleed.fade(0.5);
      this.seal.fade(0.5);
    }

    const allDone = !b || (!b.alive && b.children.every((c) => !c.alive));
    if (b && allDone && this.goneAt < 0) this.goneAt = t;
    const busy = this.sweep.busy || this.head.busy || this.kids.some((k) => k.busy) || this.splat.busy || this.bleed.busy || this.seal.busy;
    if (this.goneAt >= 0 && t >= this.goneAt + 0.5 && !busy) {
      this.playing = false;
      this.reset();
    } else if (t >= 3) {
      this.playing = false;
      this.reset();
    }
  }

  /** A three-point wobbling ribbon from `head` back along `dir`. */
  private ribbon(stroke: Stroke, head: THREE.Vector3, dir: THREE.Vector3, len: number, width: number, phase: number) {
    const w = 0.12 * Math.min(1, len / TRAIL);
    this.path[0].set(head.x, BOLT_Y, head.z);
    this.path[1].copy(head).addScaledVector(dir, -len * 0.5).addScaledVector(this.side, Math.sin(phase) * w).setY(BOLT_Y);
    this.path[2].copy(head).addScaledVector(dir, -len).addScaledVector(this.side, Math.sin(phase * 0.7 + 2) * w * 1.6).setY(BOLT_Y);
    stroke.set(this.path.slice(0, 3), width, 1);
  }

  /** One short stroke rides each child bolt; it dissolves when the child ends. */
  private fanKids(t: number) {
    const b = this.bolt;
    if (!b) return;
    b.children.forEach((c, i) => {
      if (i > 2) return;
      if (c.alive) this.ribbon(this.kids[i], c.pos, c.dir, KID_TRAIL, KID_W, t * 6 + i);
      else if (!this.kidGone[i]) {
        this.kidGone[i] = true;
        this.kids[i].dissolve(0.3);
        this.splat.fling(this.v1.copy(c.pos).setY(BOLT_Y), c.dir, 2, 3, { size: 0.08, spread: 0.8, life: 0.5 });
      }
    });
  }

  /** A hit: the parent's hit bursts in splatter on a paper bleed with a tiny seal; a child's hit spatters a little. */
  private onHit(at: THREE.Vector3, parent: boolean) {
    this.starPos.set(at.x, 1.1, at.z);
    this.starAge = 0;
    if (parent) {
      this.hitDone = true;
      this.v1.copy(at).setY(0);
      this.v2.copy(this.dir).multiplyScalar(-1).setY(0.4);
      this.splat.fling(this.starPos, this.v2, 6, 5, { size: 0.13, spread: 1.4 });
      this.bleed.spread(this.v1, 1.0, 0.25);
      this.seal.stamp(this.v1, 0.6);
      this.fadeAt = this.time + 0.7;
      this.shake = 0.12;
    } else {
      this.v2.set(0, 0.5, 0);
      this.splat.fling(this.starPos, this.v2, 2, 3, { size: 0.1, spread: 3, life: 0.5 });
      this.shake = Math.max(this.shake, 0.06);
    }
  }
}

export const brushstrokeModule: EffectModule = {
  label: 'brushstroke',
  category: 'hero: ink',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Brushstroke(),
  telegraphs(effect) {
    const e = effect as Brushstroke;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: WINDUP, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Brushstroke;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Brushstroke).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'splitDamage', 0, 50, 1);
  },
};
