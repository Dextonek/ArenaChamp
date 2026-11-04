import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { BLOOD, BloodDrops, BloodSigil, BloodTendril, ShockRefraction, StarBurst } from '../../effects/parts';
import { BloodMist } from '../../effects/parts/blood';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mist Waltz (blood kit v5, W: a 5 m flow as mist). No damage: the spell is a dash. A bone sigil draws itself under Vesper's
 * feet and she comes apart into a cloud of blood-red mist (puffs and drops); at 0.06 s she slides 5 m toward the aim in
 * 0.2 s (`ctx.moveCaster`, 0.2 s) trailing a ribbon of mist that thins from its root, and at the end of the slide the mist
 * folds back into her with a small star, a ring on the ground and a second sigil. She is not untouchable and there is no
 * telegraph. The trait (`src/traits/blood.ts`) arms her next two basic attacks for 3 s (+18 damage, +1.5 m reach, shown as
 * two drop pips on her) and costs 20 HP. Built from `sentFrom` and `point`, so both screens of a network duel draw the same
 * path; her real move is her own client's (`moveCaster`), the other screen has none and she follows her streamed position.
 * Clean by 1.3 s.
 */
export interface MistWaltzSettings {
  loop: boolean;
}

export const defaultMistWaltz = (): MistWaltzSettings => ({ loop: false });

// Timeline (seconds).
const DASH_T = 0.06;
const DASH_LEN = 0.2;
const DURATION = 1.3;
const DISTANCE = 5;

const UP = new THREE.Vector3(0, 1, 0);

export class MistWaltz implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MistWaltzSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where she flowed from, and where the flow would end unobstructed. */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private land = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private time = 0;
  private flags = { sigil: false, dashed: false, arrived: false };
  private arriveAt = -1;

  // Parts.
  private sigilA = new BloodSigil({ color: 0xf2dcb4, inner: false });
  private sigilB = new BloodSigil({ color: 0xf2dcb4, inner: false });
  private mist = new BloodMist(72);
  private ribbon = new BloodTendril({ segments: 24 });
  private drops = new BloodDrops({ maxSplats: 6 });
  private star = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MistWaltzSettings = defaultMistWaltz()) {
    this.settings = settings;
    this.ribbon.width = 0.4;
    this.ribbon.bead = 0;
    this.ribbon.wobble = 0.05;
    this.ribbon.setPoints(this.pts);
    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.0;
    this.group.add(this.sigilA.mesh, this.sigilB.mesh, this.ribbon.mesh, this.mist.mesh, this.drops.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DASH_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens lay the path from where she really stood and the aim point (`from` is where she is drawn online).
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.lengthSq() < 0.09) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.fwd.copy(this.v1).normalize();
    this.want.copy(this.start).addScaledVector(this.fwd, DISTANCE);
    this.land.copy(this.want);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arriveAt = -1;
    this.flags.sigil = this.flags.dashed = this.flags.arrived = false;
    this.land.copy(this.want);
    this.sigilA.reset();
    this.sigilB.reset();
    this.mist.reset();
    this.ribbon.reset();
    this.drops.reset();
    this.star.set(this.start, 0, 0);
    this.shock.set(this.start, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.mist.update(dt);
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
    const f = this.flags;

    if (!f.sigil) {
      // She comes apart: mist boils up round her body and drops fly off it.
      f.sigil = true;
      this.v1.copy(this.start).setY(0.3);
      this.v2.copy(this.start).setY(1.7);
      this.mist.stream(this.v1, this.v2, 9, 0.35, 0.9, 0.7, 0, 0.12);
      this.drops.spray(this.v1.setY(1.0), UP, 8, 3.5, 0.9);
    }
    if (!f.dashed && t >= DASH_T) {
      f.dashed = true;
      this.land.copy(ctx?.moveCaster ? ctx.moveCaster(this.want, DASH_LEN) : this.want).setY(0);
      // A trail of mist along the whole path, thickest where she left.
      this.v1.copy(this.start).setY(0.6);
      this.v2.copy(this.land).setY(0.6);
      this.mist.stream(this.v1, this.v2, 16, 0.4, 1.0, 0.9, 0, DASH_LEN);
      this.shake = 0.1;
    }
    if (f.dashed && !f.arrived && t >= DASH_T + DASH_LEN) {
      // The mist folds back into her at the landing.
      f.arrived = true;
      this.arriveAt = t;
      this.v1.copy(this.land).setY(0.4);
      this.v2.copy(this.land).setY(1.5);
      this.mist.stream(this.v1, this.v2, 8, 0.5, 0.2, 0.45, 0, 0.1);
      this.drops.spray(this.v1.setY(1.0), UP, 6, 3, 0.8);
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;

    // --- Sigils: one under her feet as she comes apart, a smaller one where she lands. ---
    this.sigilA.set(this.v1.copy(this.start).setY(0.04), UP, 1.0, t * 0.8);
    this.sigilA.reveal = smoothstep(t / 0.15);
    this.sigilA.opacity = 1 - smoothstep((t - 0.4) / 0.4);
    if (f.arrived) {
      const k = t - this.arriveAt;
      this.sigilB.set(this.v1.copy(this.land).setY(0.04), UP, 0.8, -t * 0.8);
      this.sigilB.reveal = smoothstep(k / 0.15);
      this.sigilB.opacity = 1 - smoothstep((k - 0.3) / 0.4);
    }

    // --- The ribbon of mist along the ground path: runs out with the slide, then thins from its root. ---
    if (f.dashed) {
      this.pts[0].copy(this.start).setY(0.7);
      this.pts[2].copy(this.land).setY(0.7);
      this.pts[1].lerpVectors(this.pts[0], this.pts[2], 0.5).setY(0.95);
      this.ribbon.head = smoothstep((t - DASH_T) / DASH_LEN);
      this.ribbon.tail = smoothstep((t - DASH_T - 0.1) / 0.5);
      this.ribbon.update(t);
    } else {
      this.ribbon.mesh.visible = false;
    }

    // --- The pop where she lands and a ring on the ground. ---
    if (f.arrived) {
      const k = t - this.arriveAt;
      const sp = StarBurst.pop(k, 0, 0.03);
      this.star.set(this.v1.copy(this.land).setY(1.1), 0.8 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(k / 0.3, 0, 1);
      this.shock.set(this.land, 0.4 + 1.6 * gp, 0.02 * (1 - gp) * (1 - gp));
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const mistWaltzModule: EffectModule = {
  label: 'mist waltz',
  category: 'hero: blood',
  // Aimed at a spot (the flow goes toward it, 5 m at most). No damage, so the radius only decides who is in `targets`.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new MistWaltz(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MistWaltz;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as MistWaltz).settings, 'loop');
  },
};
