import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { LightningTree, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { nearestRod } from '../../traits/storm';

/**
 * Polarity (storm kit v5, E: a targeted magnet, then a pull; `cc`). A click on an enemy (8 m, sight checked by the engine at
 * the cast). She points the staff; at 0.25 s a bolt jumps to the enemy: 20 (`projectile: true`, judged on its live position)
 * and the magnet mark: the trait puts the `magnet` stack on it in `dealt` (a pip over its head, 1 s, both screens) and the
 * effect spins a blue horseshoe magnet over its head while thin arcs run from it toward where it will be pulled: her NEAREST
 * ROD to the enemy (read live, `nearestRod`), else her. At 1.0 s after the cast the pull: one hit, `damage: 0, knock: 0, pull:
 * 3, from: <that spot>, projectile: true`. The engine stops a pull 1.0 m short of its `from`, so a pull reaches the rod's 1.0 m
 * ring when the enemy is 4 m or less from the rod (`REACH` 4.05 with a margin): then the SAME hit carries `status: stun 0.6 s`
 * (the status needs no position after the pull, only the distance before it, read from the live position at that moment).
 * Pulled toward her (no rod) there is no stun. Only the victim's screen moves a live target; the other screen draws the bolt.
 * The pull's hit has no damage, so it arcs no rods (the trait's `dealt` ignores a 0-damage hit). Timeline: hit 0.25, pull 1.0,
 * the slide drawn to 1.5 s, clean by 1.8 s.
 */
export interface PolaritySettings {
  damage: number;
  pull: number;
  stunSeconds: number;
  loop: boolean;
}

export const defaultPolarity = (): PolaritySettings => ({ damage: 20, pull: 3, stunSeconds: 0.6, loop: false });

// Timeline (seconds).
const HIT_T = 0.25;
const PULL_T = 1.0;
const SLIDE_END = 1.5;
const DURATION = 1.8;
const MARK_R = 1.2;
/** The engine stops a pull 1.0 m short of its `from`: a pull of 3 m reaches that ring from 4 m, plus a small margin. */
const STOP = 1.0;
const REACH_MARGIN = 0.05;
const ROD_TOP = 2.7;

export class Polarity implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PolaritySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the enemy stood at the cast: the red circle's spot. */
  mark = new THREE.Vector3();
  private time = 0;
  private target: CastContext['targets'][number] | null = null;
  private hitDone = false;
  private pulled = false;
  private arcTimer = 0;
  private sparkTimer = 0;
  private starAt = -1;
  private stunned = false;
  private foe = new THREE.Vector3();
  private dest = new THREE.Vector3();
  private destTop = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private base = new THREE.Vector3();

  // Parts.
  private tree = new LightningTree(8);
  private sparks = new Sparks(80);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private magnet = new THREE.Group();
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.body, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  private ringDark = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.2, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.dark, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
  );

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PolaritySettings = defaultPolarity()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    // A horseshoe: a half torus with a pale tip and a yellow tip, a dark thick copy behind it for the outline.
    const u = new THREE.TorusGeometry(0.3, 0.1, 8, 18, Math.PI).rotateZ(Math.PI);
    const dark = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.16, 8, 18, Math.PI).rotateZ(Math.PI), new THREE.MeshBasicMaterial({ color: STORM.dark }));
    const body = new THREE.Mesh(u, new THREE.MeshBasicMaterial({ color: STORM.body }));
    const tipA = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), new THREE.MeshBasicMaterial({ color: STORM.rain }));
    tipA.position.set(-0.3, 0.02, 0);
    const tipB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), new THREE.MeshBasicMaterial({ color: STORM.accent }));
    tipB.position.set(0.3, 0.02, 0);
    dark.position.z = -0.03;
    this.magnet.add(dark, body, tipA, tipB);
    this.magnet.scale.setScalar(1.3);
    this.ring.renderOrder = this.ringDark.renderOrder = 4;
    this.group.add(this.ringDark, this.ring, this.magnet, this.tree.mesh, this.sparks.mesh, this.pop.mesh, this.shock.mesh);
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
    this.mark.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.foe.copy(this.mark);
    const fwd = this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tip.copy(ctx.from).addScaledVector(fwd, 0.75).setY(1.95);
    this.base.copy(ctx.from).addScaledVector(fwd, 0.45).setY(0.95);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hitDone = this.pulled = this.stunned = false;
    this.arcTimer = this.sparkTimer = 0;
    this.starAt = -1;
    clearScreenFx(this.screen);
    this.tree.reset();
    this.sparks.reset();
    this.magnet.visible = this.ring.visible = this.ringDark.visible = false;
    this.pop.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
  }

  /** The enemy's live feet. */
  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  /** Where the pull goes: her nearest rod to the enemy now (`rod` true), else her own feet. */
  private pullSpot() {
    const ctx = this.ctx;
    if (!ctx) return { x: this.foe.x, z: this.foe.z, rod: false };
    const r = nearestRod(ctx.caster, this.foe.x, this.foe.z);
    if (r) return { x: r.x, z: r.z, rod: true };
    const p = ctx.caster.group.position;
    return { x: p.x, z: p.z, rod: false };
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
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

    if (t < HIT_T + 0.1) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.05) {
        this.sparkTimer -= 0.05;
        this.sparks.along(this.base, this.tip, 3, 2.4);
      }
    }
    if (!this.hitDone && t >= HIT_T) {
      this.hitDone = true;
      this.mark20();
    }
    if (this.hitDone && !this.pulled) {
      // Thin arcs run from the enemy toward where it will be pulled, so the answer is readable: walk the other way.
      this.arcTimer += dt;
      while (this.arcTimer >= 0.13) {
        this.arcTimer -= 0.13;
        const d = this.pullSpot();
        this.v1.copy(this.foe).setY(1.2);
        this.v2.set(d.x, d.rod ? ROD_TOP : 1.2, d.z);
        this.tree.strike(this.v1, this.v2, 1, 0.07, 0.17, { hold: 0.5, levels: 1, jag: 0.8 });
      }
    }
    if (!this.pulled && t >= PULL_T) {
      this.pulled = true;
      this.pull();
    }
    if (this.pulled && t < SLIDE_END) {
      // The slide: a thin arc from the spot to the enemy as it moves.
      this.arcTimer += dt;
      while (this.arcTimer >= 0.07) {
        this.arcTimer -= 0.07;
        this.v1.copy(this.foe).setY(1.2);
        this.tree.strike(this.destTop, this.v1, 1, 0.09, 0.12, { hold: 0.5, levels: 1, jag: 0.7 });
      }
    }
    this.layout(t);
  }

  /** The bolt jumps to the enemy: 20, and the mark. */
  private mark20() {
    const ctx = this.ctx;
    this.v1.copy(this.foe).setY(1.2);
    this.tree.strike(this.tip, this.v1, 3, 0.2, 0.45, { hold: 0.4, levels: 2 });
    this.sparks.burst(this.v1, 10, 5);
    this.starAt = this.time;
    this.shake = 0.14;
    if (ctx && this.target) {
      ctx.hit(this.target, { damage: this.settings.damage, knock: 0, from: ctx.from, color: STORM_CSS.body, projectile: true });
    }
  }

  /** The pull: one hit that moves the enemy, with the stun on the same hit when the pull reaches the rod. */
  private pull() {
    const ctx = this.ctx;
    const d = this.pullSpot();
    this.dest.set(d.x, 0, d.z);
    this.destTop.set(d.x, d.rod ? ROD_TOP : 1.2, d.z);
    this.v1.copy(this.foe).setY(1.2);
    this.tree.strike(this.destTop, this.v1, 3, 0.26, 0.5, { hold: 0.4, levels: 2 });
    this.sparks.burst(this.v1, 10, 5);
    this.shake = 0.2;
    if (!ctx || !this.target) return;
    // The distance before the pull, on the live position: the engine stops the pull STOP short of `from`, so it ends within
    // 1.05 m of the rod when the enemy starts 3 + STOP + margin or closer.
    const p = this.target.group.position;
    const before = Math.hypot(p.x - d.x, p.z - d.z);
    this.stunned = d.rod && before <= this.settings.pull + STOP + REACH_MARGIN;
    ctx.hit(this.target, {
      damage: 0, knock: 0, pull: this.settings.pull, from: this.dest.clone(), color: STORM_CSS.body, projectile: true,
      status: this.stunned ? { kind: 'stun', seconds: this.settings.stunSeconds } : undefined,
    });
    if (this.stunned) this.starAt = this.time;
  }

  private layout(t: number) {
    // The wind-up circle round the enemy, then the magnet mark (a horseshoe over its head and a ring on the floor) until the pull.
    const marked = this.hitDone && t < SLIDE_END;
    this.ring.visible = this.ringDark.visible = marked;
    this.magnet.visible = marked;
    if (marked) {
      const k = smoothstep((t - HIT_T) / 0.15);
      const pulse = 1 + 0.08 * Math.sin(t * 20);
      const s = MARK_R * (0.8 + 0.2 * k) * (t < PULL_T ? 1 - 0.25 * smoothstep((t - HIT_T) / (PULL_T - HIT_T)) : 0.75);
      this.ring.position.set(this.foe.x, 0.07, this.foe.z);
      this.ringDark.position.set(this.foe.x, 0.065, this.foe.z);
      this.ring.scale.set(s * pulse, 1, s * pulse);
      this.ringDark.scale.set(s * pulse, 1, s * pulse);
      this.magnet.position.set(this.foe.x, 3.2, this.foe.z);
      this.magnet.rotation.set(0, t * 6, 0.2 * Math.sin(t * 9));
    }
    if (this.starAt >= 0) {
      const sp = StarBurst.pop(t - this.starAt, 0, 0.03);
      this.v1.copy(this.foe).setY(1.3);
      this.pop.set(this.v1, (this.stunned && t >= PULL_T ? 1.2 : 0.9) * sp.scale, sp.opacity, 0.2);
    }
    if (this.pulled) {
      const p = THREE.MathUtils.clamp((t - PULL_T) / 0.35, 0, 1);
      this.shock.set(this.foe, 0.4 + 1.4 * p, 0.035 * (1 - p) * (1 - p));
    }
    this.screen.darken = 0.15 * smoothstep(t / 0.3) * (1 - smoothstep((t - 1.2) / 0.5));
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.025);
    this.screen.focus.copy(this.foe).setY(1.1);
    this.shake *= 0.9;
  }
}

export const polarityModule: EffectModule = {
  label: 'polarity',
  category: 'hero: storm',
  // Click an enemy (8 m): 20 at once, the pull a second later. Both hits are `projectile`; the red circle on the enemy is the warning.
  targeting: { mode: 'enemy' },
  create: () => new Polarity(),
  telegraphs(effect) {
    const e = effect as Polarity;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.mark.x, z: e.mark.z, radius: MARK_R }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Polarity;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Polarity).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 80, 1);
    f.add(s, 'pull', 0, 4, 0.1);
    f.add(s, 'stunSeconds', 0, 2, 0.1);
  },
};
