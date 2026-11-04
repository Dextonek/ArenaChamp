import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { ChainLine, ChainRing, FORGE, FORGE_CSS, ForgeIron, HotStreak, QuenchSteam, Sparks } from '../../effects/parts/forge';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Chain Hammer (forge kit v5, Q: a hooking skillshot). A 0.3 s wind-up: he whirls the hammer on its chain round himself
 * (a ring of links at his waist spinning up and heating, sparks) so the throw can be read. At 0.3 s the hammer leaves
 * (`ctx.projectile`, 18 m/s, 9 m, radius 0.45: it reaches 6 m at 0.63 s) tumbling down the aim, and a straight run of
 * chain links stays joined from his hand to it, drawn back to him every frame. The first enemy it touches takes 40 and is
 * dragged 4 m toward him (`pull: 4`, `knock: 0`) and slowed 1 s; the chain stays taut on the enemy for 0.45 s while they
 * come, then it whips back to his hand with a puff of steam. A miss reels the chain in the same way. Tempered (his trait,
 * on a 3-Heat enemy): stunned 0.75 s instead of the slow. The hit's status is the trait's to change; this file only asks
 * for the slow. Network duels: the bolt flies on the victim's screen, the dealer's screen draws only the wind-up.
 * Clean by about 1.6 s. See pipeline/designs/kit-forge.md.
 */
export interface ChainHammerSettings {
  damage: number;
  /** Metres the hit drags the enemy toward him (the engine caps it at 4). */
  pull: number;
  slowSeconds: number;
  loop: boolean;
}

