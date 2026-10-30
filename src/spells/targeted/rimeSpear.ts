import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, IceStreak, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rime Spear (frost kit, Q: piercing skillshot). She breathes on her open hand, a long ice javelin grows in it, she
 * throws it and it flies down the aim line as a piercing bolt (`ctx.projectile`); the javelin follows the bolt's handle.
 * On a hit frost ferns spread out of the ground under the target and climb its body as rime (and it is slowed); six
 * small crystals burst up around it. The javelin shatters at max range and the crystals and ferns fade. See
 * pipeline/designs/kit-frost.md.
 */
export interface RimeSpearSettings {
  damage: number;
  /** Slow seconds on the hit (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultRimeSpear = (): RimeSpearSettings => ({ damage: 64, slow: 1.5, loop: false });

// Timeline (seconds).
const GROW_T = 0.05; // the javelin starts to grow in her hand
const THROW_T = 0.3;
const SHATTER_T = 1.0; // the screen dark fades from here
const DURATION = 2.2;
const SPEAR_LEN = 3;
const RANGE = 12;
const SPEED = 24;
const RADIUS = 0.45;
const FLIGHT_END = THROW_T + RANGE / SPEED;
const FADE_AFTER = 0.4; // the ferns and crystals go this long after the hit

const f_after = (t: number, hitT: number) => (hitT < 0 ? -1 : t - hitT);

export class RimeSpear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RimeSpearSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.5, 13);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);
  private dir = new THREE.Vector3(0, 0, -1);

  private flags = { breath: false, grown: false, fired: false, impacted: false, shattered: false, faded: false };
  private bolt: Projectile | null = null;
  private hitT = -1;
  private spearId = -1;
  private snowTimer = 0;

  // Parts.
  private breath = new FrostBreath(16);
  private spear = new IceCrystals({ maxSpikes: 2, maxShards: 48 });
  private ring = new IceCrystals({ maxSpikes: 8, maxShards: 40 });
  private streak = new IceStreak();
  private snow = new Snow({ max: 30 });
  private ferns = new FrostFerns({ variant: 0, maxShards: 28 });
  private fernsB = new FrostFerns({ variant: 1, maxShards: 0 });
  private sleeves = new RimeSleeves(1);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FROST.accent, core: 0xfff0f6, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: RimeSpearSettings = defaultRimeSpear()) {
    this.settings = settings;
    this.screen.impactColor.set(FROST.rime);
    this.screen.tint.set(FROST.dark);
    this.ferns.renderOrder = 2;
    this.fernsB.renderOrder = 1;
    this.group.add(
      this.fernsB.mesh, this.ferns.mesh, this.sleeves.mesh, this.ring.mesh, this.spear.mesh, this.streak.mesh, this.snow.mesh,
      this.breath.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return THROW_T;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    // A skillshot: it flies along the aim line; the ferns grow wherever the first body is hit.
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.5);
    this.dir.copy(this.fwd);
    this.feet.copy(ctx.from).addScaledVector(this.fwd, RANGE * 0.5).setY(0);
    this.hit.copy(this.feet).setY(1.1);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.spear.mesh];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.snowTimer = 0;
    this.spearId = -1;
    this.bolt = null;
    this.hitT = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.breath.reset();
    this.spear.reset();
    this.ring.reset();
    this.snow.reset();
    this.ferns.reset();
    this.fernsB.reset();
    this.sleeves.clear();
    this.streak.set(this.hit, this.hand, 0, 0);
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  /** Javelin base (tail) position: in her hand, then riding the bolt (its tip a little past the bolt). */
  private spearBase(t: number, out: THREE.Vector3) {
    const b = this.bolt;
    if (!this.flags.fired || !b) return out.copy(this.hand);
    // The first few hundredths glide from her hand down to bolt height.
    const k = Math.min(1, (t - THROW_T) / 0.1);
    out.set(b.pos.x, BOLT_HEIGHT, b.pos.z).addScaledVector(this.dir, 0.25 - SPEAR_LEN);
    return out.lerp(this.hand, (1 - k) * (1 - k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.spear.update(dt);
    this.ring.update(dt);
    this.snow.update(dt);
    this.ferns.update(dt);
    this.fernsB.update(dt);
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

    // Events.
    if (!f.breath && t >= 0.02) {
      f.breath = true;
      this.breath.blow(this.v1.copy(this.hand).addScaledVector(this.fwd, -0.1), this.v2.copy(this.fwd).setY(0.15), 1.0, 0.18);
    }
    if (!f.grown && t >= GROW_T) {
      f.grown = true;
      this.spearId = this.spear.spike(this.hand, this.dir, SPEAR_LEN, 0.28, 0.25, 0);
    }
    // A few snowflakes shed behind the javelin in flight.
    if (!f.fired && t >= THROW_T) {
      f.fired = true;
      // A network duel has no bolts (the context leaves `projectile` out): the javelin then just shatters.
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.fwd, 0.55);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE, radius: RADIUS, pierce: true,
          hit: { damage: this.settings.damage, knock: 2, color: FROST_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } },
        });
        this.bolt.onHit((_target, at) => this.onHit(at, t));
      }
    }
    if (f.fired && !f.shattered) {
      const b = this.bolt;
      if (!b || !b.alive) {
        // Max range (or a pillar, or no bolt in a network duel): the javelin shatters.
        f.shattered = true;
        this.spear.shatter(12, 5, 0.3);
      }
    }
    if (f.fired && !f.shattered) {
      this.snowTimer += dt;
      while (this.snowTimer >= 0.035) {
        this.snowTimer -= 0.035;
        this.snow.scatter(this.v1.copy(this.spearBase(t, this.v3)).addScaledVector(this.dir, Math.random() * 1.5), 1, 1.2, 0.7);
      }
    }
    if (f.impacted && !f.faded && t >= this.hitT + FADE_AFTER) {
      f.faded = true;
      this.ring.shatter(4, 4, 0.28);
      this.ferns.fade(0.8);
      this.fernsB.fade(0.8);
    }

    this.layout();
  }

  /** The first hit: ferns and crystals at the target's feet, rime climbs it. The javelin flies on. */
  private onHit(at: THREE.Vector3, t: number) {
    const f = this.flags;
    if (f.impacted) return;
    f.impacted = true;
    this.hitT = t;
    this.feet.set(at.x, 0, at.z);
    this.hit.set(at.x, 1.1, at.z);
    this.screen.focus.copy(this.hit);
    this.ferns.grow(this.feet, 2.2, 0.35);
    this.fernsB.grow(this.feet, 2.0, 0.35, 0.03);
    this.ring.cluster(this.feet, 0.95, 6, 0.95, { ring: true, tilt: 0.4, stagger: 0.06, grow: 0.1 });
    this.shake = 0.25;
  }

  private layout() {
    const t = this.time;
    const after = f_after(t, this.hitT);
    const f = this.flags;

    // --- 0.05..0.5 The javelin grows in her hand, then flies; a pale streak trails it. ---
    if (this.spearId >= 0 && !f.shattered) {
      const base = this.spearBase(t, this.v1);
      this.spear.place(this.spearId, base, this.dir);
      const trail = Math.min(3.4, this.hand.distanceTo(base));
      const flown = t >= THROW_T;
      const op = flown ? 0.85 : 0;
      this.streak.set(this.v2.copy(base).addScaledVector(this.dir, 0.3), this.v3.copy(base).addScaledVector(this.dir, -trail), 0.22, op);
    } else {
      this.streak.set(this.hit, this.hand, 0, 0);
    }

    this.screen.darken = 0.25 * smoothstep((t - 0.2) / 0.3) * (1 - smoothstep((t - SHATTER_T) / 0.8));

    // --- Impact: a pinpoint glint runs the javelin's edge for two frames, accent star, ground refraction, shake. ---
    const gk = after;
    this.spear.glint = gk >= 0 && gk < 1 / 30 ? 1 : 0;
    this.spear.glintAt = 0.35 + 0.6 * THREE.MathUtils.clamp(gk / (1 / 30), 0, 1);
    this.screen.impact = f.impacted ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.hit, 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.2 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.25 * Math.exp(-after * 14);
    }

    // --- Rime climbs the body from the feet, then fades with the ferns. ---
    const climb = smoothstep(after / 0.3);
    const rimeOp = f.impacted ? 1 - smoothstep((t - SHATTER_T) / 0.6) : 0;
    this.sleeves.set(0, this.feet, 2.2, 1.0, f.impacted ? climb : 0, rimeOp);
  }
}

export const rimeSpearModule: EffectModule = {
  label: 'rime spear',
  category: 'hero: frost',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new RimeSpear(),
  telegraphs(effect) {
    const e = effect as RimeSpear;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: RADIUS * 2 },
      start: 0.1, impact: THROW_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RimeSpear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RimeSpear).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
