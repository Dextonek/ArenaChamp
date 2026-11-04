import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { FROST, FROST_CSS, FrostBreath, IceCrystals, RimeSleeves, Snow } from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { WINTER_BASE, WINTER_WIND } from '../../traits/frost';

/**
 * Winter's Shatter (frost kit v5, R: a targeted strike, `projectile` hit; `src/traits/frost.ts` is the rules). Click an enemy
 * within 9 m (the engine checks sight at the cast). Her fist closes: for the 0.8 s wind-up (`WINTER_WIND`) five ice crystals
 * close into a fist at her hand while rime climbs the enemy from the feet (`RimeSleeves`, following them: the cracks
 * forming) and a pale ring on their feet (the warning, from `telegraphs`, following them) shows the strike; the screen dims a
 * little and focuses on them. She is not untouchable. At 0.8 s the spell checks itself: if `stillSees` the enemy is false it
 * fizzles (the cracks fall away as snow, no hit, no Chill spent). Otherwise the fist shatters and the Chill on them goes with
 * it: `damage` (50) `projectile: true` on the live position, and the trait adds 30 per Chill it finds and clears them (so a
 * frozen enemy takes only 50). One short impact frame, a ring of crystals out of the floor that bursts 0.25 s later, shards, flakes,
 * a refraction ring and a hard shake, under the gameplay camera. Clean by 1.7 s (a fizzle 1.2 s).
 */
export interface WintersShatterSettings {
  damage: number;
  loop: boolean;
}

export const defaultWintersShatter = (): WintersShatterSettings => ({ damage: WINTER_BASE, loop: false });

// Timeline (seconds).
const HIT_T = WINTER_WIND;
const BURST_T = HIT_T + 0.25; // the crystals out of the floor break
const DURATION = HIT_T + 0.9;
const FIZZLE_END = HIT_T + 0.4;
const MARK_R = 1.2; // the ring on the enemy
const CHEST = 1.1;
const FIST = 5;

