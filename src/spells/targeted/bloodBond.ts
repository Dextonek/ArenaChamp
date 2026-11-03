import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodSigil, BloodTendril, BloodThorns, ShockRefraction, StarBurst, clearScreenFx,
  createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BOND_RIPEN, BOND_WINDOW, bloodBonds, type BloodBond } from '../../traits/blood';

/**
 * Blood Bond (blood kit, R: mark, then pop). A thread of blood shoots from Vesper's palm to the enemy and a bone sigil
 * draws itself on the ground under them, following them; it turns slowly and swells as she wounds them. The mark is
 * the effect's state (`bloodBonds`, keyed by her figure, `src/traits/blood.ts`): the trait tallies the damage she deals
 * the enemy hero while it stands and its recast (`replay: false`, window 3.8 s) asks for the pop; this effect pops it
 * once the mark has ripened for 1.5 s, or at the timeout (3.7 s, inside the duel's 4.2 s window). The pop is 60 plus 50% of the
 * tally, a hit that skips the zone check like a bolt (`projectile: true`: it homes in on the mark):
 * thorns burst from the ground under the enemy, drops drain back to her, an impact frame lands. Online, the other
 * screen's trait gets no hit reports (`tracked` stays false), so there the pop deals a flat 90 at the timeout. Clean by 4.4 s.
 */
export interface BloodBondSettings {
  /** Share of the damage dealt since the mark that the pop deals. */
  share: number;
  /** What the pop deals on top of the share. */
  base: number;
  /** The pop's damage when no hits were reported (the other screen of a network duel). */
  flat: number;
  loop: boolean;
}

export const defaultBloodBond = (): BloodBondSettings => ({ share: 0.5, base: 60, flat: 90, loop: false });

// Timeline (seconds).
const MARK_T = 0.3; // the thread lands, the sigil draws on
const TIMEOUT = BOND_WINDOW - 0.1; // the mark pops by itself
const END_AFTER = 0.7; // clean-up after the pop
const DURATION = TIMEOUT + END_AFTER;
const DRAIN_DROPS = 6;

