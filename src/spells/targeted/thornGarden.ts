import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodPool, BloodSigil, BloodTendril, BloodThorns, ShockRefraction, SmokeBall,
  StarBurst, clearScreenFx, createScreenFx,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thorn Garden (blood kit, W: zone). The caster flicks a hand down and a tendril pours to the ground and runs to the
 * target point. A bone sigil draws on, a pool of blood spreads inside it and goes still; a few smooth bulges rise
 * where thorns will come up. After a dead beat the whole pool freezes upward into a thicket of crystal thorns, the
 * tallest under the enemies, which are lifted onto one big thorn each. Thin threads drain them to the caster's chest.
 * Then the thicket shatters outward into flakes and the pool dries. See pipeline/designs/thorn-garden.md (MOBA timing).
 */
export interface ThornGardenSettings {
  damage: number;
  tick: number;
  loop: boolean;
}

export const defaultThornGarden = (): ThornGardenSettings => ({ damage: 50, tick: 10, loop: false });

// Timeline (seconds).
const SIGIL_T = 0.2; // sigil + pool start
const SIGIL_END = 0.6;
const STILL_T = 0.6; // bulges stop growing: the dead beat
const ERUPT_T = 0.75;
const DRAIN_T = 0.85;
const TICK_T = 1.2;
const SHATTER_T = 1.4; // three bands, centre outward, 0.06 apart
const DURATION = 2.3;
const RADIUS = 4.5;
const SPREAD_R = 3.0; // keeps the sigil's thorned band and outer rings visible around the blood
const THORN_R = 3.4;
const THORN_COUNT = 34;
const LIFT = 1.2;
const MAX_VIS = 6; // enemies that get their own threads / bursts
const BULGES = 6;
const RIPPLES = 4;

interface Ripple { x: number; z: number; at: number }

