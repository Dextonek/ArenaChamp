import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BoneHand, BoneShards, BoneSpire, SoulWisps, skeletonLook } from '../../effects/parts/bone';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Grave Grasp (bone kit v4, R: a pull that holds). The chosen enemy's feet are marked (a ring on the floor that follows
 * them, soulfire flickering up round it, the ground trembling), and at 0.6 s a giant skeletal hand bursts up behind it
 * (the arm rises out of the floor, fingers open, palm toward Mortis): bone spires, dust, chips, a ground ripple, an
 * impact frame and 60 damage with a short root (`projectile: true`: the grasp is a sure hit once cast). The fingers close
 * round it (0.1 s) and the hand drags it toward Mortis, 4 m at most and never closer than 1.1 m to him, over 0.8 s
 * (`ctx.carry` every frame, on the victim's live position: offline it moves the enemy hero, in a network duel only this
 * side's own hero, as in forgeCharge.ts). Where the context has no `carry` the burst's hit pulls it instead. At the end
 * the hand squeezes (28 damage, rooted 1 s, a second impact frame) while two skeletons claw out beside the victim
 * (`ctx.summon`, 2 units) and two skull-capped spires rise. The hand opens, sinks back into the floor and is gone
 * by 3.2 s. See pipeline/designs/kit-bone.md.
 */
export interface GraveGraspSettings {
  /** Damage when the hand bursts up. */
  damage: number;
  /** Damage of the squeeze at the end of the drag. */
  squeeze: number;
  /** Metres the victim is dragged (the hit pull cap is 4). */
  drag: number;
  /** Seconds the victim is rooted after the drag (engine cap 1.5). */
  root: number;
  /** HP, lifetime and attack damage of each of the two skeletons. */
  hp: number;
  seconds: number;
  attack: number;
  loop: boolean;
}

export const defaultGraveGrasp = (): GraveGraspSettings => ({ damage: 60, squeeze: 28, drag: 4, root: 1, hp: 50, seconds: 7, attack: 8, loop: false });

// Timeline (seconds).
const BURST_T = 0.6; // the hand bursts up
const RISE_S = 0.25;
const CLOSE_T = 0.85; // the fingers close
const DRAG_T0 = 0.9;
const DRAG_S = 0.8;
const DRAG_END = DRAG_T0 + DRAG_S; // the squeeze and the skeletons
const OPEN_T = 2.5;
const SINK_S = 0.55;
const DURATION = 3.3;

const ZONE_R = 1.7;
const HAND_SCALE = 0.62;
const WRIST_UP = 1.3; // wrist height when the hand has risen
const WRIST_DOWN = -1.9; // hidden below the floor
const STOP_SHORT = 1.1; // never drags closer than this to him
const SPIRES = 6;

const easeOutBack = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.0 * t * t * t + 1.0 * t * t;
};