export class BloodBondFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BloodBondSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { marked: false, popped: false, ripe: false, shattered: false };
  private popT = -1;
  private owner: object | null = null;
  private bond: BloodBond = { live: false, tally: 0, pop: false, tracked: false };
  private feet = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private chest = new THREE.Vector3(0, 1.2, 0);
  private arrivals: number[] = [];
  private ripeAt = -1;

  private sigil = new BloodSigil({ color: 0xf2dcb4 });
  private thread = new BloodTendril({ segments: 20 });
  private crown = new BloodThorns({ maxSpikes: 14, maxFlakes: 64 });
  private drops = new BloodDrops({ maxSplats: 8 });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: BLOOD.hot, core: BLOOD.bone, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: BloodBondSettings = defaultBloodBond()) {
    this.settings = settings;
    this.screen.impactColor.set(BLOOD.bone);
    this.thread.width = 0.09;
    this.thread.bead = 0;
    this.thread.wobble = 0.03;
    this.thread.setFunction((u, out) => this.threadPath(u, out));
    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.2;
    this.drops.onArrive = () => this.arrivals.push(this.time);
    this.group.add(this.sigil.mesh, this.thread.mesh, this.crown.mesh, this.drops.mesh, this.star.mesh, this.flare.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return MARK_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const e = ctx.targets[0];
    this.feet.copy(e ? e.group.position : ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((t) => t.group)];
    this.screen.focus.copy(this.feet).setY(1.1);
    this.follow();
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Open the mark at once: the trait counts damage from now, and a recast before the thread lands waits for it to ripen.
    this.owner = ctx.caster;
    this.bond = { live: true, tally: 0, pop: false, tracked: false };
    bloodBonds.set(this.owner, this.bond);
  }

  private reset() {
    if (this.owner && bloodBonds.get(this.owner) === this.bond) {
      this.bond.live = false;
      bloodBonds.delete(this.owner);
    }
    this.owner = null;
    this.time = 0;
    this.shake = 0;
    this.popT = -1;
    this.ripeAt = -1;
    this.arrivals.length = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.thread.reset();
    this.crown.reset();
    this.drops.reset();
    this.star.set(this.feet, 0, 0);
    this.flare.set(this.feet, 0, 0);
    this.shock.set(this.feet, 0, 0);
  }

  /** Reads her palm and the marked enemy's feet and chest from the live figures. */
  private follow() {
    const ctx = this.ctx;
    if (!ctx) return;
    const c = ctx.caster.group.position;
    this.hand.set(c.x, 1.4, c.z);
    const e = ctx.targets[0];
    if (e) this.feet.set(e.group.position.x, 0, e.group.position.z);
    this.chest.set(this.feet.x, 1.2, this.feet.z);
  }

  /** The thread from her palm to the enemy's chest: a slow sag, so it reads as a cord, not a beam. */
  private threadPath(u: number, out: THREE.Vector3) {
    out.lerpVectors(this.hand, this.chest, u);
    out.y += Math.sin(Math.PI * u) * (0.35 + 0.1 * Math.sin(this.time * 6 + u * 5));
    return out;
  }

  /** The pop's damage: a share of what she dealt since the mark (a flat sum where no hits were reported). */
  private popDamage() {
    const s = this.settings;
    return this.bond.tracked ? s.base + Math.round(this.bond.tally * s.share) : s.flat;
  }

  private pop() {
    const f = this.flags;
    f.popped = true;
    this.popT = this.time;
    // Close the mark first so the pop's own damage is not counted into it.
    this.bond.live = false;
    const ctx = this.ctx;
    this.follow();
    this.crown.erupt(this.feet, 1.2, 9, 1.3, { tilt: 0.45, stagger: 0.1, grow: 0.15 });
    this.drops.spray(this.chest, this.up, 14, 6, 0.8);
    this.drops.drain(this.chest, (out) => out.copy(this.hand), DRAIN_DROPS, { stagger: 0.03, duration: 0.4, radius: 0.08, spread: 0.35 });
    this.shake = 0.35;
    const e = ctx?.targets[0];
    if (ctx && e) {
      ctx.hit(e, { damage: this.popDamage(), knock: 3, from: ctx.caster.group.position, color: BLOOD_CSS.body, projectile: true });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
    this.crown.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      clearScreenFx(this.screen);
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    this.follow();

    if (!f.marked && t >= MARK_T) {
      f.marked = true;
      this.drops.spray(this.chest, this.up, 6, 3, 0.6);
    }
    // Ripe: she may pop it now (a flash on the sigil tells).
    if (f.marked && !f.popped && !f.ripe && t >= BOND_RIPEN) {
      f.ripe = true;
      this.ripeAt = t;
    }
    if (f.marked && !f.popped && ((this.bond.pop && f.ripe) || t >= TIMEOUT)) this.pop();
    if (f.popped && !f.shattered && t >= this.popT + 0.5) {
      f.shattered = true;
      this.crown.shatter(4, 4, 0.4);
    }
    this.shake *= Math.exp(-dt * 10);
    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = f.popped ? t - this.popT : -1;

    // --- The thread: shoots out to the enemy, holds (breathing) until the pop, then snaps back into her palm. ---
    const out = smoothstep(t / MARK_T);
    this.thread.head = out;
    this.thread.tail = f.popped ? smoothstep(after / 0.25) : 0;
    this.thread.width = f.popped ? 0.09 : 0.08 + 0.02 * Math.sin(t * 9);
    this.thread.update(t);

    // --- The sigil: draws on under the enemy, turns, swells with the damage tally, flashes when ripe, fills at the pop. ---
    const swell = 1 + Math.min(0.5, this.bond.tally / 160);
    this.sigil.set(this.v1.copy(this.feet).setY(0.04), this.up, 1.1 * swell, t * 0.7);
    this.sigil.reveal = smoothstep((t - 0.1) / (MARK_T - 0.1));
    this.sigil.opacity = f.popped ? 1 - smoothstep(after / 0.4) : 1;
    const rp = this.ripeAt >= 0 && !f.popped ? StarBurst.pop(t - this.ripeAt, 0, 0.05) : { scale: 0, opacity: 0 };
    this.flare.set(this.v2.copy(this.feet).setY(0.1), 1.4 * rp.scale, rp.opacity, t * 2);

    // --- The pop: bone-card impact frame, accent star, ground refraction, shake. ---
    this.screen.impact = f.popped ? impactFrameAt(t, this.popT, [1], 0.03) : 0;
    if (f.popped) {
      const sp = StarBurst.pop(after - 0.03, 0, 0.015);
      this.star.set(this.v1.copy(this.feet).setY(1.1), 1.2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.shock.set(this.feet, 0.4 + 2.4 * gp, 0.035 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake, 0.35 * Math.exp(-after * 14));
    }
  }
}

export const bloodBondModule: EffectModule = {
  label: 'blood bond',
  category: 'hero: blood',
  targeting: { mode: 'enemy' },
  create: () => new BloodBondFx(),
  // No zone: the mark cannot be dodged once it is on, and the pop is a homing hit.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BloodBondFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BloodBondFx).settings;
    f.add(s, 'loop');
    f.add(s, 'share', 0.1, 1, 0.05);
    f.add(s, 'base', 0, 150, 1);
    f.add(s, 'flat', 0, 150, 1);
  },
};
