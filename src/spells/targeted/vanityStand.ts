import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import type { MinionLook } from '../../effects/parts/minion';
import { MIRROR, MIRROR_CSS, STAND_HEIGHT, Slivers, StandMirror } from '../../effects/parts/mirror';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { STAND_HP, STAND_LIFE, STAND_RANGE, STAND_RISE, bookOf, type StandRecord } from '../../traits/mirror';

/**
 * Vanity Stand (mirror kit v5, W: terrain). A pale seed of light and a floor ring mark a spot (8 m, at least 1.5 m from her); at 0.5 s a
 * tall ornate full-length mirror in a silver frame (an arch, two feet, a violet gem) steps up there, facing the camera side, and stands
 * for 6 s as a real obstacle (`ctx.addObstacle`, a wall 1.1 m wide): it blocks walking, sight and bolts for both heroes and the AI,
 * and her own bolts reflect off it like off any wall (it is a flat surface across the screen: a bolt coming straight down the
 * screen comes straight back). Its place comes only from `ctx.sentFrom` and `ctx.point`, so both screens of a network duel build
 * the same one.
 *
 * It breaks at 60 damage. Built the way a breakable placed thing is (see crystalPillar.ts): the HP lives in a summoned 'turret'
 * unit (`ctx.summon`: 60 HP, damage 0, no reach, an invisible look), made BEFORE the obstacle and pinned to the spot every frame.
 * When it dies by damage `onDeath` removes the obstacle, the mirror bursts into glass, and the Stand's record (`mirrorBooks`,
 * written on both screens at the cast) is marked broken: the trait's `victimTick` puts Bad Luck on the breaker (the debuff `weaken`,
 * 15% less damage for 7 s, "SEVEN YEARS BAD LUCK") on the screen where the breaker's damage is decided, and tells her own client,
 * where the effect then breaks the Stand too (the record's `gone`). Without `ctx.summon` (her own screen online) it only times out or
 * breaks with that message. Through the Glass (E) reads the record: the Stand is a door while it stands.
 *
 * The telegraph is the footprint (a 0.9 m circle, impact at the rise): it roots her until then. Clean by 7.5 s.
 * See pipeline/designs/kit-mirror.md.
 */
export interface VanityStandSettings {
  hp: number;
  loop: boolean;
}

export const defaultVanityStand = (): VanityStandSettings => ({ hp: STAND_HP, loop: false });

// Timeline (seconds).
const RISE_T = STAND_RISE;
const SHATTER_T = RISE_T + STAND_LIFE;
const CRACK_T = SHATTER_T - 0.9;
const DURATION = SHATTER_T + 1.0;

const MIN_DIST = 1.5;
const FOOT_R = 0.9; // the telegraph circle
const HALF_LEN = 0.55; // the obstacle runs along the screen's x axis
const THICK = 0.18;
const MIN = 1e-3;

