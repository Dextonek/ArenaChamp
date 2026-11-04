import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandRibbon } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Shepherd's Crook (sand kit v5, W: a targeted hook and pull). A click on the enemy (6 m, the engine checks sight at the cast)
 * with a 0.5 s wind-up. Sefu swings a sandstone crook out: a ribbon of sand leaves his hand at 0.3 s, sets into pale carved
 * stone as it flies, and its hooked end curls round the enemy's neck (the hook follows their live position) while an ochre
 * cobra of sand winds up the shaft. A gold mark (a ring and a star, both following the enemy) shows who is hooked during the
 * wind-up. At 0.5 s the hit lands (`projectile: true`: the range and the sight were the check, there is nothing to sidestep):
 * 35 damage, `pull: 3` toward him (the engine stops them 1 m short, at most 4 m), `knock: 0`, slowed 0.5 s. The trait
 * (`src/traits/sand.ts`) Judges them for 3 s. Then the crook snaps back and crumbles. Clean by 1.3 s.
 * Network duels: the hit is decided on the victim's screen from the cast's live positions; the dealer's screen draws only the
 * hook (the pull moves the victim's own figure there).
 */
export interface ShepherdsCrookSettings {
  damage: number;
  /** Metres of the pull (engine cap 4). */
  pull: number;
  /** Slow seconds (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultShepherdsCrook = (): ShepherdsCrookSettings => ({ damage: 35, pull: 3, slow: 0.5, loop: false });

// Timeline (seconds).
const LAUNCH_T = 0.3; // the crook leaves his hand
const HIT_T = 0.5; // the hook closes and the hit lands
const SNAP_T = 0.9; // the crook snaps back
const DURATION = 1.4;

const MARK_R = 1.2; // the telegraph circle on the enemy
const HOOK_R = 0.42; // the hook's loop round the neck
const HOOK_SWEEP = 4.2; // radians of the loop (about 240 degrees)
const NECK_Y = 1.55;
const UP = new THREE.Vector3(0, 1, 0);

export class ShepherdsCrook implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShepherdsCrookSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the enemy stood at the cast (the telegraph circle's centre). */
  readonly spot = new THREE.Vector3();
  private target: Enemy | null = null;
  private time = 0;

  private from = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private foe = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private pf = 0.8; // the share of the ribbon that is the straight shaft
  private hitPos = new THREE.Vector3();
  private shaftStart = new THREE.Vector3();
  private shaftEnd = new THREE.Vector3();
  private flags = { launched: false, hit: false, snapped: false };

  private staff = new SandRibbon(34, 8, 10);
  private cobra = new SandRibbon(30, 8, 6);
  private dust = new Dust(8, 24);
  private markStar = new StarBurst({ points: 6, inner: 0.25, color: SAND.hot, core: SAND.core, additive: false });
  private markRing = new ShockRefraction({ facing: 'ground' });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.hot, core: SAND.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: ShepherdsCrookSettings = defaultShepherdsCrook()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.staff.shed = 14;
    this.cobra.shed = 0;
    this.dust.life = 0.55;
    this.group.add(this.staff.mesh, this.cobra.mesh, this.dust.mesh, this.markStar.mesh, this.markRing.mesh, this.pop.mesh, this.groundShock.mesh);
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
    this.target = ctx.targets[0] ?? null;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.spot.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.foe.copy(this.spot);
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
    const f = this.flags;
    f.launched = f.hit = f.snapped = false;
    clearScreenFx(this.screen);
    this.staff.reset();
    this.cobra.reset();
    this.dust.reset();
    this.markStar.set(this.foe, 1e-3, 0);
    this.markRing.set(this.foe, 0, 0);
    this.pop.set(this.foe, 1e-3, 0);
    this.groundShock.set(this.foe, 0, 0);
  }

  /** The enemy's live feet, and the geometry that hangs off them: the shaft's two ends and the hook's frame. */
  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    const ctx = this.ctx;
    const from = ctx && !ctx.sentFrom ? ctx.caster.group.position : this.from;
    this.v1.set(this.foe.x - from.x, 0, this.foe.z - from.z);
    const d = this.v1.length();
    if (d > 0.05) this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.side.set(this.dir.z, 0, -this.dir.x);
    // His hand: a little to the side of his body, at chest height.
    this.hand.set(from.x + this.dir.x * 0.5 + this.side.x * 0.45, 1.35, from.z + this.dir.z * 0.5 + this.side.z * 0.45);
    // The shaft ends where the hook's loop begins: on the near side of the neck.
    this.shaftEnd.set(this.foe.x - this.dir.x * HOOK_R, NECK_Y, this.foe.z - this.dir.z * HOOK_R);
    this.shaftStart.copy(this.hand);
    const shaft = this.shaftStart.distanceTo(this.shaftEnd);
    this.pf = shaft / (shaft + HOOK_R * HOOK_SWEEP);
  }

  /** The crook along u 0..1: a straight shaft, then the loop round the neck. */
  private crookPath = (u: number, out: THREE.Vector3) => {
    if (u <= this.pf) return out.lerpVectors(this.shaftStart, this.shaftEnd, u / this.pf);
    const a = ((u - this.pf) / (1 - this.pf)) * HOOK_SWEEP;
    const c = Math.cos(a), s = Math.sin(a);
    return out.set(
      this.foe.x + (-this.dir.x * c + this.side.x * s) * HOOK_R,
      NECK_Y + 0.12 * (a / HOOK_SWEEP),
      this.foe.z + (-this.dir.z * c + this.side.z * s) * HOOK_R,
    );
  };

  /** An ochre cobra of sand winding up the shaft in four turns. */
  private windPath = (u: number, out: THREE.Vector3) => {
    this.crookPath(0.04 + 0.9 * this.pf * u, out);
    const a = u * Math.PI * 8;
    return out.addScaledVector(this.side, Math.cos(a) * 0.22).addScaledVector(UP, Math.sin(a) * 0.22);
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.staff.update(dt);
    this.cobra.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;
    this.liveFoe();

    if (!f.launched && t >= LAUNCH_T) {
      f.launched = true;
      this.dust.puff(this.v1.copy(this.hand).setY(0.5), 0.5);
    }

    // The hit: the hook has closed on the neck. `projectile`: judged by the live position (range and sight were the check).
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hitPos.set(this.foe.x, NECK_Y, this.foe.z);
      this.shake = 0.3;
      this.dust.puff(this.v1.set(this.foe.x, 0.3, this.foe.z), 0.7);
      this.dust.fall(this.v1.set(this.foe.x, 0, this.foe.z), 0.7, 8, 2.0, 0.6);
      if (ctx && this.target) {
        ctx.hit(this.target, {
          damage: this.settings.damage, knock: 0, pull: this.settings.pull, color: SAND_CSS.body, projectile: true,
          status: { kind: 'slow', seconds: this.settings.slow },
        });
      }
    }
    if (!f.snapped && t >= SNAP_T) {
      f.snapped = true;
      this.dust.puff(this.v1.copy(this.hand).setY(0.5), 0.5);
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  private layout(t: number) {
    // --- The wind-up mark on the enemy: a ring that closes in and a gold star over the head, both following it. ---
    if (t < HIT_T) {
      const mp = smoothstep(t / 0.15);
      const pulse = 0.5 + 0.5 * Math.sin(t * 22);
      this.markRing.set(this.foe, 2.0 - 0.9 * (t / HIT_T), 0.05 * mp);
      this.v1.copy(this.foe).setY(2.5);
      this.markStar.set(this.v1, (0.6 + 0.2 * pulse) * mp + 1e-3, 0.95 * mp, t * 5);
    } else {
      this.markRing.set(this.foe, 0, 0);
      this.markStar.set(this.foe, 1e-3, 0);
    }

    // --- The crook: flies out and sets into stone, hooks, then snaps back. ---
    // A short stub rises in his hand through the wind-up, then the crook flies out.
    const grow = 0.1 * smoothstep(t / 0.25) + 0.9 * smoothstep((t - LAUNCH_T) / (HIT_T - LAUNCH_T));
    const back = smoothstep((t - SNAP_T) / 0.25);
    if (t >= 0.05) {
      this.staff.stone = smoothstep((t - 0.05) / 0.25);
      this.staff.setFunction(this.crookPath, 0.3, Math.max(grow, 0.02), Math.min(back, Math.max(grow, 0.02) - 0.02), t);
      this.cobra.stone = 0;
      const ch = smoothstep((t - LAUNCH_T) / 0.2) * (1 - back);
      this.cobra.setFunction(this.windPath, 0.17, Math.max(ch, 0.001), 0, t);
    }

    // --- The hit: a star on the neck and a ring on the floor. ---
    if (this.flags.hit) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0.02, 0.06);
      this.pop.set(this.hitPos, 1.1 * sp.scale + 1e-3, sp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.groundShock.set(this.v1.set(this.foe.x, 0, this.foe.z), 0.4 + 2.0 * g, 0.03 * (1 - g) * (1 - g));
    }
  }
}

export const shepherdsCrookModule: EffectModule = {
  label: "shepherd's crook",
  category: 'hero: sand',
  // Click an enemy within 6 m (the engine checks sight at the cast); the 0.5 s wind-up and the gold mark are the warning.
  targeting: { mode: 'enemy' },
  create: () => new ShepherdsCrook(),
  telegraphs(effect) {
    const e = effect as ShepherdsCrook;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.spot.x, z: e.spot.z, radius: MARK_R }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShepherdsCrook;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ShepherdsCrook).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'pull', 0, 4, 0.5);
    f.add(s, 'slow', 0, 2, 0.1);
  },
};
