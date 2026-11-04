import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandHood } from '../../effects/parts/sand';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cobra Spit (sand kit v5, Q: 9 m line skillshot, `ctx.projectile`). A gold-and-turquoise cobra of sand rears up in front of
 * Sefu in 0.2 s (the wind-up, 0.25 s) and on the strike spits a bolt of venom (20 m/s, radius 0.35) down the aim from his feet:
 * it reaches 6 m at 0.55 s, so a sidestep after the hood rises is enough. The first enemy it touches takes 50 damage and is
 * blinded 1.2 s (`status: blind`). A hit on a Judged enemy halves what is left of this spell's cooldown: that is the trait
 * (`src/traits/sand.ts`, `dealt` and `peerNote`), the bolt lands 0.25 s or more after the cast set the cooldown, so it
 * is always a running cooldown that is cut. The hit splashes in a turquoise star and a ground ring; the hood dissolves to grains.
 * Timeline: hood up 0-0.2, strike and release 0.25, flight to 0.7, clean by 1.3 s. Network duels: the dealer's screen draws
 * the hood only (bolts fly on the victim's screen, where the hit is decided).
 */
export interface CobraSpitSettings {
  damage: number;
  /** Blind seconds on the hit (engine cap 2). */
  blind: number;
  loop: boolean;
}

export const defaultCobraSpit = (): CobraSpitSettings => ({ damage: 58, blind: 1.2, loop: false });

// Timeline (seconds).
const HOOD_UP_T = 0.2;
const WIND_T = 0.25; // the strike: the venom leaves
const DURATION = 1.4;

const REACH = 9; // from his feet: the kit's range
const SPEED = 20;
const RADIUS = 0.35;
const FLIGHT_END = WIND_T + REACH / SPEED;
const HOOD_AHEAD = 0.9; // the cobra stands this far in front of him

const LOOK: BoltLook = { core: '#e8fffc', body: SAND_CSS.accent, rim: SAND_CSS.dark, size: 0.32, trail: 3.2, hit: SAND_CSS.accent };

export class CobraSpit implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CobraSpitSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hoodBase = new THREE.Vector3();
  private hoodYaw = 0;
  private fired = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private missPuffed = false;

  private hood = new SandHood();
  private bolts = new BoltSet(this.group);
  private dust = new Dust(8, 20);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private spit = new StarBurst({ points: 6, inner: 0.25, color: SAND.hot, core: SAND.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: CobraSpitSettings = defaultCobraSpit()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.hood.width = 1.7;
    this.hood.height = 2.3;
    this.dust.life = 0.5;
    this.group.add(this.hood.mesh, this.dust.mesh, this.pop.mesh, this.spit.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T;
  }

  /** Seconds after play() when the venom has flown its full reach (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hoodBase.copy(this.from).addScaledVector(this.fwd, HOOD_AHEAD);
    this.hoodYaw = Math.atan2(-this.fwd.x, -this.fwd.z); // the hood faces the camera side, as the quicksand cobra does
    this.hood.place(this.hoodBase, this.hoodYaw);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, REACH * 0.5).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.hitAt = -1;
    this.missPuffed = false;
    clearScreenFx(this.screen);
    this.hood.reset();
    this.hood.place(this.hoodBase, this.hoodYaw);
    this.bolts.clear();
    this.dust.reset();
    this.pop.set(this.hitPos, 0, 0);
    this.spit.set(this.hitPos, 0, 0);
    this.groundShock.set(this.hitPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.dust.update(dt);
    this.bolts.update(dt);
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

    // The cobra rears (overshooting a little), strikes on the release, then dissolves to grains.
    const rear = smoothstep(t / HOOD_UP_T);
    const strike = t < WIND_T ? 0 : Math.max(0, 1 - (t - WIND_T) / 0.18);
    const erode = smoothstep((t - WIND_T - 0.05) / 0.3);
    this.hood.set(rear * (1 + 0.08 * Math.sin(rear * Math.PI)), strike, 0.92 * (1 - smoothstep((t - WIND_T - 0.25) / 0.2)), erode, t);
    const sp = StarBurst.pop(t - WIND_T, 0, 0.05);
    this.v1.copy(this.from).addScaledVector(this.fwd, HOOD_AHEAD + 0.5).setY(1.6);
    this.spit.set(this.v1, 0.8 * sp.scale + 1e-3, sp.opacity, t * 3);

    if (!this.fired && t >= WIND_T) {
      this.fired = true;
      this.shake = 0.1;
      this.dust.puff(this.v1.copy(this.hoodBase).setY(0.3), 0.6);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.from.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: SAND_CSS.body, status: { kind: 'blind', seconds: this.settings.blind } },
        });
        this.bolts.follow(this.bolt, LOOK);
        this.bolt.onHit((target, at) => this.onHit(target.group.position, at));
      }
    }
    // A miss: the venom ends in a small splash where it died.
    if (this.bolt && !this.bolt.alive && this.hitAt < 0 && !this.missPuffed) {
      this.missPuffed = true;
      this.dust.puff(this.v1.copy(this.bolt.pos).setY(0.3), 0.5);
    }

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const hp = StarBurst.pop(a, 0.02, 0.06);
      this.pop.set(this.hitPos, 1.1 * hp.scale + 1e-3, hp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.groundShock.set(this.v1.set(this.hitPos.x, 0, this.hitPos.z), 0.4 + 1.6 * g, 0.03 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.14 * Math.exp(-a * 14));
    } else this.shake *= 0.9;
  }

  private onHit(feet: THREE.Vector3, at: THREE.Vector3) {
    this.hitAt = this.time;
    this.hitPos.set(feet.x, 1.2, feet.z);
    this.dust.puff(this.v1.set(at.x, 0.4, at.z), 0.6);
    this.dust.fall(this.v1.set(feet.x, 0, feet.z), 0.6, 6, 1.8, 0.6);
  }
}

export const cobraSpitModule: EffectModule = {
  label: 'cobra spit',
  category: 'hero: sand',
  // A skillshot: the aim point only gives the direction (the venom flies its 9 m wherever the cursor is).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CobraSpit(),
  telegraphs(effect) {
    const e = effect as CobraSpit;
    const ctx = e.ctx;
    if (!ctx) return [];
    const from = ctx.sentFrom ?? ctx.from;
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Shown from the hood rising, armed at the strike, until the venom has flown; the bolt's hit is the dodge check.
    return [{
      shape: { kind: 'line', x1: from.x, z1: from.z, x2: from.x + d.x * REACH, z2: from.z + d.z * REACH, width: boltWidth(RADIUS) },
      start: 0.02, impact: WIND_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CobraSpit;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as CobraSpit).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'blind', 0, 2, 0.1);
  },
};
