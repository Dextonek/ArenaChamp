import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BaaWords, Crook, Dust, SHEEP, SheepHerd, Tufts } from '../../effects/parts/sheep';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';
import { bankPath } from '../../obstacles';
import {
  STAMPEDE_COUNT, STAMPEDE_DAMAGE, STAMPEDE_LENGTH, STAMPEDE_MAX_HITS, STAMPEDE_REACH, STAMPEDE_SPEED, STAMPEDE_WIDTH, STAMPEDE_WIND,
} from '../../traits/sheep';

/**
 * Stampede (sheep kit, R: the whole flock at once). Bo whirls his crook over his head and bellows; for 0.8 s eight sheep gather
 * abreast of him, bouncing on the spot, then at 0.8 s (one short impact frame) they bolt down a line 12 m long and 4 m wide at 8 m/s:
 * a bouncing, rocking rush of wool with dust and tufts flying (drawn, `SheepHerd`; they are NOT summons, so they do not count against the
 * cap of 6 and nothing can kill them). The line is the telegraph and the real shape: `ctx.hit` is decided on each enemy's LIVE position, as the
 * sheep pass: an enemy inside the strip and within 0.75 m of a sheep takes 25 from that sheep, once per sheep, three sheep at most per
 * victim (75), and the trait adds 1 Wool for each (`dealt`, slot 3). The eight lanes are 0.5 m apart across the strip and the sheep
 * stagger two ranks deep, so the strip has no gap: stepping out of it is the only dodge (the telegraph shows from the cast and the first
 * sheep reaches 4 m at 1.3 s). A pillar or wall on the centre line shortens the line (`bankPath`): the sheep stop at it in a burst of
 * wool. The first rank stands on Bo's line at 0.8 s, the second 1.1 m behind. Clean by about 2.9 s.
 * See pipeline/designs/kit-sheep.md.
 */
export interface StampedeSettings {
  damage: number;
  loop: boolean;
}

export const defaultStampede = (): StampedeSettings => ({ damage: STAMPEDE_DAMAGE, loop: false });

const DURATION = 2.9;
const GATHER = 0.4; // the sheep appear
const KNOCK = 2.5;

