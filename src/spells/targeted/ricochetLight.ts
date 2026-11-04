import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SpectrumBeam } from '../../effects/parts/prism';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { BANK_BONUS, BANK_MAX, BANK_RANGE, RICOCHET_DAMAGE } from '../../traits/prism';

/**
 * Ricochet Light (prism kit v5, Q: a bank shot). A crystal forms at Opaline's wand over the 0.3 s wind-up, then it is fired
 * as a real bolt (`ctx.projectile`: 12 m from her, 24 m/s, radius 0.3) that reflects off up to two walls, pillars or
 * crystals (`reflect: 2`): 50 damage, +25% per reflection (the engine multiplies it), +2 m of range each. A hit after
 * reflections takes 1 s per reflection off this spell: decided in `src/traits/prism.ts` from the bonus in the hit.
 * Every reflection flashes (a pale star, glitter) and the bolt's white trail bends with it.
 *
 * Telegraph: one thin `line` per leg of `bankPath` (a pure function of `sentFrom`, the aim and `ctx.obstacles()`, so both
 * screens and the aim strip agree): the first leg shows from the cast, the later ones from the moment the bolt would reach
 * them. Their `impact` is the launch (0.3 s) for every leg, so the root on her ends there, not when the last leg is flown.
 * The bolt is a dodge by touch, so the lines are not a zone: a sidestep reaches 6 m of its first leg by 0.55 s.
 *
 * Network duels: bolts fly on the victim's screen (where the hit is decided), so the caster's screen has no `ctx.projectile`
 * and draws a bolt along the same `bankPath` instead, flashing at each corner. Clean by about 2 s. See
 * pipeline/designs/kit-prism.md.
 */
export interface RicochetLightSettings {
  damage: number;
  knock: number;
}

