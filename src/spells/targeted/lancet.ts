import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { BLOOD, BLOOD_CSS, BloodDrops, BloodSigil, BloodTendril, BloodThorns, ShockRefraction, StarBurst } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Lancet (blood kit v5, Q: a needle, then the rip on the recast; `src/traits/blood.ts` is the rules). Click an enemy within
 * 7 m (the engine checks sight at the cast). Cast: a crystal needle forms at her hand and flies to the enemy in 0.4 s while a
 * red circle shows on them (the warning). At 0.4 s the spell checks itself: with `stillSees` false or the enemy past
 * `REACH` (8 m) the needle shatters short of them and nothing hits (a fizzle). Otherwise it sinks into the chest and stays:
 * 40 damage (`projectile: true`, judged on the live position, so it cannot be walked out of; the red circle is the warning)
 * and a bone sigil under them. The needle stays in for 3 s as a blood pip on the enemy (the trait's `dealt`), and the first
 * cast costs her 20 HP (`castMods`).
 * Recast (the Rip, free, opens 1 s after the cast and stays open to 3 s; the trait's `recast`, `arm: 1`): a thread of
 * blood runs from the needle to her hand; at 0.3 s, if the first cast struck, `stillSees` and the enemy is within 8 m, the
 * needle is torn out and flies home: 35 damage, the pip goes, and she gets the 20 HP back when the hit lands (the trait's
 * `landed`). Otherwise the thread snaps and the rip fizzles. The effect tells the two casts apart itself: a cast of the same
 * figure within 3.3 s of an unripped first cast is the rip (a clock per figure, so the other screen of a network duel, which
 * replays both casts, agrees; the `mode` setting forces one). Clean by 1.4 s (the rip 1.0 s).
 * Network duels: the hit is decided on the victim's screen, where both casts are replayed; the sight and range checks run
 * on live positions on both screens and only the victim's screen's hit counts.
 */
export interface LancetSettings {
  /** The needle's hit and the rip's hit. */
  damage: number;
  ripDamage: number;
  /** 'auto' reads the recast clock; 'needle' / 'rip' force a variant (the tool's play button). */
  mode: 'auto' | 'needle' | 'rip';
  loop: boolean;
}

export const defaultLancet = (): LancetSettings => ({ damage: 36, ripDamage: 26, mode: 'auto', loop: false });

// Timeline (seconds).
const HIT_T = 0.4; // the needle arrives
const RIP_T = 0.3; // the rip is torn out
const HOME_S = 0.25; // the torn-out needle flies home
const DURATION = 1.4;
const RIP_DURATION = 1.0;
const REACH = 8; // the needle and the rip need the enemy this close
const MARK_R = 1.1; // the red circle on the enemy
const RECAST_CLOCK = 3300; // ms: a cast inside this after an unripped first cast is the rip
const CHEST = 1.1;
const NEEDLE_LEN = 1.1;
const NEEDLE_W = 0.24;

interface CastRecord { at: number; rip: boolean; struck: boolean }
/** When each caster figure last cast Lancet, whether that was the rip, and whether the needle struck. */
const casts = new WeakMap<object, CastRecord>();

const UP = new THREE.Vector3(0, 1, 0);

export class Lancet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LancetSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the rip. */
  rip = false;
  private target: Enemy | null = null;
  private rec: CastRecord | null = null;
  private hadNeedle = true;
  private time = 0;
  private done = { hit: false, home: false, end: false };
  /** The needle struck (first cast) or the rip took hold (the rip). */
  private landed = false;
  private hitAt = -1;
  private foe = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private chest = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private spike = -1;

  // Parts.
  private thorns = new BloodThorns({ maxSpikes: 4, maxFlakes: 60 });
  private crown = new BloodThorns({ maxSpikes: 8, maxFlakes: 40 });
  private thread = new BloodTendril({ segments: 24 });
  private drops = new BloodDrops({ maxSplats: 6 });
  private sigil = new BloodSigil({ color: 0xf2dcb4, inner: false });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: LancetSettings = defaultLancet()) {
    this.settings = settings;
    this.thread.width = 0.16;
    this.thread.bead = 0;
    this.thread.wobble = 0.03;
    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.2;
    this.group.add(this.sigil.mesh, this.thorns.mesh, this.crown.mesh, this.thread.mesh, this.drops.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return this.rip ? RIP_DURATION : DURATION;
  }

  get impactTime() {
    return this.rip ? RIP_T : HIT_T;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    const now = performance.now();
    const prev = casts.get(ctx.caster);
    const auto = !!prev && !prev.rip && now - prev.at < RECAST_CLOCK;
    const m = this.settings.mode;
    this.rip = m === 'rip' || (m === 'auto' && auto);
    // The rip finds the needle only if the first cast struck (a forced rip in the tool assumes it did).
    this.hadNeedle = this.rip ? (prev && m === 'auto' ? prev.struck : true) : false;
    this.rec = { at: now, rip: this.rip, struck: false };
    casts.set(ctx.caster, this.rec);
    this.liveFoe();
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    this.liveHand();
    if (this.rip) {
      // The needle stands in the chest where the first cast left it; a thread runs from it to her hand.
      this.landed = this.hadNeedle;
      if (this.hadNeedle) this.spike = this.thorns.spike(this.v1.copy(this.chest), this.dir, NEEDLE_LEN, NEEDLE_W, 0);
    } else {
      this.spike = this.thorns.spike(this.v1.copy(this.hand), this.dir, NEEDLE_LEN, NEEDLE_W, 0.12);
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.hitAt = -1;
    this.spike = -1;
    this.done.hit = this.done.home = this.done.end = false;
    this.thorns.reset();
    this.crown.reset();
    this.thread.reset();
    this.drops.reset();
    this.sigil.reset();
    this.star.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
    this.chest.copy(this.foe).setY(CHEST);
  }

  /** Her hand: a little in front of the caster at chest height. */
  private liveHand() {
    const c = this.ctx;
    if (!c) return;
    const p = c.caster.group.position;
    this.hand.set(p.x, 1.25, p.z);
    this.dir.subVectors(this.chest, this.hand);
    if (this.dir.lengthSq() < 1e-4) this.dir.set(0, 0, 1);
    this.dir.normalize();
    this.hand.addScaledVector(this.dir, 0.5);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.thorns.update(dt);
    this.crown.update(dt);
    this.drops.update(dt);
    this.time += dt;
    if (this.time >= this.duration) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    this.liveFoe();
    this.liveHand();
    if (this.rip) this.updateRip(this.time);
    else this.updateNeedle(this.time);
    this.layout(dt);
  }

  /** The first cast: the needle flies, then checks itself and sinks in or shatters short. */
  private updateNeedle(t: number) {
    if (!this.done.hit) {
      const u = Math.min(1, t / HIT_T);
      // Flies tip first along hand -> chest and ends with its tip just through the chest.
      this.v2.copy(this.chest).addScaledVector(this.dir, -(NEEDLE_LEN - 0.15));
      this.v1.lerpVectors(this.hand, this.v2, u * u);
      this.thorns.place(this.spike, this.v1, this.dir, NEEDLE_LEN);
      this.thread.setFunction((k, out) => {
        out.lerpVectors(this.hand, this.v1, k);
        out.y += Math.sin(k * Math.PI) * 0.12;
        return out;
      });
      this.thread.head = 1;
      this.thread.update(t);
    }
    if (!this.done.hit && t >= HIT_T) {
      this.done.hit = true;
      this.strike();
    }
    if (this.done.hit) {
      this.thread.tail = smoothstep((t - HIT_T) / 0.2);
      this.thread.update(t);
      // The needle stays in the chest and follows them.
      if (this.landed) {
        this.v1.copy(this.chest).addScaledVector(this.dir, -(NEEDLE_LEN - 0.15));
        this.thorns.place(this.spike, this.v1, this.dir, NEEDLE_LEN);
      }
    }
    if (!this.done.end && t >= DURATION - 0.35) {
      this.done.end = true;
      this.thorns.shatter(3, 3, 0.4);
    }
  }

  /** The needle's check at 0.4 s. */
  private strike() {
    const ctx = this.ctx;
    const me = ctx?.caster.group.position;
    const ok = !!ctx && !!this.target && !!me && stillSees(ctx, this.foe) && Math.hypot(me.x - this.foe.x, me.z - this.foe.z) <= REACH;
    this.hitAt = this.time;
    if (!ok || !ctx) {
      // Short of them: the needle breaks where it is.
      this.thorns.shatter(4, 4, 0.5);
      this.drops.spray(this.v2.copy(this.v1).setY(Math.max(0.4, this.v1.y)), UP, 6, 3, 0.7);
      return;
    }
    this.landed = true;
    if (this.rec) this.rec.struck = true;
    ctx.hit(this.target!, { damage: this.settings.damage, knock: 0, from: this.hand.clone(), color: BLOOD_CSS.body, projectile: true });
    this.crown.erupt(this.v2.copy(this.foe), 0.55, 5, 0.7, { tilt: 0.4, stagger: 0.05, grow: 0.12 });
    this.drops.spray(this.v2.copy(this.chest), this.dir, 10, 5, 0.7);
    this.shake = 0.14;
  }

  /** The recast: a thread from the needle to her hand; at 0.3 s it tears out or snaps. */
  private updateRip(t: number) {
    const drawn = smoothstep(t / 0.25);
    if (!this.done.hit) {
      // Root at the chest, tip at her hand: it runs out from the needle.
      this.thread.setFunction((k, out) => {
        out.lerpVectors(this.chest, this.hand, k);
        out.y += Math.sin(k * Math.PI) * 0.18;
        return out;
      });
      this.thread.head = drawn;
      this.thread.update(t);
      if (this.landed) {
        this.v1.copy(this.chest).addScaledVector(this.dir, -(NEEDLE_LEN - 0.15));
        this.thorns.place(this.spike, this.v1, this.dir, NEEDLE_LEN);
      }
    }
    if (!this.done.hit && t >= RIP_T) {
      this.done.hit = true;
      this.tear();
    }
    if (this.done.hit && this.landed) {
      // The needle flies home along the thread, the thread follows it in.
      const u = Math.min(1, (t - RIP_T) / HOME_S);
      this.thread.tail = smoothstep((t - RIP_T) / HOME_S);
      this.thread.update(t);
      if (!this.done.home) {
        this.v1.lerpVectors(this.chest, this.hand, u * u).addScaledVector(this.dir, -(NEEDLE_LEN - 0.15) * (1 - u));
        this.thorns.place(this.spike, this.v1, this.dir, NEEDLE_LEN);
        if (u >= 1) {
          this.done.home = true;
          this.thorns.shatter(4, 3, 0.4);
          this.hitAt = t;
        }
      }
    } else if (this.done.hit) {
      // The thread snaps: the free end whips away and is gone.
      this.thread.tail = smoothstep((t - RIP_T) / 0.15);
      this.thread.update(t);
    }
  }

  /** The rip's check at 0.3 s. */
  private tear() {
    const ctx = this.ctx;
    const me = ctx?.caster.group.position;
    const ok = this.hadNeedle && !!ctx && !!this.target && !!me && stillSees(ctx, this.foe) && Math.hypot(me.x - this.foe.x, me.z - this.foe.z) <= REACH;
    if (!ok || !ctx) {
      this.landed = false;
      this.thorns.shatter(4, 4, 0.5);
      this.drops.spray(this.v2.copy(this.chest), UP, 6, 3, 0.7);
      this.shake = 0.05;
      return;
    }
    this.hitAt = this.time;
    ctx.hit(this.target!, { damage: this.settings.ripDamage, knock: 0, from: this.hand.clone(), color: BLOOD_CSS.body, projectile: true });
    // The blood the needle held comes home to her hand.
    this.drops.drain(this.v2.copy(this.chest), (out) => out.copy(this.hand), 8, { duration: 0.4, stagger: 0.025, radius: 0.07 });
    this.drops.spray(this.v2.copy(this.chest), this.v1.copy(this.dir).negate(), 8, 5, 0.6);
    this.shake = 0.14;
  }

  private layout(dt: number) {
    const t = this.time;
    // --- The bone sigil under them where the needle struck or was torn out; it follows them. ---
    if (this.hitAt >= 0 && this.landed) {
      const k = t - this.hitAt;
      this.sigil.set(this.v1.copy(this.foe).setY(0.04), UP, 1.0, t * 0.8);
      this.sigil.reveal = smoothstep(k / 0.15);
      this.sigil.opacity = 1 - smoothstep((k - 0.35) / 0.4);
    }
    // --- The pop where it struck (or at her hand when the needle reaches home), and a ring on the ground. ---
    if (this.hitAt >= 0 && (this.landed || this.rip)) {
      const k = t - this.hitAt;
      const sp = StarBurst.pop(k, 0, 0.03);
      const at = this.rip && this.done.home && k < 0.3 ? this.hand : this.chest;
      this.star.set(this.v1.copy(at), 0.9 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(k / 0.3, 0, 1);
      this.shock.set(this.foe, 0.3 + 1.4 * gp, 0.02 * (1 - gp) * (1 - gp));
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const lancetModule: EffectModule = {
  label: 'lancet',
  category: 'hero: blood',
  // Click an enemy: the needle and the rip always land (`projectile`) once they pass their sight and reach check.
  targeting: { mode: 'enemy' },
  create: () => new Lancet(),
  telegraphs(effect) {
    const e = effect as Lancet;
    if (!e.ctx) return [];
    // The mark on the enemy while the needle flies or the thread runs, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Lancet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Lancet).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'ripDamage', 1, 150, 1);
    f.add(s, 'mode', ['auto', 'needle', 'rip']);
  },
};
