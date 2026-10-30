import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SpectrumBeam } from '../../effects/parts/prism';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Prism Bolt (prism kit, Q: a splitting skillshot). A faceted crystal (0.8 long) forms at Opaline's wand tip over the
 * first 0.2 s, then it is fired (`ctx.projectile`, split into 3 over 25 degrees at the first hit). The crystal rides the
 * bolt handle, spinning, with a short white trail. On the first hit it bursts: glitter, a small spectrum star for two
 * frames, and three thin tinted beams (red, gold, blue) fan out, one riding each child bolt. The children's own hits
 * spark a little. Clean by about 1.5 s. See pipeline/designs/kit-prism.md.
 */
export interface PrismBoltSettings {
  damage: number;
  knock: number;
  splitDamage: number;
}

export const defaultPrismBolt = (): PrismBoltSettings => ({ damage: 42, knock: 2, splitDamage: 15 });

const WINDUP = 0.2;
const SPEED = 22;
const RANGE = 12;
const RADIUS = 0.45;
const MUZZLE = 0.8;
const CRYSTAL_LEN = 1.04;
const CRYSTAL_W = 0.47;
const BEAM_LEN = 2.0;
const HOLD = 0.4; // a child's beam stays this long after it ends, then fades over 0.2 s
const TINTS = [PRISM.red, PRISM.gold, PRISM.blue] as const;
const STAR_COLORS = [PRISM.gold, PRISM.blue, PRISM.red] as const;

