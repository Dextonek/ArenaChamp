import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BOLT_Y, Flyers, MAGIC, MAGIC_CSS, Pieces } from '../../effects/parts/magic';
import { boltWidth } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { SAW_DAMAGE, SAW_RADIUS, SAW_RANGE, SAW_SLOW, SAW_SPEED, SAW_WIND } from '../../traits/magic';

/**
 * Sawn in Half (magic kit, W: the saw). The Great Zambini snaps his fingers: over the 0.3 s wind-up a long toothed saw blade with a gold
 * and violet grip is drawn out of thin air at his hand in a puff of confetti, then slides at the enemy as one real bolt (`ctx.projectile`:
 * 8 m, 18 m/s, radius 0.35), rocking as it goes, with a trail of gold stars. 50 damage and slowed 1.5 s (the hit carries the slow, and
 * so does the cast's mods, which is what reaches a network duel). It reaches 6 m at 0.63 s. A hit throws a fan of confetti, stars and two
 * halves of a card; a miss or a wall pops it into confetti.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from the cast to where the blade ends (shortened at a wall
 * as the bolt is); `impact` is the launch (0.3 s). Network duels: the caster's screen draws the same blade along the same line. Clean by
 * about 2.2 s. See pipeline/designs/kit-magic.md.
 */
export interface SawnInHalfSettings {
  damage: number;
  knock: number;
  slow: number;
  loop: boolean;
}

export const defaultSawnInHalf = (): SawnInHalfSettings => ({ damage: SAW_DAMAGE, knock: 1.5, slow: SAW_SLOW, loop: false });

const MUZZLE = 0.8;
const LINE_W = boltWidth(SAW_RADIUS);
const MAX_T = 2.2;

export class SawnInHalf implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SawnInHalfSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private ended = false;
  private flash = { age: 9, pos: new THREE.Vector3(), size: 1 };

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private range = SAW_RANGE - MUZZLE;
  private hand = new THREE.Vector3();

  private confetti = new Pieces('confetti', 110);
  private stars = new Pieces('star', 50);
  private loose = new Pieces('card', 8, 9);
  private flyers = new Flyers('saw', 1, this.stars, 2.0);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MAGIC.violet, core: MAGIC.hot, additive: false });

  private v1 = new THREE.Vector3();

  constructor(settings: SawnInHalfSettings = defaultSawnInHalf()) {
    this.settings = settings;
    this.group.add(this.confetti.mesh, this.stars.mesh, this.loose.mesh, this.flyers.group, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return SAW_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const path = bankPath(this.start, this.dir, SAW_RANGE - MUZZLE, 0, ctx.obstacles?.() ?? []);
    const e = path[path.length - 1];
    this.range = Math.max(0.1, Math.hypot(e.x - this.start.x, e.z - this.start.z));
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
      start: 0,
      impact: SAW_WIND,
      until: SAW_WIND + (MUZZLE + this.range) / SAW_SPEED,
    }];
    this.hand.set(s.x + dx * 0.8, 1.2, s.z + dz * 0.8);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.ended = false;
    this.flash.age = 9;
    this.confetti.reset();
    this.stars.reset();
    this.loose.reset();
    this.flyers.reset();
    this.pop.set(this.hand, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.confetti.update(dt);
    this.stars.update(dt);
    this.loose.update(dt);
    this.flyers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the saw is drawn out of the air, growing and turning to the aim, in a spray of confetti. ---
    if (t < SAW_WIND) {
      const k = THREE.MathUtils.smoothstep(t / SAW_WIND, 0, 1);
      this.flyers.show(0, this.hand, this.dir, 0.3 + 0.7 * k, 0, t);
      if (Math.random() < dt * 60) this.confetti.burst(this.v1.copy(this.hand), 1, 1.6, { size: 0.14, life: 0.6, up: 0.4 });
    }

    // --- Fire: one real bolt, or a drawn blade along the same line. ---
    if (!this.fired && t >= SAW_WIND) {
      this.fired = true;
      this.shake = 0.06;
      this.stars.burst(this.v1.copy(this.hand), 6, 3, { size: 0.22, life: 0.7, up: 0.4 });
      const from = new THREE.Vector3(this.start.x, BOLT_Y, this.start.z);
      const bolt = ctx?.projectile?.({
        from, dir: this.dir.clone(), speed: SAW_SPEED, range: this.range, radius: SAW_RADIUS,
        hit: { damage: s.damage, knock: s.knock, color: MAGIC_CSS.steel, status: { kind: 'slow', seconds: s.slow } },
      }) ?? null;
      this.flyers.launch(0, { bolt, from, dir: this.dir, speed: SAW_SPEED, range: this.range, onEnd: (at, hit) => this.land(at, hit) });
    }

    this.flash.age += dt;
    const sp = StarBurst.pop(this.flash.age, 0.04, 0.14);
    this.pop.set(this.flash.pos, this.flash.size * sp.scale, sp.opacity, this.flash.age * 4);
    this.shake *= Math.exp(-dt * 12);

    if (t >= MAX_T || (this.ended && !this.confetti.busy && !this.stars.busy && !this.loose.busy)) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  private land(at: THREE.Vector3, hit: boolean) {
    this.ended = true;
    this.flash.age = 0;
    this.flash.pos.copy(at);
    this.flash.size = hit ? 2.2 : 1.0;
    this.confetti.burst(at, hit ? 34 : 14, hit ? 6 : 3, { size: 0.17, life: 1.0 });
    this.stars.burst(at, hit ? 9 : 3, hit ? 4.6 : 2.4, { size: 0.26, life: 0.9, up: 1 });
    if (hit) {
      this.loose.burst(at, 2, 4.4, { size: 0.5, life: 1.0, up: 1.2 });
      this.shake = Math.max(this.shake, 0.16);
    }
  }
}

export const sawnInHalfModule: EffectModule = {
  label: 'sawn in half',
  category: 'hero: magic',
  targeting: { mode: 'ground', radius: SAW_RADIUS },
  create: () => new SawnInHalf(),
  telegraphs(effect) {
    const e = effect as SawnInHalf;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SawnInHalf;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SawnInHalf).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
