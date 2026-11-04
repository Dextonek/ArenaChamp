import * as THREE from 'three';
import { Emitter } from '../../emitter';
import type { Enemy } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { ChalkDashes, Flecks, Gloves, MIME, MIME_CSS, ScarfTail } from '../../effects/parts/mime';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ROPE_DAMAGE, ROPE_PULL, ROPE_PULL_TIME, ROPE_RANGE, ROPE_SLACK, ROPE_WIND } from '../../traits/mime';

/**
 * Rope Trick (mime kit v5, E: a pull). A click on the enemy (7 m, sight checked at the cast). There is no rope to see: Mum mimes
 * one, two white gloves going hand over hand in the air, one reaching out as the other draws in, her red scarf tail streaming
 * behind her, while a dashed chalk line on the floor runs from the enemy to her and marches toward her with each pull. A red
 * circle on the enemy is the telegraph (read live). At 0.5 s (`ROPE_WIND`) she heaves: if she still sees the enemy
 * (`stillSees`, her own walls count as cover) and it is no more than `ROPE_RANGE + ROPE_SLACK` (9.2 m) from her, the rope has it:
 * 30 damage (`projectile: true`, judged on its live position) and it is pulled 3 m toward her over 0.3 s, stopping 1 m short of her
 * (`ctx.carry` every frame, on its live position; offline it moves the enemy hero, online only this side's own hero; where there is
 * no `carry` the hit's `pull` does it). A step behind cover before the heave frees it: the rope goes slack, the chalk breaks into
 * chips and falls, no damage. A chalk star pops at the enemy's feet on a catch. No word. Clean by 1.6 s.
 * See pipeline/designs/kit-mime.md.
 */
export interface RopeTrickSettings {
  damage: number;
  pull: number;
  loop: boolean;
}

export const defaultRopeTrick = (): RopeTrickSettings => ({ damage: ROPE_DAMAGE, pull: ROPE_PULL, loop: false });

// Timeline (seconds).
const PULL_END = ROPE_WIND + ROPE_PULL_TIME;
const DURATION = PULL_END + 0.9;
const STOP_SHORT = 1;
const TELE_R = 1;

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 2;