export const defaultChainHammer = (): ChainHammerSettings => ({ damage: 40, pull: 4, slowSeconds: 1, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.3;
const SPEED = 18;
const RANGE = 9;
const RADIUS = 0.45;
const MUZZLE = 0.7;
const HOLD_T = 0.45; // the chain stays taut on the enemy
const REEL_T = 0.2;
const DURATION = 1.7;
const HAND_Y = 1.15;

export class ChainHammer implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ChainHammerSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(RADIUS) };
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private fwd = new THREE.Vector3(0, 0, 1);
  private hand = new THREE.Vector3();
  /** Where the hammer is now, where it was when the reel began, and what it is stuck in. */
  private head = new THREE.Vector3();
  private reelFrom = new THREE.Vector3();
  private caught: THREE.Object3D | null = null;
  private hitAt = -1;
  private reelAt = -1;
  private done = false;
  private spin = 0;

  private hammer = ForgeIron.hammer(0.8);
  private chain = new ChainLine(30);
  private whirl = new ChainRing(14);
  private streak = new HotStreak();
  private sparks = new Sparks(70);
  private steam = new QuenchSteam(10);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: FORGE.accent, core: FORGE.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ChainHammerSettings = defaultChainHammer()) {
    this.settings = settings;
    this.steam.life = 0.5;
    this.group.add(
      this.chain.mesh, this.whirl.mesh, this.hammer, this.streak.mesh, this.sparks.mesh, this.steam.mesh, this.pop.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * RANGE, z2: ctx.from.z + this.fwd.z * RANGE,
      width: boltWidth(RADIUS),
    };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.done = false;
    this.bolt = null;
    this.caught = null;
    this.hitAt = -1;
    this.reelAt = -1;
    this.spin = 0;
    this.hammer.visible = false;
    ForgeIron.heat(this.hammer, 0.6);
    this.chain.hide();
    this.whirl.mesh.visible = false;
    this.streak.reset();
    this.sparks.reset();
    this.steam.reset();
    this.pop.set(this.head, 0, 0);
    this.shock.set(this.head, 0, 0);
  }

  /** His hand: the caster's live position, a little forward and up. */
  private handPos(out: THREE.Vector3) {
    const c = this.ctx?.caster.group.position;
    if (c) out.set(c.x, HAND_Y, c.z).addScaledVector(this.fwd, 0.4);
    return out;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.steam.update(dt);
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    this.handPos(this.hand);

    // --- The wind-up: the hammer whirls round him on its chain, heating as it spins up. ---
    if (t < RELEASE_T && ctx) {
      const k = t / RELEASE_T;
      const c = ctx.caster.group.position;
      this.v1.set(c.x, 0, c.z);
      this.whirl.mesh.visible = true;
      this.whirl.place(this.v1, 0.95, 1.1, t * (10 + 20 * k), 0.3 + 0.7 * k, 0.12);
      this.hammer.visible = true;
      this.v2.set(c.x + Math.cos(t * 30) * 1.0, 1.1, c.z + Math.sin(t * 30) * 1.0);
      this.head.copy(this.v2);
      this.hammer.position.copy(this.v2);
      this.hammer.rotation.set(0, -t * 30, 0.9);
      ForgeIron.heat(this.hammer, 0.3 + 0.7 * k);
      if (Math.random() < 0.6) this.sparks.burst(this.v2, this.v1.set(Math.sin(t * 30), 0.6, -Math.cos(t * 30)), 1, 5, 0.5);
    }

    if (!this.fired && t >= RELEASE_T) {
      this.fired = true;
      this.whirl.mesh.visible = false;
      if (ctx?.projectile) {
        const hit: HitOptions = {
          damage: this.settings.damage, knock: 0, pull: this.settings.pull, color: FORGE_CSS.body,
          status: { kind: 'slow', seconds: this.settings.slowSeconds },
        };
        this.bolt = ctx.projectile({
          from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE,
          radius: RADIUS, hit,
        });
        this.bolt.onHit((target, at) => this.onHit(target.group, at));
        this.head.copy(this.hand);
      } else {
        // No bolt here (the other screen of a network duel flies it): the wind-up ends and the hammer is gone.
        this.hammer.visible = false;
        this.done = true;
      }
    }

    if (this.bolt && !this.done) this.fly(dt);

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const sp = StarBurst.pop(a, 0.02, 0.05);
      this.pop.set(this.v1.copy(this.head).setY(1.2), 1.0 * sp.scale, sp.opacity, 0.3);
      const g = smoothstep(a / 0.3);
      this.shock.set(this.v1.set(this.head.x, 0, this.head.z), 0.4 + 1.6 * g, 0.025 * (1 - g) * (1 - g));
      this.shake = 0.2 * Math.exp(-a * 12);
    }

    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }

  /** The hammer in flight, then stuck in the enemy, then reeled back; the chain follows his hand all the while. */
  private fly(dt: number) {
    const t = this.time, bolt = this.bolt;
    if (!bolt) return;
    this.spin += dt * 14;
    this.hammer.visible = true;
    if (this.reelAt < 0) {
      if (this.caught) {
        // Stuck: it rides the enemy as they are dragged in.
        const p = this.caught.position;
        this.head.set(p.x, 1.1, p.z);
        if (t >= this.hitAt + HOLD_T) this.startReel();
      } else if (bolt.alive) {
        this.head.set(bolt.pos.x, 1.1, bolt.pos.z);
        this.v1.copy(this.head).addScaledVector(bolt.dir, -1.1);
        this.streak.set(this.head, this.v1, 0.28);
        if (Math.random() < 0.5) this.sparks.burst(this.head, this.v2.copy(bolt.dir).negate().setY(0.4), 1, 4, 0.5);
      } else {
        this.startReel();
      }
    }
    if (this.reelAt >= 0) {
      const k = smoothstep((t - this.reelAt) / REEL_T);
      this.head.lerpVectors(this.reelFrom, this.hand, k);
      this.streak.set(this.head, this.reelFrom, 0.2, 1 - k);
      if (k >= 1) {
        this.hammer.visible = false;
        this.chain.hide();
        this.streak.reset();
        this.steam.puff(this.v1.copy(this.hand).setY(0.9), 0.5);
        this.done = true;
        return;
      }
    }
    this.hammer.position.copy(this.head);
    this.hammer.rotation.set(0, Math.atan2(this.fwd.x, this.fwd.z), this.spin);
    ForgeIron.heat(this.hammer, this.caught ? 0.9 : 0.6);
    this.chain.set(this.hand, this.head, this.caught ? 0.8 : 0.5);
  }

  private startReel() {
    this.reelAt = this.time;
    this.reelFrom.copy(this.head);
    this.caught = null;
  }

  private onHit(target: THREE.Object3D, at: THREE.Vector3) {
    this.hitAt = this.time;
    this.caught = target;
    this.head.set(at.x, 1.1, at.z);
    this.sparks.burst(this.head, this.v2.copy(this.fwd).negate().setY(0.5), 14, 7, 0.9);
    this.steam.puff(this.v1.copy(this.head).setY(0.9), 0.45, true);
  }
}

export const chainHammerModule: EffectModule = {
  label: 'chain hammer',
  category: 'hero: forge',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new ChainHammer(),
  telegraphs(effect) {
    const e = effect as ChainHammer;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ChainHammer;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ChainHammer).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'pull', 0, 4, 0.5);
    f.add(s, 'slowSeconds', 0, 2.5, 0.1);
  },
};
