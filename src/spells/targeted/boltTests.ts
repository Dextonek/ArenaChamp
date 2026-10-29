import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Skillshot tests (mechanics): four bolts that fly from the caster along the aim line (`ctx.projectile`) and hit the
 * first enemy they touch, instead of landing on a timer in a zone. A plain bolt, one that splits into three on its
 * first hit, one that bounces on to the nearest other enemy, and a fast piercing lance. All use the generic bolt look
 * (`parts/bolt.ts`) in their own colour. The telegraph is a line from the caster to the bolt's max range, shown from
 * the cast until the bolt has flown past it. Tools for checking projectiles, not hero spells.
 */
export interface BoltTestSettings {
  damage: number;
  knock: number;
}

interface BoltTestConfig {
  label: string;
  damage: number;
  speed: number;
  range: number;
  radius: number;
  pierce?: boolean;
  bounce?: number;
  split?: { count: number; spreadDeg: number; damage: number; range: number };
  look: BoltLook;
}

const WINDUP = 0.2;
/** The firing point is this far in front of the caster's feet (about its hand). */
const MUZZLE = 0.8;

export class BoltTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BoltTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: 1 };
  private time = 0;
  private fired = false;
  private bolts = new BoltSet(this.group);

  constructor(private cfg: BoltTestConfig) {
    this.settings = { damage: cfg.damage, knock: 2 };
  }

  get duration() {
    return WINDUP + this.cfg.range / this.cfg.speed + 0.3;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return WINDUP + this.cfg.range / this.cfg.speed;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const dx = Math.sin(ctx.aim), dz = Math.cos(ctx.aim);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + dx * this.cfg.range, z2: ctx.from.z + dz * this.cfg.range,
      width: this.cfg.radius * 2,
    };
  }

  play() {
    this.time = 0;
    this.fired = false;
    this.playing = true;
    this.bolts.clear();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const ctx = this.ctx, c = this.cfg;
    if (!this.fired && this.time >= WINDUP) {
      this.fired = true;
      // A network duel has no bolts (the context leaves `projectile` out): the spell then shows nothing.
      if (ctx?.projectile) {
        const dir = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
        const hit = { damage: this.settings.damage, knock: this.settings.knock, color: c.look.hit };
        const bolt = ctx.projectile({
          from: ctx.from.clone().addScaledVector(dir, MUZZLE), dir, speed: c.speed, range: c.range - MUZZLE, radius: c.radius, hit,
          pierce: c.pierce, bounce: c.bounce,
          split: c.split && {
            count: c.split.count, spreadDeg: c.split.spreadDeg, at: 'hit', range: c.split.range,
            hit: { damage: c.split.damage, knock: 1, color: c.look.hit },
          },
        });
        this.bolts.follow(bolt, c.look);
      }
    }
    this.bolts.update(dt);
    if (this.fired && !this.bolts.busy) this.playing = false;
  }
}

function makeModule(cfg: BoltTestConfig): EffectModule {
  return {
    label: cfg.label,
    category: 'test: mechanics',
    // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
    targeting: { mode: 'ground', radius: cfg.radius },
    create: () => new BoltTest(cfg),
    telegraphs(effect) {
      const e = effect as BoltTest;
      if (!e.ctx) return [];
      // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
      return [{ shape: e.line, start: 0, impact: WINDUP, until: e.flightEnd }];
    },
    bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
    frameCamera(camera, controls, effect) {
      const e = effect as BoltTest;
      if (e.ctx) frameCast(camera, controls, e.ctx, 3);
    },
    buildGui(f, effect) {
      const s = (effect as BoltTest).settings;
      f.add(s, 'damage', 0, 100, 1);
      f.add(s, 'knock', 0, 8, 0.5);
    },
  };
}

export const boltTestModule = makeModule({
  label: 'bolt test', damage: 45, speed: 22, range: 12, radius: 0.45,
  look: { core: '#ffe3a8', body: '#ff9a3c', rim: '#4a1408', size: 0.3, trail: 2.2, hit: '#ffb347' },
});

/** The summon test kit's own copy of the plain bolt (a label is one effect instance, and `bolt test` belongs to the ranged kit). */
export const summonerBoltTestModule = makeModule({
  label: 'summoner bolt test', damage: 45, speed: 22, range: 12, radius: 0.45,
  look: { core: '#e4d0ff', body: '#b48cff', rim: '#2a1448', size: 0.3, trail: 2.2, hit: '#c9a8ff' },
});

export const splitBoltTestModule = makeModule({
  label: 'split bolt test', damage: 35, speed: 22, range: 12, radius: 0.45,
  split: { count: 3, spreadDeg: 25, damage: 15, range: 6 },
  look: { core: '#c9fff4', body: '#3ad0c8', rim: '#06302e', size: 0.3, trail: 2.2, hit: '#5ce8dc' },
});

export const bounceBoltTestModule = makeModule({
  label: 'bounce bolt test', damage: 30, speed: 20, range: 12, radius: 0.45, bounce: 2,
  look: { core: '#e4ffc2', body: '#7ad84a', rim: '#16300a', size: 0.3, trail: 2.2, hit: '#9cf070' },
});

export const pierceBoltTestModule = makeModule({
  label: 'pierce bolt test', damage: 40, speed: 30, range: 14, radius: 0.5, pierce: true,
  look: { core: '#e0f0ff', body: '#7ab8ff', rim: '#0c2048', size: 0.24, trail: 4.2, hit: '#a8d2ff' },
});
