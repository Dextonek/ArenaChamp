import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { AshMotes, Crackle, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { watchCover } from '../../traits/void';

/**
 * Gravity Slam (void kit v5, Q: a quick slam, no aim). A 3 m circle shows round him from the cast (the telegraph, so the
 * enemy can read it). Over 0.35 s glass cracks run out across the ground to the rim and his weight bears down. At 0.35 s he
 * slams: every enemy inside the circle at that moment (live positions) takes 50 and is dragged 1.5 m
 * toward him (`pull`, `knock: 0`); shards are thrown out and then drawn back in, a cyan star pops at his feet, a ground
 * refraction ring runs out to 3.4 m, one impact frame. The cracks heal from 1.0 s; clean by 1.6 s. Nothing happens on a hit
 * (no refund). The circle is centred on where he stood at the cast (`sentFrom`), the same on both screens.
 */
export interface GravitySlamSettings {
  damage: number;
  /** Metres the hit drags the enemy toward him. */
  pull: number;
  loop: boolean;
}

export const defaultGravitySlam = (): GravitySlamSettings => ({ damage: 60, pull: 1.5, loop: false });

// Timeline (seconds).
const HIT_T = 0.35;
const HEAL_T = 1.0;
const DURATION = 1.6;
const RADIUS = 3;

export class GravitySlam implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GravitySlamSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly circle: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private time = 0;
  private flags = { grow: false, hit: false, heal: false };
  private center = new THREE.Vector3();

  private crackle = new Crackle();
  private shards = new Shards(14);
  private motes = new AshMotes(24);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: GravitySlamSettings = defaultGravitySlam()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.group.add(this.crackle.mesh, this.shards.mesh, this.motes.mesh, this.pop.mesh, this.shock.mesh);
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
    watchCover(ctx);
    this.center.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.circle.x = this.center.x;
    this.circle.z = this.center.z;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.grow = f.hit = f.heal = false;
    clearScreenFx(this.screen);
    this.crackle.reset();
    this.shards.reset();
    this.motes.reset();
    this.pop.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crackle.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;
    const f = this.flags;

    // The cracks run out to the rim while he gathers his weight.
    if (!f.grow) {
      f.grow = true;
      this.crackle.width = 0.5;
      this.crackle.grow(this.center, RADIUS, HIT_T);
      this.crackle.ring(this.center, RADIUS, HIT_T);
      this.v1.set(this.center.x, 0, this.center.z);
      this.motes.emit(this.v1, RADIUS * 0.8, 6);
    }

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.5;
      // Shards thrown out, then drawn back in to his feet.
      this.v1.set(this.center.x, 0.3, this.center.z);
      this.shards.burst(this.v1, 8, 6, 0.4);
      this.v2.set(this.center.x, 0.3, this.center.z);
      this.v1.set(this.center.x, 0.2, this.center.z);
      this.shards.drift(this.v1, this.v2, 6, 0.45, RADIUS - 0.4, 0.4);
      if (ctx) {
        // Everyone inside the circle now, wherever the cast was aimed (live positions).
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.circle, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, pull: this.settings.pull, from: this.center.clone(), color: VOID_CSS.body });
        }
      }
    }
    if (f.hit && !f.heal && t >= HEAL_T) {
      f.heal = true;
      this.crackle.fade(0.6);
    }

    const after = t - HIT_T;
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.04);
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.set(this.center.x, 1.0, this.center.z), 1.3 * sp.scale, sp.opacity, 0.2);
      const gp = smoothstep(after / 0.45);
      this.shock.set(this.center, 0.6 + (RADIUS + 0.4) * gp, 0.06 * (1 - gp) * (1 - gp));
      this.shake = 0.5 * Math.exp(-after * 9);
    }
  }
}

export const gravitySlamModule: EffectModule = {
  label: 'gravity slam',
  category: 'hero: void',
  // The AI casts it when the enemy is inside this radius.
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new GravitySlam(),
  telegraphs(effect) {
    const e = effect as GravitySlam;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GravitySlam;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as GravitySlam).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'pull', 0, 4, 0.1);
  },
};
