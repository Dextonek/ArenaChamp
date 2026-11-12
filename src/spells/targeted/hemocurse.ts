import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { BLOOD, BLOOD_CSS, BloodDrops, BloodSigil, BloodTendril, BloodThorns, ShockRefraction, StarBurst } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { hemocurses, type Hemocurse as CurseRecord } from '../../traits/blood';

/**
 * Hemocurse (blood kit v5, E: a curse that taxes spells). Click an enemy within 7 m (the engine checks sight at the cast).
 * A bone sigil draws itself under them and a thread of blood runs from her hand to them (0.6 s, with a red circle on the
 * enemy as the warning). At 0.6 s the spell checks itself: with `stillSees` false or the enemy past `REACH` (8 m) it
 * fizzles (the thread snaps, nothing hits). Otherwise a crown of crystal thorns closes round them and the curse is on for
 * 3 s (`CURSE_S`): 25 damage (`projectile: true`, judged on the live position) and a blood pip on the enemy (the trait's
 * `dealt`). While it holds the effect owns a record keyed by her figure (`hemocurses` in `src/traits/blood.ts`: `live`,
 * `until`): it sets `live` when the curse lands and each frame ends it, with the thorns shattering and the thread snapping,
 * if the 3 s are up, the enemy is past 8 m (`BREAK`) or she no longer sees them. The trait's `enemyCast` reads `live`: each
 * spell the enemy casts then costs them 20 HP and, if she is Hungry, heals her 15. The record is cleared on `reset()`.
 * Costs her 20 HP (the trait). Clean by 4.0 s (inside the duel's 4.2 s window).
 * Network duels: both screens replay the cast and run the same checks on live positions, so each has the same `live`;
 * only the victim's screen's hits and `hitEnemy` count, and only her screen heals her.
 */
export interface HemocurseSettings {
  damage: number;
  loop: boolean;
}

export const defaultHemocurse = (): HemocurseSettings => ({ damage: 25, loop: false });

// Timeline (seconds).
const HIT_T = 0.6; // the curse lands
const CURSE_S = 3; // how long it stays on
const DURATION = HIT_T + CURSE_S + 0.4;
const REACH = 8; // the curse lands within this, and breaks past it
const MARK_R = 1.2; // the red circle on the enemy
const CHEST = 1.2;

const UP = new THREE.Vector3(0, 1, 0);

