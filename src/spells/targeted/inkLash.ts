import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import { INK, INK_CSS, Splatter, Stroke } from '../../effects/parts/ink';
import { firstSurface } from '../../obstacles';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { addStroke, inkLive } from '../../traits/ink';

/**
 * Ink Lash (ink kit v5, Q: a skillshot that leaves a stroke). A 0.3 s wind-up (a wet sweep of the brush round her hand), then
 * a lash of ink (22 m/s, 9 m, `ctx.projectile`, radius 0.35) flies out: 50. It reaches 6 m at 0.57 s, so a sidestep beats it.
 * The stroke runs along its path, from where it left to where it stopped (the hit, cover or full range), and is added to
 * her ink at the end of the flight (`addStroke`, traits/ink.ts), on both screens: it lies on the ground for 5 s, slows and
 * Stains whoever stands on it, and makes a crossing where it cuts an older stroke. A wet ribbon rides the lash and then
 * dissolves; the ground mark takes over. Online the dealer's screen has no bolt (bolts fly on the victim's screen, where the hit
 * is decided): it draws the lash on its nominal path, cut short by cover. There the stroke ends at the bolt on the
 * victim's screen and at cover or full range on the dealer's. Clean by about 1.5 s (5.5 s in the VFX tool, where no trait draws the ink).
 */
export interface InkLashSettings {
  damage: number;
  loop: boolean;
}

export const defaultInkLash = (): InkLashSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.3;
const SPEED = 22;
const RANGE = 9;
const RADIUS = 0.35;
const MUZZLE = 0.6;
const RIBBON_W = 0.7;
const RIBBON_Y = 0.07;
const LIVE_END = 1.5;
const TOOL_END = 5.6;

const LOOK: BoltLook = { core: INK_CSS.hot, body: INK_CSS.body, rim: INK_CSS.dark, size: 0.3, trail: 3, hit: INK_CSS.hot };

