import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, Chain, GrappleHook as HookMesh, Sparks, Spring, SteamPuffs } from '../../effects/parts/clockwork';
import { firstSurface } from '../../obstacles';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { turretSpots } from '../../traits/clockwork';

/**
 * Grapple (clockwork kit, E: a hook, shown name "Grapple"). A 0.25 s wind-up (`RELEASE_T`: the spring on her wrist
 * launcher squeezes, a cyan star swells), then a steel grapnel on a chain flies 9 m along her aim at 20 m/s. It reaches 6 m
 * at 0.55 s, so a sidestep is possible. There is no pull on the enemy at all and she stays put when it hits one:
 *  - It meets the ENEMY first: 30 damage and slowed 1 s (`ctx.projectile`, the engine's bolt, dodged by stepping off the line).
 *  - It meets a WALL or PILLAR (`firstSurface` against `ctx.obstacles()`) or one of HER OWN TURRETS first (the trait keeps
 *    their positions in `turretSpots`, refreshed every frame on both screens), or the enemy has sidestepped and it runs on
 *    to one within 9 m: the hook bites, and she reels herself to just short of it (`ctx.moveCaster(spot, 0.3)`, 0.9 m
 *    short, only when at least 0.5 m of reel is left). That spends her escape, which is the counterplay.
 *  - It meets nothing: the chain runs out at 9 m and snaps back.
 * The bolt's range is cut at the catch, so it cannot fly through a turret to hit the enemy behind it (cover already stops it).
 * The effect traces the same line itself (from `sentFrom`-free numbers: `ctx.from`, `ctx.aim`, the live obstacles and the
 * live turret spots) so the reel and the drawing agree on both screens; the bolt only decides the damage.
 * The telegraph is the hit line, from her to the catch or to 9 m, 0.7 m wide, with the wind-up as its impact.
 * Network duels: the bolt flies on the victim's screen (that is where the enemy is decided); her own screen draws the
 * hook from its own trace and does the reel (only her client can move her). Clean about 1.2 s after the cast.
 */
export interface GrappleSettings {
  damage: number;
  slow: number;
  loop: boolean;
}

