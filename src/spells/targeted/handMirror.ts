import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Gleam, HandMirrors, MIRROR, MIRROR_CSS, Slivers } from '../../effects/parts/mirror';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import {
  BANK_BONUS, BANK_RANGE, HAND_BOUNCES, HAND_DAMAGE, HAND_RANGE, HAND_SPEED, HAND_WIND, REST_SECONDS, bookOf, sweepMarks, type MirrorMark,
} from '../../traits/mirror';

/**
 * Hand Mirror (mirror kit v5, Q: a bank shot with a catch). Silvane draws a hand mirror out at her side over the 0.3 s wind-up and
 * throws it as a real bolt (`ctx.projectile`: 10 m from her, 22 m/s, radius 0.3) that SPINS as a mirror, not a glowing ball: a
 * silver-rimmed oval of glass, a handle, turning about the vertical so the pane flashes at the camera. It reflects off up to three
 * walls, pillars, crystals or standing mirrors (`reflect: 3`): 40 damage, +25% per bounce (the engine multiplies it), +2 m of range each.
 * Every bounce flashes (a pale star, glass slivers). It reaches 6 m at 0.57 s.
 *
 * The catch: when the flight ends after at least one bounce without hitting anyone, the mirror stays on the floor where it stopped
 * for 2.5 s, a ground mark (`mirrorBooks`, drawn by `Trait.marks`, with a 1 m ring that is the catch reach). Walking within 1 m of it
 * is hers to do (`tick` in `src/traits/mirror.ts`): Hand Mirror is ready, +20% speed for 2 s, a short pose, "GORGEOUS". The mark's
 * place comes from `bankPath` (a pure function of `sentFrom`, the aim and `ctx.obstacles()`), so both screens put it at the same
 * spot with the same id, even where no bolt flies (the caster's own screen online); a hit on the target shatters the mirror instead.
 *
 * Telegraph: one thin line per leg of `bankPath` for the first two legs, as wide as the bolt really hits (`boltWidth`): the first
 * leg shows from the cast, the second from the moment the bolt would reach it. Their `impact` is the launch (0.3 s), so the root
 * on her ends there. Network duels: bolts fly on the victim's screen, so the caster's screen draws the same bolt along `bankPath`.
 * Clean by about 2.5 s. See pipeline/designs/kit-mirror.md.
 */
export interface HandMirrorSettings {
  damage: number;
  knock: number;
}