export class Stampede implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StampedeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: STAMPEDE_LENGTH, width: STAMPEDE_WIDTH };
  /** The line's real length (a pillar on the way shortens it), and the time the last sheep gets to its end. */
  length = STAMPEDE_LENGTH;
  private time = 0;
  private yaw = 0;
  private dir = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);
  private from = new THREE.Vector3();
  private lat: number[] = [];
  private back: number[] = [];
  private gone: boolean[] = [];
  private hitBy: Set<Enemy>[] = [];
  private victimHits = new Map<Enemy, number>();
  private gathered = false;
  private dustT = 0;

  private crook = new Crook();
  private herd = new SheepHerd(STAMPEDE_COUNT);
  private tufts = new Tufts(90);
  private dust = new Dust(40);
  private words = new BaaWords(6);
  private star = new StarBurst({ points: 12, inner: 0.3, color: SHEEP.hay, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: StampedeSettings = defaultStampede()) {
    this.settings = settings;
    this.screen.tint.set(SHEEP.dark);
    this.screen.impactColor.set(SHEEP.hay);
    // Eight lanes 0.5 m apart, a little uneven, two ranks deep (the same on both screens: a hash, not chance).
    for (let i = 0; i < STAMPEDE_COUNT; i++) {
      const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
      this.lat.push((i - (STAMPEDE_COUNT - 1) / 2) * 0.5 + (h(i) - 0.5) * 0.1);
      this.back.push((i % 2) * 1.1 + h(i + 9) * 0.3);
      this.gone.push(false);
      this.hitBy.push(new Set());
    }
    this.group.add(this.dust.mesh, this.tufts.mesh, this.herd.mesh, this.crook.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STAMPEDE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.side.set(dz, 0, -dx);
    this.yaw = Math.atan2(dx, dz);
    this.from.set(s.x, 0, s.z);
    // A pillar or a wall on the centre line ends the run there; both screens get the same obstacles, so the same length.
    const path = bankPath(this.from, this.dir, STAMPEDE_LENGTH, 0, ctx.obstacles?.() ?? [], 0);
    const end = path[path.length - 1];
    this.length = Math.max(1, Math.min(STAMPEDE_LENGTH, Math.hypot(end.x - s.x, end.z - s.z)));
    this.line = { kind: 'line', x1: s.x, z1: s.z, x2: s.x + dx * this.length, z2: s.z + dz * this.length, width: STAMPEDE_WIDTH };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.gathered = false;
    this.dustT = 0;
    this.victimHits.clear();
    for (let i = 0; i < STAMPEDE_COUNT; i++) { this.gone[i] = false; this.hitBy[i].clear(); this.herd.hide(i); }
    this.herd.update();
    this.tufts.reset();
    this.dust.reset();
    this.words.reset();
    this.crook.hide();
    clearScreenFx(this.screen);
    this.star.set(this.from, 0, 0);
  }

  /** Distance run along the line by sheep `i` now (negative: still behind the start). */
  private run(i: number, t: number) {
    return STAMPEDE_SPEED * Math.max(0, t - STAMPEDE_WIND) - this.back[i];
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.tufts.update(dt);
    this.dust.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const fwd = this.dir;

    // --- Wind-up: the crook whirls over his head, the flock gathers abreast of him, pawing the ground. ---
    if (t < STAMPEDE_WIND + 0.1) {
      this.v1.set(this.from.x + fwd.x * 0.3 + this.side.x * 0.45, 1.3, this.from.z + fwd.z * 0.3 + this.side.z * 0.45);
      this.crook.place(this.v1, this.yaw, 0.3 + 0.3 * Math.sin(t * 20), Math.sin(t * 30) * 0.35);
    } else this.crook.hide();
    if (!this.gathered && t >= GATHER) {
      this.gathered = true;
      for (let i = 0; i < STAMPEDE_COUNT; i++) {
        this.v2.set(this.from.x + this.side.x * this.lat[i], 0, this.from.z + this.side.z * this.lat[i]);
        this.dust.puff(this.v2.setY(0.15), 0.5, SHEEP.dust, 0.4);
        if (i % 2 === 0) this.words.say(this.v2.setY(0), 0.8, 0.9);
      }
    }

    // --- The impact frame, and the rush. ---
    this.screen.impact = impactFrameAt(t, STAMPEDE_WIND, [1, 2], 0.04);
    if (t >= STAMPEDE_WIND && t < STAMPEDE_WIND + 0.15) {
      const sp = StarBurst.pop(t - STAMPEDE_WIND, 0.03, 0.12);
      this.star.set(this.v1.set(this.from.x + fwd.x * 0.8, 1, this.from.z + fwd.z * 0.8), 2.6 * sp.scale, sp.opacity, t * 3);
    } else this.star.set(this.from, 0, 0);

    this.dustT += dt;
    const puffNow = this.dustT >= 0.05;
    if (puffNow) this.dustT = 0;
    let running = 0;
    for (let i = 0; i < STAMPEDE_COUNT; i++) {
      if (t < GATHER || this.gone[i]) continue;
      const d = this.run(i, t);
      const k = i * 1.7;
      if (d > this.length) {
        // The end of the line: a burst of wool and a puff, and the sheep is gone.
        this.gone[i] = true;
        this.herd.hide(i);
        this.v2.set(this.from.x + fwd.x * this.length + this.side.x * this.lat[i], 0.5, this.from.z + fwd.z * this.length + this.side.z * this.lat[i]);
        this.tufts.burst(this.v2, 6, 4, 0.9);
        this.dust.puff(this.v2.setY(0.2), 0.7, SHEEP.dust, 0.5);
        continue;
      }
      const rushing = t >= STAMPEDE_WIND;
      running++;
      const x = this.from.x + fwd.x * d + this.side.x * this.lat[i], z = this.from.z + fwd.z * d + this.side.z * this.lat[i];
      const bounce = rushing ? Math.abs(Math.sin(t * 15 + k)) * 0.38 : Math.abs(Math.sin(t * 9 + k)) * 0.12;
      const pop = Math.min(1, (t - GATHER) / 0.15);
      this.herd.set(i, x, z, this.yaw, bounce, rushing ? Math.sin(t * 15 + k) * 0.22 : 0, 0.3 + 0.7 * pop);
      if (rushing && d >= 0 && puffNow && (i + Math.floor(t * 20)) % 3 === 0) {
        this.dust.puff(this.v2.set(x - fwd.x * 0.4, 0.12, z - fwd.z * 0.4), 0.45, SHEEP.dust, 0.5);
        if (Math.random() < 0.4) this.tufts.throw(this.v2.set(x, 0.6, z), this.v1.set((Math.random() - 0.5) * 1.5, 1.5, (Math.random() - 0.5) * 1.5), 0.1, 0.7);
      }
      if (rushing && ctx && d >= 0) this.touch(ctx, i, x, z);
    }
    this.herd.update();
    this.shake = running > 0 && t >= STAMPEDE_WIND ? Math.max(this.shake * 0.9, 0.07) : this.shake * Math.exp(-dt * 10);
    if (t >= STAMPEDE_WIND && t < STAMPEDE_WIND + 0.1) this.shake = 0.35;
  }

  /** Sheep `i` at (x, z): any enemy inside the strip within reach of it, not hit by it before and not already hit three times, takes a hit. */
  private touch(ctx: CastContext, i: number, x: number, z: number) {
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (this.hitBy[i].has(e) || (this.victimHits.get(e) ?? 0) >= STAMPEDE_MAX_HITS) continue;
      if (!insideTelegraph(this.line, p.x, p.z) || Math.hypot(p.x - x, p.z - z) > STAMPEDE_REACH) continue;
      this.hitBy[i].add(e);
      this.victimHits.set(e, (this.victimHits.get(e) ?? 0) + 1);
      ctx.hit(e, { damage: this.settings.damage, knock: KNOCK, from: this.v1.set(x, 0, z).clone(), color: '#c9b26a' });
      this.tufts.burst(this.v1.set(p.x, 0.9, p.z), 5, 3.5, 0.8);
    }
  }
}

export const stampedeModule: EffectModule = {
  label: 'stampede',
  category: 'hero: sheep',
  // A line from him toward the aim; the CPU casts it with the enemy within 10 m.
  targeting: { mode: 'ground', radius: STAMPEDE_WIDTH / 2 },
  create: () => new Stampede(),
  telegraphs(effect) {
    const e = effect as Stampede;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: STAMPEDE_WIND, until: STAMPEDE_WIND + e.length / STAMPEDE_SPEED + 0.2 }];
  },
  bloom: { enabled: true, strength: 0.32, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Stampede;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Stampede).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 80, 1);
  },
};
