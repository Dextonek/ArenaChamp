import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { CrescentArc } from '../../effects/parts';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cleave test (mechanics, melee): a 100 degree, 3.2 m cone from the caster toward the target. A big flat crescent
 * swings through it and, at 0.25 s, everyone still inside the cone takes 45 (tuned from 30 by the duel sims) and a small knock. Targeting is
 * `enemies` (the whole pack as `targets`), because a cleave hits all of them, not just the clicked one. A tool for
 * checking melee, not a hero spell.
 */
export interface CleaveTestSettings {
  damage: number;
  knock: number;
}

export const defaultCleaveTest = (): CleaveTestSettings => ({ damage: 45, knock: 2 });

const CONE_ANGLE = 100;
const CONE_RADIUS = 3.2;
const HIT_T = 0.25;
const SWING_START = 0.06;
const SWING_T = 0.26;
const DURATION = 0.8;
const SWEEP = THREE.MathUtils.degToRad(120);
const TAIL = 0.45;

export class CleaveTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CleaveTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cone of the last cast (from the caster toward the target). */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: 0 };
  private time = 0;
  private hit = false;

  private pivot = new THREE.Group();
  private arc = new CrescentArc({
    radius: 2.35, width: 1.2, sweep: SWEEP, style: 'toon', edge: 0xf4f8ff, mid: 0xa9bdd6, outer: 0x2b3a50,
  });

  constructor(settings: CleaveTestSettings = defaultCleaveTest()) {
    this.settings = settings;
    // The arc lies in the mesh's XY plane; laid flat (rx -90 deg) its local angle b points along (cos b, 0, -sin b),
    // so it is centred on the pivot's +Z (the aim) by starting at -90 deg - half the sweep.
    this.arc.mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2 - SWEEP / 2);
    this.pivot.add(this.arc.mesh);
    this.group.add(this.pivot);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.cone = { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: ctx.aim };
  }

  play() {
    this.time = 0;
    this.hit = false;
    this.playing = true;
    const c = this.cone;
    if (c.kind === 'cone') {
      this.pivot.position.set(c.x, 1.0, c.z);
      this.pivot.rotation.y = c.dir;
    }
    this.arc.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.arc.opacity = 0;
      return;
    }
    const t = this.time;
    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      const ctx = this.ctx;
      if (ctx) {
        // Re-check at the swing: everyone still inside the cone is hit, the primary target or not.
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.cone, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: ctx.from, color: '#dfe8f4' });
        }
      }
    }
    // The head sweeps across the cone with a tail behind it, then the arc thins out.
    const k = THREE.MathUtils.clamp((t - SWING_START) / (SWING_T - SWING_START), 0, 1);
    const out = 1 - (1 - k) ** 2;
    this.arc.length = TAIL;
    this.arc.head = out * (1 + TAIL);
    this.arc.time = t;
    this.arc.erosion = Math.max(0, (t - SWING_T) / (DURATION - SWING_T)) * 0.9;
    this.arc.opacity = t < SWING_START ? 0 : 0.95 * Math.max(0, 1 - Math.max(0, t - SWING_T) / (DURATION - SWING_T));
  }
}

export const cleaveTestModule: EffectModule = {
  label: 'cleave test',
  category: 'test: mechanics',
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new CleaveTest(),
  telegraphs(effect) {
    const e = effect as CleaveTest;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
  frameCamera(camera, controls, effect) {
    const e = effect as CleaveTest;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CleaveTest).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
