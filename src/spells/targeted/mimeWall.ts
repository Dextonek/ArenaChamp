import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { ChalkDashes, Flecks, Gloves, MIME } from '../../effects/parts/mime';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { WALL_LEN, WALL_LIFE, WALL_MIN, WALL_RANGE, WALL_RISE, bookOf, makeRoom, newWall, raiseWall, type MimeWall } from '../../traits/mime';

/**
 * Wall (mime kit v5, W: terrain, three charges). Mum puts both flat gloves out in front of her, pressing on a pane that is not there,
 * and walks them sideways along it while a dashed chalk line is drawn on the floor at the spot (9 m, at least 1.5 m from her), 4 m
 * long and square to her aim. At 0.5 s it is a wall: a real obstacle (`ctx.addObstacle`, a capsule 0.14 m each side of the line) for
 * both heroes and the AI for 5 s, with a bolt wall on the same line and a 1 HP unit: one hit of any size breaks it (`raiseWall` in
 * src/traits/mime.ts says how, and why a bolt anywhere along the 4 m counts). It is shown only by faint chalk on the floor and a
 * faint shimmer in the air, drawn by the trait's `marks` on both screens (this effect only draws the drawing of it and the pop).
 * Up to three plain Walls stand; a fourth takes the oldest, and so does a Box that would put her over 6 units.
 * The telegraph is the line it will occupy (0.5 m wide, impact at the rise): it roots her until then. No word. Clean by 1.4 s.
 * See pipeline/designs/kit-mime.md.
 */
export interface MimeWallSettings {
  loop: boolean;
}

export const defaultMimeWall = (): MimeWallSettings => ({ loop: false });

// Timeline (seconds).
const RISE_T = WALL_RISE;
const DURATION = 1.4;
const TELE_W = 0.5;
const MIN = 1e-3;

export class MimeWallFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MimeWallSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The wall's two ends, from sentFrom and point only. */
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3(0, 0, 1);
  private dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private raised = false;
  private rec: MimeWall | null = null;
  private drawT = 0;

  private chalk = new ChalkDashes(40);
  private flecks = new Flecks(70);
  private gloves = new Gloves(2);
  private star = new StarBurst({ points: 8, inner: 0.3, color: MIME.chalk, core: MIME.dark, additive: false });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MimeWallSettings = defaultMimeWall()) {
    this.settings = settings;
    this.group.add(this.chalk.mesh, this.flecks.mesh, this.gloves.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the wall: only sentFrom and point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = WALL_MIN; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, WALL_MIN, WALL_RANGE);
    this.dir.set(dx, 0, dz);
    const cx = s.x + dx * len, cz = s.z + dz * len, h = WALL_LEN / 2;
    // Square to her aim: along (dz, -dx).
    this.a.set(cx + dz * h, 0, cz - dx * h);
    this.b.set(cx - dz * h, 0, cz + dx * h);
    this.chalk.clear();
    this.chalk.add(this.a.x, this.a.z, this.b.x, this.b.z, 0.34, 0.24, 0.1);
  }

  play() {
    this.reset();
    this.playing = true;
    // The record, on both screens: the trait draws it from the rise.
    const ctx = this.ctx;
    if (ctx) this.rec = newWall(bookOf(ctx.caster), this.a.x, this.a.z, this.b.x, this.b.z, false, WALL_LIFE);
  }

  private reset() {
    // A cast that was cut off before the rise leaves nothing behind.
    if (this.rec && !this.rec.raised) this.rec.gone = true;
    this.rec = null;
    this.time = 0;
    this.shake = 0;
    this.raised = false;
    this.drawT = 0;
    this.chalk.show(0);
    this.chalk.setOpacity(0);
    this.flecks.reset();
    this.gloves.reset();
    this.star.set(this.a, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (!ctx) return;
    if (t >= DURATION && !this.flecks.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The drawing: chalk grows along the line, the gloves press on the pane and slide with it. ---
    if (!this.raised) {
      const k = Math.min(1, t / RISE_T);
      this.chalk.show(k);
      this.chalk.setOpacity(0.85 * Math.min(1, t / 0.1));
      const c = ctx.from, yaw = Math.atan2(this.dir.x, this.dir.z);
      // The head of the line, and a chip or two flying off it.
      this.v1.lerpVectors(this.a, this.b, k).setY(0.08);
      this.drawT += dt;
      if (this.drawT >= 0.06) { this.drawT = 0; this.flecks.burst(this.v1, 1, 0.8, 0.7, 0.4); }
      // Both flat gloves, palms out, at chest height a short way in front of her, sliding to the side the line is drawn toward.
      const slide = Math.sin(k * Math.PI * 2) * 0.22;
      const px = -this.dir.z, pz = this.dir.x;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -0.2 : 0.2;
        this.gloves.place(i, this.v2.set(c.x + this.dir.x * 0.7 + px * (side + slide), 1.3 + 0.05 * Math.sin(t * 14 + i), c.z + this.dir.z * 0.7 + pz * (side + slide)), yaw, Math.min(1, t * 8), 0, 0);
      }
    }

    // --- The rise: it is a wall now. A pale star, chips along the line, the gloves drop. ---
    if (!this.raised && t >= RISE_T) {
      this.raised = true;
      if (this.rec) {
        const b = bookOf(ctx.caster);
        makeRoom(b, 1, false, [this.rec]);
        raiseWall(ctx, this.rec);
      }
      this.chalk.setOpacity(0);
      this.gloves.reset();
      this.star.set(this.v1.lerpVectors(this.a, this.b, 0.5).setY(1.1), 0, 0);
      for (let i = 0; i < 5; i++) this.flecks.burst(this.v1.lerpVectors(this.a, this.b, (i + 0.5) / 5).setY(0.1), 4, 2.4, 0.9, 0.5);
      this.shake = 0.14;
    }
    if (this.raised) {
      const age = t - RISE_T;
      const sp = StarBurst.pop(age, 0.05, 0.22);
      this.star.set(this.v1.lerpVectors(this.a, this.b, 0.5).setY(1.1), 2.6 * Math.max(sp.scale, MIN), sp.opacity, age * 3);
      this.shake *= Math.exp(-dt * 10);
    }
  }
}

export const mimeWallModule: EffectModule = {
  label: 'mime wall',
  category: 'hero: mime',
  // The aim point is where the wall's middle stands; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new MimeWallFx(),
  telegraphs(effect) {
    const e = effect as MimeWallFx;
    if (!e.ctx) return [];
    // The line it will fill: it roots her until it rises.
    return [{ shape: { kind: 'line', x1: e.a.x, z1: e.a.z, x2: e.b.x, z2: e.b.z, width: TELE_W }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as MimeWallFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as MimeWallFx).settings, 'loop');
  },
};
