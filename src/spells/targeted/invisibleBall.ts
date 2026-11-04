import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { ChalkDashes, Flecks, Gloves, MIME, MIME_CSS } from '../../effects/parts/mime';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { BALL_DAMAGE, BALL_RADIUS, BALL_RANGE, BALL_SPEED, BALL_WIND, isOwnWall, passBolt, restoreWalls } from '../../traits/mime';

/**
 * Invisible Ball (mime kit v5, Q: a skillshot you cannot see). Mum cups a ball that is not there: her right glove closes round
 * nothing, winds back (0.3 s) and throws; the left hand stays up as if to balance. Nothing flies in the air. The only sign is the
 * line on the floor: a dashed chalk line, and under it the telegraph, `boltWidth(radius)` wide, which is as wide as the ball
 * really hits. The ball is a real bolt (`ctx.projectile`: 9 m from her, 22 m/s, radius 0.3, 50 damage); it reaches 6 m at 0.54 s.
 * It stops at pillars and walls of the arena but flies through her own walls: `passBolt` lifts a wall's obstacle while the bolt
 * is at it and the line is drawn through them (`isOwnWall`). Her screen of a network duel has no bolt and draws nothing more.
 * Where it hits, a chalk star and chips of chalk pop out of the air: that is when it is seen. A miss ends in a small puff of chalk
 * dust on the floor at the end of the line. No word, no floating text. Clean by about 2.2 s.
 * See pipeline/designs/kit-mime.md.
 */
export interface InvisibleBallSettings {
  damage: number;
  knock: number;
}

