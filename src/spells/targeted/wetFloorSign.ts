import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { Bubbles, Drops, JANITOR, JANITOR_CSS, Ripples, SIGN_HEIGHT, Words, buildSign } from '../../effects/parts/janitor';
import type { MinionLook } from '../../effects/parts/minion';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { SIGN_HALF, SIGN_HP, SIGN_LIFE, SIGN_R, SIGN_RANGE, SIGN_RISE, bookOf, type SignRecord } from '../../traits/janitor';

/**
 * Wet Floor Sign (janitor kit v5, W: terrain, two charges). A pale ring of the sign's footprint marks a spot (8 m, at least 1.5 m
 * from him); a yellow folding A-frame sign tumbles down out of the air onto it and lands at 0.4 s with a clatter and the words WET
 * FLOOR, and stands for 6 s as a real obstacle (`ctx.addObstacle`, a wall 0.9 m wide, 0.2 m half-thick): it blocks walking, sight
 * and bolts for both heroes and the AI. Its place comes only from `ctx.sentFrom` and `ctx.point`, so both screens build the same one.
 *
 * It breaks at 40 damage. Built the way a breakable placed thing is (see crystalPillar.ts, vanityStand.ts): the HP lives in a
 * summoned 'turret' unit (`ctx.summon`: 40 HP, damage 0, no reach, an invisible look), made BEFORE the obstacle and pinned to the spot
 * every frame. When it dies by damage `onDeath` removes the obstacle and the sign bursts into yellow chips; its record
 * (`janitorBooks`, written on both screens at the cast) is marked broken, and the trait's `victimTick` tells his own client, where the
 * effect then breaks it too. Without `ctx.summon` (his own screen online) it only times out or breaks with that message.
 * The slide: a hero who slides into it at 2.5 m/s or more takes 40 and a 0.6 s stun (`victimTick` in `src/traits/janitor.ts`, which
 * needs the record only); the sign clangs (a flinch, sparks, CLANG) on both screens, read from the record's `hitAt`.
 *
 * The telegraph is the footprint (a 0.8 m circle, impact at the landing): it roots him until then. Clean by about 7.5 s.
 * See pipeline/designs/kit-janitor.md.
 */
export interface WetFloorSignSettings {
  hp: number;
  loop: boolean;
}

export const defaultWetFloorSign = (): WetFloorSignSettings => ({ hp: SIGN_HP, loop: false });

// Timeline (seconds).
const LAND_T = SIGN_RISE;
const BREAK_T = LAND_T + SIGN_LIFE;
const FOLD_T = BREAK_T - 0.9;
const DURATION = BREAK_T + 1.0;
const DROP_FROM = 2.4;

const MIN_DIST = 1.5;
const FOOT_R = 0.8; // the telegraph circle
const MIN = 1e-3;

