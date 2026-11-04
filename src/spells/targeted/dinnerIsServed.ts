import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CHEF, CHEF_CSS, Chunks, TABLE_TOP, TABLE_WIDTH, Vapour, buildTable } from '../../effects/parts/chef';
import type { MinionLook } from '../../effects/parts/minion';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { TABLE_AHEAD, TABLE_HP, TABLE_LEN, TABLE_LIFE, TABLE_RISE, TABLE_THICK, bookOf, type TableRec } from '../../traits/chef';

/**
 * Dinner Is Served (chef kit v5, R: terrain with a prize). Madame Cleaver snaps her fingers and a long banquet table, 8 m of it,
 * rises out of the floor in front of her, across her aim, in 0.6 s: a cream cloth shaking itself smooth as it comes up and hanging in
 * folds to the floor, a red runner, a candle at each end, and three covered silver plates that bounce into place one after another.
 * Dust and steam roll out along its length. It stands for 5 s as a real obstacle (`ctx.addObstacle`, a wall 1.2 m thick along the
 * whole table): it blocks walking, sight and bolts for both heroes and the AI. Its place comes only from `ctx.sentFrom` and the aim,
 * so both screens of a network duel build the same one.
 *
 * It breaks at 150 damage. Built as the brief says (see vanityStand.ts / crystalPillar.ts): three summoned 'turret' units (damage 0,
 * no reach, invisible look; made BEFORE the obstacle and pinned to the table every frame) sit along it so a shot at any part of the table
 * can hit; they share one pool of HP (each frame all take the lowest value, so the bars agree) and when it is gone, or one is
 * slain, `onDeath` removes the obstacle and the table bursts into splinters, plates and cloth. Without `ctx.summon` (her own screen
 * online) it only times out or breaks with the trait's message (`TableRec.gone`, written by `peerNote('table')`).
 *
 * The food: whoever stands within 1.8 m of the table for 1 s eats all three plates (`src/traits/chef.ts`: for her 50 HP and +25%
 * damage for 5 s; for the enemy +25% damage for 5 s). The domes then jump off the plates in a burst of steam and gold glints.
 * Telegraph: the table's footprint (a line 1.2 m wide, impact at the rise), which roots her until it is up. Clean by about 7 s.
 * See pipeline/designs/kit-chef.md.
 */
export interface DinnerSettings {
  hp: number;
  loop: boolean;
}

export const defaultDinner = (): DinnerSettings => ({ hp: TABLE_HP, loop: false });

// Timeline (seconds).
const RISE_T = TABLE_RISE;
const STAND_END = RISE_T + TABLE_LIFE;
const WARN_T = STAND_END - 0.9;
const DURATION = STAND_END + 1.3;
const HALF = TABLE_LEN / 2;
const MIN = 1e-3;
const PLATE_AT = [0.42, 0.5, 0.58];

