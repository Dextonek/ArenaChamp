import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { BLOOD, BLOOD_CSS, BloodDrops, BloodSigil, BloodTendril, ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ChannelBar, channelBroken, stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FEAST_SECONDS, bloodDrawn } from '../../traits/blood';

/**
 * Sanguine Feast (blood kit v5, R: a 1.6 s channel). Click an enemy within 8 m (the engine checks sight at the cast). She
 * is rooted for `FEAST_SECONDS` (1.6 s: the trait's `afterCast` calls `t.hold`, and the red circle on the enemy lasts as
 * long) and a bone sigil spreads under her; a ring at her feet empties as it runs (`ChannelBar`) and a thread of blood runs
 * from her hand to the enemy. Pulses at 0.4, 1.0 and 1.6 s (`PULSE_AT`): 35, 35 and then 40 plus 20% of the enemy's missing
 * HP, every hit `projectile: true` (judged on the live position: the channel is the catch) and `knock: 0`, no drag. The
 * engine gives a spell no target HP, so the missing HP is what she has dealt the enemy this round (`bloodDrawn`, written by
 * the trait's `dealt`), capped at `MISSING_CAP`. The blood runs back to her on every pulse and the third heals her 60
 * (`ctx.healSelf`; it is not gated on the hit, as the engine tells her screen nothing of the victim's `taken`): the Feast is
 * how she gets her blood back, Hungry or not (the rework of 2026-11-12). The channel ends at once, `ctx.releaseCaster` frees her and the thread snaps
 * if a stun, silence or knock-up hits her (`channelBroken`), if the enemy is past 9 m (`BREAK`) or if she no longer sees
 * them (`stillSees`): the pulses not yet due do not happen. The third pulse has one impact frame, a ring and a kick. Costs
 * her twice the Price (the trait). Clean by 2.4 s.
 * Network duels: both screens replay the cast and run the same checks on live positions; only the victim's screen's hits
 * count and only her screen heals her (`ctx.healSelf` is not set on the other one).
 */
export interface SanguineFeastSettings {
  /** The first two pulses, the base of the third and the share of missing HP it adds. */
  pulse: number;
  finisher: number;
  missing: number;
  /** HP she gets from the third pulse. */
  heal: number;
  loop: boolean;
}

export const defaultSanguineFeast = (): SanguineFeastSettings => ({ pulse: 35, finisher: 40, missing: 0.2, heal: 60, loop: false });

// Timeline (seconds).
const PULSE_AT = [0.4, 1.0, FEAST_SECONDS];
const DURATION = FEAST_SECONDS + 0.8;
const BREAK = 9; // the channel ends with the enemy past this
const MARK_R = 1.3; // the red circle on the enemy
const MISSING_CAP = 600;
const CHEST = 1.2;

const UP = new THREE.Vector3(0, 1, 0);