export class GraveGrasp implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GraveGraspSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The zone: on the enemy's live feet until the burst, then where the hand came up. The telegraph reads it. */
  readonly zone: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: ZONE_R };
  private time = 0;
  private flags = { burst: false, closed: false, dragging: false, squeezed: false, opened: false, sunk: false };
  private feet = new THREE.Vector3();
  private total = 0;
  private prevK = 0;
  private away = new THREE.Vector3(0, 0, 1); // from Mortis toward the victim
  private squeezeAt = -1;
  private burstAt = -1;
  private wispT = 0;

  private hand = new BoneHand();
  private spires = Array.from({ length: SPIRES }, (_, i) => new BoneSpire(i >= SPIRES - 2, 5, i + 1));
  private chips = new BoneShards(64);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private star = new StarBurst({ points: 10, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });
  private ripple = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private wrist = new THREE.Vector3();
  private base = new THREE.Vector3();
  private face = new THREE.Vector3();

  constructor(settings: GraveGraspSettings = defaultGraveGrasp()) {
    this.settings = settings;
    this.screen.impactColor.set(BONE.bone);
    this.group.add(
      this.hand.mesh, ...this.spires.map((s) => s.mesh), this.dust.mesh, this.chips.mesh, this.wisps.mesh, this.star.mesh, this.ripple.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const e = ctx.targets[0];
    this.feet.copy(e ? e.group.position : ctx.point).setY(0);
    this.zone.x = this.feet.x;
    this.zone.z = this.feet.z;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((t) => t.group)];
    this.screen.focus.copy(this.feet).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.total = 0;
    this.prevK = 0;
    this.squeezeAt = this.burstAt = -1;
    this.wispT = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.hand.reset();
    for (const s of this.spires) s.reset();
    this.chips.reset();
    this.wisps.reset();
    this.dust.reset();
    this.star.set(this.feet, 0, 0);
    this.ripple.set(this.feet, 0, 0);
  }

  /** Where the victim stands now (the live figure), else the cast-time spot. */
  private victimAt(out: THREE.Vector3) {
    const e = this.ctx?.targets[0];
    return e ? out.set(e.group.position.x, 0, e.group.position.z) : out.copy(this.feet);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.chips.update(dt);
    for (const s of this.spires) s.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;
    const caster = ctx?.caster.group.position;

    // --- Anticipation: the mark follows the enemy; soulfire flickers up round it; the ground trembles. ---
    if (!f.burst) {
      this.victimAt(this.feet);
      this.zone.x = this.feet.x;
      this.zone.z = this.feet.z;
      this.wispT += dt;
      while (this.wispT >= 0.07) {
        this.wispT -= 0.07;
        const a = Math.random() * Math.PI * 2;
        this.wisps.puff(this.v1.set(this.feet.x + Math.cos(a) * ZONE_R * 0.8, 0.05, this.feet.z + Math.sin(a) * ZONE_R * 0.8), 1, 0.2, 0.16);
      }
      const k = t / BURST_T;
      if (Math.random() < dt * (6 + 20 * k)) this.dust.burst(this.v1.set(this.feet.x, 0, this.feet.z), 1, 1.2, 0.3);
      this.shake = Math.max(this.shake, 0.04 + 0.1 * k * k);
      this.screen.darken = 0.2 * smoothstep(t / BURST_T);
    }

    // --- The burst: the hand comes up under (behind) the enemy. ---
    if (!f.burst && t >= BURST_T) {
      f.burst = true;
      this.burstAt = t;
      this.victimAt(this.feet);
      if (caster) this.away.set(this.feet.x - caster.x, 0, this.feet.z - caster.z);
      if (this.away.lengthSq() < 1e-6) this.away.set(0, 0, 1);
      this.away.normalize();
      this.zone.x = this.feet.x;
      this.zone.z = this.feet.z;
      // Spires burst round the rim of the hole.
      for (let i = 0; i < SPIRES - 2; i++) {
        const a = (i / (SPIRES - 2)) * Math.PI * 2 + 0.6;
        this.v1.set(this.feet.x + Math.cos(a) * 1.7, 0, this.feet.z + Math.sin(a) * 1.7);
        this.spires[i].grow(this.v1, 1.2 + ((i * 37) % 10) / 12, 0.25, 0.4, a, 0);
      }
      this.dust.burst(this.v1.set(this.feet.x, 0, this.feet.z), 14, 3.2, 0.55);
      this.dust.ring(this.feet, ZONE_R, 8, 0.55);
      this.chips.burst(this.v1.set(this.feet.x, 0.3, this.feet.z), 20, 6, 5.5, 0.38);
      this.chips.ring(this.feet, 10, ZONE_R + 1, 0.4, 0.8, 0.34);
      this.wisps.puff(this.feet, 8, 1.4, 0.28);
      this.shake = 0.6;
      const e = ctx?.targets[0];
      if (ctx && e) {
        ctx.hit(e, {
          damage: this.settings.damage, knock: 0, from: caster ? caster.clone() : this.feet.clone(), color: BONE_CSS.body, projectile: true,
          status: { kind: 'root', seconds: 0.85 },
          // No carry in this context: the hit drags it (a pull stops 1 m short of Mortis, 4 m at most).
          ...(ctx.carry ? {} : { pull: Math.min(4, this.settings.drag) }),
        });
      }
    }

    // --- The fingers close round the victim. ---
    if (f.burst && !f.closed && t >= CLOSE_T) {
      f.closed = true;
      this.v1.copy(this.feet).setY(1.2);
      this.chips.burst(this.v1, 8, 3, 2, 0.3);
      this.shake = Math.max(this.shake, 0.3);
    }

    // --- The drag: the victim is carried toward Mortis along the live line, eased out like a yank. ---
    if (f.burst && t >= DRAG_T0 && !f.squeezed && ctx && caster) {
      const e = ctx.targets[0];
      if (e) {
        const p = e.group.position;
        const dx = caster.x - p.x, dz = caster.z - p.z;
        const d = Math.hypot(dx, dz);
        if (!f.dragging) {
          f.dragging = true;
          this.total = Math.max(0, Math.min(this.settings.drag, d - STOP_SHORT));
        }
        const k = THREE.MathUtils.clamp((t - DRAG_T0) / DRAG_S, 0, 1);
        const ease = (x: number) => 1 - (1 - x) * (1 - x);
        const want = this.total * (ease(k) - ease(this.prevK));
        this.prevK = k;
        const step = Math.min(want, d - STOP_SHORT);
        if (ctx.carry && step > 1e-4 && d > 1e-4) ctx.carry(e, this.v1.set((dx / d) * step, 0, (dz / d) * step));
        if (Math.random() < dt * 40) this.dust.burst(this.v1.set(p.x - (dx / Math.max(d, 1e-3)) * 0.5, 0, p.z - (dz / Math.max(d, 1e-3)) * 0.5), 1, 1.4, 0.3);
      }
    }

    // --- The squeeze: damage, root, two skeletons beside the victim, two skull spires. ---
    if (f.burst && !f.squeezed && t >= DRAG_END) {
      f.squeezed = true;
      this.squeezeAt = t;
      this.victimAt(this.feet);
      this.zone.x = this.feet.x;
      this.zone.z = this.feet.z;
      this.shake = 0.7;
      const e = ctx?.targets[0];
      if (ctx && e) {
        ctx.hit(e, {
          damage: this.settings.squeeze, knock: 0, from: this.feet.clone(), color: BONE_CSS.hot, projectile: true,
          status: { kind: 'root', seconds: this.settings.root },
        });
        ctx.summon?.({
          kind: 'melee', at: this.feet.clone(), count: 2, hp: this.settings.hp, seconds: this.settings.seconds,
          damage: this.settings.attack, attackEvery: 1, color: BONE_CSS.body, look: skeletonLook,
        });
      }
      // The skeletons climb out on either side; two skull spires mark the places.
      this.v2.set(-this.away.z, 0, this.away.x);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        this.v1.copy(this.feet).addScaledVector(this.v2, side * 1.3);
        this.spires[SPIRES - 2 + i].grow(this.v1, 1.5, 0.28, 0.3, side > 0 ? 0 : Math.PI, 0);
        this.dust.burst(this.v1.setY(0), 5, 2.2, 0.4);
        this.chips.burst(this.v1.setY(0.3), 6, 4, 4, 0.32);
        this.wisps.puff(this.v1, 3, 0.6, 0.22);
      }
      this.v1.copy(this.feet).setY(1.2);
      this.chips.burst(this.v1, 14, 5, 3, 0.34);
    }

    if (f.squeezed && !f.opened && t >= OPEN_T) {
      f.opened = true;
      this.spires.forEach((s, i) => s.crumble(0.45, (i % 3) * 0.05));
      this.wisps.release();
    }
    if (f.opened && !f.sunk && t >= OPEN_T + SINK_S) {
      f.sunk = true;
      this.dust.burst(this.v1.set(this.wrist.x, 0, this.wrist.z), 6, 2, 0.4);
    }

    this.layout(t);
  }

  private layout(t: number) {
    const f = this.flags;
    const ctx = this.ctx;

    // --- The hand: up behind the victim, palm toward Mortis, following the victim through the drag. ---
    if (f.burst && !f.sunk) {
      this.victimAt(this.v1);
      const caster = ctx?.caster.group.position;
      if (caster && f.closed) {
        this.away.set(this.v1.x - caster.x, 0, this.v1.z - caster.z);
        if (this.away.lengthSq() < 1e-6) this.away.set(0, 0, 1);
        this.away.normalize();
      }
      const rise = easeOutBack((t - this.burstAt) / RISE_S);
      const sink = f.opened ? smoothstep((t - OPEN_T) / SINK_S) : 0;
      const y = THREE.MathUtils.lerp(WRIST_DOWN, WRIST_UP, rise) - (WRIST_UP - WRIST_DOWN) * sink;
      this.wrist.set(this.v1.x + this.away.x * 0.7, y, this.v1.z + this.away.z * 0.7);
      this.base.set(this.wrist.x + this.away.x * 2.2, 0, this.wrist.z + this.away.z * 2.2);
      this.face.set(-this.away.x, 0, -this.away.z);
      // Open and reaching while it rises, closing at CLOSE_T, loosening as it lets go.
      const close = smoothstep((t - CLOSE_T) / 0.12);
      const loosen = f.opened ? smoothstep((t - OPEN_T) / 0.3) : 0;
      const curl = 0.08 + 0.85 * close - 0.6 * loosen;
      const pitch = -1.05 + 0.5 * close - 0.2 * loosen;
      this.hand.place(this.base, this.wrist, this.face, pitch, curl, 1 - 0.7 * close, t, HAND_SCALE * (0.4 + 0.6 * Math.min(1, rise)));
    } else {
      this.hand.hide();
    }

    // --- The ring on the floor, the ripple and the star at each impact. ---
    if (this.burstAt >= 0) {
      const a = t - this.burstAt;
      const gp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.ripple.set(this.v1.set(this.zone.x, 0, this.zone.z), 0.5 + 3.2 * gp, 0.045 * (1 - gp) * (1 - gp));
      const sp = StarBurst.pop(a - 0.02, 0, 0.04);
      this.star.set(this.v2.set(this.zone.x, 1.2, this.zone.z), 1.6 * sp.scale, sp.opacity, 0.2);
      this.screen.impact = impactFrameAt(t, this.burstAt, [1], 0.04);
    }
    if (this.squeezeAt >= 0 && t - this.squeezeAt < 0.5) {
      const a = t - this.squeezeAt;
      const gp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.ripple.set(this.v1.set(this.zone.x, 0, this.zone.z), 0.4 + 2.6 * gp, 0.04 * (1 - gp) * (1 - gp));
      const sp = StarBurst.pop(a - 0.02, 0, 0.04);
      this.star.set(this.v2.set(this.zone.x, 1.2, this.zone.z), 1.9 * sp.scale, sp.opacity, 0.2);
      this.screen.impact = impactFrameAt(t, this.squeezeAt, [1], 0.04);
    }
    this.screen.darken = f.burst ? 0.2 * (1 - smoothstep((t - this.burstAt) / 0.6)) : this.screen.darken;
    if (f.burst) this.shake = Math.max(this.shake * 0.9, 0);
  }
}

export const graveGraspModule: EffectModule = {
  label: 'grave grasp',
  category: 'hero: bone',
  // The clicked enemy, else the nearest one.
  targeting: { mode: 'enemy' },
  create: () => new GraveGrasp(),
  telegraphs(effect) {
    const e = effect as GraveGrasp;
    if (!e.ctx) return [];
    // The live zone (moved onto the enemy by the effect until the burst) lets the late hits through the duel's zone check;
    // the hits are also `projectile: true`, so this is the drawn warning.
    return [{ shape: e.zone, start: 0, impact: BURST_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GraveGrasp;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as GraveGrasp).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'squeeze', 0, 100, 1);
    f.add(s, 'drag', 0, 4, 0.5);
    f.add(s, 'root', 0, 1.5, 0.1);
    f.add(s, 'hp', 10, 200, 5);
    f.add(s, 'seconds', 2, 20, 1);
    f.add(s, 'attack', 1, 40, 1);
  },
};