export class Hemocurse implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HemocurseSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private rec: CurseRecord | null = null;
  private time = 0;
  private done = { hit: false, end: false };
  /** The curse has landed and is still on. */
  private on = false;
  private endAt = -1;
  private landedAt = -1;
  private foe = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private pulse = 0;

  // Parts.
  private sigil = new BloodSigil({ color: 0xf2dcb4 });
  private crown = new BloodThorns({ maxSpikes: 12, maxFlakes: 80 });
  private thread = new BloodTendril({ segments: 28 });
  private drops = new BloodDrops({ maxSplats: 6 });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HemocurseSettings = defaultHemocurse()) {
    this.settings = settings;
    this.thread.width = 0.16;
    this.thread.bead = 1.2;
    this.thread.wobble = 0.03;
    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.0;
    this.group.add(this.sigil.mesh, this.crown.mesh, this.thread.mesh, this.drops.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    // A fresh cast replaces the old curse at once.
    const rec = hemocurses.get(ctx.caster) ?? { live: false, until: 0 };
    rec.live = false;
    hemocurses.set(ctx.caster, rec);
    this.rec = rec;
    this.liveFoe();
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
  }

  private reset() {
    // A cast that stops (a new round, the tool's stop) never leaves the curse on.
    if (this.rec) this.rec.live = false;
    this.time = 0;
    this.shake = 0;
    this.on = false;
    this.endAt = -1;
    this.landedAt = -1;
    this.pulse = 0;
    this.done.hit = this.done.end = false;
    this.sigil.reset();
    this.crown.reset();
    this.thread.reset();
    this.drops.reset();
    this.star.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crown.update(dt);
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
      this.hand.set(p.x, 1.3, p.z);
    }

    if (!this.done.hit && t >= HIT_T) {
      this.done.hit = true;
      this.land();
    }
    if (this.on && ctx) {
      // The curse holds while she sees them, within 8 m, for 3 s.
      const me = ctx.caster.group.position;
      const gone = !stillSees(ctx, this.foe) || Math.hypot(me.x - this.foe.x, me.z - this.foe.z) > REACH;
      if (gone || t >= HIT_T + CURSE_S) this.end();
    }
    this.layout(dt);
  }

  /** The check at 0.6 s: the curse lands or the spell fizzles. */
  private land() {
    const ctx = this.ctx;
    const me = ctx?.caster.group.position;
    const ok = !!ctx && !!this.target && !!me && stillSees(ctx, this.foe) && Math.hypot(me.x - this.foe.x, me.z - this.foe.z) <= REACH;
    if (!ok || !ctx) {
      // The thread snaps and the sigil goes: nothing hits.
      this.endAt = this.time;
      this.drops.spray(this.v1.copy(this.foe).setY(1.0), UP, 6, 3, 0.8);
      return;
    }
    this.on = true;
    this.landedAt = this.time;
    if (this.rec) {
      this.rec.live = true;
      this.rec.until = HIT_T + CURSE_S;
    }
    ctx.hit(this.target!, { damage: this.settings.damage, knock: 0, from: this.hand.clone(), color: BLOOD_CSS.body, projectile: true });
    // The crown of thorns closes round them, and a pop on the chest.
    this.crown.erupt(this.v1.copy(this.foe), 0.9, 7, 0.9, { tilt: -0.25, stagger: 0.08, grow: 0.15 });
    this.drops.spray(this.v1.copy(this.foe).setY(CHEST), UP, 10, 5, 0.8);
    this.shake = 0.16;
  }

  /** The curse is over: the record goes, the thorns shatter and the thread snaps. */
  private end() {
    if (this.done.end) return;
    this.done.end = true;
    this.on = false;
    this.endAt = this.time;
    if (this.rec) this.rec.live = false;
    this.crown.shatter(3, 3.5, 0.5);
    this.drops.spray(this.v1.copy(this.foe).setY(CHEST), UP, 6, 3, 0.8);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = this.endAt >= 0 ? t - this.endAt : -1;

    // --- The sigil under them: draws on through the wind-up, stays while the curse is on, fades when it ends. ---
    const wind = smoothstep(t / HIT_T);
    this.sigil.set(this.v1.copy(this.foe).setY(0.04), UP, 1.5, t * 0.6);
    this.sigil.reveal = wind;
    this.sigil.opacity = (0.75 + 0.25 * this.pulse) * (after >= 0 ? 1 - smoothstep(after / 0.4) : 1);

    // --- The thread from her hand to them: grows through the wind-up, throbs while on, snaps when it ends. ---
    const growing = t < HIT_T ? smoothstep(t / (HIT_T * 0.8)) : 1;
    this.pulse = this.on ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
    this.thread.width = 0.16 + 0.04 * this.pulse;
    this.thread.setFunction((k, out) => {
      out.lerpVectors(this.hand, this.v2.copy(this.foe).setY(CHEST), k);
      out.y += Math.sin(k * Math.PI) * 0.25;
      return out;
    });
    this.thread.head = growing;
    this.thread.tail = after >= 0 ? smoothstep(after / 0.18) : 0;
    this.thread.update(t);

    // --- The pop and ring where the curse lands. ---
    if (this.landedAt >= 0) {
      const k = t - this.landedAt;
      const sp = StarBurst.pop(k, 0, 0.03);
      this.star.set(this.v1.copy(this.foe).setY(CHEST), 0.9 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(k / 0.3, 0, 1);
      this.shock.set(this.foe, 0.4 + 1.6 * gp, 0.02 * (1 - gp) * (1 - gp));
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const hemocurseModule: EffectModule = {
  label: 'hemocurse',
  category: 'hero: blood',
  // Click an enemy: the curse always lands (`projectile`) once it passes its sight and reach check; the red circle is the warning.
  targeting: { mode: 'enemy' },
  create: () => new Hemocurse(),
  telegraphs(effect) {
    const e = effect as Hemocurse;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Hemocurse;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Hemocurse).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
