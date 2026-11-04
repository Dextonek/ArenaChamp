import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { LightningTree, Puddles, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { addRod } from '../../traits/storm';

/**
 * Sky Strike (storm kit v5, Q, rhythm tool: a targeted bolt, `projectile` hit). A click on an enemy (7 m, sight checked by the
 * engine at the cast). She points the hooked staff; a blue ring closes round the enemy on both screens and follows it for
 * 0.35 s while a small dark cloud gathers over it and sparks crackle along the staff. At 0.35 s one thick lightning tree falls
 * from the cloud onto the enemy's LIVE position (it cannot be walked out of; the red circle from `telegraphs` is the warning):
 * 50, `projectile: true`. Then the spell plants a rod 1.5 m in front of the enemy, toward her (`addRod` in
 * `src/traits/storm.ts`, on both screens, and after the hit, so the arcs of its own hit do not use it up): a ground fork runs
 * from the strike to the rod. The rod lands short on purpose: it is 1.5 m from the enemy, so it is not grounded at once.
 * Rods already standing within 5 m of the enemy arc on this hit as the passive says (the trait's `dealt`). Cooldown 4.
 * Network duels: the rod's spot is worked out on each screen from the live positions, so the two lists may differ by a
 * few centimetres. Clean by 1.4 s.
 */
export interface SkyStrikeSettings {
  damage: number;
  loop: boolean;
}

export const defaultSkyStrike = (): SkyStrikeSettings => ({ damage: 60, loop: false });

// Timeline (seconds).
const STRIKE_T = 0.35;
const OUT_T = 1.0;
const DURATION = 1.4;
const MARK_R = 1.2;
const ROD_GAP = 1.5; // the rod stands this far in front of the enemy, toward her
const SKY = 9.5;

export class SkyStrike implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SkyStrikeSettings;
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
  private struck = false;
  private dried = false;
  private sparkTimer = 0;
  private foe = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private base = new THREE.Vector3();

  // Parts.
  private tree = new LightningTree(6);
  private sparks = new Sparks(80);
  private puddles = new Puddles();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.hot, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  private ringDark = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.2, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.dark, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
  );
  private cloud = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8).scale(1.5, 0.55, 1.5),
    new THREE.MeshBasicMaterial({ color: 0x1d2a40, transparent: true, opacity: 0.92, depthWrite: false }),
  );

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SkyStrikeSettings = defaultSkyStrike()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    this.ring.renderOrder = this.ringDark.renderOrder = 4;
    this.cloud.renderOrder = 5;
    this.group.add(this.puddles.mesh, this.ringDark, this.ring, this.cloud, this.tree.mesh, this.sparks.mesh, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STRIKE_T;
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
    this.sparkTimer = 0;
    this.struck = false;
    this.dried = false;
    clearScreenFx(this.screen);
    this.tree.reset();
    this.sparks.reset();
    this.puddles.reset();
    this.ring.visible = this.ringDark.visible = this.cloud.visible = false;
    this.pop.set(this.foe, 0, 0);
    this.groundShock.set(this.foe, 0, 0);
  }

  /** The enemy's live feet (the strike follows it). */
  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
    this.puddles.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    if (!this.struck) this.liveFoe();

    // Wind-up: sparks along the staff, a cloud gathers over the enemy, the ring closes in on it.
    if (t < STRIKE_T) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.05) {
        this.sparkTimer -= 0.05;
        this.sparks.along(this.base, this.tip, 3, 2.4);
      }
      const p = smoothstep(t / STRIKE_T);
      this.ring.visible = this.ringDark.visible = true;
      this.ring.position.set(this.foe.x, 0.07, this.foe.z);
      this.ringDark.position.set(this.foe.x, 0.065, this.foe.z);
      const rs = MARK_R * (2.0 - 1.0 * p);
      this.ring.scale.set(rs, 1, rs);
      this.ringDark.scale.set(rs, 1, rs);
      this.cloud.visible = true;
      this.cloud.position.set(this.foe.x, SKY, this.foe.z);
      this.cloud.scale.setScalar(Math.max(1e-3, 1.1 * smoothstep(t / 0.2)));
    } else {
      this.ring.visible = this.ringDark.visible = false;
      this.cloud.scale.setScalar(Math.max(1e-3, 1.1 * (1 - smoothstep((t - STRIKE_T - 0.25) / 0.35))));
      this.cloud.visible = t < STRIKE_T + 0.6;
    }

    if (!this.struck && t >= STRIKE_T) {
      this.struck = true;
      this.liveFoe();
      this.strike();
    }
    if (this.struck) {
      const after = t - STRIKE_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.v1.copy(this.foe).setY(1.1);
      this.pop.set(this.v1, 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.foe, 0.4 + 1.8 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.2 * Math.exp(-after * 14);
      if (!this.dried && t >= OUT_T - 0.4) {
        this.dried = true;
        this.puddles.dry(0.4);
      }
    }
    this.screen.darken = 0.2 * smoothstep((t - 0.05) / 0.3) * (1 - smoothstep((t - 0.9) / 0.4));
    this.screen.impact = impactFrameAt(t, STRIKE_T, [1], 0.03);
    this.screen.focus.copy(this.foe).setY(1.1);
  }

  /** The strike: a tree from the cloud, a ground fork, the hit, then the rod. */
  private strike() {
    const ctx = this.ctx;
    const life = OUT_T - STRIKE_T;
    this.v1.set(this.foe.x, SKY, this.foe.z);
    this.v2.copy(this.foe).setY(1.1);
    this.tree.strike(this.v1, this.v2, 4, 0.34, life, { hold: 0.4, levels: 3, groundForks: 2 });
    this.sparks.burst(this.v2, 14, 6);
    this.puddles.wet(this.foe, 1.6);
    this.puddles.ripple(this.foe, 1.6);
    this.shake = 0.22;
    if (!ctx) return;
    const from = ctx.caster.group.position;
    // The rod's spot: 1.5 m in front of the enemy, toward her.
    let dx = from.x - this.foe.x, dz = from.z - this.foe.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const rx = this.foe.x + dx * ROD_GAP, rz = this.foe.z + dz * ROD_GAP;
    // `projectile: true`: the strike is judged on the live position, so it cannot be walked out of.
    if (this.target) {
      ctx.hit(this.target, { damage: this.settings.damage, knock: 0, from: ctx.from, color: STORM_CSS.body, projectile: true });
    }
    // The rod goes in after the hit, so this hit's arcs do not use it up.
    addRod(ctx.caster, rx, rz);
    // A fork runs along the floor from the strike to the rod.
    this.v1.copy(this.foe).setY(0.5);
    this.v2.set(rx, 0.3, rz);
    this.tree.strike(this.v1, this.v2, 1, 0.14, life * 0.7, { hold: 0.4, levels: 2 });
    this.puddles.ripple(this.v2, 1.0);
  }
}

export const skyStrikeModule: EffectModule = {
  label: 'sky strike',
  category: 'hero: storm',
  // Click an enemy (7 m): the strike always lands (`projectile`), the red circle on it is the warning.
  targeting: { mode: 'enemy' },
  create: () => new SkyStrike(),
  telegraphs(effect) {
    const e = effect as SkyStrike;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.mark.x, z: e.mark.z, radius: MARK_R }, start: 0, impact: STRIKE_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SkyStrike;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as SkyStrike).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
