import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, IceStreak, RimeSleeves, Snow } from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hoarfrost (frost kit v5, W: a targeted bite; `src/traits/frost.ts` is the rules). Click an enemy within 8 m (the engine checks
 * sight at the cast): she breathes a cone of mist at them and a pale streak runs to them (0.3 s) while a pale ring on their feet
 * (the warning, from `telegraphs`, following them) shows where the frost will take hold. At 0.45 s the frost bites:
 * 36 damage (`projectile: true`, judged on the live position, so it cannot be walked out of once cast; the trait adds 2 Chill and,
 * from 3 Chill, the slow; the spell has no slow of its own). Rime climbs the body (`RimeSleeves`), small crystals break out
 * of the floor under them and a ring of fern cracks runs out, then both fade. No range or sight check after the cast: the
 * counterplay is staying past 8 m or breaking sight before it. Clean by 1.4 s.
 */
export interface HoarfrostSettings {
  damage: number;
  loop: boolean;
}

export const defaultHoarfrost = (): HoarfrostSettings => ({ damage: 36, loop: false });

// Timeline (seconds).
const HIT_T = 0.45;
const STREAK_T = 0.3; // the pale streak reaches them
const DURATION = 1.4;
const MARK_R = 1.1; // the ring on their feet
const CHEST = 1.1;

export class Hoarfrost implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HoarfrostSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private hit = false;
  private hitAt = -1;
  private foe = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);

  // Parts.
  private breath = new FrostBreath(24);
  private streak = new IceStreak();
  private sleeves = new RimeSleeves(1);
  private crystals = new IceCrystals({ maxSpikes: 10, maxShards: 50 });
  private ferns = new FrostFerns({ variant: 1, maxShards: 16 });
  private snow = new Snow({ max: 40 });
  private pop = new StarBurst({ points: 8, inner: 0.3, color: FROST.accent, core: FROST.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HoarfrostSettings = defaultHoarfrost()) {
    this.settings = settings;
    this.ferns.renderOrder = 2;
    this.group.add(this.ferns.mesh, this.sleeves.mesh, this.crystals.mesh, this.streak.mesh, this.breath.mesh, this.snow.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** The enemy's live feet, for the ring on them. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.liveFoe();
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    this.liveHand();
    // The breath at the enemy.
    this.breath.blow(this.hand, this.dir, 3.2, 0.25);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hit = false;
    this.hitAt = -1;
    this.breath.reset();
    this.streak.set(this.foe, this.foe, 0, 0);
    this.sleeves.clear();
    this.crystals.reset();
    this.ferns.reset();
    this.snow.reset();
    this.pop.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
  }

  /** Her mouth: in front of the caster's live position at head height, toward the enemy. */
  private liveHand() {
    const c = this.ctx?.caster.group.position;
    if (!c) return;
    this.hand.set(c.x, 1.5, c.z);
    this.dir.set(this.foe.x - c.x, 0, this.foe.z - c.z);
    if (this.dir.lengthSq() < 1e-4) this.dir.set(0, 0, 1);
    this.dir.normalize();
    this.hand.addScaledVector(this.dir, 0.45);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.crystals.update(dt);
    this.ferns.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.liveFoe();
    this.liveHand();

    // --- The pale streak runs from her mouth to their chest. ---
    if (t < HIT_T) {
      const k = smoothstep(t / STREAK_T);
      this.v1.copy(this.foe).setY(CHEST);
      this.v2.lerpVectors(this.hand, this.v1, k);
      const tail = this.v1.lerpVectors(this.hand, this.v1, Math.max(0, k - 0.35));
      this.streak.set(this.v2, tail, 0.22, 0.85 * (t < STREAK_T ? 1 : 1 - smoothstep((t - STREAK_T) / (HIT_T - STREAK_T))));
    } else this.streak.set(this.foe, this.foe, 0, 0);

    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      this.bite();
    }

    // --- The rime climbs the body and fades. ---
    if (this.hit) {
      const a = t - this.hitAt;
      const grow = smoothstep(a / 0.3);
      const fade = 1 - smoothstep((a - 0.35) / 0.4);
      this.sleeves.set(0, this.foe, 2.2, 0.8, grow, 0.9 * fade);
      const sp = StarBurst.pop(a, 0.0, 0.04);
      this.v1.copy(this.foe).setY(CHEST);
      this.pop.set(this.v1, 1.0 * sp.scale + 1e-3, sp.opacity, 0.3);
      const k = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(this.foe, 0.3 + 1.5 * k, 0.025 * (1 - k) * (1 - k));
      if (a > 0.5 && this.ferns.active) this.ferns.shatter(0.4);
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The bite: damage on the live position, crystals out of the floor, a ring of cracks. */
  private bite() {
    const ctx = this.ctx;
    this.hitAt = this.time;
    this.v1.copy(this.foe);
    this.crystals.cluster(this.v1, 0.8, 6, 0.9, { tilt: 0.3, stagger: 0.08, grow: 0.12 });
    this.ferns.grow(this.v1, 1.5, 0.3, 0);
    this.v2.copy(this.foe).setY(CHEST);
    this.snow.scatter(this.v2, 10, 2.4, 0.7);
    this.shake = 0.16;
    if (!ctx || !this.target) return;
    ctx.hit(this.target, { damage: this.settings.damage, knock: 0, from: ctx.caster.group.position.clone(), color: FROST_CSS.hot, projectile: true });
  }
}

export const hoarfrostModule: EffectModule = {
  label: 'hoarfrost',
  category: 'hero: frost',
  // Click an enemy: the bite always lands (`projectile`) 0.45 s after the cast; the ring on their feet is the warning.
  targeting: { mode: 'enemy' },
  create: () => new Hoarfrost(),
  telegraphs(effect) {
    const e = effect as Hoarfrost;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Hoarfrost;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Hoarfrost).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