export const defaultRicochetLight = (): RicochetLightSettings => ({ damage: RICOCHET_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const WINDUP = 0.3;
const SPEED = 24;
const RANGE = 12; // from her feet, before the 2 m each reflection adds
const MUZZLE = 0.8;
const RADIUS = 0.3;
const CRYSTAL_LEN = 1.04;
const CRYSTAL_W = 0.42;
const LINE_W = boltWidth(RADIUS); // what the bolt really hits, not the bolt alone
const BOLT_Y = 1.1;
const FLASHES = 4;
const MAX_T = 3.5;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

export class RicochetLight implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RicochetLightSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** One line per leg of the bank path, with its timing. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown along `path` by the drawn-only bolt (-1: none)
  private passed = 0;
  private crystalIdx = -1;
  private trailT = 0;
  private bend = new THREE.Vector3();

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private path: { x: number; z: number }[] = [];
  private cum: number[] = [];

  private crystal = new Crystal(2);
  private beams = new SpectrumBeam(2);
  private glitter = new Glitter(90);
  private stars: StarBurst[] = [];
  private flash = { pos: [] as THREE.Vector3[], age: [] as number[], size: [] as number[], next: 0 };

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();

  constructor(settings: RicochetLightSettings = defaultRicochetLight()) {
    this.settings = settings;
    this.group.add(this.crystal.mesh, this.beams.mesh, this.glitter.mesh);
    for (let i = 0; i < FLASHES; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, color: i % 2 ? PRISM.gold : PRISM.blue, core: 0xffffff, additive: false });
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
    return WINDUP;
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
    this.path = bankPath(this.start, this.dir, RANGE - MUZZLE, BANK_MAX, ctx.obstacles?.() ?? [], BANK_RANGE);
    this.path[0] = { x: s.x, z: s.z };
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.specs = [];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      const at = WINDUP + this.cum[i - 1] / SPEED, end = WINDUP + this.cum[i] / SPEED;
      this.specs.push({
        shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: LINE_W },
        start: i === 1 ? 0 : at,
        // The launch for every leg: the root on her ends there, and a later leg shows armed the moment it appears.
        impact: WINDUP,
        until: end,
      });
    }
    // The wand tip: a little ahead of her, right of centre, at hand height.
    this.tip.set(ctx.from.x + this.dir.x * 0.7 + this.dir.z * 0.25, 1.3, ctx.from.z + this.dir.z * 0.7 - this.dir.x * 0.25);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.goneAt = -1;
    this.bolt = null;
    this.drawn = -1;
    this.passed = 0;
    this.crystalIdx = -1;
    this.trailT = 0;
    this.crystal.reset();
    this.beams.reset();
    this.glitter.reset();
    for (let i = 0; i < FLASHES; i++) { this.flash.age[i] = 9; this.stars[i].set(this.flash.pos[i], 0, 0); }
    this.flash.next = 0;
  }

  /** A clear flash: a pale star and glitter at `at` (a reflection or the hit). */
  private flare(at: THREE.Vector3, size: number, glitter: number) {
    const i = this.flash.next++ % FLASHES;
    this.flash.pos[i].set(at.x, BOLT_Y, at.z);
    this.flash.age[i] = 0;
    this.flash.size[i] = size;
    this.glitter.burst(this.flash.pos[i], glitter, 4, 1.4);
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
    this.crystal.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the crystal forms at the wand tip, a few flecks drift off it. ---
    if (this.crystalIdx === -1) this.crystalIdx = this.crystal.place(this.tip, this.dir, CRYSTAL_LEN, CRYSTAL_W, { scale: MIN, spin: 9 });
    if (t < WINDUP && this.crystalIdx >= 0) {
      this.crystal.setScale(this.crystalIdx, Math.max(easeOut(t / WINDUP), MIN));
      this.crystal.move(this.crystalIdx, this.tip, this.dir);
      this.trailT += dt;
      if (this.trailT >= 0.07) { this.trailT = 0; this.glitter.burst(this.tip, 1, 0.8); }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same path. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      this.bend.set(this.start.x, BOLT_Y, this.start.z);
      this.shake = 0.05;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: SPEED, range: RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: PRISM_CSS.body },
          reflect: BANK_MAX, reflectRange: BANK_RANGE, reflectBonus: BANK_BONUS,
          onReflect: (_b, at) => { this.bend.set(at.x, BOLT_Y, at.z); this.flare(at, 1.5, 12); },
        });
        this.bolt.onHit((_target, at, b) => this.onHit(at, b.reflections));
      } else {
        this.drawn = 0;
      }
    }

    // --- The crystal rides the bolt (or the drawn path); a white trail bends with it. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, b.dir, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += SPEED * dt;
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
    if (this.fired && !live) {
      this.beams.hide(0);
      if (this.crystalIdx >= 0) {
        this.crystal.hide(this.crystalIdx);
        this.crystalIdx = -2;
        // A bolt that ended without a hit (max range or a wall past its bounces) pops into a little glitter where it was.
        if (this.goneAt < 0) this.glitter.burst(this.lastPos, 5, 2);
      }
      if (this.goneAt < 0) this.goneAt = t;
    }

    // --- The flashes: a pale star that pops and shrinks. ---
    for (let i = 0; i < FLASHES; i++) {
      this.flash.age[i] += dt;
      const sp = StarBurst.pop(this.flash.age[i], 0.05, 0.16);
      this.stars[i].set(this.flash.pos[i], this.flash.size[i] * sp.scale, sp.opacity, this.flash.age[i] * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.glitter.busy && !this.crystal.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** Moves the crystal to the bolt and lays the trail behind it, no longer than the stretch since the last bend. */
  private ride(pos: THREE.Vector3, dir: THREE.Vector3, dt: number) {
    if (this.crystalIdx >= 0) this.crystal.move(this.crystalIdx, pos, dir);
    const back = Math.min(1.5, Math.hypot(pos.x - this.bend.x, pos.z - this.bend.z) + 0.05);
    this.v3.copy(pos).addScaledVector(dir, -back);
    this.beams.set(this.v3, pos, 0.34, 0.85, PRISM.hot, 0.1, 0);
    this.trailT += dt;
    if (this.trailT >= 0.06) { this.trailT = 0; this.glitter.burst(this.v4.copy(pos).addScaledVector(dir, -0.5), 1, 0.7); }
  }

  /** A hit: a bigger flash (and warmer) after reflections, since that is the one that pays. */
  private onHit(at: THREE.Vector3, reflections: number) {
    this.flare(at, 1.1 + 0.4 * reflections, 16 + 6 * reflections);
    this.shake = 0.12 + 0.04 * reflections;
    this.beams.hide(0);
    if (this.crystalIdx >= 0) { this.crystal.hide(this.crystalIdx); this.crystalIdx = -2; }
  }
}

export const ricochetLightModule: EffectModule = {
  label: 'ricochet light',
  category: 'hero: prism',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new RicochetLight(),
  telegraphs(effect) {
    const e = effect as RicochetLight;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RicochetLight;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RicochetLight).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