/** The summoned units' look: nothing. The effect draws the table; the units give the HP bars and the targets. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: TABLE_TOP + 1.2 });

const easeOutBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
};

export class DinnerIsServed implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DinnerSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The table's middle and its two ends, from sentFrom and the aim only. */
  readonly centre = new THREE.Vector3(0, 0, 9);
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  private axis = new THREE.Vector3(1, 0, 0);
  private yaw = 0;
  private time = 0;
  private flags = { risen: false, shattered: false, eatenShown: false };
  private eatenAt = 0;
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private units: SummonUnit[] = [];
  private rec: TableRec | null = null;
  private broke = false;
  private hpSeen = 1;
  private endAt = DURATION;
  private steamT = 0;

  private table = buildTable(TABLE_LEN);
  private dust = new Vapour(90);
  private bits = new Chunks(70);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: CHEF.core, core: 0xffffff, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shade = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_LEN + 1, TABLE_WIDTH + 1.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.dark, transparent: true, opacity: 0, depthWrite: false }),
  );
  private seed = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_LEN, 0.16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.core, transparent: true, opacity: 0, depthWrite: false }),
  );
  private v1 = new THREE.Vector3();

  constructor(settings: DinnerSettings = defaultDinner()) {
    this.settings = settings;
    this.shade.renderOrder = 1;
    this.seed.renderOrder = 2;
    this.group.add(this.shade, this.seed, this.table.group, this.dust.mesh, this.bits.mesh, this.pop.mesh, this.shock.mesh);
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
    // Both screens must agree on the table: only sentFrom and the aim.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    this.centre.set(s.x + dx * TABLE_AHEAD, 0, s.z + dz * TABLE_AHEAD);
    this.axis.set(dz, 0, -dx);
    this.a.copy(this.centre).addScaledVector(this.axis, -HALF);
    this.b.copy(this.centre).addScaledVector(this.axis, HALF);
    this.yaw = Math.atan2(-this.axis.z, this.axis.x);
  }

  play() {
    this.reset();
    this.playing = true;
    // The record the trait reads, on both screens.
    const ctx = this.ctx;
    if (ctx) {
      const now = performance.now(), C = this.centre;
      const bk = bookOf(ctx.caster);
      this.rec = {
        x: C.x, z: C.z, ax: this.a.x, az: this.a.z, bx: this.b.x, bz: this.b.z, yaw: this.yaw,
        bornAt: now + RISE_T * 1000, until: now + STAND_END * 1000, eaten: false, gone: false, broke: false, told: false,
      };
      bk.table = this.rec;
      bk.standSelf = 0;
      bk.standFoe = 0;
    }
  }

  private dropObstacle() {
    if (this.obstacle) this.obstacleCtx?.removeObstacle?.(this.obstacle);
    this.obstacle = null;
    this.obstacleCtx = null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.risen = this.flags.shattered = this.flags.eatenShown = false;
    this.eatenAt = 0;
    this.broke = false;
    this.units = [];
    this.rec = null;
    this.hpSeen = 1;
    this.endAt = DURATION;
    this.steamT = 0;
    this.dropObstacle();
    this.dust.reset();
    this.bits.reset();
    this.table.group.visible = false;
    this.pop.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    this.shade.visible = this.seed.visible = false;
    for (const m of [this.shade, this.seed]) (m.material as THREE.MeshBasicMaterial).opacity = 0;
    for (const p of this.table.plates) { p.dome.position.set(0, 0, 0); p.dome.rotation.set(0, 0, 0); p.dome.visible = true; p.food.visible = true; p.group.scale.setScalar(MIN); }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dust.update(dt);
    this.bits.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt && !this.dust.busy && !this.bits.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, C = this.centre;

    // --- The seed: a pale line on the floor, the table's footprint, and a shadow. ---
    if (!this.shade.visible) {
      this.shade.visible = this.seed.visible = true;
      for (const m of [this.shade, this.seed]) { m.position.set(C.x, 0.03, C.z); m.rotation.y = this.yaw; }
      this.seed.position.y = 0.05;
    }
    if (!f.shattered) {
      const k = smoothstep(t / RISE_T);
      (this.shade.material as THREE.MeshBasicMaterial).opacity = 0.35 * k;
      (this.seed.material as THREE.MeshBasicMaterial).opacity = (t < RISE_T ? 0.8 : 0.35) * (1 - 0.5 * smoothstep((t - RISE_T) / 0.4));
      this.seed.scale.set(0.3 + 0.7 * k, 1, 1 + 6 * (1 - k));
    }

    // --- The rise: the table comes up out of the floor with a small overshoot; the cloth shakes smooth. ---
    if (!f.shattered && t > 0.03) {
      const tg = this.table.group;
      tg.visible = true;
      tg.position.set(C.x, 0, C.z);
      tg.rotation.y = this.yaw;
      const k = easeOutBack(t / RISE_T);
      tg.position.y = -(TABLE_TOP + 0.4) * (1 - k);
      this.table.wave(t, Math.max(0, 1 - (t - RISE_T) / 0.8));
      for (let i = 0; i < 3; i++) {
        const pk = easeOutBack((t - PLATE_AT[i]) / 0.18);
        this.table.plates[i].group.scale.setScalar(Math.max(MIN, pk));
      }
      // Dust and steam roll out along its length as it rises.
      if (t < RISE_T + 0.3) {
        this.steamT += dt;
        if (this.steamT >= 0.03) {
          this.steamT = 0;
          const x = (Math.random() - 0.5) * TABLE_LEN, side = Math.random() < 0.5 ? -1 : 1;
          this.v1.set(C.x + this.axis.x * x + this.axis.z * side * 0.9, 0.15, C.z + this.axis.z * x - this.axis.x * side * 0.9);
          this.dust.burst(this.v1, 1, CHEF.hot, 0.9, 1.4, 0.7, 0.9);
        }
      }
    }
    if (!f.risen && t >= RISE_T) {
      f.risen = true;
      this.rise();
    }

    if (f.risen && !f.shattered) {
      this.keepUnits();
      // Her own screen has no units: the trait's note (`gone`) breaks the table there. The enemy's screen too, when it broke here.
      if (this.rec?.gone) this.broke = true;
      this.table.wave(t, t >= WARN_T ? 0.6 : 0.12);
      const age = t - RISE_T;
      // Steam leaks from under the domes while the food is there.
      if (!this.rec?.eaten) {
        this.steamT += dt;
        if (this.steamT >= 0.22) {
          this.steamT = 0;
          const i = Math.floor(Math.random() * 3), x = this.table.plates[i].x;
          this.dust.burst(this.v1.set(C.x + this.axis.x * x, TABLE_TOP + 0.5, C.z + this.axis.z * x), 1, CHEF.core, 0.9, 0.3, 0.35, 1.1);
        }
      } else this.eaten(dt);
      if (t >= WARN_T) {
        // About to go: the table shudders and sheds crumbs, faster toward the end.
        const k = smoothstep((t - WARN_T) / (STAND_END - WARN_T));
        this.table.group.position.y = 0.03 * Math.sin(t * (20 + 30 * k)) * k;
        if (Math.random() < 0.15 + 0.4 * k) {
          const x = (Math.random() - 0.5) * TABLE_LEN;
          this.bits.burst(this.v1.set(C.x + this.axis.x * x, TABLE_TOP + 0.2, C.z + this.axis.z * x), 1, [CHEF.core, CHEF.white], 0.8, 1.5, 0.07);
        }
      }
      const p = StarBurst.pop(age, 0.05, 0.2);
      this.pop.set(this.v1.set(C.x, 1.3, C.z), 3.6 * p.scale, p.opacity, age * 3);
      const gp = THREE.MathUtils.clamp(age / 0.45, 0, 1);
      this.shock.set(C, 0.6 + 4.2 * gp, 0.045 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.35 * Math.exp(-age * 9));
      if (t >= STAND_END || this.broke) this.shatter();
    }
    if (f.shattered) {
      for (const m of [this.shade, this.seed]) (m.material as THREE.MeshBasicMaterial).opacity *= Math.exp(-dt * 6);
      this.shake *= Math.exp(-dt * 10);
    }
  }

  /** The table is up: the HP (units), then the obstacle, then the burst. */
  private rise() {
    const ctx = this.ctx, C = this.centre;
    if (ctx) {
      // The units first, so the engine does not push them out of the obstacle; the obstacle second.
      const sm = ctx.summon?.({
        kind: 'turret', at: C.clone(), count: 3, hp: this.settings.hp, seconds: TABLE_LIFE + 0.1, damage: 0, attackEvery: 999, range: 0.01,
        color: CHEF_CSS.body, look: HIDDEN,
      });
      this.units = sm?.units ?? [];
      this.hpSeen = 1;
      this.keepUnits();
      sm?.onDeath((u) => {
        if (!u.slain) return;
        // Broken by damage: the way through opens at once; the trait tells her own client (`victimTick`).
        this.broke = true;
        if (this.rec) { this.rec.broke = true; this.rec.gone = true; }
        this.dropObstacle();
      });
      const o: Obstacle = { ax: this.a.x, az: this.a.z, bx: this.b.x, bz: this.b.z, r: TABLE_THICK, height: TABLE_TOP + 0.15, kind: 'wall' };
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, TABLE_LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
    for (let i = 0; i < 12; i++) {
      const x = (i / 11 - 0.5) * TABLE_LEN;
      this.dust.burst(this.v1.set(C.x + this.axis.x * x, 0.2, C.z + this.axis.z * x), 2, CHEF.hot, 0.6, 2.2, 0.8, 1);
    }
    this.shake = 0.4;
  }

  /** Holds the units along the table (a knock would push them out), and shares one pool of HP between them. */
  private keepUnits() {
    const live = this.units.filter((u) => u.alive);
    if (live.length === 0) return;
    const C = this.centre, ax = this.axis;
    this.units.forEach((u, i) => {
      if (!u.alive) return;
      const x = (i - (this.units.length - 1) / 2) * (TABLE_LEN * 0.34);
      u.pos.set(C.x + ax.x * x, 0, C.z + ax.z * x);
      u.knock.set(0, 0, 0);
    });
    let low = Infinity;
    for (const u of live) low = Math.min(low, u.hp);
    for (const u of live) u.hp = low;
    const k = low / live[0].max;
    if (k < this.hpSeen - 1e-4) {
      this.hpSeen = k;
      this.shake = Math.max(this.shake, 0.2);
      const x = (Math.random() - 0.5) * TABLE_LEN;
      this.bits.burst(this.v1.set(C.x + ax.x * x, TABLE_TOP + 0.3, C.z + ax.z * x), 5, [CHEF.core, CHEF.white, CHEF.steel], 2, 3, 0.08);
    }
  }

  /** The food is eaten: the domes jump off in a burst of steam and gold. */
  private eaten(dt: number) {
    const C = this.centre, f = this.flags;
    if (!f.eatenShown) {
      f.eatenShown = true;
      this.eatenAt = this.time;
      for (let i = 0; i < 3; i++) {
        const x = this.table.plates[i].x;
        this.v1.set(C.x + this.axis.x * x, TABLE_TOP + 0.3, C.z + this.axis.z * x);
        this.dust.burst(this.v1, 6, CHEF.core, 1.8, 1.4, 0.5, 1.1);
        this.bits.burst(this.v1, 8, [CHEF.gold, 0xf0d878, CHEF.core], 2.4, 5, 0.09);
      }
      this.shake = Math.max(this.shake, 0.2);
    }
    const a = this.time - this.eatenAt;
    this.table.plates.forEach((p, i) => {
      p.food.visible = a < 0.08;
      p.dome.visible = a < 0.7;
      const s = i - 1;
      p.dome.position.set(s * 1.4 * a, 2.6 * a - 6 * a * a, (i % 2 ? 1 : -1) * 0.9 * a);
      p.dome.rotation.set(a * 9, a * 6, a * 7);
    });
    void dt;
  }

  /** It breaks (damage) or runs out (time): the table drops into the floor in splinters, plates and cloth. */
  private shatter() {
    const f = this.flags, C = this.centre;
    if (f.shattered) return;
    f.shattered = true;
    this.dropObstacle();
    if (this.rec) this.rec.gone = true;
    for (const u of this.units) if (u.alive) u.left = 0;
    this.table.group.visible = false;
    const n = this.broke ? 3 : 2;
    for (let i = 0; i < 12; i++) {
      const x = (i / 11 - 0.5) * TABLE_LEN;
      this.v1.set(C.x + this.axis.x * x, TABLE_TOP * 0.8, C.z + this.axis.z * x);
      this.bits.burst(this.v1, n * 2, [CHEF.core, CHEF.white, CHEF.wood, CHEF.foil, CHEF.steel], 3.5, 5, 0.13);
      this.dust.burst(this.v1, 1, CHEF.hot, 0.8, 2, 0.8, 1);
    }
    this.pop.set(C, 0, 0);
    this.shake = 0.35;
    this.endAt = Math.min(this.endAt, this.time + 1.2);
  }
}

export const dinnerIsServedModule: EffectModule = {
  label: 'dinner is served',
  category: 'hero: chef',
  // The table rises in front of her; the AI casts it with the enemy within about 7.5 m (the radius less 0.6).
  targeting: { mode: 'self', radius: 8.1 },
  create: () => new DinnerIsServed(),
  telegraphs(effect) {
    const e = effect as DinnerIsServed;
    if (!e.ctx) return [];
    // The footprint of the table: it roots her until it is up.
    return [{ shape: { kind: 'line', x1: e.a.x, z1: e.a.z, x2: e.b.x, z2: e.b.z, width: TABLE_WIDTH }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DinnerIsServed;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DinnerIsServed).settings;
    f.add(s, 'loop');
    f.add(s, 'hp', 1, 400, 1);
  },
};
