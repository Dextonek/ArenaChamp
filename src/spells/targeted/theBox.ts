import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { ChalkDashes, Flecks, Gloves, MIME } from '../../effects/parts/mime';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BOX_LIFE, BOX_MIN, BOX_RANGE, BOX_SIDE, BOX_WIND, bookOf, makeRoom, newWall, raiseWall, type MimeWall } from '../../traits/mime';

/**
 * The Box (mime kit v5, R: four walls close round a spot). The classic: Mum draws a box in the air with both flat gloves, one hand
 * tracing the top and right edges and the other the left and bottom, round a square at chest height in front of her, while a dashed
 * chalk square is drawn on the floor at the spot (9 m, at least 2.4 m from her so she stands outside it), 3 m a side and turned to
 * her aim. Four red-edged lines (the telegraph: the walls' lines, 0.5 m wide) show where they will stand for 0.8 s (`BOX_WIND`). Then
 * four walls close: each a real obstacle (`ctx.addObstacle`) with a bolt wall and a 1 HP unit (`raiseWall`), so one hit of any size
 * breaks one and opens the way. They stand 3 s. Whoever is inside cannot walk out; she cannot see in or walk in either, because
 * obstacles are the same for both (her Invisible Ball does pass: see `passBolt`). From the centre a wall is 1.5 m off: 0.63 s with
 * the reaction time, inside the 0.8 s. Four walls and three Walls are over her 6 units: the oldest walls go (`makeRoom`). A red
 * chalk mark flashes at each corner as it shuts (the red of her scarf). No word. Clean by 1.6 s.
 * See pipeline/designs/kit-mime.md.
 */
export interface TheBoxSettings {
  loop: boolean;
}

export const defaultTheBox = (): TheBoxSettings => ({ loop: false });

// Timeline (seconds).
const SHUT_T = BOX_WIND;
const DURATION = 1.7;
const TELE_W = 0.5;
const HALF = BOX_SIDE / 2;
const MIN = 1e-3;

