import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Gale Cyclone (sky kit, R: a drifting cyclone). Zephyr braces; a ring of wind closes in on his feet and a tall funnel
 * of gust ribbons, crescents and debris rises round him, 2.5 m in radius and about 5 m high. For 4 s it moves with
 * him (he can walk and fight inside it). An enemy that touches it is knocked up 0.5 s on its first contact, and every
 * 0.6 s it stays inside takes a tick of damage and is shoved out. Outrunning him is the counterplay. See
 * pipeline/designs/kit-shapes-v3.md.
 *
 * The zone moves, so a static telegraph would make the duel filter drop the hits: they carry `projectile: true`. The
 * last tick is at 3.9 s, inside the duel's 4.2 s window. Hits are judged against the caster figure's live position,
 * and each screen of a network duel judges its own hero (the victim's client decides). Online, status effects
 * (the knock-up) are ignored, so there the first contact is a shove and a tick like the rest.
 */
export interface GaleCycloneSettings {
  /** The first contact (with the knock-up). */
  firstDamage: number;
  /** Each tick after that. */
  tickDamage: number;
  /** Knock-up seconds on the first contact (engine cap 0.8). */
  knockUp: number;
  /** Shove away from the centre on each tick. */
  push: number;
  loop: boolean;
}

export const defaultGaleCyclone = (): GaleCycloneSettings => ({ firstDamage: 26, tickDamage: 15, knockUp: 0.5, push: 3.5, loop: false });

// Timeline (seconds).
const GROW_T = 0.4; // the ring closes in, the funnel rises; the first tick can land
const LAST_HIT_T = 3.9; // no tick after this (the duel drops hits later than 4.2 s)
const END_T = 4.0; // the funnel starts to unwind
const DURATION = 4.9;
const TICK = 0.6; // seconds between ticks on the same enemy

const RADIUS = 2.5;
const REACH = RADIUS + 0.3; // an enemy's centre this close to his is touched (the body has a radius)
const HEIGHT = 5.2;
const N_BLADES = 64;
const N_RING = 10;
const N_RIB = 4;

const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const sstep = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const hs = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

/** The funnel's radius at height fraction h (0 foot .. 1 top): narrow at his waist, wide at the top. */
const funnel = (h: number) => 1.15 + 1.45 * Math.pow(h, 1.25);

export class GaleCyclone implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GaleCycloneSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  /** Where the cyclone stands now (his feet), the cast spot, and the chest height of the swirl. */
  private centre = new THREE.Vector3(0, 0, 14);
  private home = new THREE.Vector3(0, 0, 14);

  private flags = { start: false, end: false };
  /** The next time each enemy can take a tick; presence = it has been touched already. */
  private nextTick = new Map<Enemy, number>();
  private hitT = -1;
  private pickT = -9;
  private pickAt = new THREE.Vector3();
  private pulseT = -9;
  private nextPulse = GROW_T;
  private spinA = 0;
  private leafTimer = 0;
  private lineTimer = 0;

  // Parts.
  private blades = new WindCrescent(0, N_BLADES + N_RING + 2);
  private ribbons: GustRibbon[] = [];
  private lines = new SpeedLines(40);
  private leaves = new Leaves(72);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private cur = { phase: 0, rise: 1, fall: 0, spin: 0, turns: 2.2 };

  constructor(settings: GaleCycloneSettings = defaultGaleCyclone()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    for (let i = 0; i < N_RIB; i++) this.ribbons.push(new GustRibbon(56));
    this.group.add(this.blades.mesh, ...this.ribbons.map((r) => r.mesh), this.lines.mesh, this.leaves.mesh, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GROW_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.home.set(ctx.from.x, 0, ctx.from.z);
    this.centre.copy(this.home);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(ctx.from.x, 1.4, ctx.from.z);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hitT = -1;
    this.pickT = -9;
    this.pulseT = -9;
    this.nextPulse = GROW_T;
    this.spinA = 0;
    this.leafTimer = 0;
    this.lineTimer = 0;
    this.nextTick.clear();
    this.centre.copy(this.home);
    this.flags.start = this.flags.end = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.blades.reset();
    for (const r of this.ribbons) r.reset();
    this.lines.reset();
    this.leaves.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  /** One of the gust ribbons: a spiral up the funnel. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const c = this.cur;
    const h = u * c.rise;
    const a = c.phase + c.spin * (1 - 0.35 * u) + u * c.turns * Math.PI * 2;
    const r = funnel(h) * (1 + 0.06 * Math.sin(u * 7 + c.spin));
    return out.set(this.centre.x + Math.cos(a) * r, 0.15 + h * HEIGHT * (1 - 0.55 * c.fall), this.centre.z + Math.sin(a) * r);
  };

  /** Hits every enemy the cyclone touches whose tick is due: knock-up on first contact, then a tick and a shove. */
  private touch(t: number) {
    const ctx = this.ctx;
    if (!ctx || t < GROW_T || t > LAST_HIT_T) return;
    const s = this.settings;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) > REACH) continue;
      const due = this.nextTick.get(e);
      if (due !== undefined && t < due) continue;
      const first = due === undefined;
      this.nextTick.set(e, t + TICK);
      // The shove comes from the centre, so the enemy leaves the cyclone however it stands.
      this.v1.set(this.centre.x, 0, this.centre.z);
      ctx.hit(e, first
        ? { damage: s.firstDamage, knock: 2, color: SKY_CSS.body, from: this.v1.clone(), projectile: true, status: { kind: 'knockup', seconds: Math.min(s.knockUp, 0.8) } }
        : { damage: s.tickDamage, knock: s.push, color: SKY_CSS.body, from: this.v1.clone(), projectile: true });
      this.shake = Math.max(this.shake, first ? 0.3 : 0.12);
      this.pickT = t;
      this.pickAt.set(p.x, 1.3, p.z);
      this.lines.burst(this.pickAt, this.v2.set(p.x - this.centre.x, 0.3, p.z - this.centre.z), first ? 8 : 4, 1.5);
      this.leaves.blow(this.pickAt, this.v2, first ? 6 : 3, 5);
      if (first && this.hitT < 0) this.hitT = t;
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.blades.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.finish();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // He moves, the cyclone moves with him: the caster figure's live spot.
    const cp = this.ctx?.caster.group.position;
    if (cp) this.centre.set(cp.x, 0, cp.z);

    if (!f.start && t >= 0.02) {
      f.start = true;
      this.lines.burst(this.v1.copy(this.centre).setY(0.4), this.v2.set(0, 1, 0), 10, 2.4);
      this.shake = 0.12;
    }
    // Spin up fast, hold, slow down as it unwinds.
    this.spinA += dt * (5 + 6 * sstep(0, GROW_T, t)) * (1 - 0.7 * sstep(END_T, DURATION, t));

    if (t >= this.nextPulse && t <= LAST_HIT_T) {
      this.nextPulse += TICK;
      this.pulseT = t;
      this.shake = Math.max(this.shake, 0.08);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        this.v1.set(this.centre.x + Math.cos(a) * RADIUS, 0.5, this.centre.z + Math.sin(a) * RADIUS);
        this.lines.burst(this.v1, this.v2.set(-Math.sin(a), 0.1, Math.cos(a)), 3, 1.5);
      }
    }
    if (!f.end && t >= END_T) {
      f.end = true;
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * RADIUS;
        this.v1.set(this.centre.x + Math.cos(a) * r, 0.6 + Math.random() * 3.5, this.centre.z + Math.sin(a) * r);
        this.leaves.blow(this.v1, this.v2.set(Math.cos(a), 0.4, Math.sin(a)), 1, 4);
      }
    }

    // Debris: leaves flung off the funnel, tangent to it, and some sucked in while it grows.
    if (t < END_T + 0.4) {
      this.leafTimer += dt;
      while (this.leafTimer >= 0.045) {
        this.leafTimer -= 0.045;
        const h = Math.random(), a = Math.random() * Math.PI * 2, r = funnel(h) * 1.05;
        this.v1.set(this.centre.x + Math.cos(a) * r, 0.2 + h * HEIGHT * 0.9, this.centre.z + Math.sin(a) * r);
        const grow = t < GROW_T;
        this.v2.set(-Math.sin(a) * 5.5 + (grow ? -Math.cos(a) * 4 : 0), 1 + 2 * Math.random(), Math.cos(a) * 5.5 + (grow ? -Math.sin(a) * 4 : 0));
        this.leaves.spawn(this.v1, this.v2, 0.7 + Math.random() * 0.5, 0.16 + Math.random() * 0.1);
      }
    }
    if (t >= GROW_T && t < END_T) {
      this.lineTimer += dt;
      while (this.lineTimer >= 0.11) {
        this.lineTimer -= 0.11;
        const a = Math.random() * Math.PI * 2, h = Math.random();
        this.v1.set(this.centre.x + Math.cos(a) * funnel(h), 0.3 + h * HEIGHT * 0.8, this.centre.z + Math.sin(a) * funnel(h));
        this.lines.burst(this.v1, this.v2.set(-Math.sin(a), 0.15, Math.cos(a)), 1, 1.8);
      }
    }

    this.touch(t);
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    this.reset();
  }

  private layout() {
    const t = this.time;
    const rise = easeOut(t / GROW_T);
    const fall = sstep(END_T, DURATION, t);
    const pulse = this.pulseT > -1 ? Math.exp(-(t - this.pulseT) * 7) : 0;

    // --- The screen: dims to teal while it stands, an impact frame on the first catch. ---
    this.screen.darken = 0.16 * sstep(0, GROW_T, t) * (1 - sstep(END_T, DURATION - 0.2, t));
    this.screen.impact = this.hitT >= 0 ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;
    this.shake *= 0.9;

    // --- The ring on the floor: closes in from 4.5 m to 2.5 m while he gathers, pulses on each tick. ---
    const ringR = RADIUS + 2 * (1 - easeOut(t / GROW_T));
    const gk = t - this.pulseT;
    if (gk >= 0 && gk < 0.45) this.groundShock.set(this.centre, 0.4 + (RADIUS + 0.4) * (gk / 0.45), 0.03 * (1 - gk / 0.45) * (1 - gk / 0.45));
    else this.groundShock.set(this.centre, 0, 0);

    // --- The catch: a pink star on whoever the cyclone just grabbed. ---
    const pa = t - this.pickT;
    if (pa >= 0 && pa < 0.4) {
      const sp = StarBurst.pop(pa, 0, 0.03);
      this.pop.set(this.pickAt, 1.5 * sp.scale, sp.opacity, 0.2);
    } else this.pop.set(this.pickAt, 0, 0);

    // --- Gust ribbons spiralling up the funnel. ---
    const c = this.cur;
    c.spin = this.spinA;
    c.rise = rise;
    c.fall = fall;
    for (let i = 0; i < N_RIB; i++) {
      c.phase = (i / N_RIB) * Math.PI * 2;
      c.turns = 1.8 + 0.5 * (i % 2);
      this.ribbons[i].setFunction(this.path, 0.3 + 0.12 * pulse, Math.max(rise, 0.02), 0.9 * fall * fall, t + i, 1 - fall * fall);
    }

    // --- Crescents: the funnel's blades, a low ring marking the real radius on the floor. ---
    const op = rise * (1 - fall * fall);
    if (op > 0.01) {
      for (let i = 0; i < N_BLADES; i++) {
        // Uneven heights and speeds so the funnel does not read as stacked rings.
        const h = ((i + 0.6 * hs(i)) / N_BLADES);
        if (h > rise) continue;
        const a = this.spinA * (1.1 - 0.5 * h) * (i % 3 === 0 ? 1.25 : 1) + hs(i + 3) * Math.PI * 2;
        const r = funnel(h) * (0.92 + 0.25 * hs(i + 7)) + 0.12 * pulse;
        this.v1.set(this.centre.x, 0.2 + h * HEIGHT * (1 - 0.55 * fall), this.centre.z);
        this.blades.put(this.v1, Math.atan2(Math.cos(a), Math.sin(a)), 0.3 * Math.sin(i * 1.7) + 0.2, r, 55 + 35 * hs(i + 11), 1.1, op, 0.22 + 0.14 * h + 0.06 * pulse, i % 9 === 0 ? 1 : 0);
      }
      for (let i = 0; i < N_RING; i++) {
        const a = -this.spinA * 0.7 + (i / N_RING) * Math.PI * 2;
        this.v1.set(this.centre.x, 0.12, this.centre.z);
        this.blades.put(this.v1, Math.atan2(Math.cos(a), Math.sin(a)), 0.04, ringR, 26, 1.1, op * (0.65 + 0.35 * pulse), 0.2 + 0.12 * pulse, 0);
      }
    }
  }
}

export const galeCycloneModule: EffectModule = {
  label: 'gale cyclone',
  category: 'hero: sky',
  // Self-centred and moving: every enemy is listed (radius 40) and judged against the caster's live spot each tick.
  targeting: { mode: 'ground', radius: 40 },
  create: () => new GaleCyclone(),
  // No static zone: the cyclone moves, and its hits skip the zone check (`projectile: true`). The funnel is the signal.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GaleCyclone;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as GaleCyclone).settings;
    f.add(s, 'loop');
    f.add(s, 'firstDamage', 1, 100, 1);
    f.add(s, 'tickDamage', 1, 60, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
    f.add(s, 'push', 0, 8, 0.5);
  },
};