export class ThornGarden implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThornGardenSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.1, 13);
  private chest = new THREE.Vector3(0, 1.25, 14);
  private centre = new THREE.Vector3(0, 0, -6);
  private drop = new THREE.Vector3();
  private feet: THREE.Vector3[] = [];
  private enemyChest: THREE.Vector3[] = [];

  private flags = { pour: false, drips: false, erupted: false, drain: false, tick: false, shattered: [false, false, false], smoke: false, dried: false, done: false };
  private arrivals: number[] = [];
  private ripples: Ripple[] = [];
  private bulgeSpots: { x: number; z: number }[] = [];

  // Parts.
  private offer = new BloodTendril({ segments: 40 });
  private offerPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private sigil = new BloodSigil();
  private pool = new BloodPool();
  private drops = new BloodDrops({ maxDrops: 64, maxSplats: 10 });
  private bulges: BloodTendril[] = [];
  private bulgePts: THREE.Vector3[][] = [];
  private bands = [0, 1, 2].map(() => new BloodThorns({ maxSpikes: 40, maxFlakes: 130 }));
  private threads: BloodTendril[] = [];
  private bursts: StarBurst[] = [];
  private chestPulse = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: BLOOD.hot, core: BLOOD.bone, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private smoke = new SmokeBall({ maxBalls: 3, color: BLOOD.dark, rim: 0x2a0a10, flake: BLOOD_CSS.dark });
  private ringMat = new THREE.MeshBasicMaterial({ color: BLOOD.hot, transparent: true, depthWrite: false, opacity: 0 });
  private ringMeshes: THREE.Mesh[] = [];

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: ThornGardenSettings = defaultThornGarden()) {
    this.settings = settings;
    this.screen.tint.set(BLOOD.dark);

    this.offer.width = 0.2;
    this.offer.bead = 1.4;
    this.offer.setPoints(this.offerPts);

    for (let i = 0; i < BULGES; i++) {
      const b = new BloodTendril({ segments: 12, sides: 10 });
      b.width = 0.6;
      b.bead = 1;
      b.wobble = 0.01;
      const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      b.setPoints(pts);
      this.bulges.push(b);
      this.bulgePts.push(pts);
      const a = i * 1.047 + 0.4, r = 1.1 + (i % 2) * 1.3 + (i % 3) * 0.2;
      this.bulgeSpots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }

    for (let i = 0; i < MAX_VIS; i++) {
      const th = new BloodTendril({ segments: 24 });
      th.width = 0.05;
      th.bead = 1.2;
      th.wobble = 0.015;
      this.feet.push(new THREE.Vector3());
      this.enemyChest.push(new THREE.Vector3());
      th.setFunction((u, out) => {
        out.lerpVectors(this.enemyChest[i], this.chest, u);
        out.y += 0.5 * Math.sin(Math.PI * u);
        return out;
      });
      this.threads.push(th);
      this.bursts.push(new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: 0xeafcff, additive: false }));
    }

    const ringGeo = new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < RIPPLES; i++) {
      const m = new THREE.Mesh(ringGeo, this.ringMat.clone());
      m.visible = false;
      m.frustumCulled = false;
      this.ringMeshes.push(m);
    }

    this.sigil.mesh.renderOrder = 1;
    this.pool.mesh.renderOrder = 2; // blood over the sigil's inner pattern
    this.drops.splats.mesh.renderOrder = 3;
    for (const m of this.ringMeshes) m.renderOrder = 3;
    this.drops.splats.life = 1.0;
    this.drops.splats.dryAt = 0.3;
    this.drops.splats.y = 0.045;
    for (const b of this.bands) b.gravity = -22;
    this.smoke.hold = 0.2;
    this.smoke.emitter.settings.lifetime = 0.5;
    this.emitters.push(this.smoke.emitter);
    this.drops.onArrive = () => this.arrivals.push(this.time);

    this.group.add(
      this.pool.mesh, this.sigil.mesh, this.offer.mesh, ...this.ringMeshes, ...this.bulges.map((b) => b.mesh),
      ...this.bands.map((b) => b.mesh), ...this.threads.map((t) => t.mesh), this.drops.mesh,
      this.smoke.mesh, this.smoke.emitter.points, ...this.bursts.map((b) => b.mesh), this.chestPulse.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ERUPT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.centre.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).setY(1.1);
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    const dist = Math.max(this.from.distanceTo(this.centre), 1);
    this.drop.copy(this.from).addScaledVector(this.fwd, dist * 0.35).setY(0.06);
    const n = Math.min(MAX_VIS, ctx.targets.length);
    for (let i = 0; i < MAX_VIS; i++) {
      if (i < n) this.feet[i].copy(ctx.targetPos[i]).setY(0);
      else this.feet[i].set(0, -50, 0);
    }
    this.screen.focus.copy(this.centre);
    this.pool.place(this.centre);
    this.sigil.set(this.v1.copy(this.centre).setY(0.05), this.v2.set(0, 1, 0), RADIUS, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arrivals.length = 0;
    this.ripples.length = 0;
    this.poolStarted = false;
    const f = this.flags;
    f.pour = f.drips = f.erupted = f.drain = f.tick = f.smoke = f.dried = f.done = false;
    f.shattered = [false, false, false];
    clearScreenFx(this.screen);
    this.screen.tint.set(BLOOD.dark);
    this.smoke.clear();
    this.drops.reset();
    for (const b of this.bands) b.reset();
    this.pool.reset();
    this.sigil.reset();
    this.offer.reset();
    for (const b of this.bulges) b.reset();
    for (const t of this.threads) t.reset();
    for (const b of this.bursts) b.set(this.centre, 0, 0);
    for (const m of this.ringMeshes) m.visible = false;
    this.chestPulse.set(this.chest, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  /** Builds all the thorns: a Vogel spiral over the disc plus one big spike under every enemy. */
  private erupt() {
    const n = Math.min(MAX_VIS, this.ctx?.targets.length ?? 0);
    const dir = new THREE.Vector3(), base = new THREE.Vector3();
    const place = (x: number, z: number, h: number, w: number, lean: number, yaw?: number) => {
      const dx = x - this.centre.x, dz = z - this.centre.z, r = Math.hypot(dx, dz);
      const a = yaw ?? Math.atan2(dz, dx);
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      base.set(x, 0, z);
      const band = r < 1.5 ? 0 : r < 2.8 ? 1 : 2;
      this.bands[band].spike(base, dir, h, w, 0.1, (r / THORN_R) * 0.12);
    };
    const wOf = (h: number) => Math.max(0.28, 0.45 * (h / 2.6));
    for (let i = 0; i < THORN_COUNT; i++) {
      const r = THORN_R * Math.sqrt((i + 0.5) / THORN_COUNT);
      const a = i * 2.39996 + Math.sin(i * 12.9898) * 0.25;
      const x = this.centre.x + Math.cos(a) * r, z = this.centre.z + Math.sin(a) * r;
      let near = 99;
      for (let k = 0; k < n; k++) near = Math.min(near, Math.hypot(x - this.feet[k].x, z - this.feet[k].z));
      if (near < 0.7) continue; // keep the enemy's own spike clear
      const hash = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
      const boost = 1 - smoothstep(near / 1.8);
      let h = 0.9 + 1.4 * hash + 0.6 * boost;
      h *= 1 - 0.3 * (r / THORN_R) * (r / THORN_R);
      h = Math.min(2.8, h);
      place(x, z, h, wOf(h), 0.2 + 0.2 * (r / THORN_R) + (hash - 0.5) * 0.5, hash * 6.28);
    }
    // The impaling thorn comes up beside each enemy, on the caster's side, and leans 20 degrees into the body.
    for (let k = 0; k < n; k++) {
      const away = this.v1.subVectors(this.feet[k], this.from).setY(0);
      if (away.lengthSq() < 1e-4) away.copy(this.fwd).negate();
      away.normalize();
      const bx = this.feet[k].x - away.x * 0.5, bz = this.feet[k].z - away.z * 0.5;
      const dx = bx - this.centre.x, dz = bz - this.centre.z, r = Math.hypot(dx, dz);
      dir.set(away.x * Math.sin(0.35), Math.cos(0.35), away.z * Math.sin(0.35));
      base.set(bx, 0, bz);
      this.bands[r < 1.5 ? 0 : r < 2.8 ? 1 : 2].spike(base, dir, 3, 0.9, 0.1, (r / THORN_R) * 0.12);
    }
  }

  /** Enemy lift at time t: sink during the pool, snap up on the eruption, drop at the shatter. */
  private lift(t: number) {
    if (t < ERUPT_T) return -0.1 * smoothstep((t - 0.3) / 0.3);
    if (t < SHATTER_T) return -0.1 + (LIFT + 0.1) * (1 - Math.pow(1 - Math.min(1, (t - ERUPT_T) / 0.1), 3));
    const u = Math.min(1, (t - SHATTER_T) / 0.2);
    return LIFT * (1 - u * u);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
    for (const b of this.bands) b.update(dt);
    this.pool.update(dt);
    this.time += dt;
    const ctx = this.ctx;
    if (this.time >= DURATION) {
      if (ctx) for (let i = 0; i < Math.min(MAX_VIS, ctx.targets.length); i++) ctx.displace(ctx.targets[i], this.zero);
      // Anything still alive (late flakes) is hidden so the frame ends clean.
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // Events.
    if (!f.pour && t >= 0.02) { f.pour = true; this.drops.spray(this.hand, this.v1.set(0, -1, 0.3), 3, 2, 0.5); }
    if (!f.drips && t >= 0.1) {
      f.drips = true;
      // A few drops fall into the pool from above; each leaves a ring ripple when it lands.
      for (let i = 0; i < RIPPLES; i++) {
        const a = i * 2.1 + 0.5, r = 0.8 + i * 0.6;
        const x = this.centre.x + Math.cos(a) * r, z = this.centre.z + Math.sin(a) * r;
        this.drops.emit(this.v1.set(x, 1.0, z), this.v2.set(0, 0, 0), 0.07, 1);
        this.ripples.push({ x, z, at: t + i * 0.07 + 0.38 });
      }
    }
    if (!f.erupted && t >= ERUPT_T) {
      f.erupted = true;
      this.erupt();
      this.drops.spray(this.v1.copy(this.centre).setY(0.1), this.v2.set(0, 1, 0), 8, 5, 0.9);
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: BLOOD_CSS.body });
    }
    if (!f.drain && t >= DRAIN_T && ctx) {
      f.drain = true;
      const n = Math.min(MAX_VIS, ctx.targets.length);
      for (let i = 0; i < n; i++) {
        this.drops.drain(this.v1.copy(this.enemyChest[i]), (out) => out.copy(this.chest), 4, { delay: i * 0.03, stagger: 0.07, duration: 0.4, radius: 0.07, spread: 0.2 });
      }
    }
    if (!f.tick && t >= TICK_T) {
      f.tick = true;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.tick, knock: 0, color: BLOOD_CSS.body });
    }
    for (let b = 0; b < 3; b++) {
      if (!f.shattered[b] && t >= SHATTER_T + b * 0.06) {
        f.shattered[b] = true;
        this.bands[b].shatter(3, 4.5, 0.4);
      }
    }
    if (!f.smoke && t >= SHATTER_T + 0.1) {
      f.smoke = true;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 1.0;
        this.smoke.trigger(this.v1.set(this.centre.x + Math.cos(a) * 1.8, 0.4, this.centre.z + Math.sin(a) * 1.8), 0.8, 0.6);
      }
    }
    if (!f.dried && t >= SHATTER_T) { f.dried = true; this.pool.dry(0.3, 0.4); }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const n = ctx ? Math.min(MAX_VIS, ctx.targets.length) : 0;
    const after = t - ERUPT_T;

    // --- 0..0.2 Offering: an arc from the hand to the ground, then along the floor to the point; then it pours away. ---
    const p = this.offerPts;
    p[0].copy(this.hand);
    p[1].lerpVectors(this.hand, this.drop, 0.5).y += 0.35;
    p[2].copy(this.drop);
    p[3].lerpVectors(this.drop, this.centre, 0.5).setY(0.06);
    p[4].copy(this.centre).setY(0.06);
    const arcU = THREE.MathUtils.clamp(t / 0.12, 0, 1), runU = THREE.MathUtils.clamp((t - 0.12) / 0.1, 0, 1);
    this.offer.head = 0.5 * (1 - Math.pow(1 - arcU, 2)) + 0.5 * runU;
    this.offer.tail = smoothstep((t - 0.22) / 0.2);
    if (t < 0.45) this.offer.update(t);
    else this.offer.mesh.visible = false;

    // --- Sigil, pool, darkening. ---
    this.sigil.reveal = smoothstep((t - SIGIL_T) / (SIGIL_END - SIGIL_T));
    this.sigil.opacity = 1 - smoothstep((t - SHATTER_T) / 0.5);
    if (t >= SIGIL_T && !this.poolStarted) { this.poolStarted = true; this.pool.spread(SPREAD_R, 0.4); }
    this.screen.darken = 0.35 * smoothstep((t - SIGIL_T) / 0.4) * (1 - smoothstep((t - SHATTER_T) / 0.6));

    // --- Ripples from the falling drops. ---
    for (let i = 0; i < this.ringMeshes.length; i++) {
      const m = this.ringMeshes[i], r = this.ripples[i];
      const u = r ? (t - r.at) / 0.2 : -1;
      if (!r || u < 0 || u >= 1 || t >= ERUPT_T) { m.visible = false; continue; }
      m.visible = true;
      m.position.set(r.x, 0.05, r.z);
      m.scale.setScalar(0.1 + 0.45 * u);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u);
    }

    // --- Bulges: smooth blobs rise where thorns will come, hold still, vanish at the eruption. ---
    const grow = smoothstep((t - 0.3) / 0.3);
    for (let i = 0; i < BULGES; i++) {
      const b = this.bulges[i], s = this.bulgeSpots[i];
      if (t < 0.3 || t >= ERUPT_T) { b.mesh.visible = false; continue; }
      const h = 0.5 * grow;
      const q = this.bulgePts[i];
      q[0].set(this.centre.x + s.x, 0.03, this.centre.z + s.z);
      q[1].set(q[0].x, 0.03 + h * 0.5, q[0].z);
      q[2].set(q[0].x, 0.03 + h, q[0].z);
      b.wobble = t < STILL_T ? 0.012 : 0;
      b.update(t);
    }

    // --- Enemies: sink, snap up onto their thorn, drop back. ---
    const lift = this.lift(t);
    for (let i = 0; i < n; i++) {
      this.enemyChest[i].copy(this.feet[i]);
      this.enemyChest[i].y = 1.1 + lift;
      ctx!.displace(ctx!.targets[i], this.v3.set(0, lift, 0));
    }

    // --- Eruption: ground shock, cold bursts under the enemies, shake. ---
    if (f.erupted) {
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.centre, 1 + 5 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.45 * Math.exp(-after * 9);
      for (let i = 0; i < MAX_VIS; i++) {
        const sp = StarBurst.pop(after, 0.03, 0.05);
        this.bursts[i].set(this.v1.copy(this.feet[i]).setY(0.4), i < n ? 1.1 * sp.scale : 0, sp.opacity, i);
      }
    } else {
      this.shake = t > 0.5 ? 0.05 * smoothstep((t - 0.5) / 0.1) : 0;
    }

    // --- Drain threads: reveal from the enemy to the caster, pull in at the shatter. ---
    for (let i = 0; i < MAX_VIS; i++) {
      const th = this.threads[i];
      if (i >= n || t < DRAIN_T || t >= SHATTER_T + 0.2) { th.mesh.visible = false; continue; }
      th.head = smoothstep((t - DRAIN_T) / 0.15);
      th.tail = smoothstep((t - SHATTER_T) / 0.15);
      th.update(t);
    }

    // --- Drain: a tiny crimson pulse at the chest for every drop that arrives. ---
    let ps = 0;
    for (const ta of this.arrivals) ps = Math.max(ps, StarBurst.pop(t - ta, 0.0, 0.07).scale);
    this.chestPulse.set(this.chest, 0.5 * ps, ps > 0 ? 1 : 0, 0);
  }

  private poolStarted = false;
}

export const thornGardenModule: EffectModule = {
  label: 'thorn garden',
  category: 'hero: blood',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ThornGarden(),
  telegraphs(effect) {
    const e = effect as ThornGarden;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: ERUPT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThornGarden;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ThornGarden).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 0, 60, 1);
  },
};
