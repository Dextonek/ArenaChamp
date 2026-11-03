import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import type { BoltWall, Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Wind Barrier (sky kit, E: a projectile wall). Zephyr plants his feet and sweeps both hands out; a 5 m wall of wind
 * stands up across the aim, 2 m in front of him, for 3 s. It destroys the other side's bolts that cross it
 * (`ctx.boltWall`): a puff of crescents, speed lines and leaves where each dies. It does not block walking or sight,
 * does not stop his own bolts and does not stop homing basic attacks (those are hits, not bolts). It deals no damage.
 * See pipeline/designs/kit-shapes-v3.md.
 *
 * Both screens of a network duel build the same wall: its geometry comes only from `ctx.sentFrom` and `ctx.point`.
 * Online each screen simulates only the bolts that fly at its own hero, so the wall stops the enemy's bolts on the
 * screen of the hero who raised it, which is where those hits are decided.
 */
export interface WindBarrierSettings {
  loop: boolean;
}

export const defaultWindBarrier = (): WindBarrierSettings => ({ loop: false });

// Timeline (seconds).
const GATHER_T = 0.25; // wind gathers at his hands, the wall starts to rise
const UP_T = 0.55; // the wall stands (the bolt wall is live from GATHER_T)
const LIFE = 3; // seconds the bolt wall stands
const END_T = GATHER_T + LIFE; // it unwinds from here
const DURATION = END_T + 0.8;

const LENGTH = 5;
const FRONT = 2; // from his feet to the wall's middle
const HALF = 0.35; // half thickness against bolts
const HEIGHT = 2.7;
const N_BLADES = 14;
const N_RIB = 5;
const N_PUFF = 3;

const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const sstep = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const hs = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

export class WindBarrier implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WindBarrierSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Wall geometry (ground plane), from sentFrom and point only.
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  private centre = new THREE.Vector3(0, 0, 12);
  /** Unit direction from him toward the wall (toward the enemy), and the unit along the wall. */
  private d = new THREE.Vector3(0, 0, -1);
  private perp = new THREE.Vector3(1, 0, 0);
  private chest = new THREE.Vector3(0, 1.25, 14);

  private flags = { gather: false, up: false, boltWall: false, unwind: false };
  private wall: BoltWall | null = null;
  /** Bolts the wall destroyed since the last frame (the callback may run outside this effect's update). */
  private blocked: THREE.Vector3[] = [];
  private flare = 0;
  private puffs: { at: THREE.Vector3; t: number }[] = [];
  private puffCursor = 0;
  private leafTimer = 0;
  private lineTimer = 0;

  // Parts.
  private ribbons: GustRibbon[] = [];
  private hands = [new GustRibbon(28), new GustRibbon(28)];
  private blades = new WindCrescent(6, N_BLADES + 4);
  private lines = new SpeedLines(40);
  private leaves = new Leaves(56);
  private pops = Array.from({ length: N_PUFF }, () => new StarBurst({ points: 10, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false }));
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private rb = { k: 0, h: 0, rise: 1 };

  constructor(settings: WindBarrierSettings = defaultWindBarrier()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    for (let i = 0; i < N_RIB; i++) this.ribbons.push(new GustRibbon(48));
    for (let i = 0; i < N_PUFF; i++) this.puffs.push({ at: new THREE.Vector3(), t: -9 });
    this.group.add(
      this.blades.mesh, ...this.ribbons.map((r) => r.mesh), ...this.hands.map((r) => r.mesh), this.lines.mesh, this.leaves.mesh,
      ...this.pops.map((p) => p.mesh), this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return UP_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the wall: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.d.set(dx, 0, dz);
    this.perp.set(-dz, 0, dx);
    this.centre.set(s.x + dx * FRONT, 0, s.z + dz * FRONT);
    this.a.copy(this.centre).addScaledVector(this.perp, -LENGTH / 2);
    this.b.copy(this.centre).addScaledVector(this.perp, LENGTH / 2);
    this.chest.set(ctx.from.x, 1.3, ctx.from.z).addScaledVector(this.d, 0.3);
    this.screen.silhouettes = [ctx.caster.group];
    this.screen.focus.copy(this.centre).setY(1.4);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private dropWall() {
    this.wall?.end();
    this.wall = null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flare = 0;
    this.leafTimer = 0;
    this.lineTimer = 0;
    this.blocked.length = 0;
    this.dropWall();
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    for (const p of this.puffs) p.t = -9;
    this.puffCursor = 0;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.blades.reset();
    for (const r of this.ribbons) r.reset();
    for (const r of this.hands) r.reset();
    this.lines.reset();
    this.leaves.reset();
    for (const p of this.pops) p.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  /** A point on the wall at `u` (0..1 along it) and height `y`, waving. */
  private at(u: number, y: number, phase: number, out: THREE.Vector3) {
    const t = this.time;
    const along = (u - 0.5) * LENGTH;
    const sway = 0.16 * Math.sin(u * 9 + t * 3.2 + phase) + 0.07 * Math.sin(u * 17 - t * 5 + phase * 2);
    const bob = 0.14 * Math.sin(u * 6 - t * 2.4 + phase);
    return out.set(this.centre.x + this.perp.x * along + this.d.x * sway, y + bob, this.centre.z + this.perp.z * along + this.d.z * sway);
  }

  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => this.at(u, this.rb.h * this.rb.rise, this.rb.k * 1.7, out);

  /** The hand ribbons: a spiral round each hand while he gathers, then thrown out along the wall. */
  private handPath = (side: number) => (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const t = this.time;
    const sweep = easeOut((t - 0.05) / 0.4);
    const a = u * Math.PI * 2.2 + t * 9 * side;
    const r = 0.3 * (1 - u * 0.4);
    const reach = sweep * (LENGTH / 2) * u * 0.9;
    return out.set(
      this.chest.x + this.perp.x * side * reach + this.d.x * (0.2 + 0.5 * u * sweep) + Math.cos(a) * r * (1 - sweep * 0.6),
      this.chest.y - 0.1 + Math.sin(a) * r + 0.5 * u * sweep,
      this.chest.z + this.perp.z * side * reach + this.d.z * (0.2 + 0.5 * u * sweep) + Math.sin(a) * r * 0.6,
    );
  };

  /** The block callback: queue the spot; the effect draws the puff on its next update. */
  private onBlock = (_bolt: Projectile, at: THREE.Vector3) => {
    this.blocked.push(at.clone());
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    for (const r of this.hands) r.update(dt);
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
    const ctx = this.ctx;

    if (!f.gather && t >= 0.02) {
      f.gather = true;
      this.lines.burst(this.v1.copy(this.chest), this.v2.copy(this.d).setY(0.1), 6, 1.4);
      this.shake = 0.1;
    }
    if (!f.boltWall && t >= GATHER_T) {
      f.boltWall = true;
      // The bolts are cut from here on; the wall's look rises over the next 0.3 s.
      if (ctx?.boltWall) {
        this.wall = ctx.boltWall({ a: this.a, b: this.b, halfWidth: HALF, seconds: LIFE, onBlock: this.onBlock });
      }
    }
    if (!f.up && t >= UP_T) {
      f.up = true;
      this.shake = 0.28;
      this.flare = 1;
      this.lines.burst(this.v1.copy(this.centre).setY(1.2), this.d, 10, 2);
      for (let i = 0; i < 6; i++) {
        this.at(hs(i + 4), 0.3 + hs(i) * 1.6, 0, this.v1);
        this.leaves.blow(this.v1, this.v2.copy(this.d).setY(0.2), 2, 5);
      }
    }
    if (!f.unwind && t >= END_T) {
      f.unwind = true;
      this.wall?.end();
      for (let i = 0; i < 9; i++) {
        this.at(hs(i + 11), 0.4 + hs(i + 2) * 2, 0, this.v1);
        this.leaves.blow(this.v1, this.v2.copy(this.d).multiplyScalar(0.6).addScaledVector(this.perp, hs(i) - 0.5).setY(0.5), 1, 4);
      }
    }

    // Bolts the wall just destroyed: a puff at each.
    for (const at of this.blocked) this.puff(at, t);
    this.blocked.length = 0;

    // Wind keeps streaming along the wall: leaves and speed lines, toward the enemy side.
    if (t >= GATHER_T && t < END_T) {
      this.leafTimer += dt;
      while (this.leafTimer >= 0.09) {
        this.leafTimer -= 0.09;
        this.at(Math.random(), 0.2 + Math.random() * HEIGHT * 0.9, 0, this.v1);
        this.leaves.blow(this.v1, this.v2.copy(this.perp).multiplyScalar(Math.random() < 0.5 ? 1 : -1).addScaledVector(this.d, 0.5).setY(0.1), 1, 2.6);
      }
      this.lineTimer += dt;
      while (this.lineTimer >= 0.16) {
        this.lineTimer -= 0.16;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.at(Math.random(), 0.3 + Math.random() * HEIGHT * 0.85, 0, this.v1);
        this.lines.burst(this.v1, this.v2.copy(this.perp).multiplyScalar(dir), 1, 1.6);
      }
    }

    this.layout(dt);
  }

  /** A bolt died on the wall at `at`: crescents burst off the wall, speed lines, leaves, a pink pop, a ring on the floor. */
  private puff(at: THREE.Vector3, t: number) {
    const p = this.puffs[this.puffCursor];
    this.puffCursor = (this.puffCursor + 1) % N_PUFF;
    p.at.set(at.x, Math.max(at.y, 0.9), at.z);
    p.t = t;
    this.flare = 1;
    this.shake = Math.max(this.shake, 0.16);
    // Two small crescents fan back toward where the bolt came from, a ring of speed lines and a leaf spray.
    this.v1.copy(p.at);
    this.v2.copy(this.d).negate();
    this.blades.slash(this.v1, this.v2, 0.9, 130, 0.5, 0.4, { tone: 1, sweep: 0.08 });
    this.blades.slash(this.v1, this.v2, 0.9, 130, -0.5, 0.4, { sweep: 0.08 });
    this.lines.burst(this.v1, this.v2, 8, 1.4);
    this.v3.copy(this.d).negate().setY(0.3);
    this.leaves.blow(this.v1, this.v3, 6, 5);
    this.groundShock.set(this.v1.set(at.x, 0, at.z), 0.3, 0.02);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;
    this.flare = Math.max(0, this.flare - dt * 3.2);

    // The world dims a touch while the wall stands.
    this.screen.darken = 0.1 * sstep(GATHER_T, UP_T, t) * (1 - sstep(END_T, END_T + 0.5, t));
    this.shake *= Math.pow(0.02, dt);

    const rise = easeOut((t - GATHER_T) / (UP_T - GATHER_T));
    const fall = sstep(END_T, DURATION - 0.1, t);

    // --- The pink pops and the floor ring of the latest puffs. ---
    for (let i = 0; i < N_PUFF; i++) {
      const p = this.puffs[i], age = t - p.t;
      if (age < 0 || age > 0.35) { this.pops[i].set(p.at, 0, 0); continue; }
      const sp = StarBurst.pop(age, 0, 0.03);
      this.pops[i].set(p.at, 1.1 * sp.scale, sp.opacity, 0.2);
    }
    const latest = this.puffs.reduce((m, p) => Math.max(m, p.t), -9);
    if (t - latest < 0.4) {
      const k = (t - latest) / 0.4;
      this.groundShock.set(this.puffs.find((p) => p.t === latest)!.at.clone().setY(0), 0.3 + 2.2 * k, 0.025 * (1 - k) * (1 - k));
    } else if (f.up) {
      const k = THREE.MathUtils.clamp((t - UP_T) / 0.45, 0, 1);
      this.groundShock.set(this.centre, 0.5 + 3.2 * k, 0.03 * (1 - k) * (1 - k));
    }

    // --- Hand ribbons: gather round his hands, then sweep out. ---
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      if (t < UP_T + 0.2) this.hands[i].setFunction(this.handPath(side), 0.2, Math.max(sstep(0, 0.2, t), 0.02), 0.5 * sstep(0.35, 0.75, t), t, 1 - sstep(0.4, 0.75, t));
      else this.hands[i].hide();
    }

    // --- The wall: waving gust ribbons at five heights. ---
    const width = 0.3 + 0.2 * this.flare;
    for (let i = 0; i < N_RIB; i++) {
      this.rb.k = i;
      this.rb.h = 0.35 + (i / (N_RIB - 1)) * (HEIGHT - 0.5);
      this.rb.rise = rise;
      if (t < GATHER_T + 0.02 || fall >= 1) { this.ribbons[i].hide(); continue; }
      this.ribbons[i].setFunction(this.path, width * (1 - 0.5 * fall), 1, 0.9 * fall, t + i * 0.7, (1 - fall * fall) * (0.75 + 0.25 * this.flare));
    }

    // --- Standing sickles along the wall, sliding along it, brighter when a bolt dies. ---
    if (t >= GATHER_T && fall < 1) {
      const op = rise * (1 - fall) * (0.8 + 0.2 * this.flare);
      const yaw = Math.atan2(this.perp.x, this.perp.z);
      for (let i = 0; i < N_BLADES; i++) {
        const dir = i % 2 ? 1 : -1;
        const u = ((hs(i + 5) + dir * t * (0.1 + 0.05 * hs(i))) % 1 + 1) % 1;
        // Each fades near the wall's ends, so it does not pop.
        const edge = Math.min(u, 1 - u) * 6;
        this.at(u, (0.3 + 0.8 * hs(i + 1) + 1.3 * ((i * 3) % 5) / 5) * rise, i, this.v1);
        this.blades.put(this.v1, dir > 0 ? yaw : yaw + Math.PI, Math.PI / 2 + 0.2 * Math.sin(i + t), 0.8 + 0.5 * hs(i + 8), 70 + 30 * hs(i + 2), 1.1, op * Math.min(1, edge), 0.2 + 0.1 * this.flare, i % 7 === 0 ? 1 : 0);
      }
    }
  }
}

export const windBarrierModule: EffectModule = {
  label: 'wind barrier',
  category: 'hero: sky',
  // The aim only gives the direction; the wall is 2 m in front of him wherever the cursor is. No hits, so no enemy list.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new WindBarrier(),
  // No red zone: it does no damage. The rising wall is the signal.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WindBarrier;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    f.add((effect as WindBarrier).settings, 'loop');
  },
};