export class SanguineFeast implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SanguineFeastSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private struck = 0;
  private endAt = -1;
  private broken = false;
  private foe = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private feet = new THREE.Vector3();
  private beat = -1;
  private popAt = -1;
  private popBig = false;
  private bar = new ChannelBar(BLOOD.hot, 1.5);

  // Parts.
  private sigil = new BloodSigil({ color: 0xf2dcb4 });
  private thread = new BloodTendril({ segments: 28 });
  private drops = new BloodDrops({ maxSplats: 8 });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private inShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SanguineFeastSettings = defaultSanguineFeast()) {
    this.settings = settings;
    this.screen.impactColor.set(BLOOD.hot);
    this.screen.tint.set(BLOOD.dark);
    this.thread.width = 0.2;
    this.thread.bead = 0;
    this.thread.wobble = 0.04;
    this.drops.splatScale = 0.6;
    this.drops.splats.life = 1.2;
    this.group.add(this.sigil.mesh, this.bar.mesh, this.thread.mesh, this.drops.mesh, this.star.mesh, this.shock.mesh, this.inShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_AT[2];
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.feet.copy(ctx.from).setY(0);
    this.liveFoe();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.struck = 0;
    this.endAt = -1;
    this.broken = false;
    this.beat = -1;
    this.popAt = -1;
    this.bar.set(this.feet, 0);
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.thread.reset();
    this.drops.reset();
    this.star.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
    this.inShock.set(this.feet, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
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
    this.liveFoe();
    if (ctx) {
      const p = ctx.caster.group.position;
      this.feet.set(p.x, 0, p.z);
      this.hand.set(p.x, 1.3, p.z);
    }

    // The channel holds while nothing stuns or silences her, the enemy is within 9 m and she sees them.
    if (ctx && this.endAt < 0) {
      const me = ctx.caster.group.position;
      const away = Math.hypot(me.x - this.foe.x, me.z - this.foe.z) > BREAK;
      if (channelBroken(ctx) || away || !stillSees(ctx, this.foe)) this.breakOff(ctx);
    }
    while (this.endAt < 0 && this.struck < PULSE_AT.length && t >= PULSE_AT[this.struck]) this.pulse(this.struck++);
    if (this.endAt < 0 && t >= PULSE_AT[2]) this.endAt = t; // it ran its course
    this.layout(dt);
  }

  /** A stun, silence, knock-up, cover or distance ends the channel now. */
  private breakOff(ctx: CastContext) {
    this.endAt = this.time;
    this.broken = true;
    ctx.releaseCaster?.();
    this.drops.spray(this.v1.copy(this.foe).setY(CHEST), UP, 8, 4, 0.9);
    this.shake = 0.12;
  }

  /** Pulse `k`: a hit on the live position, the blood runs home, and the third heals. */
  private pulse(k: number) {
    const ctx = this.ctx;
    const last = k === PULSE_AT.length - 1;
    this.beat = this.time;
    this.popAt = this.time;
    this.popBig = last;
    this.shake = last ? 0.4 : 0.14;
    this.v1.copy(this.foe).setY(CHEST);
    this.drops.drain(this.v1, (out) => out.copy(this.hand), last ? 12 : 6, { duration: 0.5, stagger: 0.03, radius: last ? 0.09 : 0.07 });
    this.drops.spray(this.v1, UP, last ? 12 : 5, last ? 6 : 4, 0.8);
    if (!ctx || !this.target) return;
    let damage = this.settings.pulse;
    if (last) {
      const missing = Math.min(MISSING_CAP, bloodDrawn.get(ctx.caster)?.total ?? 0);
      damage = this.settings.finisher + this.settings.missing * missing;
    }
    ctx.hit(this.target, { damage, knock: 0, from: this.hand.clone(), color: BLOOD_CSS.body, projectile: true });
    if (last) ctx.healSelf?.(this.settings.heal);
  }

  private layout(dt: number) {
    const t = this.time;
    const c = this.feet;
    const running = this.endAt < 0;
    const after = this.endAt >= 0 ? t - this.endAt : -1;

    // --- The screen dims while she drinks; one impact frame on the third pulse. ---
    const up = smoothstep(t / 0.3) * (1 - smoothstep(after / 0.4));
    this.screen.darken = 0.3 * up;
    this.screen.impact = this.broken || this.struck < 3 ? 0 : impactFrameAt(t, PULSE_AT[2], [1], 0.03);
    this.screen.focus.copy(this.foe).setY(1.2);

    // --- The channel bar empties over the 1.6 s and goes when the channel ends. ---
    this.bar.set(c, running ? Math.max(0, 1 - t / FEAST_SECONDS) : 0);

    // --- The sigil spreads under her and fades when it ends. ---
    this.sigil.set(this.v1.copy(c).setY(0.04), UP, 1.8, t * 0.5);
    this.sigil.reveal = smoothstep(t / 0.35);
    this.sigil.opacity = 0.9 * (1 - smoothstep(after / 0.5));

    // --- The thread from her hand to them: it throbs on each pulse and snaps when the channel ends early. ---
    const since = this.beat >= 0 ? t - this.beat : 1;
    const kick = Math.exp(-since * 9);
    this.thread.width = 0.2 + 0.12 * kick;
    this.thread.setFunction((k, out) => {
      out.lerpVectors(this.hand, this.v2.copy(this.foe).setY(CHEST), k);
      out.y += Math.sin(k * Math.PI) * 0.3;
      return out;
    });
    this.thread.head = smoothstep(t / 0.25);
    this.thread.tail = after >= 0 ? smoothstep(after / (this.broken ? 0.15 : 0.4)) : 0;
    this.thread.update(t);

    // --- The pop on the enemy at each pulse, a ring on the third and the kick of the finisher. ---
    if (this.popAt >= 0) {
      const k = t - this.popAt;
      const sp = StarBurst.pop(k, 0, this.popBig ? 0.06 : 0.03);
      this.star.set(this.v1.copy(this.foe).setY(CHEST), (this.popBig ? 1.8 : 0.9) * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(k / (this.popBig ? 0.45 : 0.3), 0, 1);
      this.shock.set(this.foe, 0.4 + (this.popBig ? 2.6 : 1.4) * gp, (this.popBig ? 0.035 : 0.02) * (1 - gp) * (1 - gp));
    }
    // A ring closes in on her as it begins, so the drink reads.
    if (t < 0.5) {
      const k = t / 0.5;
      this.inShock.set(c, 4 * (1 - k) + 0.8, 0.02 * Math.sin(Math.PI * k));
    } else this.inShock.set(c, 0, 0);
    this.shake *= Math.exp(-dt * 9);
  }
}

export const sanguineFeastModule: EffectModule = {
  label: 'sanguine feast',
  category: 'hero: blood',
  // Click an enemy: three pulses that always land (`projectile`) while the channel holds; the channel is the catch.
  targeting: { mode: 'enemy' },
  create: () => new SanguineFeast(),
  telegraphs(effect) {
    const e = effect as SanguineFeast;
    if (!e.ctx) return [];
    // The mark on the enemy for as long as she is rooted, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: FEAST_SECONDS }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SanguineFeast;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SanguineFeast).settings;
    f.add(s, 'loop');
    f.add(s, 'pulse', 1, 100, 1);
    f.add(s, 'finisher', 1, 150, 1);
    f.add(s, 'missing', 0, 1, 0.01);
    f.add(s, 'heal', 0, 100, 1);
  },
};