export const defaultHandMirror = (): HandMirrorSettings => ({ damage: HAND_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.8;
const RADIUS = 0.3;
const LINE_W = boltWidth(RADIUS);
const BOLT_Y = 1.1;
const FLASHES = 4;
const MAX_T = 3.2;
const LEGS_SHOWN = 2;
const SPIN = 18;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

export class HandMirror implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HandMirrorSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** One thin line per leg shown, with its timing. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown along `path` by the drawn-only bolt (-1: none, -2: done)
  private passed = 0;
  private idx = -1;
  private trailT = 0;
  private playedAt = 0;
  private mark: MirrorMark | null = null;
  private landed = false;
  private bend = new THREE.Vector3();

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private path: { x: number; z: number }[] = [];
  private cum: number[] = [];

  private mirrors = new HandMirrors(2);
  private gleam = new Gleam(2);
  private slivers = new Slivers(90);
  private stars: StarBurst[] = [];
  private flash = { pos: [] as THREE.Vector3[], age: [] as number[], size: [] as number[], next: 0 };

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();

  constructor(settings: HandMirrorSettings = defaultHandMirror()) {
    this.settings = settings;
    this.group.add(this.mirrors.mesh, this.gleam.mesh, this.slivers.mesh);
    for (let i = 0; i < FLASHES; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, color: i % 2 ? MIRROR.violet : MIRROR.body, core: 0xffffff, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
      this.flash.pos.push(new THREE.Vector3());
      this.flash.age.push(9);
      this.flash.size.push(1);
    }
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return HAND_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the path: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    this.path = bankPath(this.start, this.dir, HAND_RANGE - MUZZLE, HAND_BOUNCES, ctx.obstacles?.() ?? [], BANK_RANGE);
    this.path[0] = { x: s.x, z: s.z };
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.specs = [];
    for (let i = 1; i < this.path.length && i <= LEGS_SHOWN; i++) {
      const a = this.path[i - 1], b = this.path[i];
      const at = HAND_WIND + this.cum[i - 1] / HAND_SPEED, end = HAND_WIND + this.cum[i] / HAND_SPEED;
      this.specs.push({
        shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: LINE_W },
        start: i === 1 ? 0 : at,
        impact: HAND_WIND,
        until: end,
      });
    }
    // Her hand: a little ahead of her, right of centre, at hand height.
    this.tip.set(ctx.from.x + this.dir.x * 0.7 + this.dir.z * 0.3, 1.2, ctx.from.z + this.dir.z * 0.7 - this.dir.x * 0.3);
  }

  play() {
    this.reset();
    this.playing = true;
    this.playedAt = performance.now();
    this.register();
  }

  /** Writes the floor mirror this throw may leave (both screens, from the path alone). */
  private register() {
    const ctx = this.ctx;
    if (!ctx || this.path.length < 3) return;
    const b = bookOf(ctx.caster);
    const id = ++b.seq * 16;
    const n = this.path.length, a = this.path[n - 2], e = this.path[n - 1];
    const l = Math.hypot(e.x - a.x, e.z - a.z) || 1;
    const flight = HAND_WIND + (this.cum[n - 1] - MUZZLE) / HAND_SPEED;
    // A quarter metre short of a wall it stopped at, so she can reach it.
    this.mark = {
      id, x: e.x - ((e.x - a.x) / l) * 0.25, z: e.z - ((e.z - a.z) / l) * 0.25, kind: 'hand',
      bornAt: this.playedAt + flight * 1000, until: this.playedAt + (flight + REST_SECONDS) * 1000, yaw: Math.atan2(e.x - a.x, e.z - a.z), gone: false,
    };
    sweepMarks(b);
    b.marks.push(this.mark);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.landed = false;
    this.goneAt = -1;
    this.bolt = null;
    this.drawn = -1;
    this.passed = 0;
    this.idx = -1;
    this.trailT = 0;
    this.mark = null;
    this.mirrors.reset();
    this.gleam.reset();
    this.slivers.reset();
    for (let i = 0; i < FLASHES; i++) { this.flash.age[i] = 9; this.stars[i].set(this.flash.pos[i], 0, 0); }
    this.flash.next = 0;
  }

  /** A clear flash: a pale star and slivers at `at` (a bounce or the end). */
  private flare(at: THREE.Vector3, size: number, slivers: number) {
    const i = this.flash.next++ % FLASHES;
    this.flash.pos[i].set(at.x, BOLT_Y, at.z);
    this.flash.age[i] = 0;
    this.flash.size[i] = size;
    this.slivers.burst(this.flash.pos[i], slivers, 4, 1.4);
    this.shake = Math.max(this.shake, 0.08);
  }

  private pointAt(d: number, out: THREE.Vector3, dirOut: THREE.Vector3) {
    let i = 1;
    while (i < this.cum.length - 1 && d > this.cum[i]) i++;
    const a = this.path[i - 1], b = this.path[i], l = Math.max(1e-4, this.cum[i] - this.cum[i - 1]);
    const k = THREE.MathUtils.clamp((d - this.cum[i - 1]) / l, 0, 1);
    out.set(a.x + (b.x - a.x) * k, BOLT_Y, a.z + (b.z - a.z) * k);
    dirOut.set(b.x - a.x, 0, b.z - a.z).normalize();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.mirrors.update(dt);
    this.slivers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // A throw that hit someone (her own screen learns it from `landed`) leaves no mirror on the floor.
    if (this.mark && !this.mark.gone && ctx && bookOf(ctx.caster).qHitAt > this.playedAt) this.mark.gone = true;

    // --- Wind-up: the mirror is drawn out at her hand, turning faster. ---
    if (this.idx === -1) this.idx = this.mirrors.place(this.tip, 0, MIN, 8);
    if (t < HAND_WIND && this.idx >= 0) {
      this.mirrors.setScale(this.idx, Math.max(easeOut(t / HAND_WIND), MIN));
      this.mirrors.setSpin(this.idx, 6 + 14 * (t / HAND_WIND));
      this.mirrors.move(this.idx, this.tip);
      this.trailT += dt;
      if (this.trailT >= 0.07) { this.trailT = 0; this.slivers.burst(this.tip, 1, 0.8); }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same path. ---
    if (!this.fired && t >= HAND_WIND) {
      this.fired = true;
      this.bend.set(this.start.x, BOLT_Y, this.start.z);
      this.shake = 0.05;
      if (this.idx >= 0) this.mirrors.setSpin(this.idx, SPIN);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: HAND_SPEED, range: HAND_RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: MIRROR_CSS.body },
          reflect: HAND_BOUNCES, reflectRange: BANK_RANGE, reflectBonus: BANK_BONUS,
          onReflect: (_b, at) => { this.bend.set(at.x, BOLT_Y, at.z); this.flare(at, 1.5, 12); },
        });
        // A caught mirror lets her throw again while this one still flies: its hit must not end the next throw's look.
        const thrown = this.bolt;
        thrown.onHit((_target, at, b) => { if (this.bolt === thrown) this.onHit(at, b.reflections); });
      } else {
        this.drawn = 0;
      }
    }

    // --- The mirror rides the bolt (or the drawn path); a gleam trails it. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, b.dir, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += HAND_SPEED * dt;
      const total = this.cum[this.cum.length - 1] - this.cum[0] - MUZZLE;
      this.pointAt(this.drawn + MUZZLE, this.v1, this.v2);
      while (this.passed < this.path.length - 2 && this.drawn + MUZZLE >= this.cum[this.passed + 1]) {
        this.passed++;
        const p = this.path[this.passed];
        this.bend.set(p.x, BOLT_Y, p.z);
        this.flare(this.bend, 1.5, 12);
      }
      live = this.drawn < total;
      if (live) { this.lastPos.copy(this.v1); this.ride(this.v1, this.v2, dt); } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      this.gleam.hide(0);
      if (this.idx >= 0) { this.mirrors.hide(this.idx); this.idx = -2; }
      // It stops: a little glint where it lands (the floor mark takes over), or a pop of glass when it has nowhere to lie.
      if (!this.landed) this.land(this.mark && !this.mark.gone ? 6 : 8);
    }

    // --- The flashes: a pale star that pops and shrinks. ---
    for (let i = 0; i < FLASHES; i++) {
      this.flash.age[i] += dt;
      const sp = StarBurst.pop(this.flash.age[i], 0.05, 0.16);
      this.stars[i].set(this.flash.pos[i], this.flash.size[i] * sp.scale, sp.opacity, this.flash.age[i] * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.slivers.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  private land(slivers: number) {
    this.landed = true;
    this.flare(this.lastPos, 1.1, slivers);
  }

  /** Moves the mirror to the bolt and lays the trail, no longer than the stretch since the last bend. */
  private ride(pos: THREE.Vector3, dir: THREE.Vector3, dt: number) {
    if (this.idx >= 0) this.mirrors.move(this.idx, pos, Math.atan2(dir.x, dir.z));
    const back = Math.min(1.3, Math.hypot(pos.x - this.bend.x, pos.z - this.bend.z) + 0.05);
    this.v3.copy(pos).addScaledVector(dir, -back);
    this.gleam.set(this.v3, pos, 0.3, 0.8, undefined, 0.1, 0);
    this.trailT += dt;
    if (this.trailT >= 0.06) { this.trailT = 0; this.slivers.burst(this.v4.copy(pos).addScaledVector(dir, -0.5), 1, 0.7); }
  }

  /** A hit: the mirror shatters, bigger after bounces (that is the one that pays), and leaves nothing on the floor. */
  private onHit(at: THREE.Vector3, bounces: number) {
    this.landed = true;
    if (this.mark) this.mark.gone = true;
    this.flare(at, 1.1 + 0.4 * bounces, 14 + 6 * bounces);
    this.shake = 0.12 + 0.04 * bounces;
    this.gleam.hide(0);
    if (this.idx >= 0) { this.mirrors.hide(this.idx); this.idx = -2; }
  }
}

export const handMirrorModule: EffectModule = {
  label: 'hand mirror',
  category: 'hero: mirror',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new HandMirror(),
  telegraphs(effect) {
    const e = effect as HandMirror;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HandMirror;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as HandMirror).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