export const defaultInvisibleBall = (): InvisibleBallSettings => ({ damage: BALL_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.8;
const LINE_W = boltWidth(BALL_RADIUS);
const BOLT_Y = 1.1;
const MAX_T = 3;
const FADE = 0.5;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class InvisibleBall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InvisibleBallSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The line, with its timing. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private hit = false;
  private len = 0;

  private dir = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private hand = new THREE.Vector3();

  private chalk = new ChalkDashes(70);
  private flecks = new Flecks(70);
  private gloves = new Gloves(2);
  private star = new StarBurst({ points: 8, inner: 0.3, color: MIME.chalk, core: MIME.dark, additive: false });
  private starAge = 9;
  private starPos = new THREE.Vector3();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: InvisibleBallSettings = defaultInvisibleBall()) {
    this.settings = settings;
    this.group.add(this.chalk.mesh, this.flecks.mesh, this.gloves.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return BALL_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom, the aim point and the obstacles other than her own walls.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    this.dir.set(dx, 0, dz);
    this.side.set(dz, 0, -dx);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const solid = (ctx.obstacles?.() ?? []).filter((o) => !isOwnWall(ctx.caster, o));
    const path = bankPath(this.start, this.dir, BALL_RANGE - MUZZLE, 0, solid);
    const e = path[path.length - 1];
    this.end.set(e.x, 0, e.z);
    this.len = Math.hypot(e.x - s.x, e.z - s.z);
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
      start: 0,
      impact: BALL_WIND,
      until: BALL_WIND + (this.len - MUZZLE) / BALL_SPEED,
    }];
    this.chalk.clear();
    this.chalk.add(s.x + dx * 0.6, s.z + dz * 0.6, e.x, e.z, 0.34, 0.26, 0.09);
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
    this.hit = false;
    this.starAge = 9;
    this.star.set(this.starPos, 0, 0);
    this.chalk.setOpacity(0);
    this.flecks.reset();
    this.gloves.reset();
    if (this.ctx) restoreWalls(this.ctx.caster);
  }

  /** Her right hand at `back` 0 (cupped at her side) to 1 (thrown out to the front). */
  private handAt(back: number, out: THREE.Vector3) {
    const c = this.ctx!.from;
    const f = -0.15 + 0.85 * back, h = 1.25 + 0.15 * Math.sin(back * Math.PI);
    return out.set(c.x + this.dir.x * f + this.side.x * 0.38, h, c.z + this.dir.z * f + this.side.z * 0.38);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (!ctx) return;

    // --- The line on the floor: chalk drawn from her toward the end, in 0.2 s, held until the ball is gone, then gone. ---
    const drawn = Math.min(1, t / 0.2);
    this.chalk.show(drawn);
    const fade = this.goneAt >= 0 ? 1 - Math.min(1, (t - this.goneAt) / FADE) : 1;
    this.chalk.setOpacity(0.8 * Math.min(1, t / 0.12) * fade);

    // --- Wind-up: the hand cups nothing, draws back and throws. The left hand hangs up in the air to balance. ---
    const k = Math.min(1, t / BALL_WIND);
    const swing = k < 0.7 ? -0.35 * easeOut(k / 0.7) : -0.35 + 1.35 * easeOut((k - 0.7) / 0.3);
    if (t < BALL_WIND + 0.25) {
      this.handAt(Math.max(-0.4, Math.min(1, swing + 0.4)), this.hand);
      this.gloves.place(0, this.hand, Math.atan2(this.dir.x, this.dir.z), 1, t < BALL_WIND ? 0.85 : Math.max(0, 0.85 - (t - BALL_WIND) * 8), -0.4);
      const c = ctx.from;
      this.gloves.place(1, this.v1.set(c.x - this.side.x * 0.4 + this.dir.x * 0.1, 1.55, c.z - this.side.z * 0.4 + this.dir.z * 0.1), Math.atan2(this.dir.x, this.dir.z), Math.min(1, t * 6), 0.1, 0.5);
    } else {
      const o = 1 - Math.min(1, (t - BALL_WIND - 0.25) / 0.25);
      this.gloves.place(0, this.handAt(0.4, this.hand), Math.atan2(this.dir.x, this.dir.z), o, 0.2, -0.4);
      this.gloves.place(1, this.v1.set(ctx.from.x - this.side.x * 0.4, 1.55, ctx.from.z - this.side.z * 0.4), Math.atan2(this.dir.x, this.dir.z), o, 0.1, 0.5);
    }

    // --- Fire. A real bolt where there is one; her screen of a network duel only has the line. ---
    if (!this.fired && t >= BALL_WIND) {
      this.fired = true;
      this.shake = 0.04;
      // A stroke of chalk in the air where the arm swung.
      this.flecks.line(this.handAt(-0.2, this.v1), this.handAt(1, this.v2), 7, 1);
      if (ctx.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: BALL_SPEED, range: BALL_RANGE - MUZZLE, radius: BALL_RADIUS,
          hit: { damage: this.settings.damage, knock: this.settings.knock, color: MIME_CSS.chalk },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      } else {
        // No bolt here: the line runs its time, the end is only for the dust.
        this.goneAt = t + Math.max(0, (this.len - MUZZLE) / BALL_SPEED);
        this.lastPos.copy(this.end);
      }
    }

    // --- The ball flies unseen. Her walls open in its way; nothing is drawn. ---
    const b = this.bolt;
    if (b) {
      if (b.alive) {
        this.lastPos.copy(b.pos);
        passBolt(ctx.caster, b.pos, b.dir, BALL_RADIUS);
      } else if (this.goneAt < 0) {
        this.goneAt = t;
        restoreWalls(ctx.caster);
        // A miss ends in a small puff of dust where the line ends.
        if (!this.hit) this.flecks.burst(this.v1.set(this.lastPos.x, 0.1, this.lastPos.z), 5, 1.2, 0.8, 0.3);
      }
    }

    // --- The star where it hit. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.2);
    this.star.set(this.starPos, 1.6 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + FADE + 0.4 && !this.flecks.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** A hit: the ball pops out of the air as chalk. */
  private onHit(at: THREE.Vector3) {
    this.hit = true;
    this.starPos.set(at.x, BOLT_Y, at.z);
    this.starAge = 0;
    this.flecks.burst(this.v1.set(at.x, BOLT_Y, at.z), 16, 4.5, 1.1);
    this.shake = 0.12;
  }
}

export const invisibleBallModule: EffectModule = {
  label: 'invisible ball',
  category: 'hero: mime',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: BALL_RADIUS },
  create: () => new InvisibleBall(),
  telegraphs(effect) {
    const e = effect as InvisibleBall;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as InvisibleBall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as InvisibleBall).settings;
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
