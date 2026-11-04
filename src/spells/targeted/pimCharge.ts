import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, Dust, ToyRing, ToyWords, Streaks, TWINS, TWINS_CSS, WoodSword } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { CHARGE_DAMAGE, CHARGE_RANGE, CHARGE_TIME, CHARGE_WIDTH, CHARGE_WIND } from '../../traits/twins';

/**
 * Charge (twins kit, Pim's W: a rush). Pim puts his head down and digs in (0.4 s): the sword points forward, dust kicks up behind his
 * boots, and orange streaks gather along the lane (the lane is the telegraph, a 1.6 m wide strip as long as the rush). Then he runs the
 * aimed distance (5 m at most, 2 m at least) in 0.2 s (`ctx.moveCaster`), a trail of dust and confetti behind him and speed streaks
 * along the lane. When he arrives (0.6 s) everyone in the lane on their live position takes 40 and is shoved ahead of him, with a
 * spiky star, a ring and the word RAAH. Network duels: the other screen has no `moveCaster` (his client streams the run), so it draws
 * the lane from `sentFrom` and the hits are decided on the victim's screen. Clean by about 1.6 s. See pipeline/designs/kit-twins.md.
 */
export interface PimChargeSettings {
  damage: number;
  loop: boolean;
}

export const defaultPimCharge = (): PimChargeSettings => ({ damage: CHARGE_DAMAGE, loop: false });

const DURATION = 1.6;
const ARRIVE = CHARGE_WIND + CHARGE_TIME;