export class RopeTrick implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RopeTrickSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The enemy it is aimed at, and where it is now (the telegraph reads these every frame). */
  target: Enemy | null = null;
  readonly markAt = new THREE.Vector3();
  readonly fromAt = new THREE.Vector3();
  private time = 0;
  private flags = { heaved: false };
  private caught = false;
  private total = 0;
  private prevK = 0;
  private marchT = 0;

  private chalk = new ChalkDashes(60);
  private flecks = new Flecks(70);
  private gloves = new Gloves(2);
  private scarf = new ScarfTail(0.9, 0.18);
  private star = new StarBurst({ points: 8, inner: 0.3, color: MIME.chalk, core: MIME.dark, additive: false });
  private starAge = 9;
  private starPos = new THREE.Vector3();

  private dir = new THREE.Vector3(0, 0, 1);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: RopeTrickSettings = defaultRopeTrick()) {
    this.settings = settings;
    this.group.add(this.chalk.mesh, this.flecks.mesh, this.gloves.mesh, this.scarf.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ROPE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.markAt.copy(ctx.targetPos[0] ?? ctx.point);
    this.fromAt.copy(ctx.from);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.heaved = false;
    this.caught = false;
    this.total = 0;
    this.prevK = 0;
    this.marchT = 0;
    this.starAge = 9;
    this.star.set(this.starPos, 0, 0);
    this.chalk.clear();
    this.chalk.setOpacity(0);
    this.flecks.reset();
    this.gloves.reset();
    this.scarf.hide();
  }

  /** Redraws the dashes from `from` to the enemy, shifted `off` m toward her so they march. */
  private lay(off: number) {
    const a = this.fromAt, b = this.markAt;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    this.chalk.clear();
    // From the enemy's end toward her; the shift moves the pattern her way.
    const s = Math.min(off, l);
    this.chalk.add(b.x - (dx / l) * s, b.z - (dz / l) * s, a.x + (dx / l) * 0.6, a.z + (dz / l) * 0.6, 0.34, 0.26, 0.09);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (!ctx) return;
    if (t >= DURATION && !this.flecks.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const caster = ctx.caster.group.position;
    const e = this.target;
    // The telegraph's anchors, live: her feet and the enemy's, until the heave.
    if (!f.heaved) {
      this.fromAt.set(caster.x, 0, caster.z);
      if (e) this.markAt.set(e.group.position.x, 0, e.group.position.z);
    }
    this.dir.set(this.markAt.x - this.fromAt.x, 0, this.markAt.z - this.fromAt.z);
    const dist = this.dir.length();
    if (dist > 1e-4) this.dir.divideScalar(dist); else this.dir.set(0, 0, 1);
    const yaw = Math.atan2(this.dir.x, this.dir.z);

    // --- The hands: hand over hand, one reaching out while the other draws in. After the heave they hold, then let go. ---
    const phase = t * 9;
    const own = t < PULL_END + 0.25;
    if (own) {
      const out = (x: number) => 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(x));
      for (let i = 0; i < 2; i++) {
        const x = f.heaved ? 0 : phase + i * Math.PI;
        const reach = f.heaved ? 0.3 : out(x);
        this.gloves.place(i, this.v1.set(caster.x + this.dir.x * reach - this.dir.z * (i ? 0.18 : -0.18), 1.25 - 0.1 * i, caster.z + this.dir.z * reach + this.dir.x * (i ? 0.18 : -0.18)), yaw, Math.min(1, t * 8), 0.9, 0.2);
      }
      this.scarf.set(this.v2.set(caster.x, 1.45, caster.z), -this.dir.x, -this.dir.z, t, f.heaved ? 1 : 0.35 + 0.5 * (t / ROPE_WIND));
    } else {
      const o = 1 - Math.min(1, (t - PULL_END - 0.25) / 0.3);
      this.gloves.place(0, this.v1.set(caster.x + this.dir.x * 0.3, 1.25, caster.z + this.dir.z * 0.3), yaw, o, 0.5, 0.2);
      this.gloves.place(1, this.v1.set(caster.x + this.dir.x * 0.3 + 0.1, 1.15, caster.z + this.dir.z * 0.3), yaw, o, 0.5, 0.2);
      if (o <= 0) { this.gloves.reset(); this.scarf.hide(); } else this.scarf.set(this.v2.set(caster.x, 1.45, caster.z), -this.dir.x, -this.dir.z, t, 0.3 * o);
    }

    // --- The chalk line marches toward her with every pull; after the heave it breaks up. ---
    if (!f.heaved) {
      this.marchT = (this.marchT + dt * 1.6) % 0.6;
      this.lay(this.marchT);
      this.chalk.setOpacity(0.85 * Math.min(1, t / 0.1));
      if (t > 0.1 && Math.random() < dt * 22 && dist > 1) {
        const k = Math.random();
        this.flecks.line(this.v1.set(this.fromAt.x + this.dir.x * (0.8 + k * (dist - 0.8)), 0.1, this.fromAt.z + this.dir.z * (0.8 + k * (dist - 0.8))), this.v2.copy(this.v1).setY(0.3), 1, 0.7);
      }
    }

    // --- The heave: the rope has the enemy, or it has slipped. ---
    if (!f.heaved && t >= ROPE_WIND) {
      f.heaved = true;
      const tp = e?.group.position;
      const reach = !!tp && Math.hypot(tp.x - caster.x, tp.z - caster.z) <= ROPE_RANGE + ROPE_SLACK;
      this.caught = !!(e && tp && reach && stillSees(ctx, tp));
      if (this.caught && e && tp) {
        ctx.hit(e, {
          damage: this.settings.damage, knock: 0, from: new THREE.Vector3(caster.x, 0, caster.z), color: MIME_CSS.chalk, projectile: true,
          // No carry in this context: the hit drags it (a pull stops 1 m short of her, 4 m at most).
          ...(ctx.carry ? {} : { pull: Math.min(4, this.settings.pull) }),
        });
        this.total = Math.max(0, Math.min(this.settings.pull, Math.hypot(tp.x - caster.x, tp.z - caster.z) - STOP_SHORT));
        this.starPos.set(tp.x, 0.6, tp.z);
        this.starAge = 0;
        this.flecks.burst(this.v1.set(tp.x, 0.4, tp.z), 14, 4, 1.1);
        this.shake = 0.2;
        // The chalk line snaps taut and stays through the pull.
        this.lay(0);
        this.chalk.setOpacity(0.95);
      } else {
        // It slips: the line breaks into chips and falls.
        this.chalk.setOpacity(0);
        for (let i = 0; i < 6; i++) {
          const k = (i + 0.5) / 6;
          this.flecks.burst(this.v1.set(this.fromAt.x + this.dir.x * (0.8 + k * Math.max(0, dist - 0.8)), 0.5, this.fromAt.z + this.dir.z * (0.8 + k * Math.max(0, dist - 0.8))), 3, 1.6, 0.9, 0.2);
        }
      }
    }

    // --- The pull: carried toward her along the live line, eased like a yank. ---
    if (f.heaved && this.caught && e && t < PULL_END + 0.05) {
      const p = e.group.position;
      const dx = caster.x - p.x, dz = caster.z - p.z, d = Math.hypot(dx, dz);
      const k = THREE.MathUtils.clamp((t - ROPE_WIND) / ROPE_PULL_TIME, 0, 1);
      const want = this.total * (ease(k) - ease(this.prevK));
      this.prevK = k;
      const step = Math.min(want, d - STOP_SHORT);
      if (ctx.carry && step > 1e-4 && d > 1e-4) ctx.carry(e, this.v3.set((dx / d) * step, 0, (dz / d) * step));
      if (d > 1e-3 && Math.random() < dt * 40) this.flecks.burst(this.v1.set(p.x - (dx / d) * 0.5, 0.1, p.z - (dz / d) * 0.5), 1, 1.4, 0.8, 0.3);
      // The chalk line runs from the enemy to her and shortens with it.
      this.fromAt.set(caster.x, 0, caster.z);
      this.markAt.set(p.x, 0, p.z);
      this.lay(0);
    }
    if (f.heaved && t >= PULL_END) {
      const o = 1 - Math.min(1, (t - PULL_END) / 0.4);
      this.chalk.setOpacity(this.caught ? 0.9 * o : 0);
    }

    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.22);
    this.star.set(this.starPos, 1.8 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 10);
  }
}

export const ropeTrickModule: EffectModule = {
  label: 'rope trick',
  category: 'hero: mime',
  targeting: { mode: 'enemy' },
  create: () => new RopeTrick(),
  telegraphs(effect) {
    const e = effect as RopeTrick;
    if (!e.ctx) return [];
    // The mark on the enemy, read live until the heave: she is rooted until then. (The chalk line to it is only drawn, not a hit shape.)
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: TELE_R }, start: 0, impact: ROPE_WIND }];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as RopeTrick;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RopeTrick).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'pull', 0, 4, 0.1);
  },
};