/** The summoned unit's look: nothing. The effect draws the sign; the unit gives the HP bar (over it) and the target. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: SIGN_HEIGHT + 0.3 });

export class WetFloorSignFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WetFloorSignSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the sign stands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private flags = { landed: false, broken: false };
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private unit: SummonUnit | null = null;
  private rec: SignRecord | null = null;
  private hpSeen = 1;
  private hitSeen = 0;
  private wobble = 0;
  private broke = false;
  private endAt = DURATION;
  private sparkT = 0;

  private sign = buildSign();
  private ripples = new Ripples(5);
  private drops = new Drops(60);
  private bubbles = new Bubbles(20);
  private words = new Words(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: JANITOR.yellow, core: 0xffffff, additive: false });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: JANITOR.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: JANITOR.yellow, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();

  constructor(settings: WetFloorSignSettings = defaultWetFloorSign()) {
    this.settings = settings;
    // A dark layer under the sign and a yellow ring round its foot: it reads on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.sign.visible = false;
    this.group.add(this.shade, this.rim, this.sign, this.ripples.mesh, this.drops.mesh, this.bubbles.mesh, this.words.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the sign: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, SIGN_RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
  }

  play() {
    this.reset();
    this.playing = true;
    // The record the trait reads, on both screens (ids count casts, so both screens name it the same).
    const ctx = this.ctx;
    if (ctx) {
      const now = performance.now(), b = bookOf(ctx.caster), C = this.centre;
      b.signs = b.signs.filter((s) => !s.gone && now < s.until);
      this.rec = { id: ++b.seq, x: C.x, z: C.z, bornAt: now + LAND_T * 1000, until: now + BREAK_T * 1000, gone: false, broke: false, told: false, hitAt: 0, slideAt: 0 };
      b.signs.push(this.rec);
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
    this.flags.landed = this.flags.broken = false;
    this.broke = false;
    this.unit = null;
    this.rec = null;
    this.hpSeen = 1;
    this.hitSeen = 0;
    this.wobble = 0;
    this.endAt = DURATION;
    this.sparkT = 0;
    this.dropObstacle();
    this.sign.visible = false;
    this.ripples.reset();
    this.drops.reset();
    this.bubbles.reset();
    this.words.reset();
    this.pop.set(this.centre, 0, 0);
    this.shade.visible = this.rim.visible = false;
    this.shadeMat.opacity = this.rimMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ripples.update(dt);
    this.drops.update(dt);
    this.bubbles.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const busy = this.drops.busy || this.bubbles.busy || this.words.busy;
    if (this.time >= this.endAt && !busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, C = this.centre;

    // --- The seed: a yellow ring and a dark patch on the floor, and the sign tumbling down onto it. ---
    if (!this.shade.visible) {
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.rim.position.set(C.x, 0.04, C.z);
    }
    if (!f.landed) {
      const k = smoothstep(t / LAND_T);
      this.shade.scale.setScalar(FOOT_R * (0.5 + 0.7 * k));
      this.shadeMat.opacity = 0.4 * k;
      this.rim.scale.setScalar(FOOT_R * (0.5 + 0.5 * k));
      this.rimMat.opacity = 0.35 + 0.5 * k;
      // The sign falls from above, tumbling, folded open as it comes.
      const fall = THREE.MathUtils.clamp((t - 0.04) / (LAND_T - 0.04), 0, 1);
      this.sign.visible = true;
      this.sign.position.set(C.x, DROP_FROM * (1 - fall) * (1 - fall), C.z);
      this.sign.rotation.set(0, 0, (1 - fall) * 1.4);
      this.sign.scale.setScalar(Math.max(MIN, 0.6 + 0.4 * fall));
    }
    if (!f.landed && t >= LAND_T) {
      f.landed = true;
      this.land();
    }

    if (f.landed && !f.broken) {
      this.keepUnit();
      // His own screen has no unit: the trait's note (`gone`) breaks the sign there.
      if (this.rec?.gone) this.broke = true;
      const age = t - LAND_T;
      // A hit by a slide (the record's `hitAt`) clangs on both screens.
      if (this.rec && this.rec.hitAt > this.hitSeen) { this.hitSeen = this.rec.hitAt; this.clang(); }
      this.wobble *= Math.exp(-dt * 6);
      const w = Math.sin(age * 40) * this.wobble;
      let blink = 1;
      if (t >= FOLD_T) {
        // About to give out: it sways and sheds flecks, faster toward the end.
        const k = smoothstep((t - FOLD_T) / (BREAK_T - FOLD_T));
        blink = 1 + 0.04 * Math.sin(t * (14 + 24 * k)) * k;
        this.sparkT += dt;
        if (this.sparkT >= 0.1 - 0.06 * k) { this.sparkT = 0; this.drops.burst(this.v1.set(C.x, 0.9, C.z), 1, 1.2, 1.5, 0.05, undefined, JANITOR.yellow); }
      }
      this.sign.position.set(C.x, 0, C.z);
      this.sign.rotation.set(0, 0, w);
      this.sign.scale.setScalar(Math.max(MIN, blink));
      this.rimMat.opacity = 0.9 * (1 - smoothstep((age - 0.2) / 0.5)) + 0.35;
      this.shadeMat.opacity = 0.4;
      const sp = StarBurst.pop(age, 0.05, 0.18);
      this.pop.set(this.v1.set(C.x, SIGN_HEIGHT * 0.5, C.z), 1.6 * sp.scale, sp.opacity, age * 3);
      this.shake = Math.max(this.shake * 0.9, 0.22 * Math.exp(-age * 9));
      if (t >= BREAK_T || this.broke) this.shatter();
    }
    if (f.broken) {
      this.rimMat.opacity *= Math.exp(-dt * 6);
      this.shadeMat.opacity *= Math.exp(-dt * 6);
      this.shake *= Math.exp(-dt * 10);
    }
  }

  /** The sign lands: its HP (a unit), then the obstacle, then the clatter and the words. */
  private land() {
    const ctx = this.ctx, C = this.centre, rec = this.rec;
    if (ctx) {
      // The unit first, so the engine does not push it out of the obstacle; the obstacle second.
      const sm = ctx.summon?.({
        kind: 'turret', at: C.clone(), hp: this.settings.hp, seconds: SIGN_LIFE + 0.1, damage: 0, attackEvery: 999, range: 0.01,
        color: JANITOR_CSS.yellow, look: HIDDEN,
      });
      this.unit = sm?.units[0] ?? null;
      this.hpSeen = 1;
      sm?.onDeath((u) => {
        if (!u.slain) return;
        // Broken by damage: the way opens at once (the trait's `victimTick` tells his own client).
        this.broke = true;
        if (rec) { rec.broke = true; rec.gone = true; }
        this.dropObstacle();
      });
      const o: Obstacle = { ax: C.x - SIGN_HALF, az: C.z, bx: C.x + SIGN_HALF, bz: C.z, r: SIGN_R, height: SIGN_HEIGHT, kind: 'wall' };
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, SIGN_LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
    this.sign.position.set(C.x, 0, C.z);
    this.sign.rotation.set(0, 0, 0);
    this.sign.scale.setScalar(1);
    this.ripples.fire(C.x, C.z, 0.3, 2.0, 0.45, 0.7, JANITOR.foam, true);
    this.ripples.fire(C.x, C.z, 0.2, 3.2, 0.6, 0.4, JANITOR.water);
    this.drops.burst(this.v1.set(C.x, 0.15, C.z), 14, 3.2, 3.6, 0.07);
    this.bubbles.emit(this.v1.set(C.x, 0.1, C.z), 8, 0.9, 0.16, 1.0);
    this.v1.set(C.x, SIGN_HEIGHT + 0.9, C.z);
    this.words.show('WET FLOOR', this.v1, 0.7, 1.5);
    this.shake = 0.22;
  }

  /** A slide into the sign, or a hit on it: it rings, sparks fly. */
  private clang() {
    const C = this.centre;
    this.wobble = 0.12;
    this.shake = Math.max(this.shake, 0.2);
    this.drops.burst(this.v1.set(C.x, 0.9, C.z), 12, 3.4, 3, 0.05, undefined, JANITOR.yellow);
    this.ripples.fire(C.x, C.z, 0.3, 1.6, 0.3, 0.6, JANITOR.yellow);
    this.words.show('CLANG', this.v1.set(C.x, SIGN_HEIGHT + 0.6, C.z), 0.5, 0.8);
  }

  /** Holds the HP unit on the sign (a knock would push it out); a drop in its HP flinches it. */
  private keepUnit() {
    const u = this.unit;
    if (!u || !u.alive) return;
    u.pos.set(this.centre.x, 0, this.centre.z);
    u.knock.set(0, 0, 0);
    const k = u.hp / u.max;
    if (k < this.hpSeen - 1e-4) {
      this.hpSeen = k;
      this.wobble = 0.1;
      this.shake = Math.max(this.shake, 0.15);
      this.drops.burst(this.v1.set(this.centre.x, 1.0, this.centre.z), 6, 3, 3, 0.05, undefined, JANITOR.yellow);
    }
  }

  /** It breaks (damage) or runs out (time): the sign bursts into yellow chips and water. */
  private shatter() {
    const f = this.flags, C = this.centre;
    if (f.broken) return;
    f.broken = true;
    this.dropObstacle();
    if (this.rec) this.rec.gone = true;
    this.sign.visible = false;
    for (let i = 0; i < 3; i++) this.drops.burst(this.v1.set(C.x, 0.4 + i * 0.4, C.z), 12, 4.5, 3.8, 0.09, undefined, i % 2 ? JANITOR.yellowDeep : JANITOR.yellow);
    this.ripples.fire(C.x, C.z, 0.3, 1.8, 0.35, 0.6, JANITOR.pale);
    this.pop.set(C, 0, 0);
    this.shake = 0.25;
    this.endAt = Math.min(this.endAt, this.time + 1.0);
  }
}

export const wetFloorSignModule: EffectModule = {
  label: 'wet floor sign',
  category: 'hero: janitor',
  // The aim point is where the sign stands; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: FOOT_R },
  create: () => new WetFloorSignFx(),
  telegraphs(effect) {
    const e = effect as WetFloorSignFx;
    if (!e.ctx) return [];
    // The footprint of the sign: it roots him until it lands.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FOOT_R }, start: 0.04, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WetFloorSignFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as WetFloorSignFx).settings;
    f.add(s, 'loop');
    f.add(s, 'hp', 1, 300, 1);
  },
};