/** The summoned unit's look: nothing. The effect draws the mirror; the unit gives the HP bar (over the frame) and the target. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: STAND_HEIGHT + 0.3 });

const easeOutBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
};

export class VanityStandFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VanityStandSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the mirror stands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private flags = { risen: false, shattered: false };
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private unit: SummonUnit | null = null;
  private rec: StandRecord | null = null;
  private broke = false;
  private hpSeen = 1;
  private endAt = DURATION;
  private sparkT = 0;

  private stand = new StandMirror();
  private slivers = new Slivers(110);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MIRROR.body, core: 0xffffff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: MIRROR.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: MIRROR.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();

  constructor(settings: VanityStandSettings = defaultVanityStand()) {
    this.settings = settings;
    // A dark layer under the mirror and a pale ring round its foot: it reads on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.stand.mesh, this.slivers.mesh, this.pop.mesh, this.groundShock.mesh);
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
    // Both screens must agree on the mirror: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, STAND_RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
  }

  play() {
    this.reset();
    this.playing = true;
    // The record Through the Glass and the trait read, on both screens.
    const ctx = this.ctx;
    if (ctx) {
      const now = performance.now(), C = this.centre;
      this.rec = { x: C.x, z: C.z, bornAt: now + RISE_T * 1000, until: now + SHATTER_T * 1000, gone: false, broke: false, luckAt: 0, luckDone: false };
      bookOf(ctx.caster).stand = this.rec;
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
    this.flags.risen = this.flags.shattered = false;
    this.broke = false;
    this.unit = null;
    this.rec = null;
    this.hpSeen = 1;
    this.endAt = DURATION;
    this.sparkT = 0;
    this.dropObstacle();
    this.stand.hide();
    this.slivers.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
    this.shade.visible = this.rim.visible = false;
    this.shadeMat.opacity = this.rimMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.slivers.update(dt);
    this.stand.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt && !this.slivers.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, C = this.centre;

    // --- The seed: a floor ring and a thin column of light, growing toward the rise. ---
    if (!this.shade.visible) {
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.rim.position.set(C.x, 0.04, C.z);
    }
    if (!f.risen) {
      const k = smoothstep(t / RISE_T);
      this.shade.scale.setScalar(FOOT_R * (0.5 + 0.7 * k));
      this.shadeMat.opacity = 0.4 * k;
      this.rim.scale.setScalar(FOOT_R * (0.5 + 0.5 * k));
      this.rimMat.opacity = 0.35 + 0.5 * k;
      this.sparkT += dt;
      if (this.sparkT >= 0.07) { this.sparkT = 0; this.slivers.burst(this.v1.set(C.x, 0.2 + Math.random() * 1.2, C.z), 1, 1.0); }
    }
    if (!f.risen && t >= RISE_T) {
      f.risen = true;
      this.rise();
    }

    if (f.risen && !f.shattered) {
      this.keepUnit();
      // Her own screen has no unit: the trait's note (`gone`) breaks the Stand there.
      if (this.rec?.gone) this.broke = true;
      const age = t - RISE_T;
      // The mirror steps up from the floor with a small overshoot.
      const grow = easeOutBack(age / 0.3);
      let blink = 1;
      if (t >= CRACK_T) {
        // Cracking: a blink and flecks shed from the glass, faster toward the end.
        const k = smoothstep((t - CRACK_T) / (SHATTER_T - CRACK_T));
        blink = 1 + 0.05 * Math.sin(t * (14 + 24 * k)) * k;
        this.sparkT += dt;
        if (this.sparkT >= 0.1 - 0.06 * k) { this.sparkT = 0; this.slivers.burst(this.v1.set(C.x + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.9, C.z), 2, 2.0); }
      } else if (age > 0.6) {
        this.sparkT += dt;
        if (this.sparkT >= 0.5) { this.sparkT = 0; this.slivers.burst(this.v1.set(C.x + (Math.random() - 0.5) * 0.7, 0.4 + Math.random() * 2, C.z), 1, 0.7); }
      }
      this.stand.setScale(Math.max(grow, MIN) * blink);
      this.rimMat.opacity = 0.9 * (1 - smoothstep((age - 0.2) / 0.5)) + 0.35;
      this.shadeMat.opacity = 0.4;
      const sp = StarBurst.pop(age, 0.05, 0.18);
      this.pop.set(this.v1.set(C.x, STAND_HEIGHT * 0.5, C.z), 2.0 * sp.scale, sp.opacity, age * 3);
      const gp = THREE.MathUtils.clamp(age / 0.4, 0, 1);
      this.groundShock.set(C, 0.5 + 3.0 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.3 * Math.exp(-age * 9));
      if (t >= SHATTER_T || this.broke) this.shatter();
    }
    if (f.shattered) {
      this.rimMat.opacity *= Math.exp(-dt * 6);
      this.shadeMat.opacity *= Math.exp(-dt * 6);
      this.shake *= Math.exp(-dt * 10);
    }
  }

  /** The mirror comes up: its HP (a unit), then the obstacle, then the burst. */
  private rise() {
    const ctx = this.ctx, C = this.centre, rec = this.rec;
    if (ctx) {
      // The unit first, so the engine does not push it out of the obstacle; the obstacle second.
      const sm = ctx.summon?.({
        kind: 'turret', at: C.clone(), hp: this.settings.hp, seconds: STAND_LIFE + 0.1, damage: 0, attackEvery: 999, range: 0.01,
        color: MIRROR_CSS.body, look: HIDDEN,
      });
      this.unit = sm?.units[0] ?? null;
      this.hpSeen = 1;
      sm?.onDeath((u) => {
        if (!u.slain) return;
        // Broken by damage: the way through opens at once; Bad Luck is due on this screen (the trait's `victimTick`).
        this.broke = true;
        if (rec) { rec.broke = true; rec.gone = true; }
        this.dropObstacle();
      });
      const o: Obstacle = { ax: C.x - HALF_LEN, az: C.z, bx: C.x + HALF_LEN, bz: C.z, r: THICK, height: STAND_HEIGHT, kind: 'wall' };
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, STAND_LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
    this.stand.place(C);
    this.stand.setScale(MIN);
    this.slivers.burst(this.v1.set(C.x, 1.0, C.z), 22, 5, 1.6);
    this.shake = 0.3;
  }

  /** Holds the HP unit on the mirror (a knock would push it out); a drop in its HP flinches the glass. */
  private keepUnit() {
    const u = this.unit;
    if (!u || !u.alive) return;
    u.pos.set(this.centre.x, 0, this.centre.z);
    u.knock.set(0, 0, 0);
    const k = u.hp / u.max;
    if (k < this.hpSeen - 1e-4) {
      this.hpSeen = k;
      this.stand.flinch(0.8);
      this.shake = Math.max(this.shake, 0.18);
      this.slivers.burst(this.v1.set(this.centre.x, 1.3, this.centre.z), 6, 3.5);
    }
  }

  /** It breaks (damage) or runs out (time): the mirror bursts into slivers of glass. */
  private shatter() {
    const f = this.flags, C = this.centre;
    if (f.shattered) return;
    f.shattered = true;
    this.dropObstacle();
    if (this.rec) this.rec.gone = true;
    this.stand.hide();
    for (let i = 0; i < 4; i++) this.slivers.burst(this.v1.set(C.x + (Math.random() - 0.5) * 0.6, 0.5 + i * 0.6, C.z), 12, 5.5, 1.5);
    this.pop.set(C, 0, 0);
    this.shake = 0.3;
    this.endAt = Math.min(this.endAt, this.time + 1.0);
  }
}

export const vanityStandModule: EffectModule = {
  label: 'vanity stand',
  category: 'hero: mirror',
  // The aim point is where the mirror stands; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: FOOT_R },
  create: () => new VanityStandFx(),
  telegraphs(effect) {
    const e = effect as VanityStandFx;
    if (!e.ctx) return [];
    // The footprint of the mirror: it roots her until it rises.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FOOT_R }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VanityStandFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as VanityStandFx).settings;
    f.add(s, 'loop');
    f.add(s, 'hp', 1, 300, 1);
  },
};
