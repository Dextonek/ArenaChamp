import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, MoonHalo, SplashCrown, TIDE, TIDE_CSS, TideCurrent, TideRing, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { ChannelBar, channelBroken, stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { MOON_SECONDS, tideOf } from '../../traits/tide';

/**
 * Moon's Pull (tide kit, R: a 3 s channel). Marin raises her hands and a pale moon rises over her head; she is rooted
 * for the 3 s (`MOON_SECONDS`; the trait's `afterCast` calls `t.hold(3)`) and a ring at her feet empties as it runs
 * (`ChannelBar`). The tide is held at Low and her Wave Disc and Coral Spire pulls are doubled while it lasts (the trait
 * reads `moonLeft` from `tides`, which this effect owns: set on play, counted down, cleared on reset). An enemy within
 * 12 m that she can still see (`stillSees`) is dragged toward her at 2.4 m/s (`ctx.carry` every frame, as Forge Charge
 * does; she is never touched, the drag stops 1.6 m short) and takes 15 damage a second while the drag holds (a 5 hit
 * every third of a second). A stun, silence or knock-up ends it at once (`channelBroken`: the moon fades, the tide is
 * released, `ctx.releaseCaster`), with no crash. If the moon sets by itself, a 85 tide crash lands on an enemy within
 * 2.5 m of her. The hits are `projectile: true`: the drag is the catch, so the duel's zone filter does not decide.
 * The look is the Low tide at full strength: blue streaks spiral in, a ring of inward chevrons pulses at her feet and
 * water tethers run from her to each enemy being dragged. See pipeline/designs/kit-tide.md.
 *
 * `targeting.radius` is 25, wider than the 24 m duel ring, so that every enemy is in `ctx.targets`; the 12 m reach is
 * judged here. The duel AI casts it by its R rule alone (the enemy under 55% HP or the round 20 s old).
 *
 * Network duels: `ctx.carry` moves only this side's own hero, so the drag works on the victim's screen, where the cast is
 * replayed; on Marin's screen the other hero is left alone and follows its streamed position. The drag and the crash are
 * judged by the live positions. The tethers are drawn on both screens between the live positions.
 */
export interface MoonPullSettings {
  /** Metres per second the enemy is dragged. */
  speed: number;
  loop: boolean;
}

export const defaultMoonPull = (): MoonPullSettings => ({ speed: 2.4, loop: false });

// Timeline (seconds).
const RAISE_T = 0.3; // the moon is up and the drag begins
const END_T = MOON_SECONDS; // the moon sets: the drag and the held tide end together
const DURATION = END_T + 0.9;

const STOP = 1.6; // the drag leaves this much between her and the enemy
const REACH = 12; // the drag needs the enemy this close
const RADIUS = 25;
const MAX_TETHERS = 2;
const TICK_DAMAGE = 8; // 24 a second while the drag holds
const TICK_EVERY = 1 / 3;
const CRASH_DAMAGE = 110; // the tide crash: only when the moon sets by itself
const CRASH_R = 2.5; // ... on an enemy this close to her

export class MoonPull implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MoonPullSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { raised: false, released: false, pool: false };
  private owner: object | null = null;
  private tickAcc = 0;
  private endT = END_T;
  private bar = new ChannelBar(TIDE.body);
  private crashed = new Set<object>();
  private centre = new THREE.Vector3();

  // Parts.
  private ring = new TideRing();
  private current = new TideCurrent(40);
  private release = new TideCurrent(20);
  private halo = new MoonHalo();
  private tethers = Array.from({ length: MAX_TETHERS }, () => new WaterRibbon(26, 8, 10));
  private ends = Array.from({ length: MAX_TETHERS }, () => new THREE.Vector3());
  private drops = new Droplets(40);
  private crown = new SplashCrown();
  private pool = new WaterPool();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private inShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: MoonPullSettings = defaultMoonPull()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    this.tethers.forEach((r) => { r.shed = 6; r.drops.splash = false; });
    this.group.add(
      this.pool.mesh, this.bar.mesh, this.ring.mesh, this.current.mesh, this.release.mesh, this.halo.mesh, ...this.tethers.map((r) => r.mesh),
      this.crown.mesh, this.drops.mesh, this.pop.mesh, this.groundShock.mesh, this.inShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RAISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.centre.copy(ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The tide is held at Low and doubled from the first frame: the trait reads this for her pulls.
    this.owner = ctx.caster;
    tideOf(this.owner).moonLeft = MOON_SECONDS;
  }

  private reset() {
    if (this.owner) tideOf(this.owner).moonLeft = 0;
    this.owner = null;
    this.tickAcc = 0;
    this.endT = END_T;
    this.bar.set(this.centre, 0);
    this.crashed.clear();
    this.time = 0;
    this.shake = 0;
    this.flags.raised = this.flags.released = this.flags.pool = false;
    clearScreenFx(this.screen);
    this.ring.hide();
    this.current.hide();
    this.release.hide();
    this.halo.hide();
    for (const r of this.tethers) { r.reset(); r.hide(); }
    this.drops.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
    this.inShock.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.tethers) r.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
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
    if (ctx) this.centre.copy(ctx.caster.group.position).setY(0);
    // The held tide counts down with the effect; the trait reads it (a pull of hers while it is above 0 is doubled).
    if (this.owner) tideOf(this.owner).moonLeft = f.released ? 0 : Math.max(0, MOON_SECONDS - t);

    if (!f.pool && t >= 0.05) {
      f.pool = true;
      this.pool.spread(this.centre, 3, 0.4);
    }
    if (!f.raised && t >= RAISE_T) {
      f.raised = true;
      this.shake = 0.25;
      this.crown.burst(this.centre, 1.3);
      this.drops.spray(this.v1.copy(this.centre).setY(0.8), this.v2.set(0, 1, 0), 14, 6);
    }
    if (ctx && !f.released && channelBroken(ctx)) {
      // A stun, silence or knock-up ends the channel at once: no crash, the tide lets go, she is free.
      f.released = true;
      this.endT = t;
      if (this.owner) tideOf(this.owner).moonLeft = 0;
      ctx.releaseCaster?.();
      this.shake = 0.15;
    }
    if (f.raised && !f.released && t < END_T && ctx) this.drag(ctx, dt);
    if (!f.released && t >= END_T) {
      f.released = true;
      if (ctx) this.strike(ctx, CRASH_DAMAGE, true);
      this.crown.burst(this.centre, 1.7);
      this.drops.spray(this.v1.copy(this.centre).setY(1.0), this.v2.set(0, 1, 0), 20, 7);
      this.pool.ripple(this.centre);
      this.shake = 0.3;
    }
    // Drops lifted toward the moon while it holds.
    if (f.raised && !f.released && Math.random() < 0.25) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2;
      this.drops.drop(this.v1.set(this.centre.x + Math.cos(a) * r, 0.2, this.centre.z + Math.sin(a) * r), this.v2.set(-Math.cos(a) * 0.8, 3.2, -Math.sin(a) * 0.8), 0.7, 0.09);
    }
    this.layout();
  }

  /**
   * The tide crash: a hit on every enemy within CRASH_R of her, once each, `projectile` (the drag is the catch, so the
   * duel's zone filter does not decide).
   */
  private strike(ctx: CastContext, damage: number, crash: boolean) {
    const me = ctx.caster.group.position;
    for (const e of ctx.targets) {
      if (Math.hypot(e.group.position.x - me.x, e.group.position.z - me.z) > CRASH_R) continue;
      if (crash) {
        if (this.crashed.has(e)) continue;
        this.crashed.add(e);
      }
      ctx.hit(e, { damage, knock: 0, from: ctx.caster.group.position.clone(), color: TIDE_CSS.body, projectile: true });
      this.v1.copy(e.group.position).setY(1.0);
      this.drops.spray(this.v1, this.v2.set(0, 1, 0), crash ? 12 : 4, crash ? 6 : 3);
    }
    if (crash) this.shake = Math.max(this.shake, 0.35);
  }

  /**
   * One frame of the drag: every enemy within REACH that she still sees is carried toward her, never closer than STOP,
   * and takes a tick of damage every TICK_EVERY while it holds.
   */
  private drag(ctx: CastContext, dt: number) {
    const me = ctx.caster.group.position;
    let n = 0;
    const held: Enemy[] = [];
    for (const e of ctx.targets) {
      const p = e.group.position;
      const dx = me.x - p.x, dz = me.z - p.z, d = Math.hypot(dx, dz);
      if (d > REACH || !stillSees(ctx, this.v3.set(p.x, 0, p.z))) continue;
      held.push(e);
      if (n < MAX_TETHERS) this.ends[n++].set(p.x, 1.0, p.z);
      if (d <= STOP + 0.05) continue;
      const step = Math.min(this.settings.speed * dt, d - STOP);
      ctx.carry?.(e, this.v3.set((dx / d) * step, 0, (dz / d) * step));
    }
    for (; n < MAX_TETHERS; n++) this.ends[n].set(NaN, 0, 0);
    if (!held.length) return;
    this.tickAcc += dt;
    while (this.tickAcc >= TICK_EVERY) {
      this.tickAcc -= TICK_EVERY;
      for (const e of held) {
        ctx.hit(e, { damage: TICK_DAMAGE, knock: 0, from: me.clone(), color: TIDE_CSS.body, projectile: true });
        this.v1.copy(e.group.position).setY(1.0);
        this.drops.spray(this.v1, this.v2.set(0, 1, 0), 2, 2.5);
      }
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const c = this.centre;
    const held = f.raised && !f.released;
    const after = f.released ? t - this.endT : -1;
    const sinceRaise = f.raised ? t - RAISE_T : -1;

    // Night: the arena dims while the moon holds, and clears when it sets.
    this.screen.darken = 0.34 * smoothstep(t / 0.35) * (1 - smoothstep((t - this.endT) / 0.5));
    this.screen.impact = f.raised ? impactFrameAt(t, RAISE_T, [1], 0.03) : 0;

    // The channel bar empties over the 3 s (and goes at once when the channel breaks).
    this.bar.set(c, held ? Math.max(0, 1 - t / END_T) : 0);

    // --- The moon over her head, the Low-tide ring at her feet and the arena-wide inward current. ---
    const up = smoothstep(t / RAISE_T) * (1 - smoothstep(after / 0.4));
    this.halo.set(this.v1.set(c.x, 1.6 + 1.5 * smoothstep(t / RAISE_T), c.z), 1.3 * up + 0.001, up, t);
    this.ring.set(c, false, smoothstep(t / 0.3) * (1 - smoothstep(after / 0.35)), t, 2.2 + 0.15 * Math.sin(t * 5));
    const cur = held ? smoothstep(sinceRaise / 0.4) : 0;
    this.current.set(c, 1.5, 11, true, 0.85 * cur, t, 0.55, 1.4);
    // The tide letting go: foam streaks burst outward.
    this.release.set(c, 1.2, 7, false, 0.9 * (f.released ? 1 - smoothstep(after / 0.6) : 0), after * 2, 1.8, 1.0);

    // --- A contracting shock ring at the start: the whole arena is drawn in. ---
    if (t >= 0.1 && t < 1.0) {
      const k = (t - 0.1) / 0.9;
      this.inShock.set(c, 12 * (1 - k) + 1.5, 0.028 * Math.sin(Math.PI * k));
    } else {
      this.inShock.set(c, 0, 0);
    }

    // --- Tethers: a water line from her to each enemy while the drag holds. ---
    this.tethers.forEach((r, i) => {
      const e = this.ends[i];
      const grow = held ? smoothstep(sinceRaise / 0.3) : 0;
      if (grow < 0.02 || Number.isNaN(e.x)) { r.hide(); return; }
      const a = this.v2.set(c.x, 1.25, c.z), b = e;
      const len = a.distanceTo(b);
      r.setFunction((u, out) => {
        out.lerpVectors(a, b, u);
        out.x += Math.sin(u * Math.PI * 4 - t * 9) * 0.22 * Math.sin(u * Math.PI);
        out.y += Math.sin(u * Math.PI) * Math.min(1.2, len * 0.08);
        return out;
      }, 0.2, grow, 0, t);
    });

    // --- Raise and release beats. ---
    if (f.raised) {
      const sp = StarBurst.pop(sinceRaise, 0, 0.03);
      this.pop.set(this.v1.set(c.x, 1.3, c.z), 1.4 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(sinceRaise / 0.4, 0, 1);
      this.groundShock.set(c, 0.5 + 3 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.25 * Math.exp(-sinceRaise * 8));
    }
    if (f.released) {
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(c, 0.5 + 5 * gp, 0.035 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.3 * Math.exp(-after * 8));
    }
  }
}

export const moonPullModule: EffectModule = {
  label: "moon's pull",
  category: 'hero: tide',
  // Global: every enemy in the arena must be in `ctx.targets`, so the radius is wider than the whole duel ring.
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new MoonPull(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MoonPull;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MoonPull).settings;
    f.add(s, 'loop');
    f.add(s, 'speed', 0.2, 3, 0.1);
  },
};
