import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FORGE, FORGE_CSS, ForgeIron, HotStreak, QuenchSteam, SlagPool, Sparks } from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Red-Hot Rivet (forge kit v5, E: a targeted flick, his rhythm tool). A click on an enemy in sight (6 m; the engine checks
 * sight at the cast). 0..0.25 s: he pulls a white-hot rivet out of his chest forge (a small rivet at his hand, sparks).
 * 0.25..0.55 s: he flicks it, a fat comet trail behind it, and it flies to the enemy's live position. At 0.55 s it
 * punches in: 30 damage (`projectile: true`, a sure hit, like Fire Vial), sparks out of the back, a small slag splash under
 * them, a cold star for two frames and a ground ripple. The rivet then STAYS in them, glowing and smoking, and burns for
 * 16 in two small ticks of 8 at 1.55 s and 2.55 s (each with a few sparks; skipped if the target is gone); it cools to dull
 * iron as it burns and drops out at the end with a puff of steam. The Heat (2) and the Tempered bonus (20% more damage taken
 * for 3 s) are the trait's: Tempered is decided on the first hit, so the ticks carry it only through the debuff. No telegraph
 * (a sure hit that needs sight at the cast). The last tick is 2.6 s after the cast, inside the duel's 4.2 s window. Clean by 3.2 s.
 * See pipeline/designs/kit-forge.md.
 */
export interface RedHotRivetSettings {
  damage: number;
  /** Damage of each of the two burn ticks. */
  tickDamage: number;
  loop: boolean;
}

export const defaultRedHotRivet = (): RedHotRivetSettings => ({ damage: 25, tickDamage: 6, loop: false });

// Timeline (seconds).
const PULL_T = 0.25;
const HIT_T = 0.55;
const TICKS = [1.55, 2.55];
const DURATION = 3.2;
const HAND_Y = 1.2;