export class PrismBolt implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PrismBoltSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private crystalIdx = -1;
  private trailT = 0;
  private glintT = 0;
  private starAge = 9;
  private starN = 0;
  private burstAt = new THREE.Vector3();
  private burstDone = false;
  private deadAt: number[] = [-1, -1, -1];

  private dir = new THREE.Vector3(0, 0, 1);
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();

  private crystal = new Crystal(2);
  private beams = new SpectrumBeam(4);
  private glitter = new Glitter(60);
  private star = new StarBurst({ points: 8, inner: 0.3, color: PRISM.gold, core: 0xffffff, additive: false });
  private starPos = new THREE.Vector3();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PrismBoltSettings = defaultPrismBolt()) {
    this.settings = settings;
    this.group.add(this.crystal.mesh, this.beams.mesh, this.glitter.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return 1.5;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return WINDUP + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
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
    this.crystalIdx = -1;
    this.trailT = 0;
    this.glintT = 0;
    this.starAge = 9;
    this.starN = 0;
    this.burstDone = false;
    this.deadAt = [-1, -1, -1];
    this.crystal.reset();
    this.beams.reset();
    this.glitter.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.crystal.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Windup: the crystal forms at the wand tip, a few flecks drift off it. ---
    if (this.crystalIdx === -1) this.crystalIdx = this.crystal.place(this.tip, this.dir, CRYSTAL_LEN, CRYSTAL_W, { scale: MIN, spin: 9 });
    if (t < WINDUP && this.crystalIdx >= 0) {
      const k = t / WINDUP;
      this.crystal.setScale(this.crystalIdx, Math.max(easeOut(k), MIN));
      this.crystal.move(this.crystalIdx, this.tip, this.dir);
      this.glintT += dt;
      if (this.glintT >= 0.07) { this.glintT = 0; this.glitter.burst(this.tip, 1, 0.8); }
    }

    // --- Fire. A network duel has no bolts (the context leaves `projectile` out): the spell then shows only the windup. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      if (ctx?.projectile) {
        const from = this.v1.copy(ctx.from).addScaledVector(this.dir, MUZZLE);
        this.bolt = ctx.projectile({
          from, dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: PRISM_CSS.body },
          split: { count: 3, spreadDeg: 25, at: 'hit', hit: { damage: s.splitDamage, knock: 1, color: PRISM_CSS.body }, range: 6 },
        });
        this.bolt.onHit((_target, at, b) => this.onHit(at, b === this.bolt));
        this.shake = 0.05;
      } else {
        this.goneAt = t;
        this.crystal.hide(this.crystalIdx);
        this.crystalIdx = -2;
      }
    }

    // --- The crystal follows the handle; a short white trail streams behind it. ---
    const b = this.bolt;
    if (b) {
      if (b.alive) {
        this.lastPos.copy(b.pos);
        if (this.crystalIdx >= 0) this.crystal.move(this.crystalIdx, b.pos, b.dir);
        this.v1.copy(b.pos).addScaledVector(b.dir, -1.5);
        this.beams.set(this.v1, b.pos, 0.34, 0.85, PRISM.hot, 0.1, 0);
        this.trailT += dt;
        while (this.trailT >= 0.06) { this.trailT -= 0.06; this.glitter.burst(this.v2.copy(b.pos).addScaledVector(b.dir, -0.5), 1, 0.7); }
      } else {
        this.beams.hide(0);
        if (this.crystalIdx >= 0) {
          this.crystal.hide(this.crystalIdx);
          this.crystalIdx = -2;
          // A bolt that ended without a hit (max range or a pillar) pops into a little glitter where it was.
          if (!this.burstDone) this.glitter.burst(this.v1.copy(this.lastPos), 5, 2);
        }
      }
      this.fanBeams(t);
    }

    // --- The hit accent: a small spectrum star for two frames. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.03);
    this.star.set(this.starPos, 1.0 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    const kids = b ? b.children.length : 0;
    const allDone = !b || (!b.alive && b.children.every((c) => !c.alive));
    if (b && !b.alive && this.goneAt < 0 && (kids === 0 || allDone)) this.goneAt = t;
    if (this.goneAt >= 0 && t >= this.goneAt + 0.8 && !this.glitter.busy && !this.crystal.busy) {
      this.playing = false;
      this.reset();
    } else if (t >= 3) {
      this.playing = false;
      this.reset();
    }
  }

  /** One tinted beam rides each child bolt; it grows out of the burst point and fades when the child ends. */
  private fanBeams(t: number) {
    const b = this.bolt;
    if (!b) return;
    b.children.forEach((c, i) => {
      if (i > 2) return;
      if (c.alive) {
        const len = Math.min(BEAM_LEN, c.pos.distanceTo(this.burstAt) + 0.05);
        this.v1.copy(c.pos).addScaledVector(c.dir, -len);
        this.beams.set(this.v1, c.pos, 0.6, 1, TINTS[i], 0.2, 1 + i);
      } else {
        if (this.deadAt[i] < 0) this.deadAt[i] = t;
        const k = 1 - Math.max(0, t - this.deadAt[i] - HOLD) / 0.2;
        if (k <= 0) this.beams.hide(1 + i);
        else this.beams.set(this.v1.copy(c.pos).addScaledVector(c.dir, -BEAM_LEN), c.pos, 0.6, k, TINTS[i], 0.2, 1 + i);
      }
    });
  }

  /** A hit: the parent's first hit bursts into glitter and the star; a child's hit sparks a little. */
  private onHit(at: THREE.Vector3, parent: boolean) {
    this.starPos.set(at.x, 1.1, at.z);
    this.starAge = 0;
    this.star.color.setHex(STAR_COLORS[this.starN++ % 3]);
    if (parent) {
      this.burstDone = true;
      this.burstAt.copy(at).setY(BOLT_Y);
      this.glitter.burst(this.starPos, 24, 4.5, 2);
      this.shake = 0.12;
      if (this.crystalIdx >= 0) { this.crystal.hide(this.crystalIdx); this.crystalIdx = -2; }
      this.beams.hide(0);
    } else {
      this.glitter.burst(this.starPos, 4, 2.5);
      this.shake = Math.max(this.shake, 0.06);
    }
  }
}

const MIN = 1e-3;
const BOLT_Y = 1.1;
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const prismBoltModule: EffectModule = {
  label: 'prism bolt',
  category: 'hero: prism',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new PrismBolt(),
  telegraphs(effect) {
    const e = effect as PrismBolt;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: WINDUP, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PrismBolt;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PrismBolt).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'splitDamage', 0, 50, 1);
  },
};
