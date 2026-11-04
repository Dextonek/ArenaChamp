import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { ClawArcs, Clods, LampGlow, MOLE, MOLE_CSS, Puffs } from '../../effects/parts/mole';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { CLAW_ANGLE, CLAW_DAMAGE, CLAW_REACH, CLAW_WIND } from '../../traits/mole';

/**
 * Claw (mole kit, Q: a swipe). Mabel digs in her heels (puffs of dirt, her helmet lamp flickers up) and rakes her huge digging claws
 * across the cone in front of her (2.5 m, 120 degrees: the same shape the telegraph draws) at 0.4 s: three gold strokes sweep over the
 * ground on dark ones, clods fly out along the swipe, a little pale star pops. Everyone inside the cone on their live position takes 45.
 * The cone's apex is `sentFrom` and its heading the caster's facing at the cast, so both screens agree. Telegraph: the cone, impact at
 * the swipe (she is rooted 0.4 s). Clean by about 1.2 s. See pipeline/designs/kit-mole.md.
 */
export interface MoleClawSettings {
  damage: number;
  loop: boolean;
}

export const defaultMoleClaw = (): MoleClawSettings => ({ damage: CLAW_DAMAGE, loop: false });

const DURATION = 1.3;
const SWEEP = 0.14;

export class MoleClaw implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MoleClawSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CLAW_REACH, angle: CLAW_ANGLE, dir: 0 };
  private time = 0;
  private swung = false;
  private yaw = 0;
  private from = new THREE.Vector3();
  private head = new THREE.Vector3();
  private lastDrip = 0;

  private clods = new Clods(26);
  private puffs = new Puffs(10);
  private arcs = new ClawArcs(CLAW_REACH, (CLAW_ANGLE * Math.PI) / 180);
  private lamp = new LampGlow();
  private star = new StarBurst({ points: 8, inner: 0.3, color: MOLE.foil, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MoleClawSettings = defaultMoleClaw()) {
    this.settings = settings;
    this.group.add(this.clods.mesh, this.puffs.mesh, this.arcs.mesh, this.lamp.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return CLAW_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.yaw = ctx.caster.group.rotation.y;
    this.from.set(s.x, 0, s.z);
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: CLAW_REACH, angle: CLAW_ANGLE, dir: this.yaw };
    this.head.set(s.x, 1.65, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = false;
    this.lastDrip = 0;
    this.clods.reset();
    this.puffs.reset();
    this.arcs.set(this.from, this.yaw, 0, 0);
    this.lamp.set(this.head, 0, 0);
    this.star.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.clods.update(dt);
    this.puffs.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const fwd = this.v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // --- Wind-up: she digs her heels in, dirt crumbles off the raised claws, the lamp flickers up. ---
    if (t < CLAW_WIND) {
      if (t - this.lastDrip >= 0.07) {
        this.lastDrip = t;
        this.v2.set(this.from.x + fwd.x * 0.3, 0.2, this.from.z + fwd.z * 0.3);
        if (t < 0.1) this.puffs.puff(this.v2, 0.55);
        this.v2.set(this.from.x + fwd.x * 0.7 + fwd.z * 0.5, 1.6, this.from.z + fwd.z * 0.7 - fwd.x * 0.5);
        this.clods.throw(this.v2, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6), 0.1, 0.7);
      }
      const k = t / CLAW_WIND;
      this.lamp.set(this.head, 0.5 + 0.9 * k, 0.5 + 0.5 * Math.sin(t * 40) * 0.3 + 0.3 * k);
    }

    // --- The swipe. ---
    if (!this.swung && t >= CLAW_WIND) {
      this.swung = true;
      this.shake = 0.12;
      this.v2.set(this.from.x + fwd.x * 0.8, 0.5, this.from.z + fwd.z * 0.8);
      this.clods.fan(this.v2, fwd, 9, 6.5, 0.9);
      this.puffs.puff(this.v2.set(this.from.x + fwd.x * 1.4, 0.3, this.from.z + fwd.z * 1.4), 0.8);
      if (ctx) {
        const foes = ctx.enemies?.() ?? ctx.targets;
        for (const e of foes) {
          const p = e.group.position;
          if (!insideTelegraph(this.cone, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 2.5, from: ctx.from, color: MOLE_CSS.soil });
        }
      }
    }
    const a = t - CLAW_WIND;
    if (a >= 0) {
      const sweep = Math.min(1, a / SWEEP);
      this.arcs.set(this.from, this.yaw, sweep, 1 - THREE.MathUtils.smoothstep(a, 0.15, 0.45));
      const sp = StarBurst.pop(a, 0.03, 0.12);
      this.star.set(this.v2.set(this.from.x + fwd.x * 1.5, 1.0, this.from.z + fwd.z * 1.5), 1.1 * sp.scale, sp.opacity, a * 6);
      this.lamp.set(this.head, 1.1, Math.max(0, 0.9 - a * 3));
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const moleClawModule: EffectModule = {
  label: 'mole claw',
  category: 'hero: mole',
  // Quick, no aim: the cone is centred on her and the radius is the reach the CPU uses it at.
  targeting: { mode: 'self', radius: CLAW_REACH },
  create: () => new MoleClaw(),
  telegraphs(effect) {
    const e = effect as MoleClaw;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: CLAW_WIND }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MoleClaw;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MoleClaw).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