export class PimCharge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PimChargeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  lane: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 1, width: CHARGE_WIDTH };
  private time = 0;
  private flags = { dashed: false, landed: false };
  private lastPuff = 0;
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private yaw = 0;

  private sword = new WoodSword();
  private bits = new Confetti(36);
  private dust = new Dust(30);
  private streaks = new Streaks(26);
  private words = new ToyWords(2);
  private ring = new ToyRing(TWINS.pim, 0.12);
  private star = new StarBurst({ points: 8, inner: 0.3, color: TWINS.pim, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PimChargeSettings = defaultPimCharge()) {
    this.settings = settings;
    this.group.add(this.bits.mesh, this.dust.mesh, this.streaks.mesh, this.ring.mesh, this.sword.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ARRIVE;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    this.v1.set(ctx.point.x - s.x, 0, ctx.point.z - s.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.yaw = Math.atan2(this.dir.x, this.dir.z);
    const len = d < 0.3 ? CHARGE_RANGE : THREE.MathUtils.clamp(d, 2, CHARGE_RANGE);
    this.end.copy(this.start).addScaledVector(this.dir, len);
    this.lane = { kind: 'line', x1: this.start.x, z1: this.start.z, x2: this.end.x, z2: this.end.z, width: CHARGE_WIDTH };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.dashed = this.flags.landed = false;
    this.lastPuff = 0;
    this.bits.reset();
    this.dust.reset();
    this.streaks.reset();
    this.words.reset();
    this.sword.hide();
    this.star.set(this.end, 0, 0);
    this.ring.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.dust.update(dt);
    this.streaks.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    // Where he is on the lane now: at the start while he digs in, then eased along it.
    const run = THREE.MathUtils.clamp((t - CHARGE_WIND) / CHARGE_TIME, 0, 1);
    this.v1.lerpVectors(this.start, this.end, run * run * (3 - 2 * run));
    const at = this.v1;

    // --- Dig in: the sword points down the lane, dust kicks up behind, streaks gather. ---
    if (t < CHARGE_WIND) {
      const k = t / CHARGE_WIND;
      this.v2.set(this.start.x + this.dir.x * 0.35 + this.dir.z * 0.4, 0.95, this.start.z + this.dir.z * 0.35 - this.dir.x * 0.4);
      this.sword.place(this.v2, this.yaw, 0.2 + 0.3 * Math.sin(t * 40) * k, 0);
      if (t - this.lastPuff >= 0.07) {
        this.lastPuff = t;
        this.dust.puff(this.v2.set(this.start.x - this.dir.x * 0.5 + (Math.random() - 0.5) * 0.5, 0.15, this.start.z - this.dir.z * 0.5 + (Math.random() - 0.5) * 0.5), 0.25 + 0.2 * k, 0xd9c9a8, 0.5);
      }
    }

    // --- The run. ---
    if (!f.dashed && t >= CHARGE_WIND) {
      f.dashed = true;
      this.shake = 0.08;
      if (ctx?.moveCaster) {
        this.end.copy(ctx.moveCaster(this.end, CHARGE_TIME)).setY(0);
        // The engine may have cut the run short at the ring or cover: the drawn lane and the hit lane agree.
        this.lane = { kind: 'line', x1: this.start.x, z1: this.start.z, x2: this.end.x, z2: this.end.z, width: CHARGE_WIDTH };
      }
      this.streaks.sweep(this.v2.copy(this.start).setY(0), this.end, 14, 1.8, TWINS.pim);
      this.streaks.sweep(this.v2.copy(this.start).setY(0), this.end, 6, 1.4, 0xffffff);
      this.bits.spray(this.v2.copy(this.start).setY(0.4), this.dir.clone().negate(), 8, 4, 0.7);
    }
    if (f.dashed && !f.landed) {
      this.v2.set(at.x + this.dir.z * 0.4 + this.dir.x * 0.3, 1.0, at.z - this.dir.x * 0.4 + this.dir.z * 0.3);
      this.sword.place(this.v2, this.yaw, 0.1, 0);
      if (t - this.lastPuff >= 0.035) {
        this.lastPuff = t;
        this.dust.puff(this.v2.set(at.x, 0.15, at.z), 0.5, 0xd9c9a8, 0.4);
        this.bits.pop(this.v2.set(at.x, 0.5, at.z), 1, 1.5, 0.8, [TWINS.pim, TWINS.yellow]);
      }
    }

    // --- Arrival: a star, a ring, a word, and whoever is in the lane is shoved. ---
    if (!f.landed && t >= ARRIVE) {
      f.landed = true;
      this.shake = 0.18;
      this.words.say('RAAH', this.v2.copy(this.end), 1.6, 0.9, TWINS_CSS.yellow, 1.9);
      this.dust.ring(this.end, 0.9, 6, 0.7, 0xd9c9a8);
      this.bits.pop(this.v2.copy(this.end).setY(0.5), 12, 5, 1);
      if (ctx) this.land(ctx);
    }
    if (f.landed) {
      const a = t - ARRIVE;
      this.sword.place(this.v2.set(this.end.x + this.dir.z * 0.4, 1.0, this.end.z - this.dir.x * 0.4), this.yaw, 0.4 - 0.3 * Math.min(1, a / 0.2), 0);
      if (a > 0.45) this.sword.hide();
      const sp = StarBurst.pop(a, 0.05, 0.16);
      this.star.set(this.v2.set(this.end.x + this.dir.x * 0.5, 1.0, this.end.z + this.dir.z * 0.5), 1.6 * sp.scale, sp.opacity, a * 5);
      const rp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.ring.set(this.end, 0.4 + 1.8 * rp, 0.6 * (1 - rp) * (1 - rp));
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The hits, on live positions inside the lane he really ran. */
  private land(ctx: CastContext) {
    const lane: TelegraphShape = { kind: 'line', x1: this.start.x, z1: this.start.z, x2: this.end.x, z2: this.end.z, width: CHARGE_WIDTH };
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(lane, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 4, from: this.v2.copy(this.end).addScaledVector(this.dir, -1.5), color: TWINS_CSS.pim });
    }
  }
}

export const pimChargeModule: EffectModule = {
  label: 'pim charge',
  category: 'hero: twins',
  // A rush toward the aim: the radius only sizes the aim marker.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PimCharge(),
  telegraphs(effect) {
    const e = effect as PimCharge;
    if (!e.ctx) return [];
    return [{ shape: e.lane, start: 0, impact: ARRIVE }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PimCharge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PimCharge).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