export class RedHotRivet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RedHotRivetSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hit = false;
  private ticked = [false, false];
  private target: THREE.Object3D | null = null;
  private fwd = new THREE.Vector3(0, 0, 1);
  private hand = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private at = new THREE.Vector3();
  private q = new THREE.Quaternion();

  private rivet = ForgeIron.rivet(0.75);
  private streak = new HotStreak();
  private sparks = new Sparks(80);
  private steam = new QuenchSteam(12);
  private splash = new SlagPool();
  private star = new StarBurst({ points: 8, inner: 0.3, color: FORGE.accent, core: FORGE.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(settings: RedHotRivetSettings = defaultRedHotRivet()) {
    this.settings = settings;
    this.steam.life = 0.6;
    this.group.add(this.splash.mesh, this.rivet, this.streak.mesh, this.sparks.mesh, this.steam.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0]?.group ?? null;
    this.at.copy(ctx.targetPos[0] ?? ctx.point);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hit = false;
    this.ticked[0] = this.ticked[1] = false;
    this.rivet.visible = false;
    ForgeIron.heat(this.rivet, 1);
    this.streak.reset();
    this.sparks.reset();
    this.steam.reset();
    this.splash.reset();
    this.star.set(this.at, 0, 0);
    this.shock.set(this.at, 0, 0);
  }

  /** The enemy's chest now (its live position), else where it stood at the cast. */
  private chest(out: THREE.Vector3) {
    const p = this.target?.position ?? this.at;
    return out.set(p.x, 1.2, p.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.steam.update(dt);
    this.splash.update(dt);
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    const c = ctx?.caster.group.position;
    if (c) this.hand.set(c.x, HAND_Y, c.z).addScaledVector(this.fwd, 0.45);
    this.chest(this.aim);
    if (c) this.fwd.set(this.aim.x - c.x, 0, this.aim.z - c.z).normalize();

    if (t < PULL_T) {
      // Out of the chest forge: the rivet comes up white-hot into his hand.
      const k = smoothstep(t / PULL_T);
      this.rivet.visible = true;
      this.rivet.position.set(this.hand.x, 0.6 + (HAND_Y - 0.6) * k, this.hand.z).addScaledVector(this.fwd, 0.1);
      this.q.setFromUnitVectors(RedHotRivet.UP, this.v1.set(this.fwd.x, 0.5, this.fwd.z).normalize());
      this.rivet.quaternion.copy(this.q);
      if (Math.random() < 0.5) this.sparks.burst(this.rivet.position, this.v2.set(0, 1, 0), 1, 3.5, 1.2);
    } else if (!this.hit) {
      // The flick: the rivet flies to the enemy's live chest.
      const k = Math.min(1, (t - PULL_T) / (HIT_T - PULL_T));
      const e = k * k * (3 - 2 * k);
      this.rivet.visible = true;
      this.rivet.position.lerpVectors(this.hand, this.aim, e);
      this.v1.subVectors(this.aim, this.hand).normalize();
      this.q.setFromUnitVectors(RedHotRivet.UP, this.v1);
      this.rivet.quaternion.copy(this.q);
      this.streak.set(this.rivet.position, this.v2.copy(this.rivet.position).addScaledVector(this.v1, -1.4), 0.3);
    }

    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      this.streak.reset();
      this.shake = 0.18;
      this.chest(this.at);
      this.sparks.burst(this.at, this.v1.copy(this.fwd).setY(0.3), 18, 8, 1.0);
      this.splash.place(this.v1.set(this.at.x, 0, this.at.z));
      this.splash.spread(1.0, 0.25);
      this.splash.cool(1.6, 0.3);
      this.splash.fade(0.6, 1.9);
      this.steam.puff(this.v1.copy(this.at).setY(1.0), 0.4, true);
      if (ctx && this.target && ctx.targets[0]) {
        ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 1.5, from: ctx.from, color: FORGE_CSS.body, projectile: true });
      }
    }

    if (this.hit) {
      const a = t - HIT_T;
      this.chest(this.at);
      // Stuck in the chest: it rides the enemy, cooling from white-hot to dull iron as it burns.
      this.rivet.visible = a < 2.1;
      this.rivet.position.copy(this.at).addScaledVector(this.fwd, -0.15);
      ForgeIron.heat(this.rivet, 1 - 0.8 * smoothstep(a / 2.0));
      if (a < 2.0 && Math.random() < 0.25) this.sparks.burst(this.at, this.v1.set(0, 1, 0), 1, 3, 1.4);
      if (a < 2.0 && Math.random() < 0.08) this.steam.puff(this.v1.copy(this.at).setY(1.5), 0.3);
      const sp = StarBurst.pop(a, 0.02, 0.05);
      this.star.set(this.at, 0.9 * sp.scale, sp.opacity, 0.3);
      const g = smoothstep(a / 0.3);
      this.shock.set(this.v1.set(this.at.x, 0, this.at.z), 0.3 + 1.2 * g, 0.02 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * Math.exp(-dt * 12), 0);
      if (a >= 2.0 && a < 2.0 + dt * 1.5) this.steam.puff(this.v1.copy(this.at).setY(1.1), 0.5);

      for (let i = 0; i < 2; i++) {
        if (this.ticked[i] || t < TICKS[i]) continue;
        this.ticked[i] = true;
        this.sparks.burst(this.at, this.v1.set(0, 1, 0), 6, 5, 1.0);
        if (ctx && ctx.targets[0]) {
          ctx.hit(ctx.targets[0], { damage: this.settings.tickDamage, knock: 0, from: ctx.from, color: FORGE_CSS.hot, projectile: true });
        }
      }
    }

    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }
}

export const redHotRivetModule: EffectModule = {
  label: 'red-hot rivet',
  category: 'hero: forge',
  targeting: { mode: 'enemy' },
  create: () => new RedHotRivet(),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RedHotRivet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RedHotRivet).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 40, 1);
  },
};