export class InkLash implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InkLashSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private len = LIVE_END;

  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private hand = new THREE.Vector3();
  private start = new THREE.Vector3();
  private tip = new THREE.Vector3();
  /** Where the lash stops with no bolt (cover or full range), and the seconds it flies. */
  private nominalEnd = new THREE.Vector3();
  private nominalT = 0;
  private fired = false;
  private ended = false;
  private sweepGone = false;
  private dissolveAt = -1;
  private hitAt = -1;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;

  private bolts = new BoltSet(this.group);
  private sweep = new Stroke({ taper: 0.5 });
  private ribbon = new Stroke({ flat: true, order: 7, taper: 0.7 });
  private splat = new Splatter(28);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private blob = new THREE.Group();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private trail: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: InkLashSettings = defaultInkLash()) {
    this.settings = settings;
    // The nominal lash (no bolt): a black blob with an indigo rim.
    const rim = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: INK.body }));
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), new THREE.MeshBasicMaterial({ color: INK.dark }));
    this.blob.add(rim, body);
    this.blob.scale.set(1, 1, 1.7);
    this.blob.visible = false;
    this.group.add(this.ribbon.mesh, this.sweep.mesh, this.splat.mesh, this.pop.mesh, this.blob);
    this.reset();
  }

  get duration() {
    return this.len;
  }

  get impactTime() {
    return RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + (RANGE - MUZZLE) / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(this.from).addScaledVector(this.fwd, 0.5).setY(1.2);
    this.start.copy(this.from).addScaledVector(this.fwd, MUZZLE);
    this.line = {
      kind: 'line', x1: this.from.x, z1: this.from.z, x2: this.from.x + this.fwd.x * RANGE, z2: this.from.z + this.fwd.z * RANGE,
      width: RADIUS * 2,
    };
    // With no bolt the lash ends at cover (the first surface on its line) or at full range.
    this.v1.copy(this.from).addScaledVector(this.fwd, RANGE);
    const hit = firstSurface(this.start, this.v1, ctx.obstacles?.() ?? []);
    const reach = (RANGE - MUZZLE) * (hit ? hit.t : 1);
    this.nominalEnd.copy(this.start).addScaledVector(this.fwd, reach);
    this.nominalT = reach / SPEED;
    this.len = inkLive(ctx.caster) ? LIVE_END : TOOL_END;
  }

  play() {
    this.reset();
    this.playing = true;
    // The wind-up: the brush sweeps a wet arc round her hand.
    const ctx = this.ctx;
    if (!ctx) return;
    const base = Math.atan2(this.fwd.x, this.fwd.z);
    for (let i = 0; i < 4; i++) {
      const a = base + 1.7 - i * 0.55, r = 0.9 - i * 0.08;
      this.path[i].set(this.from.x + Math.sin(a) * r, 1.0 + i * 0.1, this.from.z + Math.cos(a) * r);
    }
    this.sweep.paint(this.path, 0.5, RELEASE_T);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.ended = this.sweepGone = false;
    this.dissolveAt = -1;
    this.hitAt = -1;
    this.bolt = null;
    this.blob.visible = false;
    this.bolts.clear();
    this.sweep.reset();
    this.ribbon.reset();
    this.splat.reset();
    this.pop.set(this.hand, 0, 0);
    this.tip.copy(this.start);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sweep.update(dt);
    this.ribbon.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.bolts.update(dt);
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (!this.sweepGone && t >= RELEASE_T) {
      this.sweepGone = true;
      this.sweep.dissolve(0.3);
    }

    if (!this.fired && t >= RELEASE_T) {
      this.fired = true;
      this.shake = 0.06;
      this.v1.copy(this.hand);
      this.splat.fling(this.v1, this.fwd, 6, 4, { size: 0.1, spread: 0.5, up: 0.4, life: 0.6 });
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1.5, color: INK_CSS.hot },
        });
        this.bolts.follow(this.bolt, LOOK);
        this.bolt.onHit((_target, at) => this.onHit(at));
      }
    }

    if (this.fired && !this.ended) {
      const bolt = this.bolt;
      let over: boolean;
      if (bolt) {
        this.tip.set(bolt.pos.x, 0, bolt.pos.z);
        over = !bolt.alive;
      } else {
        const k = Math.min(1, (t - RELEASE_T) / Math.max(this.nominalT, 1e-3));
        this.tip.lerpVectors(this.start, this.nominalEnd, k);
        over = k >= 1;
        this.blob.visible = !over;
        this.blob.position.set(this.tip.x, 1.1, this.tip.z);
        this.blob.rotation.y = Math.atan2(this.fwd.x, this.fwd.z);
      }
      // The wet ribbon rides the lash: fat where it left, drying toward the head.
      this.trail[0].set(this.start.x, RIBBON_Y, this.start.z);
      this.trail[1].lerpVectors(this.start, this.tip, 0.5).setY(RIBBON_Y);
      this.trail[2].set(this.tip.x, RIBBON_Y, this.tip.z);
      this.ribbon.set(this.trail, RIBBON_W, 1);
      if (Math.random() < dt * 16) {
        this.v1.set(this.tip.x, 1.1, this.tip.z);
        this.v2.set(-this.fwd.z + (Math.random() - 0.5), 0.5, this.fwd.x + (Math.random() - 0.5));
        this.splat.fling(this.v1, this.v2, 1, 2.5, { size: 0.09, spread: 0.5, up: 0.4, life: 0.6 });
      }
      if (over) {
        this.ended = true;
        this.blob.visible = false;
        // The stroke lands in her ink: from where it left to where it stopped. Both screens.
        if (ctx) addStroke(ctx.caster, this.start.x, this.start.z, this.tip.x, this.tip.z);
        // The ground mark takes over from the ribbon; in the VFX tool (no trait draws the ink) the ribbon stays 5 s.
        this.dissolveAt = ctx && inkLive(ctx.caster) ? t : this.len - 0.6;
      }
    }
    if (this.dissolveAt >= 0 && t >= this.dissolveAt) {
      this.dissolveAt = -1;
      this.ribbon.dissolve(0.5);
    }

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const sp = StarBurst.pop(a, 0, 0.05);
      this.pop.set(this.v1.set(this.tip.x, 1.2, this.tip.z), 0.9 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.14 * Math.exp(-a * 12);
    }

    if (t >= this.len) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  private onHit(at: THREE.Vector3) {
    this.hitAt = this.time;
    this.v1.set(at.x, 1.1, at.z);
    this.v2.copy(this.fwd).setY(0.2);
    this.splat.fling(this.v1, this.v2, 8, 4.5, { size: 0.14, spread: 1.0, up: 0.8, life: 0.7 });
  }
}

export const inkLashModule: EffectModule = {
  label: 'ink lash',
  category: 'hero: ink',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new InkLash(),
  telegraphs(effect) {
    const e = effect as InkLash;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as InkLash;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as InkLash).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