export class TheBoxFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TheBoxSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The four corners and the middle, from sentFrom and point only. */
  readonly corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  readonly centre = new THREE.Vector3(0, 0, 4);
  private dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private shut = false;
  private recs: MimeWall[] = [];
  private drawT = 0;

  private chalk = new ChalkDashes(70);
  private flecks = new Flecks(120);
  private gloves = new Gloves(2);
  private star = new StarBurst({ points: 8, inner: 0.3, color: MIME.chalk, core: MIME.dark, additive: false });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TheBoxSettings = defaultTheBox()) {
    this.settings = settings;
    this.group.add(this.chalk.mesh, this.flecks.mesh, this.gloves.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SHUT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the box: only sentFrom and point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = BOX_MIN; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, BOX_MIN, BOX_RANGE);
    this.dir.set(dx, 0, dz);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    const px = dz, pz = -dx, c = this.centre;
    // Near-left, near-right, far-right, far-left (near: toward her).
    const at = (a: number, p: number) => ({ x: c.x + dx * a * HALF + px * p * HALF, z: c.z + dz * a * HALF + pz * p * HALF });
    [at(-1, -1), at(-1, 1), at(1, 1), at(1, -1)].forEach((q, i) => this.corners[i].set(q.x, 0, q.z));
    this.chalk.clear();
    for (let i = 0; i < 4; i++) {
      const a = this.corners[i], b = this.corners[(i + 1) % 4];
      this.chalk.add(a.x, a.z, b.x, b.z, 0.34, 0.24, 0.1);
    }
  }

  play() {
    this.reset();
    this.playing = true;
    // The four records, on both screens: the trait draws them from the shut.
    const ctx = this.ctx;
    if (!ctx) return;
    const b = bookOf(ctx.caster);
    for (let i = 0; i < 4; i++) {
      const p = this.corners[i], q = this.corners[(i + 1) % 4];
      this.recs.push(newWall(b, p.x, p.z, q.x, q.z, true, BOX_LIFE));
    }
  }

  private reset() {
    // A cast cut off before the shut leaves nothing behind.
    for (const r of this.recs) if (!r.raised) r.gone = true;
    this.recs = [];
    this.time = 0;
    this.shake = 0;
    this.shut = false;
    this.drawT = 0;
    this.chalk.show(0);
    this.chalk.setOpacity(0);
    this.flecks.reset();
    this.gloves.reset();
    this.star.set(this.centre, 0, 0);
  }

  /** A point on the air-square in front of her: `k` 0..1 round the perimeter from the top-left, clockwise (as she sees it). */
  private square(k: number, out: THREE.Vector3, size = 0.85) {
    const c = this.ctx!.from, f = ((k % 1) + 1) % 1 * 4, side = Math.floor(f), u = f - side;
    const pts: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    const a = pts[side % 4], b = pts[(side + 1) % 4];
    const x = (a[0] + (b[0] - a[0]) * u) * size * 0.5, y = (a[1] + (b[1] - a[1]) * u) * size * 0.5;
    // x across her (her right is +), y up from chest height; a metre in front.
    return out.set(c.x + this.dir.x * 0.85 + this.dir.z * x, 1.35 + y, c.z + this.dir.z * 0.85 - this.dir.x * x);
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

    // --- The drawing: two gloves trace the air-square, each drawing half of it, and the chalk square grows on the floor. ---
    if (!this.shut) {
      const k = Math.min(1, t / SHUT_T);
      this.chalk.show(k);
      this.chalk.setOpacity(0.9 * Math.min(1, t / 0.1));
      const yaw = Math.atan2(this.dir.x, this.dir.z);
      this.gloves.place(0, this.square(k * 0.5, this.v1), yaw, Math.min(1, t * 8), 0, 0);
      this.gloves.place(1, this.square(0.5 + k * 0.5, this.v2), yaw, Math.min(1, t * 8), 0, 0);
      this.drawT += dt;
      if (this.drawT >= 0.05) {
        this.drawT = 0;
        this.flecks.burst(this.v1, 1, 0.7, 0.6, 0.2);
        this.flecks.burst(this.v2, 1, 0.7, 0.6, 0.2);
        // The head of the floor line.
        const f = k * 4, side = Math.min(3, Math.floor(f)), u = f - side, a = this.corners[side], b = this.corners[(side + 1) % 4];
        this.flecks.burst(this.v1.set(a.x + (b.x - a.x) * u, 0.08, a.z + (b.z - a.z) * u), 1, 0.9, 0.7, 0.4);
      }
    }

    // --- The shut: four walls close. A red mark flashes at each corner, chips fly along every wall, the gloves drop. ---
    if (!this.shut && t >= SHUT_T) {
      this.shut = true;
      const b = bookOf(ctx.caster);
      makeRoom(b, 4, true, this.recs);
      for (const r of this.recs) raiseWall(ctx, r);
      this.chalk.setOpacity(0);
      this.gloves.reset();
      for (let i = 0; i < 4; i++) {
        const p = this.corners[i], q = this.corners[(i + 1) % 4];
        this.flecks.burst(this.v1.set(p.x, 0.15, p.z), 5, 2.2, 1, 0.5, MIME.red);
        for (let j = 0; j < 3; j++) this.flecks.burst(this.v1.set(p.x + (q.x - p.x) * (j + 0.5) / 3, 0.1, p.z + (q.z - p.z) * (j + 0.5) / 3), 4, 2.4, 0.9, 0.5);
      }
      this.shake = 0.3;
    }
    if (this.shut) {
      const age = t - SHUT_T;
      const sp = StarBurst.pop(age, 0.05, 0.25);
      this.star.set(this.v1.copy(this.centre).setY(0.9), 3.2 * Math.max(sp.scale, MIN), sp.opacity, age * 3);
      this.shake *= Math.exp(-dt * 10);
    }
  }
}

export const theBoxModule: EffectModule = {
  label: 'the box',
  category: 'hero: mime',
  // The aim point is the middle of the box; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: HALF },
  create: () => new TheBoxFx(),
  telegraphs(effect) {
    const e = effect as TheBoxFx;
    if (!e.ctx) return [];
    // The four walls' lines: they will hold whoever is inside, and root her until they close.
    return e.corners.map((p, i) => {
      const q = e.corners[(i + 1) % 4];
      return { shape: { kind: 'line' as const, x1: p.x, z1: p.z, x2: q.x, z2: q.z, width: TELE_W }, start: 0.04, impact: SHUT_T };
    });
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as TheBoxFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as TheBoxFx).settings, 'loop');
  },
};