export class WintersShatter implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WintersShatterSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private checked = false;
  private fizzled = false;
  private burst = false;
  private hitAt = -1;
  private fist: number[] = [];
  private foe = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);

  // Parts.
  private breath = new FrostBreath(20);
  private sleeves = new RimeSleeves(1);
  private crystals = new IceCrystals({ maxSpikes: 20, maxShards: 120 });
  private snow = new Snow({ max: 60 });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FROST.accent, core: FROST.core, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: FROST.hot, core: FROST.core, additive: false });
  private shock = new ShockRefraction({ facing: 'camera' });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private side = new THREE.Vector3();
  private up2 = new THREE.Vector3();

  constructor(settings: WintersShatterSettings = defaultWintersShatter()) {
    this.settings = settings;
    this.screen.impactColor.set(FROST.hot);
    this.screen.tint.set(FROST.dark);
    this.group.add(this.sleeves.mesh, this.crystals.mesh, this.breath.mesh, this.snow.mesh, this.pop.mesh, this.flare.mesh, this.shock.mesh, this.groundShock.mesh);
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
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(CHEST);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    this.liveHand();
    // The fist: five crystals stand round her hand, pointing at the enemy, and close in through the wind-up.
    for (let i = 0; i < FIST; i++) this.fist.push(this.crystals.spike(this.hand, this.dir, 0.7, 0.14, 0.25, 0.03 * i));
    this.breath.blow(this.hand, this.dir, 2.4, 0.3);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.checked = this.fizzled = this.burst = false;
    this.hitAt = -1;
    this.fist.length = 0;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(FROST.hot);
    this.screen.tint.set(FROST.dark);
    this.breath.reset();
    this.sleeves.clear();
    this.crystals.reset();
    this.snow.reset();
    this.pop.set(this.foe, 1e-3, 0);
    this.flare.set(this.foe, 1e-3, 0);
    this.shock.set(this.foe, 0, 0);
    this.groundShock.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
  }

  /** Her raised fist: in front of the caster's live position at chest height, toward the enemy. */
  private liveHand() {
    const c = this.ctx?.caster.group.position;
    if (!c) return;
    this.hand.set(c.x, 1.3, c.z);
    this.dir.set(this.foe.x - c.x, 0, this.foe.z - c.z);
    if (this.dir.lengthSq() < 1e-4) this.dir.set(0, 0, 1);
    this.dir.normalize();
    this.hand.addScaledVector(this.dir, 0.6);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.crystals.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= (this.fizzled ? FIZZLE_END : DURATION)) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.liveFoe();
    this.liveHand();

    if (!this.checked && t >= HIT_T) {
      this.checked = true;
      if (this.sightLost()) this.fizzle();
      else this.strike();
    }
    if (this.hitAt >= 0 && !this.fizzled && !this.burst && t >= BURST_T) {
      this.burst = true;
      this.crystals.shatter(5, 5, 0.5);
      this.v1.copy(this.foe).setY(CHEST);
      this.snow.scatter(this.v1, 24, 4, 0.9);
      this.shake = Math.max(this.shake, 0.25);
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  /** True when the wind-up ends without sight of the enemy. */
  private sightLost() {
    const ctx = this.ctx;
    if (!ctx || !this.target) return false;
    return !stillSees(ctx, this.target.group.position);
  }

  /** The fist falls apart: the cracks drop away as snow, no hit. */
  private fizzle() {
    this.fizzled = true;
    this.crystals.shatter(3, 3, 0.4);
    this.v1.copy(this.foe).setY(CHEST);
    this.snow.scatter(this.v1, 14, 2.4, 0.8);
    this.shake = 0.06;
  }

  /** The strike: the fist shatters, the crystals stand up out of the floor round them, the hit lands on their live position. */
  private strike() {
    const ctx = this.ctx;
    this.hitAt = this.time;
    // The fist breaks (all five), then the floor crystals grow and break 0.25 s later.
    this.crystals.shatter(4, 4, 0.4);
    this.v1.copy(this.foe);
    this.crystals.cluster(this.v1, 1.1, 12, 1.8, { ring: true, tilt: 0.4, stagger: 0.07, grow: 0.12 });
    this.v2.copy(this.foe).setY(CHEST);
    this.crystals.shards.burst(this.v2, 20, 6, 0.5, 0.22);
    this.snow.scatter(this.v2, 16, 3.4, 0.8);
    this.shake = 0.45;
    if (!ctx || !this.target) return;
    ctx.hit(this.target, {
      damage: this.settings.damage, knock: 2.5, from: ctx.caster.group.position.clone(), color: FROST_CSS.hot, projectile: true,
    });
  }

  private layout(t: number) {
    const dim = smoothstep(t / HIT_T) * (1 - smoothstep((t - (this.fizzled ? HIT_T + 0.1 : BURST_T)) / 0.3));
    this.screen.darken = (this.fizzled ? 0.15 : 0.28) * dim;
    this.screen.focus.copy(this.foe).setY(CHEST);
    this.screen.impact = this.fizzled ? 0 : impactFrameAt(t, HIT_T, [1], 0.04);
    this.screen.edgeTint.set(FROST.body);

    // --- The wind-up: the fist closes round its point, the rime climbs the enemy. ---
    if (t < HIT_T && this.fist.length) {
      const k = t / HIT_T;
      const r = 0.5 * (1 - 0.85 * smoothstep(k));
      this.side.set(-this.dir.z, 0, this.dir.x);
      this.up2.crossVectors(this.dir, this.side).normalize();
      for (let i = 0; i < this.fist.length; i++) {
        const a = (i / this.fist.length) * Math.PI * 2 + t * 3;
        this.v1.copy(this.hand).addScaledVector(this.side, Math.cos(a) * r).addScaledVector(this.up2, Math.sin(a) * r);
        this.v2.copy(this.dir).addScaledVector(this.side, -Math.cos(a) * 0.35 * r).addScaledVector(this.up2, -Math.sin(a) * 0.35 * r).normalize();
        this.crystals.place(this.fist[i], this.v1, this.v2);
      }
      this.crystals.flare = 0.7 * smoothstep(k);
      this.sleeves.set(0, this.foe, 2.2, 0.85, smoothstep(k), 0.85);
      const pulse = 0.5 + 0.5 * Math.sin(t * 22);
      this.v1.copy(this.hand);
      this.flare.set(this.v1, (0.2 + 0.7 * smoothstep(k)) * (0.85 + 0.15 * pulse), 0.9 * smoothstep(t / 0.1), t * 6);
    } else if (this.fizzled) {
      const a = t - HIT_T;
      this.sleeves.set(0, this.foe, 2.2, 0.85, 1, 0.85 * (1 - smoothstep(a / 0.3)));
      this.flare.set(this.hand, 1e-3, 0);
      this.crystals.flare = 0;
    } else {
      // The strike: the rime on the body flashes out, a star on the chest and two rings.
      const a = t - HIT_T;
      this.crystals.flare = 0;
      this.sleeves.set(0, this.foe, 2.2, 0.85, 1, 0.9 * (1 - smoothstep(a / 0.18)));
      const fp = StarBurst.pop(a, 0.03, 0.1);
      this.flare.set(this.hand, 1.4 * fp.scale + 1e-3, fp.opacity, 0.4);
      const sp = StarBurst.pop(a, 0.0, 0.06);
      this.v1.copy(this.foe).setY(CHEST);
      this.pop.set(this.v1, 2.0 * sp.scale + 1e-3, sp.opacity, 0.2);
      const k = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(this.v1, 0.3 + 1.8 * k, 0.05 * (1 - k) * (1 - k));
      const gk = THREE.MathUtils.clamp(a / 0.5, 0, 1);
      this.groundShock.set(this.v2.copy(this.foe).setY(0), 0.5 + 2.6 * gk, 0.06 * (1 - gk) * (1 - gk));
    }
  }
}

export const wintersShatterModule: EffectModule = {
  label: "winter's shatter",
  category: 'hero: frost',
  // Click an enemy: the strike always lands (`projectile`) after the 0.8 s wind-up if she still has sight of them.
  targeting: { mode: 'enemy' },
  create: () => new WintersShatter(),
  telegraphs(effect) {
    const e = effect as WintersShatter;
    if (!e.ctx) return [];
    // The ring on the enemy for the wind-up, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WintersShatter;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as WintersShatter).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