export const defaultGrappleHook = (): GrappleSettings => ({ damage: 30, slow: 1, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.25;
const SPEED = 20;
const RANGE = 9;
const RADIUS = 0.35; // the bolt
const BODY = 0.5; // an enemy's body against a bolt
const MUZZLE = 0.7;
const TURRET_R = 0.6; // how close to the line a turret's centre must be to catch the hook
const SHORT = 0.9; // she stops this far short of the catch
const MIN_REEL = 0.5;
const REEL_T = 0.3;
const HOLD_T = 0.2; // the hook stays in the enemy this long
const RETRACT_T = 0.25;
const MAX_T = 2.2;

type Catch = { dist: number; kind: 'wall' | 'turret' } | null;
type State = 'wind' | 'fly' | 'stuck' | 'bite' | 'retract' | 'done';

export class GrappleSpell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GrappleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(RADIUS) };
  private time = 0;
  private state: State = 'wind';
  private stateT = 0;
  private fwd = new THREE.Vector3(0, 0, -1);
  private start = new THREE.Vector3();
  private reach = RANGE;
  private catchAt: Catch = null;
  private headD = 0;
  private head = new THREE.Vector3();
  private retractFrom = new THREE.Vector3();
  private stuck: THREE.Object3D | null = null;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private reeled = false;

  private hook = new HookMesh();
  private chain = new Chain(48);
  private spring = new Spring(5);
  private sparks = new Sparks(40);
  private steam = new SteamPuffs(28);
  private nock = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: CLOCKWORK.accent, core: CLOCKWORK.core, additive: false });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: CLOCKWORK.hot, core: CLOCKWORK.core, additive: false });

  private hand = new THREE.Vector3();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: GrappleSettings = defaultGrappleHook()) {
    this.settings = settings;
    this.group.add(this.hook.mesh, this.chain.mesh, this.spring.mesh, this.sparks.mesh, this.steam.mesh, this.nock.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + (this.reach - MUZZLE) / SPEED;
  }

  /** The first thing on the line from `ctx.from`: the nearer of a wall or pillar surface and one of her turrets. */
  private trace(ctx: CastContext): Catch {
    const ax = ctx.from.x, az = ctx.from.z;
    let best: Catch = null;
    const surf = firstSurface({ x: ax, z: az }, { x: ax + this.fwd.x * RANGE, z: az + this.fwd.z * RANGE }, ctx.obstacles?.() ?? []);
    if (surf) best = { dist: surf.t * RANGE, kind: 'wall' };
    for (const p of turretSpots.get(ctx.caster) ?? []) {
      const rx = p.x - ax, rz = p.z - az;
      const s = rx * this.fwd.x + rz * this.fwd.z;
      const perp = Math.abs(rx * this.fwd.z - rz * this.fwd.x);
      if (s < 0.6 || s > RANGE + 0.5 || perp > TURRET_R) continue;
      const d = Math.max(MUZZLE, s - 0.5);
      if (!best || d < best.dist) best = { dist: d, kind: 'turret' };
    }
    return best;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.start.copy(ctx.from).setY(0).addScaledVector(this.fwd, MUZZLE);
    this.catchAt = this.trace(ctx);
    this.reach = Math.min(RANGE, this.catchAt?.dist ?? RANGE);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * this.reach, z2: ctx.from.z + this.fwd.z * this.reach,
      width: boltWidth(RADIUS),
    };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.state = 'wind';
    this.stateT = 0;
    this.headD = 0;
    this.stuck = null;
    this.bolt = null;
    this.reeled = false;
    this.hook.reset();
    this.chain.reset();
    this.spring.reset();
    this.sparks.reset();
    this.steam.reset();
    this.nock.set(this.hand, 0, 0);
    this.pop.set(this.hand, 0, 0);
  }

  private go(s: State) {
    this.state = s;
    this.stateT = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    this.stateT += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= MAX_T || this.state === 'done') {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    // Her wrist launcher: in front of her, at chest height, following her as she moves.
    const me = ctx ? ctx.caster.group.position : this.start;
    this.hand.set(me.x + this.fwd.x * 0.5, 1.25, me.z + this.fwd.z * 0.5);

    if (this.state === 'wind') {
      // The spring squeezes, a star swells at the muzzle.
      const k = smoothstep(t / RELEASE_T);
      this.v1.copy(this.hand).addScaledVector(this.fwd, 0.1);
      this.v2.copy(this.v1).addScaledVector(this.fwd, 0.85);
      this.spring.set(this.v1, this.v2, 4, 0.1);
      this.spring.stretch(1 - 0.6 * k);
      this.nock.set(this.v2.copy(this.hand).addScaledVector(this.fwd, 0.5), 0.15 + 0.35 * k, 0.5 + 0.5 * k, t * 6);
      if (t >= RELEASE_T) this.release(ctx);
    } else {
      // The spring lets go and settles, then goes.
      const since = t - RELEASE_T;
      if (since > 0.25) this.spring.hide();
      else this.spring.stretch(1.25 - 0.25 * smoothstep(since / 0.2));
      this.nock.set(this.hand, 0, 0);
    }

    if (this.state === 'fly') this.fly(dt, ctx);
    else if (this.state === 'stuck') {
      // Stuck in the enemy: the head rides their chest for a moment.
      if (this.stuck) this.head.set(this.stuck.position.x, 1.2, this.stuck.position.z);
      if (this.stateT >= HOLD_T) this.retract();
    } else if (this.state === 'bite') {
      // Bitten into cover or a turret: she reels to it, the chain taut.
      if (this.stateT >= REEL_T) this.retract();
    } else if (this.state === 'retract') {
      const k = smoothstep(this.stateT / RETRACT_T);
      this.head.lerpVectors(this.retractFrom, this.hand, k);
      if (this.stateT >= RETRACT_T) {
        this.hook.hide();
        this.chain.hide();
        this.go('done');
      }
    }
    this.draw(t);
    this.shake *= Math.exp(-dt * 12);
  }

  /** The release: the bolt (the engine's, where it flies) and the head start. */
  private release(ctx: CastContext | null) {
    this.go('fly');
    this.headD = 0;
    if (!ctx) return;
    // Her turrets may have died or moved in the wind-up: trace again.
    this.catchAt = this.trace(ctx);
    this.reach = Math.min(RANGE, this.catchAt?.dist ?? RANGE);
    if (ctx.projectile) {
      const hit: HitOptions = {
        damage: this.settings.damage, knock: 0, color: CLOCKWORK_CSS.body,
        status: { kind: 'slow', seconds: this.settings.slow },
      };
      this.bolt = ctx.projectile({
        from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: Math.max(0.5, this.reach - MUZZLE),
        radius: RADIUS, hit,
      });
      this.bolt.onHit((target) => this.hooked(target.group));
    }
  }

  private hooked(at: THREE.Object3D) {
    if (this.state !== 'fly') return;
    this.stuck = at;
    this.head.set(at.position.x, 1.2, at.position.z);
    this.shake = 0.2;
    this.sparks.burst(this.head, 7);
    this.go('stuck');
  }

  private fly(dt: number, ctx: CastContext | null) {
    this.headD = Math.min(this.reach - MUZZLE, this.headD + SPEED * dt);
    this.head.copy(this.start).addScaledVector(this.fwd, this.headD).setY(1.2);
    this.sparks.burst(this.head, 1);
    // The enemy first: the head passes an enemy body on the line (the engine's bolt decides the damage where it flies).
    if (ctx) {
      for (const e of ctx.targets) {
        const rx = e.group.position.x - this.start.x, rz = e.group.position.z - this.start.z;
        const s = rx * this.fwd.x + rz * this.fwd.z;
        const perp = Math.abs(rx * this.fwd.z - rz * this.fwd.x);
        if (s >= -0.2 && s <= this.headD + 0.2 && perp <= BODY + RADIUS) {
          this.hooked(e.group);
          return;
        }
      }
    }
    if (this.headD < this.reach - MUZZLE - 1e-3) return;
    if (!this.catchAt) {
      // Nothing in 9 m: the chain runs out and snaps back.
      this.retract();
      return;
    }
    // The hook bites cover or a turret: a clank, and she reels in.
    this.go('bite');
    this.shake = 0.25;
    this.sparks.burst(this.head, 9);
    this.steam.puff(this.head, this.up, 3);
    this.pop.set(this.head, 0.9, 0.9, 0.3);
    if (ctx && !this.reeled && this.reach - SHORT >= MIN_REEL) {
      this.reeled = true;
      const f = ctx.from;
      ctx.moveCaster?.(this.v1.set(f.x + this.fwd.x * (this.reach - SHORT), 0, f.z + this.fwd.z * (this.reach - SHORT)), REEL_T);
    }
  }

  private retract() {
    this.retractFrom.copy(this.head);
    this.go('retract');
  }

  private draw(t: number) {
    const out = this.state === 'fly' || this.state === 'stuck' || this.state === 'bite' || this.state === 'retract';
    if (!out) return;
    this.hook.place(this.head, this.state === 'retract' ? this.v1.copy(this.hand).sub(this.head) : this.fwd, t * 8);
    this.chain.set(this.hand, this.head);
    // The pop where the hook bit: fades over a quarter second.
    if (this.state === 'bite' || this.state === 'stuck') {
      const sp = StarBurst.pop(this.stateT, 0.02, 0.06);
      this.pop.set(this.head, (this.state === 'stuck' ? 0.8 : 1.1) * sp.scale, sp.opacity, 0.3);
      if (this.state === 'bite') {
        // Steam jets from her boots while the chain reels her in.
        if (Math.random() < 0.6) this.steam.puff(this.v2.set(this.hand.x - this.fwd.x * 0.5, 0.3, this.hand.z - this.fwd.z * 0.5), this.up, 1);
        this.sparks.arc(this.hand, this.head, 0.08);
      }
    }
  }
}

export const grappleHookModule: EffectModule = {
  label: 'grapple hook',
  category: 'hero: clockwork',
  // Aimed along a line, like the other skillshots; the radius is wide so the effect sees every enemy for its own trace.
  targeting: { mode: 'ground', radius: 30 },
  create: () => new GrappleSpell(),
  telegraphs(effect) {
    const e = effect as GrappleSpell;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GrappleSpell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as GrappleSpell).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'slow', 0.2, 2.5, 0.1);
  },
};
